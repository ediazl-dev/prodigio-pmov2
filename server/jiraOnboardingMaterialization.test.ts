import { describe, expect, it } from "vitest";
import {
  assessHomologatedStageClosure,
  assessHistoricalStageReconciliation,
  assessJiraOnboardingMaterialization,
  buildHomologatedClosureMetadata,
  buildHistoricalReconciliationMetadata,
} from "./jiraOnboardingMaterialization";

const identity = {
  projectName: "Proyecto homologado",
  clientName: "Cliente confirmado",
  projectType: "desarrollo",
  pmUserId: 10,
  pmName: "PM confirmado",
  deliveryUserId: 11,
  deliveryName: "Delivery confirmado",
  dealId: "5000",
};

describe("materialización H4", () => {
  it("exige conciliación, identidad y una decisión explícita por issue", () => {
    const result = assessJiraOnboardingMaterialization({
      status: "mapping",
      identitySnapshot: null,
      sourceIssueKeys: ["PILOT-1"],
      mappings: [],
    });
    expect(result.ready).toBe(false);
    expect(result.errors).toHaveLength(3);
  });

  it("autoriza una materialización completa y distingue exclusiones", () => {
    const result = assessJiraOnboardingMaterialization({
      status: "reconciliation",
      identitySnapshot: identity,
      sourceIssueKeys: ["PILOT-1", "PILOT-2"],
      mappings: [
        { sourceKey: "PILOT-1", targetEntityType: "milestone", status: "approved" },
        { sourceKey: "PILOT-2", targetEntityType: "ignored", status: "excluded" },
      ],
    });
    expect(result).toMatchObject({ ready: true, approvedCount: 1, excludedCount: 1 });
  });

  it("permite reintentar idempotentemente cuando el onboarding ya tiene projectId", () => {
    const result = assessJiraOnboardingMaterialization({
      status: "reconciliation",
      projectId: 77,
      identitySnapshot: identity,
      sourceIssueKeys: [],
      mappings: [],
    });
    expect(result).toMatchObject({ ready: true, reusedProjectId: 77 });
  });
});

describe("cierre homologado H4", () => {
  it("rechaza autocierre, salto de etapa, falta de evidencia y estado Jira como respaldo", () => {
    const result = assessHomologatedStageClosure({
      stageId: "risks",
      stageStatus: "locked",
      stageStatuses: { sow: "completed", jira: "in_progress", risks: "locked" },
      actorConfirmed: false,
      evidenceSource: "jira_status",
      evidenceReference: "",
      evidenceDate: "29/08/2026",
    });
    expect(result.allowed).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(5);
  });

  it("genera metadatos de cierre homologado sin confundir Jira con aceptación", () => {
    const metadata = buildHomologatedClosureMetadata({
      stageId: "jira",
      stageStatus: "in_progress",
      stageStatuses: { sow: "completed", jira: "in_progress" },
      actorConfirmed: true,
      evidenceSource: "jira_configuration_report",
      evidenceReference: "onboarding:25:snapshot:v1",
      evidenceDate: "2026-08-29",
    });
    expect(metadata).toMatchObject({
      closureMode: "homologated",
      evidenceSource: "jira_configuration_report",
      homologationMetadata: { jiraStatusIsNotClientAcceptance: true },
    });
  });

  it("no trata un estado heredado completed como cierre homologado idempotente", () => {
    const result = assessHomologatedStageClosure({
      stageId: "jira",
      stageStatus: "completed",
      stageStatuses: { sow: "completed", jira: "completed" },
      actorConfirmed: true,
      evidenceSource: "documento_validado",
      evidenceReference: "informe-configuracion.pdf",
      evidenceDate: "2026-08-29",
    });
    expect(result).toMatchObject({ allowed: false, idempotent: false });
    expect(result.errors[0]).toContain("conciliación histórica");
  });

  it("concilia un estado histórico con evidencia sin cambiar ni desbloquear su etapa", () => {
    const input = {
      stageId: "risks" as const,
      stageStatus: "completed" as const,
      stageStatuses: { sow: "completed" as const, jira: "completed" as const, risks: "completed" as const },
      existingHomologatedEvidence: false,
      actorConfirmed: true,
      evidenceSource: "documento_validado",
      evidenceReference: "matriz-riesgos-v1.xlsx",
      evidenceDate: "2026-08-29",
      notes: "Estado histórico conciliado contra evidencia existente.",
    };
    expect(assessHistoricalStageReconciliation(input)).toMatchObject({ allowed: true, idempotent: false });
    expect(buildHistoricalReconciliationMetadata(input)).toMatchObject({
      closureMode: "homologated",
      homologationMetadata: { historicalStateReconciled: true, stageStatusPreserved: true },
    });
  });
});
