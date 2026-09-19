import { describe, expect, it } from "vitest";
import { createDriveAccessTokenProvider } from "./googleDriveServiceAccount";

const SPREADSHEET_ID = "1ncyMnVgrwJ9DYWJDRorgnxNpGBPwaMAi3j8BYhxkjqQ";
const runLive = process.env.RUN_GOOGLE_SERVICE_ACCOUNT_LIVE_TEST === "true";

describe.runIf(runLive)("Google service account live access", () => {
  it("obtiene un token renovable y puede leer la metadata de la planilla financiera", async () => {
    const provider = createDriveAccessTokenProvider();
    expect(provider.source).toBe("service_account");
    expect(provider.renewable).toBe(true);

    const token = await provider.getAccessToken({ forceRefresh: true });
    expect(token.length).toBeGreaterThan(20);

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${SPREADSHEET_ID}?fields=id,name,mimeType&supportsAllDrives=true`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(30_000),
      },
    );
    expect(response.status).toBe(200);
    const metadata = await response.json() as { id?: string; name?: string; mimeType?: string };
    expect(metadata).toMatchObject({
      id: SPREADSHEET_ID,
      name: "Reporte  Estado de Proyectos_20250205",
      mimeType: "application/vnd.google-apps.spreadsheet",
    });
  }, 45_000);
});
