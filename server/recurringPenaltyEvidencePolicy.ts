import { createHash } from "node:crypto";

export const RECURRING_PENALTY_EVIDENCE_MAX_BYTES = 15 * 1024 * 1024;

const ALLOWED_MIME_BY_EXTENSION: Record<string, Set<string>> = {
  pdf: new Set(["application/pdf"]),
  png: new Set(["image/png"]),
  jpg: new Set(["image/jpeg"]),
  jpeg: new Set(["image/jpeg"]),
  doc: new Set(["application/msword", "application/octet-stream"]),
  docx: new Set(["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip", "application/octet-stream"]),
  xls: new Set(["application/vnd.ms-excel", "application/octet-stream"]),
  xlsx: new Set(["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip", "application/octet-stream"]),
};

function hasExpectedMagic(buffer: Buffer, extension: string): boolean {
  if (extension === "pdf") return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  if (extension === "png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (extension === "jpg" || extension === "jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (extension === "docx" || extension === "xlsx") return buffer[0] === 0x50 && buffer[1] === 0x4b;
  return true;
}

export function validateRecurringPenaltyEvidence(input: {
  serviceId: number;
  penaltyId?: number | null;
  fileName: string;
  fileBase64: string;
  mimeType?: string | null;
}) {
  const payload = input.fileBase64.includes(",")
    ? input.fileBase64.slice(input.fileBase64.indexOf(",") + 1)
    : input.fileBase64;
  const buffer = Buffer.from(payload, "base64");
  if (!buffer.length || buffer.length > RECURRING_PENALTY_EVIDENCE_MAX_BYTES) {
    throw new Error("El respaldo debe tener contenido y no superar 15 MB");
  }

  const fileName = input.fileName
    .replace(/[\\/:*?"<>|\x00-\x1F]/g, "_")
    .replace(/\.+/g, ".")
    .trim();
  const extension = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "";
  const allowedMimes = ALLOWED_MIME_BY_EXTENSION[extension];
  if (!fileName || fileName === "." || !allowedMimes) {
    throw new Error("Formato no soportado. Usa PDF, PNG, JPG, DOC, DOCX, XLS o XLSX");
  }

  const mimeType = input.mimeType?.trim().toLowerCase() || "application/octet-stream";
  if (!allowedMimes.has(mimeType)) {
    throw new Error("El tipo MIME no coincide con la extensión del respaldo");
  }
  if (!hasExpectedMagic(buffer, extension)) {
    throw new Error("El contenido del archivo no coincide con su extensión");
  }

  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const storageKey = `recurring-services/${input.serviceId}/penalties/${input.penaltyId ?? "new"}/${sha256}.${extension}`;
  return { buffer, fileName, fileSize: buffer.length, mimeType, sha256, storageKey };
}
