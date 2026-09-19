import { GoogleAuth, type AnyAuthClient } from "google-auth-library";

export const GOOGLE_DRIVE_READONLY_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

export type DriveCredentialSource = "service_account" | "legacy_access_token";

export interface DriveAccessTokenProvider {
  readonly source: DriveCredentialSource;
  readonly renewable: boolean;
  getAccessToken(options?: { forceRefresh?: boolean }): Promise<string>;
}

type GoogleCredentialEnv = {
  GOOGLE_SERVICE_ACCOUNT_JSON?: string;
  GOOGLE_DRIVE_TOKEN?: string;
};

type ServiceAccountCredentials = {
  type: "service_account";
  project_id?: string;
  private_key_id?: string;
  private_key: string;
  client_email: string;
  client_id?: string;
  token_uri?: string;
};

export class GoogleDriveCredentialError extends Error {
  constructor(
    public readonly code:
      | "GOOGLE_CREDENTIALS_MISSING"
      | "GOOGLE_SERVICE_ACCOUNT_INVALID"
      | "GOOGLE_ACCESS_TOKEN_UNAVAILABLE",
    message: string,
  ) {
    super(message);
    this.name = "GoogleDriveCredentialError";
  }
}

function decodeCredentialSecret(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) return trimmed;
  try {
    return Buffer.from(trimmed, "base64").toString("utf8");
  } catch {
    throw new GoogleDriveCredentialError(
      "GOOGLE_SERVICE_ACCOUNT_INVALID",
      "GOOGLE_SERVICE_ACCOUNT_JSON no contiene JSON ni Base64 válido",
    );
  }
}

export function parseGoogleServiceAccountCredentials(raw: string): ServiceAccountCredentials {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeCredentialSecret(raw));
  } catch (error) {
    if (error instanceof GoogleDriveCredentialError) throw error;
    throw new GoogleDriveCredentialError(
      "GOOGLE_SERVICE_ACCOUNT_INVALID",
      "GOOGLE_SERVICE_ACCOUNT_JSON no contiene JSON válido",
    );
  }

  if (!parsed || typeof parsed !== "object") {
    throw new GoogleDriveCredentialError(
      "GOOGLE_SERVICE_ACCOUNT_INVALID",
      "GOOGLE_SERVICE_ACCOUNT_JSON debe ser un objeto JSON",
    );
  }

  const credentials = parsed as Partial<ServiceAccountCredentials>;
  if (
    credentials.type !== "service_account" ||
    typeof credentials.client_email !== "string" ||
    !credentials.client_email.includes("@") ||
    typeof credentials.private_key !== "string" ||
    !credentials.private_key.includes("BEGIN PRIVATE KEY")
  ) {
    throw new GoogleDriveCredentialError(
      "GOOGLE_SERVICE_ACCOUNT_INVALID",
      "La credencial Google no corresponde a una cuenta de servicio válida",
    );
  }

  return credentials as ServiceAccountCredentials;
}

class ServiceAccountTokenProvider implements DriveAccessTokenProvider {
  readonly source = "service_account" as const;
  readonly renewable = true;
  private clientPromise: Promise<AnyAuthClient> | null = null;

  constructor(private readonly credentials: ServiceAccountCredentials) {}

  private getClient(): Promise<AnyAuthClient> {
    if (!this.clientPromise) {
      const auth = new GoogleAuth({
        credentials: this.credentials,
        scopes: [GOOGLE_DRIVE_READONLY_SCOPE],
      });
      this.clientPromise = auth.getClient();
    }
    return this.clientPromise;
  }

  async getAccessToken(options?: { forceRefresh?: boolean }): Promise<string> {
    const client = await this.getClient();
    if (options?.forceRefresh) {
      client.credentials.access_token = undefined;
      client.credentials.expiry_date = 0;
    }
    const result = await client.getAccessToken();
    const token = typeof result === "string" ? result : result?.token;
    if (!token) {
      throw new GoogleDriveCredentialError(
        "GOOGLE_ACCESS_TOKEN_UNAVAILABLE",
        "Google no entregó un access token para la cuenta de servicio",
      );
    }
    return token;
  }
}

class LegacyStaticTokenProvider implements DriveAccessTokenProvider {
  readonly source = "legacy_access_token" as const;
  readonly renewable = false;

  constructor(private readonly token: string) {}

  async getAccessToken(): Promise<string> {
    return this.token;
  }
}

export function createDriveAccessTokenProvider(
  env: GoogleCredentialEnv = {
    GOOGLE_SERVICE_ACCOUNT_JSON: process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
    GOOGLE_DRIVE_TOKEN: process.env.GOOGLE_DRIVE_TOKEN,
  },
): DriveAccessTokenProvider {
  const serviceAccountJson = env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (serviceAccountJson) {
    return new ServiceAccountTokenProvider(parseGoogleServiceAccountCredentials(serviceAccountJson));
  }

  const legacyToken = env.GOOGLE_DRIVE_TOKEN?.trim();
  if (legacyToken) return new LegacyStaticTokenProvider(legacyToken);

  throw new GoogleDriveCredentialError(
    "GOOGLE_CREDENTIALS_MISSING",
    "No hay credenciales Google configuradas para la sincronización financiera",
  );
}
