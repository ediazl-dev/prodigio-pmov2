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
  availability: "available" | "partial" | "stale" | "error" | "missing" | "unavailable";
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

export type JiraPortfolioOperationalSnapshot = {
  jiraEvidenceAvailability: "available" | "partial" | "stale" | "error" | "missing";
  jiraEvidenceAt: string | null;
  operationalProgressPct: number | null;
  milestonesFulfilled: number | null;
  milestonesTotal: number | null;
  highRisksOpen: number | null;
  operationalPhase: string | null;
  executiveHealth: string | null;
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

export function buildExecutiveOperationalEvidenceFromSnapshot(
  snapshot: JiraPortfolioOperationalSnapshot | null | undefined,
): ExecutiveOperationalEvidence & { operationalPhase: string | null; executiveHealth: string | null } {
  const usable = snapshot?.jiraEvidenceAvailability === "available" || snapshot?.jiraEvidenceAvailability === "partial";
  if (!snapshot || !usable) {
    return {
      source: "Jira",
      availability: snapshot?.jiraEvidenceAvailability ?? "missing",
      observedAt: snapshot?.jiraEvidenceAt ?? null,
      issueProgressPct: null,
      totalIssues: null,
      doneIssues: null,
      inProgressIssues: null,
      pendingIssues: null,
      milestoneIssueProgressPct: null,
      closedMilestoneIssues: null,
      totalMilestoneIssues: null,
      highOpenRisks: null,
      scopeChanges: null,
      governanceRule: "secondary_penalty_only",
      operationalPhase: null,
      executiveHealth: null,
    };
  }
  const milestoneIssueProgressPct = snapshot.milestonesTotal && snapshot.milestonesFulfilled != null
    ? boundedPercent((snapshot.milestonesFulfilled / snapshot.milestonesTotal) * 100)
    : null;
  return {
    source: "Jira",
    availability: snapshot.jiraEvidenceAvailability,
    observedAt: snapshot.jiraEvidenceAt,
    issueProgressPct: boundedPercent(snapshot.operationalProgressPct),
    totalIssues: null,
    doneIssues: null,
    inProgressIssues: null,
    pendingIssues: null,
    milestoneIssueProgressPct,
    closedMilestoneIssues: snapshot.milestonesFulfilled,
    totalMilestoneIssues: snapshot.milestonesTotal,
    highOpenRisks: snapshot.highRisksOpen,
    scopeChanges: null,
    governanceRule: "secondary_penalty_only",
    operationalPhase: snapshot.operationalPhase,
    executiveHealth: snapshot.executiveHealth,
  };
}

export function hasCurrentAgenticEvidenceContract(metricsSnapshot: unknown): boolean {
  let value = metricsSnapshot;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return false;
    }
  }
  if (!value || typeof value !== "object") return false;
  const availability = (value as Record<string, unknown>).jiraEvidenceAvailability;
  return ["available", "partial", "stale", "error", "missing"].includes(String(availability ?? ""));
}
