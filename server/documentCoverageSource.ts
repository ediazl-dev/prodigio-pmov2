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
import { getDb } from "./db";
import {
  buildDocumentCoverageSummary,
  buildProjectDocumentCoverage,
  buildServiceDocumentCoverage,
  type DocumentCoverageEntity,
  type DocumentCoverageStatus,
} from "./documentCoverageModel";
import type { DocumentLifecycle } from "./documentCoveragePolicy";

export type DocumentCoverageQuery = {
  lifecycle?: "all" | DocumentLifecycle;
  entityType?: "all" | "project" | "recurring_service";
  coverageStatus?: "all" | "gaps" | "compliant" | DocumentCoverageStatus;
  client?: string | null;
  owner?: string | null;
  search?: string | null;
  page?: number;
  pageSize?: number;
  cutoffAt?: string;
};

function groupBy<T>(rows: T[], key: (row: T) => number): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const row of rows) {
    const id = key(row);
    const current = map.get(id) ?? [];
    current.push(row);
    map.set(id, current);
  }
  return map;
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map(value => String(value ?? "").trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right, "es-CL"));
}

function matchesCoverageStatus(entity: DocumentCoverageEntity, status: NonNullable<DocumentCoverageQuery["coverageStatus"]>) {
  if (status === "all") return true;
  if (status === "gaps") return entity.activeActions.length > 0 || entity.historicalObservations.length > 0;
  if (status === "compliant") return entity.coverage.required > 0 && entity.coverage.percentage === 100;
  return entity.requirements.some(requirement => requirement.status === status);
}

export function filterDocumentCoverageEntities(entities: DocumentCoverageEntity[], query: DocumentCoverageQuery) {
  const search = String(query.search ?? "").trim().toLocaleLowerCase("es-CL");
  const lifecycle = query.lifecycle ?? "open";
  const entityType = query.entityType ?? "all";
  const coverageStatus = query.coverageStatus ?? "gaps";
  return entities
    .filter(entity => lifecycle === "all" || entity.lifecycle === lifecycle)
    .filter(entity => entityType === "all" || entity.entityType === entityType)
    .filter(entity => !query.client || entity.clientName === query.client)
    .filter(entity => !query.owner || entity.ownerName === query.owner)
    .filter(entity => !search || [entity.entityName, entity.clientName, entity.dealId, entity.ownerName, String(entity.entityId)].some(value => String(value ?? "").toLocaleLowerCase("es-CL").includes(search)))
    .filter(entity => matchesCoverageStatus(entity, coverageStatus))
    .sort((left, right) => {
      const leftPriority = left.lifecycle === "open" ? left.activeActions.filter(action => action.severity === "critical").length * 100 + left.activeActions.length * 10 + (100 - (left.coverage.percentage ?? 0)) : left.historicalObservations.length * 10 + (100 - (left.coverage.percentage ?? 0));
      const rightPriority = right.lifecycle === "open" ? right.activeActions.filter(action => action.severity === "critical").length * 100 + right.activeActions.length * 10 + (100 - (right.coverage.percentage ?? 0)) : right.historicalObservations.length * 10 + (100 - (right.coverage.percentage ?? 0));
      return rightPriority - leftPriority || left.entityName.localeCompare(right.entityName, "es-CL");
    });
}

function recoveryPlanRequired(snapshot: any): boolean | null {
  const metrics = snapshot?.metrics as any;
  if (typeof metrics?.governance?.recoveryPlanRequired === "boolean") return metrics.governance.recoveryPlanRequired;
  if (Array.isArray(metrics?.governance?.activeTriggers)) return metrics.governance.activeTriggers.includes("G-05");
  return null;
}

export async function loadDocumentCoveragePortfolio(query: DocumentCoverageQuery, database?: any) {
  const db = database ?? await getDb();
  if (!db) throw new Error("Base de datos no disponible");
  const cutoffAt = query.cutoffAt && /^\d{4}-\d{2}-\d{2}$/.test(query.cutoffAt) ? query.cutoffAt : new Date().toISOString().slice(0, 10);
  const page = Math.max(1, Math.trunc(query.page ?? 1));
  const pageSize = Math.min(100, Math.max(10, Math.trunc(query.pageSize ?? 20)));

  const [
    projectRows,
    serviceRows,
    userRows,
    sowRows,
    ganttRows,
    linkedRows,
    baselineRows,
    milestoneRows,
    acceptanceRows,
    minuteRows,
    recoveryRows,
    approvalRows,
    closureRows,
    serviceDocumentRows,
    serviceControlRows,
    serviceReportRows,
    dashboardSnapshotRows,
  ] = await Promise.all([
    db.select().from(projects),
    db.select().from(recurringServices),
    db.select({ id: users.id, name: users.name }).from(users),
    db.select().from(sowDocuments),
    db.select().from(ganttUploads),
    db.select().from(linkedProjectDocuments),
    db.select().from(executiveProjectSources),
    db.select().from(executiveContractMilestones),
    db.select().from(executiveMilestoneAcceptances),
    db.select().from(executiveMeetingMinutes),
    db.select().from(executiveRecoveryPlans),
    db.select().from(stageApprovals),
    db.select().from(stageClosures),
    db.select().from(recurringServiceDocuments),
    db.select().from(recurringServiceDocumentControls),
    db.select().from(recurringServiceReportEvidence),
    db.select().from(executiveDashboardSnapshots),
  ]);

  const ownerById = new Map<number, string>(userRows.map((row: any) => [Number(row.id), String(row.name)]));
  const sowByProject = groupBy(sowRows, (row: any) => Number(row.projectId));
  const ganttByProject = groupBy(ganttRows, (row: any) => Number(row.projectId));
  const linkedByProject = groupBy(linkedRows, (row: any) => Number(row.projectId));
  const baselinesByProject = groupBy(baselineRows, (row: any) => Number(row.projectId));
  const milestonesByProject = groupBy(milestoneRows, (row: any) => Number(row.projectId));
  const acceptancesByProject = groupBy(acceptanceRows, (row: any) => Number(row.projectId));
  const minutesByProject = groupBy(minuteRows, (row: any) => Number(row.projectId));
  const recoveryByProject = groupBy(recoveryRows, (row: any) => Number(row.projectId));
  const approvalsByProject = groupBy(approvalRows, (row: any) => Number(row.projectId));
  const closuresByProject = groupBy(closureRows, (row: any) => Number(row.projectId));
  const documentsByService = groupBy(serviceDocumentRows, (row: any) => Number(row.serviceId));
  const controlsByService = groupBy(serviceControlRows, (row: any) => Number(row.serviceId));
  const reportsByService = groupBy(serviceReportRows, (row: any) => Number(row.serviceId));
  const snapshotsByProject = groupBy(dashboardSnapshotRows, (row: any) => Number(row.projectId));

  const projectEntities = projectRows.map((project: any) => {
    const baselines = (baselinesByProject.get(Number(project.id)) ?? []).sort((left: any, right: any) => new Date(right.approvedAt ?? right.createdAt).getTime() - new Date(left.approvedAt ?? left.createdAt).getTime());
    const snapshots = (snapshotsByProject.get(Number(project.id)) ?? []).sort((left: any, right: any) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
    const closureEvidence = [
      ...(approvalsByProject.get(Number(project.id)) ?? []).filter((row: any) => row.stageId === "closure").map((row: any) => ({ id: row.id, label: "Documento aprobado de cierre", fileName: row.fileName, reference: row.fileUrl ?? row.fileKey, observedAt: row.closedAt ?? row.uploadedAt })),
      ...(closuresByProject.get(Number(project.id)) ?? []).filter((row: any) => row.stageId === "closure").map((row: any) => ({ id: row.id, label: "Cierre administrativo", fileName: null, reference: row.evidenceReference, observedAt: row.evidenceDate ?? row.closedAt })),
    ];
    return buildProjectDocumentCoverage({
      entityType: "project",
      id: Number(project.id),
      name: String(project.projectName),
      clientName: String(project.clientName),
      dealId: project.dealId,
      ownerName: project.pmId ? ownerById.get(Number(project.pmId)) ?? null : null,
      status: project.status,
      currentStage: project.currentStage,
      cutoffAt,
      sowDocuments: (sowByProject.get(Number(project.id)) ?? []).map((row: any) => ({ id: row.id, status: row.status, fileName: `SoW v${row.version}`, fileUrl: row.sourcePdfUrl, finalDocUrl: row.finalDocUrl, meetingFrequency: row.meetingFrequency, createdAt: row.approvedAt ?? row.updatedAt ?? row.createdAt })),
      linkedDocuments: linkedByProject.get(Number(project.id)) ?? [],
      ganttUploads: ganttByProject.get(Number(project.id)) ?? [],
      baselines,
      milestones: (milestonesByProject.get(Number(project.id)) ?? []).map((row: any) => ({ id: row.id, code: row.milestoneCode, title: row.title, jiraClosedDate: row.jiraClosedDate })),
      acceptances: acceptancesByProject.get(Number(project.id)) ?? [],
      minutes: minutesByProject.get(Number(project.id)) ?? [],
      recoveryPlans: recoveryByProject.get(Number(project.id)) ?? [],
      closureEvidence,
      baselineApprovedAt: baselines.find((row: any) => row.sourceStatus === "approved")?.approvedAt ?? null,
      recoveryPlanRequired: recoveryPlanRequired(snapshots[0]),
    });
  });

  const serviceEntities = serviceRows.map((service: any) => buildServiceDocumentCoverage({
    entityType: "recurring_service",
    id: Number(service.id),
    name: String(service.serviceName),
    clientName: String(service.clientName),
    dealId: service.dealId,
    ownerName: service.pmId ? ownerById.get(Number(service.pmId)) ?? null : null,
    status: service.status,
    serviceType: service.serviceType,
    cutoffAt,
    documents: documentsByService.get(Number(service.id)) ?? [],
    controls: controlsByService.get(Number(service.id)) ?? [],
    reports: reportsByService.get(Number(service.id)) ?? [],
  }));

  const allEntities = [...projectEntities, ...serviceEntities];
  const filtered = filterDocumentCoverageEntities(allEntities, query);
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;
  const projectIds = new Set(projectRows.map((row: any) => Number(row.id)));
  const orphanSowCount = sowRows.filter((row: any) => !projectIds.has(Number(row.projectId))).length;

  return {
    cutoffAt,
    summary: buildDocumentCoverageSummary(filtered),
    items: filtered.slice(offset, offset + pageSize),
    pagination: { page: safePage, pageSize, total, totalPages },
    options: {
      clients: uniqueSorted(allEntities.map(entity => entity.clientName)),
      owners: uniqueSorted(allEntities.map(entity => entity.ownerName)),
    },
    quality: {
      orphanSowCount,
      receiptIntegrity: "Las cargas técnicas se consultan en su pestaña; sólo vínculos attached completos pueden aportar evidencia.",
    },
  };
}
