import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(new URL("../client/src/pages/stages/ExecutiveDashboardV2.tsx", import.meta.url), "utf8");

describe("Dashboard Ejecutivo v2 — paridad estructural del piloto Tanner", () => {
  it("conserva las siete zonas de gobierno y sus anclas de navegación", () => {
    [
      "#hitos",
      "#finanzas",
      "#exigencias",
      "#operacion",
      "#minutas",
      "#perspectivas",
      "#trazabilidad",
    ].forEach((anchor) => {
      expect(component).toContain(`href="${anchor}"`);
    });
  });

  it("sitúa la preclasificación dentro del flujo documental, después de la cabecera y las minutas", () => {
    const topbar = component.indexOf('className="edv2-topbar"');
    const minutes = component.indexOf('id="minutas"');
    const preclassification = component.indexOf('id="preclasificacion"');
    const perspectives = component.indexOf('id="perspectivas"');

    expect(topbar).toBeGreaterThan(-1);
    expect(minutes).toBeGreaterThan(topbar);
    expect(preclassification).toBeGreaterThan(minutes);
    expect(perspectives).toBeGreaterThan(preclassification);
  });

  it("expone los bloques ricos de recuperación, descargos y escalamiento sin declarar evidencia inexistente", () => {
    [
      "Pauta del Plan de Recuperación y Descargo",
      "Marcador del PRD",
      "Descargos requeridos al PM",
      "Escalamiento para Delivery",
      "[POR CONFIRMAR]",
      "[PENDIENTE]",
    ].forEach((label) => expect(component).toContain(label));
  });

  it("mantiene las perspectivas CFO, Comercial y CTO como vistas accesibles derivadas", () => {
    ["CFO", "Comercial", "CTO"].forEach((label) => expect(component).toContain(label));
    expect(component).toContain('useState<"cfo" | "commercial" | "cto">("cfo")');
    expect(component).toContain("role=\"tabpanel\"");
  });

  it("mantiene el avance cardinal separado de las señales Jira y de los pesos de facturación", () => {
    expect(component).toContain("La métrica maestra cuenta solamente hitos aceptados con acta");
    expect(component).toContain("no acredita aceptación ni aumenta CHC, IGE o el estado ejecutivo");
    expect(component).not.toContain("avance ponderado por facturación");
  });
});
