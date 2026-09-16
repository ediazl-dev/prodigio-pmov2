/**
 * DB helpers for Recurring Services module.
 * Follows same patterns as server/db.ts — returns raw Drizzle rows.
 */
import { eq, and, desc, asc } from "drizzle-orm";
import {
  recurringServices, InsertRecurringService,
  recurringServiceBillingMonths, InsertRecurringServiceBillingMonth,
  recurringServiceDocuments, InsertRecurringServiceDocument,
  recurringServiceStages,
  recurringServiceWorkPlan, InsertRecurringServiceWorkPlanItem,
  recurringServiceSlaConfig, InsertRecurringServiceSlaConfigItem,
  recurringServicePenalties, InsertRecurringServicePenalty,
  recurringServiceAiAnalyses, InsertRecurringServiceAiAnalysis,
  recurringServiceJsmLinkRuns, InsertRecurringServiceJsmLinkRun,
  recurringServiceJsmIssueTypeMappings,
} from "../drizzle/schema";
import type { JsmExistingSpaceSnapshot, JsmLinkHealth, JsmLinkRunStatus } from "../shared/jsmExistingSpace";
import { getDb } from "./db";

// ─── Service CRUD ────────────────────────────────────────────────────────────

const STAGE_ORDER = ["inicializacion", "plan_trabajo", "jira_setup", "ejecucion", "cierre"] as const;

export async function listRecurringServices(filters?: { status?: string; serviceType?: string }) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(recurringServices).orderBy(desc(recurringServices.createdAt));
  let result = rows;
  if (filters?.status) result = result.filter((r: any) => r.status === filters.status);
  if (filters?.serviceType) result = result.filter((r: any) => r.serviceType === filters.serviceType);
  return result;
}

export async function getRecurringServiceById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(recurringServices).where(eq(recurringServices.id, id));
  return row ?? null;
}

export async function createRecurringService(data: InsertRecurringService) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(recurringServices).values(data);
  const serviceId = Number(result.insertId);
  // Create the 5 stage records
  const stages = STAGE_ORDER.map((stageId, idx) => ({
    serviceId,
    stageId: stageId as any,
    status: (idx === 0 ? "in_progress" : "locked") as any,
  }));
  await db.insert(recurringServiceStages).values(stages);
  return serviceId;
}

export async function updateRecurringService(id: number, data: Partial<InsertRecurringService>) {
  const db = await getDb();
  if (!db) return;
  await db.update(recurringServices).set(data).where(eq(recurringServices.id, id));
}

// ─── Existing JSM Space linking ───────────────────────────────────────────────

export type ExistingJsmIdentity = {
  projectId?: string | null;
  projectKey?: string | null;
  serviceDeskId?: string | null;
};

export class RecurringServiceJsmDbError extends Error {
  constructor(
    public readonly code:
      | "SERVICE_NOT_FOUND"
      | "SERVICE_ALREADY_LINKED"
      | "JSM_IDENTITY_CONFLICT"
      | "RUN_ID_CONFLICT"
      | "SYNCED_ISSUES_BLOCK_UNLINK",
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "RecurringServiceJsmDbError";
  }
}

function sameJsmIdentity(row: ExistingJsmIdentity, identity: ExistingJsmIdentity) {
  return Boolean(
    (identity.serviceDeskId && row.serviceDeskId === identity.serviceDeskId)
    || (identity.projectId && row.projectId === identity.projectId)
    || (identity.projectKey && row.projectKey?.toUpperCase() === identity.projectKey.toUpperCase()),
  );
}

function isDuplicateEntryError(error: unknown) {
  const candidate = error as { code?: string; errno?: number; message?: string };
  return candidate?.code === "ER_DUP_ENTRY"
    || candidate?.errno === 1062
    || /duplicate entry/i.test(candidate?.message ?? "");
}

export async function findRecurringServiceJsmOwner(identity: ExistingJsmIdentity, excludeServiceId?: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({
    id: recurringServices.id,
    serviceName: recurringServices.serviceName,
    clientName: recurringServices.clientName,
    jsmProjectId: recurringServices.jsmProjectId,
    jsmProjectKey: recurringServices.jsmProjectKey,
    jsmServiceDeskId: recurringServices.jsmServiceDeskId,
  }).from(recurringServices);
  return rows.find(row => row.id !== excludeServiceId && sameJsmIdentity({
    projectId: row.jsmProjectId,
    projectKey: row.jsmProjectKey,
    serviceDeskId: row.jsmServiceDeskId,
  }, identity)) ?? null;
}

export async function listRecurringServiceJsmOwners() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: recurringServices.id,
    serviceName: recurringServices.serviceName,
    clientName: recurringServices.clientName,
    jsmProjectId: recurringServices.jsmProjectId,
    jsmProjectKey: recurringServices.jsmProjectKey,
    jsmServiceDeskId: recurringServices.jsmServiceDeskId,
    jsmLinkHealth: recurringServices.jsmLinkHealth,
  }).from(recurringServices);
  return rows.filter(row => row.jsmProjectId || row.jsmProjectKey || row.jsmServiceDeskId);
}

export async function listActiveJsmIssueTypeMappings(serviceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(recurringServiceJsmIssueTypeMappings)
    .where(and(
      eq(recurringServiceJsmIssueTypeMappings.serviceId, serviceId),
      eq(recurringServiceJsmIssueTypeMappings.status, "active"),
    ))
    .orderBy(asc(recurringServiceJsmIssueTypeMappings.category));
}

export async function listJsmLinkRuns(serviceId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(recurringServiceJsmLinkRuns)
    .where(eq(recurringServiceJsmLinkRuns.serviceId, serviceId))
    .orderBy(desc(recurringServiceJsmLinkRuns.startedAt), desc(recurringServiceJsmLinkRuns.id))
    .limit(Math.min(Math.max(limit, 1), 100));
}

export async function getJsmLinkRunByRunId(runId: string) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(recurringServiceJsmLinkRuns)
    .where(eq(recurringServiceJsmLinkRuns.runId, runId))
    .limit(1);
  return row ?? null;
}

export async function getJsmLinkRunByFingerprint(serviceId: number, fingerprint: string) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(recurringServiceJsmLinkRuns)
    .where(and(
      eq(recurringServiceJsmLinkRuns.serviceId, serviceId),
      eq(recurringServiceJsmLinkRuns.fingerprint, fingerprint),
    ))
    .limit(1);
  return row ?? null;
}

export async function createOrReuseJsmLinkRun(data: InsertRecurringServiceJsmLinkRun) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existingRunId = await getJsmLinkRunByRunId(data.runId);
  if (existingRunId) {
    const sameOperation = existingRunId.serviceId === data.serviceId
      && existingRunId.source === data.source
      && existingRunId.candidateServiceDeskId === (data.candidateServiceDeskId ?? null)
      && existingRunId.candidateProjectId === (data.candidateProjectId ?? null);
    if (!sameOperation) {
      throw new RecurringServiceJsmDbError(
        "RUN_ID_CONFLICT",
        "El identificador de operación ya fue utilizado para otra acción o candidato JSM.",
      );
    }
    return { run: existingRunId, reused: true };
  }

  if (data.fingerprint) {
    const existing = await getJsmLinkRunByFingerprint(data.serviceId, data.fingerprint);
    if (existing) return { run: existing, reused: true };
  }

  try {
    const [result] = await db.insert(recurringServiceJsmLinkRuns).values(data);
    const [inserted] = await db.select().from(recurringServiceJsmLinkRuns)
      .where(eq(recurringServiceJsmLinkRuns.id, Number(result.insertId)))
      .limit(1);
    if (!inserted) throw new Error("No fue posible recuperar la corrida JSM creada.");
    return { run: inserted, reused: false };
  } catch (error) {
    if (!isDuplicateEntryError(error)) throw error;
    const existing = data.fingerprint
      ? await getJsmLinkRunByFingerprint(data.serviceId, data.fingerprint)
      : await getJsmLinkRunByRunId(data.runId);
    if (existing && existing.serviceId === data.serviceId) return { run: existing, reused: true };
    throw new RecurringServiceJsmDbError(
      "RUN_ID_CONFLICT",
      "La operación JSM colisionó con una corrida existente y no puede reutilizarse de forma segura.",
    );
  }
}

export async function finishJsmLinkRun(
  runId: string,
  status: JsmLinkRunStatus,
  data: { checks?: unknown; snapshot?: unknown; errorMessage?: string | null } = {},
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(recurringServiceJsmLinkRuns).set({
    status,
    checks: data.checks,
    snapshot: data.snapshot,
    errorMessage: data.errorMessage ?? null,
    finishedAt: new Date(),
  }).where(eq(recurringServiceJsmLinkRuns.runId, runId));
  return getJsmLinkRunByRunId(runId);
}

export async function linkExistingJsmSpaceLocal(input: {
  serviceId: number;
  snapshot: JsmExistingSpaceSnapshot;
  linkedBy: number;
  health: JsmLinkHealth;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    return await db.transaction(async tx => {
      const [service] = await tx.select().from(recurringServices)
        .where(eq(recurringServices.id, input.serviceId))
        .limit(1);
      if (!service) {
        throw new RecurringServiceJsmDbError("SERVICE_NOT_FOUND", "Servicio recurrente no encontrado.");
      }

      const identity: ExistingJsmIdentity = {
        projectId: input.snapshot.projectId,
        projectKey: input.snapshot.projectKey,
        serviceDeskId: input.snapshot.serviceDeskId,
      };
      const allServices = await tx.select({
        id: recurringServices.id,
        serviceName: recurringServices.serviceName,
        jsmProjectId: recurringServices.jsmProjectId,
        jsmProjectKey: recurringServices.jsmProjectKey,
        jsmServiceDeskId: recurringServices.jsmServiceDeskId,
      }).from(recurringServices);
      const owner = allServices.find(row => row.id !== input.serviceId && sameJsmIdentity({
        projectId: row.jsmProjectId,
        projectKey: row.jsmProjectKey,
        serviceDeskId: row.jsmServiceDeskId,
      }, identity));
      if (owner) {
        throw new RecurringServiceJsmDbError(
          "JSM_IDENTITY_CONFLICT",
          `El Space JSM ya está vinculado al servicio recurrente ${owner.id}.`,
          { ownerServiceId: owner.id, ownerServiceName: owner.serviceName },
        );
      }

      const incompatibleCurrentLink = Boolean(
        (service.jsmProjectId && service.jsmProjectId !== input.snapshot.projectId)
        || (service.jsmProjectKey && service.jsmProjectKey.toUpperCase() !== input.snapshot.projectKey.toUpperCase())
        || (service.jsmServiceDeskId && service.jsmServiceDeskId !== input.snapshot.serviceDeskId),
      );
      if (incompatibleCurrentLink) {
        throw new RecurringServiceJsmDbError(
          "SERVICE_ALREADY_LINKED",
          "El servicio recurrente ya está vinculado a otro Space JSM. Desvincúlelo antes de continuar.",
        );
      }

      const reused = service.jsmProjectId === input.snapshot.projectId
        && service.jsmProjectKey?.toUpperCase() === input.snapshot.projectKey.toUpperCase()
        && service.jsmServiceDeskId === input.snapshot.serviceDeskId;
      if (reused) return { reused: true, serviceName: service.serviceName };
      const now = new Date();
      await tx.update(recurringServices).set({
        jsmPlatform: "prodigio",
        jsmLinkSource: "linked",
        jsmProjectId: input.snapshot.projectId,
        jsmProjectKey: input.snapshot.projectKey,
        jsmProjectName: input.snapshot.projectName,
        jsmServiceDeskId: input.snapshot.serviceDeskId,
        jsmAgentUrl: input.snapshot.agentUrl,
        jsmPortalUrl: input.snapshot.portalUrl,
        jsmLinkHealth: input.health,
        jsmLastVerifiedAt: now,
        jsmLinkedAt: service.jsmLinkedAt ?? now,
        jsmLinkedBy: service.jsmLinkedBy ?? input.linkedBy,
        jsmClientPlatformUrl: null,
      }).where(eq(recurringServices.id, input.serviceId));

      return { reused, serviceName: service.serviceName };
    });
  } catch (error) {
    if (error instanceof RecurringServiceJsmDbError) throw error;
    if (isDuplicateEntryError(error)) {
      throw new RecurringServiceJsmDbError(
        "JSM_IDENTITY_CONFLICT",
        "El proyecto Jira o Service Desk ya está vinculado a otro servicio recurrente.",
      );
    }
    throw error;
  }
}

export async function updateExistingJsmVerification(input: {
  serviceId: number;
  health: JsmLinkHealth;
  snapshot?: JsmExistingSpaceSnapshot;
  updateIdentityMetadata?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const patch: Partial<InsertRecurringService> = {
    jsmLinkHealth: input.health,
    jsmLastVerifiedAt: new Date(),
  };
  if (input.snapshot && input.updateIdentityMetadata) {
    patch.jsmProjectName = input.snapshot.projectName;
    patch.jsmAgentUrl = input.snapshot.agentUrl;
    patch.jsmPortalUrl = input.snapshot.portalUrl;
  }
  await db.update(recurringServices).set(patch).where(eq(recurringServices.id, input.serviceId));
}

export async function unlinkExistingJsmSpaceLocal(serviceId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async tx => {
    const [service] = await tx.select().from(recurringServices)
      .where(eq(recurringServices.id, serviceId))
      .limit(1);
    if (!service) {
      throw new RecurringServiceJsmDbError("SERVICE_NOT_FOUND", "Servicio recurrente no encontrado.");
    }

    const [workItems, billingMonths] = await Promise.all([
      tx.select({ jiraIssueKey: recurringServiceWorkPlan.jiraIssueKey })
        .from(recurringServiceWorkPlan)
        .where(eq(recurringServiceWorkPlan.serviceId, serviceId)),
      tx.select({ jiraIssueKey: recurringServiceBillingMonths.jiraIssueKey })
        .from(recurringServiceBillingMonths)
        .where(eq(recurringServiceBillingMonths.serviceId, serviceId)),
    ]);
    const workPlanKeys = workItems.filter(item => Boolean(item.jiraIssueKey)).length;
    const billingKeys = billingMonths.filter(item => Boolean(item.jiraIssueKey)).length;
    if (workPlanKeys + billingKeys > 0) {
      throw new RecurringServiceJsmDbError(
        "SYNCED_ISSUES_BLOCK_UNLINK",
        "No se puede desvincular mientras existan actividades o hitos de facturación con jiraIssueKey.",
        { workPlanKeys, billingKeys },
      );
    }

    const priorIdentity = {
      projectId: service.jsmProjectId,
      projectKey: service.jsmProjectKey,
      projectName: service.jsmProjectName,
      serviceDeskId: service.jsmServiceDeskId,
      agentUrl: service.jsmAgentUrl,
      portalUrl: service.jsmPortalUrl,
    };
    const reused = !service.jsmProjectId && !service.jsmProjectKey && !service.jsmServiceDeskId;
    if (!reused) {
      await tx.update(recurringServices).set({
        jsmLinkSource: null,
        jsmProjectKey: null,
        jsmProjectId: null,
        jsmProjectName: null,
        jsmAgentUrl: null,
        jsmPortalUrl: null,
        jsmOrganizationId: null,
        jsmServiceDeskId: null,
        jsmLinkHealth: null,
        jsmLastVerifiedAt: null,
        jsmLinkedAt: null,
        jsmLinkedBy: null,
      }).where(eq(recurringServices.id, serviceId));
      await tx.update(recurringServiceJsmIssueTypeMappings).set({ status: "superseded" })
        .where(and(
          eq(recurringServiceJsmIssueTypeMappings.serviceId, serviceId),
          eq(recurringServiceJsmIssueTypeMappings.status, "active"),
        ));
    }
    return { reused, serviceName: service.serviceName, priorIdentity, workPlanKeys, billingKeys };
  });
}

// ─── Stages ──────────────────────────────────────────────────────────────────

export async function getRecurringServiceStages(serviceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(recurringServiceStages)
    .where(eq(recurringServiceStages.serviceId, serviceId))
    .orderBy(asc(recurringServiceStages.id));
}

export async function getRecurringServiceStage(serviceId: number, stageId: string) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(recurringServiceStages)
    .where(and(eq(recurringServiceStages.serviceId, serviceId), eq(recurringServiceStages.stageId, stageId as any)));
  return row ?? null;
}

export async function completeRecurringStage(serviceId: number, stageId: string, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(recurringServiceStages)
    .set({ status: "completed" as any, completedAt: new Date(), completedBy: userId })
    .where(and(eq(recurringServiceStages.serviceId, serviceId), eq(recurringServiceStages.stageId, stageId as any)));

  // Unlock next stage
  const idx = STAGE_ORDER.indexOf(stageId as any);
  if (idx >= 0 && idx < STAGE_ORDER.length - 1) {
    const nextStage = STAGE_ORDER[idx + 1];
    await db.update(recurringServiceStages)
      .set({ status: "in_progress" as any })
      .where(and(eq(recurringServiceStages.serviceId, serviceId), eq(recurringServiceStages.stageId, nextStage)));
    await db.update(recurringServices).set({ currentStage: nextStage as any }).where(eq(recurringServices.id, serviceId));
  }
}

// ─── Billing Months ──────────────────────────────────────────────────────────

export async function getBillingMonths(serviceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(recurringServiceBillingMonths)
    .where(eq(recurringServiceBillingMonths.serviceId, serviceId))
    .orderBy(asc(recurringServiceBillingMonths.monthNumber));
}

export async function saveBillingMonths(serviceId: number, months: InsertRecurringServiceBillingMonth[]) {
  const db = await getDb();
  if (!db) return;
  await db.delete(recurringServiceBillingMonths).where(eq(recurringServiceBillingMonths.serviceId, serviceId));
  if (months.length > 0) {
    await db.insert(recurringServiceBillingMonths).values(months);
  }
  const total = months.reduce((sum, m) => sum + parseFloat(String(m.amount)), 0);
  await db.update(recurringServices).set({ totalContractAmount: String(total) as any }).where(eq(recurringServices.id, serviceId));
}

export async function updateBillingMonthStatus(id: number, status: string, invoiceNumber?: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(recurringServiceBillingMonths)
    .set({ status: status as any, invoiceNumber })
    .where(eq(recurringServiceBillingMonths.id, id));
}

export async function updateBillingMonthJiraKey(id: number, jiraIssueKey: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(recurringServiceBillingMonths)
    .set({ jiraIssueKey })
    .where(eq(recurringServiceBillingMonths.id, id));
}

// ─── Documents ───────────────────────────────────────────────────────────────

export async function getServiceDocuments(serviceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(recurringServiceDocuments)
    .where(eq(recurringServiceDocuments.serviceId, serviceId))
    .orderBy(desc(recurringServiceDocuments.uploadedAt));
}

export async function insertServiceDocument(data: InsertRecurringServiceDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(recurringServiceDocuments).values(data);
  return Number(result.insertId);
}

export async function deleteServiceDocument(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(recurringServiceDocuments).where(eq(recurringServiceDocuments.id, id));
}

// ─── Work Plan ───────────────────────────────────────────────────────────────

export async function getWorkPlanItems(serviceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(recurringServiceWorkPlan)
    .where(eq(recurringServiceWorkPlan.serviceId, serviceId))
    .orderBy(asc(recurringServiceWorkPlan.sortOrder), asc(recurringServiceWorkPlan.monthNumber));
}

export async function insertWorkPlanItem(data: InsertRecurringServiceWorkPlanItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(recurringServiceWorkPlan).values(data);
  return Number(result.insertId);
}

export async function updateWorkPlanItem(id: number, data: Partial<InsertRecurringServiceWorkPlanItem>) {
  const db = await getDb();
  if (!db) return;
  await db.update(recurringServiceWorkPlan).set(data).where(eq(recurringServiceWorkPlan.id, id));
}

export async function deleteWorkPlanItem(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(recurringServiceWorkPlan).where(eq(recurringServiceWorkPlan.id, id));
}

export async function bulkInsertWorkPlanItems(items: InsertRecurringServiceWorkPlanItem[]) {
  const db = await getDb();
  if (!db || items.length === 0) return;
  await db.insert(recurringServiceWorkPlan).values(items);
}

export async function updateWorkPlanItemJiraKey(id: number, jiraIssueKey: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(recurringServiceWorkPlan).set({ jiraIssueKey }).where(eq(recurringServiceWorkPlan.id, id));
}

// ─── SLA Config ──────────────────────────────────────────────────────────────

export async function getSlaConfig(serviceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(recurringServiceSlaConfig)
    .where(eq(recurringServiceSlaConfig.serviceId, serviceId))
    .orderBy(asc(recurringServiceSlaConfig.id));
}

export async function saveSlaConfig(serviceId: number, items: InsertRecurringServiceSlaConfigItem[]) {
  const db = await getDb();
  if (!db) return;
  await db.delete(recurringServiceSlaConfig).where(eq(recurringServiceSlaConfig.serviceId, serviceId));
  if (items.length > 0) {
    await db.insert(recurringServiceSlaConfig).values(items);
  }
}

// ─── Penalties ───────────────────────────────────────────────────────────────

export async function getPenalties(serviceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(recurringServicePenalties)
    .where(eq(recurringServicePenalties.serviceId, serviceId))
    .orderBy(desc(recurringServicePenalties.createdAt));
}

export async function insertPenalty(data: InsertRecurringServicePenalty) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(recurringServicePenalties).values(data);
  return Number(result.insertId);
}

export async function updatePenaltyJiraKey(id: number, jiraIssueKey: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(recurringServicePenalties).set({ jiraIssueKey }).where(eq(recurringServicePenalties.id, id));
}

export async function updatePenaltyStatus(id: number, status: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(recurringServicePenalties).set({ status: status as any }).where(eq(recurringServicePenalties.id, id));
}

// ─── Bulk delete helpers ─────────────────────────────────────────────────────

export async function deleteAllWorkPlanItems(serviceId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(recurringServiceWorkPlan).where(eq(recurringServiceWorkPlan.serviceId, serviceId));
}

export async function deleteAllSlaConfig(serviceId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(recurringServiceSlaConfig).where(eq(recurringServiceSlaConfig.serviceId, serviceId));
}

// ─── AI Analysis History ────────────────────────────────────────────────────

export async function insertAiAnalysis(data: InsertRecurringServiceAiAnalysis) {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.insert(recurringServiceAiAnalyses).values(data);
  return Number(result.insertId);
}

export async function getLatestAiAnalysis(serviceId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(recurringServiceAiAnalyses)
    .where(eq(recurringServiceAiAnalyses.serviceId, serviceId))
    .orderBy(desc(recurringServiceAiAnalyses.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getAiAnalysisHistory(serviceId: number, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(recurringServiceAiAnalyses)
    .where(eq(recurringServiceAiAnalyses.serviceId, serviceId))
    .orderBy(desc(recurringServiceAiAnalyses.createdAt))
    .limit(limit);
}

// ─── Dashboard KPIs ─────────────────────────────────────────────────────────

export async function getDashboardKpisData() {
  const db = await getDb();
  if (!db) return { services: [], billingMonths: [], slaConfigs: [], penalties: [] };

  const [services, billingMonths, slaConfigs, penalties] = await Promise.all([
    db.select().from(recurringServices).orderBy(desc(recurringServices.createdAt)),
    db.select().from(recurringServiceBillingMonths).orderBy(asc(recurringServiceBillingMonths.dueDate)),
    db.select().from(recurringServiceSlaConfig),
    db.select().from(recurringServicePenalties),
  ]);

  return { services, billingMonths, slaConfigs, penalties };
}
