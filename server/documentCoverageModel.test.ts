import { describe, expect, it } from "vitest";
import { buildDocumentCoverageSummary, buildProjectDocumentCoverage, buildServiceDocumentCoverage } from "./documentCoverageModel";

const projectBase = {
  entityType: "project" as const,
  id: 2670001,
  name: "[PMO] CCLA SRP MVP1 Deal 4728",
  clientName: "CCLA",
  dealId: "Deal4728",
  ownerName: "PM CCLA",
  status: "activo" as const,
  currentStage: "design",
  cutoffAt: "2026-09-21",
  sowDocuments: [{ id: 1, status: "approved", fileName: "sow.pdf", fileUrl: "s3://sow", meetingFrequency: "Semanal", createdAt: "2026-09-01" }],
  linkedDocuments: [{ id: 2, docType: "gantt" as const, fileName: "gantt.xlsx", fileUrl: "s3://gantt", createdAt: "2026-09-01" }],
  ganttUploads: [],
  baselines: [{ id: 3, sourceStatus: "approved", contractFileName: "contrato.pdf", contractFileUrl: "s3://contrato", approvedAt: "2026-09-14" }],
  milestones: [
    { id: 10, code: "M01", title: "Kickoff", jiraClosedDate: "2026-09-14" },
    { id: 11, code: "M02", title: "Diseño", jiraClosedDate: "2026-09-10" },
    { id: 12, code: "M03", title: "Construcción", jiraClosedDate: null },
  ],
  acceptances: [{ id: 20, milestoneId: 10, acceptanceStatus: "accepted", acceptedAt: "2026-09-16", evidenceFileName: "acta-m01.pdf", evidenceUrl: "s3://acta", createdAt: "2026-09-16" }],
  minutes: [
    { id: 30, isoWeek: "2026-W38", reviewStatus: "reviewed" as const, title: "Comité 1", fileName: "minuta-1.pdf", meetingDate: "2026-09-14" },
    { id: 31, isoWeek: "2026-W39", reviewStatus: "received" as const, title: "Comité 2", fileName: "minuta-2.pdf", meetingDate: "2026-09-21" },
  ],
  recoveryPlans: [],
  closureEvidence: [],
  baselineApprovedAt: "2026-09-14",
  recoveryPlanRequired: false,
};

describe("documentCoverageModel", () => {
  it("distingue acta aceptada, cierre Jira sin acta e hito no exigible", () => {
    const result = buildProjectDocumentCoverage(projectBase);
    const accepted = result.requirements.find(item => item.id.endsWith("milestone:10"));
    const overdue = result.requirements.find(item => item.id.endsWith("milestone:11"));
    const future = result.requirements.find(item => item.id.endsWith("milestone:12"));
    expect(accepted).toMatchObject({ status: "compliant", applicability: "required" });
    expect(overdue).toMatchObject({ status: "overdue", applicability: "required", dueDate: "2026-09-15" });
    expect(future).toMatchObject({ status: "not_applicable", applicability: "not_applicable" });
    expect(result.counters.closedMilestonesWithoutAcceptance).toBe(1);
    expect(result.activeActions.some(action => action.requirementId.endsWith("milestone:11"))).toBe(true);
  });

  it("no cuenta minuta recibida como revisada", () => {
    const result = buildProjectDocumentCoverage(projectBase);
    const minutes = result.requirements.find(item => item.kind === "executive_minutes");
    expect(minutes).toMatchObject({ status: "pending_validation", applicability: "required" });
    expect(minutes?.detail).toContain("recibida(s) sin revisión");
  });

  it("convierte faltantes históricos en antecedentes sin acciones activas", () => {
    const result = buildProjectDocumentCoverage({
      ...projectBase,
      id: 330001,
      status: "completado",
      currentStage: "closure",
      sowDocuments: [],
      linkedDocuments: [],
      baselines: [],
      milestones: [],
      acceptances: [],
      minutes: [],
      meetingFrequency: undefined,
      baselineApprovedAt: null,
    } as any);
    expect(result.lifecycle).toBe("historical");
    expect(result.requirements.find(item => item.kind === "contract_sow")?.status).toBe("historical_gap");
    expect(result.requirements.find(item => item.kind === "closure_document")?.status).toBe("historical_gap");
    expect(result.activeActions).toEqual([]);
    expect(result.historicalObservations.length).toBeGreaterThan(0);
  });

  it("trata documentos de servicio sin control como pendientes de validación", () => {
    const result = buildServiceDocumentCoverage({
      entityType: "recurring_service",
      id: 2100001,
      name: "Soporte Camanchaca",
      clientName: "Camanchaca",
      dealId: "Deal2383",
      status: "activo",
      serviceType: "mixto",
      cutoffAt: "2026-09-21",
      documents: [
        { id: 1, docType: "contrato", fileName: "contrato.pdf", fileUrl: "s3://contrato", uploadedAt: "2026-01-01" },
        { id: 2, docType: "sow", fileName: "sow.pdf", fileUrl: "s3://sow", uploadedAt: "2026-01-01" },
        { id: 3, docType: "pl", fileName: "plan.pdf", fileUrl: "s3://plan", uploadedAt: "2026-01-01" },
      ],
      controls: [],
      reports: [],
    });
    expect(result.coverage.pendingValidation).toBe(3);
    expect(result.requirements.find(item => item.kind === "service_periodic_report")).toMatchObject({ status: "unconfirmed", applicability: "unconfirmed" });
    expect(result.activeActions).toHaveLength(3);
  });

  it("separa reportes aceptados, entregados y vencidos", () => {
    const result = buildServiceDocumentCoverage({
      entityType: "recurring_service",
      id: 1,
      name: "Servicio",
      clientName: "Cliente",
      status: "activo",
      serviceType: "soporte_incidentes",
      cutoffAt: "2026-09-21",
      documents: [],
      controls: [],
      reports: [
        { id: 1, periodStart: "2026-06-01", periodEnd: "2026-06-30", dueDate: "2026-07-05", status: "accepted", evidenceDocumentId: 10, acceptedAt: "2026-07-04" },
        { id: 2, periodStart: "2026-07-01", periodEnd: "2026-07-31", dueDate: "2026-08-05", status: "delivered", evidenceDocumentId: 11, deliveredAt: "2026-08-04" },
        { id: 3, periodStart: "2026-08-01", periodEnd: "2026-08-31", dueDate: "2026-09-05", status: "pending" },
      ],
    });
    const reports = result.requirements.filter(item => item.kind === "service_periodic_report");
    expect(reports.map(item => item.status)).toEqual(["compliant", "pending_validation", "overdue"]);
    expect(result.counters.overdueServiceReports).toBe(1);
  });

  it("excluye no aplicables y por confirmar del denominador", () => {
    const result = buildServiceDocumentCoverage({
      entityType: "recurring_service",
      id: 2,
      name: "Staffing",
      clientName: "Cliente",
      status: "activo",
      serviceType: "staffing",
      cutoffAt: "2026-09-21",
      documents: [],
      controls: [],
      reports: [],
    });
    expect(result.coverage.required).toBe(2);
    expect(result.coverage.unconfirmed).toBe(1);
    expect(result.coverage.notApplicable).toBeGreaterThanOrEqual(1);
  });

  it("resume abiertos e históricos por separado", () => {
    const open = buildProjectDocumentCoverage(projectBase);
    const historical = buildProjectDocumentCoverage({ ...projectBase, id: 330001, status: "completado", currentStage: "closure", closureEvidence: [] });
    expect(buildDocumentCoverageSummary([open, historical])).toMatchObject({ entities: 2, open: 1, historical: 1, entitiesWithActiveGaps: 1 });
  });
});
