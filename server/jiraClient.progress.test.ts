import { describe, expect, it } from "vitest";
import { calculateExecutiveProgress } from "./jiraClient";

describe("calculateExecutiveProgress", () => {
  it("prioriza el cierre de hitos cliente aunque el avance de tareas sea mayor", () => {
    const progress = calculateExecutiveProgress(10, 2, 147, 83);
    expect(progress).toEqual({
      milestoneCompletionPct: 20,
      issueCompletionPct: 56,
      primaryProgressPct: 20,
      primaryProgressSource: "MILESTONES",
    });
  });

  it("usa el avance operativo solo como fallback si no existen hitos cliente", () => {
    const progress = calculateExecutiveProgress(0, 0, 147, 83);
    expect(progress).toEqual({
      milestoneCompletionPct: 0,
      issueCompletionPct: 56,
      primaryProgressPct: 56,
      primaryProgressSource: "JIRA_FALLBACK",
    });
  });
});
