import { describe, expect, it, vi } from "vitest";
import {
  JIRA_RECONCILIATION_TASK_UID_SETTING,
  ScheduledJiraAuthorizationError,
  createScheduledJiraReconciliationHandler,
  runScheduledJiraReconciliationBatch,
  scheduledJiraOperationId,
  type ScheduledJiraBatchDependencies,
} from "./jiraReconciliationSchedule";

function batchDependencies(overrides: Partial<ScheduledJiraBatchDependencies> = {}): ScheduledJiraBatchDependencies {
  return {
    getSetting: vi.fn().mockResolvedValue("task-jira-123"),
    listReadyProjects: vi.fn().mockResolvedValue([
      { onboardingId: 11, projectId: 101, jiraProjectKey: "ALPHA" },
      { onboardingId: 12, projectId: 102, jiraProjectKey: "BETA" },
    ]),
    reconcile: vi.fn()
      .mockResolvedValueOnce({ status: "applied", reused: false, exceptions: 0 })
      .mockRejectedValueOnce(new Error("Jira temporalmente no disponible")),
    now: () => new Date("2026-08-29T04:00:00.000Z"),
    ...overrides,
  };
}

function responseRecorder() {
  const state: { statusCode?: number; body?: unknown } = {};
  const response = {
    status(code: number) {
      state.statusCode = code;
      return response;
    },
    json(body: unknown) {
      state.body = body;
      return response;
    },
  };
  return { state, response };
}

describe("conciliación diaria Jira H7", () => {
  it("usa una operación diaria estable y continúa ante fallos parciales", async () => {
    const deps = batchDependencies();
    const result = await runScheduledJiraReconciliationBatch({ taskUid: "task-jira-123" }, deps);

    expect(scheduledJiraOperationId(new Date("2026-08-29T23:59:59.000Z"))).toBe("daily:2026-08-29");
    expect(deps.getSetting).toHaveBeenCalledWith(JIRA_RECONCILIATION_TASK_UID_SETTING);
    expect(deps.reconcile).toHaveBeenNthCalledWith(1, expect.objectContaining({
      projectId: 101,
      source: "scheduled",
      operationId: "daily:2026-08-29",
      actorId: null,
    }));
    expect(deps.reconcile).toHaveBeenNthCalledWith(2, expect.objectContaining({ projectId: 102 }));
    expect(result).toMatchObject({ status: "partial", processedCount: 2, appliedCount: 1, errorCount: 1 });
  });

  it("rechaza un taskUid distinto antes de listar o conciliar proyectos", async () => {
    const deps = batchDependencies();
    await expect(runScheduledJiraReconciliationBatch({ taskUid: "task-ajena" }, deps))
      .rejects.toBeInstanceOf(ScheduledJiraAuthorizationError);
    expect(deps.listReadyProjects).not.toHaveBeenCalled();
    expect(deps.reconcile).not.toHaveBeenCalled();
  });

  it("limita el lote y reporta proyectos diferidos", async () => {
    const projects = Array.from({ length: 51 }, (_, index) => ({
      onboardingId: index + 1,
      projectId: index + 100,
      jiraProjectKey: `P${index + 1}`,
    }));
    const deps = batchDependencies({
      listReadyProjects: vi.fn().mockResolvedValue(projects),
      reconcile: vi.fn().mockResolvedValue({ status: "applied", reused: true, exceptions: 0 }),
    });
    const result = await runScheduledJiraReconciliationBatch({ taskUid: "task-jira-123" }, deps);
    expect(result).toMatchObject({ status: "partial", candidateCount: 51, processedCount: 50, deferredCount: 1, reusedCount: 50 });
  });

  it("estabiliza un lote multi-proyecto y reutiliza la misma operación diaria sin duplicar", async () => {
    const projects = [
      { onboardingId: 21, projectId: 201, jiraProjectKey: "READYA" },
      { onboardingId: 22, projectId: 202, jiraProjectKey: "READYB" },
      { onboardingId: 23, projectId: 203, jiraProjectKey: "READYC" },
      { onboardingId: 24, projectId: 204, jiraProjectKey: "READYD" },
    ];
    const completed = new Set<number>();
    const reconcile = vi.fn(async ({ projectId, operationId }: { projectId: number; operationId: string }) => {
      expect(operationId).toBe("daily:2026-08-29");
      if (projectId === 204) throw new Error("fallo aislado del proyecto");
      const reused = completed.has(projectId);
      completed.add(projectId);
      if (projectId === 202) return { status: "partial", reused, exceptions: 2 };
      return { status: "applied", reused, exceptions: 0 };
    });
    const deps = batchDependencies({
      listReadyProjects: vi.fn().mockResolvedValue(projects),
      reconcile,
    });

    const first = await runScheduledJiraReconciliationBatch({ taskUid: "task-jira-123" }, deps);
    const retry = await runScheduledJiraReconciliationBatch({ taskUid: "task-jira-123" }, deps);

    expect(first).toMatchObject({
      status: "partial",
      candidateCount: 4,
      processedCount: 4,
      appliedCount: 2,
      partialCount: 1,
      reusedCount: 0,
      errorCount: 1,
    });
    expect(retry).toMatchObject({
      status: "partial",
      candidateCount: 4,
      processedCount: 4,
      appliedCount: 2,
      partialCount: 1,
      reusedCount: 3,
      errorCount: 1,
    });
    expect(reconcile).toHaveBeenCalledTimes(8);
    expect(retry.results.map(result => [result.projectId, result.reused])).toEqual([
      [201, true],
      [202, true],
      [203, true],
      [204, false],
    ]);
  });

  it("bloquea visitantes externos y cron sin taskUid", async () => {
    const external = responseRecorder();
    await createScheduledJiraReconciliationHandler({
      authenticateRequest: vi.fn().mockRejectedValue(new Error("sin sesión")),
      runBatch: vi.fn(),
    })({} as any, external.response as any);
    expect(external.state.statusCode).toBe(401);

    const nonCron = responseRecorder();
    await createScheduledJiraReconciliationHandler({
      authenticateRequest: vi.fn().mockResolvedValue({ isCron: false, taskUid: null }),
      runBatch: vi.fn(),
    })({} as any, nonCron.response as any);
    expect(nonCron.state.statusCode).toBe(403);
  });

  it("acepta cron autenticado y traduce taskUid ajeno a 403", async () => {
    const accepted = responseRecorder();
    const runBatch = vi.fn().mockResolvedValue({ status: "applied", processedCount: 0 });
    await createScheduledJiraReconciliationHandler({
      authenticateRequest: vi.fn().mockResolvedValue({ isCron: true, taskUid: "task-jira-123" }),
      runBatch,
    })({} as any, accepted.response as any);
    expect(accepted.state.statusCode).toBe(200);
    expect(runBatch).toHaveBeenCalledWith({ taskUid: "task-jira-123" });

    const rejected = responseRecorder();
    await createScheduledJiraReconciliationHandler({
      authenticateRequest: vi.fn().mockResolvedValue({ isCron: true, taskUid: "task-ajena" }),
      runBatch: vi.fn().mockRejectedValue(new ScheduledJiraAuthorizationError("taskUid inválido")),
    })({} as any, rejected.response as any);
    expect(rejected.state.statusCode).toBe(403);
  });
});
