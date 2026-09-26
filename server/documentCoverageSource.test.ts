import { describe, expect, it, vi } from "vitest";
import {
  executiveContractMilestones,
  executiveDashboardSnapshots,
  executiveMeetingMinutes,
  executiveMilestoneAcceptances,
  executiveProjectSources,
  executiveRecoveryPlans,
  ganttUploads,
  linkedProjectDocuments,
  projects,
  recurringServiceDocumentControls,
  recurringServiceDocuments,
  recurringServiceReportEvidence,
  recurringServices,
  sowDocuments,
  stageApprovals,
  stageClosures,
  users,
} from "../drizzle/schema";
import { loadDocumentCoveragePortfolio } from "./documentCoverageSource";

describe("loadDocumentCoveragePortfolio", () => {
  it("carga fuentes en lote, filtra abiertos con brechas y expone calidad/paginación", async () => {
    const rows = new Map<unknown, unknown[]>([
      [projects, [{ id: 1, projectName: "Proyecto abierto", clientName: "Cliente A", dealId: "Deal1", pmId: 5, status: "activo", currentStage: "design" }]],
      [recurringServices, [{ id: 2, serviceName: "Servicio abierto", clientName: "Cliente B", dealId: "Deal2", pmId: 5, status: "activo", serviceType: "mixto" }]],
      [users, [{ id: 5, name: "PM Uno" }]],
      [sowDocuments, [
        { id: 1, projectId: 1, status: "approved", version: 1, sourcePdfUrl: "s3://sow", finalDocUrl: null, meetingFrequency: null, createdAt: new Date("2026-09-01") },
        { id: 99, projectId: 999, status: "draft", version: 1, sourcePdfUrl: null, finalDocUrl: null, meetingFrequency: null, createdAt: new Date("2026-09-01") },
      ]],
      [ganttUploads, []],
      [linkedProjectDocuments, []],
      [executiveProjectSources, [{ id: 10, projectId: 1, sourceStatus: "approved", contractFileName: "contrato.pdf", contractFileUrl: "s3://contrato", approvedAt: new Date("2026-09-01"), createdAt: new Date("2026-09-01") }]],
      [executiveContractMilestones, [{ id: 20, projectId: 1, milestoneCode: "M01", title: "Entrega", jiraClosedDate: "2026-09-01" }]],
      [executiveMilestoneAcceptances, []],
      [executiveMeetingMinutes, []],
      [executiveRecoveryPlans, []],
      [stageApprovals, []],
      [stageClosures, []],
      [recurringServiceDocuments, [
        { id: 30, serviceId: 2, docType: "contrato", fileName: "contrato.pdf", fileUrl: "s3://contrato", uploadedAt: new Date("2026-01-01") },
        { id: 31, serviceId: 2, docType: "sow", fileName: "sow.pdf", fileUrl: "s3://sow", uploadedAt: new Date("2026-01-01") },
      ]],
      [recurringServiceDocumentControls, []],
      [recurringServiceReportEvidence, []],
      [executiveDashboardSnapshots, []],
    ]);
    const db = {
      select: vi.fn(() => ({ from: (table: unknown) => Promise.resolve(rows.get(table) ?? []) })),
    };

    const result = await loadDocumentCoveragePortfolio({
      lifecycle: "open",
      entityType: "all",
      coverageStatus: "gaps",
      cutoffAt: "2026-09-25",
      page: 1,
      pageSize: 20,
    }, db);

    expect(result.pagination).toEqual({ page: 1, pageSize: 20, total: 2, totalPages: 1 });
    expect(result.summary).toMatchObject({ entities: 2, open: 2, entitiesWithActiveGaps: 2 });
    expect(result.options).toEqual({ clients: ["Cliente A", "Cliente B"], owners: ["PM Uno"] });
    expect(result.quality.orphanSowCount).toBe(1);
    expect(result.items[0].activeActions.length).toBeGreaterThan(0);
  });

  it("aplica búsqueda, cliente y tipo sobre el read model común", async () => {
    const rows = new Map<unknown, unknown[]>([
      [projects, [{ id: 1, projectName: "Proyecto Tanner", clientName: "Tanner", dealId: "Deal1934", pmId: null, status: "completado", currentStage: "closure" }]],
      [recurringServices, [{ id: 2, serviceName: "Soporte Camanchaca", clientName: "Camanchaca", dealId: "Deal2383", pmId: null, status: "activo", serviceType: "mixto" }]],
      [users, []], [sowDocuments, []], [ganttUploads, []], [linkedProjectDocuments, []], [executiveProjectSources, []],
      [executiveContractMilestones, []], [executiveMilestoneAcceptances, []], [executiveMeetingMinutes, []], [executiveRecoveryPlans, []],
      [stageApprovals, []], [stageClosures, []], [recurringServiceDocuments, []], [recurringServiceDocumentControls, []], [recurringServiceReportEvidence, []], [executiveDashboardSnapshots, []],
    ]);
    const db = { select: vi.fn(() => ({ from: (table: unknown) => Promise.resolve(rows.get(table) ?? []) })) };
    const result = await loadDocumentCoveragePortfolio({ lifecycle: "all", entityType: "recurring_service", coverageStatus: "all", client: "Camanchaca", search: "2383", page: 1, pageSize: 10 }, db);
    expect(result.pagination.total).toBe(1);
    expect(result.items[0]).toMatchObject({ entityType: "recurring_service", entityName: "Soporte Camanchaca", lifecycle: "open" });
  });
});
