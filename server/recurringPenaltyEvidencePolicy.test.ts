import { describe, expect, it } from "vitest";
import {
  RECURRING_PENALTY_EVIDENCE_MAX_BYTES,
  validateRecurringPenaltyEvidence,
} from "./recurringPenaltyEvidencePolicy";

function encoded(buffer: Buffer) {
  return buffer.toString("base64");
}

describe("validateRecurringPenaltyEvidence", () => {
  it("acepta PDF y genera una clave determinista por hash", () => {
    const result = validateRecurringPenaltyEvidence({
      serviceId: 2100001,
      penaltyId: 7,
      fileName: "multa cliente.pdf",
      mimeType: "application/pdf",
      fileBase64: encoded(Buffer.from("%PDF-1.7\ncontenido")),
    });

    expect(result.fileName).toBe("multa cliente.pdf");
    expect(result.storageKey).toContain("recurring-services/2100001/penalties/7/");
    expect(result.sha256).toHaveLength(64);
  });

  it("rechaza contenido que no coincide con su extensión", () => {
    expect(() => validateRecurringPenaltyEvidence({
      serviceId: 1,
      fileName: "respaldo.pdf",
      mimeType: "application/pdf",
      fileBase64: encoded(Buffer.from("texto plano")),
    })).toThrow("no coincide");
  });

  it("rechaza formatos no soportados", () => {
    expect(() => validateRecurringPenaltyEvidence({
      serviceId: 1,
      fileName: "respaldo.exe",
      mimeType: "application/octet-stream",
      fileBase64: encoded(Buffer.from("MZ")),
    })).toThrow("Formato no soportado");
  });

  it("rechaza archivos vacíos o mayores a 15 MB", () => {
    expect(() => validateRecurringPenaltyEvidence({
      serviceId: 1,
      fileName: "respaldo.pdf",
      mimeType: "application/pdf",
      fileBase64: "",
    })).toThrow("no superar 15 MB");

    expect(() => validateRecurringPenaltyEvidence({
      serviceId: 1,
      fileName: "respaldo.pdf",
      mimeType: "application/pdf",
      fileBase64: encoded(Buffer.alloc(RECURRING_PENALTY_EVIDENCE_MAX_BYTES + 1, 1)),
    })).toThrow("no superar 15 MB");
  });
});
