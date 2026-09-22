import { describe, expect, it } from "vitest";
import { assessExecutiveEvidenceReceipt, EXECUTIVE_EVIDENCE_RECEIPT_TTL_MS } from "./executiveEvidenceReceipt";

const now = new Date("2026-09-22T12:00:00.000Z");
const receipt = {
  projectId: 510001,
  sourceId: 60001,
  documentType: "minute" as const,
  uploadStatus: "pending" as const,
  uploadedBy: 77,
  createdAt: new Date(now.getTime() - 60_000),
};

const assess = (overrides: Partial<Parameters<typeof assessExecutiveEvidenceReceipt>[0]> = {}) =>
  assessExecutiveEvidenceReceipt({
    receipt,
    projectId: 510001,
    sourceId: 60001,
    documentType: "minute",
    actorId: 77,
    now,
    ...overrides,
  });

describe("assessExecutiveEvidenceReceipt", () => {
  it("permite adjuntar una carga pendiente del mismo proyecto, baseline, tipo y usuario", () => {
    expect(assess()).toEqual({ allowed: true });
  });

  it("bloquea reutilización y cruces de proyecto, baseline, tipo o usuario", () => {
    expect(assess({ receipt: { ...receipt, uploadStatus: "attached" } })).toMatchObject({ allowed: false, code: "RECEIPT_ALREADY_ATTACHED" });
    expect(assess({ receipt: { ...receipt, discardedAt: new Date() } })).toMatchObject({ allowed: false, code: "RECEIPT_DISCARDED" });
    expect(assess({ projectId: 180002 })).toMatchObject({ allowed: false, code: "RECEIPT_PROJECT_MISMATCH" });
    expect(assess({ sourceId: 60002 })).toMatchObject({ allowed: false, code: "RECEIPT_SOURCE_MISMATCH" });
    expect(assess({ documentType: "acceptance" })).toMatchObject({ allowed: false, code: "RECEIPT_TYPE_MISMATCH" });
    expect(assess({ actorId: 78 })).toMatchObject({ allowed: false, code: "RECEIPT_ACTOR_MISMATCH" });
  });

  it("rechaza cargas inexistentes o expiradas", () => {
    expect(assess({ receipt: null })).toMatchObject({ allowed: false, code: "RECEIPT_NOT_FOUND" });
    expect(assess({ receipt: { ...receipt, createdAt: new Date(now.getTime() - EXECUTIVE_EVIDENCE_RECEIPT_TTL_MS - 1) } })).toMatchObject({ allowed: false, code: "RECEIPT_EXPIRED" });
  });
});
