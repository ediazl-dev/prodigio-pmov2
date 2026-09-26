import {
  documentArtifacts,
  documentRequirementResolutions,
  documentValidationDecisions,
  documentWorkPlanSnapshots,
  projects,
  recurringServices,
  users,
} from "../drizzle/schema";
import { getDb } from "./db";
import { loadDocumentCoveragePortfolio } from "./documentCoverageSource";
import { resolveDocumentLifecycle } from "./documentCoveragePolicy";
import {
  buildCanonicalDocumentEntity,
  summarizeCanonicalDocumentPortfolio,
  type CanonicalDocumentEntity,
  type CanonicalDocumentStatus,
} from "./documentGovernanceModel";

export type DocumentGovernancePortfolioQuery = {
  entityId?: number;
  lifecycle?: "all" | "open" | "historical" | "unconfirmed";
  entityType?: "all" | "project" | "recurring_service";
  coverageStatus?: "all" | "gaps" | "compliant" | CanonicalDocumentStatus;
  requirementCode?: "all" | "contract" | "sow" | "technical_economic_proposal" | "costed_pnl" | "work_plan_milestones";
  client?: string | null;
  owner?: string | null;
  search?: string | null;
  page?: number;
  pageSize?: number;
  cutoffAt?: string;
};

type SupplementaryPortfolio = Awaited<ReturnType<typeof loadDocumentCoveragePortfolio>>;
type SupplementaryRequirement = SupplementaryPortfolio["items"][number]["requirements"][number];
type SupplementaryCounters = SupplementaryPortfolio["items"][number]["counters"];
export type DocumentGovernancePortfolioEntity = CanonicalDocumentEntity & {
  supplementaryRequirements: SupplementaryRequirement[];
  supplementaryCounters: SupplementaryCounters;
};

function groupBy<T>(rows: T[], key: (row: T) => number) {
  const grouped = new Map<number, T[]>();
  for (const row of rows) {
    const id = key(row);
    grouped.set(id, [...(grouped.get(id) ?? []), row]);
  }
  return grouped;
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map(value => String(value ?? "").trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right, "es-CL"));
}

const SUPPLEMENTARY_REQUIREMENT_KINDS = new Set([
  "milestone_acceptance",
  "executive_minutes",
  "recovery_plan",
  "closure_document",
  "service_periodic_report",
]);

function matchesStatus(entity: CanonicalDocumentEntity, status: NonNullable<DocumentGovernancePortfolioQuery["coverageStatus"]>) {
  if (status === "all") return true;
  if (status === "gaps") return entity.blockers.length > 0;
  if (status === "compliant") return entity.coverage.required > 0 && entity.coverage.compliant === entity.coverage.required;
  return entity.requirements.some(requirement => requirement.status === status);
}

export function filterDocumentGovernanceEntities<T extends CanonicalDocumentEntity>(entities: T[], query: DocumentGovernancePortfolioQuery): T[] {
  const lifecycle = query.lifecycle ?? "open";
  const entityType = query.entityType ?? "all";
  const coverageStatus = query.coverageStatus ?? "gaps";
  const requirementCode = query.requirementCode ?? "all";
  const search = String(query.search ?? "").trim().toLocaleLowerCase("es-CL");
  return entities
    .filter(entity => !query.entityId || entity.entityId === query.entityId)
    .filter(entity => lifecycle === "all" || entity.lifecycle === lifecycle)
    .filter(entity => entityType === "all" || entity.entityType === entityType)
    .filter(entity => !query.client || entity.clientName === query.client)
    .filter(entity => !query.owner || entity.ownerName === query.owner)
    .filter(entity => !search || [entity.entityName, entity.clientName, entity.dealId, entity.ownerName, String(entity.entityId)].some(value => String(value ?? "").toLocaleLowerCase("es-CL").includes(search)))
    .filter(entity => requirementCode === "all" || entity.requirements.some(requirement => requirement.code === requirementCode && requirement.status !== "compliant"))
    .filter(entity => matchesStatus(entity, coverageStatus))
    .sort((left, right) => {
      const priority = (entity: CanonicalDocumentEntity) => entity.lifecycle === "open"
        ? entity.coverage.missing * 100 + entity.coverage.rejected * 90 + entity.coverage.expired * 80 + entity.coverage.pendingValidation * 50 + entity.coverage.unconfirmed * 30
        : entity.blockers.length * 10;
      return priority(right) - priority(left) || left.entityName.localeCompare(right.entityName, "es-CL");
    });
}

export async function loadDocumentGovernancePortfolio(query: DocumentGovernancePortfolioQuery, database?: any) {
  const db = database ?? await getDb();
  if (!db) throw new Error("Base de datos no disponible");
  const cutoffAt = query.cutoffAt && /^\d{4}-\d{2}-\d{2}$/.test(query.cutoffAt) ? query.cutoffAt : new Date().toISOString().slice(0, 10);
  const pageSize = Math.min(100, Math.max(10, Math.trunc(query.pageSize ?? 20)));
  const page = Math.max(1, Math.trunc(query.page ?? 1));

  const [projectRows, serviceRows, userRows, artifacts, decisions, resolutions, snapshots, supplementarySource] = await Promise.all([
    db.select().from(projects),
    db.select().from(recurringServices),
    db.select({ id: users.id, name: users.name }).from(users),
    db.select().from(documentArtifacts),
    db.select().from(documentValidationDecisions),
    db.select().from(documentRequirementResolutions),
    db.select().from(documentWorkPlanSnapshots),
    loadDocumentCoveragePortfolio({ lifecycle: "all", entityType: "all", coverageStatus: "all", page: 1, pageSize: 100, cutoffAt }, db),
  ]);

  const ownerById = new Map<number, string>(userRows.map((row: any) => [Number(row.id), String(row.name)]));
  const artifactsByProject = groupBy(artifacts.filter((row: any) => row.entityType === "project"), (row: any) => Number(row.entityId));
  const artifactsByService = groupBy(artifacts.filter((row: any) => row.entityType === "recurring_service"), (row: any) => Number(row.entityId));
  const decisionsByArtifact = groupBy(decisions, (row: any) => Number(row.artifactId));
  const resolutionsByProject = groupBy(resolutions.filter((row: any) => row.entityType === "project"), (row: any) => Number(row.entityId));
  const resolutionsByService = groupBy(resolutions.filter((row: any) => row.entityType === "recurring_service"), (row: any) => Number(row.entityId));
  const snapshotsByArtifact = groupBy(snapshots, (row: any) => Number(row.artifactId));
  const supplementaryByEntity = new Map<string, SupplementaryPortfolio["items"][number]>(supplementarySource.items.map(item => [`${item.entityType}:${item.entityId}`, item]));

  const assembleContext = (entityArtifacts: any[]) => ({
    artifacts: entityArtifacts,
    decisions: entityArtifacts.flatMap(artifact => decisionsByArtifact.get(Number(artifact.id)) ?? []),
    workPlanSnapshots: entityArtifacts.flatMap(artifact => snapshotsByArtifact.get(Number(artifact.id)) ?? []),
  });

  const canonical: DocumentGovernancePortfolioEntity[] = [
    ...projectRows.map((project: any) => {
      const lifecycle = resolveDocumentLifecycle(project.status);
      const context = assembleContext(artifactsByProject.get(Number(project.id)) ?? []);
      return buildCanonicalDocumentEntity({
        entityType: "project",
        entityId: Number(project.id),
        entityName: String(project.projectName),
        clientName: String(project.clientName),
        dealId: project.dealId,
        ownerName: project.pmId ? ownerById.get(Number(project.pmId)) ?? null : null,
        lifecycle: lifecycle.lifecycle,
        lifecycleLabel: lifecycle.label,
        cutoffAt,
        ...context,
        resolutions: resolutionsByProject.get(Number(project.id)) ?? [],
      });
    }),
    ...serviceRows.map((service: any) => {
      const lifecycle = resolveDocumentLifecycle(service.status);
      const context = assembleContext(artifactsByService.get(Number(service.id)) ?? []);
      return buildCanonicalDocumentEntity({
        entityType: "recurring_service",
        entityId: Number(service.id),
        entityName: String(service.serviceName),
        clientName: String(service.clientName),
        dealId: service.dealId,
        ownerName: service.pmId ? ownerById.get(Number(service.pmId)) ?? null : null,
        lifecycle: lifecycle.lifecycle,
        lifecycleLabel: lifecycle.label,
        cutoffAt,
        ...context,
        resolutions: resolutionsByService.get(Number(service.id)) ?? [],
      });
    }),
  ].map(entity => {
    const supplementary = supplementaryByEntity.get(`${entity.entityType}:${entity.entityId}`);
    return {
      ...entity,
      supplementaryRequirements: (supplementary?.requirements ?? []).filter(requirement => SUPPLEMENTARY_REQUIREMENT_KINDS.has(requirement.kind)),
      supplementaryCounters: supplementary?.counters ?? { closedMilestonesWithoutAcceptance: 0, overdueServiceReports: 0 },
    };
  });

  const filtered = filterDocumentGovernanceEntities(canonical, query);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;

  return {
    policyVersion: "2026-09-26.v1",
    cutoffAt,
    summary: summarizeCanonicalDocumentPortfolio(filtered),
    items: filtered.slice(offset, offset + pageSize),
    pagination: { page: safePage, pageSize, total: filtered.length, totalPages },
    options: {
      clients: uniqueSorted(canonical.map(entity => entity.clientName)),
      owners: uniqueSorted(canonical.map(entity => entity.ownerName)),
    },
    quality: {
      orphanSowCount: supplementarySource.quality.orphanSowCount,
      canonicalArtifacts: artifacts.length,
      pendingDecisions: decisions.filter((decision: any) => decision.decision === "pending").length,
      validDecisions: decisions.filter((decision: any) => decision.decision === "valid").length,
      note: "La cobertura base usa sólo el expediente canónico; actas, minutas, recuperación, cierre y reportes periódicos permanecen como controles complementarios.",
    },
  };
}
