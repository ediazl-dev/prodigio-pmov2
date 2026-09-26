import {
  DOCUMENT_GOVERNANCE_POLICY_VERSION,
  DOCUMENT_REQUIREMENT_DEFINITIONS,
  getBaseDocumentRequirements,
  type DocumentGovernanceEntityType,
  type DocumentRequirementCode,
} from "../shared/documentGovernance";

export type CanonicalDocumentStatus =
  | "compliant"
  | "missing"
  | "pending_validation"
  | "expired"
  | "rejected"
  | "not_applicable"
  | "unconfirmed";

export type GovernanceArtifactInput = {
  id: number;
  requirementCode: string;
  sourceKind: string;
  fileName: string;
  fileUrl?: string | null;
  fileKey?: string | null;
  sha256?: string | null;
  version: number;
  artifactStatus: "active" | "superseded" | "archived" | "unavailable";
  observedAt?: Date | string | null;
  createdAt?: Date | string | null;
};

export type GovernanceDecisionInput = {
  id: number;
  artifactId: number;
  decision: "pending" | "valid" | "rejected" | "revoked";
  validFrom?: string | null;
  validUntil?: string | null;
  openEndedValidity: boolean;
  costingStatus: "not_applicable" | "pending" | "verified" | "rejected";
  reason?: string | null;
  decidedByName?: string | null;
  decidedAt?: Date | string | null;
};

export type GovernanceResolutionInput = {
  id: number;
  requirementCode: string;
  applicability: "required" | "not_applicable" | "unconfirmed";
  reason?: string | null;
  evidenceArtifactId?: number | null;
  active: boolean;
  decidedByName?: string | null;
  decidedAt?: Date | string | null;
};

export type GovernanceWorkPlanSnapshotInput = {
  id: number;
  artifactId: number;
  sourceType: string;
  milestoneCount: number;
  milestones: unknown;
  capturedAt?: Date | string | null;
};

function instant(value: Date | string | null | undefined) {
  if (!value) return 0;
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function dateOnly(value: Date | string | null | undefined) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : null;
}

function latestBy<T extends { id: number }>(rows: T[], dateValue: (row: T) => Date | string | null | undefined) {
  return [...rows].sort((left, right) => instant(dateValue(right)) - instant(dateValue(left)) || right.id - left.id)[0] ?? null;
}

export function buildCanonicalDocumentEntity(input: {
  entityType: DocumentGovernanceEntityType;
  entityId: number;
  entityName: string;
  clientName: string;
  dealId?: string | null;
  ownerName?: string | null;
  lifecycle: "open" | "historical" | "unconfirmed";
  lifecycleLabel: string;
  cutoffAt: string;
  artifacts: GovernanceArtifactInput[];
  decisions: GovernanceDecisionInput[];
  resolutions: GovernanceResolutionInput[];
  workPlanSnapshots: GovernanceWorkPlanSnapshotInput[];
}) {
  const requirementCodes = getBaseDocumentRequirements(input.entityType);
  const artifactById = new Map(input.artifacts.map(artifact => [artifact.id, artifact]));
  const requirements = requirementCodes.map(code => {
    const definition = DOCUMENT_REQUIREMENT_DEFINITIONS[code];
    const versions = input.artifacts
      .filter(artifact => artifact.requirementCode === code)
      .sort((left, right) => right.version - left.version || right.id - left.id);
    const activeArtifact = versions.find(artifact => artifact.artifactStatus === "active") ?? null;
    const latestDecision = activeArtifact
      ? latestBy(input.decisions.filter(decision => decision.artifactId === activeArtifact.id), decision => decision.decidedAt)
      : null;
    const resolution = latestBy(
      input.resolutions.filter(item => item.requirementCode === code && item.active),
      item => item.decidedAt,
    );
    const exceptionEvidence = resolution?.evidenceArtifactId ? artifactById.get(resolution.evidenceArtifactId) ?? null : null;
    const exceptionDecision = exceptionEvidence
      ? latestBy(input.decisions.filter(decision => decision.artifactId === exceptionEvidence.id), decision => decision.decidedAt)
      : null;
    const snapshot = activeArtifact
      ? latestBy(input.workPlanSnapshots.filter(item => item.artifactId === activeArtifact.id), item => item.capturedAt)
      : null;

    const applicability = resolution?.applicability ?? "required";
    const presence = activeArtifact
      ? activeArtifact.fileKey || activeArtifact.fileUrl || activeArtifact.sourceKind === "jira_snapshot" ? "present" as const : "reference_only" as const
      : "missing" as const;
    const validation = latestDecision?.decision ?? "pending";
    let validity: "current" | "expired" | "not_determined" = "not_determined";
    if (latestDecision?.decision === "valid") {
      if (latestDecision.openEndedValidity) validity = "current";
      else if (latestDecision.validUntil && latestDecision.validUntil < input.cutoffAt) validity = "expired";
      else if (latestDecision.validUntil && (!latestDecision.validFrom || latestDecision.validFrom <= input.cutoffAt)) validity = "current";
    }

    let status: CanonicalDocumentStatus;
    let detail: string;
    if (applicability === "not_applicable") {
      const evidenceIsValid = exceptionEvidence?.artifactStatus === "active" && exceptionDecision?.decision === "valid";
      status = evidenceIsValid ? "not_applicable" : "unconfirmed";
      detail = evidenceIsValid
        ? `Excepción autorizada: ${resolution?.reason ?? "sin detalle"}`
        : "La excepción está registrada, pero su evidencia aún no está validada.";
    } else if (applicability === "unconfirmed") {
      status = "unconfirmed";
      detail = resolution?.reason ?? "La aplicabilidad requiere confirmación.";
    } else if (!activeArtifact) {
      status = "missing";
      detail = "No existe una versión activa vinculada a este requisito.";
    } else if (latestDecision?.decision === "rejected" || latestDecision?.decision === "revoked") {
      status = "rejected";
      detail = latestDecision.reason ?? "La versión activa fue rechazada o revocada.";
    } else if (latestDecision?.decision !== "valid") {
      status = "pending_validation";
      detail = "Existe evidencia, pero todavía no acredita cumplimiento.";
    } else if (validity === "expired") {
      status = "expired";
      detail = `La vigencia terminó el ${latestDecision.validUntil}.`;
    } else if (validity !== "current") {
      status = "pending_validation";
      detail = "La decisión no define una vigencia utilizable al corte.";
    } else if (code === "costed_pnl" && latestDecision.costingStatus !== "verified") {
      status = "pending_validation";
      detail = "El documento está validado, pero el costeo financiero aún no fue verificado.";
    } else if (code === "work_plan_milestones" && (!snapshot || snapshot.milestoneCount < 1)) {
      status = "pending_validation";
      detail = "El artefacto no tiene un snapshot versionado con hitos identificables.";
    } else {
      status = "compliant";
      detail = latestDecision.openEndedValidity
        ? "Versión validada con vigencia abierta aprobada explícitamente."
        : `Versión validada y vigente al corte ${input.cutoffAt}.`;
    }

    const action = status === "missing"
      ? "Cargar documento"
      : status === "pending_validation"
        ? "Revisar y validar"
        : status === "expired"
          ? "Renovar documento"
          : status === "rejected"
            ? "Cargar nueva versión"
            : status === "unconfirmed"
              ? "Resolver aplicabilidad"
              : null;

    return {
      code,
      label: definition.label,
      description: definition.description,
      validationProfile: definition.validationProfile,
      applicability,
      presence,
      validation,
      validity,
      status,
      detail,
      action,
      activeArtifact: activeArtifact ? {
        id: activeArtifact.id,
        fileName: activeArtifact.fileName,
        version: activeArtifact.version,
        sourceKind: activeArtifact.sourceKind,
        sha256: activeArtifact.sha256 ?? null,
        observedAt: dateOnly(activeArtifact.observedAt ?? activeArtifact.createdAt),
      } : null,
      latestDecision: latestDecision ? {
        id: latestDecision.id,
        decision: latestDecision.decision,
        validFrom: latestDecision.validFrom ?? null,
        validUntil: latestDecision.validUntil ?? null,
        openEndedValidity: latestDecision.openEndedValidity,
        costingStatus: latestDecision.costingStatus,
        reason: latestDecision.reason ?? null,
        decidedByName: latestDecision.decidedByName ?? null,
        decidedAt: dateOnly(latestDecision.decidedAt),
      } : null,
      resolution: resolution ? {
        id: resolution.id,
        applicability: resolution.applicability,
        reason: resolution.reason ?? null,
        evidenceArtifactId: resolution.evidenceArtifactId ?? null,
        decidedByName: resolution.decidedByName ?? null,
        decidedAt: dateOnly(resolution.decidedAt),
      } : null,
      workPlanSnapshot: snapshot ? {
        id: snapshot.id,
        sourceType: snapshot.sourceType,
        milestoneCount: snapshot.milestoneCount,
        capturedAt: dateOnly(snapshot.capturedAt),
      } : null,
      historyCount: versions.length,
    };
  });

  const required = requirements.filter(item => item.applicability === "required");
  const count = (status: CanonicalDocumentStatus) => requirements.filter(item => item.status === status).length;
  const compliant = count("compliant");
  return {
    policyVersion: DOCUMENT_GOVERNANCE_POLICY_VERSION,
    entityType: input.entityType,
    entityId: input.entityId,
    entityName: input.entityName,
    clientName: input.clientName,
    dealId: input.dealId ?? null,
    ownerName: input.ownerName ?? null,
    lifecycle: input.lifecycle,
    lifecycleLabel: input.lifecycleLabel,
    cutoffAt: input.cutoffAt,
    coverage: {
      required: required.length,
      compliant,
      missing: count("missing"),
      pendingValidation: count("pending_validation"),
      expired: count("expired"),
      rejected: count("rejected"),
      notApplicable: count("not_applicable"),
      unconfirmed: count("unconfirmed"),
      percentage: required.length ? Math.round((compliant / required.length) * 100) : null,
    },
    requirements,
    blockers: requirements.filter(item => ["missing", "pending_validation", "expired", "rejected", "unconfirmed"].includes(item.status)),
    latestEvidenceAt: [...input.artifacts].map(item => dateOnly(item.observedAt ?? item.createdAt)).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null,
  };
}

export type CanonicalDocumentEntity = ReturnType<typeof buildCanonicalDocumentEntity>;

export function summarizeCanonicalDocumentPortfolio(entities: CanonicalDocumentEntity[]) {
  const requirements = entities.flatMap(entity => entity.requirements);
  const required = requirements.filter(item => item.applicability === "required");
  const compliant = required.filter(item => item.status === "compliant").length;
  return {
    entities: entities.length,
    openEntities: entities.filter(entity => entity.lifecycle === "open").length,
    historicalEntities: entities.filter(entity => entity.lifecycle === "historical").length,
    unconfirmedEntities: entities.filter(entity => entity.lifecycle === "unconfirmed").length,
    required: required.length,
    compliant,
    missing: requirements.filter(item => item.status === "missing").length,
    pendingValidation: requirements.filter(item => item.status === "pending_validation").length,
    expired: requirements.filter(item => item.status === "expired").length,
    rejected: requirements.filter(item => item.status === "rejected").length,
    notApplicable: requirements.filter(item => item.status === "not_applicable").length,
    unconfirmed: requirements.filter(item => item.status === "unconfirmed").length,
    percentage: required.length ? Math.round((compliant / required.length) * 100) : null,
  };
}
