import {
  CANONICAL_PROJECT_STAGE_IDS,
  type CanonicalProjectStageId,
} from "./jiraHomologation";
import { validateJiraOnboardingIdentity } from "./jiraOnboardingMapping";

export interface MaterializationMappingDecision {
  sourceKey: string;
  status: "proposed" | "approved" | "excluded" | "superseded";
  targetEntityType: string;
}

export interface JiraOnboardingMaterializationInput {
  status: string;
  projectId?: number | null;
  identitySnapshot: Record<string, unknown> | null;
  sourceIssueKeys: string[];
  mappings: MaterializationMappingDecision[];
}

export function assessJiraOnboardingMaterialization(input: JiraOnboardingMaterializationInput) {
  const errors: string[] = [];
  const identity = validateJiraOnboardingIdentity(input.identitySnapshot ?? {});
  if (!identity.complete) errors.push(`Identidad incompleta: ${identity.missing.join(", ")}`);
  if (!input.projectId && input.status !== "reconciliation") {
    errors.push("El onboarding debe estar en conciliación antes de materializar el proyecto.");
  }

  const sourceKeys = new Set(input.sourceIssueKeys.map(key => key.trim().toUpperCase()).filter(Boolean));
  const currentMappings = input.mappings.filter(mapping => mapping.status !== "superseded");
  const mappingBySource = new Map(currentMappings.map(mapping => [mapping.sourceKey.trim().toUpperCase(), mapping]));
  const missingDecisions = Array.from(sourceKeys).filter(key => !mappingBySource.has(key));
  if (missingDecisions.length > 0) {
    errors.push(`Faltan decisiones de mapeo para: ${missingDecisions.join(", ")}`);
  }
  const pendingDecisions = currentMappings.filter(mapping => sourceKeys.has(mapping.sourceKey.trim().toUpperCase()) && mapping.status === "proposed");
  if (pendingDecisions.length > 0) errors.push("Todos los mapeos deben estar aprobados o excluidos explícitamente.");

  return {
    ready: errors.length === 0,
    reusedProjectId: input.projectId ?? null,
    approvedCount: currentMappings.filter(mapping => mapping.status === "approved").length,
    excludedCount: currentMappings.filter(mapping => mapping.status === "excluded").length,
    errors,
  };
}

export interface HomologatedStageClosureRequest {
  stageId: CanonicalProjectStageId;
  stageStatus: "locked" | "in_progress" | "completed";
  stageStatuses: Partial<Record<CanonicalProjectStageId, "locked" | "in_progress" | "completed">>;
  actorConfirmed: boolean;
  evidenceSource: string;
  evidenceReference: string;
  evidenceDate: string;
  notes?: string | null;
}

function validateHomologationEvidence(input: Pick<HomologatedStageClosureRequest, "actorConfirmed" | "evidenceSource" | "evidenceReference" | "evidenceDate">) {
  const errors: string[] = [];
  if (!input.actorConfirmed) errors.push("La confirmación humana es obligatoria.");
  if (!input.evidenceSource.trim()) errors.push("La fuente de evidencia es obligatoria.");
  if (!input.evidenceReference.trim()) errors.push("La referencia de evidencia es obligatoria.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.evidenceDate)) errors.push("La fecha de evidencia debe usar formato YYYY-MM-DD.");
  if (input.evidenceSource.trim().toLowerCase() === "jira_status") {
    errors.push("El estado de Jira no constituye evidencia suficiente para cerrar una etapa PMO.");
  }
  return errors;
}

export function assessHomologatedStageClosure(input: HomologatedStageClosureRequest) {
  const errors: string[] = [];
  const stageIndex = CANONICAL_PROJECT_STAGE_IDS.indexOf(input.stageId);
  if (input.stageStatus === "completed") {
    return {
      allowed: false,
      idempotent: false,
      errors: ["La etapa está completada sin un cierre homologado verificable; utiliza la conciliación histórica."],
    };
  }
  if (input.stageStatus !== "in_progress") errors.push("Solo la etapa activa puede homologarse.");
  const precedingStages = CANONICAL_PROJECT_STAGE_IDS.slice(0, stageIndex);
  if (precedingStages.some(stageId => input.stageStatuses[stageId] !== "completed")) {
    errors.push("Las etapas anteriores deben estar formalmente cerradas.");
  }
  errors.push(...validateHomologationEvidence(input));
  return { allowed: errors.length === 0, idempotent: false, errors };
}

export interface HistoricalStageReconciliationRequest extends HomologatedStageClosureRequest {
  existingHomologatedEvidence: boolean;
}

export function assessHistoricalStageReconciliation(input: HistoricalStageReconciliationRequest) {
  if (input.existingHomologatedEvidence) return { allowed: true, idempotent: true, errors: [] as string[] };
  const errors: string[] = [];
  if (input.stageStatus !== "completed") errors.push("Solo un estado heredado completado puede conciliarse por esta vía.");
  const stageIndex = CANONICAL_PROJECT_STAGE_IDS.indexOf(input.stageId);
  const precedingStages = CANONICAL_PROJECT_STAGE_IDS.slice(0, stageIndex);
  if (precedingStages.some(stageId => input.stageStatuses[stageId] !== "completed")) {
    errors.push("Las etapas anteriores deben conservar estado completado antes de conciliar esta etapa histórica.");
  }
  errors.push(...validateHomologationEvidence(input));
  return { allowed: errors.length === 0, idempotent: false, errors };
}

export function buildHomologatedClosureMetadata(input: HomologatedStageClosureRequest) {
  const assessment = assessHomologatedStageClosure(input);
  if (!assessment.allowed) throw new Error(assessment.errors.join(" "));
  return {
    closureMode: "homologated" as const,
    evidenceSource: input.evidenceSource.trim(),
    evidenceReference: input.evidenceReference.trim(),
    evidenceDate: input.evidenceDate,
    homologationMetadata: {
      stageId: input.stageId,
      actorConfirmed: true,
      jiraStatusIsNotClientAcceptance: true,
      notes: input.notes?.trim() || null,
    },
  };
}

export function buildHistoricalReconciliationMetadata(input: HistoricalStageReconciliationRequest) {
  const assessment = assessHistoricalStageReconciliation(input);
  if (!assessment.allowed) throw new Error(assessment.errors.join(" "));
  return {
    closureMode: "homologated" as const,
    evidenceSource: input.evidenceSource.trim(),
    evidenceReference: input.evidenceReference.trim(),
    evidenceDate: input.evidenceDate,
    homologationMetadata: {
      stageId: input.stageId,
      actorConfirmed: true,
      historicalStateReconciled: true,
      stageStatusPreserved: true,
      jiraStatusIsNotClientAcceptance: true,
      notes: input.notes?.trim() || null,
    },
  };
}
