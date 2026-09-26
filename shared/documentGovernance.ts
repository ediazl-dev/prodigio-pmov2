export const DOCUMENT_GOVERNANCE_POLICY_VERSION = "2026-09-26.v1" as const;

export const DOCUMENT_ENTITY_TYPES = ["project", "recurring_service"] as const;
export type DocumentGovernanceEntityType = (typeof DOCUMENT_ENTITY_TYPES)[number];

export const DOCUMENT_REQUIREMENT_CODES = [
  "contract",
  "sow",
  "technical_economic_proposal",
  "costed_pnl",
  "work_plan_milestones",
] as const;
export type DocumentRequirementCode = (typeof DOCUMENT_REQUIREMENT_CODES)[number];

export const DOCUMENT_PRESENCE_STATUSES = ["missing", "present", "reference_only"] as const;
export type DocumentPresenceStatus = (typeof DOCUMENT_PRESENCE_STATUSES)[number];

export const DOCUMENT_VALIDATION_STATUSES = ["pending", "valid", "rejected", "revoked"] as const;
export type DocumentValidationStatus = (typeof DOCUMENT_VALIDATION_STATUSES)[number];

export const DOCUMENT_VALIDITY_STATUSES = ["current", "expired", "not_determined"] as const;
export type DocumentValidityStatus = (typeof DOCUMENT_VALIDITY_STATUSES)[number];

export const DOCUMENT_APPLICABILITY_STATUSES = ["required", "not_applicable", "unconfirmed"] as const;
export type DocumentApplicabilityStatus = (typeof DOCUMENT_APPLICABILITY_STATUSES)[number];

export type DocumentRequirementDefinition = {
  code: DocumentRequirementCode;
  label: string;
  shortLabel: string;
  description: string;
  validationProfile: "contractual" | "scope" | "commercial" | "financial" | "work_plan";
};

export const DOCUMENT_REQUIREMENT_DEFINITIONS: Record<DocumentRequirementCode, DocumentRequirementDefinition> = {
  contract: {
    code: "contract",
    label: "Contrato",
    shortLabel: "Contrato",
    description: "Acuerdo contractual firmado o formalmente aprobado, asociado a la entidad correcta.",
    validationProfile: "contractual",
  },
  sow: {
    code: "sow",
    label: "SoW",
    shortLabel: "SoW",
    description: "Statement of Work aprobado que identifica alcance, obligaciones y entregables.",
    validationProfile: "scope",
  },
  technical_economic_proposal: {
    code: "technical_economic_proposal",
    label: "Propuesta técnico-económica",
    shortLabel: "Propuesta",
    description: "Propuesta aprobada que contiene alcance técnico y condiciones económicas.",
    validationProfile: "commercial",
  },
  costed_pnl: {
    code: "costed_pnl",
    label: "P&L con costeo",
    shortLabel: "P&L",
    description: "Documento financiero con ingreso o presupuesto, costo, margen, moneda y fecha de corte verificables.",
    validationProfile: "financial",
  },
  work_plan_milestones: {
    code: "work_plan_milestones",
    label: "Plan de trabajo con hitos",
    shortLabel: "Plan con hitos",
    description: "Artefacto versionado que identifica el plan, su fuente y un conjunto trazable de hitos.",
    validationProfile: "work_plan",
  },
};

export const RECURRING_SERVICE_BASE_REQUIREMENTS = [
  "contract",
  "sow",
  "technical_economic_proposal",
  "costed_pnl",
] as const satisfies readonly DocumentRequirementCode[];

export const PROJECT_BASE_REQUIREMENTS = [
  ...RECURRING_SERVICE_BASE_REQUIREMENTS,
  "work_plan_milestones",
] as const satisfies readonly DocumentRequirementCode[];

export function getBaseDocumentRequirements(entityType: DocumentGovernanceEntityType): readonly DocumentRequirementCode[] {
  return entityType === "project" ? PROJECT_BASE_REQUIREMENTS : RECURRING_SERVICE_BASE_REQUIREMENTS;
}

export type LegacyDocumentAlias = {
  candidateRequirement: DocumentRequirementCode | null;
  requiresHumanClassification: boolean;
  rationale: string;
};

export const RECURRING_DOCUMENT_LEGACY_ALIASES: Record<string, LegacyDocumentAlias> = {
  contrato: {
    candidateRequirement: "contract",
    requiresHumanClassification: false,
    rationale: "El tipo legacy identifica explícitamente un contrato, pero la validación sigue siendo obligatoria.",
  },
  sow: {
    candidateRequirement: "sow",
    requiresHumanClassification: false,
    rationale: "El tipo legacy identifica explícitamente un SoW, pero la validación sigue siendo obligatoria.",
  },
  propuesta_tecnica: {
    candidateRequirement: "technical_economic_proposal",
    requiresHumanClassification: true,
    rationale: "Debe confirmarse que el archivo incluya el componente económico; el nombre legacy no basta.",
  },
  pl: {
    candidateRequirement: "costed_pnl",
    requiresHumanClassification: true,
    rationale: "Debe confirmarse que sea un P&L con costeo; no se interpreta como plan de trabajo ni se valida por nombre.",
  },
  otro: {
    candidateRequirement: null,
    requiresHumanClassification: true,
    rationale: "Un documento auxiliar no satisface automáticamente ningún requisito base.",
  },
};

export const DOCUMENT_GOVERNANCE_DEFAULTS = {
  openEndedValidityAllowedWithExplicitApproval: true,
  minimumWorkPlanMilestones: 1,
  pnlRequiredChecks: ["revenueOrBudget", "cost", "margin", "currency", "cutoffDate", "financialApproval"] as const,
  uploadRoles: ["admin", "pmo", "pm"] as const,
  validationRoles: ["admin", "pmo"] as const,
  notApplicableRoles: ["admin"] as const,
  rolloutMode: "observation_before_gate" as const,
};

export function isDocumentRequirementCode(value: string): value is DocumentRequirementCode {
  return (DOCUMENT_REQUIREMENT_CODES as readonly string[]).includes(value);
}
