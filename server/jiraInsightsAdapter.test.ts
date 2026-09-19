import { describe, expect, it } from "vitest";
import { buildJiraProgressInsights } from "./jiraProgressInsights";
import { classifyCategory, classifyKind, toInsightIssues, type RawJiraIssue } from "./jiraInsightsAdapter";

function raw(overrides: Partial<RawJiraIssue["fields"]> & { key?: string } = {}): RawJiraIssue {
  const { key, ...fields } = overrides;
  return {
    key: key ?? "X-1",
    fields: { summary: "Issue", status: { name: "To Do", statusCategory: { name: "To Do" } }, issuetype: { name: "Story" }, ...fields },
  };
}

describe("classifyKind", () => {
  it("separa épicas, hitos, riesgos y cambios de alcance de las tareas", () => {
    expect(classifyKind("Epic")).toBe("epic");
    expect(classifyKind("Épica")).toBe("epic");
    expect(classifyKind("Hito PMO")).toBe("milestone");
    expect(classifyKind("Milestone")).toBe("milestone");
    expect(classifyKind("Riesgos PMO")).toBe("risk");
    expect(classifyKind("Cambio de Alcance")).toBe("scope_change");
    expect(classifyKind("Proyecto PMO - Avance")).toBe("progress_marker");
    expect(classifyKind("Story")).toBe("task");
    expect(classifyKind("Tarea")).toBe("task");
    expect(classifyKind(undefined)).toBe("task");
  });
});

describe("classifyCategory", () => {
  it("respeta la statusCategory de Jira cuando está bien puesta", () => {
    expect(classifyCategory("Done", "Finalizada")).toBe("Done");
    expect(classifyCategory("In Progress", "En curso")).toBe("In Progress");
    expect(classifyCategory("To Do", "Backlog")).toBe("To Do");
  });

  it("corrige la categoría por el nombre del estado cuando está mal configurada", () => {
    // Caso real: statusCategory dice "To Do" pero el estado se llama "Cumplido".
    expect(classifyCategory("To Do", "Cumplido (Entregable)")).toBe("Done");
    expect(classifyCategory("To Do", "Identificado")).toBe("In Progress");
  });
});

describe("toInsightIssues", () => {
  it("mapea los campos que el motor necesita", () => {
    const [issue] = toInsightIssues([
      raw({
        key: "CCL-1",
        summary: "Definir contrato de API",
        issuetype: { name: "Story" },
        status: { name: "En progreso", statusCategory: { name: "In Progress" } },
        assignee: { displayName: "Ana Pérez" },
        duedate: "2026-10-01",
        updated: "2026-09-10",
        parent: { key: "CCL-100" },
      }),
    ]);

    expect(issue).toEqual({
      key: "CCL-1",
      summary: "Definir contrato de API",
      kind: "task",
      status: "En progreso",
      category: "In Progress",
      assignee: "Ana Pérez",
      dueDate: "2026-10-01",
      updated: "2026-09-10",
      parentKey: "CCL-100",
    });
  });

  it("sin asignado deja null, no «Sin asignar»: eso lo decide la vista", () => {
    const [issue] = toInsightIssues([raw({ assignee: null })]);
    expect(issue.assignee).toBeNull();
  });
});

describe("el caso CCLA: riesgos y épicas dejan de contar como tareas", () => {
  /**
   * El proyecto real trae 57 issues: 24 Story, 19 Riesgos PMO, 7 Epic,
   * 6 Hito PMO y 1 marcador de avance. El reporte actual divide 2/57 = 4%.
   */
  const issues: RawJiraIssue[] = [
    ...Array.from({ length: 24 }, (_, index) =>
      raw({
        key: `S-${index}`,
        issuetype: { name: "Story" },
        status:
          index < 2
            ? { name: "Cumplido (Entregable)", statusCategory: { name: "To Do" } }
            : { name: "Backlog", statusCategory: { name: "To Do" } },
      }),
    ),
    ...Array.from({ length: 19 }, (_, index) => raw({ key: `R-${index}`, issuetype: { name: "Riesgos PMO" } })),
    ...Array.from({ length: 7 }, (_, index) => raw({ key: `E-${index}`, issuetype: { name: "Epic" } })),
    ...Array.from({ length: 6 }, (_, index) =>
      raw({
        key: `H-${index}`,
        issuetype: { name: "Hito PMO" },
        duedate: "2026-12-01",
        status:
          index < 2
            ? { name: "Cumplido", statusCategory: { name: "To Do" } }
            : { name: "Pendiente", statusCategory: { name: "To Do" } },
      }),
    ),
    raw({ key: "A-1", issuetype: { name: "Proyecto PMO - Avance" } }),
  ];

  it("cuenta 24 tareas y excluye también el marcador de avance", () => {
    const { progress } = buildJiraProgressInsights({ today: "2026-09-19", issues: toInsightIssues(issues) });
    expect(progress.issuesTotal).toBe(24);
    expect(progress.issuesDone).toBe(2);
    expect(progress.issuePct).toBe(8);
  });

  it("el avance del proyecto es el de sus hitos, no el de sus tareas", () => {
    const { progress } = buildJiraProgressInsights({ today: "2026-09-19", issues: toInsightIssues(issues) });
    expect(progress.measuredBy).toBe("milestones");
    expect(progress.milestonesDone).toBe(2);
    expect(progress.milestonesTotal).toBe(6);
    expect(progress.milestonePct).toBe(33);
  });

  it("detecta las 7 épicas sin ninguna tarea colgando", () => {
    const { coverage } = buildJiraProgressInsights({ today: "2026-09-19", issues: toInsightIssues(issues) });
    expect(coverage.epicsTotal).toBe(7);
    expect(coverage.epicsWithoutTasks).toHaveLength(7);
    expect(coverage.epicCoveragePct).toBe(0);
    expect(coverage.tasksWithoutParent).toBe(24);
  });
});
