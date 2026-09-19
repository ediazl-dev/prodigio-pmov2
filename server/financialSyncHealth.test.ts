import { describe, expect, it } from "vitest";
import { buildFinancialSyncHealth, parseFinancialSyncDiagnostic } from "./financialSyncHealth";

describe("financial sync health", () => {
  it("separa último intento fallido de último éxito", () => {
    const health = buildFinancialSyncHealth({
      latestAttempt: {
        id: 3,
        status: "error",
        createdAt: "2026-09-18T03:00:00.000Z",
        errorMessage: "[authentication_error:credentials] Credencial rechazada",
      },
      latestSuccess: {
        id: 1,
        status: "applied",
        createdAt: "2026-09-17T03:00:00.000Z",
      },
      credential: {
        source: "service_account",
        configured: true,
        renewable: true,
        validConfiguration: true,
      },
      taskConfigured: true,
      now: new Date("2026-09-18T04:00:00.000Z"),
    });

    expect(health.latestAttempt?.status).toBe("error");
    expect(health.latestSuccess?.status).toBe("applied");
    expect(health.ageHours).toBe(25);
    expect(health.freshness).toBe("fresh");
    expect(health.diagnostic).toEqual({
      code: "authentication_error",
      phase: "credentials",
      message: "Credencial rechazada",
    });
  });

  it("marca stale después de 72 horas sin éxito", () => {
    const health = buildFinancialSyncHealth({
      latestAttempt: null,
      latestSuccess: { id: 1, status: "applied", createdAt: "2026-09-15T00:00:00.000Z" },
      credential: { source: "none", configured: false, renewable: false, validConfiguration: false },
      taskConfigured: false,
      now: new Date("2026-09-18T01:00:00.000Z"),
    });
    expect(health.ageHours).toBe(73);
    expect(health.freshness).toBe("stale");
  });

  it("mantiene legibles los mensajes históricos sin prefijo", () => {
    expect(parseFinancialSyncDiagnostic("GOOGLE_DRIVE_TOKEN no está configurado")).toEqual({
      code: "legacy_error",
      phase: "unknown",
      message: "GOOGLE_DRIVE_TOKEN no está configurado",
    });
  });
});
