import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("../client/src/pages/FinancialConsolidated.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
const layout = readFileSync(new URL("../client/src/components/DashboardLayout.tsx", import.meta.url), "utf8");
const source = readFileSync(new URL("./financialPortfolioV2Source.ts", import.meta.url), "utf8");

describe("Portafolio financiero v2 — guardrails de vista y fuente", () => {
  it("usa el read model v2 y no vuelve al consolidado heredado", () => {
    expect(page).toContain("getFinancialPortfolioV2.useQuery");
    expect(page).not.toContain("getFinancialConsolidated.useQuery");
  });

  it("mantiene una sola entrada Financiero y redirige la URL antigua", () => {
    expect(app).toContain('<Route path="/admin/finance">{() => <AdminGuard><FinancialConsolidated /></AdminGuard>}</Route>');
    expect(app).toContain('<Route path="/admin/financial-consolidated">{() => <AdminGuard><Redirect to="/admin/finance" /></AdminGuard>}</Route>');
    expect(layout.match(/label: "Financiero"/g)).toHaveLength(1);
    expect(layout).not.toContain('label: "Consolidado Facturación"');
  });

  it("carga sólo tablas locales sincronizadas y no consulta Google o Jira en vivo", () => {
    expect(source).toContain("financialBillingItems");
    expect(source).toContain("financialSyncBatches");
    expect(source).not.toContain("googleapis");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("jiraClient");
  });

  it("explica en la interfaz que no se mezclan monedas ni hitos con facturas", () => {
    expect(page).toContain("EN_USD de la planilla");
    expect(page).toContain("no representa una factura SII");
    expect(page).toContain("Montos UF, CLP y USD se mantienen separados");
  });
});
