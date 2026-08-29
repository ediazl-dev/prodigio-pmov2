import type { JiraMappingTarget } from "./jiraOnboardingService";

export const PMO_PROJECT_TYPES = ["apigee", "desarrollo", "integracion", "data", "otro"] as const;
export type PmoProjectType = (typeof PMO_PROJECT_TYPES)[number];

export interface JiraOnboardingIdentity {
  projectName: string;
  clientName: string;
  projectType: PmoProjectType;
  pmUserId: number | null;
  pmName: string;
  deliveryUserId: number | null;
  deliveryName: string;
  dealId: string;
}

export interface JiraMappingCandidate {
  sourceKey: string;
  jiraIssueType: string;
  summary: string;
  statusName: string | null;
  assigneeAccountId: string | null;
  assigneeName: string | null;
  dueDate: string | null;
  proposedTargetEntityType: JiraMappingTarget;
  proposedStatus: "proposed" | "excluded";
}

function nonEmpty(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function validateJiraOnboardingIdentity(input: Partial<JiraOnboardingIdentity>) {
  const missing: string[] = [];
  if (!nonEmpty(input.projectName)) missing.push("Nombre del proyecto");
  if (!nonEmpty(input.clientName)) missing.push("Cliente");
  if (!input.projectType || !PMO_PROJECT_TYPES.includes(input.projectType)) missing.push("Tipo de proyecto");
  if (!Number.isInteger(input.pmUserId) || Number(input.pmUserId) <= 0 || !nonEmpty(input.pmName)) missing.push("PM asignado");
  if (!Number.isInteger(input.deliveryUserId) || Number(input.deliveryUserId) <= 0 || !nonEmpty(input.deliveryName)) missing.push("Delivery asignado");
  if (!nonEmpty(input.dealId)) missing.push("Deal financiero");
  return { complete: missing.length === 0, missing };
}

export function classifyJiraIssueType(issueType: string): JiraMappingTarget {
  const normalized = issueType.trim().toLowerCase();
  if (normalized.includes("hito") || normalized.includes("milestone")) return "milestone";
  if (normalized.includes("riesgo") || normalized.includes("risk")) return "risk";
  if (normalized === "epic" || normalized.includes("épica") || normalized.includes("epica")) return "epic";
  if (["task", "story", "sub-task", "subtask", "bug", "tarea", "historia"].some(token => normalized.includes(token))) return "task";
  return "ignored";
}

export function buildJiraMappingCandidates(sourceSnapshot: any): JiraMappingCandidate[] {
  const issues = Array.isArray(sourceSnapshot?.issues) ? sourceSnapshot.issues : [];
  return issues
    .filter((issue: any) => nonEmpty(issue?.key))
    .map((issue: any) => {
      const jiraIssueType = nonEmpty(issue.issueType) || "[POR CONFIRMAR]";
      const proposedTargetEntityType = classifyJiraIssueType(jiraIssueType);
      return {
        sourceKey: nonEmpty(issue.key).toUpperCase(),
        jiraIssueType,
        summary: nonEmpty(issue.summary) || "[POR CONFIRMAR]",
        statusName: nonEmpty(issue.statusName) || null,
        assigneeAccountId: nonEmpty(issue.assigneeAccountId) || null,
        assigneeName: nonEmpty(issue.assigneeName) || null,
        dueDate: nonEmpty(issue.dueDate) || null,
        proposedTargetEntityType,
        proposedStatus: proposedTargetEntityType === "ignored" ? "excluded" : "proposed",
      } satisfies JiraMappingCandidate;
    })
    .sort((left: JiraMappingCandidate, right: JiraMappingCandidate) => left.sourceKey.localeCompare(right.sourceKey));
}
