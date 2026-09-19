export const JIRA_EVIDENCE_TTL_HOURS = 36;
export const JIRA_EVIDENCE_TTL_MS = JIRA_EVIDENCE_TTL_HOURS * 60 * 60 * 1000;

export type JiraSnapshotStatus = "success" | "partial" | "error";
export type EvidenceAvailability = "available" | "partial" | "stale" | "error" | "missing";

export interface JiraEvidenceCandidate {
  status: JiraSnapshotStatus;
  lastSuccessAt: Date | string | null;
  capturedAt?: Date | string | null;
  sourceUpdatedAt?: Date | string | null;
  errorCode?: string | null;
}

export interface JiraEvidenceAssessment<T extends JiraEvidenceCandidate> {
  snapshot: T | null;
  availability: EvidenceAvailability;
  usable: boolean;
  stale: boolean;
  evidenceAt: string | null;
  capturedAt: string | null;
  sourceUpdatedAt: string | null;
  ageHours: number | null;
  reason: "fresh_success" | "fresh_partial" | "expired" | "snapshot_error" | "no_success" | "missing";
  errorCode: string | null;
}

export function toEvidenceIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function assessJiraEvidence<T extends JiraEvidenceCandidate>(
  snapshot: T | null | undefined,
  generatedAt: Date | string,
  ttlMs = JIRA_EVIDENCE_TTL_MS,
): JiraEvidenceAssessment<T> {
  if (!snapshot) {
    return {
      snapshot: null,
      availability: "missing",
      usable: false,
      stale: true,
      evidenceAt: null,
      capturedAt: null,
      sourceUpdatedAt: null,
      ageHours: null,
      reason: "missing",
      errorCode: null,
    };
  }

  const evidenceAt = toEvidenceIso(snapshot.lastSuccessAt);
  const capturedAt = toEvidenceIso(snapshot.capturedAt);
  const sourceUpdatedAt = toEvidenceIso(snapshot.sourceUpdatedAt);
  if (!evidenceAt) {
    return {
      snapshot,
      availability: snapshot.status === "error" ? "error" : "missing",
      usable: false,
      stale: true,
      evidenceAt: null,
      capturedAt,
      sourceUpdatedAt,
      ageHours: null,
      reason: snapshot.status === "error" ? "snapshot_error" : "no_success",
      errorCode: snapshot.errorCode ?? null,
    };
  }

  const generatedMs = new Date(generatedAt).getTime();
  const evidenceMs = new Date(evidenceAt).getTime();
  const ageMs = generatedMs - evidenceMs;
  const ageHours = Number.isFinite(ageMs) ? Math.max(0, ageMs / (60 * 60 * 1000)) : null;

  if (snapshot.status === "error") {
    return {
      snapshot,
      availability: "error",
      usable: false,
      stale: true,
      evidenceAt,
      capturedAt,
      sourceUpdatedAt,
      ageHours,
      reason: "snapshot_error",
      errorCode: snapshot.errorCode ?? null,
    };
  }

  if (ageMs > ttlMs) {
    return {
      snapshot,
      availability: "stale",
      usable: false,
      stale: true,
      evidenceAt,
      capturedAt,
      sourceUpdatedAt,
      ageHours,
      reason: "expired",
      errorCode: snapshot.errorCode ?? null,
    };
  }

  return {
    snapshot,
    availability: snapshot.status === "partial" ? "partial" : "available",
    usable: true,
    stale: false,
    evidenceAt,
    capturedAt,
    sourceUpdatedAt,
    ageHours,
    reason: snapshot.status === "partial" ? "fresh_partial" : "fresh_success",
    errorCode: snapshot.errorCode ?? null,
  };
}

export function evidenceValue<T>(
  assessment: JiraEvidenceAssessment<JiraEvidenceCandidate>,
  value: T | null | undefined,
): T | null {
  return assessment.usable && value !== null && value !== undefined ? value : null;
}

export function normalizeEvidenceCurrency(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase() ?? "";
  if (!normalized || normalized === "N/D" || normalized === "ND" || normalized === "N.A.") return null;
  return normalized;
}
