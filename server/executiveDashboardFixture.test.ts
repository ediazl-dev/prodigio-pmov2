import { describe, expect, it } from "vitest";
import { TANNER_EXECUTIVE_FIXTURE, resolveExecutiveDashboardCutoff } from "./executiveDashboardFixture";

describe("Fixture ejecutivo Tanner", () => {
  it("mantiene el fixture del 17-ago-2026 explícitamente separado de producción", () => {
    expect(TANNER_EXECUTIVE_FIXTURE).toMatchObject({ projectId: 180002, cutoffDate: "2026-08-17", kind: "fixture" });
    expect(resolveExecutiveDashboardCutoff({ projectId: 180002, observedAt: "2026-08-18T12:00:00Z" }))
      .toMatchObject({ date: "2026-08-18", kind: "observed", productionSnapshotId: null });
  });

  it("prioriza un snapshot productivo por sobre el corte observado", () => {
    expect(resolveExecutiveDashboardCutoff({ projectId: 180002, productionSnapshot: { id: 99, cutoffDate: "2026-08-18" } }))
      .toMatchObject({ date: "2026-08-18", kind: "production", productionSnapshotId: 99 });
  });

  it("permite cortes solicitados sin etiquetarlos como producción", () => {
    expect(resolveExecutiveDashboardCutoff({ projectId: 180002, requestedCutoffDate: "2026-08-01" }))
      .toMatchObject({ date: "2026-08-01", kind: "requested", productionSnapshotId: null });
  });
});
