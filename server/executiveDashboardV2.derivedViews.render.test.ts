import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExecutiveDerivedPerspectivePanel, type ExecutiveDerivedMetrics } from "../client/src/pages/stages/ExecutiveDashboardV2";

const metrics: ExecutiveDerivedMetrics = {
  cfo: { cv: "[POR CONFIRMAR]", cpiH: "[POR CONFIRMAR]", totalDamage: "[POR CONFIRMAR]" },
  commercial: { acceptedBilling: "0,00 UF", mismatch: "60.0 pp", retainedUf: "[POR CONFIRMAR]" },
  cto: { linkedMilestones: "10/10", overdue: "6", reliableBacklog: "[POR CONFIRMAR]" },
};

describe("Dashboard Ejecutivo v2 — render de perspectivas derivadas", () => {
  it("renderiza la perspectiva CFO con tres métricas, fuente condicionada y guardrail financiero", () => {
    const html = renderToStaticMarkup(createElement(ExecutiveDerivedPerspectivePanel, { view: "cfo", metrics }));

    expect(html).toContain('data-derived-view="cfo"');
    ["Lectura financiera", "CV", "CPI-H", "Daño total", "Exposición de margen y caja con base cardinal.", "no se extrapola una pérdida final"].forEach((text) => expect(html).toContain(text));
    expect((html.match(/edv2-derived-metrics/g) ?? []).length).toBe(1);
  });

  it("renderiza la perspectiva Comercial con exposición separada de la aceptación contractual", () => {
    const html = renderToStaticMarkup(createElement(ExecutiveDerivedPerspectivePanel, { view: "commercial", metrics }));

    expect(html).toContain('data-derived-view="commercial"');
    ["Lectura comercial", "Hitos aceptados y facturación SII se muestran por separado.", "Valor de hitos aceptados", "Descalce", "UF retenidas", "no se declara una nueva fecha comercial como aceptada"].forEach((text) => expect(html).toContain(text));
    expect(html).toContain("0,00 UF");
    expect(html).toContain("60.0 pp");
  });

  it("renderiza la perspectiva CTO con trazabilidad, vencidos y la restricción de no-acreditación por Jira", () => {
    const html = renderToStaticMarkup(createElement(ExecutiveDerivedPerspectivePanel, { view: "cto", metrics }));

    expect(html).toContain('data-derived-view="cto"');
    ["Lectura tecnológica", "Hitos con issue Jira", "Vencidos abiertos", "Backlog confiable", "La trazabilidad técnica se observa, pero no acredita entrega.", "no cambia por sí solo el estado de un hito contractual"].forEach((text) => expect(html).toContain(text));
    expect(html).toContain("10/10");
  });
});
