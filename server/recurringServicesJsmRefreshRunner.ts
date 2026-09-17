import type { Request, Response } from "express";
import { createAuditLog, getAdminSettingValue, getAuditLogs } from "./db";
import {
  getRecurringServiceById,
  listRecurringServices,
  saveRecurringJsmSnapshot,
} from "./recurringServicesDb";
import {
  collectRecurringJsmSnapshot,
  type RecurringJsmSnapshotDraft,
  type SnapshotSource,
} from "./recurringServicesJsmSnapshot";
import { sdk } from "./_core/sdk";

export const RECURRING_JSM_REFRESH_ACTION = "recurring_service_jsm_refresh_run";
export const RECURRING_JSM_TASK_UID_SETTING =
  "recurring_services_jsm_daily_task_uid";
export const RECURRING_JSM_CRON_SETTING =
  "recurring_services_jsm_daily_cron_utc";
export const RECURRING_JSM_DAILY_CRON_UTC = "0 0 6 * * *";
export const RECURRING_JSM_CALLBACK =
  "/api/scheduled/refreshRecurringServicesJsm";
export const MAX_SCHEDULED_RECURRING_SERVICES = 25;

type RefreshService = {
  id: number;
  serviceName: string;
  status: string;
  jsmProjectKey?: string | null;
  jsmServiceDeskId?: string | null;
};

type PersistedSnapshot = {
  id: number;
  capturedAt: Date | string;
  created: boolean;
};

export type RecurringJsmRunStatus = "success" | "partial" | "error" | "skipped";

export type RecurringJsmRefreshResult = {
  serviceId: number;
  serviceName: string;
  status: RecurringJsmSnapshotDraft["status"] | "error";
  errorCode: string | null;
  errorMessage: string | null;
  incidentCount: number | null;
  openIncidentCount: number | null;
  criticalOpenCount: number | null;
  firstResponseCompliancePct: string | null;
  resolutionCompliancePct: string | null;
  snapshotId: number | null;
  created: boolean;
  snapshot?: RecurringJsmSnapshotDraft;
  persisted?: PersistedSnapshot;
};

export type RecurringJsmRefreshOutcome = {
  status: RecurringJsmRunStatus;
  trigger: SnapshotSource;
  operationId: string;
  startedAt: string;
  completedAt: string;
  candidateCount: number;
  eligibleCount: number;
  processedCount: number;
  deferredCount: number;
  skippedCount: number;
  successCount: number;
  partialCount: number;
  errorCount: number;
  reusedCount: number;
  reused: boolean;
  skippedServices: Array<{
    id: number;
    serviceName: string;
    reason: "inactive" | "jsm_not_configured";
  }>;
  results: RecurringJsmRefreshResult[];
};

type AuditRow = {
  id: number;
  createdAt: Date | string;
  details?: unknown;
};

export interface RecurringJsmRefreshDependencies {
  listServices(): Promise<RefreshService[]>;
  collect(input: {
    service: {
      id: number;
      jsmProjectKey?: string | null;
      jsmServiceDeskId?: string | null;
    };
    source: SnapshotSource;
    triggeredBy?: number | null;
    capturedAt?: Date;
  }): Promise<RecurringJsmSnapshotDraft>;
  persist(snapshot: RecurringJsmSnapshotDraft): Promise<PersistedSnapshot>;
  createAudit(input: Parameters<typeof createAuditLog>[0]): Promise<void>;
  findRun(operationId: string): Promise<RecurringJsmRefreshOutcome | null>;
  now(): Date;
}

function sanitizedMessage(error: unknown, maxLength = 500): string {
  const value = error instanceof Error ? error.message : String(error);
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function dailyOperationId(now: Date): string {
  return `scheduled:${now.toISOString().slice(0, 10)}`;
}

function manualOperationId(now: Date, actorId: number | null): string {
  return `manual:${now.toISOString()}:${actorId ?? "system"}`;
}

function runStatus(
  successCount: number,
  partialCount: number,
  errorCount: number,
  processedCount: number
): RecurringJsmRunStatus {
  if (processedCount === 0) return "skipped";
  if (errorCount === processedCount) return "error";
  if (partialCount > 0 || errorCount > 0) return "partial";
  return "success";
}

function parseAuditDetails(details: unknown): Record<string, any> | null {
  if (details && typeof details === "object")
    return details as Record<string, any>;
  if (typeof details !== "string") return null;
  try {
    const parsed = JSON.parse(details);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function outcomeFromAudit(row: AuditRow): RecurringJsmRefreshOutcome | null {
  const details = parseAuditDetails(row.details);
  if (!details?.operationId || !details?.trigger) return null;
  return {
    status: details.status ?? "partial",
    trigger: details.trigger,
    operationId: details.operationId,
    startedAt: details.startedAt ?? new Date(row.createdAt).toISOString(),
    completedAt: details.completedAt ?? new Date(row.createdAt).toISOString(),
    candidateCount: Number(details.candidateCount ?? 0),
    eligibleCount: Number(details.eligibleCount ?? 0),
    processedCount: Number(details.processedCount ?? 0),
    deferredCount: Number(details.deferredCount ?? 0),
    skippedCount: Number(details.skippedCount ?? 0),
    successCount: Number(details.successCount ?? 0),
    partialCount: Number(details.partialCount ?? 0),
    errorCount: Number(details.errorCount ?? 0),
    reusedCount: Number(details.reusedCount ?? 0),
    reused: true,
    skippedServices: Array.isArray(details.skippedServices)
      ? details.skippedServices
      : [],
    results: Array.isArray(details.results) ? details.results : [],
  };
}

async function findProductionRun(
  operationId: string
): Promise<RecurringJsmRefreshOutcome | null> {
  const history = await getAuditLogs({
    action: RECURRING_JSM_REFRESH_ACTION,
    entity: "recurring_service_portfolio",
    page: 1,
    pageSize: 100,
  });
  for (const row of history.logs as AuditRow[]) {
    const outcome = outcomeFromAudit(row);
    if (outcome?.operationId === operationId) return outcome;
  }
  return null;
}

export async function runRecurringServicesJsmRefresh(
  input: {
    trigger: SnapshotSource;
    actor?: { id: number | null; name: string; role: string };
    serviceIds?: number[];
    includeRequestedWithoutJsm?: boolean;
    operationId?: string;
    maxServices?: number;
  },
  dependencies: RecurringJsmRefreshDependencies
): Promise<RecurringJsmRefreshOutcome> {
  const startedAt = dependencies.now();
  const operationId =
    input.operationId ??
    (input.trigger === "scheduled"
      ? dailyOperationId(startedAt)
      : manualOperationId(startedAt, input.actor?.id ?? null));

  if (input.trigger === "scheduled") {
    const previous = await dependencies.findRun(operationId);
    if (previous)
      return {
        ...previous,
        reused: true,
        reusedCount: previous.processedCount,
      };
  }

  const services = await dependencies.listServices();
  const requestedIds = input.serviceIds ? new Set(input.serviceIds) : null;
  const selected = services.filter(
    service => !requestedIds || requestedIds.has(service.id)
  );
  const active = selected.filter(
    service =>
      service.status === "activo" || Boolean(input.includeRequestedWithoutJsm)
  );
  const inactive = selected.filter(
    service => service.status !== "activo" && !input.includeRequestedWithoutJsm
  );
  const configured = active.filter(service =>
    Boolean(service.jsmProjectKey && service.jsmServiceDeskId)
  );
  const unconfigured = active.filter(
    service => !(service.jsmProjectKey && service.jsmServiceDeskId)
  );
  const candidates = input.includeRequestedWithoutJsm
    ? [...configured, ...unconfigured]
    : configured;
  const limit = Math.max(1, input.maxServices ?? (candidates.length || 1));
  const eligible = candidates.slice(0, limit);
  const deferredCount = Math.max(0, candidates.length - eligible.length);
  const skippedServices = [
    ...inactive.map(service => ({
      id: service.id,
      serviceName: service.serviceName,
      reason: "inactive" as const,
    })),
    ...(!input.includeRequestedWithoutJsm
      ? unconfigured.map(service => ({
          id: service.id,
          serviceName: service.serviceName,
          reason: "jsm_not_configured" as const,
        }))
      : []),
  ];
  const results: RecurringJsmRefreshResult[] = [];

  for (const service of eligible) {
    try {
      const snapshot = await dependencies.collect({
        service: {
          id: service.id,
          jsmProjectKey: service.jsmProjectKey,
          jsmServiceDeskId: service.jsmServiceDeskId,
        },
        source: input.trigger,
        triggeredBy: input.actor?.id ?? null,
        capturedAt: startedAt,
      });
      const persisted = await dependencies.persist(snapshot);
      results.push({
        serviceId: service.id,
        serviceName: service.serviceName,
        status: snapshot.status,
        errorCode: snapshot.errorCode,
        errorMessage: snapshot.errorMessage
          ? sanitizedMessage(snapshot.errorMessage)
          : null,
        incidentCount: snapshot.incidentCount,
        openIncidentCount: snapshot.openIncidentCount,
        criticalOpenCount: snapshot.criticalOpenCount,
        firstResponseCompliancePct: snapshot.firstResponseCompliancePct,
        resolutionCompliancePct: snapshot.resolutionCompliancePct,
        snapshotId: persisted.id,
        created: persisted.created,
        snapshot,
        persisted,
      });
    } catch (error) {
      results.push({
        serviceId: service.id,
        serviceName: service.serviceName,
        status: "error",
        errorCode: "JSM_REFRESH_FAILED",
        errorMessage: sanitizedMessage(error),
        incidentCount: null,
        openIncidentCount: null,
        criticalOpenCount: null,
        firstResponseCompliancePct: null,
        resolutionCompliancePct: null,
        snapshotId: null,
        created: false,
      });
    }
  }

  const successCount = results.filter(
    result => result.status === "success"
  ).length;
  const partialCount = results.filter(
    result => result.status === "partial"
  ).length;
  const errorCount = results.filter(result => result.status === "error").length;
  const notConfiguredCount = results.filter(
    result => result.status === "not_configured"
  ).length;
  const completedAt = dependencies.now();
  const outcome: RecurringJsmRefreshOutcome = {
    status: runStatus(
      successCount,
      partialCount,
      errorCount,
      results.length - notConfiguredCount
    ),
    trigger: input.trigger,
    operationId,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    candidateCount: selected.length,
    eligibleCount: configured.length,
    processedCount: results.length,
    deferredCount,
    skippedCount: skippedServices.length + notConfiguredCount,
    successCount,
    partialCount,
    errorCount,
    reusedCount: results.filter(
      result => result.created === false && result.snapshotId !== null
    ).length,
    reused: false,
    skippedServices,
    results,
  };

  await dependencies.createAudit({
    action: RECURRING_JSM_REFRESH_ACTION,
    entity: "recurring_service_portfolio",
    entityName: "Dashboard recurrente V2",
    userId: input.actor?.id ?? null,
    userName:
      input.actor?.name ??
      (input.trigger === "scheduled" ? "Actualización JSM diaria" : "Sistema"),
    userRole:
      input.actor?.role ?? (input.trigger === "scheduled" ? "cron" : "system"),
    details: {
      ...outcome,
      results: results.map(result => ({
        serviceId: result.serviceId,
        serviceName: result.serviceName,
        status: result.status,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        snapshotId: result.snapshotId,
        created: result.created,
      })),
    },
  });

  return outcome;
}

const PRODUCTION_DEPENDENCIES: RecurringJsmRefreshDependencies = {
  listServices: () => listRecurringServices() as Promise<RefreshService[]>,
  collect: collectRecurringJsmSnapshot,
  persist: saveRecurringJsmSnapshot,
  createAudit: createAuditLog,
  findRun: findProductionRun,
  now: () => new Date(),
};

export function runProductionRecurringServicesJsmRefresh(input: {
  trigger: SnapshotSource;
  actor?: { id: number | null; name: string; role: string };
  serviceIds?: number[];
  includeRequestedWithoutJsm?: boolean;
  operationId?: string;
  maxServices?: number;
}) {
  return runRecurringServicesJsmRefresh(input, PRODUCTION_DEPENDENCIES);
}

export async function listRecurringServicesJsmRefreshHistory(input: {
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(50, Math.max(1, input.limit ?? 10));
  const history = await getAuditLogs({
    action: RECURRING_JSM_REFRESH_ACTION,
    entity: "recurring_service_portfolio",
    page,
    pageSize: limit,
  });
  return {
    page,
    limit,
    total: history.total,
    runs: (history.logs as AuditRow[]).flatMap(row => {
      const outcome = outcomeFromAudit(row);
      if (!outcome) return [];
      return [
        {
          id: row.id,
          trigger: outcome.trigger,
          status: outcome.status,
          operationId: outcome.operationId,
          startedAt: outcome.startedAt,
          completedAt: outcome.completedAt,
          candidateCount: outcome.candidateCount,
          eligibleCount: outcome.eligibleCount,
          processedCount: outcome.processedCount,
          deferredCount: outcome.deferredCount,
          skippedCount: outcome.skippedCount,
          successCount: outcome.successCount,
          partialCount: outcome.partialCount,
          errorCount: outcome.errorCount,
          reusedCount: outcome.reusedCount,
          errors: outcome.results
            .filter(
              result => result.status === "error" || result.status === "partial"
            )
            .map(result => ({
              serviceId: result.serviceId,
              serviceName: result.serviceName,
              status: result.status,
              errorCode: result.errorCode,
              errorMessage: result.errorMessage,
            })),
        },
      ];
    }),
  };
}

export async function runScheduledRecurringServicesJsmRefresh(
  input: { taskUid: string },
  dependencies: {
    getSetting(key: string): Promise<string | null>;
    run(input: {
      trigger: "scheduled";
      operationId: string;
      maxServices: number;
    }): Promise<RecurringJsmRefreshOutcome>;
    now(): Date;
  }
) {
  const configuredTaskUid = await dependencies.getSetting(
    RECURRING_JSM_TASK_UID_SETTING
  );
  if (!configuredTaskUid || configuredTaskUid !== input.taskUid) {
    return { status: "skipped" as const, skipped: "orphan" as const };
  }
  const now = dependencies.now();
  return dependencies.run({
    trigger: "scheduled",
    operationId: dailyOperationId(now),
    maxServices: MAX_SCHEDULED_RECURRING_SERVICES,
  });
}

export function runProductionScheduledRecurringServicesJsmRefresh(input: {
  taskUid: string;
}) {
  return runScheduledRecurringServicesJsmRefresh(input, {
    getSetting: getAdminSettingValue,
    run: runProductionRecurringServicesJsmRefresh,
    now: () => new Date(),
  });
}

export function createScheduledRecurringServicesJsmHandler(dependencies: {
  authenticateRequest(
    req: Request
  ): Promise<{ isCron?: boolean; taskUid?: string | null }>;
  run(input: { taskUid: string }): Promise<Record<string, unknown>>;
  now(): Date;
}) {
  return async (req: Request, res: Response) => {
    let user: { isCron?: boolean; taskUid?: string | null };
    try {
      user = await dependencies.authenticateRequest(req);
    } catch {
      res
        .status(401)
        .json({ status: "error", error: "Autenticación requerida" });
      return;
    }
    if (!user.isCron || !user.taskUid) {
      res
        .status(403)
        .json({
          status: "error",
          error: "Sólo la tarea programada JSM puede invocar este endpoint",
        });
      return;
    }
    try {
      const outcome = await dependencies.run({ taskUid: user.taskUid });
      res.status(200).json(outcome);
    } catch (error) {
      const message = sanitizedMessage(error, 2000);
      console.error("[RecurringServicesJsmRefresh] scheduled error:", message);
      res.status(500).json({
        status: "error",
        error: message,
        stack: error instanceof Error ? error.stack : undefined,
        context: { url: req.originalUrl, taskUid: user.taskUid },
        timestamp: dependencies.now().toISOString(),
      });
    }
  };
}

export const scheduledRecurringServicesJsmHandler =
  createScheduledRecurringServicesJsmHandler({
    authenticateRequest: req => sdk.authenticateRequest(req),
    run: runProductionScheduledRecurringServicesJsmRefresh,
    now: () => new Date(),
  });

export async function getRecurringServiceForJsmRefresh(serviceId: number) {
  return getRecurringServiceById(serviceId);
}
