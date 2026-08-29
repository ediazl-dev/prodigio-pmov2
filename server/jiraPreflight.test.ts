import { describe, expect, it } from "vitest";
import { SANITIZED_JIRA_ONBOARDING_FIXTURE } from "./fixtures/jiraOnboarding.fixture";
import { analyzeJiraPreflight, type JiraPreflightInput } from "./jiraPreflight";

const JIRA_ONBOARDING_FIXTURE = SANITIZED_JIRA_ONBOARDING_FIXTURE;

function buildInput(overrides: Partial<JiraPreflightInput> = {}): JiraPreflightInput {
  const milestones = JIRA_ONBOARDING_FIXTURE.issues
    .filter(issue => issue.issueType === "Hito PMO")
    .map(issue => ({
      key: issue.key,
      summary: issue.summary,
      status: issue.statusName,
      statusCategory: issue.statusCategory,
      duedate: issue.dueDate,
      resolutiondate: null,
    }));
  return {
    project: {
      ...JIRA_ONBOARDING_FIXTURE.project,
      avatarUrls: {},
      issueTypes: JIRA_ONBOARDING_FIXTURE.project.issueTypes.map((name, index) => ({ id: String(index + 1), name })),
    },
    boards: [...JIRA_ONBOARDING_FIXTURE.boards],
    statuses: [{ name: "Hito PMO", statuses: [{ name: "In Progress", id: "1", statusCategory: { name: "In Progress" } }] }],
    report: {
      projectKey: "PILOT",
      projectName: "Proyecto piloto sanitizado",
      reportDate: "2026-08-29T12:00:00.000Z",
      totalIssues: 3,
      doneCount: 1,
      inProgressCount: 1,
      toDoCount: 1,
      percentComplete: 33,
      byStatus: [],
      byType: [
        { type: "Hito PMO", count: 1 },
        { type: "Riesgos PMO", count: 1 },
        { type: "Epic", count: 1 },
      ],
      epics: [{ key: "PILOT-3", summary: "Épica", status: "Done", statusCategory: "Done", doneSubtasks: 0, totalSubtasks: 0 }],
      milestones,
      risks: [{ key: "PILOT-2", summary: "Riesgo", status: "Open", statusCategory: "To Do", priority: "Medium" }],
      scopeChanges: [],
      team: [],
      milestonesCumplidos: 0,
      milestonesPendientes: 1,
      milestoneCompletionPct: 0,
      primaryProgressPct: 0,
      primaryProgressSource: "MILESTONES",
      totalTimeSpentSeconds: 0,
      totalOriginalEstimateSeconds: 0,
      totalTimeSpentHours: 0,
      totalOriginalEstimateHours: 0,
      lastUpdated: "2026-08-29T12:00:00.000Z",
    },
    managedProjectKeys: [],
    asOf: "2026-08-29",
    ...overrides,
  } as JiraPreflightInput;
}

describe("preflight Jira de solo lectura", () => {
  it("acepta Jira no corporativo con advertencias, sin intentar reconfigurarlo", () => {
    const result = analyzeJiraPreflight(buildInput());
    expect(result.readyForMapping).toBe(true);
    expect(result.verdict).toBe("ready_with_warnings");
    expect(result.corporateAlignment.classification).toBe("non_corporate");
    expect(result.corporateAlignment.foundBoards).toBe(3);
    expect(result.blockers).toEqual([]);
  });

  it("bloquea una clave Jira ya gestionada", () => {
    const result = analyzeJiraPreflight(buildInput({ managedProjectKeys: ["pilot"] }));
    expect(result.readyForMapping).toBe(false);
    expect(result.verdict).toBe("blocked");
    expect(result.project.isAlreadyManaged).toBe(true);
  });

  it("separa fechas planificadas faltantes de fechas reales de resolución faltantes", () => {
    const input = buildInput();
    input.report.milestones = [
      { key: "PILOT-1", summary: "Pendiente", status: "Open", statusCategory: "To Do", duedate: null, resolutiondate: null },
      { key: "PILOT-4", summary: "Cerrado", status: "Done", statusCategory: "Done", duedate: "2026-08-20", resolutiondate: null },
    ];
    const result = analyzeJiraPreflight(input);
    expect(result.dateQuality.milestoneDueDateMissing).toBe(1);
    expect(result.dateQuality.doneMilestoneResolutionMissing).toBe(1);
    expect(result.dateQuality.dueDateCompletenessPct).toBe(50);
  });

  it("bloquea proyectos vacíos y mantiene el baseline como brecha visible", () => {
    const input = buildInput();
    input.report.totalIssues = 0;
    input.report.milestones = [];
    const result = analyzeJiraPreflight(input);
    expect(result.readyForMapping).toBe(false);
    expect(result.blockers).toContain("El proyecto Jira no contiene issues para conciliar.");
    expect(result.warnings).toContain("No se detectaron hitos; el baseline deberá cargarse o mapearse manualmente.");
  });
});
