import { createHash, randomUUID } from "node:crypto";
import type { InsertRecurringServiceJsmLinkRun } from "../drizzle/schema";
import type {
  JsmExistingSpacePreflight,
  JsmExistingSpaceSnapshot,
  JsmLinkHealth,
  JsmLinkRunSource,
  JsmLinkRunStatus,
} from "../shared/jsmExistingSpace";
import {
  buildJsmProjectUrls,
  listJsmServiceDesks,
  type JsmServiceDesk,
} from "./jiraClient";
import { inspectJsmExistingSpace } from "./jsmExistingSpaceService";
import {
  createOrReuseJsmLinkRun,
  findRecurringServiceJsmOwner,
  finishJsmLinkRun,
  getJsmLinkRunByRunId,
  getRecurringServiceById,
  linkExistingJsmSpaceLocal,
  listActiveJsmIssueTypeMappings,
  listJsmLinkRuns,
  listRecurringServiceJsmOwners,
  RecurringServiceJsmDbError,
  unlinkExistingJsmSpaceLocal,
  updateExistingJsmVerification,
} from "./recurringServicesDb";

export type JsmLinkActor = { id: number; name: string };

type RecurringServiceForJsm = NonNullable<
  Awaited<ReturnType<typeof getRecurringServiceById>>
>;
type JsmLinkRunRow = NonNullable<
  Awaited<ReturnType<typeof getJsmLinkRunByRunId>>
>;
type JsmOwner = Awaited<ReturnType<typeof findRecurringServiceJsmOwner>>;

export interface ExistingJsmLinkRepository {
  getService: (serviceId: number) => Promise<RecurringServiceForJsm | null>;
  findOwner: (
    identity: {
      projectId?: string | null;
      projectKey?: string | null;
      serviceDeskId?: string | null;
    },
    excludeServiceId?: number
  ) => Promise<JsmOwner>;
  listOwners: () => ReturnType<typeof listRecurringServiceJsmOwners>;
  listMappings: (
    serviceId: number
  ) => ReturnType<typeof listActiveJsmIssueTypeMappings>;
  listRuns: (
    serviceId: number,
    limit?: number
  ) => ReturnType<typeof listJsmLinkRuns>;
  getRun: (runId: string) => Promise<JsmLinkRunRow | null>;
  createOrReuseRun: (
    data: InsertRecurringServiceJsmLinkRun
  ) => ReturnType<typeof createOrReuseJsmLinkRun>;
  finishRun: (
    runId: string,
    status: JsmLinkRunStatus,
    data?: {
      checks?: unknown;
      snapshot?: unknown;
      errorMessage?: string | null;
    }
  ) => ReturnType<typeof finishJsmLinkRun>;
  linkLocal: typeof linkExistingJsmSpaceLocal;
  updateVerification: typeof updateExistingJsmVerification;
  unlinkLocal: typeof unlinkExistingJsmSpaceLocal;
}

export interface ExistingJsmLinkDependencies {
  repository: ExistingJsmLinkRepository;
  inspect: typeof inspectJsmExistingSpace;
  listServiceDesks: typeof listJsmServiceDesks;
  now: () => Date;
  createRunId: (source: JsmLinkRunSource) => string;
}

const defaultRepository: ExistingJsmLinkRepository = {
  getService: getRecurringServiceById,
  findOwner: findRecurringServiceJsmOwner,
  listOwners: listRecurringServiceJsmOwners,
  listMappings: listActiveJsmIssueTypeMappings,
  listRuns: listJsmLinkRuns,
  getRun: getJsmLinkRunByRunId,
  createOrReuseRun: createOrReuseJsmLinkRun,
  finishRun: finishJsmLinkRun,
  linkLocal: linkExistingJsmSpaceLocal,
  updateVerification: updateExistingJsmVerification,
  unlinkLocal: unlinkExistingJsmSpaceLocal,
};

const defaultDependencies: ExistingJsmLinkDependencies = {
  repository: defaultRepository,
  inspect: inspectJsmExistingSpace,
  listServiceDesks: listJsmServiceDesks,
  now: () => new Date(),
  createRunId: source => `${source}:${randomUUID()}`,
};

export class JsmExistingSpaceRunnerError extends Error {
  constructor(
    public readonly code:
      | "SERVICE_NOT_FOUND"
      | "LINK_NOT_CONFIGURED"
      | "INVALID_OPERATION_ID"
      | "PREFLIGHT_NOT_FOUND"
      | "PREFLIGHT_NOT_LINKABLE"
      | "STALE_PREFLIGHT"
      | "INSPECTION_FAILED",
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "JsmExistingSpaceRunnerError";
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
    throw new JsmExistingSpaceRunnerError(
      "INVALID_OPERATION_ID",
      "operationId debe tener entre 8 y 191 caracteres y usar solo letras, números, dos puntos, guion o guion bajo."
    );
  }
  return normalized;
}

function healthFor(preflight: JsmExistingSpacePreflight): JsmLinkHealth {
  if (!preflight.canLink) return "blocked";
  return preflight.warnings.length > 0 ? "warning" : "healthy";
}

function candidateFingerprint(
  preflight: JsmExistingSpacePreflight,
  mappedIssueTypeIds: string[]
) {
  const snapshot = preflight.snapshot;
  return sha256({
    serviceDeskId: snapshot.serviceDeskId,
    projectId: snapshot.projectId,
    projectKey: snapshot.projectKey.toUpperCase(),
    projectName: snapshot.projectName,
    projectTypeKey: snapshot.projectTypeKey,
    archived: snapshot.archived,
    canBrowseProject: snapshot.canBrowseProject,
    canCreateIssues: snapshot.canCreateIssues,
    issueTypes: [...snapshot.issueTypes]
      .map(issueType => ({ ...issueType, id: String(issueType.id) }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    agentUrl: snapshot.agentUrl,
    portalUrl: snapshot.portalUrl,
    mappedIssueTypeIds: [...mappedIssueTypeIds].map(String).sort(),
  });
}

function runFingerprint(
  source: JsmLinkRunSource,
  serviceId: number,
  candidate: string,
  outcome?: {
    status?: string;
    ownerServiceId?: number | null;
    reference?: string | null;
  }
) {
  return sha256({ source, serviceId, candidate, ...outcome });
}

function checksFor(
  preflight: JsmExistingSpacePreflight,
  candidate: string,
  owner: JsmOwner
) {
  return {
    candidateFingerprint: candidate,
    preflight: {
      status: preflight.status,
      canLink: preflight.canLink,
      blockers: preflight.blockers,
      warnings: preflight.warnings,
    },
    linkedServiceId: owner?.id ?? null,
  };
}

function normalizeOwnership(
  preflight: JsmExistingSpacePreflight,
  owner: JsmOwner,
  serviceId: number,
  currentService: RecurringServiceForJsm
): JsmExistingSpacePreflight {
  if (
    [
      "not_service_desk",
      "archived_or_inactive",
      "identity_changed",
      "service_desk_not_accessible",
    ].includes(preflight.status)
  ) {
    return preflight;
  }
  if (owner && owner.id !== serviceId) {
    return {
      ...preflight,
      status: "linked_to_other_service",
      canLink: false,
      blockers: [
        `El Space JSM ya está vinculado al servicio recurrente ${owner.id}.`,
      ],
    };
  }
  const currentServiceHasLink = Boolean(
    currentService.jsmProjectId ||
      currentService.jsmProjectKey ||
      currentService.jsmServiceDeskId
  );
  const currentLinkMatchesCandidate = Boolean(
    currentService.jsmServiceDeskId === preflight.snapshot.serviceDeskId ||
      currentService.jsmProjectId === preflight.snapshot.projectId ||
      currentService.jsmProjectKey?.toUpperCase() ===
        preflight.snapshot.projectKey.toUpperCase()
  );
  if (currentServiceHasLink && !currentLinkMatchesCandidate) {
    return {
      ...preflight,
      status: "linked_to_other_service",
      canLink: false,
      blockers: [
        "El servicio recurrente ya está vinculado a otro Space JSM. Desvincúlelo antes de continuar.",
      ],
    };
  }
  if (!preflight.snapshot.canCreateIssues) return preflight;
  if (owner?.id === serviceId || currentLinkMatchesCandidate) {
    return {
      ...preflight,
      status: "already_linked_same_service",
      canLink: true,
      blockers: [],
    };
  }
  return preflight;
}

async function inspectCandidate(
  serviceId: number,
  serviceDeskId: string,
  expectedProjectId: string | null | undefined,
  currentService: RecurringServiceForJsm,
  dependencies: ExistingJsmLinkDependencies
) {
  const mappings = await dependencies.repository.listMappings(serviceId);
  const mappedIssueTypeIds = mappings.map(mapping =>
    String(mapping.issueTypeId)
  );
  const inspected = await dependencies.inspect({
    serviceId,
    serviceDeskId,
    expectedProjectId,
    mappedIssueTypeIds,
  });
  const owner = await dependencies.repository.findOwner({
    projectId: inspected.snapshot.projectId,
    projectKey: inspected.snapshot.projectKey,
    serviceDeskId: inspected.snapshot.serviceDeskId,
  });
  const preflight = normalizeOwnership(
    inspected,
    owner,
    serviceId,
    currentService
  );
  return {
    preflight,
    owner,
    mappedIssueTypeIds,
    candidate: candidateFingerprint(preflight, mappedIssueTypeIds),
  };
}

async function requireService(
  serviceId: number,
  dependencies: ExistingJsmLinkDependencies
) {
  const service = await dependencies.repository.getService(serviceId);
  if (!service) {
    throw new JsmExistingSpaceRunnerError(
      "SERVICE_NOT_FOUND",
      "Servicio recurrente no encontrado."
    );
  }
  return service;
}

async function persistInspectionError(
  input: {
    source: JsmLinkRunSource;
    serviceId: number;
    serviceDeskId: string;
    actor: JsmLinkActor;
    operationId?: string;
    error: unknown;
  },
  dependencies: ExistingJsmLinkDependencies
) {
  const errorMessage = sanitizeError(input.error);
  const candidate = sha256({
    serviceId: input.serviceId,
    serviceDeskId: input.serviceDeskId,
    errorMessage,
  });
  const fingerprint = runFingerprint(input.source, input.serviceId, candidate, {
    status: "error",
  });
  const runId =
    validateOperationId(input.operationId) ??
    dependencies.createRunId(input.source);
  const created = await dependencies.repository.createOrReuseRun({
    runId,
    serviceId: input.serviceId,
    source: input.source,
    status: "running",
    candidateServiceDeskId: input.serviceDeskId,
    fingerprint,
    checks: { candidateFingerprint: candidate, error: true },
    errorMessage,
    triggeredBy: input.actor.id,
    triggeredByName: input.actor.name,
  });
  if (!created.reused || created.run.status === "running") {
    await dependencies.repository.finishRun(created.run.runId, "error", {
      checks: { candidateFingerprint: candidate, error: true },
      errorMessage,
    });
  }
  return created.run.runId;
}

export async function listExistingJsmSpaces(
  input: {
    search?: string;
    page?: number;
    pageSize?: number;
    linkStatus?: "all" | "linked" | "available";
    health?: "all" | JsmLinkHealth;
    origin?: "all" | "created" | "linked" | "legacy";
  },
  dependencies: ExistingJsmLinkDependencies = defaultDependencies
) {
  const [serviceDesks, owners] = await Promise.all([
    dependencies.listServiceDesks({ maxItems: 5000 }),
    dependencies.repository.listOwners(),
  ]);
  const search = input.search?.trim().toLocaleLowerCase("es") ?? "";
  const pageSize = Math.min(Math.max(input.pageSize ?? 25, 1), 100);
  const page = Math.max(input.page ?? 1, 1);
  const inventory = serviceDesks.map(serviceDesk => {
    const owner = owners.find(
      candidate =>
        candidate.jsmServiceDeskId === String(serviceDesk.id) ||
        candidate.jsmProjectId === String(serviceDesk.projectId) ||
        candidate.jsmProjectKey?.toUpperCase() ===
          serviceDesk.projectKey.toUpperCase()
    );
    const urls = buildJsmProjectUrls(serviceDesk.projectKey, serviceDesk.id);
    return {
      ...serviceDesk,
      agentUrl: owner?.jsmAgentUrl ?? urls.agentUrl,
      portalUrl: owner?.jsmPortalUrl ?? urls.portalUrl,
      linkStatus: owner ? ("linked" as const) : ("available" as const),
      linkOrigin: owner
        ? (owner.jsmLinkSource ?? "legacy")
        : null,
      linkedService: owner
        ? {
            id: owner.id,
            serviceName: owner.serviceName,
            clientName: owner.clientName,
            status: owner.status,
            currentStage: owner.currentStage,
            health: owner.jsmLinkHealth,
            source: owner.jsmLinkSource,
            linkedAt: owner.jsmLinkedAt,
            lastVerifiedAt: owner.jsmLastVerifiedAt,
          }
        : null,
    };
  });
  const stats = inventory.reduce(
    (result, item) => {
      result.total += 1;
      if (!item.linkedService) {
        result.available += 1;
        return result;
      }
      result.linked += 1;
      const health = item.linkedService.health ?? "pending";
      result[health] += 1;
      const origin = item.linkOrigin ?? "legacy";
      if (origin === "created") result.created += 1;
      else if (origin === "linked") result.linkedExisting += 1;
      else result.legacy += 1;
      return result;
    },
    {
      total: 0,
      linked: 0,
      available: 0,
      pending: 0,
      healthy: 0,
      warning: 0,
      blocked: 0,
      created: 0,
      linkedExisting: 0,
      legacy: 0,
    }
  );
  const filtered = inventory
    .filter(item => {
      const matchesSearch =
        !search ||
        [
          item.projectKey,
          item.projectName,
          item.id,
          item.projectId,
          item.linkedService?.serviceName,
          item.linkedService?.clientName,
        ].some(value =>
          String(value ?? "")
            .toLocaleLowerCase("es")
            .includes(search)
        );
      const matchesLinkStatus =
        !input.linkStatus ||
        input.linkStatus === "all" ||
        item.linkStatus === input.linkStatus;
      const matchesHealth =
        !input.health ||
        input.health === "all" ||
        item.linkedService?.health === input.health ||
        (input.health === "pending" &&
          Boolean(item.linkedService) &&
          !item.linkedService?.health);
      const matchesOrigin =
        !input.origin ||
        input.origin === "all" ||
        item.linkOrigin === input.origin;
      return matchesSearch && matchesLinkStatus && matchesHealth && matchesOrigin;
    })
    .sort((left, right) =>
      left.projectName.localeCompare(right.projectName, "es")
    );
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);
  return {
    items,
    total: filtered.length,
    page,
    pageSize,
    hasMore: start + items.length < filtered.length,
    stats,
  };
}

export async function preflightExistingJsmSpace(
  input: {
    serviceId: number;
    serviceDeskId: string;
    actor: JsmLinkActor;
    operationId?: string;
  },
  dependencies: ExistingJsmLinkDependencies = defaultDependencies
) {
  const service = await requireService(input.serviceId, dependencies);
  try {
    const inspected = await inspectCandidate(
      input.serviceId,
      input.serviceDeskId,
      null,
      service,
      dependencies
    );
    const fingerprint = runFingerprint(
      "preflight",
      input.serviceId,
      inspected.candidate,
      {
        status: inspected.preflight.status,
        ownerServiceId: inspected.owner?.id ?? null,
      }
    );
    const runId =
      validateOperationId(input.operationId) ??
      dependencies.createRunId("preflight");
    const checks = checksFor(
      inspected.preflight,
      inspected.candidate,
      inspected.owner
    );
    const created = await dependencies.repository.createOrReuseRun({
      runId,
      serviceId: input.serviceId,
      source: "preflight",
      status: "running",
      candidateProjectId: inspected.preflight.snapshot.projectId,
      candidateProjectKey: inspected.preflight.snapshot.projectKey,
      candidateProjectName: inspected.preflight.snapshot.projectName,
      candidateServiceDeskId: inspected.preflight.snapshot.serviceDeskId,
      fingerprint,
      checks,
      snapshot: inspected.preflight.snapshot,
      triggeredBy: input.actor.id,
      triggeredByName: input.actor.name,
    });
    const runStatus: JsmLinkRunStatus = inspected.preflight.canLink
      ? "ready"
      : "blocked";
    if (!created.reused || created.run.status === "running") {
      await dependencies.repository.finishRun(created.run.runId, runStatus, {
        checks,
        snapshot: inspected.preflight.snapshot,
      });
    }
    return {
      runId: created.run.runId,
      fingerprint: inspected.candidate,
      preflight: inspected.preflight,
      reused: created.reused,
    };
  } catch (error) {
    if (error instanceof JsmExistingSpaceRunnerError) throw error;
    const runId = await persistInspectionError(
      { ...input, source: "preflight", error },
      dependencies
    );
    throw new JsmExistingSpaceRunnerError(
      "INSPECTION_FAILED",
      "No fue posible completar el preflight de solo lectura del Space JSM.",
      { runId }
    );
  }
}

function readPreflightRun(run: JsmLinkRunRow) {
  const checks = run.checks as {
    candidateFingerprint?: string;
    preflight?: unknown;
  } | null;
  const snapshot = run.snapshot as JsmExistingSpaceSnapshot | null;
  if (
    run.source !== "preflight" ||
    run.status !== "ready" ||
    !checks?.candidateFingerprint ||
    !snapshot
  ) {
    throw new JsmExistingSpaceRunnerError(
      "PREFLIGHT_NOT_LINKABLE",
      "La corrida indicada no corresponde a un preflight vigente y habilitado para vincular."
    );
  }
  return { checks, snapshot };
}

export async function linkExistingJsmSpace(
  input: {
    serviceId: number;
    preflightRunId: string;
    actor: JsmLinkActor;
    operationId?: string;
  },
  dependencies: ExistingJsmLinkDependencies = defaultDependencies
) {
  const service = await requireService(input.serviceId, dependencies);
  const priorRun = await dependencies.repository.getRun(input.preflightRunId);
  if (!priorRun || priorRun.serviceId !== input.serviceId) {
    throw new JsmExistingSpaceRunnerError(
      "PREFLIGHT_NOT_FOUND",
      "No se encontró el preflight indicado para este servicio."
    );
  }
  const prior = readPreflightRun(priorRun);

  let inspected: Awaited<ReturnType<typeof inspectCandidate>>;
  try {
    inspected = await inspectCandidate(
      input.serviceId,
      prior.snapshot.serviceDeskId,
      prior.snapshot.projectId,
      service,
      dependencies
    );
  } catch (error) {
    const runId = await persistInspectionError(
      {
        source: "link",
        serviceId: input.serviceId,
        serviceDeskId: prior.snapshot.serviceDeskId,
        actor: input.actor,
        operationId: input.operationId,
        error,
      },
      dependencies
    );
    throw new JsmExistingSpaceRunnerError(
      "INSPECTION_FAILED",
      "La confirmación no pudo revalidar el Space JSM mediante lecturas seguras.",
      { runId }
    );
  }

  const fingerprint = runFingerprint(
    "link",
    input.serviceId,
    inspected.candidate,
    {
      status: inspected.preflight.status,
      ownerServiceId: inspected.owner?.id ?? null,
      reference: input.preflightRunId,
    }
  );
  const runId =
    validateOperationId(input.operationId) ?? dependencies.createRunId("link");
  const checks = {
    ...checksFor(inspected.preflight, inspected.candidate, inspected.owner),
    preflightRunId: input.preflightRunId,
  };
  const created = await dependencies.repository.createOrReuseRun({
    runId,
    serviceId: input.serviceId,
    source: "link",
    status: "running",
    candidateProjectId: inspected.preflight.snapshot.projectId,
    candidateProjectKey: inspected.preflight.snapshot.projectKey,
    candidateProjectName: inspected.preflight.snapshot.projectName,
    candidateServiceDeskId: inspected.preflight.snapshot.serviceDeskId,
    fingerprint,
    checks,
    snapshot: inspected.preflight.snapshot,
    triggeredBy: input.actor.id,
    triggeredByName: input.actor.name,
  });

  if (created.reused && created.run.status === "linked") {
    return {
      runId: created.run.runId,
      preflight: inspected.preflight,
      linked: true,
      reused: true,
    };
  }
  if (!inspected.preflight.canLink) {
    await dependencies.repository.finishRun(created.run.runId, "blocked", {
      checks,
      snapshot: inspected.preflight.snapshot,
    });
    throw new JsmExistingSpaceRunnerError(
      "PREFLIGHT_NOT_LINKABLE",
      inspected.preflight.blockers[0] ??
        "El Space JSM dejó de cumplir las condiciones de vinculación.",
      { runId: created.run.runId, status: inspected.preflight.status }
    );
  }
  if (inspected.candidate !== prior.checks.candidateFingerprint) {
    await dependencies.repository.finishRun(created.run.runId, "blocked", {
      checks: { ...checks, stalePreflight: true },
      snapshot: inspected.preflight.snapshot,
    });
    throw new JsmExistingSpaceRunnerError(
      "STALE_PREFLIGHT",
      "El diagnóstico cambió desde el preflight. Ejecute un nuevo preflight antes de vincular.",
      { runId: created.run.runId }
    );
  }

  try {
    const linked = await dependencies.repository.linkLocal({
      serviceId: input.serviceId,
      snapshot: inspected.preflight.snapshot,
      linkedBy: input.actor.id,
      health: healthFor(inspected.preflight),
    });
    await dependencies.repository.finishRun(created.run.runId, "linked", {
      checks: { ...checks, localLinkReused: linked.reused },
      snapshot: inspected.preflight.snapshot,
    });
    return {
      runId: created.run.runId,
      preflight: inspected.preflight,
      linked: true,
      reused: created.reused || linked.reused,
    };
  } catch (error) {
    await dependencies.repository.finishRun(
      created.run.runId,
      error instanceof RecurringServiceJsmDbError ? "blocked" : "error",
      {
        checks,
        snapshot: inspected.preflight.snapshot,
        errorMessage: sanitizeError(error),
      }
    );
    throw error;
  }
}

export async function revalidateExistingJsmSpace(
  input: {
    serviceId: number;
    actor: JsmLinkActor;
    operationId?: string;
  },
  dependencies: ExistingJsmLinkDependencies = defaultDependencies
) {
  const service = await requireService(input.serviceId, dependencies);
  if (!service.jsmServiceDeskId || !service.jsmProjectId) {
    throw new JsmExistingSpaceRunnerError(
      "LINK_NOT_CONFIGURED",
      "El servicio no tiene un vínculo JSM completo para revalidar."
    );
  }
  try {
    const inspected = await inspectCandidate(
      input.serviceId,
      service.jsmServiceDeskId,
      service.jsmProjectId,
      service,
      dependencies
    );
    const fingerprint = runFingerprint(
      "revalidate",
      input.serviceId,
      inspected.candidate,
      {
        status: inspected.preflight.status,
        ownerServiceId: inspected.owner?.id ?? null,
      }
    );
    const runId =
      validateOperationId(input.operationId) ??
      dependencies.createRunId("revalidate");
    const checks = checksFor(
      inspected.preflight,
      inspected.candidate,
      inspected.owner
    );
    const created = await dependencies.repository.createOrReuseRun({
      runId,
      serviceId: input.serviceId,
      source: "revalidate",
      status: "running",
      candidateProjectId: inspected.preflight.snapshot.projectId,
      candidateProjectKey: inspected.preflight.snapshot.projectKey,
      candidateProjectName: inspected.preflight.snapshot.projectName,
      candidateServiceDeskId: inspected.preflight.snapshot.serviceDeskId,
      fingerprint,
      checks,
      snapshot: inspected.preflight.snapshot,
      triggeredBy: input.actor.id,
      triggeredByName: input.actor.name,
    });
    const runStatus: JsmLinkRunStatus = inspected.preflight.canLink
      ? "ready"
      : "blocked";
    await dependencies.repository.updateVerification({
      serviceId: input.serviceId,
      health: healthFor(inspected.preflight),
      snapshot: inspected.preflight.snapshot,
      updateIdentityMetadata: inspected.preflight.status !== "identity_changed",
    });
    if (!created.reused || created.run.status === "running") {
      await dependencies.repository.finishRun(created.run.runId, runStatus, {
        checks,
        snapshot: inspected.preflight.snapshot,
      });
    }
    return {
      runId: created.run.runId,
      preflight: inspected.preflight,
      reused: created.reused,
    };
  } catch (error) {
    if (error instanceof JsmExistingSpaceRunnerError) throw error;
    const runId = await persistInspectionError(
      {
        source: "revalidate",
        serviceId: input.serviceId,
        serviceDeskId: service.jsmServiceDeskId,
        actor: input.actor,
        operationId: input.operationId,
        error,
      },
      dependencies
    );
    await dependencies.repository.updateVerification({
      serviceId: input.serviceId,
      health: "blocked",
    });
    throw new JsmExistingSpaceRunnerError(
      "INSPECTION_FAILED",
      "No fue posible revalidar el vínculo JSM mediante lecturas seguras.",
      { runId }
    );
  }
}

export async function getExistingJsmLinkState(
  serviceId: number,
  limit = 20,
  dependencies: ExistingJsmLinkDependencies = defaultDependencies
) {
  const [service, runs, mappings] = await Promise.all([
    requireService(serviceId, dependencies),
    dependencies.repository.listRuns(serviceId, limit),
    dependencies.repository.listMappings(serviceId),
  ]);
  return {
    link: {
      source: service.jsmLinkSource,
      projectId: service.jsmProjectId,
      projectKey: service.jsmProjectKey,
      projectName: service.jsmProjectName,
      serviceDeskId: service.jsmServiceDeskId,
      agentUrl: service.jsmAgentUrl,
      portalUrl: service.jsmPortalUrl,
      health: service.jsmLinkHealth,
      lastVerifiedAt: service.jsmLastVerifiedAt,
      linkedAt: service.jsmLinkedAt,
      linkedBy: service.jsmLinkedBy,
    },
    mappings,
    runs,
  };
}

export async function unlinkExistingJsmSpace(
  input: {
    serviceId: number;
    reason: string;
    actor: JsmLinkActor;
    operationId?: string;
  },
  dependencies: ExistingJsmLinkDependencies = defaultDependencies
) {
  const service = await requireService(input.serviceId, dependencies);
  const identity = {
    projectId: service.jsmProjectId,
    projectKey: service.jsmProjectKey,
    projectName: service.jsmProjectName,
    serviceDeskId: service.jsmServiceDeskId,
    agentUrl: service.jsmAgentUrl,
    portalUrl: service.jsmPortalUrl,
  };
  const candidate = sha256(identity);
  const fingerprint = runFingerprint("unlink", input.serviceId, candidate, {
    reference: input.reason.trim(),
  });
  const runId =
    validateOperationId(input.operationId) ??
    dependencies.createRunId("unlink");
  const checks = {
    reason: input.reason.trim(),
    candidateFingerprint: candidate,
  };
  const created = await dependencies.repository.createOrReuseRun({
    runId,
    serviceId: input.serviceId,
    source: "unlink",
    status: "running",
    candidateProjectId: service.jsmProjectId,
    candidateProjectKey: service.jsmProjectKey,
    candidateProjectName: service.jsmProjectName,
    candidateServiceDeskId: service.jsmServiceDeskId,
    fingerprint,
    checks,
    snapshot: identity,
    triggeredBy: input.actor.id,
    triggeredByName: input.actor.name,
  });
  if (created.reused && created.run.status === "unlinked") {
    return {
      runId: created.run.runId,
      unlinked: true,
      reused: true,
      priorIdentity: identity,
    };
  }
  try {
    const result = await dependencies.repository.unlinkLocal(input.serviceId);
    await dependencies.repository.finishRun(created.run.runId, "unlinked", {
      checks: { ...checks, localUnlinkReused: result.reused },
      snapshot: result.priorIdentity,
    });
    return {
      runId: created.run.runId,
      unlinked: true,
      reused: created.reused || result.reused,
      priorIdentity: result.priorIdentity,
    };
  } catch (error) {
    await dependencies.repository.finishRun(created.run.runId, "blocked", {
      checks,
      snapshot: identity,
      errorMessage: sanitizeError(error),
    });
    throw error;
  }
}

export function createExistingJsmLinkDependencies(
  overrides: Partial<ExistingJsmLinkDependencies> & {
    repository?: Partial<ExistingJsmLinkRepository>;
  } = {}
): ExistingJsmLinkDependencies {
  return {
    ...defaultDependencies,
    ...overrides,
    repository: { ...defaultRepository, ...overrides.repository },
  };
}
