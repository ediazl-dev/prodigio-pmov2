import { createHash } from "node:crypto";
import type { InsertRisk, InsertWbsTask } from "../drizzle/schema";
import {
  reconcileExecutiveMilestoneJiraObservations,
  resolveOpenJiraImportExceptions,
  updateReadyJiraOnboardingSnapshot,
  upsertJiraImportedRisks,
  upsertJiraImportedWbs,
} from "./db";
import { searchJiraIssues } from "./jiraClient";
import { loadProductionJiraBaselineImportContext, type JiraBaselineImportContext } from "./jiraBaselineImportRunner";
import { createProductionJiraOnboardingService } from "./jiraOnboardingRepository";
import { fingerprintJiraSnapshot, type JiraSyncSource } from "./jiraOnboardingService";
import {
  buildJiraReconciliationPlan,
  mergeRefreshedJiraIssues,
  reconciliationIssueKeys,
  type JiraMilestoneReconciliation,
  type JiraReconciliationMapping,
  type RawJiraIssue,
} from "./jiraReconciliation";

const MAX_ISSUES_PER_PROJECT = 500;
const ACTIVE_RUN_TTL_MS = 10 * 60 * 1000;
const RECONCILIATION_DOMAINS = ["milestones", "risks", "planning", "documents"] as const;

type JsonRecord = Record<string, unknown>;

export interface JiraReconciliationContext extends Omit<JiraBaselineImportContext, "mappings"> {
  mappings: JiraReconciliationMapping[];
}

export interface JiraReconciliationRunnerDependencies {
  loadContext(projectId: number): Promise<JiraReconciliationContext | null>;
  startSyncRun(input: Record<string, unknown>): Promise<{ record: any; created: boolean }>;
  completeSyncRun(run: { id: number }, result: Record<string, unknown>): Promise<any>;
  upsertException(input: Record<string, unknown>): Promise<{ record: any; created: boolean }>;
  fetchIssues(issueKeys: string[]): Promise<RawJiraIssue[]>;
  persistSnapshot(input: { onboardingId: number; sourceSnapshot: JsonRecord; sourceFingerprint: string }): Promise<void>;
  persistRisks(projectId: number, risks: Omit<InsertRisk, "projectId">[]): Promise<{ createdCount: number; updatedCount: number }>;
  persistWbs(projectId: number, tasks: Omit<InsertWbsTask, "projectId">[]): Promise<{ createdCount: number; updatedCount: number }>;
  persistMilestones(projectId: number, observations: JiraMilestoneReconciliation[]): Promise<{
    observedCount: number;
    changedCount: number;
    unchangedCount: number;
    missingIssueKeys: string[];
  }>;
  resolveExceptions(input: {
    onboardingId: number;
    domains: Array<(typeof RECONCILIATION_DOMAINS)[number]>;
    actorId?: number | null;
    actorName?: string | null;
    resolution: string;
  }): Promise<void>;
  now(): Date;
}

function operationHash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function isRecentRunning(record: any, now: Date) {
  if (record?.status !== "running") return false;
  const startedAt = record.startedAt instanceof Date ? record.startedAt : new Date(record.startedAt ?? record.createdAt ?? 0);
  return Number.isFinite(startedAt.getTime()) && now.getTime() - startedAt.getTime() < ACTIVE_RUN_TTL_MS;
}

function terminalRunResult(record: any, runId: string) {
  return {
    runId,
    reused: true,
    inProgress: false,
    status: record.status,
    jiraRead: record.details?.jiraRead ?? { requestedCount: record.inputCount ?? 0, returnedCount: 0, missingIssueKeys: [] },
    risks: record.details?.risks ?? { createdCount: 0, updatedCount: 0 },
    wbs: record.details?.wbs ?? { createdCount: 0, updatedCount: 0 },
    milestones: record.details?.milestones ?? { observedCount: 0, changedCount: 0, unchangedCount: 0, missingIssueKeys: [] },
    documents: record.details?.documents ?? { mappedCount: 0, linkedCount: 0, pendingCount: 0 },
    exceptions: record.errorCount ?? 0,
  };
}

export function buildJiraIssueKeyJql(issueKeys: string[]) {
  const keys = Array.from(new Set(issueKeys.map(key => key.trim().toUpperCase()).filter(Boolean)));
  if (!keys.length) return null;
  if (keys.length > MAX_ISSUES_PER_PROJECT) {
    throw new Error(`La conciliación admite hasta ${MAX_ISSUES_PER_PROJECT} issues mapeados por proyecto`);
  }
  for (const key of keys) {
    if (!/^[A-Z][A-Z0-9_]*-\d+$/.test(key)) throw new Error(`Clave Jira inválida en mapping aprobado: ${key}`);
  }
  return `key in (${keys.map(key => `"${key}"`).join(",")}) ORDER BY key ASC`;
}

export async function fetchMappedJiraIssues(issueKeys: string[]) {
  const uniqueKeys = Array.from(new Set(issueKeys.map(key => key.trim().toUpperCase()).filter(Boolean))).sort();
  if (uniqueKeys.length > MAX_ISSUES_PER_PROJECT) {
    throw new Error(`La conciliación admite hasta ${MAX_ISSUES_PER_PROJECT} issues mapeados por proyecto`);
  }
  const issues: RawJiraIssue[] = [];
  for (let index = 0; index < uniqueKeys.length; index += 100) {
    const chunk = uniqueKeys.slice(index, index + 100);
    const jql = buildJiraIssueKeyJql(chunk);
    if (!jql) continue;
    const result = await searchJiraIssues(jql, {
      maxResults: chunk.length,
      fields: ["summary", "issuetype", "status", "assignee", "duedate", "resolutiondate", "parent", "updated"],
    });
    issues.push(...result.issues as RawJiraIssue[]);
  }
  return issues;
}

export async function runJiraReconciliation(input: {
  projectId: number;
  source: Extract<JiraSyncSource, "manual" | "scheduled" | "retry">;
  operationId: string;
  actorId?: number | null;
  actorName?: string | null;
}, dependencies: JiraReconciliationRunnerDependencies) {
  const context = await dependencies.loadContext(input.projectId);
  if (!context) throw new Error("El proyecto no tiene un onboarding Jira materializado");
  const { onboarding, mappings } = context;
  if (onboarding.projectId !== input.projectId) throw new Error("El onboarding no corresponde al proyecto solicitado");
  if (onboarding.status !== "ready") {
    throw new Error(`La conciliación H7 requiere onboarding ready; estado actual: ${onboarding.status}`);
  }
  const issueKeys = reconciliationIssueKeys(mappings);
  const now = dependencies.now();
  const runId = `h7:${input.source}:${onboarding.id}:${operationHash(`${input.operationId}:v${onboarding.mappingVersion}`)}`;
  const syncRun = await dependencies.startSyncRun({
    runId,
    onboardingId: onboarding.id,
    projectId: input.projectId,
    jiraProjectKey: onboarding.jiraProjectKey,
    source: input.source,
    status: "running",
    inputCount: issueKeys.length,
    details: {
      reconciliationScope: "h7_jira_to_pmo",
      operationId: input.operationId,
      mappingVersion: onboarding.mappingVersion,
    },
    triggeredBy: input.actorId ?? null,
    triggeredByName: input.actorName ?? null,
  });
  if (!syncRun.created && ["applied", "partial", "dry_run"].includes(syncRun.record.status)) {
    return terminalRunResult(syncRun.record, runId);
  }
  if (!syncRun.created && isRecentRunning(syncRun.record, now)) {
    return { ...terminalRunResult(syncRun.record, runId), inProgress: true, status: "running" };
  }

  try {
    const refreshedIssues = await dependencies.fetchIssues(issueKeys);
    const refreshedSnapshot = mergeRefreshedJiraIssues({
      sourceSnapshot: onboarding.sourceSnapshot,
      requestedKeys: issueKeys,
      refreshedIssues,
      asOf: now.toISOString(),
    });
    const sourceFingerprint = fingerprintJiraSnapshot(refreshedSnapshot);
    await dependencies.persistSnapshot({ onboardingId: onboarding.id, sourceSnapshot: refreshedSnapshot, sourceFingerprint });
    const plan = buildJiraReconciliationPlan({ sourceSnapshot: refreshedSnapshot, mappings, now });
    const riskResult = await dependencies.persistRisks(input.projectId, plan.risks);
    const wbsResult = await dependencies.persistWbs(input.projectId, plan.wbsItems);
    const milestoneResult = await dependencies.persistMilestones(input.projectId, plan.milestones);
    const currentKeys = new Set(refreshedIssues.map(issue => issue.key.trim().toUpperCase()));
    const missingIssueKeys = issueKeys.filter(key => !currentKeys.has(key));
    const exceptions = [
      ...plan.exceptions,
      ...milestoneResult.missingIssueKeys.map(sourceKey => ({
        domain: "milestones" as const,
        sourceKey,
        reason: "El mapping aprobado no corresponde a un hito del baseline ejecutivo vigente; no se modificó el baseline ni la aceptación.",
      })),
    ];
    await dependencies.resolveExceptions({
      onboardingId: onboarding.id,
      domains: [...RECONCILIATION_DOMAINS],
      actorId: input.actorId ?? null,
      actorName: input.actorName ?? null,
      resolution: `No reapareció en la conciliación ${runId}`,
    });
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
    const details = {
      reconciliationScope: "h7_jira_to_pmo",
      operationId: input.operationId,
      mappingVersion: onboarding.mappingVersion,
      sourceFingerprint,
      jiraRead: { requestedCount: issueKeys.length, returnedCount: refreshedIssues.length, missingIssueKeys },
      risks: riskResult,
      wbs: wbsResult,
      milestones: milestoneResult,
      documents: {
        mappedCount: plan.documents.mappedCount,
        linkedCount: plan.documents.linkedCount,
        pendingCount: plan.documents.pendingCount,
      },
    };
    const createdCount = riskResult.createdCount + wbsResult.createdCount;
    const updatedCount = riskResult.updatedCount + wbsResult.updatedCount + milestoneResult.changedCount;
    const skippedCount = missingIssueKeys.length + milestoneResult.unchangedCount + plan.documents.pendingCount;
    await dependencies.completeSyncRun(syncRun.record, {
      status: exceptions.length ? "partial" : "applied",
      createdCount,
      updatedCount,
      skippedCount,
      errorCount: exceptions.length,
      startedAt: now,
      details,
    });
    return {
      runId,
      reused: false,
      inProgress: false,
      status: exceptions.length ? "partial" as const : "applied" as const,
      jiraRead: details.jiraRead,
      risks: riskResult,
      wbs: wbsResult,
      milestones: milestoneResult,
      documents: details.documents,
      exceptions: exceptions.length,
    };
  } catch (error) {
    await dependencies.completeSyncRun(syncRun.record, {
      status: "error",
      errorCount: 1,
      errorMessage: error instanceof Error ? error.message : String(error),
      startedAt: now,
      details: {
        reconciliationScope: "h7_jira_to_pmo",
        operationId: input.operationId,
        mappingVersion: onboarding.mappingVersion,
      },
    });
    throw error;
  }
}

export async function runProductionJiraReconciliation(input: {
  projectId: number;
  source: Extract<JiraSyncSource, "manual" | "scheduled" | "retry">;
  operationId: string;
  actorId?: number | null;
  actorName?: string | null;
}) {
  const service = createProductionJiraOnboardingService();
  return runJiraReconciliation(input, {
    loadContext: async projectId => loadProductionJiraBaselineImportContext(projectId) as Promise<JiraReconciliationContext | null>,
    startSyncRun: service.startSyncRun,
    completeSyncRun: service.completeSyncRun,
    upsertException: service.upsertException,
    fetchIssues: fetchMappedJiraIssues,
    persistSnapshot: updateReadyJiraOnboardingSnapshot,
    persistRisks: upsertJiraImportedRisks,
    persistWbs: upsertJiraImportedWbs,
    persistMilestones: reconcileExecutiveMilestoneJiraObservations,
    resolveExceptions: resolveOpenJiraImportExceptions,
    now: () => new Date(),
  });
}
