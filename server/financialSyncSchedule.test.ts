import { describe, expect, it, vi } from "vitest";
import {
  FinancialSyncOperationalError,
  runFinancialSyncWithDependencies,
  type FinancialSyncOutcome,
} from "./financialSync";
import {
  createScheduledFinancialSyncHandler,
  FINANCIAL_SYNC_TASK_UID_SETTING,
  runScheduledFinancialSync,
} from "./financialSyncSchedule";

const applied: FinancialSyncOutcome = {
  timestampUtc: "2026-09-19T03:00:00.000Z",
  inputDeals: 37,
  insert: 0,
  update: 37,
  status: "applied",
  workbookSha256: "a".repeat(64),
};

function responseRecorder() {
  const state: { status?: number; body?: unknown } = {};
  const response = {
    status(code: number) {
      state.status = code;
      return response;
    },
    json(body: unknown) {
      state.body = body;
      return response;
    },
  };
  return { response: response as any, state };
}

describe("runScheduledFinancialSync", () => {
  it("ejecuta sólo cuando el taskUid coincide con la configuración durable", async () => {
    const run = vi.fn().mockResolvedValue(applied);
    const getSetting = vi.fn().mockResolvedValue("task-financial-123");

    await expect(
      runScheduledFinancialSync(
        { taskUid: "task-financial-123" },
        { getSetting, run },
      ),
    ).resolves.toEqual(applied);
    expect(getSetting).toHaveBeenCalledWith(FINANCIAL_SYNC_TASK_UID_SETTING);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("devuelve orphan 2xx semántico y no ejecuta un UID ajeno", async () => {
    const run = vi.fn().mockResolvedValue(applied);
    await expect(
      runScheduledFinancialSync(
        { taskUid: "task-ajena" },
        { getSetting: vi.fn().mockResolvedValue("task-financial-123"), run },
      ),
    ).resolves.toEqual({ status: "skipped", skipped: "orphan" });
    expect(run).not.toHaveBeenCalled();
  });
});

describe("runFinancialSyncWithDependencies", () => {
  it("omite una corrida concurrente sin descargar ni escribir", async () => {
    const execute = vi.fn();
    const log = vi.fn();
    const outcome = await runFinancialSyncWithDependencies("manual", {
      acquireLock: vi.fn().mockResolvedValue(null),
      execute,
      log,
      now: () => new Date("2026-09-19T01:00:00.000Z"),
    });

    expect(outcome).toMatchObject({ status: "skipped", skipped: "already_running" });
    expect(execute).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it("libera el lock y registra una corrida aplicada", async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    const log = vi.fn().mockResolvedValue(undefined);
    await expect(
      runFinancialSyncWithDependencies("cron", {
        acquireLock: vi.fn().mockResolvedValue(release),
        execute: vi.fn().mockResolvedValue(applied),
        log,
        now: () => new Date(),
      }),
    ).resolves.toEqual(applied);
    expect(release).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ status: "applied", inputDeals: 37 }));
  });

  it("libera el lock y registra código/fase cuando falla", async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    const log = vi.fn().mockResolvedValue(undefined);
    await expect(
      runFinancialSyncWithDependencies("cron", {
        acquireLock: vi.fn().mockResolvedValue(release),
        execute: vi.fn().mockRejectedValue(
          new FinancialSyncOperationalError("preflight_blocked", "preflight", "Deal duplicado"),
        ),
        log,
        now: () => new Date(),
      }),
    ).rejects.toMatchObject({ code: "preflight_blocked", phase: "preflight" });
    expect(release).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(expect.objectContaining({
      status: "error",
      errorMessage: "[preflight_blocked:preflight] Deal duplicado",
    }));
  });
});

describe("scheduled financial handler", () => {
  it("rechaza autenticación ausente", async () => {
    const { response, state } = responseRecorder();
    const handler = createScheduledFinancialSyncHandler({
      authenticateRequest: vi.fn().mockRejectedValue(new Error("no session")),
      run: vi.fn(),
      now: () => new Date(),
    });
    await handler({} as any, response);
    expect(state.status).toBe(401);
  });

  it("rechaza usuarios que no son cron", async () => {
    const { response, state } = responseRecorder();
    const handler = createScheduledFinancialSyncHandler({
      authenticateRequest: vi.fn().mockResolvedValue({ isCron: false }),
      run: vi.fn(),
      now: () => new Date(),
    });
    await handler({} as any, response);
    expect(state.status).toBe(403);
  });

  it("responde 200 para orphan sin ejecutar la sincronización", async () => {
    const { response, state } = responseRecorder();
    const handler = createScheduledFinancialSyncHandler({
      authenticateRequest: vi.fn().mockResolvedValue({ isCron: true, taskUid: "task-ajena" }),
      run: vi.fn().mockResolvedValue({ status: "skipped", skipped: "orphan" }),
      now: () => new Date(),
    });
    await handler({ originalUrl: "/api/scheduled/syncFinancial" } as any, response);
    expect(state.status).toBe(200);
    expect(state.body).toEqual({ status: "skipped", skipped: "orphan" });
  });

  it("expone código y fase no sensibles en un error operacional", async () => {
    const { response, state } = responseRecorder();
    const handler = createScheduledFinancialSyncHandler({
      authenticateRequest: vi.fn().mockResolvedValue({ isCron: true, taskUid: "task-financial-123" }),
      run: vi.fn().mockRejectedValue(
        new FinancialSyncOperationalError("authorization_error", "download", "Sin permiso al archivo"),
      ),
      now: () => new Date("2026-09-19T03:00:00.000Z"),
    });
    await handler({ originalUrl: "/api/scheduled/syncFinancial" } as any, response);
    expect(state.status).toBe(500);
    expect(state.body).toMatchObject({
      status: "error",
      code: "authorization_error",
      phase: "download",
      error: "Sin permiso al archivo",
    });
  });
});
