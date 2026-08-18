import { describe, expect, it } from "vitest";
import { buildExecutiveOperationalEvidence } from "./executiveOperationalEvidence";

describe("buildExecutiveOperationalEvidence", () => {
  it("preserva Jira como señal secundaria y no como aceptación contractual", () => {
    const evidence = buildExecutiveOperationalEvidence({
      percentComplete: 100,
      totalIssues: 12,
      doneCount: 12,
      inProgressCount: 0,
      toDoCount: 0,
      milestoneCompletionPct: 100,
      milestonesCumplidos: 4,
      milestones: [{}, {}, {}, {}],
      risks: [{ priority: "High", statusCategory: "In Progress" }],
      scopeChanges: [{}, {}],
    }, "2026-08-18T12:00:00.000Z");

    expect(evidence.governanceRule).toBe("secondary_penalty_only");
    expect(evidence.issueProgressPct).toBe(100);
    expect(evidence.closedMilestoneIssues).toBe(4);
    expect(evidence.highOpenRisks).toBe(1);
    expect(evidence.scopeChanges).toBe(2);
  });

  it("declara indisponibilidad sin inferir progreso cuando Jira no responde", () => {
    expect(buildExecutiveOperationalEvidence(null, null)).toMatchObject({
      availability: "unavailable",
      issueProgressPct: null,
      governanceRule: "secondary_penalty_only",
    });
  });
});
