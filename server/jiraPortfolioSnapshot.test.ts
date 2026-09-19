import { describe, expect, it } from "vitest";
import type { JiraAdvanceReport } from "./jiraClient";
import { buildJiraPortfolioSnapshot, classifyJiraPortfolioSnapshotError, runJiraPortfolioSnapshotBatch } from "./jiraPortfolioSnapshot";

function report(overrides: Partial<JiraAdvanceReport> = {}): JiraAdvanceReport {
  return {
    projectKey: "PMOTANNER",
    projectName: "Banco Tanner",
    reportDate: "2026-09-18T20:00:00.000Z",
    totalIssues: 20,
    doneCount: 8,
    inProgressCount: 7,
    toDoCount: 5,
    percentComplete: 40,
    byStatus: [],
    byType: [],
    epics: [],
    milestones: [
      { key: "PMOTANNER-1", summary: "M1", status: "Cerrado", statusCategory: "Done" },
      { key: "PMOTANNER-2", summary: "M2", status: "En curso", statusCategory: "In Progress" },
    ],
    risks: [
      { key: "PMOTANNER-3", summary: "R1", status: "Abierto", statusCategory: "To Do", priority: "High" },
      { key: "PMOTANNER-4", summary: "R2", status: "Cerrado", statusCategory: "Done", priority: "Highest" },
    ],
    scopeChanges: [],
    team: [],
    milestonesCumplidos: 1,
    milestonesPendientes: 1,
    milestoneCompletionPct: 50,
    primaryProgressPct: 50,
    primaryProgressSource: "MILESTONES",
    operationalPhase: "Construcción",
    executiveStatus: "Verde",
    financialStatus: "Saludable",
    advanceReportedPct: 60,
    projectManagerName: "Eduardo Mercado",
    projectManagerAccountId: "jira-eduardo",
    operationalUpdatedAt: "2026-09-18T18:00:00.000Z",
    totalTimeSpentSeconds: 0,
    totalOriginalEstimateSeconds: 0,
    totalTimeSpentHours: 0,
    totalOriginalEstimateHours: 0,
    lastUpdated: "2026-09-18T20:00:00.000Z",
    ...overrides,
  };
}

describe("jiraPortfolioSnapshot", () => {
  it("preserva fase, PM y conteos reales de hitos y riesgos", () => {
    const capturedAt = new Date("2026-09-18T21:00:00.000Z");
    const snapshot = buildJiraPortfolioSnapshot(
      { projectId: 180002, jiraProjectKey: "PMOTANNER" },
      report(),
      capturedAt,
    );

    expect(snapshot.status).toBe("success");
    expect(snapshot.operationalPhase).toBe("Construcción");
    expect(snapshot.projectManagerName).toBe("Eduardo Mercado");
    expect(snapshot.milestonesTotal).toBe(2);
    expect(snapshot.milestonesFulfilled).toBe(1);
    expect(snapshot.risksTotal).toBe(2);
    expect(snapshot.risksOpen).toBe(1);
    expect(snapshot.risksHighPriorityOpen).toBe(1);
    expect(snapshot.lastSuccessAt).toEqual(capturedAt);
  });

  it("clasifica como parcial cuando no existe el issue corporativo de avance", () => {
    const snapshot = buildJiraPortfolioSnapshot(
      { projectId: 99, jiraProjectKey: "LEGACY" },
      report({
        operationalPhase: null,
        executiveStatus: null,
        financialStatus: null,
        advanceReportedPct: null,
        projectManagerName: null,
        projectManagerAccountId: null,
        operationalUpdatedAt: null,
      }),
    );

    expect(snapshot.status).toBe("partial");
    expect(snapshot.errorCode).toBe("JIRA_PROGRESS_ISSUE_MISSING");
    expect(snapshot.milestonesFulfilled).toBe(1);
    expect(snapshot.risksOpen).toBe(1);
  });

  it("produce fingerprints estables para el mismo contenido semántico", () => {
    const first = buildJiraPortfolioSnapshot(
      { projectId: 180002, jiraProjectKey: "PMOTANNER" },
      report(),
      new Date("2026-09-18T21:00:00.000Z"),
    );
    const second = buildJiraPortfolioSnapshot(
      { projectId: 180002, jiraProjectKey: "PMOTANNER" },
      report(),
      new Date("2026-09-19T21:00:00.000Z"),
    );
    expect(first.dataFingerprint).toBe(second.dataFingerprint);
  });

  it("normaliza errores de autorización, permisos y timeout", () => {
    expect(classifyJiraPortfolioSnapshotError(new Error("Jira 401"))).toMatchObject({ code: "JIRA_AUTHENTICATION_ERROR" });
    expect(classifyJiraPortfolioSnapshotError(new Error("Jira 403"))).toMatchObject({ code: "JIRA_PERMISSION_ERROR" });
    expect(classifyJiraPortfolioSnapshotError(new Error("request timeout"))).toMatchObject({ code: "JIRA_TIMEOUT" });
  });

  it("procesa un lote acotado y aísla resultados parciales o con error", async () => {
    const candidates = [
      { projectId: 1, jiraProjectKey: "ONE" },
      { projectId: 2, jiraProjectKey: "TWO" },
      { projectId: 3, jiraProjectKey: "THREE" },
    ];
    const result = await runJiraPortfolioSnapshotBatch(2, 2, {
      listCandidates: async () => candidates,
      refresh: async candidate => ({
        ...candidate,
        status: candidate.projectId === 2 ? "partial" as const : "success" as const,
        errorCode: candidate.projectId === 2 ? "JIRA_PROGRESS_ISSUE_MISSING" : null,
      }),
    });

    expect(result).toMatchObject({
      status: "partial",
      candidateCount: 3,
      processedCount: 2,
      successCount: 1,
      partialCount: 1,
      deferredCount: 1,
    });
    expect(result.results.map(item => item.projectId)).toEqual([1, 2]);
  });
});
