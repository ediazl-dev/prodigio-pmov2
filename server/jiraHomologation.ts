export const CANONICAL_PROJECT_STAGE_IDS = [
  "sow",
  "jira",
  "risks",
  "planning",
  "design",
  "closure",
] as const;

export const CANONICAL_PROJECT_ROLES = ["admin", "pmo", "pm", "consulta"] as const;

export type CanonicalProjectStageId = (typeof CANONICAL_PROJECT_STAGE_IDS)[number];
export type CanonicalProjectRole = (typeof CANONICAL_PROJECT_ROLES)[number];

export type HomologationActivationContract = {
  stageIds: readonly string[];
  roles: readonly string[];
  progressMetric: string;
  missingDataPolicy: string;
  jiraCanCompletePmoStages: boolean;
  jiraOnlyBaselinePolicy: string;
};

export const CANONICAL_HOMOLOGATION_CONTRACT: HomologationActivationContract = {
  stageIds: CANONICAL_PROJECT_STAGE_IDS,
  roles: CANONICAL_PROJECT_ROLES,
  progressMetric: "accepted_milestone_cardinality",
  missingDataPolicy: "explicit_pending",
  jiraCanCompletePmoStages: false,
  jiraOnlyBaselinePolicy: "provisional_until_human_approval",
};

function sameOrderedValues(actual: readonly string[], expected: readonly string[]) {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function sameValueSet(actual: readonly string[], expected: readonly string[]) {
  return actual.length === expected.length && expected.every(value => actual.includes(value));
}

export function validateHomologationActivationContract(
  contract: HomologationActivationContract
): string[] {
  const violations: string[] = [];

  if (!sameOrderedValues(contract.stageIds, CANONICAL_PROJECT_STAGE_IDS)) {
    violations.push("El proyecto debe conservar exactamente las seis etapas canónicas y en su orden oficial.");
  }
  if (!sameValueSet(contract.roles, CANONICAL_PROJECT_ROLES)) {
    violations.push("La homologación solo admite los roles admin, pmo, pm y consulta.");
  }
  if (contract.progressMetric !== "accepted_milestone_cardinality") {
    violations.push("El avance contractual debe calcularse por cardinalidad de hitos aceptados con evidencia.");
  }
  if (contract.missingDataPolicy !== "explicit_pending") {
    violations.push("Los datos ausentes deben permanecer explícitamente pendientes; no se pueden inventar valores.");
  }
  if (contract.jiraCanCompletePmoStages) {
    violations.push("Jira no puede completar etapas PMO ni sustituir su evidencia y aprobación.");
  }
  if (contract.jiraOnlyBaselinePolicy !== "provisional_until_human_approval") {
    violations.push("Un baseline derivado solo de Jira debe permanecer provisional hasta aprobación humana.");
  }

  return violations;
}

export type LegacyLinkedProjectStagePlan = {
  projectStatus: "activo";
  currentStage: "design";
  stages: Array<{
    stageId: CanonicalProjectStageId;
    status: "locked" | "in_progress" | "completed";
    progress: number;
    completedAt?: Date;
  }>;
};

/**
 * Caracterización temporal del comportamiento previo a la homologación.
 * H4 reemplazará este plan por una reconstrucción auditable sin falsos cierres.
 */
export function buildLegacyLinkedProjectStagePlan(completedAt = new Date()): LegacyLinkedProjectStagePlan {
  return {
    projectStatus: "activo",
    currentStage: "design",
    stages: [
      { stageId: "sow", status: "completed", progress: 100, completedAt },
      { stageId: "jira", status: "completed", progress: 100, completedAt },
      { stageId: "risks", status: "completed", progress: 100, completedAt },
      { stageId: "planning", status: "completed", progress: 100, completedAt },
      { stageId: "design", status: "in_progress", progress: 0 },
      { stageId: "closure", status: "locked", progress: 0 },
    ],
  };
}

export type CanonicalLinkedProjectStagePlan = {
  projectStatus: "activo";
  currentStage: "sow";
  stages: Array<{
    stageId: CanonicalProjectStageId;
    status: "locked" | "in_progress";
    progress: 0;
    data: {
      homologation: {
        status: "pending_evidence";
        source: "jira_onboarding";
        message: "[PENDIENTE DE EVIDENCIA]";
      };
    };
  }>;
};

/**
 * Plan canónico para proyectos Jira homologados.
 * Ninguna etapa histórica se cierra por inferencia: SoW queda abierta y las
 * etapas siguientes bloqueadas hasta que exista un cierre formal con evidencia.
 */
export function buildCanonicalLinkedProjectStagePlan(): CanonicalLinkedProjectStagePlan {
  return {
    projectStatus: "activo",
    currentStage: "sow",
    stages: CANONICAL_PROJECT_STAGE_IDS.map((stageId, index) => ({
      stageId,
      status: index === 0 ? "in_progress" : "locked",
      progress: 0,
      data: {
        homologation: {
          status: "pending_evidence",
          source: "jira_onboarding",
          message: "[PENDIENTE DE EVIDENCIA]",
        },
      },
    })),
  };
}
