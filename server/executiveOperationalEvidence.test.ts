import { describe, expect, it } from "vitest";
import { buildExecutiveOperationalEvidence, buildExecutiveOperationalEvidenceFromSnapshot, hasCurrentAgenticEvidenceContract } from "./executiveOperationalEvidence";

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

describe("buildExecutiveOperationalEvidenceFromSnapshot", () => {
  it("proyecta sólo los campos disponibles de un snapshot parcial", () => {
    expect(buildExecutiveOperationalEvidenceFromSnapshot({
      jiraEvidenceAvailability: "partial",
      jiraEvidenceAt: "2026-09-19T01:00:00.000Z",
      operationalProgressPct: 31,
      milestonesFulfilled: 8,
      milestonesTotal: 10,
      highRisksOpen: 12,
      operationalPhase: "Construcción + QA",
      executiveHealth: "Rojo|Crítico",
    })).toMatchObject({
      availability: "partial",
      issueProgressPct: 31,
      milestoneIssueProgressPct: 80,
      highOpenRisks: 12,
      operationalPhase: "Construcción + QA",
    });
  });

  it("bloquea métricas de un snapshot vencido", () => {
    expect(buildExecutiveOperationalEvidenceFromSnapshot({
      jiraEvidenceAvailability: "stale",
      jiraEvidenceAt: "2026-09-10T01:00:00.000Z",
      operationalProgressPct: 99,
      milestonesFulfilled: 10,
      milestonesTotal: 10,
      highRisksOpen: 0,
      operationalPhase: "Cierre",
      executiveHealth: "Verde",
    })).toMatchObject({
      availability: "stale",
      issueProgressPct: null,
      closedMilestoneIssues: null,
      operationalPhase: null,
      executiveHealth: null,
    });
  });
});

describe("hasCurrentAgenticEvidenceContract", () => {
  it("rechaza análisis legacy sin metadatos de procedencia Jira", () => {
    expect(hasCurrentAgenticEvidenceContract({ jiraAdvance: 46, totalIssues: 168 })).toBe(false);
  });

  it("acepta snapshots actuales aunque Jira esté missing", () => {
    expect(hasCurrentAgenticEvidenceContract({ jiraEvidenceAvailability: "missing", jiraEvidenceAt: null })).toBe(true);
    expect(hasCurrentAgenticEvidenceContract(JSON.stringify({ jiraEvidenceAvailability: "available" }))).toBe(true);
  });
});
