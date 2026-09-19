import { describe, expect, it } from "vitest";
import {
  buildJiraProgressInsights,
  daysBetween,
  isOpenJiraReportProjectStatus,
  type InsightIssue,
  type JiraInsightsInput,
} from "./jiraProgressInsights";

const TODAY = "2026-09-19";

describe("estado de proyecto en el reporte operacional", () => {
  it("incluye sólo proyectos abiertos", () => {
    expect(isOpenJiraReportProjectStatus("activo")).toBe(true);
    expect(isOpenJiraReportProjectStatus("pausado")).toBe(true);
    expect(isOpenJiraReportProjectStatus("completado")).toBe(false);
    expect(isOpenJiraReportProjectStatus("cancelado")).toBe(false);
  });
});

function issue(overrides: Partial<InsightIssue> & Pick<InsightIssue, "key">): InsightIssue {
  return {
    summary: "Tarea",
    kind: "task",
    status: "To Do",
    category: "To Do",
    assignee: null,
    dueDate: null,
    updated: TODAY,
    parentKey: null,
    ...overrides,
  };
}

function input(issues: InsightIssue[], overrides: Partial<JiraInsightsInput> = {}): JiraInsightsInput {
  return { today: TODAY, issues, ...overrides };
}

/* ── El criterio de fondo ─────────────────────────────────────────────────── */

describe("progress · el avance se mide por hitos cerrados", () => {
  it("usa los hitos como criterio y expone las tareas aparte", () => {
    const { progress } = buildJiraProgressInsights(
      input([
        issue({ key: "H-1", kind: "milestone", category: "Done", dueDate: "2026-08-01" }),
        issue({ key: "H-2", kind: "milestone", dueDate: "2026-10-01" }),
        issue({ key: "T-1", category: "Done" }),
        issue({ key: "T-2", category: "Done" }),
        issue({ key: "T-3" }),
        issue({ key: "T-4" }),
      ]),
    );

    expect(progress.measuredBy).toBe("milestones");
    expect(progress.milestonePct).toBe(50);
    expect(progress.issuePct).toBe(50);
    expect(progress.milestonesDone).toBe(1);
    expect(progress.issuesTotal).toBe(4);
  });

  it("SIN hitos definidos el avance es null, NUNCA el % de tareas", () => {
    const { progress } = buildJiraProgressInsights(
      input([issue({ key: "T-1", category: "Done" }), issue({ key: "T-2" })]),
    );

    expect(progress.measuredBy).toBe("none");
    expect(progress.milestonePct).toBeNull();
    expect(progress.milestonesTotal).toBe(0);
    // El avance de tareas sigue disponible, pero como otra cosa.
    expect(progress.issuePct).toBe(50);
  });

  it("mide la brecha entre movimiento y entrega", () => {
    // El caso Nexos SFA: 48% de tareas y 0 de 5 hitos cerrados.
    const milestones = Array.from({ length: 5 }, (_, index) =>
      issue({ key: `H-${index}`, kind: "milestone", dueDate: "2026-10-01" }),
    );
    const tasks = Array.from({ length: 100 }, (_, index) =>
      issue({ key: `T-${index}`, category: index < 48 ? "Done" : "To Do" }),
    );

    const { progress } = buildJiraProgressInsights(input([...milestones, ...tasks]));
    expect(progress.milestonePct).toBe(0);
    expect(progress.issuePct).toBe(48);
    expect(progress.gapPoints).toBe(48);
  });

  it("no calcula brecha cuando falta uno de los dos", () => {
    const { progress } = buildJiraProgressInsights(input([issue({ key: "T-1" })]));
    expect(progress.gapPoints).toBeNull();
  });
});

/* ── Hitos ────────────────────────────────────────────────────────────────── */

describe("milestones", () => {
  const rows = [
    issue({ key: "H-1", kind: "milestone", summary: "Hito 1", dueDate: "2026-08-01" }),
    issue({ key: "H-2", kind: "milestone", summary: "Hito 2", dueDate: "2026-09-22" }),
    issue({ key: "H-3", kind: "milestone", summary: "Hito 3", dueDate: "2026-12-01" }),
    issue({ key: "H-4", kind: "milestone", summary: "Hito 4", category: "Done", dueDate: "2026-07-01" }),
    issue({ key: "H-5", kind: "milestone", summary: "Hito 5" }),
  ];

  it("clasifica cada hito por su fecha contra el corte", () => {
    const { milestones } = buildJiraProgressInsights(input(rows));
    const byKey = Object.fromEntries(milestones.map(row => [row.key, row]));
    expect(byKey["H-1"].state).toBe("overdue");
    expect(byKey["H-1"].days).toBe(49);
    expect(byKey["H-2"].state).toBe("due_soon");
    expect(byKey["H-3"].state).toBe("scheduled");
    expect(byKey["H-4"].state).toBe("done");
    expect(byKey["H-5"].state).toBe("no_date");
  });

  it("ordena lo vencido primero y lo cerrado al final", () => {
    const { milestones } = buildJiraProgressInsights(input(rows));
    expect(milestones.map(row => row.state)).toEqual([
      "overdue",
      "due_soon",
      "scheduled",
      "no_date",
      "done",
    ]);
  });

  it("el próximo hito es el vencido cuando lo hay", () => {
    const { nextMilestone } = buildJiraProgressInsights(input(rows));
    expect(nextMilestone?.key).toBe("H-1");
  });

  it("sin vencidos, el próximo hito es el más cercano", () => {
    const { nextMilestone } = buildJiraProgressInsights(input(rows.slice(1)));
    expect(nextMilestone?.key).toBe("H-2");
  });

  it("cuenta las tareas que cuelgan de cada hito", () => {
    const { milestones } = buildJiraProgressInsights(
      input([
        issue({ key: "H-1", kind: "milestone", dueDate: "2026-12-01" }),
        issue({ key: "T-1", parentKey: "H-1", category: "Done" }),
        issue({ key: "T-2", parentKey: "H-1" }),
      ]),
    );
    expect(milestones[0]).toMatchObject({ tasksTotal: 2, tasksDone: 1, taskPct: 50 });
  });

  it("un hito sin tareas tiene taskPct null, no 0%", () => {
    const { milestones } = buildJiraProgressInsights(
      input([issue({ key: "H-1", kind: "milestone", dueDate: "2026-12-01" })]),
    );
    expect(milestones[0].taskPct).toBeNull();
  });
});

/* ── Agenda ───────────────────────────────────────────────────────────────── */

describe("schedule · tareas programadas por ejecutar", () => {
  it("reparte las pendientes en ventanas de vencimiento", () => {
    const { schedule } = buildJiraProgressInsights(
      input([
        issue({ key: "T-1", dueDate: "2026-09-01" }),
        issue({ key: "T-2", dueDate: "2026-09-22" }),
        issue({ key: "T-3", dueDate: "2026-09-30" }),
        issue({ key: "T-4", dueDate: "2026-10-15" }),
        issue({ key: "T-5", dueDate: "2026-12-30" }),
        issue({ key: "T-6" }),
        issue({ key: "T-7", category: "Done", dueDate: "2026-09-01" }),
      ]),
    );

    expect(schedule.pendingTotal).toBe(6);
    expect(schedule.overdue).toBe(1);
    expect(schedule.next7).toBe(1);
    expect(schedule.next14).toBe(1);
    expect(schedule.next30).toBe(1);
    expect(schedule.later).toBe(1);
    expect(schedule.noDueDate).toBe(1);
  });

  it("una tarea cerrada no aparece como vencida", () => {
    const { schedule } = buildJiraProgressInsights(
      input([issue({ key: "T-1", category: "Done", dueDate: "2020-01-01" })]),
    );
    expect(schedule.overdue).toBe(0);
    expect(schedule.pendingTotal).toBe(0);
  });
});

/* ── Cobertura de objetivos ───────────────────────────────────────────────── */

describe("coverage · ¿lo programado cubre los objetivos?", () => {
  it("detecta objetivos declarados sin ninguna tarea planificada", () => {
    const { coverage } = buildJiraProgressInsights(
      input([
        issue({ key: "E-1", kind: "epic", summary: "Integración core" }),
        issue({ key: "E-2", kind: "epic", summary: "Migración de datos" }),
        issue({ key: "T-1", parentKey: "E-1" }),
      ]),
    );

    expect(coverage.epicsTotal).toBe(2);
    expect(coverage.epicsWithoutTasks).toEqual([{ key: "E-2", summary: "Migración de datos" }]);
    expect(coverage.epicCoveragePct).toBe(50);
  });

  it("cuenta el trabajo que no responde a ningún objetivo declarado", () => {
    const { coverage } = buildJiraProgressInsights(
      input([
        issue({ key: "E-1", kind: "epic" }),
        issue({ key: "T-1", parentKey: "E-1" }),
        issue({ key: "T-2" }),
        issue({ key: "T-3", parentKey: "NO-EXISTE" }),
      ]),
    );
    expect(coverage.tasksWithoutParent).toBe(2);
  });

  it("marca los hitos abiertos sin tareas y sin fecha", () => {
    const { coverage } = buildJiraProgressInsights(
      input([
        issue({ key: "H-1", kind: "milestone", summary: "Hito vacío", dueDate: "2026-12-01" }),
        issue({ key: "H-2", kind: "milestone", summary: "Hito sin fecha" }),
        issue({ key: "H-3", kind: "milestone", category: "Done" }),
      ]),
    );
    expect(coverage.milestonesWithoutTasks.map(row => row.key)).toEqual(["H-1", "H-2"]);
    expect(coverage.milestonesWithoutDueDate).toBe(2);
  });

  it("sin épicas, la cobertura es null y no 0%", () => {
    const { coverage } = buildJiraProgressInsights(input([issue({ key: "T-1" })]));
    expect(coverage.epicCoveragePct).toBeNull();
    expect(coverage.epicsTotal).toBe(0);
  });
});

/* ── Épicas ───────────────────────────────────────────────────────────────── */

describe("epics", () => {
  it("calcula el avance de cada épica y pone las peores primero", () => {
    const { epics } = buildJiraProgressInsights(
      input([
        issue({ key: "E-1", kind: "epic" }),
        issue({ key: "E-2", kind: "epic" }),
        issue({ key: "T-1", parentKey: "E-1", category: "Done" }),
        issue({ key: "T-2", parentKey: "E-1", category: "Done" }),
        issue({ key: "T-3", parentKey: "E-2" }),
        issue({ key: "T-4", parentKey: "E-2", category: "Done" }),
      ]),
    );
    expect(epics.map(epic => epic.key)).toEqual(["E-2", "E-1"]);
    expect(epics.find(epic => epic.key === "E-1")?.taskPct).toBe(100);
    expect(epics.find(epic => epic.key === "E-2")?.taskPct).toBe(50);
  });

  it("una épica sin tareas tiene taskPct null, no 0%", () => {
    const { epics } = buildJiraProgressInsights(input([issue({ key: "E-1", kind: "epic" })]));
    expect(epics[0].taskPct).toBeNull();
    expect(epics[0].tasksTotal).toBe(0);
  });
});

/* ── Flujo y estancadas ───────────────────────────────────────────────────── */

describe("flow y stalled", () => {
  it("agrupa por estado y cuenta lo que se movió", () => {
    const { flow } = buildJiraProgressInsights(
      input([
        issue({ key: "T-1", status: "Backlog", updated: "2026-09-18" }),
        issue({ key: "T-2", status: "Backlog", updated: "2026-08-01" }),
        issue({ key: "T-3", status: "En progreso", category: "In Progress", updated: "2026-09-15" }),
      ]),
    );
    expect(flow.byStatus[0]).toMatchObject({ status: "Backlog", count: 2, pct: 67 });
    expect(flow.movedLast7).toBe(2);
    // T-2 se tocó hace 49 días: fuera de la ventana de 30.
    expect(flow.movedLast30).toBe(2);
  });

  it("marca estancada una tarea en curso sin movimiento", () => {
    const { stalled } = buildJiraProgressInsights(
      input([
        issue({ key: "T-1", category: "In Progress", updated: "2026-08-01", assignee: "Ana" }),
        issue({ key: "T-2", category: "In Progress", updated: "2026-09-18" }),
        // Una tarea sin empezar no está estancada, está pendiente.
        issue({ key: "T-3", updated: "2026-01-01" }),
      ]),
    );
    expect(stalled.count).toBe(1);
    expect(stalled.items[0]).toMatchObject({ key: "T-1", assignee: "Ana", daysIdle: 49 });
  });

  it("respeta el umbral configurado", () => {
    const issues = [issue({ key: "T-1", category: "In Progress", updated: "2026-09-10" })];
    expect(buildJiraProgressInsights(input(issues)).stalled.count).toBe(0);
    expect(buildJiraProgressInsights(input(issues, { stalledAfterDays: 5 })).stalled.count).toBe(1);
  });
});

/* ── Carga por persona ────────────────────────────────────────────────────── */

describe("workload · asignación por participante", () => {
  it("reparte las tareas por responsable y ordena por carga en curso", () => {
    const { workload } = buildJiraProgressInsights(
      input([
        issue({ key: "T-1", assignee: "Ana", category: "In Progress" }),
        issue({ key: "T-2", assignee: "Ana", category: "In Progress" }),
        issue({ key: "T-3", assignee: "Ana", category: "Done" }),
        issue({ key: "T-4", assignee: "Beto", category: "In Progress" }),
        issue({ key: "T-5", assignee: "Beto" }),
      ]),
    );
    expect(workload.map(row => row.assignee)).toEqual(["Ana", "Beto"]);
    expect(workload[0]).toMatchObject({ total: 3, done: 1, inProgress: 2, toDo: 0 });
    expect(workload[1]).toMatchObject({ total: 2, inProgress: 1, toDo: 1 });
  });

  it("agrupa lo no asignado bajo «Sin asignar» en vez de esconderlo", () => {
    const { workload } = buildJiraProgressInsights(
      input([issue({ key: "T-1" }), issue({ key: "T-2", assignee: "Ana" })]),
    );
    expect(workload.map(row => row.assignee).sort()).toEqual(["Ana", "Sin asignar"]);
  });

  it("cuenta vencidas y estancadas por persona", () => {
    const { workload } = buildJiraProgressInsights(
      input([
        issue({ key: "T-1", assignee: "Ana", dueDate: "2026-09-01" }),
        issue({ key: "T-2", assignee: "Ana", category: "In Progress", updated: "2026-07-01" }),
      ]),
    );
    expect(workload[0]).toMatchObject({ overdue: 1, stalled: 1 });
  });
});

describe("daysBetween", () => {
  it("es positivo cuando la fecha ya pasó", () => {
    expect(daysBetween("2026-09-01", TODAY)).toBe(18);
  });

  it("es negativo cuando todavía no llega", () => {
    expect(daysBetween("2026-09-30", TODAY)).toBe(-11);
  });
});
