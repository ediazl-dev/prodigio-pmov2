import { deriveJiraMilestoneObservation } from "./jiraMilestoneSync";

export const JIRA_PROVISIONAL_BASELINE_VERSION = "jira-proposal-v1";

export interface JiraBaselineSourceIssue {
  key: string;
  summary?: string | null;
  statusName?: string | null;
  statusCategory?: string | null;
  dueDate?: string | null;
  resolutionDate?: string | null;
}

export interface JiraBaselineApprovedMapping {
  sourceKey: string;
  targetEntityType: string;
  targetEntityId?: string | null;
  status: string;
}

export interface JiraBaselineProposalMilestone {
  milestoneCode: string;
  title: string;
  billingWeight: string;
  baselineDate: string | null;
  jiraIssueKey: string;
  jiraStatusName: string | null;
  jiraDueDate: string | null;
  jiraClosedDate: string | null;
  semanticStatus: "pending" | "fulfilled" | "delayed" | "blocked";
  reconciliationNotes: string;
}

function normalizedKey(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function normalizedDate(value: unknown) {
  if (typeof value !== "string") return null;
  const candidate = value.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : null;
}

export function buildMappedJiraBaselineProposal(input: {
  sourceSnapshot: unknown;
  mappings: JiraBaselineApprovedMapping[];
  now?: Date;
}) {
  const snapshot = input.sourceSnapshot as { issues?: JiraBaselineSourceIssue[] } | null;
  const issues = Array.isArray(snapshot?.issues) ? snapshot.issues : [];
  const issuesByKey = new Map(
    issues
      .map(issue => [normalizedKey(issue.key), issue] as const)
      .filter(([key]) => Boolean(key)),
  );
  const mappedKeys = input.mappings
    .filter(mapping => mapping.status === "approved" && mapping.targetEntityType === "milestone")
    .map(mapping => ({ ...mapping, normalizedSourceKey: normalizedKey(mapping.sourceKey) }))
    .filter(mapping => Boolean(mapping.normalizedSourceKey))
    .sort((left, right) => left.normalizedSourceKey.localeCompare(right.normalizedSourceKey));

  const milestones: JiraBaselineProposalMilestone[] = [];
  const exceptions: Array<{ sourceKey: string; domain: "baseline" | "milestones"; reason: string }> = [];

  for (const mapping of mappedKeys) {
    const issue = issuesByKey.get(mapping.normalizedSourceKey);
    if (!issue) {
      exceptions.push({
        sourceKey: mapping.normalizedSourceKey,
        domain: "milestones",
        reason: "El issue aprobado no está presente en el snapshot Jira vigente.",
      });
      continue;
    }

    const dueDate = normalizedDate(issue.dueDate);
    const observation = deriveJiraMilestoneObservation({
      key: mapping.normalizedSourceKey,
      fields: {
        status: {
          name: issue.statusName ?? null,
          statusCategory: { key: issue.statusCategory ?? null },
        },
        duedate: dueDate,
        resolutiondate: normalizedDate(issue.resolutionDate),
      },
    }, input.now);

    milestones.push({
      milestoneCode: mapping.targetEntityId?.trim() || mapping.normalizedSourceKey,
      title: issue.summary?.trim() || "[POR CONFIRMAR]",
      billingWeight: "0.00",
      baselineDate: dueDate,
      jiraIssueKey: mapping.normalizedSourceKey,
      jiraStatusName: observation.jiraStatusName,
      jiraDueDate: observation.jiraDueDate,
      jiraClosedDate: observation.jiraClosedDate,
      semanticStatus: observation.semanticStatus,
      reconciliationNotes: dueDate
        ? "Fecha propuesta desde Jira; requiere aprobación humana para convertirse en baseline contractual."
        : "[PENDIENTE] Jira no informa fecha planificada; se requiere evidencia contractual.",
    });

    if (!dueDate) {
      exceptions.push({
        sourceKey: mapping.normalizedSourceKey,
        domain: "baseline",
        reason: "El hito mapeado no tiene fecha Jira; la fecha contractual permanece [PENDIENTE].",
      });
    }
  }

  return {
    baselineVersion: JIRA_PROVISIONAL_BASELINE_VERSION,
    milestones,
    exceptions,
    missingBaselineIssueKeys: milestones
      .filter(milestone => !milestone.baselineDate)
      .map(milestone => milestone.jiraIssueKey),
  };
}

export function assessJiraBaselineApproval(input: {
  sourceStatus: string;
  milestones: Array<{ jiraIssueKey: string; baselineDate: string | null }>;
}) {
  const reasons: string[] = [];
  if (input.sourceStatus !== "draft") reasons.push("La propuesta ya no está en estado draft.");
  if (input.milestones.length === 0) reasons.push("La propuesta no contiene hitos mapeados.");
  const missingBaselineIssueKeys = input.milestones
    .filter(milestone => !normalizedDate(milestone.baselineDate))
    .map(milestone => milestone.jiraIssueKey);
  if (missingBaselineIssueKeys.length > 0) {
    reasons.push(`Faltan fechas contractuales para: ${missingBaselineIssueKeys.join(", ")}.`);
  }
  return {
    approvable: reasons.length === 0,
    reasons,
    missingBaselineIssueKeys,
  };
}

export function assessJiraBaselineOperator(input: {
  role: string;
  userId: number;
  identitySnapshot: unknown;
}) {
  if (input.role === "admin" || input.role === "pmo") {
    return { allowed: true, reason: null };
  }
  const identity = input.identitySnapshot && typeof input.identitySnapshot === "object"
    ? input.identitySnapshot as Record<string, unknown>
    : {};
  const assignedPmUserId = Number(identity.pmUserId);
  if (input.role === "pm" && Number.isInteger(assignedPmUserId) && assignedPmUserId === input.userId) {
    return { allowed: true, reason: null };
  }
  return {
    allowed: false,
    reason: input.role === "pm"
      ? "Solo el PM asignado al proyecto puede operar o aprobar su propuesta de baseline."
      : "Requiere rol Admin, PMO o PM asignado al proyecto.",
  };
}
