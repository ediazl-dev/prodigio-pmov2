import { describe, expect, it } from "vitest";
import { summarizeMonetaryItems } from "../shared/monetaryTotals";

describe("summarizeMonetaryItems", () => {
  it("suma sólo cuando todos los ítems tienen una moneda única y monto válido", () => {
    expect(summarizeMonetaryItems([
      { amount: "100", currency: "uf" },
      { amount: 250, currency: "UF" },
    ])).toMatchObject({
      totals: { UF: 350 },
      entries: [["UF", 350]],
      isSingleCurrency: true,
      isMultiCurrency: false,
    });
  });

  it("mantiene subtotales separados y prohíbe un total único multimoneda", () => {
    const result = summarizeMonetaryItems([
      { amount: "100", currency: "UF" },
      { amount: "2000", currency: "USD" },
    ]);
    expect(result.totals).toEqual({ UF: 100, USD: 2000 });
    expect(result.isSingleCurrency).toBe(false);
    expect(result.isMultiCurrency).toBe(true);
  });

  it("marca N/D lógico si falta moneda o el monto no es válido", () => {
    expect(summarizeMonetaryItems([
      { amount: "100", currency: null },
      { amount: "abc", currency: "UF" },
    ])).toMatchObject({
      hasMissingCurrency: true,
      hasInvalidAmount: true,
      isSingleCurrency: false,
    });
  });
});
