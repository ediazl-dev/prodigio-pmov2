import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const listPage = readFileSync(new URL("../client/src/pages/RecurringServicesList.tsx", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../client/src/pages/recurring/ClassicManagementDashboard.tsx", import.meta.url), "utf8");
const tower = readFileSync(new URL("../client/src/pages/recurring/RecurringServicesDashboardV2.tsx", import.meta.url), "utf8");

describe("vista clásica gerencial de servicios recurrentes", () => {
  it("sustituye el dashboard heredado y conserva la vista Clásico en una consulta estable", () => {
    expect(listPage).toContain("ClassicManagementDashboard");
    expect(listPage).toContain("deriveClassicFromDate");
    expect(listPage).toContain("useMemo");
    expect(listPage).not.toContain("Distribución por Etapa");
  });

  it("ordena finanzas, SLA, gobierno, excepciones y resumen final por servicio", () => {
    const finance = dashboard.indexOf("Finanzas por moneda");
    const sla = dashboard.indexOf("Embudo de cobertura SLA");
    const governance = dashboard.indexOf("Gobierno operacional");
    const exceptions = dashboard.indexOf("Excepciones que impiden una lectura completa");
    const finalSummary = dashboard.indexOf("Resumen final por servicio");
    expect(finance).toBeGreaterThan(0);
    expect(sla).toBeGreaterThan(finance);
    expect(governance).toBeGreaterThan(sla);
    expect(exceptions).toBeGreaterThan(governance);
    expect(finalSummary).toBeGreaterThan(exceptions);
  });

  it("ubica el consolidado de cuatro dimensiones sólo en Clásico y antes del resumen final", () => {
    const consolidated = dashboard.indexOf("<EvidenceTabs");
    const finalSummary = dashboard.indexOf("Resumen final por servicio");
    expect(consolidated).toBeGreaterThan(0);
    expect(finalSummary).toBeGreaterThan(consolidated);
    expect(dashboard).toContain("Finanzas, entregables, formalidad y operación JSM");
    expect(tower).not.toContain("<EvidenceTabs");
    expect(tower).not.toContain("FinancePanel");
  });

  it("expone respuestas financieras, stock de tickets y SLA sin cobros ni falsos flujos", () => {
    expect(dashboard).toContain("Facturación real USD");
    expect(dashboard).toContain("Programado al corte");
    expect(dashboard).toContain("Facturado real");
    expect(dashboard).toContain("Evolución del stock de tickets");
    expect(dashboard).toContain("Embudo de cobertura SLA");
    expect(dashboard).toContain("sin fecha exigible");
    expect(dashboard).toContain("No se calcula porcentaje ni brecha cruzando monedas");
    expect(dashboard).not.toMatch(/Incidentes resueltos|resueltos del mes|Cobrado|CxC|Avance de cobro/);
  });
});
