import { createHash, randomUUID } from "node:crypto";
import type { InsertRecurringServiceJsmSyncRun } from "../drizzle/schema";
import type {
  JsmIssueMappingCategory,
  JsmRecurringSyncExecutionItem,
  JsmRecurringSyncPlan,
  JsmRecurringSyncPlanItem,
  JsmSyncRunStatus,
} from "../shared/jsmExistingSpace";
import {
  createJiraIssue,
  getJiraIssue,
  getJiraProject,
  getJiraProjectIssueTypes,
  getJiraProjectPermissions,
  searchJiraIssues,
  type CreateIssueInput,
  type JiraIssue,
  type JiraProject,
  type JiraProjectIssueType,
  type JiraProjectPermission,
} from "./jiraClient";
import {
  claimJsmSyncRun,
  createOrReuseJsmSyncRun,
  getBillingMonths,
  getJsmSyncRunByRunId,
  getRecurringServiceById,
  getWorkPlanItems,
  linkRecurringItemToExistingJiraIssue,
  listActiveJsmIssueTypeMappings,
  listJsmSyncRuns,
  saveActiveJsmIssueTypeMappings,
  updateJsmSyncRun,
} from "./recurringServicesDb";

export type JsmSyncActor = { id: number; name: string };

type RecurringServiceForSync = NonNullable<
  Awaited<ReturnType<typeof getRecurringServiceById>>
>;
type WorkPlanItem = Awaited<ReturnType<typeof getWorkPlanItems>>[number];
type BillingMonth = Awaited<ReturnType<typeof getBillingMonths>>[number];
type MappingRow = Awaited<
  ReturnType<typeof listActiveJsmIssueTypeMappings>
>[number];
type SyncRunRow = NonNullable<Awaited<ReturnType<typeof getJsmSyncRunByRunId>>>;

export interface JsmRecurringSyncRepository {
  getService: (serviceId: number) => Promise<RecurringServiceForSync | null>;
  getWorkItems: (serviceId: number) => Promise<WorkPlanItem[]>;
  getBilling: (serviceId: number) => Promise<BillingMonth[]>;
  listMappings: (serviceId: number) => Promise<MappingRow[]>;
  saveMappings: typeof saveActiveJsmIssueTypeMappings;
  getRun: (runId: string) => Promise<SyncRunRow | null>;
  createOrReuseRun: (
    data: InsertRecurringServiceJsmSyncRun
  ) => ReturnType<typeof createOrReuseJsmSyncRun>;
  claimRun: (runId: string) => Promise<boolean>;
  updateRun: (
    runId: string,
    status: JsmSyncRunStatus,
    data?: {
      plan?: unknown;
      result?: unknown;
      errorMessage?: string | null;
      finished?: boolean;
    }
  ) => Promise<SyncRunRow | null>;
  listRuns: (serviceId: number, limit?: number) => Promise<SyncRunRow[]>;
  linkItem: typeof linkRecurringItemToExistingJiraIssue;
}

export interface JsmRecurringSyncDependencies {
  repository: JsmRecurringSyncRepository;
  getProject: (keyOrId: string) => Promise<JiraProject & { issueTypes: any[] }>;
  getPermissions: (
    projectKey: string
  ) => Promise<Record<string, JiraProjectPermission>>;
  getIssueTypes: (projectId: string) => Promise<JiraProjectIssueType[]>;
  findByExternalId: (
    projectKey: string,
    externalId: string
  ) => Promise<JiraIssue[]>;
  getIssue: (issueKey: string) => Promise<JiraIssue>;
  createIssue: (
    input: CreateIssueInput
  ) => Promise<{ id: string; key: string; self: string }>;
  now: () => Date;
  createRunId: () => string;
}

const defaultRepository: JsmRecurringSyncRepository = {
  getService: getRecurringServiceById,
  getWorkItems: getWorkPlanItems,
  getBilling: getBillingMonths,
  listMappings: listActiveJsmIssueTypeMappings,
  saveMappings: saveActiveJsmIssueTypeMappings,
  getRun: getJsmSyncRunByRunId,
  createOrReuseRun: createOrReuseJsmSyncRun,
  claimRun: claimJsmSyncRun,
  updateRun: updateJsmSyncRun,
  listRuns: listJsmSyncRuns,
  linkItem: linkRecurringItemToExistingJiraIssue,
};

const defaultDependencies: JsmRecurringSyncDependencies = {
  repository: defaultRepository,
  getProject: getJiraProject,
  getPermissions: getJiraProjectPermissions,
  getIssueTypes: getJiraProjectIssueTypes,
  findByExternalId: async (projectKey, externalId) => {
    const safeProjectKey = projectKey.replace(/[^A-Za-z0-9_-]/g, "");
    const safeExternalId = externalId.replace(/[^A-Za-z0-9_-]/g, "");
    const result = await searchJiraIssues(
      `project = "${safeProjectKey}" AND labels = "${safeExternalId}" ORDER BY created ASC`,
      {
        maxResults: 10,
        fields: ["summary", "status", "issuetype", "project", "labels"],
      }
    );
    return result.issues;
  },
  getIssue: getJiraIssue,
  createIssue: createJiraIssue,
  now: () => new Date(),
  createRunId: () => `jsm-sync:${randomUUID()}`,
};

export class JsmRecurringSyncError extends Error {
  constructor(
    public readonly code:
      | "SERVICE_NOT_FOUND"
      | "JSM_NOT_LINKED"
      | "INVALID_OPERATION_ID"
      | "INVALID_MAPPING_SELECTION"
      | "MAPPING_NOT_AVAILABLE"
      | "SYNC_RUN_NOT_FOUND"
      | "SYNC_RUN_NOT_READY"
      | "SYNC_ALREADY_RUNNING"
      | "STALE_DRY_RUN"
      | "ISSUE_NOT_IN_PROJECT"
      | "ISSUE_TYPE_MISMATCH",
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "JsmRecurringSyncError";
  }
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)])
    );
  }
  return value;
}

function sha256(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex");
}

function sanitizeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Error desconocido";
  return message.replace(/https?:\/\/\S+/g, "[URL]").slice(0, 500);
}

function validateOperationId(operationId?: string) {
  if (!operationId) return null;
  const normalized = operationId.trim();
  if (!/^[A-Za-z0-9:_-]{8,191}$/.test(normalized)) {
    throw new JsmRecurringSyncError(
      "INVALID_OPERATION_ID",
      "operationId debe tener entre 8 y 191 caracteres y usar solo letras, números, dos puntos, guion o guion bajo."
    );
  }
  return normalized;
}

function dateOnly(value: unknown) {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).split("T")[0];
}

function externalId(
  serviceId: number,
  category: JsmIssueMappingCategory,
  entityId: number
) {
  return `pmo-rs-${serviceId}-${category.replace("_", "-")}-${entityId}`;
}

function normalizedMappings(mappings: MappingRow[]) {
  return mappings
    .map(mapping => ({
      category: mapping.category,
      issueTypeId: String(mapping.issueTypeId),
      issueTypeName: mapping.issueTypeName,
    }))
    .sort((left, right) => left.category.localeCompare(right.category));
}

async function requireService(
  serviceId: number,
  dependencies: JsmRecurringSyncDependencies
) {
  const service = await dependencies.repository.getService(serviceId);
  if (!service) {
    throw new JsmRecurringSyncError(
      "SERVICE_NOT_FOUND",
      "Servicio recurrente no encontrado."
    );
  }
  if (
    service.jsmPlatform !== "prodigio" ||
    !service.jsmProjectId ||
    !service.jsmProjectKey
  ) {
    throw new JsmRecurringSyncError(
      "JSM_NOT_LINKED",
      "El servicio debe tener un Space JSM de Prodigio vinculado antes de configurar o sincronizar issues."
    );
  }
  return service;
}

async function inspectSyncContext(
  serviceId: number,
  dependencies: JsmRecurringSyncDependencies
) {
  const service = await requireService(serviceId, dependencies);
  const [project, permissions, issueTypes, mappings, workItems, billing] =
    await Promise.all([
      dependencies.getProject(service.jsmProjectId!),
      dependencies.getPermissions(service.jsmProjectKey!),
      dependencies.getIssueTypes(service.jsmProjectId!),
      dependencies.repository.listMappings(serviceId),
      dependencies.repository.getWorkItems(serviceId),
      dependencies.repository.getBilling(serviceId),
    ]);
  return {
    service,
    project,
    permissions,
    issueTypes,
    mappings,
    workItems,
    billing,
  };
}

export async function configureJsmIssueTypeMappings(
  input: {
    serviceId: number;
    mappings: Array<{ category: JsmIssueMappingCategory; issueTypeId: string }>;
    actor: JsmSyncActor;
  },
  dependencies: JsmRecurringSyncDependencies = defaultDependencies
) {
  const service = await requireService(input.serviceId, dependencies);
  const categories = input.mappings.map(mapping => mapping.category);
  if (
    input.mappings.length !== 2 ||
    new Set(categories).size !== 2 ||
    !categories.includes("work_plan") ||
    !categories.includes("billing")
  ) {
    throw new JsmRecurringSyncError(
      "INVALID_MAPPING_SELECTION",
      "Debe seleccionar explícitamente un tipo de issue para plan de trabajo y otro para facturación."
    );
  }
  const issueTypes = await dependencies.getIssueTypes(service.jsmProjectId!);
  const available = new Map(
    issueTypes
      .filter(type => !type.subtask)
      .map(type => [String(type.id), type])
  );
  const resolved = input.mappings.map(mapping => {
    const issueType = available.get(String(mapping.issueTypeId));
    if (!issueType) {
      throw new JsmRecurringSyncError(
        "MAPPING_NOT_AVAILABLE",
        `El tipo de issue seleccionado para ${mapping.category === "work_plan" ? "plan de trabajo" : "facturación"} no está disponible en el Space JSM.`
      );
    }
    return {
      category: mapping.category,
      issueTypeId: String(issueType.id),
      issueTypeName: issueType.name,
    };
  });
  return dependencies.repository.saveMappings({
    serviceId: input.serviceId,
    mappings: resolved,
    configuredBy: input.actor.id,
    configuredByName: input.actor.name,
  });
}

async function buildSyncPlan(
  serviceId: number,
  dependencies: JsmRecurringSyncDependencies
): Promise<JsmRecurringSyncPlan> {
  const context = await inspectSyncContext(serviceId, dependencies);
  const mappingByCategory = new Map(
    normalizedMappings(context.mappings).map(mapping => [
      mapping.category,
      mapping,
    ])
  );
  const availableTypeIds = new Set(
    context.issueTypes
      .filter(type => !type.subtask)
      .map(type => String(type.id))
  );
  const blockers: string[] = [];
  if (
    context.project.projectTypeKey !== "service_desk" ||
    context.project.archived === true
  ) {
    blockers.push("El proyecto vinculado no es un Space JSM activo.");
  }
  if (context.permissions.BROWSE_PROJECTS?.havePermission !== true) {
    blockers.push(
      "La cuenta técnica no tiene permiso para consultar el Space JSM."
    );
  }
  if (context.permissions.CREATE_ISSUES?.havePermission !== true) {
    blockers.push(
      "La cuenta técnica no tiene permiso para crear issues en el Space JSM."
    );
  }
  for (const category of ["work_plan", "billing"] as const) {
    const mapping = mappingByCategory.get(category);
    if (!mapping)
      blockers.push(
        `Falta el mapping explícito para ${category === "work_plan" ? "plan de trabajo" : "facturación"}.`
      );
    else if (!availableTypeIds.has(mapping.issueTypeId))
      blockers.push(
        `El tipo de issue configurado para ${category === "work_plan" ? "plan de trabajo" : "facturación"} ya no está disponible.`
      );
  }

  const localItems = [
    ...context.workItems.map(item => ({
      category: "work_plan" as const,
      entityId: item.id,
      title: item.title,
      description: item.description ?? undefined,
      dueDate: dateOnly(item.dueDate),
      jiraIssueKey: item.jiraIssueKey ?? undefined,
    })),
    ...context.billing.map(month => ({
      category: "billing" as const,
      entityId: month.id,
      title: `Facturación Mes ${month.monthNumber} - ${context.service.serviceName}`,
      description: `Cobro mensual #${month.monthNumber}: ${month.amount} ${month.currency}`,
      dueDate: dateOnly(month.dueDate),
      jiraIssueKey: month.jiraIssueKey ?? undefined,
    })),
  ];

  const items: JsmRecurringSyncPlanItem[] = [];
  for (const item of localItems) {
    const mapping = mappingByCategory.get(item.category);
    const id = externalId(serviceId, item.category, item.entityId);
    if (!mapping || blockers.length > 0) {
      items.push({
        ...item,
        externalId: id,
        issueTypeId: mapping?.issueTypeId ?? "",
        issueTypeName: mapping?.issueTypeName ?? "",
        action: "blocked",
        reason: blockers.join(" "),
      });
      continue;
    }
    if (item.jiraIssueKey) {
      try {
        const issue = await dependencies.getIssue(item.jiraIssueKey);
        const projectMatches =
          issue.fields.project?.key?.toUpperCase() ===
          context.service.jsmProjectKey!.toUpperCase();
        const typeMatches = issue.fields.issuetype.id
          ? String(issue.fields.issuetype.id) === mapping.issueTypeId
          : issue.fields.issuetype.name === mapping.issueTypeName;
        items.push(
          projectMatches && typeMatches
            ? { ...item, externalId: id, ...mapping, action: "already_linked" }
            : {
                ...item,
                externalId: id,
                ...mapping,
                action: "blocked",
                reason: !projectMatches
                  ? `El issue ${item.jiraIssueKey} no pertenece al Space JSM vinculado.`
                  : `El issue ${item.jiraIssueKey} no usa el tipo configurado ${mapping.issueTypeName}.`,
              }
        );
      } catch (error) {
        items.push({
          ...item,
          externalId: id,
          ...mapping,
          action: "blocked",
          reason: `No fue posible validar el issue ${item.jiraIssueKey}: ${sanitizeError(error)}`,
        });
      }
      continue;
    }
    try {
      const matches = await dependencies.findByExternalId(
        context.service.jsmProjectKey!,
        id
      );
      if (matches.length > 0) {
        items.push({
          ...item,
          externalId: id,
          ...mapping,
          action: "blocked",
          jiraIssueKey: matches[0].key,
          reason: `Ya existe el issue ${matches[0].key} con el identificador externo. Debe asociarlo explícitamente por clave.`,
        });
      } else {
        items.push({ ...item, externalId: id, ...mapping, action: "create" });
      }
    } catch (error) {
      items.push({
        ...item,
        externalId: id,
        ...mapping,
        action: "blocked",
        reason: `No fue posible comprobar duplicados por identificador externo: ${sanitizeError(error)}`,
      });
    }
  }

  const fingerprint = sha256({
    serviceId,
    projectId: context.service.jsmProjectId,
    projectKey: context.service.jsmProjectKey,
    serviceDeskId: context.service.jsmServiceDeskId,
    mappings: normalizedMappings(context.mappings),
    blockers,
    items: items.map(({ description, dueDate, ...item }) => ({
      ...item,
      description,
      dueDate,
    })),
  });
  const counts = {
    total: items.length,
    toCreate: items.filter(item => item.action === "create").length,
    alreadyLinked: items.filter(item => item.action === "already_linked")
      .length,
    blocked: items.filter(item => item.action === "blocked").length,
  };
  return {
    serviceId,
    projectId: context.service.jsmProjectId!,
    projectKey: context.service.jsmProjectKey!,
    serviceDeskId: context.service.jsmServiceDeskId,
    fingerprint,
    generatedAt: dependencies.now().toISOString(),
    canSync: blockers.length === 0 && counts.blocked === 0,
    counts,
    mappings: normalizedMappings(context.mappings),
    items,
  };
}

export async function dryRunJsmSync(
  input: { serviceId: number; actor: JsmSyncActor; operationId?: string },
  dependencies: JsmRecurringSyncDependencies = defaultDependencies
) {
  const plan = await buildSyncPlan(input.serviceId, dependencies);
  const status: JsmSyncRunStatus = plan.canSync ? "ready" : "blocked";
  const runId =
    validateOperationId(input.operationId) ?? dependencies.createRunId();
  const persisted = await dependencies.repository.createOrReuseRun({
    runId,
    serviceId: input.serviceId,
    status,
    fingerprint: plan.fingerprint,
    projectId: plan.projectId,
    projectKey: plan.projectKey,
    serviceDeskId: plan.serviceDeskId ?? null,
    mappingsSnapshot: plan.mappings,
    plan,
    triggeredBy: input.actor.id,
    triggeredByName: input.actor.name,
    finishedAt: dependencies.now(),
  });
  return {
    runId: persisted.run.runId,
    status: persisted.run.status,
    plan: persisted.run.plan as JsmRecurringSyncPlan,
    reused: persisted.reused,
  };
}

export async function confirmJsmSync(
  input: { serviceId: number; dryRunId: string; actor: JsmSyncActor },
  dependencies: JsmRecurringSyncDependencies = defaultDependencies
) {
  const run = await dependencies.repository.getRun(input.dryRunId);
  if (!run || run.serviceId !== input.serviceId) {
    throw new JsmRecurringSyncError(
      "SYNC_RUN_NOT_FOUND",
      "El dry-run indicado no existe para este servicio."
    );
  }
  if (run.status === "applied" || run.status === "partial") {
    return {
      runId: run.runId,
      status: run.status,
      results: (run.result ?? []) as JsmRecurringSyncExecutionItem[],
      reused: true,
    };
  }
  if (run.status === "applying") {
    throw new JsmRecurringSyncError(
      "SYNC_ALREADY_RUNNING",
      "La sincronización ya está siendo ejecutada."
    );
  }
  if (run.status !== "ready") {
    throw new JsmRecurringSyncError(
      "SYNC_RUN_NOT_READY",
      "El dry-run no está listo para ser confirmado."
    );
  }
  const freshPlan = await buildSyncPlan(input.serviceId, dependencies);
  if (!freshPlan.canSync || freshPlan.fingerprint !== run.fingerprint) {
    await dependencies.repository.updateRun(run.runId, "stale", {
      plan: freshPlan,
      errorMessage:
        "El estado local, los mappings o Jira/JSM cambiaron desde el dry-run.",
      finished: true,
    });
    throw new JsmRecurringSyncError(
      "STALE_DRY_RUN",
      "El dry-run perdió vigencia. Ejecute uno nuevo antes de sincronizar."
    );
  }
  const claimed = await dependencies.repository.claimRun(run.runId);
  if (!claimed) {
    const current = await dependencies.repository.getRun(run.runId);
    if (current?.status === "applied" || current?.status === "partial") {
      return {
        runId: current.runId,
        status: current.status,
        results: (current.result ?? []) as JsmRecurringSyncExecutionItem[],
        reused: true,
      };
    }
    throw new JsmRecurringSyncError(
      "SYNC_ALREADY_RUNNING",
      "La sincronización ya fue tomada por otra ejecución."
    );
  }

  const results: JsmRecurringSyncExecutionItem[] = [];
  for (const item of freshPlan.items) {
    if (item.action === "already_linked") {
      results.push({ ...item, status: "already_linked" });
      continue;
    }
    if (item.action === "blocked") {
      results.push({ ...item, status: "blocked" });
      continue;
    }
    try {
      const created = await dependencies.createIssue({
        projectKey: freshPlan.projectKey,
        summary: item.title,
        description: item.description,
        dueDate: item.dueDate,
        issueTypeId: item.issueTypeId,
        labels: [
          "pmo-recurring",
          `pmo-service-${input.serviceId}`,
          item.externalId,
        ],
      });
      await dependencies.repository.linkItem({
        serviceId: input.serviceId,
        category: item.category,
        entityId: item.entityId,
        jiraIssueKey: created.key,
      });
      results.push({ ...item, jiraIssueKey: created.key, status: "created" });
    } catch (error) {
      results.push({ ...item, status: "error", error: sanitizeError(error) });
    }
  }
  const status: JsmSyncRunStatus = results.some(
    result => result.status === "error" || result.status === "blocked"
  )
    ? "partial"
    : "applied";
  await dependencies.repository.updateRun(run.runId, status, {
    result: results,
    finished: true,
  });
  return { runId: run.runId, status, results, reused: false };
}

export async function associateExistingJiraIssue(
  input: {
    serviceId: number;
    category: JsmIssueMappingCategory;
    entityId: number;
    jiraIssueKey: string;
  },
  dependencies: JsmRecurringSyncDependencies = defaultDependencies
) {
  const service = await requireService(input.serviceId, dependencies);
  const mappings = await dependencies.repository.listMappings(input.serviceId);
  const mapping = mappings.find(
    candidate => candidate.category === input.category
  );
  if (!mapping) {
    throw new JsmRecurringSyncError(
      "INVALID_MAPPING_SELECTION",
      "Configure el mapping de esta categoría antes de asociar un issue."
    );
  }
  const issue = await dependencies.getIssue(
    input.jiraIssueKey.trim().toUpperCase()
  );
  if (
    issue.fields.project?.key?.toUpperCase() !==
    service.jsmProjectKey!.toUpperCase()
  ) {
    throw new JsmRecurringSyncError(
      "ISSUE_NOT_IN_PROJECT",
      "El issue no pertenece al Space JSM vinculado."
    );
  }
  const issueTypeMatches = issue.fields.issuetype.id
    ? String(issue.fields.issuetype.id) === String(mapping.issueTypeId)
    : issue.fields.issuetype.name === mapping.issueTypeName;
  if (!issueTypeMatches) {
    throw new JsmRecurringSyncError(
      "ISSUE_TYPE_MISMATCH",
      `El issue debe usar el tipo configurado ${mapping.issueTypeName}.`
    );
  }
  const linked = await dependencies.repository.linkItem({
    serviceId: input.serviceId,
    category: input.category,
    entityId: input.entityId,
    jiraIssueKey: issue.key,
  });
  return {
    ...linked,
    issue: {
      key: issue.key,
      summary: issue.fields.summary,
      issueType: issue.fields.issuetype.name,
    },
  };
}

export async function getJsmSyncConfiguration(
  serviceId: number,
  limit = 20,
  dependencies: JsmRecurringSyncDependencies = defaultDependencies
) {
  const context = await inspectSyncContext(serviceId, dependencies);
  const runs = await dependencies.repository.listRuns(serviceId, limit);
  const mappings = normalizedMappings(context.mappings);
  return {
    project: {
      id: context.service.jsmProjectId!,
      key: context.service.jsmProjectKey!,
      serviceDeskId: context.service.jsmServiceDeskId,
      name: context.service.jsmProjectName ?? context.project.name,
    },
    issueTypes: context.issueTypes.filter(type => !type.subtask),
    mappings,
    runs,
    readiness: calculateJsmSetupReadiness({
      platform: context.service.jsmPlatform,
      clientPlatformUrl: context.service.jsmClientPlatformUrl,
      projectKey: context.service.jsmProjectKey,
      workItems: context.workItems,
      billing: context.billing,
      mappings,
    }),
  };
}

export function calculateJsmSetupReadiness(input: {
  platform: "prodigio" | "cliente" | null;
  clientPlatformUrl?: string | null;
  projectKey?: string | null;
  workItems: Array<{ jiraIssueKey?: string | null }>;
  billing: Array<{ jiraIssueKey?: string | null }>;
  mappings: Array<{ category: JsmIssueMappingCategory }>;
}) {
  if (input.platform === "cliente") {
    const canClose = Boolean(input.clientPlatformUrl?.trim());
    return {
      canClose,
      blockers: canClose
        ? []
        : ["Debe registrar la URL de la plataforma del cliente."],
      totalApplicable: 0,
      totalUnsynced: 0,
    };
  }
  const blockers: string[] = [];
  if (!input.projectKey) blockers.push("Debe crear o vincular un Space JSM.");
  const categories = new Set(input.mappings.map(mapping => mapping.category));
  if (input.workItems.length > 0 && !categories.has("work_plan"))
    blockers.push("Falta el mapping de plan de trabajo.");
  if (input.billing.length > 0 && !categories.has("billing"))
    blockers.push("Falta el mapping de facturación.");
  const totalApplicable = input.workItems.length + input.billing.length;
  const totalUnsynced =
    input.workItems.filter(item => !item.jiraIssueKey).length +
    input.billing.filter(item => !item.jiraIssueKey).length;
  if (totalApplicable === 0)
    blockers.push("No existen elementos aplicables para sincronizar.");
  if (totalUnsynced > 0)
    blockers.push(`Quedan ${totalUnsynced} elementos sin vincular a Jira.`);
  return {
    canClose: blockers.length === 0,
    blockers,
    totalApplicable,
    totalUnsynced,
  };
}
