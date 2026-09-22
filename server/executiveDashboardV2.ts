export type ExecutiveSemanticStatus = "pending" | "fulfilled" | "delayed" | "blocked";

export type ContractualMilestoneEvidence = {
  billingWeight: number | string;
  jiraStatusName?: string | null;
  jiraDueDate?: string | null;
  semanticStatus?: ExecutiveSemanticStatus | null;
};

export type ContractualProgress = {
  totalWeight: number;
  fulfilledWeight: number;
  progressPct: number;
  delayedCount: number;
  overduePendingCount: number;
};

const COMPLETED_STATUS_NAMES = new Set(["cumplido (entregable)", "cumplido", "done", "completado", "closed"]);
const DELAYED_STATUS_NAMES = new Set(["retrasado", "atrasado", "delayed"]);
const BLOCKED_STATUS_NAMES = new Set(["bloqueado", "blocked"]);

export function normalizeExecutiveMilestoneStatus(statusName?: string | null, dueDate?: string | null, now = new Date()): ExecutiveSemanticStatus {
  const normalized = (statusName ?? "").trim().toLowerCase();
  if (COMPLETED_STATUS_NAMES.has(normalized)) return "fulfilled";
  if (DELAYED_STATUS_NAMES.has(normalized)) return "delayed";
  if (BLOCKED_STATUS_NAMES.has(normalized)) return "blocked";
  if (dueDate && new Date(`${dueDate}T23:59:59Z`).getTime() < now.getTime()) return "delayed";
  return "pending";
}

export function calculateContractualProgress(milestones: ContractualMilestoneEvidence[], now = new Date()): ContractualProgress {
  const evidence = milestones.map((milestone) => ({
    weight: Number(milestone.billingWeight),
    status: milestone.semanticStatus ?? normalizeExecutiveMilestoneStatus(milestone.jiraStatusName, milestone.jiraDueDate, now),
    dueDate: milestone.jiraDueDate,
  }));
  const totalWeight = evidence.reduce((total, item) => total + item.weight, 0);
  const fulfilledWeight = evidence.filter((item) => item.status === "fulfilled").reduce((total, item) => total + item.weight, 0);
  return {
    totalWeight: Number(totalWeight.toFixed(2)),
    fulfilledWeight: Number(fulfilledWeight.toFixed(2)),
    progressPct: totalWeight ? Number(((fulfilledWeight / totalWeight) * 100).toFixed(2)) : 0,
    delayedCount: evidence.filter((item) => item.status === "delayed").length,
    overduePendingCount: evidence.filter((item) => item.status === "pending" && item.dueDate && new Date(`${item.dueDate}T23:59:59Z`).getTime() < now.getTime()).length,
  };
}

export function calculateExecutiveSemaphore(progress: ContractualProgress, budgetUsedPct?: number | null): "VERDE" | "AMARILLO" | "ROJO" {
  if (progress.delayedCount > 0 || progress.overduePendingCount > 0 || (budgetUsedPct ?? 0) >= 105) return "ROJO";
  if ((budgetUsedPct ?? 0) >= 90 || progress.progressPct < 50) return "AMARILLO";
  return "VERDE";
}
