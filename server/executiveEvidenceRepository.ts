import { and, eq, isNull } from "drizzle-orm";
import {
  executiveCommitments,
  executiveContractMilestones,
  executiveEvidenceUploads,
  executiveMeetingMinutes,
  executiveMilestoneAcceptances,
  executiveRecoveryPlans,
  type InsertExecutiveEvidenceUpload,
} from "../drizzle/schema";
import { getDb } from "./db";
import {
  ExecutiveEvidenceReceiptError,
  requireExecutiveEvidenceReceipt,
  type ExecutiveEvidenceDocumentType,
} from "./executiveEvidenceReceipt";

export class ExecutiveEvidencePersistenceError extends Error {
  constructor(
    public readonly code: "RECEIPT_CLAIM_FAILED" | "MILESTONE_NOT_FOUND" | "MILESTONE_ALREADY_ACCEPTED",
    message: string,
  ) {
    super(message);
    this.name = "ExecutiveEvidencePersistenceError";
  }
}

export async function createExecutiveEvidenceUploadReceipt(data: InsertExecutiveEvidenceUpload) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(executiveEvidenceUploads).values(data);
  const [receipt] = await db
    .select()
    .from(executiveEvidenceUploads)
    .where(eq(executiveEvidenceUploads.receiptToken, data.receiptToken))
    .limit(1);
  if (!receipt) throw new Error("No fue posible persistir el recibo de evidencia");
  return receipt;
}

export async function getExecutiveEvidenceUploadReceipt(receiptToken: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [receipt] = await db
    .select()
    .from(executiveEvidenceUploads)
    .where(eq(executiveEvidenceUploads.receiptToken, receiptToken))
    .limit(1);
  return receipt;
}

async function requireAndClaimReceipt(
  tx: any,
  input: {
    receiptToken: string;
    projectId: number;
    sourceId: number;
    documentType: ExecutiveEvidenceDocumentType;
    actorId: number;
  },
) {
  const [receipt] = await tx
    .select()
    .from(executiveEvidenceUploads)
    .where(eq(executiveEvidenceUploads.receiptToken, input.receiptToken))
    .limit(1);
  requireExecutiveEvidenceReceipt({ receipt, ...input });
  const [claimResult] = await tx
    .update(executiveEvidenceUploads)
    .set({ uploadStatus: "attached", attachedEntityType: input.documentType })
    .where(and(
      eq(executiveEvidenceUploads.id, receipt.id),
      eq(executiveEvidenceUploads.uploadStatus, "pending"),
      isNull(executiveEvidenceUploads.discardedAt),
    ));
  const affectedRows = Number((claimResult as { affectedRows?: number }).affectedRows ?? 0);
  if (affectedRows !== 1) {
    throw new ExecutiveEvidencePersistenceError("RECEIPT_CLAIM_FAILED", "El archivo ya fue utilizado por otra operación");
  }
  return receipt;
}

async function finishReceipt(tx: any, receiptId: number, entityId: number) {
  await tx
    .update(executiveEvidenceUploads)
    .set({ attachedEntityId: entityId, attachedAt: new Date() })
    .where(eq(executiveEvidenceUploads.id, receiptId));
}

export async function attachExecutiveMinuteWithReceipt(input: {
  receiptToken: string;
  projectId: number;
  sourceId: number;
  meetingDate: string;
  isoWeek: string;
  title: string;
  commitments: Array<{
    title: string;
    ownerName?: string | null;
    dueDate?: string | null;
    notes?: string | null;
  }>;
  actorId: number;
  actorName?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async tx => {
    const receipt = await requireAndClaimReceipt(tx, { ...input, documentType: "minute" });
    const [minuteResult] = await tx.insert(executiveMeetingMinutes).values({
      projectId: input.projectId,
      sourceId: input.sourceId,
      meetingDate: input.meetingDate,
      isoWeek: input.isoWeek,
      title: input.title,
      fileName: receipt.fileName,
      fileUrl: receipt.fileUrl,
      fileSha256: receipt.fileSha256,
      reviewStatus: "received",
      uploadedBy: input.actorId,
      uploadedByName: input.actorName ?? null,
    });
    const minuteId = Number((minuteResult as { insertId?: number }).insertId);
    const commitmentIds: number[] = [];
    for (const commitment of input.commitments) {
      const [commitmentResult] = await tx.insert(executiveCommitments).values({
        projectId: input.projectId,
        minuteId,
        title: commitment.title,
        ownerName: commitment.ownerName ?? null,
        dueDate: commitment.dueDate ?? null,
        notes: commitment.notes ?? null,
        commitmentStatus: "open",
      });
      commitmentIds.push(Number((commitmentResult as { insertId?: number }).insertId));
    }
    await finishReceipt(tx, receipt.id, minuteId);
    return { minuteId, commitmentIds, receipt };
  });
}

export async function attachExecutiveMilestoneAcceptanceWithReceipt(input: {
  receiptToken: string;
  projectId: number;
  sourceId: number;
  milestoneId: number;
  acceptedAt: string;
  notes?: string | null;
  actorId: number;
  actorName?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async tx => {
    const [milestone] = await tx
      .select({ id: executiveContractMilestones.id, milestoneCode: executiveContractMilestones.milestoneCode })
      .from(executiveContractMilestones)
      .where(and(
        eq(executiveContractMilestones.id, input.milestoneId),
        eq(executiveContractMilestones.projectId, input.projectId),
        eq(executiveContractMilestones.sourceId, input.sourceId),
      ))
      .limit(1);
    if (!milestone) {
      throw new ExecutiveEvidencePersistenceError("MILESTONE_NOT_FOUND", "El hito contractual no pertenece al baseline vigente del proyecto");
    }
    const [existing] = await tx
      .select({ id: executiveMilestoneAcceptances.id })
      .from(executiveMilestoneAcceptances)
      .where(and(
        eq(executiveMilestoneAcceptances.projectId, input.projectId),
        eq(executiveMilestoneAcceptances.sourceId, input.sourceId),
        eq(executiveMilestoneAcceptances.milestoneId, input.milestoneId),
        eq(executiveMilestoneAcceptances.acceptanceStatus, "accepted"),
      ))
      .limit(1);
    if (existing) {
      throw new ExecutiveEvidencePersistenceError("MILESTONE_ALREADY_ACCEPTED", "El hito ya cuenta con un acta de aceptación vigente");
    }
    const receipt = await requireAndClaimReceipt(tx, { ...input, documentType: "acceptance" });
    const [result] = await tx.insert(executiveMilestoneAcceptances).values({
      projectId: input.projectId,
      sourceId: input.sourceId,
      milestoneId: input.milestoneId,
      acceptedAt: input.acceptedAt,
      evidenceFileName: receipt.fileName,
      evidenceUrl: receipt.fileUrl,
      evidenceSha256: receipt.fileSha256,
      acceptanceStatus: "accepted",
      notes: input.notes ?? null,
      recordedBy: input.actorId,
      recordedByName: input.actorName ?? null,
    });
    const id = Number((result as { insertId?: number }).insertId);
    await finishReceipt(tx, receipt.id, id);
    return { id, milestoneCode: milestone.milestoneCode, receipt };
  });
}

export async function attachExecutiveRecoveryPlanWithReceipt(input: {
  receiptToken: string;
  projectId: number;
  sourceId: number;
  version: string;
  dueDate: string;
  summary: string;
  actorId: number;
  actorName?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async tx => {
    const receipt = await requireAndClaimReceipt(tx, { ...input, documentType: "recovery_plan" });
    const [result] = await tx.insert(executiveRecoveryPlans).values({
      projectId: input.projectId,
      sourceId: input.sourceId,
      version: input.version,
      dueDate: input.dueDate,
      fileName: receipt.fileName,
      fileUrl: receipt.fileUrl,
      fileSha256: receipt.fileSha256,
      summary: input.summary,
      recoveryStatus: "draft",
    });
    const id = Number((result as { insertId?: number }).insertId);
    await finishReceipt(tx, receipt.id, id);
    return { id, receipt };
  });
}

export { ExecutiveEvidenceReceiptError };
