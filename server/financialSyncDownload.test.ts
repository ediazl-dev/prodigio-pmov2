import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { downloadFinancialWorkbook } from "./financialSync";
import type { DriveAccessTokenProvider } from "./googleDriveServiceAccount";

function response(status: number, body = "workbook"): Response {
  return new Response(body, { status });
}

function provider(renewable: boolean): DriveAccessTokenProvider & { getAccessToken: ReturnType<typeof vi.fn> } {
  return {
    source: renewable ? "service_account" : "legacy_access_token",
    renewable,
    getAccessToken: vi.fn(async ({ forceRefresh } = {}) => (forceRefresh ? "renewed" : "initial")),
  };
}

const tempDirs: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("downloadFinancialWorkbook", () => {
  it("renueva una vez y reintenta cuando Google responde 401", async () => {
    const credentials = provider(true);
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(200, "xlsx-data"));

    const workbook = await downloadFinancialWorkbook({ accessTokenProvider: credentials, fetchImpl });

    expect(workbook.toString()).toBe("xlsx-data");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(credentials.getAccessToken).toHaveBeenNthCalledWith(1, { forceRefresh: false });
    expect(credentials.getAccessToken).toHaveBeenNthCalledWith(2, { forceRefresh: true });
  });

  it("no reintenta un token heredado no renovable", async () => {
    const credentials = provider(false);
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(401));

    await expect(
      downloadFinancialWorkbook({ accessTokenProvider: credentials, fetchImpl }),
    ).rejects.toThrow(/HTTP 401/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("distingue falta de permiso HTTP 403 de una credencial inválida", async () => {
    const credentials = provider(true);
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(403));

    await expect(
      downloadFinancialWorkbook({ accessTokenProvider: credentials, fetchImpl }),
    ).rejects.toThrow(/no tiene permiso.*HTTP 403/i);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rechaza un workbook vacío antes de parsear o escribir", async () => {
    const credentials = provider(true);
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(200, ""));

    await expect(
      downloadFinancialWorkbook({ accessTokenProvider: credentials, fetchImpl }),
    ).rejects.toThrow(/vacía/);
  });

  it("mantiene el fallback local sólo cuando no hay credenciales", async () => {
    const previousServiceAccount = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const previousLegacyToken = process.env.GOOGLE_DRIVE_TOKEN;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_DRIVE_TOKEN;
    const dir = mkdtempSync(join(tmpdir(), "financial-sync-"));
    tempDirs.push(dir);
    const file = join(dir, "financial.xlsx");
    writeFileSync(file, "local-xlsx");

    try {
      const workbook = await downloadFinancialWorkbook({ localFilePath: file });
      expect(workbook.toString()).toBe("local-xlsx");
    } finally {
      if (previousServiceAccount === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
      else process.env.GOOGLE_SERVICE_ACCOUNT_JSON = previousServiceAccount;
      if (previousLegacyToken === undefined) delete process.env.GOOGLE_DRIVE_TOKEN;
      else process.env.GOOGLE_DRIVE_TOKEN = previousLegacyToken;
    }
  });
});
