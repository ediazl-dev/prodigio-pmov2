export type JiraOperationalSnapshot = {
  percentComplete?: number | null;
  totalIssues?: number | null;
  doneCount?: number | null;
  inProgressCount?: number | null;
  toDoCount?: number | null;
  milestoneCompletionPct?: number | null;
  milestonesCumplidos?: number | null;
  milestones?: unknown[] | null;
  risks?: Array<{ priority?: string | null; statusCategory?: string | null }> | null;
  scopeChanges?: unknown[] | null;
};

export type ExecutiveOperationalEvidence = {
  source: "Jira";
  availability: "available" | "unavailable";
  observedAt: string | null;
  issueProgressPct: number | null;
  totalIssues: number | null;
  doneIssues: number | null;
  inProgressIssues: number | null;
  pendingIssues: number | null;
  milestoneIssueProgressPct: number | null;
  closedMilestoneIssues: number | null;
  totalMilestoneIssues: number | null;
  highOpenRisks: number | null;
  scopeChanges: number | null;
  governanceRule: "secondary_penalty_only";
};

function boundedPercent(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100, Number(value.toFixed(2)))) : null;
}

/**
 * Proyecta Jira como evidencia operativa. Sus indicadores no representan
 * aceptación contractual y el motor sólo los utiliza para aplicar penalizaciones.
 */
export function buildExecutiveOperationalEvidence(
  report: JiraOperationalSnapshot | null | undefined,
  observedAt: string | null,
): ExecutiveOperationalEvidence {
  if (!report) {
    return {
      source: "Jira", availability: "unavailable", observedAt: null,
      issueProgressPct: null, totalIssues: null, doneIssues: null, inProgressIssues: null, pendingIssues: null,
      milestoneIssueProgressPct: null, closedMilestoneIssues: null, totalMilestoneIssues: null,
      highOpenRisks: null, scopeChanges: null, governanceRule: "secondary_penalty_only",
    };
  }

  const risks = Array.isArray(report.risks) ? report.risks : [];
  const highOpenRisks = risks.filter((risk) =>
    ["Highest", "High"].includes(risk.priority ?? "") && risk.statusCategory !== "Done",
  ).length;
  const milestones = Array.isArray(report.milestones) ? report.milestones : [];

  return {
    source: "Jira", availability: "available", observedAt,
    issueProgressPct: boundedPercent(report.percentComplete),
    totalIssues: report.totalIssues ?? null,
    doneIssues: report.doneCount ?? null,
    inProgressIssues: report.inProgressCount ?? null,
    pendingIssues: report.toDoCount ?? null,
    milestoneIssueProgressPct: boundedPercent(report.milestoneCompletionPct),
    closedMilestoneIssues: report.milestonesCumplidos ?? null,
    totalMilestoneIssues: milestones.length || null,
    highOpenRisks,
    scopeChanges: Array.isArray(report.scopeChanges) ? report.scopeChanges.length : 0,
    governanceRule: "secondary_penalty_only",
  };
}
