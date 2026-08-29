import { createHash } from "node:crypto";

export const LINKED_PROJECT_DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;

export const H6_DOCUMENT_OWNERSHIP = {
  sow: { entity: "linked_project_documents", projectScoped: true, milestoneScoped: false },
  gantt: { entity: "linked_project_documents", projectScoped: true, milestoneScoped: false },
  milestone_acceptance: { entity: "executive_milestone_acceptances", projectScoped: true, milestoneScoped: true },
} as const;

export function getH6DocumentOwner(kind: keyof typeof H6_DOCUMENT_OWNERSHIP) {
  return H6_DOCUMENT_OWNERSHIP[kind];
}

const ALLOWED_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "mpp", "png", "jpg", "jpeg", "csv",
]);

export function assessLinkedProjectDocumentOperator(input: {
  role: string;
  userId: number;
  assignedPmId: number | null;
}) {
  if (["admin", "pmo"].includes(input.role)) return { allowed: true, reason: null };
  if (input.role === "pm" && input.assignedPmId === input.userId) return { allowed: true, reason: null };
  return {
    allowed: false,
    reason: input.role === "pm"
      ? "Solo el PM asignado al proyecto puede administrar sus documentos"
      : "Requiere rol Admin, PMO o PM asignado",
  };
}

export function validateLinkedProjectDocumentUpload(input: {
  projectId: number;
  docType: "sow" | "gantt";
  fileName: string;
  fileBase64: string;
  mimeType?: string | null;
}) {
  const payload = input.fileBase64.includes(",")
    ? input.fileBase64.slice(input.fileBase64.indexOf(",") + 1)
    : input.fileBase64;
  const buffer = Buffer.from(payload, "base64");
  if (!buffer.length || buffer.length > LINKED_PROJECT_DOCUMENT_MAX_BYTES) {
    throw new Error("El archivo debe tener contenido y no superar 25 MB");
  }

  const fileName = input.fileName
    .replace(/[\\/:*?"<>|\x00-\x1F]/g, "_")
    .replace(/\.+/g, ".")
    .trim();
  const extension = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "";
  if (!fileName || fileName === "." || !ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error("Tipo de archivo no soportado para SoW o Gantt");
  }

  const sha256 = createHash("sha256").update(buffer).digest("hex");
  return {
    buffer,
    fileName,
    fileSize: buffer.length,
    mimeType: input.mimeType?.trim() || "application/octet-stream",
    sha256,
    storageKey: `linked-docs/${input.projectId}/${input.docType}/${sha256}.${extension}`,
  };
}
