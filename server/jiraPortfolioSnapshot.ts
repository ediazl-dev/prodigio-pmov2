import { createHash } from "node:crypto";
import { eq, isNotNull } from "drizzle-orm";
import { getDb } from "./db";
import { getJiraAdvanceReport, type JiraAdvanceReport } from "./jiraClient";
import { jiraPortfolioSnapshots, projects } from "../drizzle/schema";

export type JiraPortfolioSnapshotCandidate = {
  projectId: number;
  jiraProjectKey: string;
};

export type JiraPortfolioSnapshotPayload = {
  projectId: number;
  jiraProjectKey: string;
  status: "success" | "partial";
  operationalPhase: string | null;
  executiveStatus: string | null;
  financialStatus: string | null;
  advanceReportedPct: number | null;
  projectManagerName: string | null;
  projectManagerAccountId: string | null;
  milestonesTotal: number;
  milestonesFulfilled: number;
  milestonesPending: number;
  risksTotal: number;
  risksOpen: number;
  risksHighPriorityOpen: number;
  sourceUpdatedAt: Date | null;
  dataFingerprint: string;
  errorCode: string | null;
  errorMessage: string | null;
  capturedAt: Date;
  lastSuccessAt: Date;
};

const DONE_STATUS_NAMES = new Set([
  "finalizada", "done", "cerrado", "closed", "cumplido", "cumplido (entregable)",
  "resuelto", "resolved", "completado", "completed", "terminado",
]);

function isDone(status: string, statusCategory: string) {
  return statusCategory.toLowerCase() === "done" || DONE_STATUS_NAMES.has(status.toLowerCase().trim());
}

function safeDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function buildJiraPortfolioSnapshot(
  candidate: JiraPortfolioSnapshotCandidate,
  report: JiraAdvanceReport,
  capturedAt = new Date(),
): JiraPortfolioSnapshotPayload {
  const openRisks = report.risks.filter(risk => !isDone(risk.status, risk.statusCategory));
  const highPriorities = new Set(["high", "highest", "alta", "máxima", "maxima"]);
  const semantic = {
    projectId: candidate.projectId,
    jiraProjectKey: candidate.jiraProjectKey,
    operationalPhase: report.operationalPhase,
    executiveStatus: report.executiveStatus,
    financialStatus: report.financialStatus,
    advanceReportedPct: report.advanceReportedPct,
    projectManagerName: report.projectManagerName,
    projectManagerAccountId: report.projectManagerAccountId,
    milestonesTotal: report.milestones.length,
    milestonesFulfilled: report.milestonesCumplidos,
    milestonesPending: report.milestonesPendientes,
    risksTotal: report.risks.length,
    risksOpen: openRisks.length,
    risksHighPriorityOpen: openRisks.filter(risk => highPriorities.has(risk.priority.toLowerCase().trim())).length,
    sourceUpdatedAt: safeDate(report.operationalUpdatedAt),
  };
  const status = report.operationalPhase || report.executiveStatus || report.projectManagerName ? "success" : "partial";
  return {
    ...semantic,
    status,
    dataFingerprint: createHash("sha256").update(JSON.stringify(semantic)).digest("hex"),
    errorCode: status === "partial" ? "JIRA_PROGRESS_ISSUE_MISSING" : null,
    errorMessage: status === "partial" ? "No se encontró el issue corporativo Proyecto PMO - Avance" : null,
    capturedAt,
    lastSuccessAt: capturedAt,
  };
}

export function classifyJiraPortfolioSnapshotError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/401/.test(message)) return { code: "JIRA_AUTHENTICATION_ERROR", message };
  if (/403/.test(message)) return { code: "JIRA_PERMISSION_ERROR", message };
  if (/404/.test(message)) return { code: "JIRA_PROJECT_NOT_FOUND", message };
  if (/timeout|abort/i.test(message)) return { code: "JIRA_TIMEOUT", message };
  return { code: "JIRA_READ_ERROR", message };
}

export async function listJiraPortfolioSnapshotCandidates(limit = 50): Promise<JiraPortfolioSnapshotCandidate[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ projectId: projects.id, jiraProjectKey: projects.jiraProjectKey })
    .from(projects)
    .where(isNotNull(projects.jiraProjectKey))
    .limit(limit);
  return rows
    .filter((row): row is { projectId: number; jiraProjectKey: string } => Boolean(row.jiraProjectKey?.trim()))
    .map(row => ({ projectId: row.projectId, jiraProjectKey: row.jiraProjectKey.trim() }));
}

export async function saveJiraPortfolioSnapshot(payload: JiraPortfolioSnapshotPayload) {
  const db = await getDb();
  if (!db) throw new Error("Base de datos no disponible");
  await db.insert(jiraPortfolioSnapshots).values(payload).onDuplicateKeyUpdate({
    set: {
      jiraProjectKey: payload.jiraProjectKey,
      status: payload.status,
      operationalPhase: payload.operationalPhase,
      executiveStatus: payload.executiveStatus,
      financialStatus: payload.financialStatus,
      advanceReportedPct: payload.advanceReportedPct,
      projectManagerName: payload.projectManagerName,
      projectManagerAccountId: payload.projectManagerAccountId,
      milestonesTotal: payload.milestonesTotal,
      milestonesFulfilled: payload.milestonesFulfilled,
      milestonesPending: payload.milestonesPending,
      risksTotal: payload.risksTotal,
      risksOpen: payload.risksOpen,
      risksHighPriorityOpen: payload.risksHighPriorityOpen,
      sourceUpdatedAt: payload.sourceUpdatedAt,
      dataFingerprint: payload.dataFingerprint,
      errorCode: payload.errorCode,
      errorMessage: payload.errorMessage,
      capturedAt: payload.capturedAt,
      lastSuccessAt: payload.lastSuccessAt,
    },
  });
}

export async function saveJiraPortfolioSnapshotError(
  candidate: JiraPortfolioSnapshotCandidate,
  error: unknown,
  capturedAt = new Date(),
) {
  const db = await getDb();
  if (!db) throw new Error("Base de datos no disponible");
  const classified = classifyJiraPortfolioSnapshotError(error);
  const dataFingerprint = createHash("sha256")
    .update(JSON.stringify({ ...candidate, errorCode: classified.code, capturedAt: capturedAt.toISOString() }))
    .digest("hex");
  await db.insert(jiraPortfolioSnapshots).values({
    ...candidate,
    status: "error",
    dataFingerprint,
    errorCode: classified.code,
    errorMessage: classified.message,
    capturedAt,
  }).onDuplicateKeyUpdate({
    set: {
      jiraProjectKey: candidate.jiraProjectKey,
      status: "error",
      dataFingerprint,
      errorCode: classified.code,
      errorMessage: classified.message,
      capturedAt,
    },
  });
  return classified;
}

export async function refreshJiraPortfolioSnapshot(candidate: JiraPortfolioSnapshotCandidate) {
  const capturedAt = new Date();
  try {
    const report = await getJiraAdvanceReport(candidate.jiraProjectKey);
    const payload = buildJiraPortfolioSnapshot(candidate, report, capturedAt);
    await saveJiraPortfolioSnapshot(payload);
    return { projectId: candidate.projectId, jiraProjectKey: candidate.jiraProjectKey, status: payload.status, errorCode: payload.errorCode };
  } catch (error) {
    const classified = await saveJiraPortfolioSnapshotError(candidate, error, capturedAt);
    return { projectId: candidate.projectId, jiraProjectKey: candidate.jiraProjectKey, status: "error" as const, errorCode: classified.code };
  }
}

export interface JiraPortfolioSnapshotBatchDependencies {
  listCandidates(limit: number): Promise<JiraPortfolioSnapshotCandidate[]>;
  refresh(candidate: JiraPortfolioSnapshotCandidate): Promise<{
    projectId: number;
    jiraProjectKey: string;
    status: "success" | "partial" | "error";
    errorCode: string | null;
  }>;
}

export async function runJiraPortfolioSnapshotBatch(
  limit = 50,
  concurrency = 3,
  dependencies: JiraPortfolioSnapshotBatchDependencies = {
    listCandidates: listJiraPortfolioSnapshotCandidates,
    refresh: refreshJiraPortfolioSnapshot,
  },
) {
  const candidates = await dependencies.listCandidates(limit + 1);
  const selected = candidates.slice(0, limit);
  const results: Awaited<ReturnType<JiraPortfolioSnapshotBatchDependencies["refresh"]>>[] = [];
  let cursor = 0;

  const worker = async () => {
    while (cursor < selected.length) {
      const index = cursor++;
      results[index] = await dependencies.refresh(selected[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, selected.length) }, worker));

  return {
    status: results.some(result => result.status !== "success") || candidates.length > limit ? "partial" as const : "success" as const,
    candidateCount: candidates.length,
    processedCount: results.length,
    successCount: results.filter(result => result.status === "success").length,
    partialCount: results.filter(result => result.status === "partial").length,
    errorCount: results.filter(result => result.status === "error").length,
    deferredCount: Math.max(0, candidates.length - selected.length),
    results,
  };
}

export async function getJiraPortfolioSnapshots() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(jiraPortfolioSnapshots).orderBy(jiraPortfolioSnapshots.projectId);
}

export async function getJiraPortfolioSnapshot(projectId: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(jiraPortfolioSnapshots).where(eq(jiraPortfolioSnapshots.projectId, projectId)).limit(1);
  return row ?? null;
}
