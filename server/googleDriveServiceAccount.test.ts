import { describe, expect, it } from "vitest";
import {
  createDriveAccessTokenProvider,
  GoogleDriveCredentialError,
  parseGoogleServiceAccountCredentials,
} from "./googleDriveServiceAccount";

const SERVICE_ACCOUNT = {
  type: "service_account" as const,
  project_id: "pmo-financial-sync",
  private_key_id: "test-key",
  private_key: "-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----\n",
  client_email: "pmo-financial-sync@example.iam.gserviceaccount.com",
  client_id: "123",
  token_uri: "https://oauth2.googleapis.com/token",
};

describe("Google Drive service account credentials", () => {
  it("acepta JSON directo sin exponer ni transformar la clave", () => {
    const parsed = parseGoogleServiceAccountCredentials(JSON.stringify(SERVICE_ACCOUNT));
    expect(parsed.client_email).toBe(SERVICE_ACCOUNT.client_email);
    expect(parsed.private_key).toBe(SERVICE_ACCOUNT.private_key);
  });

  it("acepta el JSON codificado en Base64 para gestores de secretos", () => {
    const encoded = Buffer.from(JSON.stringify(SERVICE_ACCOUNT), "utf8").toString("base64");
    const parsed = parseGoogleServiceAccountCredentials(encoded);
    expect(parsed.type).toBe("service_account");
    expect(parsed.client_email).toBe(SERVICE_ACCOUNT.client_email);
  });

  it("reconstruye los marcadores PEM cuando el gestor conserva sólo el cuerpo PKCS8", () => {
    const parsed = parseGoogleServiceAccountCredentials(JSON.stringify({
      ...SERVICE_ACCOUNT,
      private_key: "A".repeat(1704),
    }));
    expect(parsed.private_key).toMatch(/^-----BEGIN PRIVATE KEY-----\n/);
    expect(parsed.private_key).toMatch(/\n-----END PRIVATE KEY-----\n$/);
  });

  it("rechaza credenciales incompletas con un código no sensible", () => {
    expect(() => parseGoogleServiceAccountCredentials(JSON.stringify({ type: "service_account" }))).toThrow(
      GoogleDriveCredentialError,
    );
    try {
      parseGoogleServiceAccountCredentials(JSON.stringify({ type: "service_account" }));
    } catch (error) {
      expect(error).toMatchObject({ code: "GOOGLE_SERVICE_ACCOUNT_INVALID" });
      expect(String(error)).not.toContain("private_key");
    }
  });

  it("prioriza la cuenta de servicio sobre el token estático heredado", () => {
    const provider = createDriveAccessTokenProvider({
      GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify(SERVICE_ACCOUNT),
      GOOGLE_DRIVE_TOKEN: "legacy-token",
    });
    expect(provider.source).toBe("service_account");
    expect(provider.renewable).toBe(true);
  });

  it("mantiene temporalmente el token heredado como fallback explícito", async () => {
    const provider = createDriveAccessTokenProvider({
      GOOGLE_SERVICE_ACCOUNT_JSON: undefined,
      GOOGLE_DRIVE_TOKEN: "legacy-token",
    });
    expect(provider.source).toBe("legacy_access_token");
    expect(provider.renewable).toBe(false);
    await expect(provider.getAccessToken()).resolves.toBe("legacy-token");
  });

  it("falla antes de llamar Google si no existe ninguna credencial", () => {
    expect(() =>
      createDriveAccessTokenProvider({
        GOOGLE_SERVICE_ACCOUNT_JSON: undefined,
        GOOGLE_DRIVE_TOKEN: undefined,
      }),
    ).toThrowError(/No hay credenciales Google configuradas/);
  });
});
