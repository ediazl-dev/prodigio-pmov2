import { describe, expect, it } from "vitest";
import {
  countActiveFilters,
  currencyRows,
  formatRecurringMonth,
  formatRecurringMoney,
  formatRecurringPercent,
  RECURRING_HEALTH_UI,
} from "./recurringDashboardV2ViewModel";

describe("recurring dashboard V2 view model", () => {
  it("mantiene cada moneda como una fila independiente", () => {
    const rows = currencyRows({
      USD: { currency: "USD", amount: 1200 },
      CLP: { currency: "CLP", amount: 950000 },
    });
    expect(rows.map(row => row.currency)).toEqual(["CLP", "USD"]);
    expect(rows).toHaveLength(2);
  });

  it("presenta N/D cuando un porcentaje no tiene evidencia", () => {
    expect(formatRecurringPercent(null)).toBe("N/D");
    expect(formatRecurringPercent(94.5)).toBe("94,5%");
  });

  it("formatea montos sin convertir ni ocultar la moneda", () => {
    expect(formatRecurringMoney(1200, "USD")).toContain("USD");
    expect(formatRecurringMoney(950000, "CLP")).toContain("CLP");
  });

  it("representa períodos inválidos sin lanzar errores de fecha", () => {
    expect(formatRecurringMonth("2026-09")).toMatch(/sept|sep/i);
    expect(formatRecurringMonth("sin-fecha")).toBe("Sin fecha");
  });

  it("cuenta filtros ejecutivos y excluye la fecha de corte", () => {
    expect(
      countActiveFilters({
        cutOffDate: "2026-09-16",
        clientName: "Cliente A",
        status: "all",
        serviceType: "staffing",
        health: "all",
        currency: "USD",
        search: "",
      }),
    ).toBe(3);
  });

  it("mantiene una representación explícita para servicios sin datos", () => {
    expect(RECURRING_HEALTH_UI.no_data.label).toBe("Sin datos");
    expect(RECURRING_HEALTH_UI.stable.tone).not.toBe(RECURRING_HEALTH_UI.no_data.tone);
  });
});
