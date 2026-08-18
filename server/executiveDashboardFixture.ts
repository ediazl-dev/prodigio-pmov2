export const TANNER_EXECUTIVE_FIXTURE = {
  projectId: 180002,
  cutoffDate: "2026-08-17",
  kind: "fixture" as const,
  purpose: "Validación determinista del Dashboard Ejecutivo v2; no representa un corte productivo.",
};

type ProductionSnapshot = { id: number; cutoffDate: string } | null | undefined;

function toIsoDate(value: Date | string) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.valueOf())) throw new Error("La fecha de corte observada no es válida");
  return parsed.toISOString().slice(0, 10);
}

export function resolveExecutiveDashboardCutoff(input: {
  projectId: number;
  requestedCutoffDate?: string;
  productionSnapshot?: ProductionSnapshot;
  observedAt?: Date | string;
}) {
  if (input.requestedCutoffDate) {
    return { date: input.requestedCutoffDate, kind: "requested" as const, productionSnapshotId: input.productionSnapshot?.id ?? null };
  }

  if (input.productionSnapshot?.cutoffDate) {
    return { date: input.productionSnapshot.cutoffDate, kind: "production" as const, productionSnapshotId: input.productionSnapshot.id };
  }

  return { date: toIsoDate(input.observedAt ?? new Date()), kind: "observed" as const, productionSnapshotId: null };
}
