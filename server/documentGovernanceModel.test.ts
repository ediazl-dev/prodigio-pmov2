import { describe, expect, it } from "vitest";
import { buildCanonicalDocumentEntity, summarizeCanonicalDocumentPortfolio } from "./documentGovernanceModel";

const base = {
  entityId: 1,
  entityName: "Expediente de prueba",
  clientName: "Cliente",
  dealId: "1234",
  ownerName: "PM",
  lifecycle: "open" as const,
  lifecycleLabel: "Abierto",
  cutoffAt: "2026-09-26",
  artifacts: [],
  decisions: [],
  resolutions: [],
  workPlanSnapshots: [],
};

const serviceCodes = ["contract", "sow", "technical_economic_proposal", "costed_pnl"] as const;

function validService() {
  const artifacts = serviceCodes.map((requirementCode, index) => ({
    id: index + 1,
    requirementCode,
    sourceKind: "platform_upload",
    fileName: `${requirementCode}.pdf`,
    fileKey: `key-${index}`,
    version: 1,
    artifactStatus: "active" as const,
    observedAt: "2026-09-20",
  }));
  const decisions = artifacts.map((artifact, index) => ({
    id: index + 1,
    artifactId: artifact.id,
    decision: "valid" as const,
    validFrom: "2026-09-01",
    validUntil: null,
    openEndedValidity: true,
    costingStatus: artifact.requirementCode === "costed_pnl" ? "verified" as const : "not_applicable" as const,
    decidedAt: "2026-09-21",
  }));
  return { artifacts, decisions };
}

describe("documentGovernanceModel", () => {
  it("muestra una sola brecha contractual exigible como Contrato o SoW cuando no hay ninguno", () => {
    const result = buildCanonicalDocumentEntity({ ...base, entityType: "recurring_service" });
    expect(result.requirements.map(item => item.code)).toEqual(serviceCodes);
    expect(result.coverage).toMatchObject({ required: 3, compliant: 0, missing: 3, percentage: 0 });
    expect(result.requirements.filter(item => item.exigibility === "required" && ["contract", "sow"].includes(item.code))).toHaveLength(1);
    expect(result.requirements.find(item => item.code === "contract")).toMatchObject({ exigibility: "required", status: "missing" });
    expect(result.requirements.find(item => item.code === "sow")).toMatchObject({ exigibility: "alternative", status: "missing" });
    expect(result.requirements.find(item => item.code === "contract")?.detail).toContain("Contrato o SoW");
  });

  it("acepta sólo Contrato o sólo SoW como la base contractual del recurrente", () => {
    const { artifacts, decisions } = validService();
    const onlyContract = buildCanonicalDocumentEntity({
      ...base,
      entityType: "recurring_service",
      artifacts: artifacts.filter(artifact => artifact.requirementCode !== "sow"),
      decisions: decisions.filter(decision => artifacts.find(artifact => artifact.id === decision.artifactId)?.requirementCode !== "sow"),
    });
    const onlySow = buildCanonicalDocumentEntity({
      ...base,
      entityType: "recurring_service",
      artifacts: artifacts.filter(artifact => artifact.requirementCode !== "contract"),
      decisions: decisions.filter(decision => artifacts.find(artifact => artifact.id === decision.artifactId)?.requirementCode !== "contract"),
    });
    for (const result of [onlyContract, onlySow]) {
      expect(result.coverage).toMatchObject({ required: 3, compliant: 3, percentage: 100 });
      expect(result.blockers).toHaveLength(0);
    }
    expect(onlyContract.requirements.find(item => item.code === "sow")).toMatchObject({ exigibility: "alternative", status: "missing" });
    expect(onlySow.requirements.find(item => item.code === "contract")).toMatchObject({ exigibility: "alternative", status: "missing" });
  });

  it("distingue presencia de validación y no cuenta pendientes como cumplimiento", () => {
    const { artifacts } = validService();
    const decisions = artifacts.map((artifact, index) => ({
      id: index + 1,
      artifactId: artifact.id,
      decision: "pending" as const,
      openEndedValidity: false,
      costingStatus: artifact.requirementCode === "costed_pnl" ? "pending" as const : "not_applicable" as const,
      decidedAt: "2026-09-21",
    }));
    const result = buildCanonicalDocumentEntity({ ...base, entityType: "recurring_service", artifacts, decisions });
    expect(result.coverage).toMatchObject({ required: 3, compliant: 0, pendingValidation: 3, percentage: 0 });
    expect(result.requirements.every(item => item.presence === "present")).toBe(true);
  });

  it("con ambos documentos conserva ambas historias pero cuenta una sola base contractual", () => {
    const { artifacts, decisions } = validService();
    const result = buildCanonicalDocumentEntity({ ...base, entityType: "recurring_service", artifacts, decisions });
    expect(result.coverage).toMatchObject({ required: 3, compliant: 3, percentage: 100 });
    expect(result.blockers).toHaveLength(0);
    expect(result.requirements.find(item => item.code === "contract")?.historyCount).toBe(1);
    expect(result.requirements.find(item => item.code === "sow")?.historyCount).toBe(1);
    expect(result.requirements.find(item => item.code === "sow")?.detail).toContain("no es una excepción humana");
  });

  it("marca como vencido un documento cuya vigencia terminó antes del corte", () => {
    const { artifacts, decisions } = validService();
    decisions[0] = { ...decisions[0], openEndedValidity: false, validUntil: "2026-09-25" };
    const result = buildCanonicalDocumentEntity({ ...base, entityType: "recurring_service", artifacts, decisions });
    expect(result.requirements.find(item => item.code === "contract")?.status).toBe("expired");
    expect(result.coverage.expired).toBe(0);
    expect(result.requirements.find(item => item.code === "sow")).toMatchObject({ exigibility: "required", status: "compliant" });
    expect(result.requirements.find(item => item.code === "contract")).toMatchObject({ exigibility: "alternative", status: "expired" });
  });

  it("prefiere evidencia pendiente sobre vencida o rechazada, pero la pendiente no cumple", () => {
    const { artifacts, decisions } = validService();
    const contract = artifacts.find(artifact => artifact.requirementCode === "contract")!;
    const sow = artifacts.find(artifact => artifact.requirementCode === "sow")!;
    const pendingContract = decisions.map(decision => decision.artifactId === contract.id ? { ...decision, decision: "pending" as const, openEndedValidity: false, validUntil: null } : decision);
    const pendingResult = buildCanonicalDocumentEntity({ ...base, entityType: "recurring_service", artifacts, decisions: pendingContract });
    expect(pendingResult.requirements.find(item => item.code === "contract")).toMatchObject({ exigibility: "alternative", status: "pending_validation" });
    expect(pendingResult.requirements.find(item => item.code === "sow")).toMatchObject({ exigibility: "required", status: "compliant" });
    expect(pendingResult.coverage.compliant).toBe(3);

    const rejectedSow = decisions.map(decision => decision.artifactId === sow.id ? { ...decision, decision: "rejected" as const, reason: "No corresponde" } : decision);
    const rejectedResult = buildCanonicalDocumentEntity({ ...base, entityType: "recurring_service", artifacts, decisions: rejectedSow });
    expect(rejectedResult.requirements.find(item => item.code === "contract")).toMatchObject({ exigibility: "required", status: "compliant" });
    expect(rejectedResult.requirements.find(item => item.code === "sow")).toMatchObject({ exigibility: "alternative", status: "rejected" });
  });

  it("no cumple el plan de proyecto sin snapshot con hitos", () => {
    const { artifacts, decisions } = validService();
    artifacts.push({ id: 5, requirementCode: "work_plan_milestones", sourceKind: "jira_snapshot", fileName: "Plan Jira", fileKey: "key-5", version: 1, artifactStatus: "active", observedAt: "2026-09-20" });
    decisions.push({ id: 5, artifactId: 5, decision: "valid", validFrom: "2026-09-01", validUntil: null, openEndedValidity: true, costingStatus: "not_applicable", decidedAt: "2026-09-21" });
    const withoutSnapshot = buildCanonicalDocumentEntity({ ...base, entityType: "project", artifacts, decisions });
    expect(withoutSnapshot.requirements.filter(item => ["contract", "sow"].includes(item.code)).every(item => item.exigibility === "required")).toBe(true);
    expect(withoutSnapshot.coverage.required).toBe(5);
    expect(withoutSnapshot.requirements.find(item => item.code === "work_plan_milestones")?.status).toBe("pending_validation");
    const withSnapshot = buildCanonicalDocumentEntity({
      ...base,
      entityType: "project",
      artifacts,
      decisions,
      workPlanSnapshots: [{ id: 1, artifactId: 5, sourceType: "jira", milestoneCount: 3, milestones: [], capturedAt: "2026-09-20" }],
    });
    expect(withSnapshot.requirements.find(item => item.code === "work_plan_milestones")?.status).toBe("compliant");
  });

  it("sólo aplica N/A cuando la excepción tiene evidencia activa y válida", () => {
    const { artifacts, decisions } = validService();
    const resolutions = [{ id: 1, requirementCode: "contract", applicability: "not_applicable" as const, reason: "Excepción contractual aprobada", evidenceArtifactId: 2, active: true, decidedAt: "2026-09-22" }];
    const accepted = buildCanonicalDocumentEntity({ ...base, entityType: "recurring_service", artifacts, decisions, resolutions });
    expect(accepted.requirements.find(item => item.code === "contract")?.status).toBe("not_applicable");
    const pendingDecision = decisions.map(decision => decision.artifactId === 2 ? { ...decision, decision: "pending" as const } : decision);
    const unconfirmed = buildCanonicalDocumentEntity({ ...base, entityType: "recurring_service", artifacts, decisions: pendingDecision, resolutions });
    expect(unconfirmed.requirements.find(item => item.code === "contract")?.status).toBe("unconfirmed");
  });

  it("resume denominadores por requisito y no por entidad", () => {
    const { artifacts, decisions } = validService();
    const compliant = buildCanonicalDocumentEntity({ ...base, entityType: "recurring_service", artifacts, decisions });
    const missing = buildCanonicalDocumentEntity({ ...base, entityType: "project", entityId: 2 });
    expect(summarizeCanonicalDocumentPortfolio([compliant, missing])).toMatchObject({ entities: 2, required: 8, compliant: 3, missing: 5 });
  });
});
