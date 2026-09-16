import { describe, expect, it } from "vitest";
import { getRecurringDashboardV2Data } from "./recurringServicesDb";
import { buildRecurringServicesDashboardV2 } from "./recurringServicesDashboardV2";

const describePersistent = process.env.RUN_RECURRING_DASHBOARD_V2_DB_TESTS === "1" ? describe : describe.skip;

describePersistent("Dashboard recurrente V2 — integración de solo lectura", () => {
  it("construye el portafolio productivo sin sumar monedas distintas", async () => {
    const source = await getRecurringDashboardV2Data();
    const dashboard = buildRecurringServicesDashboardV2(source as any, {
      cutOffDate: "2026-09-16",
    });

    expect(dashboard.metadata.totalBeforeFilters).toBe(source.services.length);
    expect(dashboard.metadata.totalAfterFilters).toBe(source.services.length);
    expect(dashboard.matrix).toHaveLength(source.services.length);
    expect(Object.keys(dashboard.kpis.financeByCurrency).length).toBeGreaterThan(0);
    expect(
      Object.entries(dashboard.kpis.financeByCurrency).every(
        ([currency, metrics]) => metrics.currency === currency,
      ),
    ).toBe(true);
    expect(dashboard.quality.services).toHaveLength(source.services.length);
  });
});
