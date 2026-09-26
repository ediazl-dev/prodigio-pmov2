import { describe, expect, it } from "vitest";
import { buildCanonicalDocumentEntity } from "./documentGovernanceModel";
import { filterDocumentGovernanceEntities } from "./documentGovernanceSource";

const project = buildCanonicalDocumentEntity({
  entityType: "project",
  entityId: 1,
  entityName: "Proyecto crítico",
  clientName: "Cliente A",
  ownerName: "PM A",
  lifecycle: "open",
  lifecycleLabel: "Abierto",
  cutoffAt: "2026-09-26",
  artifacts: [], decisions: [], resolutions: [], workPlanSnapshots: [],
});
const service = buildCanonicalDocumentEntity({
  entityType: "recurring_service",
  entityId: 2,
  entityName: "Servicio histórico",
  clientName: "Cliente B",
  ownerName: "PM B",
  lifecycle: "historical",
  lifecycleLabel: "Histórico",
  cutoffAt: "2026-09-26",
  artifacts: [], decisions: [], resolutions: [], workPlanSnapshots: [],
});

describe("filterDocumentGovernanceEntities", () => {
  it("usa abiertos con brechas como vista predeterminada", () => {
    expect(filterDocumentGovernanceEntities([service, project], {}).map(item => item.entityId)).toEqual([1]);
  });

  it("filtra por lifecycle, entidad, cliente, responsable y búsqueda", () => {
    expect(filterDocumentGovernanceEntities([service, project], { lifecycle: "historical", entityType: "recurring_service", client: "Cliente B", owner: "PM B", search: "histórico", coverageStatus: "all" })).toHaveLength(1);
  });

  it("filtra una brecha por requisito específico", () => {
    expect(filterDocumentGovernanceEntities([project], { lifecycle: "all", coverageStatus: "all", requirementCode: "costed_pnl" })).toHaveLength(1);
    expect(filterDocumentGovernanceEntities([service], { lifecycle: "all", coverageStatus: "all", requirementCode: "work_plan_milestones" })).toHaveLength(0);
  });

  it("prioriza más faltantes y no mezcla históricos con abiertos salvo solicitud", () => {
    const result = filterDocumentGovernanceEntities([service, project], { lifecycle: "all", coverageStatus: "gaps" });
    expect(result[0].entityType).toBe("project");
    expect(result).toHaveLength(2);
  });
});
