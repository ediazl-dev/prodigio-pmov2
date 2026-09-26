import { DOCUMENT_GOVERNANCE_POLICY_VERSION, type DocumentGovernanceEntityType } from "../shared/documentGovernance";
import { loadDocumentGovernancePortfolio } from "./documentGovernanceSource";
import { getProjectById } from "./db";
import { getRecurringServiceById } from "./recurringServicesDb";

export type DocumentGateMode = "off" | "observe" | "enforce";

function normalizedMode(value: string | undefined): DocumentGateMode {
  return value === "off" || value === "enforce" ? value : "observe";
}

function cohortContains(value: string | undefined, entityId: number) {
  const entries = String(value ?? "").split(",").map(item => item.trim()).filter(Boolean);
  return entries.includes("*") || entries.includes(String(entityId));
}

export function resolveDocumentGateMode(entityType: DocumentGovernanceEntityType, entityId: number, environment: NodeJS.ProcessEnv = process.env): DocumentGateMode {
  const configured = normalizedMode(environment.DOCUMENT_GOVERNANCE_GATE_MODE);
  if (configured !== "enforce") return configured;
  const cohort = entityType === "project"
    ? environment.DOCUMENT_GOVERNANCE_PROJECT_ENFORCE_IDS
    : environment.DOCUMENT_GOVERNANCE_RECURRING_ENFORCE_IDS;
  return cohortContains(cohort, entityId) ? "enforce" : "observe";
}

export async function getDocumentGateReadiness(input: {
  entityType: DocumentGovernanceEntityType;
  entityId: number;
  gateCode: "recurring_initialization" | "project_planning";
  cutoffAt?: string;
  environment?: NodeJS.ProcessEnv;
}) {
  const cutoffAt = input.cutoffAt && /^\d{4}-\d{2}-\d{2}$/.test(input.cutoffAt)
    ? input.cutoffAt
    : new Date().toISOString().slice(0, 10);
  const entity = input.entityType === "project"
    ? await getProjectById(input.entityId)
    : await getRecurringServiceById(input.entityId);
  if (!entity) throw new Error("Entidad no encontrada.");

  const portfolio = await loadDocumentGovernancePortfolio({
    entityId: input.entityId,
    lifecycle: "all",
    entityType: input.entityType,
    coverageStatus: "all",
    page: 1,
    pageSize: 10,
    cutoffAt,
  });
  const item = portfolio.items.find(candidate => candidate.entityId === input.entityId);
  if (!item) throw new Error("No fue posible construir el expediente documental.");

  const mode = resolveDocumentGateMode(input.entityType, input.entityId, input.environment);
  const documentBlockers = item.requirements
    .filter(requirement => requirement.applicability === "required" && requirement.status !== "compliant")
    .map(requirement => ({
      type: "document" as const,
      code: requirement.code,
      label: requirement.label,
      status: requirement.status,
      detail: requirement.detail,
      action: requirement.action,
    }));
  const operationalBlockers: Array<{ type: "operational"; code: string; label: string; status: string; detail: string; action: string }> = [];
  if (input.entityType === "recurring_service" && !(entity as any).dealId) {
    operationalBlockers.push({
      type: "operational",
      code: "pipedrive_deal",
      label: "Deal de Pipedrive",
      status: "missing",
      detail: "El servicio no tiene un Deal de Pipedrive asociado.",
      action: "Sincronizar o vincular el Deal antes del cierre.",
    });
  }
  const blockers = [...documentBlockers, ...operationalBlockers];
  const ready = blockers.length === 0;
  return {
    policyVersion: DOCUMENT_GOVERNANCE_POLICY_VERSION,
    entityType: input.entityType,
    entityId: input.entityId,
    gateCode: input.gateCode,
    cutoffAt,
    mode,
    ready,
    canProceed: mode !== "enforce" || ready,
    result: mode === "off" ? "observation" as const : ready ? "pass" as const : mode === "enforce" ? "block" as const : "observation" as const,
    coverage: item.coverage,
    blockers,
    requirementSnapshot: item.requirements.map(requirement => ({
      code: requirement.code,
      status: requirement.status,
      applicability: requirement.applicability,
      artifactId: requirement.activeArtifact?.id ?? null,
      version: requirement.activeArtifact?.version ?? null,
      sha256: requirement.activeArtifact?.sha256 ?? null,
      validUntil: requirement.latestDecision?.validUntil ?? null,
      costingStatus: requirement.latestDecision?.costingStatus ?? null,
      milestoneCount: requirement.workPlanSnapshot?.milestoneCount ?? null,
    })),
  };
}
