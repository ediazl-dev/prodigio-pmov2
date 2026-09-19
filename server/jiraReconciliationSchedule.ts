import type { Request, Response } from "express";
import { getAdminSettingValue, listReadyJiraProjectsForReconciliation } from "./db";
import { sdk } from "./_core/sdk";
import { runProductionJiraReconciliation } from "./jiraReconciliationRunner";
import { runJiraPortfolioSnapshotBatch } from "./jiraPortfolioSnapshot";

export const JIRA_RECONCILIATION_TASK_UID_SETTING = "jira_reconciliation_daily_task_uid";
export const JIRA_RECONCILIATION_CRON_SETTING = "jira_reconciliation_daily_cron_utc";
export const JIRA_RECONCILIATION_DAILY_CRON_UTC = "0 0 4 * * *";
export const JIRA_RECONCILIATION_CALLBACK = "/api/scheduled/syncJiraHomologated";
export const MAX_SCHEDULED_JIRA_PROJECTS = 50;

export class ScheduledJiraAuthorizationError extends Error {}

type ReadyProject = {
  onboardingId: number;
  projectId: number;
  jiraProjectKey: string;
};

type ProjectResult = {
  projectId: number;
  onboardingId: number;
  jiraProjectKey: string;
  status: string;
  reused: boolean;
  exceptions: number;
  error?: string;
};

export interface ScheduledJiraBatchDependencies {
  getSetting(key: string): Promise<string | null>;
  listReadyProjects(limit: number): Promise<ReadyProject[]>;
  reconcile(input: {
    projectId: number;
    source: "scheduled";
    operationId: string;
    actorId: null;
    actorName: string;
  }): Promise<{ status: string; reused: boolean; exceptions: number }>;
  refreshPortfolio?(): Promise<{
    status: "success" | "partial";
    candidateCount: number;
    processedCount: number;
    successCount: number;
    partialCount: number;
    errorCount: number;
    deferredCount: number;
    results: unknown[];
  }>;
  now(): Date;
}

export function scheduledJiraOperationId(now: Date) {
  return `daily:${now.toISOString().slice(0, 10)}`;
}

export async function runScheduledJiraReconciliationBatch(
  input: { taskUid: string },
  dependencies: ScheduledJiraBatchDependencies,
) {
  const configuredTaskUid = await dependencies.getSetting(JIRA_RECONCILIATION_TASK_UID_SETTING);
  if (!configuredTaskUid || configuredTaskUid !== input.taskUid) {
    throw new ScheduledJiraAuthorizationError("La tarea programada Jira no coincide con la configuración durable");
  }

  const candidates = await dependencies.listReadyProjects(MAX_SCHEDULED_JIRA_PROJECTS + 1);
  const selected = candidates.slice(0, MAX_SCHEDULED_JIRA_PROJECTS);
  const deferredCount = Math.max(0, candidates.length - selected.length);
  const operationId = scheduledJiraOperationId(dependencies.now());
  const results: ProjectResult[] = [];

  for (const project of selected) {
    try {
      const result = await dependencies.reconcile({
        projectId: project.projectId,
        source: "scheduled",
        operationId,
        actorId: null,
        actorName: "Conciliación Jira diaria",
      });
      results.push({
        projectId: project.projectId,
        onboardingId: project.onboardingId,
        jiraProjectKey: project.jiraProjectKey,
        status: result.status,
        reused: result.reused,
        exceptions: result.exceptions,
      });
    } catch (error) {
      results.push({
        projectId: project.projectId,
        onboardingId: project.onboardingId,
        jiraProjectKey: project.jiraProjectKey,
        status: "error",
        reused: false,
        exceptions: 1,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const errorCount = results.filter(result => result.status === "error").length;
  const partialCount = results.filter(result => result.status === "partial").length;
  let portfolioSnapshots: Awaited<ReturnType<NonNullable<ScheduledJiraBatchDependencies["refreshPortfolio"]>>> | null = null;
  if (dependencies.refreshPortfolio) {
    try {
      portfolioSnapshots = await dependencies.refreshPortfolio();
    } catch (error) {
      portfolioSnapshots = {
        status: "partial",
        candidateCount: 0,
        processedCount: 0,
        successCount: 0,
        partialCount: 0,
        errorCount: 1,
        deferredCount: 0,
        results: [{ status: "error", error: error instanceof Error ? error.message : String(error) }],
      };
    }
  }
  return {
    status: errorCount || partialCount || deferredCount || portfolioSnapshots?.status === "partial" ? "partial" as const : "applied" as const,
    operationId,
    candidateCount: candidates.length,
    processedCount: results.length,
    deferredCount,
    appliedCount: results.filter(result => result.status === "applied").length,
    partialCount,
    reusedCount: results.filter(result => result.reused).length,
    errorCount,
    results,
    portfolioSnapshots,
  };
}

export async function runProductionScheduledJiraReconciliationBatch(input: { taskUid: string }) {
  return runScheduledJiraReconciliationBatch(input, {
    getSetting: getAdminSettingValue,
    listReadyProjects: listReadyJiraProjectsForReconciliation,
    reconcile: runProductionJiraReconciliation,
    refreshPortfolio: () => runJiraPortfolioSnapshotBatch(MAX_SCHEDULED_JIRA_PROJECTS),
    now: () => new Date(),
  });
}

export interface ScheduledJiraHandlerDependencies {
  authenticateRequest(req: Request): Promise<{ isCron?: boolean; taskUid?: string | null }>;
  runBatch(input: { taskUid: string }): Promise<Record<string, unknown>>;
}

export function createScheduledJiraReconciliationHandler(dependencies: ScheduledJiraHandlerDependencies) {
  return async (req: Request, res: Response) => {
    let user: { isCron?: boolean; taskUid?: string | null };
    try {
      user = await dependencies.authenticateRequest(req);
    } catch {
      res.status(401).json({ status: "error", error: "Autenticación requerida" });
      return;
    }
    if (!user.isCron || !user.taskUid) {
      res.status(403).json({ status: "error", error: "Sólo la tarea programada Jira puede invocar este endpoint" });
      return;
    }
    try {
      const outcome = await dependencies.runBatch({ taskUid: user.taskUid });
      res.status(200).json(outcome);
    } catch (error) {
      if (error instanceof ScheduledJiraAuthorizationError) {
        res.status(403).json({ status: "error", error: error.message });
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      console.error("[JiraReconciliation] scheduled error:", message);
      res.status(500).json({ status: "error", error: message });
    }
  };
}

export const scheduledJiraReconciliationHandler = createScheduledJiraReconciliationHandler({
  authenticateRequest: req => sdk.authenticateRequest(req),
  runBatch: runProductionScheduledJiraReconciliationBatch,
});
