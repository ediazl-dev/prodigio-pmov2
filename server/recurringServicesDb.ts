/**
 * DB helpers for Recurring Services module.
 * Follows same patterns as server/db.ts — returns raw Drizzle rows.
 */
import { eq, and, desc, asc } from "drizzle-orm";
import { recurringServices, InsertRecurringService, recurringServiceBillingMonths, InsertRecurringServiceBillingMonth, recurringServiceDocuments, InsertRecurringServiceDocument, recurringServiceDocumentControls, recurringServiceReportEvidence, recurringServiceFinancialEvidence, recurringServiceJsmSnapshots, InsertRecurringServiceJsmSnapshot, recurringServiceStages, recurringServiceWorkPlan, InsertRecurringServiceWorkPlanItem, recurringServiceSlaConfig, InsertRecurringServiceSlaConfigItem, recurringServicePenalties, InsertRecurringServicePenalty, recurringServiceAiAnalyses, InsertRecurringServiceAiAnalysis, recurringServiceJsmLinkRuns, InsertRecurringServiceJsmLinkRun, recurringServiceJsmIssueTypeMappings, InsertRecurringServiceJsmIssueTypeMapping, recurringServiceJsmSyncRuns, InsertRecurringServiceJsmSyncRun, financialData } from "../drizzle/schema";
import type { JsmExistingSpaceSnapshot, JsmLinkHealth, JsmLinkRunStatus, JsmSyncRunStatus } from "../shared/jsmExistingSpace";
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
    public readonly code: "SERVICE_NOT_FOUND" | "SERVICE_ALREADY_LINKED" | "JSM_IDENTITY_CONFLICT" | "RUN_ID_CONFLICT" | "SYNCED_ISSUES_BLOCK_UNLINK" | "SYNC_RUN_ID_CONFLICT" | "SYNC_ITEM_NOT_FOUND" | "SYNC_ITEM_ALREADY_LINKED",
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "RecurringServiceJsmDbError";
  }
}

function sameJsmIdentity(row: ExistingJsmIdentity, identity: ExistingJsmIdentity) {
  return Boolean((identity.serviceDeskId && row.serviceDeskId === identity.serviceDeskId) || (identity.projectId && row.projectId === identity.projectId) || (identity.projectKey && row.projectKey?.toUpperCase() === identity.projectKey.toUpperCase()));
}

function isDuplicateEntryError(error: unknown) {
  const candidate = error as {
    code?: string;
    errno?: number;
    message?: string;
  };
  return candidate?.code === "ER_DUP_ENTRY" || candidate?.errno === 1062 || /duplicate entry/i.test(candidate?.message ?? "");
}

export async function findRecurringServiceJsmOwner(identity: ExistingJsmIdentity, excludeServiceId?: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({
      id: recurringServices.id,
      serviceName: recurringServices.serviceName,
      clientName: recurringServices.clientName,
      jsmProjectId: recurringServices.jsmProjectId,
      jsmProjectKey: recurringServices.jsmProjectKey,
      jsmServiceDeskId: recurringServices.jsmServiceDeskId,
    })
    .from(recurringServices);
  return (
    rows.find(
      row =>
        row.id !== excludeServiceId &&
        sameJsmIdentity(
          {
            projectId: row.jsmProjectId,
            projectKey: row.jsmProjectKey,
            serviceDeskId: row.jsmServiceDeskId,
          },
          identity
        )
    ) ?? null
  );
}

export async function listRecurringServiceJsmOwners() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: recurringServices.id,
      serviceName: recurringServices.serviceName,
      clientName: recurringServices.clientName,
      status: recurringServices.status,
      currentStage: recurringServices.currentStage,
      jsmLinkSource: recurringServices.jsmLinkSource,
      jsmProjectId: recurringServices.jsmProjectId,
      jsmProjectKey: recurringServices.jsmProjectKey,
      jsmProjectName: recurringServices.jsmProjectName,
      jsmServiceDeskId: recurringServices.jsmServiceDeskId,
      jsmAgentUrl: recurringServices.jsmAgentUrl,
      jsmPortalUrl: recurringServices.jsmPortalUrl,
      jsmLinkHealth: recurringServices.jsmLinkHealth,
      jsmLastVerifiedAt: recurringServices.jsmLastVerifiedAt,
      jsmLinkedAt: recurringServices.jsmLinkedAt,
    })
    .from(recurringServices);
  return rows.filter(row => row.jsmProjectId || row.jsmProjectKey || row.jsmServiceDeskId);
}

export async function listActiveJsmIssueTypeMappings(serviceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(recurringServiceJsmIssueTypeMappings)
    .where(and(eq(recurringServiceJsmIssueTypeMappings.serviceId, serviceId), eq(recurringServiceJsmIssueTypeMappings.status, "active")))
    .orderBy(asc(recurringServiceJsmIssueTypeMappings.category));
}

export async function saveActiveJsmIssueTypeMappings(input: { serviceId: number; mappings: Array<Pick<InsertRecurringServiceJsmIssueTypeMapping, "category" | "issueTypeId" | "issueTypeName">>; configuredBy: number; configuredByName: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async tx => {
    const [service] = await tx.select({ id: recurringServices.id }).from(recurringServices).where(eq(recurringServices.id, input.serviceId)).limit(1);
    if (!service) {
      throw new RecurringServiceJsmDbError("SERVICE_NOT_FOUND", "Servicio recurrente no encontrado.");
    }
    for (const mapping of input.mappings) {
      const [existing] = await tx
        .select({ id: recurringServiceJsmIssueTypeMappings.id })
        .from(recurringServiceJsmIssueTypeMappings)
        .where(and(eq(recurringServiceJsmIssueTypeMappings.serviceId, input.serviceId), eq(recurringServiceJsmIssueTypeMappings.category, mapping.category)))
        .limit(1);
      const values = {
        issueTypeId: String(mapping.issueTypeId),
        issueTypeName: mapping.issueTypeName,
        source: "selected" as const,
        status: "active" as const,
        configuredBy: input.configuredBy,
        configuredByName: input.configuredByName,
        configuredAt: new Date(),
      };
      if (existing) {
        await tx.update(recurringServiceJsmIssueTypeMappings).set(values).where(eq(recurringServiceJsmIssueTypeMappings.id, existing.id));
      } else {
        await tx.insert(recurringServiceJsmIssueTypeMappings).values({
          serviceId: input.serviceId,
          category: mapping.category,
          ...values,
        });
      }
    }
  });
  return listActiveJsmIssueTypeMappings(input.serviceId);
}

export async function getJsmSyncRunByRunId(runId: string) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(recurringServiceJsmSyncRuns).where(eq(recurringServiceJsmSyncRuns.runId, runId)).limit(1);
  return row ?? null;
}

export async function getJsmSyncRunByFingerprint(serviceId: number, fingerprint: string) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(recurringServiceJsmSyncRuns)
    .where(and(eq(recurringServiceJsmSyncRuns.serviceId, serviceId), eq(recurringServiceJsmSyncRuns.fingerprint, fingerprint)))
    .limit(1);
  return row ?? null;
}

export async function createOrReuseJsmSyncRun(data: InsertRecurringServiceJsmSyncRun) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existingRunId = await getJsmSyncRunByRunId(data.runId);
  if (existingRunId) {
    if (existingRunId.serviceId !== data.serviceId || existingRunId.fingerprint !== data.fingerprint) {
      throw new RecurringServiceJsmDbError("SYNC_RUN_ID_CONFLICT", "El identificador de dry-run ya fue utilizado para otro servicio o contenido.");
    }
    return { run: existingRunId, reused: true };
  }
  const existingFingerprint = await getJsmSyncRunByFingerprint(data.serviceId, data.fingerprint);
  if (existingFingerprint) return { run: existingFingerprint, reused: true };
  try {
    const [result] = await db.insert(recurringServiceJsmSyncRuns).values(data);
    const [inserted] = await db
      .select()
      .from(recurringServiceJsmSyncRuns)
      .where(eq(recurringServiceJsmSyncRuns.id, Number(result.insertId)))
      .limit(1);
    if (!inserted) throw new Error("No fue posible recuperar el dry-run JSM creado.");
    return { run: inserted, reused: false };
  } catch (error) {
    if (!isDuplicateEntryError(error)) throw error;
    const existing = (await getJsmSyncRunByFingerprint(data.serviceId, data.fingerprint)) ?? (await getJsmSyncRunByRunId(data.runId));
    if (existing && existing.serviceId === data.serviceId && existing.fingerprint === data.fingerprint) {
      return { run: existing, reused: true };
    }
    throw new RecurringServiceJsmDbError("SYNC_RUN_ID_CONFLICT", "El dry-run colisionó con una operación existente y no puede reutilizarse de forma segura.");
  }
}

export async function updateJsmSyncRun(
  runId: string,
  status: JsmSyncRunStatus,
  data: {
    plan?: unknown;
    result?: unknown;
    errorMessage?: string | null;
    finished?: boolean;
  } = {}
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(recurringServiceJsmSyncRuns)
    .set({
      status,
      plan: data.plan,
      result: data.result,
      errorMessage: data.errorMessage ?? null,
      finishedAt: data.finished ? new Date() : null,
    })
    .where(eq(recurringServiceJsmSyncRuns.runId, runId));
  return getJsmSyncRunByRunId(runId);
}

export async function claimJsmSyncRun(runId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db
    .update(recurringServiceJsmSyncRuns)
    .set({
      status: "applying",
      errorMessage: null,
      finishedAt: null,
    })
    .where(and(eq(recurringServiceJsmSyncRuns.runId, runId), eq(recurringServiceJsmSyncRuns.status, "ready")));
  return Number((result as { affectedRows?: number }).affectedRows ?? 0) === 1;
}

export async function listJsmSyncRuns(serviceId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(recurringServiceJsmSyncRuns)
    .where(eq(recurringServiceJsmSyncRuns.serviceId, serviceId))
    .orderBy(desc(recurringServiceJsmSyncRuns.startedAt), desc(recurringServiceJsmSyncRuns.id))
    .limit(Math.min(Math.max(limit, 1), 100));
}

export async function linkRecurringItemToExistingJiraIssue(input: { serviceId: number; category: "work_plan" | "billing"; entityId: number; jiraIssueKey: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async tx => {
    const [workPlanOwner] = await tx.select({ id: recurringServiceWorkPlan.id }).from(recurringServiceWorkPlan).where(eq(recurringServiceWorkPlan.jiraIssueKey, input.jiraIssueKey)).limit(1);
    const [billingOwner] = await tx.select({ id: recurringServiceBillingMonths.id }).from(recurringServiceBillingMonths).where(eq(recurringServiceBillingMonths.jiraIssueKey, input.jiraIssueKey)).limit(1);
    const usedByOtherItem = input.category === "work_plan" ? Boolean((workPlanOwner && workPlanOwner.id !== input.entityId) || billingOwner) : Boolean(workPlanOwner || (billingOwner && billingOwner.id !== input.entityId));
    if (usedByOtherItem) {
      throw new RecurringServiceJsmDbError("SYNC_ITEM_ALREADY_LINKED", `El issue ${input.jiraIssueKey} ya está asociado a otro elemento recurrente.`);
    }
    if (input.category === "work_plan") {
      const [item] = await tx
        .select({
          id: recurringServiceWorkPlan.id,
          jiraIssueKey: recurringServiceWorkPlan.jiraIssueKey,
        })
        .from(recurringServiceWorkPlan)
        .where(and(eq(recurringServiceWorkPlan.id, input.entityId), eq(recurringServiceWorkPlan.serviceId, input.serviceId)))
        .limit(1);
      if (!item) {
        throw new RecurringServiceJsmDbError("SYNC_ITEM_NOT_FOUND", "La actividad no pertenece al servicio recurrente indicado.");
      }
      if (item.jiraIssueKey && item.jiraIssueKey !== input.jiraIssueKey) {
        throw new RecurringServiceJsmDbError("SYNC_ITEM_ALREADY_LINKED", `La actividad ya está vinculada al issue ${item.jiraIssueKey}.`);
      }
      if (!item.jiraIssueKey) {
        await tx.update(recurringServiceWorkPlan).set({ jiraIssueKey: input.jiraIssueKey }).where(eq(recurringServiceWorkPlan.id, input.entityId));
      }
      return {
        reused: Boolean(item.jiraIssueKey),
        jiraIssueKey: input.jiraIssueKey,
      };
    }

    const [item] = await tx
      .select({
        id: recurringServiceBillingMonths.id,
        jiraIssueKey: recurringServiceBillingMonths.jiraIssueKey,
      })
      .from(recurringServiceBillingMonths)
      .where(and(eq(recurringServiceBillingMonths.id, input.entityId), eq(recurringServiceBillingMonths.serviceId, input.serviceId)))
      .limit(1);
    if (!item) {
      throw new RecurringServiceJsmDbError("SYNC_ITEM_NOT_FOUND", "El hito de facturación no pertenece al servicio recurrente indicado.");
    }
    if (item.jiraIssueKey && item.jiraIssueKey !== input.jiraIssueKey) {
      throw new RecurringServiceJsmDbError("SYNC_ITEM_ALREADY_LINKED", `El hito de facturación ya está vinculado al issue ${item.jiraIssueKey}.`);
    }
    if (!item.jiraIssueKey) {
      await tx.update(recurringServiceBillingMonths).set({ jiraIssueKey: input.jiraIssueKey }).where(eq(recurringServiceBillingMonths.id, input.entityId));
    }
    return {
      reused: Boolean(item.jiraIssueKey),
      jiraIssueKey: input.jiraIssueKey,
    };
  });
}

export async function listJsmLinkRuns(serviceId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(recurringServiceJsmLinkRuns)
    .where(eq(recurringServiceJsmLinkRuns.serviceId, serviceId))
    .orderBy(desc(recurringServiceJsmLinkRuns.startedAt), desc(recurringServiceJsmLinkRuns.id))
    .limit(Math.min(Math.max(limit, 1), 100));
}

export async function getJsmLinkRunByRunId(runId: string) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(recurringServiceJsmLinkRuns).where(eq(recurringServiceJsmLinkRuns.runId, runId)).limit(1);
  return row ?? null;
}

export async function getJsmLinkRunByFingerprint(serviceId: number, fingerprint: string) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(recurringServiceJsmLinkRuns)
    .where(and(eq(recurringServiceJsmLinkRuns.serviceId, serviceId), eq(recurringServiceJsmLinkRuns.fingerprint, fingerprint)))
    .limit(1);
  return row ?? null;
}

export async function createOrReuseJsmLinkRun(data: InsertRecurringServiceJsmLinkRun) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existingRunId = await getJsmLinkRunByRunId(data.runId);
  if (existingRunId) {
    const sameOperation = existingRunId.serviceId === data.serviceId && existingRunId.source === data.source && existingRunId.candidateServiceDeskId === (data.candidateServiceDeskId ?? null) && existingRunId.candidateProjectId === (data.candidateProjectId ?? null);
    if (!sameOperation) {
      throw new RecurringServiceJsmDbError("RUN_ID_CONFLICT", "El identificador de operación ya fue utilizado para otra acción o candidato JSM.");
    }
    return { run: existingRunId, reused: true };
  }

  if (data.fingerprint) {
    const existing = await getJsmLinkRunByFingerprint(data.serviceId, data.fingerprint);
    if (existing) return { run: existing, reused: true };
  }

  try {
    const [result] = await db.insert(recurringServiceJsmLinkRuns).values(data);
    const [inserted] = await db
      .select()
      .from(recurringServiceJsmLinkRuns)
      .where(eq(recurringServiceJsmLinkRuns.id, Number(result.insertId)))
      .limit(1);
    if (!inserted) throw new Error("No fue posible recuperar la corrida JSM creada.");
    return { run: inserted, reused: false };
  } catch (error) {
    if (!isDuplicateEntryError(error)) throw error;
    const existing = data.fingerprint ? await getJsmLinkRunByFingerprint(data.serviceId, data.fingerprint) : await getJsmLinkRunByRunId(data.runId);
    if (existing && existing.serviceId === data.serviceId) return { run: existing, reused: true };
    throw new RecurringServiceJsmDbError("RUN_ID_CONFLICT", "La operación JSM colisionó con una corrida existente y no puede reutilizarse de forma segura.");
  }
}

export async function finishJsmLinkRun(
  runId: string,
  status: JsmLinkRunStatus,
  data: {
    checks?: unknown;
    snapshot?: unknown;
    errorMessage?: string | null;
  } = {}
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(recurringServiceJsmLinkRuns)
    .set({
      status,
      checks: data.checks,
      snapshot: data.snapshot,
      errorMessage: data.errorMessage ?? null,
      finishedAt: new Date(),
    })
    .where(eq(recurringServiceJsmLinkRuns.runId, runId));
  return getJsmLinkRunByRunId(runId);
}

export async function linkExistingJsmSpaceLocal(input: { serviceId: number; snapshot: JsmExistingSpaceSnapshot; linkedBy: number; health: JsmLinkHealth }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    return await db.transaction(async tx => {
      const [service] = await tx.select().from(recurringServices).where(eq(recurringServices.id, input.serviceId)).limit(1);
      if (!service) {
        throw new RecurringServiceJsmDbError("SERVICE_NOT_FOUND", "Servicio recurrente no encontrado.");
      }

      const identity: ExistingJsmIdentity = {
        projectId: input.snapshot.projectId,
        projectKey: input.snapshot.projectKey,
        serviceDeskId: input.snapshot.serviceDeskId,
      };
      const allServices = await tx
        .select({
          id: recurringServices.id,
          serviceName: recurringServices.serviceName,
          jsmProjectId: recurringServices.jsmProjectId,
          jsmProjectKey: recurringServices.jsmProjectKey,
          jsmServiceDeskId: recurringServices.jsmServiceDeskId,
        })
        .from(recurringServices);
      const owner = allServices.find(
        row =>
          row.id !== input.serviceId &&
          sameJsmIdentity(
            {
              projectId: row.jsmProjectId,
              projectKey: row.jsmProjectKey,
              serviceDeskId: row.jsmServiceDeskId,
            },
            identity
          )
      );
      if (owner) {
        throw new RecurringServiceJsmDbError("JSM_IDENTITY_CONFLICT", `El Space JSM ya está vinculado al servicio recurrente ${owner.id}.`, { ownerServiceId: owner.id, ownerServiceName: owner.serviceName });
      }

      const incompatibleCurrentLink = Boolean((service.jsmProjectId && service.jsmProjectId !== input.snapshot.projectId) || (service.jsmProjectKey && service.jsmProjectKey.toUpperCase() !== input.snapshot.projectKey.toUpperCase()) || (service.jsmServiceDeskId && service.jsmServiceDeskId !== input.snapshot.serviceDeskId));
      if (incompatibleCurrentLink) {
        throw new RecurringServiceJsmDbError("SERVICE_ALREADY_LINKED", "El servicio recurrente ya está vinculado a otro Space JSM. Desvincúlelo antes de continuar.");
      }

      const reused = service.jsmProjectId === input.snapshot.projectId && service.jsmProjectKey?.toUpperCase() === input.snapshot.projectKey.toUpperCase() && service.jsmServiceDeskId === input.snapshot.serviceDeskId;
      if (reused) return { reused: true, serviceName: service.serviceName };
      const now = new Date();
      await tx
        .update(recurringServices)
        .set({
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
        })
        .where(eq(recurringServices.id, input.serviceId));

      return { reused, serviceName: service.serviceName };
    });
  } catch (error) {
    if (error instanceof RecurringServiceJsmDbError) throw error;
    if (isDuplicateEntryError(error)) {
      throw new RecurringServiceJsmDbError("JSM_IDENTITY_CONFLICT", "El proyecto Jira o Service Desk ya está vinculado a otro servicio recurrente.");
    }
    throw error;
  }
}

export async function updateExistingJsmVerification(input: { serviceId: number; health: JsmLinkHealth; snapshot?: JsmExistingSpaceSnapshot; updateIdentityMetadata?: boolean }) {
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
    const [service] = await tx.select().from(recurringServices).where(eq(recurringServices.id, serviceId)).limit(1);
    if (!service) {
      throw new RecurringServiceJsmDbError("SERVICE_NOT_FOUND", "Servicio recurrente no encontrado.");
    }

    const [workItems, billingMonths] = await Promise.all([tx.select({ jiraIssueKey: recurringServiceWorkPlan.jiraIssueKey }).from(recurringServiceWorkPlan).where(eq(recurringServiceWorkPlan.serviceId, serviceId)), tx.select({ jiraIssueKey: recurringServiceBillingMonths.jiraIssueKey }).from(recurringServiceBillingMonths).where(eq(recurringServiceBillingMonths.serviceId, serviceId))]);
    const workPlanKeys = workItems.filter(item => Boolean(item.jiraIssueKey)).length;
    const billingKeys = billingMonths.filter(item => Boolean(item.jiraIssueKey)).length;
    if (workPlanKeys + billingKeys > 0) {
      throw new RecurringServiceJsmDbError("SYNCED_ISSUES_BLOCK_UNLINK", "No se puede desvincular mientras existan actividades o hitos de facturación con jiraIssueKey.", { workPlanKeys, billingKeys });
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
      await tx
        .update(recurringServices)
        .set({
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
        })
        .where(eq(recurringServices.id, serviceId));
      await tx
        .update(recurringServiceJsmIssueTypeMappings)
        .set({ status: "superseded" })
        .where(and(eq(recurringServiceJsmIssueTypeMappings.serviceId, serviceId), eq(recurringServiceJsmIssueTypeMappings.status, "active")));
    }
    return {
      reused,
      serviceName: service.serviceName,
      priorIdentity,
      workPlanKeys,
      billingKeys,
    };
  });
}

// ─── Stages ──────────────────────────────────────────────────────────────────

export async function getRecurringServiceStages(serviceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(recurringServiceStages).where(eq(recurringServiceStages.serviceId, serviceId)).orderBy(asc(recurringServiceStages.id));
}

export async function getRecurringServiceStage(serviceId: number, stageId: string) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(recurringServiceStages)
    .where(and(eq(recurringServiceStages.serviceId, serviceId), eq(recurringServiceStages.stageId, stageId as any)));
  return row ?? null;
}

export async function completeRecurringStage(serviceId: number, stageId: string, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(recurringServiceStages)
    .set({
      status: "completed" as any,
      completedAt: new Date(),
      completedBy: userId,
    })
    .where(and(eq(recurringServiceStages.serviceId, serviceId), eq(recurringServiceStages.stageId, stageId as any)));

  // Unlock next stage
  const idx = STAGE_ORDER.indexOf(stageId as any);
  if (idx >= 0 && idx < STAGE_ORDER.length - 1) {
    const nextStage = STAGE_ORDER[idx + 1];
    await db
      .update(recurringServiceStages)
      .set({ status: "in_progress" as any })
      .where(and(eq(recurringServiceStages.serviceId, serviceId), eq(recurringServiceStages.stageId, nextStage)));
    await db
      .update(recurringServices)
      .set({ currentStage: nextStage as any })
      .where(eq(recurringServices.id, serviceId));
  }
}

// ─── Billing Months ──────────────────────────────────────────────────────────

export async function getBillingMonths(serviceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(recurringServiceBillingMonths).where(eq(recurringServiceBillingMonths.serviceId, serviceId)).orderBy(asc(recurringServiceBillingMonths.monthNumber));
}

export async function saveBillingMonths(serviceId: number, months: InsertRecurringServiceBillingMonth[]) {
  const db = await getDb();
  if (!db) return;
  await db.delete(recurringServiceBillingMonths).where(eq(recurringServiceBillingMonths.serviceId, serviceId));
  if (months.length > 0) {
    await db.insert(recurringServiceBillingMonths).values(months);
  }
  const total = months.reduce((sum, m) => sum + parseFloat(String(m.amount)), 0);
  await db
    .update(recurringServices)
    .set({ totalContractAmount: String(total) as any })
    .where(eq(recurringServices.id, serviceId));
}

export async function updateBillingMonthStatus(id: number, status: string, invoiceNumber?: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(recurringServiceBillingMonths)
    .set({ status: status as any, invoiceNumber })
    .where(eq(recurringServiceBillingMonths.id, id));
}

export async function updateBillingMonthJiraKey(id: number, jiraIssueKey: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(recurringServiceBillingMonths).set({ jiraIssueKey }).where(eq(recurringServiceBillingMonths.id, id));
}

// ─── Documents ───────────────────────────────────────────────────────────────

export async function getServiceDocuments(serviceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(recurringServiceDocuments).where(eq(recurringServiceDocuments.serviceId, serviceId)).orderBy(desc(recurringServiceDocuments.uploadedAt));
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
  return db.select().from(recurringServiceWorkPlan).where(eq(recurringServiceWorkPlan.serviceId, serviceId)).orderBy(asc(recurringServiceWorkPlan.sortOrder), asc(recurringServiceWorkPlan.monthNumber));
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
  return db.select().from(recurringServiceSlaConfig).where(eq(recurringServiceSlaConfig.serviceId, serviceId)).orderBy(asc(recurringServiceSlaConfig.id));
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
  return db.select().from(recurringServicePenalties).where(eq(recurringServicePenalties.serviceId, serviceId)).orderBy(desc(recurringServicePenalties.createdAt));
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
  await db
    .update(recurringServicePenalties)
    .set({ status: status as any })
    .where(eq(recurringServicePenalties.id, id));
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
  const rows = await db.select().from(recurringServiceAiAnalyses).where(eq(recurringServiceAiAnalyses.serviceId, serviceId)).orderBy(desc(recurringServiceAiAnalyses.createdAt)).limit(1);
  return rows[0] ?? null;
}

export async function getAiAnalysisHistory(serviceId: number, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(recurringServiceAiAnalyses).where(eq(recurringServiceAiAnalyses.serviceId, serviceId)).orderBy(desc(recurringServiceAiAnalyses.createdAt)).limit(limit);
}

// ─── Dashboard KPIs ─────────────────────────────────────────────────────────

export async function getDashboardKpisData() {
  const db = await getDb();
  if (!db) return { services: [], billingMonths: [], slaConfigs: [], penalties: [] };

  const [services, billingMonths, slaConfigs, penalties] = await Promise.all([db.select().from(recurringServices).orderBy(desc(recurringServices.createdAt)), db.select().from(recurringServiceBillingMonths).orderBy(asc(recurringServiceBillingMonths.dueDate)), db.select().from(recurringServiceSlaConfig), db.select().from(recurringServicePenalties)]);

  return { services, billingMonths, slaConfigs, penalties };
}

export async function getRecurringDashboardV2Data() {
  const db = await getDb();
  if (!db) {
    return {
      services: [],
      billingMonths: [],
      workPlanItems: [],
      documents: [],
      documentControls: [],
      reportEvidence: [],
      financialEvidence: [],
      slaConfigs: [],
      jsmSnapshots: [],
      financialReferences: [],
    };
  }

  const [services, billingMonths, workPlanItems, documents, documentControls, reportEvidence, financialEvidence, slaConfigs, jsmSnapshots, financialReferences] = await Promise.all([
    db.select().from(recurringServices).orderBy(desc(recurringServices.createdAt)),
    db.select().from(recurringServiceBillingMonths).orderBy(asc(recurringServiceBillingMonths.dueDate)),
    db.select().from(recurringServiceWorkPlan).orderBy(asc(recurringServiceWorkPlan.dueDate)),
    db.select().from(recurringServiceDocuments),
    db.select().from(recurringServiceDocumentControls),
    db.select().from(recurringServiceReportEvidence).orderBy(asc(recurringServiceReportEvidence.dueDate)),
    db.select().from(recurringServiceFinancialEvidence).orderBy(asc(recurringServiceFinancialEvidence.occurredAt)),
    db.select().from(recurringServiceSlaConfig),
    db.select().from(recurringServiceJsmSnapshots).orderBy(desc(recurringServiceJsmSnapshots.capturedAt)),
    db
      .select({
        id: financialData.id,
        dealId: financialData.dealId,
        clientName: financialData.clientName,
        projectName: financialData.projectName,
        valorVentaUF: financialData.valorVentaUF,
        presupuestoUF: financialData.presupuestoUF,
        utilizadoUF: financialData.utilizadoUF,
        planificadoUF: financialData.planificadoUF,
        proyectadoUF: financialData.proyectadoUF,
        lineaNegocio: financialData.lineaNegocio,
        syncedAt: financialData.syncedAt,
      })
      .from(financialData),
  ]);

  return {
    services,
    billingMonths,
    workPlanItems,
    documents,
    documentControls,
    reportEvidence,
    financialEvidence,
    slaConfigs,
    jsmSnapshots,
    financialReferences,
  };
}

export async function saveRecurringJsmSnapshot(data: InsertRecurringServiceJsmSnapshot) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (data.dataFingerprint) {
    const [existing] = await db
      .select({ id: recurringServiceJsmSnapshots.id, capturedAt: recurringServiceJsmSnapshots.capturedAt })
      .from(recurringServiceJsmSnapshots)
      .where(and(eq(recurringServiceJsmSnapshots.serviceId, data.serviceId), eq(recurringServiceJsmSnapshots.dataFingerprint, data.dataFingerprint)))
      .limit(1);
    if (existing) return { id: existing.id, capturedAt: existing.capturedAt, created: false };
  }

  try {
    const [result] = await db.insert(recurringServiceJsmSnapshots).values(data);
    return { id: Number(result.insertId), capturedAt: data.capturedAt, created: true };
  } catch (error) {
    if (data.dataFingerprint) {
      const [existing] = await db
        .select({ id: recurringServiceJsmSnapshots.id, capturedAt: recurringServiceJsmSnapshots.capturedAt })
        .from(recurringServiceJsmSnapshots)
        .where(and(eq(recurringServiceJsmSnapshots.serviceId, data.serviceId), eq(recurringServiceJsmSnapshots.dataFingerprint, data.dataFingerprint)))
        .limit(1);
      if (existing) return { id: existing.id, capturedAt: existing.capturedAt, created: false };
    }
    throw error;
  }
}
