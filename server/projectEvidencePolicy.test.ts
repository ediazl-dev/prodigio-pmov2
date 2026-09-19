import { describe, expect, it } from "vitest";
import {
  JIRA_EVIDENCE_TTL_HOURS,
  assessJiraEvidence,
  evidenceValue,
  normalizeEvidenceCurrency,
} from "./projectEvidencePolicy";

const generatedAt = "2026-09-19T05:00:00.000Z";

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    status: "success" as const,
    lastSuccessAt: "2026-09-19T04:00:00.000Z",
    capturedAt: "2026-09-19T04:05:00.000Z",
    sourceUpdatedAt: "2026-09-19T03:55:00.000Z",
    errorCode: null,
    ...overrides,
  };
}

describe("projectEvidencePolicy", () => {
  it("acepta success reciente y conserva timestamps", () => {
    const result = assessJiraEvidence(snapshot(), generatedAt);
    expect(result).toMatchObject({
      availability: "available",
      usable: true,
      stale: false,
      reason: "fresh_success",
      evidenceAt: "2026-09-19T04:00:00.000Z",
      capturedAt: "2026-09-19T04:05:00.000Z",
      sourceUpdatedAt: "2026-09-19T03:55:00.000Z",
    });
  });

  it("acepta partial reciente por campo, sin inventar campos ausentes", () => {
    const result = assessJiraEvidence(snapshot({ status: "partial", errorCode: "FIELD_MISSING" }), generatedAt);
    expect(result).toMatchObject({ availability: "partial", usable: true, stale: false, reason: "fresh_partial" });
    expect(evidenceValue(result, "Construcción + QA")).toBe("Construcción + QA");
    expect(evidenceValue(result, null)).toBeNull();
  });

  it("bloquea error aunque conserve lastSuccessAt", () => {
    const result = assessJiraEvidence(snapshot({ status: "error", errorCode: "JIRA_DOWN" }), generatedAt);
    expect(result).toMatchObject({ availability: "error", usable: false, stale: true, reason: "snapshot_error" });
    expect(evidenceValue(result, 41)).toBeNull();
  });

  it(`bloquea evidencia con más de ${JIRA_EVIDENCE_TTL_HOURS} horas`, () => {
    const result = assessJiraEvidence(snapshot({ lastSuccessAt: "2026-09-17T16:59:59.000Z" }), generatedAt);
    expect(result).toMatchObject({ availability: "stale", usable: false, stale: true, reason: "expired" });
  });

  it("marca ausencia sin convertirla en cero", () => {
    const result = assessJiraEvidence(null, generatedAt);
    expect(result).toMatchObject({ availability: "missing", usable: false, evidenceAt: null });
    expect(evidenceValue(result, 0)).toBeNull();
  });

  it("rechaza monedas ausentes o N/D y normaliza las válidas", () => {
    expect(normalizeEvidenceCurrency(null)).toBeNull();
    expect(normalizeEvidenceCurrency(" n/d ")).toBeNull();
    expect(normalizeEvidenceCurrency("nd")).toBeNull();
    expect(normalizeEvidenceCurrency(" uf ")).toBe("UF");
    expect(normalizeEvidenceCurrency("usd")).toBe("USD");
  });
});
