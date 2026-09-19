import type { Request, Response } from "express";
import { getAdminSettingValue } from "./db";
import {
  classifyFinancialSyncError,
  runFinancialSync,
  type FinancialSyncResult,
} from "./financialSync";
import { sdk } from "./_core/sdk";

export const FINANCIAL_SYNC_TASK_UID_SETTING = "financial_sync_daily_task_uid";
export const FINANCIAL_SYNC_CRON_SETTING = "financial_sync_daily_cron_utc";
export const FINANCIAL_SYNC_DAILY_CRON_UTC = "0 0 3 * * *";
export const FINANCIAL_SYNC_CALLBACK = "/api/scheduled/syncFinancial";

export interface ScheduledFinancialSyncDependencies {
  getSetting(key: string): Promise<string | null>;
  run(): Promise<FinancialSyncResult>;
}

export async function runScheduledFinancialSync(
  input: { taskUid: string },
  dependencies: ScheduledFinancialSyncDependencies,
): Promise<FinancialSyncResult | { status: "skipped"; skipped: "orphan" }> {
  const configuredTaskUid = await dependencies.getSetting(FINANCIAL_SYNC_TASK_UID_SETTING);
  if (!configuredTaskUid || configuredTaskUid !== input.taskUid) {
    return { status: "skipped", skipped: "orphan" };
  }
  return dependencies.run();
}

export function runProductionScheduledFinancialSync(input: { taskUid: string }) {
  return runScheduledFinancialSync(input, {
    getSetting: getAdminSettingValue,
    run: () => runFinancialSync("cron"),
  });
}

export interface ScheduledFinancialHandlerDependencies {
  authenticateRequest(req: Request): Promise<{ isCron?: boolean; taskUid?: string | null }>;
  run(input: { taskUid: string }): Promise<Record<string, unknown>>;
  now(): Date;
}

export function createScheduledFinancialSyncHandler(dependencies: ScheduledFinancialHandlerDependencies) {
  return async (req: Request, res: Response) => {
    let user: { isCron?: boolean; taskUid?: string | null };
    try {
      user = await dependencies.authenticateRequest(req);
    } catch {
      res.status(401).json({ status: "error", error: "Autenticación requerida" });
      return;
    }

    if (!user.isCron || !user.taskUid) {
      res.status(403).json({
        status: "error",
        error: "Sólo la tarea programada financiera puede invocar este endpoint",
      });
      return;
    }

    try {
      const outcome = await dependencies.run({ taskUid: user.taskUid });
      res.status(200).json(outcome);
    } catch (error) {
      const operationalError = classifyFinancialSyncError(error);
      console.error(
        `[FinancialSync] scheduled ${operationalError.code}/${operationalError.phase}: ${operationalError.message}`,
      );
      res.status(500).json({
        status: "error",
        code: operationalError.code,
        phase: operationalError.phase,
        error: operationalError.message,
        context: { url: req.originalUrl, taskUid: user.taskUid },
        timestamp: dependencies.now().toISOString(),
      });
    }
  };
}

export const scheduledFinancialSyncHandler = createScheduledFinancialSyncHandler({
  authenticateRequest: req => sdk.authenticateRequest(req),
  run: runProductionScheduledFinancialSync,
  now: () => new Date(),
});
