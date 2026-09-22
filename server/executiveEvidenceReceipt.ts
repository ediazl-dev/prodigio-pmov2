export const EXECUTIVE_EVIDENCE_RECEIPT_TTL_MS = 24 * 60 * 60 * 1000;

export type ExecutiveEvidenceDocumentType = "minute" | "acceptance" | "recovery_plan";

export type ExecutiveEvidenceReceiptLike = {
  projectId: number;
  sourceId: number;
  documentType: ExecutiveEvidenceDocumentType;
  uploadStatus: "pending" | "attached";
  uploadedBy: number;
  createdAt: Date | string;
  discardedAt?: Date | string | null;
};

export type ExecutiveEvidenceReceiptAssessment =
  | { allowed: true }
  | {
      allowed: false;
      code: "RECEIPT_NOT_FOUND" | "RECEIPT_ALREADY_ATTACHED" | "RECEIPT_DISCARDED" | "RECEIPT_PROJECT_MISMATCH" | "RECEIPT_SOURCE_MISMATCH" | "RECEIPT_TYPE_MISMATCH" | "RECEIPT_ACTOR_MISMATCH" | "RECEIPT_EXPIRED";
      reason: string;
    };

export function assessExecutiveEvidenceReceipt(input: {
  receipt: ExecutiveEvidenceReceiptLike | null | undefined;
  projectId: number;
  sourceId: number;
  documentType: ExecutiveEvidenceDocumentType;
  actorId: number;
  now?: Date;
}): ExecutiveEvidenceReceiptAssessment {
  const { receipt } = input;
  if (!receipt) {
    return { allowed: false, code: "RECEIPT_NOT_FOUND", reason: "La carga validada no existe o ya no está disponible" };
  }
  if (receipt.discardedAt) {
    return { allowed: false, code: "RECEIPT_DISCARDED", reason: "El documento pendiente fue descartado por administración" };
  }
  if (receipt.uploadStatus !== "pending") {
    return { allowed: false, code: "RECEIPT_ALREADY_ATTACHED", reason: "El archivo ya fue adjuntado a otro registro" };
  }
  if (receipt.projectId !== input.projectId) {
    return { allowed: false, code: "RECEIPT_PROJECT_MISMATCH", reason: "El archivo cargado pertenece a otro proyecto" };
  }
  if (receipt.sourceId !== input.sourceId) {
    return { allowed: false, code: "RECEIPT_SOURCE_MISMATCH", reason: "El archivo cargado pertenece a otra versión del baseline" };
  }
  if (receipt.documentType !== input.documentType) {
    return { allowed: false, code: "RECEIPT_TYPE_MISMATCH", reason: "El tipo del archivo no corresponde al registro solicitado" };
  }
  if (receipt.uploadedBy !== input.actorId) {
    return { allowed: false, code: "RECEIPT_ACTOR_MISMATCH", reason: "El archivo fue cargado por otro usuario" };
  }
  const createdAtMs = new Date(receipt.createdAt).getTime();
  const nowMs = (input.now ?? new Date()).getTime();
  if (!Number.isFinite(createdAtMs) || nowMs - createdAtMs > EXECUTIVE_EVIDENCE_RECEIPT_TTL_MS) {
    return { allowed: false, code: "RECEIPT_EXPIRED", reason: "La carga validada expiró; vuelve a seleccionar el archivo" };
  }
  return { allowed: true };
}

export class ExecutiveEvidenceReceiptError extends Error {
  constructor(
    public readonly code: Exclude<ExecutiveEvidenceReceiptAssessment, { allowed: true }>["code"],
    message: string,
  ) {
    super(message);
    this.name = "ExecutiveEvidenceReceiptError";
  }
}

export function requireExecutiveEvidenceReceipt(input: Parameters<typeof assessExecutiveEvidenceReceipt>[0]) {
  const assessment = assessExecutiveEvidenceReceipt(input);
  if (!assessment.allowed) throw new ExecutiveEvidenceReceiptError(assessment.code, assessment.reason);
  return input.receipt!;
}
