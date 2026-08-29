import { createHash } from "node:crypto";

export type JiraOnboardingStatus = "draft" | "preflight" | "mapping" | "reconciliation" | "ready" | "failed";
export type JiraMappingTarget = "milestone" | "risk" | "epic" | "task" | "user" | "document" | "stage_evidence" | "ignored";
export type JiraSyncSource = "preflight" | "initial_import" | "manual" | "scheduled" | "retry";
export type JiraSyncStatus = "running" | "dry_run" | "applied" | "partial" | "error";

type JsonRecord = Record<string, unknown>;

export interface JiraOnboardingRepository {
  findOnboardingByProjectKey(jiraProjectKey: string): Promise<any | null>;
  createOnboarding(values: Record<string, unknown>): Promise<any>;
  updateOnboarding(id: number, values: Record<string, unknown>): Promise<any>;
  findMappingByKey(mappingKey: string): Promise<any | null>;
  createMapping(values: Record<string, unknown>): Promise<any>;
  updateMapping(id: number, values: Record<string, unknown>): Promise<any>;
  findSyncRunByRunId(runId: string): Promise<any | null>;
  createSyncRun(values: Record<string, unknown>): Promise<any>;
  updateSyncRun(id: number, values: Record<string, unknown>): Promise<any>;
  findExceptionByNaturalKey(input: { onboardingId: number; domain: string; sourceKey: string | null; reason: string }): Promise<any | null>;
  createException(values: Record<string, unknown>): Promise<any>;
  updateException(id: number, values: Record<string, unknown>): Promise<any>;
}

export type JiraOnboardingAuditSink = (event: {
  action: string;
  entity: string;
  entityId?: number | string | null;
  entityName?: string | null;
  userId?: number | null;
  userName?: string | null;
  details?: JsonRecord | null;
}) => Promise<void>;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as JsonRecord)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

export function normalizeJiraProjectKey(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!normalized) throw new Error("La clave del proyecto Jira es obligatoria");
  return normalized;
}

export function fingerprintJiraSnapshot(snapshot: JsonRecord): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(snapshot))).digest("hex");
}

export function buildJiraMappingKey(input: {
  onboardingId: number;
  mappingVersion: number;
  sourceKey: string;
  targetEntityType: JiraMappingTarget;
}): string {
  return `${input.onboardingId}:v${input.mappingVersion}:${input.sourceKey.trim().toUpperCase()}:${input.targetEntityType}`;
}

const ALLOWED_TRANSITIONS: Record<JiraOnboardingStatus, JiraOnboardingStatus[]> = {
  draft: ["draft", "preflight", "failed"],
  preflight: ["preflight", "mapping", "failed"],
  mapping: ["mapping", "reconciliation", "failed"],
  reconciliation: ["reconciliation", "ready", "failed"],
  ready: ["ready"],
  failed: ["failed", "draft", "preflight"],
};

async function auditBestEffort(sink: JiraOnboardingAuditSink | undefined, event: Parameters<JiraOnboardingAuditSink>[0]) {
  if (!sink) return;
  try {
    await sink(event);
  } catch (error) {
    console.error("[JiraOnboarding] No fue posible registrar auditoría:", error);
  }
}

export function createJiraOnboardingService(repository: JiraOnboardingRepository, auditSink?: JiraOnboardingAuditSink) {
  return {
    async startOrResume(input: {
      jiraProjectKey: string;
      jiraProjectId?: string | null;
      jiraProjectName: string;
      sourceSnapshot: JsonRecord;
      identitySnapshot?: JsonRecord | null;
      initiatedBy: number;
      initiatedByName?: string | null;
    }) {
      const jiraProjectKey = normalizeJiraProjectKey(input.jiraProjectKey);
      const sourceFingerprint = fingerprintJiraSnapshot(input.sourceSnapshot);
      const existing = await repository.findOnboardingByProjectKey(jiraProjectKey);
      if (existing) {
        const record = await repository.updateOnboarding(existing.id, {
          jiraProjectId: input.jiraProjectId ?? existing.jiraProjectId ?? null,
          jiraProjectName: input.jiraProjectName,
          sourceSnapshot: input.sourceSnapshot,
          sourceFingerprint,
          identitySnapshot: input.identitySnapshot ?? existing.identitySnapshot ?? null,
          lastError: null,
        });
        await auditBestEffort(auditSink, {
          action: "resume",
          entity: "jira_onboarding",
          entityId: record.id,
          entityName: jiraProjectKey,
          userId: input.initiatedBy,
          userName: input.initiatedByName,
          details: { status: record.status, sourceFingerprint },
        });
        return { record, created: false };
      }

      const record = await repository.createOnboarding({
        jiraProjectKey,
        jiraProjectId: input.jiraProjectId ?? null,
        jiraProjectName: input.jiraProjectName,
        status: "draft",
        currentStep: 1,
        sourceSnapshot: input.sourceSnapshot,
        sourceFingerprint,
        identitySnapshot: input.identitySnapshot ?? null,
        mappingVersion: 1,
        initiatedBy: input.initiatedBy,
        initiatedByName: input.initiatedByName ?? null,
      });
      await auditBestEffort(auditSink, {
        action: "create",
        entity: "jira_onboarding",
        entityId: record.id,
        entityName: jiraProjectKey,
        userId: input.initiatedBy,
        userName: input.initiatedByName,
        details: { status: "draft", sourceFingerprint },
      });
      return { record, created: true };
    },

    async transition(input: {
      onboarding: { id: number; status: JiraOnboardingStatus; jiraProjectKey: string };
      status: JiraOnboardingStatus;
      currentStep: number;
      actorId: number;
      actorName?: string | null;
      lastError?: string | null;
    }) {
      if (!ALLOWED_TRANSITIONS[input.onboarding.status].includes(input.status)) {
        throw new Error(`Transición de onboarding no permitida: ${input.onboarding.status} → ${input.status}`);
      }
      if (!Number.isInteger(input.currentStep) || input.currentStep < 1 || input.currentStep > 7) {
        throw new Error("El paso de onboarding debe estar entre 1 y 7");
      }
      const record = await repository.updateOnboarding(input.onboarding.id, {
        status: input.status,
        currentStep: input.currentStep,
        lastError: input.lastError ?? null,
        activatedAt: input.status === "ready" ? new Date() : undefined,
      });
      await auditBestEffort(auditSink, {
        action: "transition",
        entity: "jira_onboarding",
        entityId: record.id,
        entityName: input.onboarding.jiraProjectKey,
        userId: input.actorId,
        userName: input.actorName,
        details: { from: input.onboarding.status, to: input.status, currentStep: input.currentStep },
      });
      return record;
    },

    async upsertMapping(input: {
      onboardingId: number;
      projectId?: number | null;
      mappingVersion: number;
      sourceKey: string;
      jiraIssueType?: string | null;
      targetEntityType: JiraMappingTarget;
      targetEntityId?: string | null;
      syncDirection?: "jira_to_pmo" | "pmo_to_jira_explicit" | "none";
      status?: "proposed" | "approved" | "excluded" | "superseded";
      metadata?: JsonRecord | null;
      actorId?: number | null;
      actorName?: string | null;
    }) {
      const mappingKey = buildJiraMappingKey(input);
      const existing = await repository.findMappingByKey(mappingKey);
      const values = {
        onboardingId: input.onboardingId,
        projectId: input.projectId ?? null,
        mappingKey,
        mappingVersion: input.mappingVersion,
        sourceKey: input.sourceKey.trim(),
        jiraIssueType: input.jiraIssueType ?? null,
        targetEntityType: input.targetEntityType,
        targetEntityId: input.targetEntityId ?? null,
        syncDirection: input.syncDirection ?? "jira_to_pmo",
        status: input.status ?? "proposed",
        metadata: input.metadata ?? null,
        approvedBy: input.status === "approved" ? input.actorId ?? null : null,
        approvedByName: input.status === "approved" ? input.actorName ?? null : null,
        approvedAt: input.status === "approved" ? new Date() : null,
      };
      const record = existing
        ? await repository.updateMapping(existing.id, values)
        : await repository.createMapping(values);
      await auditBestEffort(auditSink, {
        action: existing ? "update_mapping" : "create_mapping",
        entity: "jira_mapping",
        entityId: record.id,
        entityName: mappingKey,
        userId: input.actorId,
        userName: input.actorName,
        details: { targetEntityType: input.targetEntityType, status: values.status },
      });
      return { record, created: !existing };
    },

    async startSyncRun(input: {
      runId: string;
      onboardingId?: number | null;
      projectId?: number | null;
      jiraProjectKey: string;
      source: JiraSyncSource;
      status?: JiraSyncStatus;
      inputCount?: number;
      details?: JsonRecord | null;
      triggeredBy?: number | null;
      triggeredByName?: string | null;
    }) {
      const existing = await repository.findSyncRunByRunId(input.runId);
      if (existing) return { record: existing, created: false };
      const record = await repository.createSyncRun({
        ...input,
        jiraProjectKey: normalizeJiraProjectKey(input.jiraProjectKey),
        status: input.status ?? "running",
        inputCount: input.inputCount ?? 0,
      });
      return { record, created: true };
    },

    async completeSyncRun(run: { id: number }, result: {
      status: Exclude<JiraSyncStatus, "running">;
      createdCount?: number;
      updatedCount?: number;
      skippedCount?: number;
      errorCount?: number;
      details?: JsonRecord | null;
      errorMessage?: string | null;
      startedAt?: Date;
    }) {
      const finishedAt = new Date();
      return repository.updateSyncRun(run.id, {
        ...result,
        finishedAt,
        durationMs: result.startedAt ? Math.max(0, finishedAt.getTime() - result.startedAt.getTime()) : null,
      });
    },

    async upsertException(input: {
      onboardingId: number;
      projectId?: number | null;
      domain: string;
      sourceKey?: string | null;
      reason: string;
      severity?: "info" | "warning" | "blocking";
    }) {
      const naturalKey = {
        onboardingId: input.onboardingId,
        domain: input.domain,
        sourceKey: input.sourceKey ?? null,
        reason: input.reason,
      };
      const existing = await repository.findExceptionByNaturalKey(naturalKey);
      const record = existing
        ? await repository.updateException(existing.id, { severity: input.severity ?? existing.severity })
        : await repository.createException({ ...input, sourceKey: input.sourceKey ?? null, severity: input.severity ?? "warning", status: "open" });
      return { record, created: !existing };
    },
  };
}
