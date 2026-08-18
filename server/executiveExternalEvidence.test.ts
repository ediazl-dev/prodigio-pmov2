import { describe, expect, it, vi } from "vitest";
import { resolveExternalEvidence } from "./executiveExternalEvidence";

describe("resolveExternalEvidence", () => {
  it("conserva la evidencia disponible y su instante de observación", async () => {
    const result = await resolveExternalEvidence({
      source: "Jira",
      load: async () => ({ totalIssues: 12 }),
      now: () => new Date("2026-08-18T12:00:00.000Z"),
    });

    expect(result).toEqual({
      availability: "available",
      value: { totalIssues: 12 },
      observedAt: "2026-08-18T12:00:00.000Z",
      reason: null,
    });
  });

  it("degrada a timeout sin dejar pendiente la consulta principal", async () => {
    vi.useFakeTimers();
    const resultPromise = resolveExternalEvidence({
      source: "Jira",
      load: () => new Promise<never>(() => undefined),
      timeoutMs: 20,
    });

    await vi.advanceTimersByTimeAsync(20);
    await expect(resultPromise).resolves.toMatchObject({
      availability: "timed_out",
      value: null,
      observedAt: null,
      reason: "timeout",
    });
    vi.useRealTimers();
  });

  it("expone falla de fuente sin inventar evidencia", async () => {
    const result = await resolveExternalEvidence({
      source: "Finanzas",
      load: async () => { throw new Error("Fuente no disponible"); },
    });

    expect(result).toMatchObject({ availability: "unavailable", value: null, reason: "source_error" });
  });
});
