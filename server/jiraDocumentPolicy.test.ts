import { describe, expect, it } from "vitest";
import {
  LINKED_PROJECT_DOCUMENT_MAX_BYTES,
  assessLinkedProjectDocumentOperator,
  getH6DocumentOwner,
  validateLinkedProjectDocumentUpload,
} from "./jiraDocumentPolicy";

describe("jiraDocumentPolicy H6", () => {
  it("autoriza Admin/PMO y solo al PM asignado", () => {
    expect(assessLinkedProjectDocumentOperator({ role: "admin", userId: 1, assignedPmId: null }).allowed).toBe(true);
    expect(assessLinkedProjectDocumentOperator({ role: "pmo", userId: 2, assignedPmId: null }).allowed).toBe(true);
    expect(assessLinkedProjectDocumentOperator({ role: "pm", userId: 7, assignedPmId: 7 }).allowed).toBe(true);
    expect(assessLinkedProjectDocumentOperator({ role: "pm", userId: 8, assignedPmId: 7 }).allowed).toBe(false);
    expect(assessLinkedProjectDocumentOperator({ role: "consulta", userId: 7, assignedPmId: 7 }).allowed).toBe(false);
  });

  it("genera la misma clave S3 para reintentos del mismo archivo", () => {
    const input = {
      projectId: 42,
      docType: "sow" as const,
      fileName: "Contrato firmado.pdf",
      fileBase64: Buffer.from("contenido real").toString("base64"),
      mimeType: "application/pdf",
    };
    const first = validateLinkedProjectDocumentUpload(input);
    const second = validateLinkedProjectDocumentUpload(input);
    expect(first.storageKey).toBe(second.storageKey);
    expect(first.storageKey).toMatch(/^linked-docs\/42\/sow\/[a-f0-9]{64}\.pdf$/);
    expect(first.fileSize).toBe(Buffer.byteLength("contenido real"));
  });

  it("mantiene SoW/Gantt por proyecto y actas en la entidad canónica del hito", () => {
    expect(getH6DocumentOwner("sow")).toEqual({
      entity: "linked_project_documents",
      projectScoped: true,
      milestoneScoped: false,
    });
    expect(getH6DocumentOwner("gantt").entity).toBe("linked_project_documents");
    expect(getH6DocumentOwner("milestone_acceptance")).toEqual({
      entity: "executive_milestone_acceptances",
      projectScoped: true,
      milestoneScoped: true,
    });
  });

  it("sanitiza el nombre y rechaza archivos ausentes, sobredimensionados o no admitidos", () => {
    const valid = validateLinkedProjectDocumentUpload({
      projectId: 1,
      docType: "gantt",
      fileName: "..\\plan:gantt.xlsx",
      fileBase64: Buffer.from("xlsx").toString("base64"),
    });
    expect(valid.fileName).toBe("._plan_gantt.xlsx");

    expect(() => validateLinkedProjectDocumentUpload({
      projectId: 1,
      docType: "sow",
      fileName: "vacío.pdf",
      fileBase64: "",
    })).toThrow("contenido");
    expect(() => validateLinkedProjectDocumentUpload({
      projectId: 1,
      docType: "sow",
      fileName: "script.exe",
      fileBase64: Buffer.from("x").toString("base64"),
    })).toThrow("no soportado");
    expect(() => validateLinkedProjectDocumentUpload({
      projectId: 1,
      docType: "sow",
      fileName: "enorme.pdf",
      fileBase64: Buffer.alloc(LINKED_PROJECT_DOCUMENT_MAX_BYTES + 1).toString("base64"),
    })).toThrow("25 MB");
  });
});
