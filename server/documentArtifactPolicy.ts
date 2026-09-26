import { createHash } from "node:crypto";
import type { DocumentGovernanceEntityType, DocumentRequirementCode } from "../shared/documentGovernance";

export const DOCUMENT_ARTIFACT_MAX_BYTES = 25 * 1024 * 1024;

const DOCUMENT_FORMATS = [
  { extension: "pdf", mimeType: "application/pdf", signature: "pdf" },
  { extension: "doc", mimeType: "application/msword", signature: "ole" },
  { extension: "docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", signature: "zip" },
  { extension: "xls", mimeType: "application/vnd.ms-excel", signature: "ole" },
  { extension: "xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", signature: "zip" },
  { extension: "ppt", mimeType: "application/vnd.ms-powerpoint", signature: "ole" },
  { extension: "pptx", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", signature: "zip" },
] as const;

export type DocumentActor = { id: number; role: string };

export function assessDocumentArtifactAccess(input: {
  action: "read" | "upload" | "validate" | "not_applicable";
  actor: DocumentActor;
  assignedPmId?: number | null;
}) {
  if (input.action === "read") return { allowed: true, reason: null };
  if (input.action === "validate") {
    return ["admin", "pmo"].includes(input.actor.role)
      ? { allowed: true, reason: null }
      : { allowed: false, reason: "La validación documental requiere rol Admin o PMO." };
  }
  if (input.action === "not_applicable") {
    return input.actor.role === "admin"
      ? { allowed: true, reason: null }
      : { allowed: false, reason: "Sólo Admin puede autorizar una excepción documental." };
  }
  if (["admin", "pmo"].includes(input.actor.role)) return { allowed: true, reason: null };
  if (input.actor.role === "pm" && input.assignedPmId === input.actor.id) return { allowed: true, reason: null };
  return {
    allowed: false,
    reason: input.actor.role === "pm"
      ? "Sólo el PM asignado puede cargar documentos de este expediente."
      : "La carga requiere rol Admin, PMO o PM asignado.",
  };
}

function normalizeBase64(value: string) {
  return value.includes(",") ? value.slice(value.indexOf(",") + 1) : value;
}

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|\x00-\x1F]/g, "_").replace(/\.+/g, ".").trim();
}

function hasSignature(buffer: Buffer, signature: "pdf" | "zip" | "ole") {
  if (signature === "pdf") return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  if (signature === "zip") return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
  return buffer.length >= 8
    && buffer[0] === 0xd0
    && buffer[1] === 0xcf
    && buffer[2] === 0x11
    && buffer[3] === 0xe0
    && buffer[4] === 0xa1
    && buffer[5] === 0xb1
    && buffer[6] === 0x1a
    && buffer[7] === 0xe1;
}

export function validateDocumentArtifactUpload(input: {
  entityType: DocumentGovernanceEntityType;
  entityId: number;
  requirementCode: DocumentRequirementCode;
  fileName: string;
  mimeType: string;
  fileBase64: string;
}) {
  const payload = normalizeBase64(input.fileBase64.trim());
  const buffer = Buffer.from(payload, "base64");
  if (!buffer.length || buffer.length > DOCUMENT_ARTIFACT_MAX_BYTES) {
    throw new Error("El archivo debe tener contenido y no superar 25 MB.");
  }
  const fileName = sanitizeFileName(input.fileName);
  const extension = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "";
  const format = DOCUMENT_FORMATS.find(item => item.extension === extension && item.mimeType === input.mimeType);
  if (!fileName || fileName === "." || !format || !hasSignature(buffer, format.signature)) {
    throw new Error("Formato inválido. Se admite PDF, Word, Excel o PowerPoint y la firma del archivo debe coincidir.");
  }
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  return {
    buffer,
    fileName,
    mimeType: input.mimeType,
    fileSize: buffer.length,
    sha256,
    extension,
    storageKey: `document-governance/${input.entityType}/${input.entityId}/${input.requirementCode}/${sha256}.${extension}`,
  };
}

export function validateDocumentDecision(input: {
  requirementCode: DocumentRequirementCode;
  decision: "valid" | "rejected" | "revoked";
  reason?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  openEndedValidity?: boolean;
  costingChecklist?: Record<string, boolean> | null;
}) {
  if (["rejected", "revoked"].includes(input.decision) && String(input.reason ?? "").trim().length < 5) {
    throw new Error("El rechazo o revocación requiere un motivo de al menos 5 caracteres.");
  }
  if (input.decision === "valid" && !input.openEndedValidity && !input.validUntil) {
    throw new Error("La validación requiere fecha de término o vigencia abierta explícita.");
  }
  if (input.validFrom && input.validUntil && input.validFrom > input.validUntil) {
    throw new Error("La fecha de inicio de vigencia no puede ser posterior a la fecha de término.");
  }
  if (input.requirementCode === "costed_pnl" && input.decision === "valid") {
    const required = ["revenueOrBudget", "cost", "margin", "currency", "cutoffDate", "financialApproval"];
    const missing = required.filter(key => input.costingChecklist?.[key] !== true);
    if (missing.length) throw new Error(`El P&L no puede validarse: faltan ${missing.join(", ")}.`);
  }
  return {
    costingStatus: input.requirementCode === "costed_pnl"
      ? input.decision === "valid" ? "verified" as const : "rejected" as const
      : "not_applicable" as const,
  };
}
