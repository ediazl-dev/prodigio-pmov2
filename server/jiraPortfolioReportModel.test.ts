import { describe, expect, it } from "vitest";
import type { PortfolioRow } from "./executivePortfolio";
import type { JiraAdvanceReport } from "./jiraClient";
import {
  buildJiraPortfolioReportEntry,
  indexJiraReportsByKey,
  indexJiraSpacesByProjectId,
} from "./jiraPortfolioReportModel";

function portfolio(overrides: Partial<PortfolioRow> = {}): PortfolioRow {
  return {
    projectId: 180002,
    projectName: "[PMO Banco Tanner] - Implementacion SFA - Deal 1934",
    clientName: "Banco Tanner",
    dealId: "1934",
    projectType: "integracion",
    origin: "linked",
    jiraProjectKey: "PBTISD1",
    status: "activo",
    stageId: "design",
    stageLabel: "Avance Proyecto",
    stageIndex: 4,
    totalStages: 6,
    stagesClosed: 0,
    closedStageIds: [],
    daysUsed: null,
    daysAllowed: null,
    overDays: null,
    deadlineState: "no_deadline",
    pmId: null,
    pmKey: "eduardo mercado",
    pmName: "Eduardo Mercado",
    pmSource: "jira_snapshot",
    amount: 8200,
    currency: "UF",
    amountMissing: false,
    amountSource: "financial_data",
    highRisksOpen: 12,
    openRisks: 23,
    riskSource: "jira_snapshot",
    operationalPhase: "Construcción + QA",
    operationalPhaseSource: "jira_snapshot",
    operationalProgressPct: 31,
    executiveHealth: "🔴Rojo | Crítico",
    jiraEvidenceStatus: "success",
    jiraEvidenceAvailability: "available",
    jiraEvidenceAt: "2026-09-19T00:00:00.000Z",
    jiraSourceUpdatedAt: "2026-09-18T20:00:00.000Z",
    jiraEvidenceStale: false,
    milestonesTotal: 10,
    milestonesFulfilled: 8,
    milestoneSource: "jira_snapshot",
    deadlineReason: "missing_stage_opening",
    startDate: null,
    endDate: null,
    ...overrides,
  };
}

function report(overrides: Partial<JiraAdvanceReport> = {}): JiraAdvanceReport {
  return {
    projectKey: "PBTISD1",
    projectName: "Tanner Jira",
    reportDate: "2026-09-19T00:00:00.000Z",
    totalIssues: 168,
    doneCount: 124,
    inProgressCount: 13,
    toDoCount: 31,
    percentComplete: 74,
    byStatus: [],
    byType: [],
    epics: [],
    milestones: [],
    risks: [],
    scopeChanges: [],
    team: [],
    milestonesCumplidos: 8,
    milestonesPendientes: 2,
    milestoneCompletionPct: 80,
    primaryProgressPct: 80,
    primaryProgressSource: "MILESTONES",
    insights: {
      version: "1.0",
      progress: {
        measuredBy: "milestones",
        milestonesTotal: 10,
        milestonesDone: 8,
        milestonePct: 80,
        issuesTotal: 133,
        issuesDone: 115,
        issuePct: 86,
        gapPoints: 6,
      },
      nextMilestone: null,
      schedule: { pendingTotal: 18, overdue: 12, next7: 4, next14: 1, next30: 1, later: 0, noDueDate: 0 },
      coverage: { epicsTotal: 0, epicsWithTasks: 0, epicsWithoutTasks: [], milestonesTotal: 10, milestonesWithoutTasks: [], orphanTasks: [] },
      workload: [
        { assignee: "A", total: 20, done: 12, inProgress: 5, toDo: 3, overdue: 2, stalled: 1 },
        { assignee: "B", total: 10, done: 4, inProgress: 2, toDo: 4, overdue: 1, stalled: 0 },
      ],
      stalled: { thresholdDays: 14, count: 1, issues: [] },
      epicProgress: [],
      milestones: [],
    },
    operationalPhase: "Construcción + QA",
    executiveStatus: "Rojo",
    financialStatus: null,
    advanceReportedPct: 31,
    projectManagerName: "Eduardo Mercado",
    projectManagerAccountId: "eduardo",
    operationalUpdatedAt: "2026-09-18T20:00:00.000Z",
    totalTimeSpentSeconds: 0,
    totalOriginalEstimateSeconds: 0,
    totalTimeSpentHours: 0,
    totalOriginalEstimateHours: 0,
    lastUpdated: "2026-09-19T00:00:00.000Z",
    ...overrides,
  };
}

describe("jiraPortfolioReportModel", () => {
  it("usa Portafolio para ciclo de vida, fase, avance, salud, PM, hitos y riesgos", () => {
    const entry = buildJiraPortfolioReportEntry(portfolio(), report(), null);

    expect(entry).toMatchObject({
      status: "activo",
      operationalPhase: "Construcción + QA",
      operationalProgressPct: 31,
      executiveHealth: "🔴Rojo | Crítico",
      pmName: "Eduardo Mercado",
      milestonesDone: 8,
      milestonesCount: 10,
      risksOpen: 23,
      highRisksOpen: 12,
    });
    expect(entry).toMatchObject({ done: 115, total: 133, percentComplete: 86, teamSize: 2 });
  });

  it("conserva un proyecto completado en vez de excluirlo del reporte", () => {
    const entry = buildJiraPortfolioReportEntry(
      portfolio({ projectId: 300001, status: "completado", operationalProgressPct: 75, milestonesFulfilled: 4, milestonesTotal: 4 }),
      report(),
      null,
    );

    expect(entry.status).toBe("completado");
    expect(entry.operationalProgressPct).toBe(75);
    expect(entry.milestonesDone).toBe(4);
  });

  it("no sustituye la evidencia parcial del Portafolio con el porcentaje live", () => {
    const entry = buildJiraPortfolioReportEntry(
      portfolio({
        projectId: 390001,
        jiraProjectKey: "PAI",
        operationalProgressPct: null,
        operationalPhase: null,
        executiveHealth: null,
        jiraEvidenceStatus: "partial",
        jiraEvidenceAvailability: "partial",
        milestonesFulfilled: 0,
        milestonesTotal: 0,
      }),
      report({ projectKey: "PAI", percentComplete: 79, advanceReportedPct: null }),
      null,
    );

    expect(entry.operationalProgressPct).toBeNull();
    expect(entry.operationalPhase).toBeNull();
    expect(entry.executiveHealth).toBeNull();
    expect(entry.jiraEvidenceAvailability).toBe("partial");
  });

  it("mantiene proyectos PMO sin clave Jira con dimensiones externas en N/D", () => {
    const entry = buildJiraPortfolioReportEntry(
      portfolio({ jiraProjectKey: null, origin: "platform", milestonesFulfilled: null, milestonesTotal: null }),
      null,
      null,
    );

    expect(entry.projectKey).toBeNull();
    expect(entry.isLinked).toBe(false);
    expect(entry.total).toBeNull();
    expect(entry.milestonesCount).toBeNull();
  });

  it("indexa claves y spaces con normalización estable", () => {
    expect(indexJiraReportsByKey([report({ projectKey: " pbtisd1 " })]).has("PBTISD1")).toBe(true);
    expect(indexJiraSpacesByProjectId([{ id: 1, projectId: 180002, projectKey: "PBTISD1", projectName: null, projectUrl: null, spaceName: "Tanner" }]).get(180002)?.spaceName).toBe("Tanner");
  });
});
