import { describe, expect, it } from "vitest";
import {
  EMPTY_REPORT_FILTERS,
  buildReportRows,
  filterReportRows,
  sortReportRows,
  summarizeReport,
} from "./jiraReportViewModel";

function entry(overrides: Record<string, unknown> = {}) {
  return {
    spaceId: 1,
    spaceName: "Space",
    projectKey: "PRJ",
    projectName: "Proyecto Jira",
    projectUrl: "https://jira.example/PRJ",
    pmoProjectId: 100,
    pmoProjectName: "Proyecto PMO",
    clientName: "Cliente",
    dealNumber: "",
    isLinked: true,
    status: "activo",
    stageLabel: "Avance Proyecto",
    stagesClosed: 3,
    totalStages: 6,
    operationalPhase: "Construcción + QA",
    operationalProgressPct: 31,
    executiveHealth: "Rojo | Crítico",
    pmName: "Eduardo Mercado",
    jiraEvidenceAvailability: "available",
    jiraEvidenceAt: "2026-09-19T00:00:00.000Z",
    jiraSourceUpdatedAt: "2026-09-18T20:00:00.000Z",
    total: 24,
    done: 2,
    inProgress: 5,
    toDo: 17,
    percentComplete: 8,
    epicsCount: 7,
    epicsDone: 0,
    milestonesCount: 6,
    milestonesDone: 2,
    risksCount: 19,
    risksOpen: 19,
    highRisksOpen: 5,
    riskSource: "jira_snapshot",
    teamSize: 3,
    insights: {
      progress: {
        measuredBy: "milestones",
        milestonesTotal: 6,
        milestonesDone: 2,
        milestonePct: 33,
        issuesTotal: 24,
        issuesDone: 2,
        issuePct: 8,
        gapPoints: -25,
      },
      nextMilestone: { summary: "Hito 3", days: 5 },
      schedule: { pendingTotal: 22, overdue: 4, noDueDate: 6 },
      stalled: { count: 2 },
      coverage: { epicsWithoutTasks: [{ key: "PRJ-1" }], epicsTotal: 7 },
    },
    ...overrides,
  };
}

function data(projects: unknown[]) {
  return {
    totalProjects: projects.length,
    totalJiraSpaces: projects.filter((project: any) => project.projectKey).length,
    activeProjects: projects.filter((project: any) => project.status === "activo").length,
    pausedProjects: 0,
    closedProjects: projects.filter((project: any) => project.status === "completado").length,
    cancelledProjects: 0,
    totalIssues: 0,
    totalDone: 0,
    avgProgress: null,
    milestonesTotal: 0,
    milestonesDone: 0,
    withoutMilestones: 0,
    jiraLiveReports: projects.filter((project: any) => project.projectKey).length,
    projects,
    lastUpdated: "2026-09-19T00:00:00.000Z",
  } as any;
}

describe("jiraReportViewModel", () => {
  it("separa avance Jira del Portafolio, hitos y tareas live", () => {
    const [row] = buildReportRows(data([entry()]));

    expect(row.operationalProgressPct).toBe(31);
    expect(row.milestonePct).toBe(33);
    expect(row.milestonesDone).toBe(2);
    expect(row.milestonesTotal).toBe(6);
    expect(row.taskPct).toBe(8);
    expect(row.tasksDone).toBe(2);
    expect(row.tasksTotal).toBe(24);
    expect(row.risksOpen).toBe(19);
  });

  it("mantiene hitos N/D aunque exista avance Jira y tareas", () => {
    const [row] = buildReportRows(data([
      entry({
        projectKey: "SIN",
        operationalProgressPct: 5,
        milestonesCount: 0,
        milestonesDone: 0,
        insights: {
          ...entry().insights,
          progress: {
            measuredBy: "none",
            milestonesTotal: 0,
            milestonesDone: 0,
            milestonePct: null,
            issuesTotal: 10,
            issuesDone: 7,
            issuePct: 70,
            gapPoints: null,
          },
        },
      }),
    ]));

    expect(row.operationalProgressPct).toBe(5);
    expect(row.milestonePct).toBeNull();
    expect(row.measurable).toBe(false);
    expect(row.taskPct).toBe(70);
  });

  it("deja avance Jira N/D al final al ordenar en ambas direcciones", () => {
    const rows = buildReportRows(data([
      entry({ projectKey: "A", projectName: "A", operationalProgressPct: 80 }),
      entry({ projectKey: "B", projectName: "B", operationalProgressPct: null }),
      entry({ projectKey: "C", projectName: "C", operationalProgressPct: 20 }),
    ]));

    expect(sortReportRows(rows, { key: "progress", direction: "asc" }).map(row => row.projectKey)).toEqual(["A", "C", "B"]);
    expect(sortReportRows(rows, { key: "progress", direction: "desc" }).map(row => row.projectKey)).toEqual(["C", "A", "B"]);
  });

  it("resume ciclo de vida, avance Jira, hitos y tareas sin mezclar denominadores", () => {
    const rows = buildReportRows(data([
      entry({ projectKey: "A", status: "activo", operationalProgressPct: 80, milestonesCount: 10, milestonesDone: 8, total: 20, done: 10, insights: null }),
      entry({ projectKey: "B", status: "completado", operationalProgressPct: 100, milestonesCount: 0, milestonesDone: 0, total: 10, done: 10, insights: null }),
      entry({ projectKey: "C", status: "activo", operationalProgressPct: null, milestonesCount: 5, milestonesDone: 1, total: null, done: null, insights: null }),
    ]));

    expect(summarizeReport(rows, rows)).toMatchObject({
      active: 2,
      closed: 1,
      operationalProgressPct: 90,
      milestonePct: 60,
      milestonesDone: 9,
      milestonesTotal: 15,
      withoutMilestones: 1,
      progressUnavailable: 1,
      tasksDone: 20,
      tasksTotal: 30,
    });
  });

  it("combina búsqueda, cliente, ciclo de vida, avance y atención", () => {
    const rows = buildReportRows(data([
      entry({ projectKey: "A", projectName: "Tanner", clientName: "Banco Tanner", operationalProgressPct: 31, status: "activo" }),
      entry({ projectKey: "B", projectName: "Nexos", pmoProjectName: "Nexos", clientName: "Caja", operationalProgressPct: 0, status: "activo" }),
      entry({ projectKey: "C", projectName: "Ruta", clientName: "Banco Tanner", operationalProgressPct: 100, status: "completado", risksOpen: 0 }),
    ]));

    expect(filterReportRows(rows, {
      ...EMPTY_REPORT_FILTERS,
      search: "nexos",
      client: "Caja",
      lifecycle: "activo",
      progress: "behind",
      attention: "with_risks",
    }).map(row => row.projectKey)).toEqual(["B"]);

    expect(filterReportRows(rows, { ...EMPTY_REPORT_FILTERS, lifecycle: "completado" }).map(row => row.projectKey)).toEqual(["C"]);
  });

  it("conserva proyectos PMO sin Jira y navega sus dimensiones como N/D", () => {
    const rows = buildReportRows(data([
      entry(),
      entry({
        projectKey: null,
        pmoProjectId: 200,
        projectName: "Sólo PMO",
        operationalProgressPct: null,
        milestonesCount: null,
        milestonesDone: null,
        risksOpen: null,
        insights: null,
      }),
    ]));

    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ projectKey: null, operationalProgressPct: null, milestonePct: null, risksOpen: null });
  });
});
