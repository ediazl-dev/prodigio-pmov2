import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const createPage = readFileSync(new URL("../client/src/pages/RecurringServiceCreate.tsx", import.meta.url), "utf8");
const initializationPage = readFileSync(new URL("../client/src/pages/recurring/RSInitStage.tsx", import.meta.url), "utf8");
const router = readFileSync(new URL("./recurringServicesRouter.ts", import.meta.url), "utf8");

describe("guardrails de moneda contractual para servicios recurrentes", () => {
  it("obliga a seleccionar la moneda en lugar de asumir USD", () => {
    expect(createPage).toContain('currency: "" as "" | "UF" | "USD" | "CLP"');
    expect(createPage).toContain('placeholder="Selecciona moneda"');
    expect(createPage).toContain("Selecciona la moneda indicada en el contrato, SoW u orden de compra");
    expect(createPage).not.toContain('currency: "USD",');
  });

  it("exige una moneda soportada en alta y en cada cuota", () => {
    const createContract = router.slice(router.indexOf("create: adminOrPmo"), router.indexOf("update: adminOrPmo"));
    const billingContract = router.slice(router.indexOf("saveBillingPlan: adminOrPmo"), router.indexOf("uploadDocument: adminOrPmo"));

    expect(createContract).toContain('currency: z.enum(["UF", "USD", "CLP"])');
    expect(createContract).not.toContain('default("USD")');
    expect(billingContract).toContain('currency: z.enum(["UF", "USD", "CLP"])');
    expect(billingContract).toContain("La moneda de todas las cuotas debe coincidir con la moneda contractual del servicio.");
  });

  it("no usa USD como fallback al guardar el plan desde Inicialización", () => {
    expect(initializationPage).toContain("La ficha no tiene una moneda contractual válida");
    expect(initializationPage).not.toContain('svc.currency ?? "USD"');
  });
});
