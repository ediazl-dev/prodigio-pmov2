import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const listPage = readFileSync(new URL("../client/src/pages/RecurringServicesList.tsx", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("../client/src/pages/recurring/ClassicManagementDashboard.tsx", import.meta.url), "utf8");

describe("vista clásica gerencial de servicios recurrentes", () => {
  it("sustituye el dashboard heredado y elimina la distribución por etapa", () => {
    expect(listPage).toContain("ClassicManagementDashboard");
    expect(listPage).not.toContain("Distribución por Etapa");
    expect(listPage).not.toContain("Stage Distribution");
  });

  it("conserva las tres tarjetas complementarias y deja la tabla al final", () => {
    const sla = dashboard.indexOf("SLA medido");
    const penalties = dashboard.indexOf("Multas");
    const type = dashboard.indexOf("Distribución por tipo");
    const table = dashboard.indexOf("Resumen por servicio");
    expect(sla).toBeGreaterThan(0);
    expect(penalties).toBeGreaterThan(sla);
    expect(type).toBeGreaterThan(penalties);
    expect(table).toBeGreaterThan(type);
  });

  it("expone contrato, facturación, incidentes mensuales y SLA aplicable sin cobros", () => {
    expect(dashboard).toContain("Monto comprometido");
    expect(dashboard).toContain("Facturado total");
    expect(dashboard).toContain("Incidentes por mes");
    expect(dashboard).toContain("Pendientes operativos y SLA configurado");
    expect(dashboard).toContain("SLA configurado por prioridad");
    expect(dashboard).not.toMatch(/Cobrado|CxC|Avance de cobro/);
  });
});
