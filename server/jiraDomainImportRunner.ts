import type { InsertRisk, InsertWbsTask } from "../drizzle/schema";
import {
  linkProjectToConfirmedFinancialDeal,
  upsertJiraImportedRisks,
  upsertJiraImportedWbs,
} from "./db";
import { buildMappedJiraDomainImport, type JiraDomainImportException } from "./jiraDomainImport";
import { loadProductionJiraBaselineImportContext, type JiraBaselineImportContext } from "./jiraBaselineImportRunner";
import { createProductionJiraOnboardingService } from "./jiraOnboardingRepository";

type JsonRecord = Record<string, unknown>;

export interface JiraDomainImportDependencies {
  loadContext(projectId: number): Promise<JiraBaselineImportContext | null>;
  startSyncRun(input: Record<string, unknown>): Promise<{ record: any; created: boolean }>;
  completeSyncRun(run: { id: number }, result: Record<string, unknown>): Promise<any>;
  upsertException(input: Record<string, unknown>): Promise<{ record: any; created: boolean }>;
  persistRisks(projectId: number, risks: Omit<InsertRisk, "projectId">[]): Promise<{ createdCount: number; updatedCount: number }>;
  persistWbs(projectId: number, tasks: Omit<InsertWbsTask, "projectId">[]): Promise<{ createdCount: number; updatedCount: number }>;
  linkDeal(projectId: number, dealId: string): Promise<{
    linked: boolean;
    reused: boolean;
    dealId: string | null;
    reason: string | null;
  }>;
}

function identityDealId(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const dealId = (value as JsonRecord).dealId;
  return typeof dealId === "string" && dealId.trim() ? dealId.trim() : null;
}

export async function runInitialJiraDomainImport(input: {
  projectId: number;
  actorId: number;
  actorName?: string | null;
}, dependencies: JiraDomainImportDependencies) {
  const context = await dependencies.loadContext(input.projectId);
  if (!context) throw new Error("El proyecto no tiene un onboarding Jira materializado");
  const { onboarding, mappings } = context;
  if (onboarding.projectId !== input.projectId) throw new Error("El onboarding no corresponde al proyecto solicitado");
  if (onboarding.status !== "ready") {
    throw new Error(`La importación H6 requiere onboarding ready; estado actual: ${onboarding.status}`);
  }

  const transformed = buildMappedJiraDomainImport({
    sourceSnapshot: onboarding.sourceSnapshot,
    mappings,
  });
  const domainMappingCount = mappings.filter(mapping =>
    mapping.status === "approved" && ["risk", "epic", "task"].includes(mapping.targetEntityType),
  ).length;
  const dealId = identityDealId(onboarding.identitySnapshot);
  const runId = [
    "initial_import_domains",
    onboarding.id,
    `v${onboarding.mappingVersion}`,
    onboarding.sourceFingerprint || "sin-fingerprint",
    dealId || "sin-deal",
  ].join(":");
  const startedAt = new Date();
  const syncRun = await dependencies.startSyncRun({
    runId,
    onboardingId: onboarding.id,
    projectId: input.projectId,
    jiraProjectKey: onboarding.jiraProjectKey,
    source: "initial_import",
    status: "running",
    inputCount: domainMappingCount + 1,
    details: {
      importScope: "h6_domains",
      mappingVersion: onboarding.mappingVersion,
      sourceFingerprint: onboarding.sourceFingerprint,
    },
    triggeredBy: input.actorId,
    triggeredByName: input.actorName ?? null,
  });
  if (!syncRun.created && ["applied", "partial", "dry_run"].includes(syncRun.record.status)) {
    return {
      runId,
      reused: true,
      risks: syncRun.record.details?.risks ?? { createdCount: 0, updatedCount: 0 },
      wbs: syncRun.record.details?.wbs ?? { createdCount: 0, updatedCount: 0 },
      finance: syncRun.record.details?.finance ?? { linked: false, reused: false, dealId: null },
      exceptions: syncRun.record.errorCount ?? 0,
    };
  }

  try {
    const riskResult = await dependencies.persistRisks(input.projectId, transformed.risks);
    const wbsResult = await dependencies.persistWbs(input.projectId, transformed.wbsItems);
    const financeResult = dealId
      ? await dependencies.linkDeal(input.projectId, dealId)
      : { linked: false, reused: false, dealId: null, reason: "La identidad confirmada no contiene un Deal financiero; permanece [POR CONFIRMAR]." };
    const exceptions: Array<JiraDomainImportException | { domain: "finance"; sourceKey: string; reason: string }> = [
      ...transformed.exceptions,
    ];
    if (!financeResult.linked && financeResult.reason) {
      exceptions.push({ domain: "finance" as const, sourceKey: dealId ?? "[POR CONFIRMAR]", reason: financeResult.reason });
    }
    for (const exception of exceptions) {
      await dependencies.upsertException({
        onboardingId: onboarding.id,
        projectId: input.projectId,
        domain: exception.domain,
        sourceKey: exception.sourceKey,
        reason: exception.reason,
        severity: "warning",
      });
    }

    const createdCount = riskResult.createdCount + wbsResult.createdCount + (financeResult.linked && !financeResult.reused ? 1 : 0);
    const updatedCount = riskResult.updatedCount + wbsResult.updatedCount;
    const skippedCount = Math.max(0, domainMappingCount - transformed.risks.length - transformed.wbsItems.length)
      + (financeResult.reused ? 1 : 0);
    const details = { risks: riskResult, wbs: wbsResult, finance: financeResult };
    await dependencies.completeSyncRun(syncRun.record, {
      status: exceptions.length ? "partial" : "applied",
      createdCount,
      updatedCount,
      skippedCount,
      errorCount: exceptions.length,
      startedAt,
      details,
    });
    return {
      runId,
      reused: false,
      risks: riskResult,
      wbs: wbsResult,
      finance: financeResult,
      exceptions: exceptions.length,
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

export async function runProductionInitialJiraDomainImport(input: {
  projectId: number;
  actorId: number;
  actorName?: string | null;
}) {
  const service = createProductionJiraOnboardingService();
  return runInitialJiraDomainImport(input, {
    loadContext: loadProductionJiraBaselineImportContext,
    startSyncRun: service.startSyncRun,
    completeSyncRun: service.completeSyncRun,
    upsertException: service.upsertException,
    persistRisks: upsertJiraImportedRisks,
    persistWbs: upsertJiraImportedWbs,
    linkDeal: linkProjectToConfirmedFinancialDeal,
  });
}
