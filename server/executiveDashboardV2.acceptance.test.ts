import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(new URL("../client/src/pages/stages/ExecutiveDashboardV2.tsx", import.meta.url), "utf8");
const router = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
const styles = readFileSync(new URL("../client/src/index.css", import.meta.url), "utf8");

describe("Dashboard Ejecutivo v2 — matriz de aceptación verificable", () => {
  it("mantiene la jerarquía contractual, documental y operativa en orden de lectura", () => {
    const orderedZones = [
      'id="veredicto"',
      'id="hitos"',
      'id="finanzas"',
      'id="exigencias"',
      'id="operacion"',
      'id="minutas"',
      'id="preclasificacion"',
      'id="perspectivas"',
      'id="trazabilidad"',
    ];

    const positions = orderedZones.map((zone) => component.indexOf(zone));
    positions.forEach((position) => expect(position).toBeGreaterThan(-1));
    positions.slice(1).forEach((position, index) => expect(position).toBeGreaterThan(positions[index]));
    expect(component).toContain("La evidencia define el");
    expect(component).toContain("no puede mejorar el estado ejecutivo");
  });

  it("mantiene un semáforo contractual único y KPI cardinales auditables", () => {
    expect(component).toContain("estado único");
    expect(component).toContain('className="edv2-stamp-state"');
    expect(component).toContain("CHC-T · exigible");
    expect(component).toContain("CHC-G · global");
    expect(component).toContain("Esperado-G");
    expect(component).toContain("Vencidos abiertos");
    expect(component).toContain('title={audit}');
    expect(component).toContain("Fórmula, fuente y corte");
    expect(component).toContain("no intervienen");
  });

  it("mantiene los bloques ricos y las vistas derivadas con acciones explícitas y datos ausentes trazables", () => {
    [
      "Eje primario — cumplimiento cardinal de hitos",
      "Línea de tiempo contractual — baseline vs. real",
      "Hitos vencidos sin aceptación y evidencia por hito",
      "Impacto y costo financiero de la desviación",
      "Daño cuantificado y proyección a término",
      "Puente de destrucción de margen",
      "Descalce entre curva de pago y cumplimiento",
      "Exigencias, pauta de remediación y descargos",
      "Exigencias vigentes",
      "Pauta del Plan de Recuperación y Descargo",
      "Descargos requeridos al PM",
      "Escalamiento para Delivery",
      "Cobertura de evidencia — minutas y compromisos",
      "Compromisos extraídos de las minutas",
      "Jira / backlog",
      "Perspectiva CFO",
      "Dirección Comercial",
      "Perspectiva CTO",
      "Decisión requerida:",
      "[POR CONFIRMAR]",
      "[PENDIENTE]",
    ].forEach((label) => expect(component).toContain(label));

    expect(component).not.toContain('>N/A<');
  });

  it("mantiene el eje operativo colapsado, desaturado y fuera de la cabecera ejecutiva", () => {
    const executiveHeader = component.slice(0, component.indexOf('id="operacion"'));

    expect(component).toContain('tag="no gobierna el estado"');
    expect(component).toContain('className="edv2-card edv2-secondary-signal"');
    expect(component).not.toContain('className="edv2-card" open><summary><span>Jira / backlog</span>');
    expect(executiveHeader).not.toContain("AOJ");
    expect(styles).toContain("filter: saturate(.35)");
  });

  it("declara las barreras de rol para evidencia, gobierno, PRD y anulación", () => {
    [
      "recordExecutiveMinute: adminOrPmo",
      "recordExecutiveMilestoneAcceptance: adminOrPmo",
      "createExecutiveRequirement: adminOrPmo",
      "closeExecutiveRequirement: adminOrPmo",
      "recordExecutiveRecoveryPlan: adminOrPmo",
      "reviewAgenticExecutiveVerdict: adminOrPmo",
      "waiveExecutiveRequirement: protectedProcedure",
      "approveExecutiveRecoveryPlan: protectedProcedure",
      "delivery_manager",
    ].forEach((contract) => expect(router).toContain(contract));
  });
});
