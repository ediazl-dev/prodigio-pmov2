export const TANNER_EXECUTIVE_FIXTURE = {
  projectId: 180002,
  cutoffDate: "2026-08-17",
  kind: "fixture" as const,
  purpose: "Validación determinista del Dashboard Ejecutivo v2; no representa un corte productivo.",
};

type ProductionSnapshot = { id: number; cutoffDate: string } | null | undefined;

export function resolveExecutiveDashboardCutoff(input: {
  projectId: number;
  requestedCutoffDate?: string;
  productionSnapshot?: ProductionSnapshot;
}) {
  if (input.requestedCutoffDate) {
    return { date: input.requestedCutoffDate, kind: "requested" as const, productionSnapshotId: input.productionSnapshot?.id ?? null };
  }

  if (input.productionSnapshot?.cutoffDate) {
    return { date: input.productionSnapshot.cutoffDate, kind: "production" as const, productionSnapshotId: input.productionSnapshot.id };
  }

  if (input.projectId === TANNER_EXECUTIVE_FIXTURE.projectId) {
    return { date: TANNER_EXECUTIVE_FIXTURE.cutoffDate, kind: TANNER_EXECUTIVE_FIXTURE.kind, productionSnapshotId: null };
  }

  throw new Error("No existe un corte productivo ni fixture aprobado para este proyecto ejecutivo");
}
