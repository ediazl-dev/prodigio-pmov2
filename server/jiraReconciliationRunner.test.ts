import { describe, expect, it, vi } from "vitest";
import { buildJiraIssueKeyJql, runJiraReconciliation, type JiraReconciliationRunnerDependencies } from "./jiraReconciliationRunner";

function readyContext() {
  return {
    onboarding: {
      id: 17,
      projectId: 700,
      jiraProjectKey: "PILOT",
      status: "ready" as const,
      mappingVersion: 2,
      sourceFingerprint: "old",
      sourceSnapshot: { issues: [{ key: "PILOT-99", summary: "No mapeada" }] },
      identitySnapshot: { dealId: "Deal700" },
    },
    mappings: [
      { sourceKey: "PILOT-1", targetEntityType: "risk", targetEntityId: null, status: "approved", syncDirection: "jira_to_pmo" },
      { sourceKey: "PILOT-2", targetEntityType: "epic", targetEntityId: null, status: "approved", syncDirection: "jira_to_pmo" },
      { sourceKey: "PILOT-3", targetEntityType: "milestone", targetEntityId: "31", status: "approved", syncDirection: "jira_to_pmo" },
    ],
  };
}

function dependencies(overrides: Partial<JiraReconciliationRunnerDependencies> = {}): JiraReconciliationRunnerDependencies {
  return {
    loadContext: vi.fn().mockResolvedValue(readyContext()),
    startSyncRun: vi.fn().mockResolvedValue({ record: { id: 90, status: "running", startedAt: new Date("2026-08-29T12:00:00.000Z") }, created: true }),
    completeSyncRun: vi.fn().mockResolvedValue({}),
    upsertException: vi.fn().mockResolvedValue({ record: {}, created: true }),
    fetchIssues: vi.fn().mockResolvedValue([
      { key: "PILOT-1", fields: { summary: "Riesgo observado", issuetype: { name: "Risk" }, status: { name: "Abierto", statusCategory: { key: "new" } } } },
      { key: "PILOT-2", fields: { summary: "Épica observada", issuetype: { name: "Epic" }, status: { name: "En curso", statusCategory: { key: "indeterminate" } }, assignee: { accountId: "acc-2", displayName: "PM" } } },
      { key: "PILOT-3", fields: { summary: "Hito", issuetype: { name: "Milestone" }, status: { name: "Done", statusCategory: { key: "done" } }, duedate: "2026-08-20", resolutiondate: "2026-08-25T12:00:00.000Z" } },
    ]),
    persistSnapshot: vi.fn().mockResolvedValue(undefined),
    persistRisks: vi.fn().mockResolvedValue({ createdCount: 0, updatedCount: 1 }),
    persistWbs: vi.fn().mockResolvedValue({ createdCount: 0, updatedCount: 1 }),
    persistMilestones: vi.fn().mockResolvedValue({ observedCount: 1, changedCount: 1, unchangedCount: 0, missingIssueKeys: [] }),
    resolveExceptions: vi.fn().mockResolvedValue(undefined),
    now: () => new Date("2026-08-29T12:05:00.000Z"),
    ...overrides,
  };
}

describe("runner de conciliación Jira H7", () => {
  it("construye JQL solo con claves Jira normalizadas y rechaza entradas no válidas", () => {
    expect(buildJiraIssueKeyJql(["pilot-2", "PILOT-1", "pilot-2"]))
      .toBe('key in ("PILOT-2","PILOT-1") ORDER BY key ASC');
    expect(() => buildJiraIssueKeyJql(["project = PILOT"])).toThrow("Clave Jira inválida");
  });

  it("refresca snapshot y concilia dominios sin tocar baseline ni aceptación", async () => {
    const deps = dependencies();
    const result = await runJiraReconciliation({
      projectId: 700,
      source: "manual",
      operationId: "manual-001",
      actorId: 7,
      actorName: "PMO",
    }, deps);

    expect(result.status).toBe("applied");
    expect(result.jiraRead).toEqual({ requestedCount: 3, returnedCount: 3, missingIssueKeys: [] });
    expect(deps.persistSnapshot).toHaveBeenCalledWith(expect.objectContaining({ onboardingId: 17 }));
    expect(deps.persistRisks).toHaveBeenCalledWith(700, [expect.objectContaining({ jiraIssueKey: "PILOT-1" })]);
    expect(deps.persistWbs).toHaveBeenCalledWith(700, [expect.objectContaining({ jiraIssueKey: "PILOT-2" })]);
    expect(deps.persistMilestones).toHaveBeenCalledWith(700, [expect.objectContaining({ sourceKey: "PILOT-3", jiraClosedDate: "2026-08-25" })]);
    expect(deps.completeSyncRun).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: "applied", updatedCount: 3 }));
  });

  it("reutiliza una corrida terminal sin volver a consultar Jira", async () => {
    const deps = dependencies({
      startSyncRun: vi.fn().mockResolvedValue({
        record: { id: 90, status: "applied", details: { risks: { createdCount: 0, updatedCount: 1 } }, errorCount: 0 },
        created: false,
      }),
    });
    const result = await runJiraReconciliation({ projectId: 700, source: "scheduled", operationId: "2026-08-29" }, deps);

    expect(result.reused).toBe(true);
    expect(deps.fetchIssues).not.toHaveBeenCalled();
    expect(deps.completeSyncRun).not.toHaveBeenCalled();
  });

  it("no duplica una corrida concurrente reciente", async () => {
    const deps = dependencies({
      startSyncRun: vi.fn().mockResolvedValue({
        record: { id: 90, status: "running", startedAt: new Date("2026-08-29T12:00:00.000Z") },
        created: false,
      }),
    });
    const result = await runJiraReconciliation({ projectId: 700, source: "scheduled", operationId: "2026-08-29" }, deps);

    expect(result).toMatchObject({ reused: true, inProgress: true, status: "running" });
    expect(deps.fetchIssues).not.toHaveBeenCalled();
  });

  it("reintenta una corrida fallida con la misma operación y registra ausencias como parciales", async () => {
    const deps = dependencies({
      startSyncRun: vi.fn().mockResolvedValue({ record: { id: 90, status: "error", startedAt: new Date("2026-08-29T11:00:00.000Z") }, created: false }),
      fetchIssues: vi.fn().mockResolvedValue([]),
      persistMilestones: vi.fn().mockResolvedValue({ observedCount: 0, changedCount: 0, unchangedCount: 0, missingIssueKeys: [] }),
    });
    const result = await runJiraReconciliation({ projectId: 700, source: "retry", operationId: "retry-001", actorId: 7 }, deps);

    expect(result.status).toBe("partial");
    expect(result.jiraRead.missingIssueKeys).toEqual(["PILOT-1", "PILOT-2", "PILOT-3"]);
    expect(deps.completeSyncRun).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: "partial", errorCount: 3 }));
  });

  it("bloquea proyectos cuyo onboarding todavía no está listo", async () => {
    const deps = dependencies({
      loadContext: vi.fn().mockResolvedValue({ ...readyContext(), onboarding: { ...readyContext().onboarding, status: "reconciliation" } }),
    });
    await expect(runJiraReconciliation({ projectId: 700, source: "manual", operationId: "manual-002" }, deps))
      .rejects.toThrow("requiere onboarding ready");
    expect(deps.startSyncRun).not.toHaveBeenCalled();
  });
});
