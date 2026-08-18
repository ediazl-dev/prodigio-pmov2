import { describe, expect, it } from "vitest";
import { buildExecutiveFinancialEvidence } from "./executiveFinancialEvidence";

describe("buildExecutiveFinancialEvidence", () => {
  it("declara la sincronización y deja como pendientes los insumos de gobierno no sincronizados", () => {
    const result = buildExecutiveFinancialEvidence({
      syncedFinancial: {
        valorVentaUF: "8200", presupuestoUF: "2050", utilizadoUF: "3114",
        margenBrutoNotaVentaUF: "4000", margenProyectadoUF: "1000",
        capacityHH: "120", presupuestoHH: "800", syncedAt: new Date("2026-08-18T00:00:00.000Z"),
      },
      impact: { cpiH: 0.2 },
    });

    expect(result.source).toBe("financial_sync");
    expect(result.availableFields).toContain("Costo ejecutado");
    expect(result.pendingFields).toEqual(expect.arrayContaining(["WACC anual", "Tarifa diaria UF", "Penalidad contractual UF"]));
    expect(result.coverage).toEqual({ synced: 7, syncedExpected: 7, governance: 0, governanceExpected: 5 });
  });

  it("prefiere el snapshot versionado y no fabrica una fuente cuando no hay registros", () => {
    const snapshot = buildExecutiveFinancialEvidence({
      persistedSnapshot: { capturedAt: "2026-08-17T00:00:00.000Z", financialData: { valorVentaUF: "99" } },
      syncedFinancial: { valorVentaUF: "20", presupuestoUF: "10" },
      impact: {},
    });
    const none = buildExecutiveFinancialEvidence({ impact: {} });

    expect(snapshot.source).toBe("snapshot");
    expect(snapshot.availableFields).toEqual(["Venta contractual"]);
    expect(none.source).toBe("POR_CONFIRMAR");
    expect(none.coverage.synced).toBe(0);
  });
});
