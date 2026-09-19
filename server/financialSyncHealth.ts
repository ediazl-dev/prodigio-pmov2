import type { DriveCredentialStatus } from "./googleDriveServiceAccount";

export type FinancialSyncLogLike = {
  id: number;
  status: string;
  createdAt: Date | string;
  errorMessage?: string | null;
  triggeredBy?: string | null;
  inputDeals?: number | null;
  insertCount?: number | null;
  updateCount?: number | null;
};

export type FinancialSyncFreshness = "fresh" | "warning" | "stale" | "no_data";

export function parseFinancialSyncDiagnostic(errorMessage?: string | null) {
  if (!errorMessage) return { code: null, phase: null, message: null };
  const match = errorMessage.match(/^\[([a-z_]+):([a-z_]+)\]\s*(.*)$/);
  if (!match) return { code: "legacy_error", phase: "unknown", message: errorMessage };
  return { code: match[1], phase: match[2], message: match[3] || null };
}

export function buildFinancialSyncHealth(input: {
  latestAttempt?: FinancialSyncLogLike | null;
  latestSuccess?: FinancialSyncLogLike | null;
  credential: DriveCredentialStatus;
  taskConfigured: boolean;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const successAt = input.latestSuccess ? new Date(input.latestSuccess.createdAt) : null;
  const ageHours = successAt
    ? Math.max(0, Math.round((now.getTime() - successAt.getTime()) / 3_600_000))
    : null;
  const freshness: FinancialSyncFreshness = ageHours === null
    ? "no_data"
    : ageHours <= 36
      ? "fresh"
      : ageHours <= 72
        ? "warning"
        : "stale";

  return {
    latestAttempt: input.latestAttempt ?? null,
    latestSuccess: input.latestSuccess ?? null,
    ageHours,
    freshness,
    credential: input.credential,
    taskConfigured: input.taskConfigured,
    diagnostic: parseFinancialSyncDiagnostic(input.latestAttempt?.errorMessage),
  };
}
