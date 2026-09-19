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
    total: 57,
    done: 2,
    inProgress: 5,
    toDo: 50,
    percentComplete: 4,
    epicsCount: 7,
    epicsDone: 0,
    milestonesCount: 6,
    milestonesDone: 2,
    risksCount: 19,
    risksOpen: 19,
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
    totalJiraSpaces: projects.length,
    totalIssues: 0,
    totalDone: 0,
    avgProgress: null,
    milestonesTotal: 0,
    milestonesDone: 0,
    withoutMilestones: 0,
    projects,
    lastUpdated: "2026-09-19T00:00:00.000Z",
  } as any;
}

describe("jiraReportViewModel", () => {
  it("mide el proyecto por hitos y las tareas sólo con issues operacionales", () => {
    const [row] = buildReportRows(data([entry()]));

    expect(row.milestonePct).toBe(33);
    expect(row.milestonesDone).toBe(2);
    expect(row.milestonesTotal).toBe(6);
    expect(row.taskPct).toBe(8);
    expect(row.tasksDone).toBe(2);
    expect(row.tasksTotal).toBe(24);
    expect(row.risksOpen).toBe(19);
  });

  it("mantiene N/D cuando no hay hitos aunque existan tareas cerradas", () => {
    const [row] = buildReportRows(data([
      entry({
        projectKey: "SIN",
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

    expect(row.milestonePct).toBeNull();
    expect(row.measurable).toBe(false);
    expect(row.taskPct).toBe(70);
  });

  it("deja N/D al final al ordenar avance en ambas direcciones", () => {
    const rows = buildReportRows(data([
      entry({ projectKey: "A", projectName: "A", milestonesCount: 10, milestonesDone: 8 }),
      entry({ projectKey: "B", projectName: "B", milestonesCount: 0, milestonesDone: 0 }),
      entry({ projectKey: "C", projectName: "C", milestonesCount: 10, milestonesDone: 2 }),
    ]));

    expect(sortReportRows(rows, { key: "progress", direction: "asc" }).map(row => row.projectKey)).toEqual(["A", "C", "B"]);
    expect(sortReportRows(rows, { key: "progress", direction: "desc" }).map(row => row.projectKey)).toEqual(["C", "A", "B"]);
  });

  it("calcula el promedio sólo sobre hitos de proyectos medibles", () => {
    const rows = buildReportRows(data([
      entry({ projectKey: "A", milestonesCount: 10, milestonesDone: 8 }),
      entry({ projectKey: "B", milestonesCount: 0, milestonesDone: 0 }),
      entry({ projectKey: "C", milestonesCount: 5, milestonesDone: 1 }),
    ]));

    expect(summarizeReport(rows, rows)).toMatchObject({
      milestonePct: 60,
      milestonesDone: 9,
      milestonesTotal: 15,
      unmeasured: 1,
    });
  });

  it("combina búsqueda, cliente, avance y señales de atención", () => {
    const rows = buildReportRows(data([
      entry({ projectKey: "A", projectName: "Tanner", clientName: "Banco Tanner", milestonesCount: 10, milestonesDone: 8 }),
      entry({ projectKey: "B", projectName: "Nexos", pmoProjectName: "Nexos", clientName: "Caja", milestonesCount: 5, milestonesDone: 0 }),
      entry({ projectKey: "C", projectName: "Producto", clientName: "Banco Tanner", milestonesCount: 0, milestonesDone: 0 }),
    ]));

    expect(filterReportRows(rows, {
      ...EMPTY_REPORT_FILTERS,
      search: "nexos",
      client: "Caja",
      progress: "behind",
      attention: "with_risks",
    }).map(row => row.projectKey)).toEqual(["B"]);

    expect(filterReportRows(rows, { ...EMPTY_REPORT_FILTERS, progress: "unmeasured" }).map(row => row.projectKey)).toEqual(["C"]);
  });

  it("excluye entradas PMO sin Jira de la tabla operacional", () => {
    const rows = buildReportRows(data([
      entry(),
      entry({ projectKey: null, pmoProjectId: 200, projectName: "Sólo PMO", insights: null }),
    ]));

    expect(rows).toHaveLength(1);
    expect(rows[0].projectKey).toBe("PRJ");
  });
});
