import { describe, expect, it } from "vitest";
import { validateExecutiveEvidenceUpload } from "./routers";

const base64 = (value: string) => Buffer.from(value, "binary").toString("base64");

describe("validateExecutiveEvidenceUpload", () => {
  it("acepta una acta PDF con firma válida y genera SHA-256", () => {
    const result = validateExecutiveEvidenceUpload({
      documentType: "acceptance",
      fileName: "Acta M01.pdf",
      mimeType: "application/pdf",
      contentBase64: base64("%PDF-1.7 evidencia contractual"),
    });
    expect(result.fileName).toBe("Acta M01.pdf");
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("permite DOCX para minuta, pero no para un acta contractual", () => {
    const docx = base64("PK\x03\x04contenido docx");
    expect(validateExecutiveEvidenceUpload({ documentType: "minute", fileName: "Minuta.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", contentBase64: docx }).fileName).toBe("Minuta.docx");
    expect(() => validateExecutiveEvidenceUpload({ documentType: "acceptance", fileName: "Acta.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", contentBase64: docx })).toThrow(/Formato inválido/);
  });

  it("rechaza extensiones, MIME o firmas inconsistentes", () => {
    expect(() => validateExecutiveEvidenceUpload({ documentType: "recovery_plan", fileName: "PRD.pdf", mimeType: "application/pdf", contentBase64: base64("archivo sin firma") })).toThrow(/Formato inválido/);
    expect(() => validateExecutiveEvidenceUpload({ documentType: "minute", fileName: "Minuta.exe", mimeType: "application/pdf", contentBase64: base64("%PDF-1.7") })).toThrow(/Formato inválido/);
  });

  it("rechaza un documento que supera el límite de 25 MB", () => {
    const oversizedPdf = Buffer.concat([
      Buffer.from("%PDF-1.7 evidencia contractual\n", "binary"),
      Buffer.alloc(25 * 1024 * 1024),
    ]).toString("base64");
    expect(() => validateExecutiveEvidenceUpload({
      documentType: "acceptance",
      fileName: "Acta-sobredimensionada.pdf",
      mimeType: "application/pdf",
      contentBase64: oversizedPdf,
    })).toThrow(/25 MB/);
  });
});
