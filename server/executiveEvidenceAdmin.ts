import { and, desc, eq, gte, isNotNull, isNull, like, lte, or, sql, type SQL } from "drizzle-orm";
import { executiveEvidenceUploads, projects } from "../drizzle/schema";
import { getDb } from "./db";
import { EXECUTIVE_EVIDENCE_RECEIPT_TTL_MS, type ExecutiveEvidenceDocumentType } from "./executiveEvidenceReceipt";

export type ExecutiveEvidenceAdminStatus = "pending" | "expired" | "attached" | "discarded";
export type ExecutiveEvidenceAdminStatusFilter = ExecutiveEvidenceAdminStatus | "all";

export interface ExecutiveEvidenceAdminReceiptLike {
  uploadStatus: "pending" | "attached";
  createdAt: Date | string;
  discardedAt?: Date | string | null;
}

export function deriveExecutiveEvidenceAdminStatus(
  receipt: ExecutiveEvidenceAdminReceiptLike,
  now = new Date(),
): ExecutiveEvidenceAdminStatus {
  if (receipt.discardedAt) return "discarded";
  if (receipt.uploadStatus === "attached") return "attached";
  const createdAtMs = new Date(receipt.createdAt).getTime();
  if (!Number.isFinite(createdAtMs) || now.getTime() - createdAtMs > EXECUTIVE_EVIDENCE_RECEIPT_TTL_MS) return "expired";
  return "pending";
}

export function canDiscardExecutiveEvidence(status: ExecutiveEvidenceAdminStatus) {
  return status === "pending" || status === "expired";
}

export function canRestoreExecutiveEvidence(receipt: ExecutiveEvidenceAdminReceiptLike, now = new Date()) {
  if (!receipt.discardedAt || receipt.uploadStatus !== "pending") return false;
  const createdAtMs = new Date(receipt.createdAt).getTime();
  return Number.isFinite(createdAtMs) && now.getTime() - createdAtMs <= EXECUTIVE_EVIDENCE_RECEIPT_TTL_MS;
}

function statusCondition(status: ExecutiveEvidenceAdminStatusFilter, now: Date): SQL | undefined {
  const expiryCutoff = new Date(now.getTime() - EXECUTIVE_EVIDENCE_RECEIPT_TTL_MS);
  if (status === "pending") {
    return and(
      eq(executiveEvidenceUploads.uploadStatus, "pending"),
      isNull(executiveEvidenceUploads.discardedAt),
      gte(executiveEvidenceUploads.createdAt, expiryCutoff),
    );
  }
  if (status === "expired") {
    return and(
      eq(executiveEvidenceUploads.uploadStatus, "pending"),
      isNull(executiveEvidenceUploads.discardedAt),
      lte(executiveEvidenceUploads.createdAt, expiryCutoff),
    );
  }
  if (status === "attached") {
    return and(eq(executiveEvidenceUploads.uploadStatus, "attached"), isNull(executiveEvidenceUploads.discardedAt));
  }
  if (status === "discarded") return isNotNull(executiveEvidenceUploads.discardedAt);
  return undefined;
}

export async function listExecutiveEvidenceAdmin(input: {
  page: number;
  pageSize: number;
  status: ExecutiveEvidenceAdminStatusFilter;
  documentType?: ExecutiveEvidenceDocumentType;
  projectId?: number;
  search?: string;
  now?: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = input.now ?? new Date();
  const conditions: SQL[] = [];
  const statusFilter = statusCondition(input.status, now);
  if (statusFilter) conditions.push(statusFilter);
  if (input.documentType) conditions.push(eq(executiveEvidenceUploads.documentType, input.documentType));
  if (input.projectId) conditions.push(eq(executiveEvidenceUploads.projectId, input.projectId));
  const normalizedSearch = input.search?.trim();
  if (normalizedSearch) {
    const pattern = `%${normalizedSearch.replace(/[\\%_]/g, "\\$&")}%`;
    const searchCondition = or(
      like(projects.projectName, pattern),
      like(executiveEvidenceUploads.fileName, pattern),
      like(executiveEvidenceUploads.uploadedByName, pattern),
      like(executiveEvidenceUploads.discardedByName, pattern),
    );
    if (searchCondition) conditions.push(searchCondition);
  }
  const where = conditions.length ? and(...conditions) : undefined;
  const offset = (input.page - 1) * input.pageSize;
  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: executiveEvidenceUploads.id,
        projectId: executiveEvidenceUploads.projectId,
        projectName: projects.projectName,
        sourceId: executiveEvidenceUploads.sourceId,
        documentType: executiveEvidenceUploads.documentType,
        fileName: executiveEvidenceUploads.fileName,
        mimeType: executiveEvidenceUploads.mimeType,
        sizeBytes: executiveEvidenceUploads.sizeBytes,
        uploadStatus: executiveEvidenceUploads.uploadStatus,
        attachedEntityType: executiveEvidenceUploads.attachedEntityType,
        attachedEntityId: executiveEvidenceUploads.attachedEntityId,
        uploadedBy: executiveEvidenceUploads.uploadedBy,
        uploadedByName: executiveEvidenceUploads.uploadedByName,
        createdAt: executiveEvidenceUploads.createdAt,
        attachedAt: executiveEvidenceUploads.attachedAt,
        discardedAt: executiveEvidenceUploads.discardedAt,
        discardedBy: executiveEvidenceUploads.discardedBy,
        discardedByName: executiveEvidenceUploads.discardedByName,
        discardReason: executiveEvidenceUploads.discardReason,
      })
      .from(executiveEvidenceUploads)
      .leftJoin(projects, eq(projects.id, executiveEvidenceUploads.projectId))
      .where(where)
      .orderBy(desc(executiveEvidenceUploads.createdAt), desc(executiveEvidenceUploads.id))
      .limit(input.pageSize)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)` })
      .from(executiveEvidenceUploads)
      .leftJoin(projects, eq(projects.id, executiveEvidenceUploads.projectId))
      .where(where),
  ]);

  return {
    items: rows.map(row => {
      const status = deriveExecutiveEvidenceAdminStatus(row, now);
      const expiresAt = new Date(new Date(row.createdAt).getTime() + EXECUTIVE_EVIDENCE_RECEIPT_TTL_MS);
      return {
        ...row,
        status,
        canDiscard: canDiscardExecutiveEvidence(status),
        canRestore: canRestoreExecutiveEvidence(row, now),
        expiresAt,
      };
    }),
    total: Number(countRows[0]?.total ?? 0),
    page: input.page,
    pageSize: input.pageSize,
  };
}

export async function getExecutiveEvidenceAdminSummary(now = new Date()) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select({
      uploadStatus: executiveEvidenceUploads.uploadStatus,
      documentType: executiveEvidenceUploads.documentType,
      createdAt: executiveEvidenceUploads.createdAt,
      discardedAt: executiveEvidenceUploads.discardedAt,
      sizeBytes: executiveEvidenceUploads.sizeBytes,
    })
    .from(executiveEvidenceUploads);

  const summary = {
    total: rows.length,
    pending: 0,
    expired: 0,
    attached: 0,
    discarded: 0,
    pendingBytes: 0,
    oldestPendingAt: null as Date | null,
    byType: { minute: 0, acceptance: 0, recovery_plan: 0 } as Record<ExecutiveEvidenceDocumentType, number>,
  };
  for (const row of rows) {
    const status = deriveExecutiveEvidenceAdminStatus(row, now);
    summary[status] += 1;
    summary.byType[row.documentType] += 1;
    if (status === "pending" || status === "expired") {
      summary.pendingBytes += row.sizeBytes;
      const createdAt = new Date(row.createdAt);
      if (!summary.oldestPendingAt || createdAt < summary.oldestPendingAt) summary.oldestPendingAt = createdAt;
    }
  }
  return summary;
}

export async function listExecutiveEvidenceProjects() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .selectDistinct({ id: projects.id, name: projects.projectName })
    .from(executiveEvidenceUploads)
    .innerJoin(projects, eq(projects.id, executiveEvidenceUploads.projectId))
    .orderBy(projects.projectName);
}

export async function discardExecutiveEvidenceReceipt(input: {
  id: number;
  actorId: number;
  actorName?: string | null;
  reason: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [receipt] = await db
    .select()
    .from(executiveEvidenceUploads)
    .where(eq(executiveEvidenceUploads.id, input.id))
    .limit(1);
  if (!receipt) return { outcome: "not_found" as const, receipt: null };
  const status = deriveExecutiveEvidenceAdminStatus(receipt);
  if (!canDiscardExecutiveEvidence(status)) return { outcome: "not_pending" as const, receipt };

  const discardedAt = new Date();
  const [result] = await db
    .update(executiveEvidenceUploads)
    .set({
      discardedAt,
      discardedBy: input.actorId,
      discardedByName: input.actorName ?? null,
      discardReason: input.reason.trim(),
    })
    .where(and(
      eq(executiveEvidenceUploads.id, input.id),
      eq(executiveEvidenceUploads.uploadStatus, "pending"),
      isNull(executiveEvidenceUploads.discardedAt),
    ));
  const affectedRows = Number((result as { affectedRows?: number }).affectedRows ?? 0);
  return affectedRows === 1
    ? { outcome: "discarded" as const, receipt: { ...receipt, discardedAt } }
    : { outcome: "conflict" as const, receipt };
}

export async function restoreExecutiveEvidenceReceipt(input: {
  id: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [receipt] = await db
    .select()
    .from(executiveEvidenceUploads)
    .where(eq(executiveEvidenceUploads.id, input.id))
    .limit(1);
  if (!receipt) return { outcome: "not_found" as const, receipt: null };
  if (!canRestoreExecutiveEvidence(receipt)) return { outcome: "not_restorable" as const, receipt };

  const [result] = await db
    .update(executiveEvidenceUploads)
    .set({ discardedAt: null, discardedBy: null, discardedByName: null, discardReason: null })
    .where(and(
      eq(executiveEvidenceUploads.id, input.id),
      eq(executiveEvidenceUploads.uploadStatus, "pending"),
      isNotNull(executiveEvidenceUploads.discardedAt),
    ));
  const affectedRows = Number((result as { affectedRows?: number }).affectedRows ?? 0);
  return affectedRows === 1
    ? { outcome: "restored" as const, receipt }
    : { outcome: "conflict" as const, receipt };
}
