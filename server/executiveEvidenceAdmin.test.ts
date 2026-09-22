import { describe, expect, it } from "vitest";
import { canDiscardExecutiveEvidence, canRestoreExecutiveEvidence, deriveExecutiveEvidenceAdminStatus } from "./executiveEvidenceAdmin";
import { EXECUTIVE_EVIDENCE_RECEIPT_TTL_MS } from "./executiveEvidenceReceipt";

const now = new Date("2026-09-22T12:00:00.000Z");
const pending = {
  uploadStatus: "pending" as const,
  createdAt: new Date(now.getTime() - 60_000),
  discardedAt: null,
};

describe("executive evidence admin status", () => {
  it("distingue pendiente, expirado, adjunto y descartado", () => {
    expect(deriveExecutiveEvidenceAdminStatus(pending, now)).toBe("pending");
    expect(deriveExecutiveEvidenceAdminStatus({ ...pending, createdAt: new Date(now.getTime() - EXECUTIVE_EVIDENCE_RECEIPT_TTL_MS - 1) }, now)).toBe("expired");
    expect(deriveExecutiveEvidenceAdminStatus({ ...pending, uploadStatus: "attached" }, now)).toBe("attached");
    expect(deriveExecutiveEvidenceAdminStatus({ ...pending, discardedAt: new Date() }, now)).toBe("discarded");
  });

  it("permite descartar sólo pendientes vigentes o expirados", () => {
    expect(canDiscardExecutiveEvidence("pending")).toBe(true);
    expect(canDiscardExecutiveEvidence("expired")).toBe(true);
    expect(canDiscardExecutiveEvidence("attached")).toBe(false);
    expect(canDiscardExecutiveEvidence("discarded")).toBe(false);
  });

  it("permite restaurar un descarte vigente, pero no uno expirado", () => {
    expect(canRestoreExecutiveEvidence({ ...pending, discardedAt: new Date() }, now)).toBe(true);
    expect(canRestoreExecutiveEvidence({
      ...pending,
      discardedAt: new Date(),
      createdAt: new Date(now.getTime() - EXECUTIVE_EVIDENCE_RECEIPT_TTL_MS - 1),
    }, now)).toBe(false);
  });
});
