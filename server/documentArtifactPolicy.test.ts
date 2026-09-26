import { describe, expect, it } from "vitest";
import {
  DOCUMENT_ARTIFACT_MAX_BYTES,
  assessDocumentArtifactAccess,
  validateDocumentArtifactUpload,
  validateDocumentDecision,
} from "./documentArtifactPolicy";

const asBase64 = (buffer: Buffer) => buffer.toString("base64");

describe("documentArtifactPolicy", () => {
  it("permite carga a Admin, PMO y al PM asignado, pero no a Consulta ni a otro PM", () => {
    expect(assessDocumentArtifactAccess({ action: "upload", actor: { id: 1, role: "admin" } }).allowed).toBe(true);
    expect(assessDocumentArtifactAccess({ action: "upload", actor: { id: 2, role: "pmo" } }).allowed).toBe(true);
    expect(assessDocumentArtifactAccess({ action: "upload", actor: { id: 3, role: "pm" }, assignedPmId: 3 }).allowed).toBe(true);
    expect(assessDocumentArtifactAccess({ action: "upload", actor: { id: 4, role: "pm" }, assignedPmId: 3 }).allowed).toBe(false);
    expect(assessDocumentArtifactAccess({ action: "upload", actor: { id: 5, role: "consulta" } }).allowed).toBe(false);
  });

  it("restringe validación a Admin/PMO y excepciones a Admin", () => {
    expect(assessDocumentArtifactAccess({ action: "validate", actor: { id: 1, role: "pmo" } }).allowed).toBe(true);
    expect(assessDocumentArtifactAccess({ action: "validate", actor: { id: 2, role: "pm" } }).allowed).toBe(false);
    expect(assessDocumentArtifactAccess({ action: "not_applicable", actor: { id: 1, role: "admin" } }).allowed).toBe(true);
    expect(assessDocumentArtifactAccess({ action: "not_applicable", actor: { id: 2, role: "pmo" } }).allowed).toBe(false);
  });

  it("valida tamaño, nombre, MIME, firma y hash de un PDF", () => {
    const result = validateDocumentArtifactUpload({
      entityType: "project",
      entityId: 7,
      requirementCode: "contract",
      fileName: "Contrato:cliente.pdf",
      mimeType: "application/pdf",
      fileBase64: asBase64(Buffer.from("%PDF-1.7 contrato")),
    });
    expect(result.fileName).toBe("Contrato_cliente.pdf");
    expect(result.fileSize).toBeGreaterThan(0);
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.storageKey).toContain("document-governance/project/7/contract/");
  });

  it("rechaza extensión, MIME o firma discordantes", () => {
    expect(() => validateDocumentArtifactUpload({
      entityType: "recurring_service",
      entityId: 1,
      requirementCode: "sow",
      fileName: "sow.exe",
      mimeType: "application/pdf",
      fileBase64: asBase64(Buffer.from("%PDF-1.7")),
    })).toThrow(/Formato inválido/);
    expect(() => validateDocumentArtifactUpload({
      entityType: "recurring_service",
      entityId: 1,
      requirementCode: "sow",
      fileName: "sow.pdf",
      mimeType: "application/pdf",
      fileBase64: asBase64(Buffer.from("contenido sin firma")),
    })).toThrow(/Formato inválido/);
  });

  it("rechaza archivos vacíos o superiores a 25 MB", () => {
    expect(() => validateDocumentArtifactUpload({
      entityType: "project", entityId: 1, requirementCode: "sow", fileName: "sow.pdf", mimeType: "application/pdf", fileBase64: "",
    })).toThrow(/contenido/);
    expect(() => validateDocumentArtifactUpload({
      entityType: "project", entityId: 1, requirementCode: "sow", fileName: "sow.pdf", mimeType: "application/pdf",
      fileBase64: asBase64(Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(DOCUMENT_ARTIFACT_MAX_BYTES)])),
    })).toThrow(/25 MB/);
  });

  it("exige vigencia explícita y motivo para rechazo o revocación", () => {
    expect(() => validateDocumentDecision({ requirementCode: "contract", decision: "valid" })).toThrow(/vigencia/);
    expect(() => validateDocumentDecision({ requirementCode: "contract", decision: "rejected", reason: "no" })).toThrow(/motivo/);
    expect(validateDocumentDecision({ requirementCode: "contract", decision: "valid", openEndedValidity: true }).costingStatus).toBe("not_applicable");
  });

  it("no valida un P&L sin todos los controles financieros", () => {
    expect(() => validateDocumentDecision({
      requirementCode: "costed_pnl",
      decision: "valid",
      openEndedValidity: true,
      costingChecklist: { revenueOrBudget: true, cost: true },
    })).toThrow(/faltan/);
    expect(validateDocumentDecision({
      requirementCode: "costed_pnl",
      decision: "valid",
      openEndedValidity: true,
      costingChecklist: {
        revenueOrBudget: true,
        cost: true,
        margin: true,
        currency: true,
        cutoffDate: true,
        financialApproval: true,
      },
    }).costingStatus).toBe("verified");
  });
});
