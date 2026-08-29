import { and, eq } from "drizzle-orm";
import { jiraEntityMappings, jiraProjectOnboardings } from "../drizzle/schema";
import { createOrReplaceJiraBaselineProposal, getDb } from "./db";
import { buildMappedJiraBaselineProposal } from "./jiraBaselineProposal";
import { createProductionJiraOnboardingService } from "./jiraOnboardingRepository";
import type { JiraOnboardingStatus } from "./jiraOnboardingService";

type JsonRecord = Record<string, unknown>;

export interface JiraBaselineImportContext {
  onboarding: {
    id: number;
    projectId: number | null;
    jiraProjectKey: string;
    status: JiraOnboardingStatus;
    mappingVersion: number;
    sourceFingerprint: string | null;
    sourceSnapshot: unknown;
    identitySnapshot: unknown;
  };
  mappings: Array<{
    sourceKey: string;
    targetEntityType: string;
    targetEntityId?: string | null;
    status: string;
  }>;
}

export interface JiraBaselineImportDependencies {
  loadContext(projectId: number): Promise<JiraBaselineImportContext | null>;
  startSyncRun(input: Record<string, unknown>): Promise<{ record: any; created: boolean }>;
  completeSyncRun(run: { id: number }, result: Record<string, unknown>): Promise<any>;
  upsertException(input: Record<string, unknown>): Promise<{ record: any; created: boolean }>;
  transition(input: Record<string, unknown>): Promise<any>;
  persistProposal(input: Parameters<typeof createOrReplaceJiraBaselineProposal>[0]): Promise<{
    sourceId: number;
    sourceStatus: "draft" | "approved";
    reused: boolean;
  }>;
}

function identityDealId(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const dealId = (value as JsonRecord).dealId;
  return typeof dealId === "string" && dealId.trim() ? dealId.trim() : null;
}

export async function runInitialJiraBaselineImport(input: {
  projectId: number;
  actorId: number;
  actorName?: string | null;
}, dependencies: JiraBaselineImportDependencies) {
  const context = await dependencies.loadContext(input.projectId);
  if (!context) throw new Error("El proyecto no tiene un onboarding Jira materializado");
  const { onboarding, mappings } = context;
  if (onboarding.projectId !== input.projectId) throw new Error("El onboarding no corresponde al proyecto solicitado");
  if (onboarding.status !== "reconciliation" && onboarding.status !== "ready") {
    throw new Error(`La importación inicial requiere estado reconciliation; estado actual: ${onboarding.status}`);
  }
  const dealId = identityDealId(onboarding.identitySnapshot);
  if (!dealId) throw new Error("La identidad confirmada no contiene un Deal financiero");

  const proposal = buildMappedJiraBaselineProposal({
    sourceSnapshot: onboarding.sourceSnapshot,
    mappings,
  });
  if (proposal.milestones.length === 0) {
    throw new Error("El mapeo aprobado no contiene hitos para construir la propuesta de baseline");
  }

  const runId = [
    "initial_import",
    onboarding.id,
    `v${onboarding.mappingVersion}`,
    onboarding.sourceFingerprint || "sin-fingerprint",
  ].join(":");
  const startedAt = new Date();
  const syncRun = await dependencies.startSyncRun({
    runId,
    onboardingId: onboarding.id,
    projectId: input.projectId,
    jiraProjectKey: onboarding.jiraProjectKey,
    source: "initial_import",
    status: "running",
    inputCount: proposal.milestones.length,
    details: { mappingVersion: onboarding.mappingVersion, sourceFingerprint: onboarding.sourceFingerprint },
    triggeredBy: input.actorId,
    triggeredByName: input.actorName ?? null,
  });
  if (!syncRun.created && syncRun.record.status !== "running") {
    return {
      runId,
      sourceId: Number(syncRun.record.details?.sourceId ?? 0) || null,
      sourceStatus: syncRun.record.details?.sourceStatus ?? "draft",
      reused: true,
      milestonesImported: syncRun.record.createdCount ?? 0,
      exceptions: syncRun.record.errorCount ?? 0,
    };
  }

  try {
    const persisted = await dependencies.persistProposal({
      projectId: input.projectId,
      dealId,
      jiraProjectKey: onboarding.jiraProjectKey,
      baselineVersion: proposal.baselineVersion,
      createdBy: input.actorId,
      createdByName: input.actorName ?? null,
      milestones: proposal.milestones,
    });
    for (const exception of proposal.exceptions) {
      await dependencies.upsertException({
        onboardingId: onboarding.id,
        projectId: input.projectId,
        domain: exception.domain,
        sourceKey: exception.sourceKey,
        reason: exception.reason,
        severity: "warning",
      });
    }
    await dependencies.completeSyncRun(syncRun.record, {
      status: proposal.exceptions.length ? "partial" : "applied",
      createdCount: persisted.reused ? 0 : proposal.milestones.length,
      updatedCount: persisted.reused ? proposal.milestones.length : 0,
      skippedCount: mappings.length - proposal.milestones.length,
      errorCount: proposal.exceptions.length,
      startedAt,
      details: {
        sourceId: persisted.sourceId,
        sourceStatus: persisted.sourceStatus,
        missingBaselineIssueKeys: proposal.missingBaselineIssueKeys,
      },
    });
    if (onboarding.status === "reconciliation") {
      await dependencies.transition({
        onboarding,
        status: "reconciliation",
        currentStep: 6,
        actorId: input.actorId,
        actorName: input.actorName ?? null,
      });
    }
    return {
      runId,
      sourceId: persisted.sourceId,
      sourceStatus: persisted.sourceStatus,
      reused: persisted.reused,
      milestonesImported: proposal.milestones.length,
      exceptions: proposal.exceptions.length,
      missingBaselineIssueKeys: proposal.missingBaselineIssueKeys,
    };
  } catch (error) {
    await dependencies.completeSyncRun(syncRun.record, {
      status: "error",
      errorCount: 1,
      errorMessage: error instanceof Error ? error.message : String(error),
      startedAt,
    });
    throw error;
  }
}

export async function loadProductionJiraBaselineImportContext(projectId: number): Promise<JiraBaselineImportContext | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const onboardingRows = await db.select().from(jiraProjectOnboardings)
    .where(eq(jiraProjectOnboardings.projectId, projectId)).limit(1);
  const onboarding = onboardingRows[0];
  if (!onboarding) return null;
  const mappings = await db.select().from(jiraEntityMappings).where(and(
    eq(jiraEntityMappings.onboardingId, onboarding.id),
    eq(jiraEntityMappings.mappingVersion, onboarding.mappingVersion),
    eq(jiraEntityMappings.status, "approved"),
  ));
  return { onboarding: onboarding as JiraBaselineImportContext["onboarding"], mappings };
}

export async function markProductionJiraOnboardingReady(input: {
  projectId: number;
  actorId: number;
  actorName?: string | null;
}) {
  const context = await loadProductionJiraBaselineImportContext(input.projectId);
  if (!context) throw new Error("El proyecto no tiene un onboarding Jira materializado");
  if (context.onboarding.status === "ready") {
    return { onboardingId: context.onboarding.id, status: "ready" as const, reused: true };
  }
  if (context.onboarding.status !== "reconciliation") {
    throw new Error(`La aprobación requiere onboarding en reconciliation; estado actual: ${context.onboarding.status}`);
  }
  const service = createProductionJiraOnboardingService();
  const record = await service.transition({
    onboarding: context.onboarding,
    status: "ready",
    currentStep: 7,
    actorId: input.actorId,
    actorName: input.actorName ?? null,
  });
  return { onboardingId: context.onboarding.id, status: record.status as "ready", reused: false };
}

export async function runProductionInitialJiraBaselineImport(input: {
  projectId: number;
  actorId: number;
  actorName?: string | null;
}) {
  const service = createProductionJiraOnboardingService();
  return runInitialJiraBaselineImport(input, {
    loadContext: loadProductionJiraBaselineImportContext,
    startSyncRun: service.startSyncRun,
    completeSyncRun: service.completeSyncRun,
    upsertException: service.upsertException,
    transition: service.transition,
    persistProposal: createOrReplaceJiraBaselineProposal,
  });
}
