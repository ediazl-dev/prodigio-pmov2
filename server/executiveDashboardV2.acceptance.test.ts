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
      'id="remediacion"',
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
    expect(component).toContain("sólo el acta del cliente acredita aceptación");
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
      "Componentes del puente:",
      "Descalce entre curva de pago y cumplimiento",
      "Exigencias, pauta de remediación y descargos",
      "Exigencias vigentes",
      "Pauta del Plan de Recuperación y Descargo (PRD)",
      "Descargos requeridos al PM",
      "Escalamiento — decisiones que requieren al Gerente de Delivery",
      "Evidencia documental — minutas y compromisos",
      "Cobertura de evidencia — minutas y compromisos",
      "Cobertura de evidencia — semanas desde kickoff",
      "Brecha consecutiva:",
      "recibidas sin revisión:",
      "Compromisos extraídos de las minutas",
      "Coherencia narrativa",
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

  it("ofrece navegación lateral accesible y muestra la línea de tiempo Jira con aceptación documentada", () => {
    [
      'className="edv2-side-nav"',
      'aria-label="Navegación lateral del dashboard ejecutivo"',
      'className="edv2-side-nav-return"',
      "Línea de tiempo contractual — baseline vs. real",
      'className="edv2-gantt-wrap"',
      'className="edv2-gantt-legend"',
      "Corte {formatDate(cutoff.date)}",
      "Aceptado por el cliente",
      "Línea base (carta Gantt)",
      "Comprometido Jira",
      "Vencido sin acta",
      "En riesgo de incumplimiento",
      "Pendiente de acta",
      "Fecha real (acta)",
      "Regla de gobierno:",
      "ventana de cinco días",
      "fecha base contractual",
      "fecha programada en Jira",
      "deriva de planificación",
      "deriva real",
      "milestone.baselineDate",
      "milestone.jiraDueDate",
      "milestone.jiraClosedDate",
      "milestone.acceptedAt",
    ].forEach((detail) => expect(component).toContain(detail));
  });

  it("mantiene el eje operativo colapsado, desaturado y fuera de la cabecera ejecutiva", () => {
    const executiveHeader = component.slice(0, component.indexOf('id="operacion"'));

    expect(component).toContain('tag="no gobierna el estado"');
    expect(component).toContain('className="edv2-card edv2-secondary-signal"');
    expect(component).not.toContain('className="edv2-card" open><summary><span>Jira / backlog</span>');
    expect(executiveHeader).not.toContain("AOJ");
    expect(styles).toContain("filter: saturate(.35)");
  });

  it("preserva descargos, escalamiento y señales secundarias como bloques detallados y no como resúmenes planos", () => {
    [
      "rúbrica · 100 pts",
      "aprueba con ≥ 75 puntos y ninguna sección en cero",
      "Descargos requeridos al PM",
      "Eduardo · respuesta escrita",
      "D-01",
      "D-02",
      "D-03",
      "Re-baseline formal",
      "Continuidad / stop-loss",
      "Recuperación económica",
      "Issues:",
      "Hitos/risgos/cambios:",
      "Vínculo contractual:",
      "Jira puede activar una penalización",
    ].forEach((detail) => expect(component).toContain(detail));

    expect((component.match(/className="edv2-card edv2-secondary-signal"/g) ?? []).length).toBe(3);
    expect(component).toContain("prdRubric.map");
    expect(component).toContain("responseQuestions.map");
    expect(component).toContain('<table className="edv2-table">');
  });

  it("expone una matriz tabular de señales secundarias con procedencia y límites de gobierno explícitos", () => {
    [
      "Matriz de señales secundarias y sus límites de gobierno",
      "Lectura observada",
      "Procedencia",
      "Límite de gobierno",
      "Sólo penaliza; no acredita actas, CHC, IGE ni estado.",
      "Exige análisis y dueño; no reemplaza evidencia contractual.",
      "No proyecta carry ni autoriza continuidad sin insumos aprobados.",
    ].forEach((detail) => expect(component).toContain(detail));
  });

  it("mantiene tres vistas derivadas con métricas y restricciones diferenciadas", () => {
    [
      "Exposición de margen y caja con base cardinal.",
      "Facturación y cumplimiento se muestran por separado.",
      "La trazabilidad técnica se observa, pero no acredita entrega.",
      "CV ·",
      "Facturación aceptada",
      "Hitos con issue Jira",
      "La aceptación documentada sigue siendo el único gatillo de avance.",
    ].forEach((detail) => expect(component).toContain(detail));

    expect((component.match(/role="tab"/g) ?? []).length).toBeGreaterThanOrEqual(1);
    expect(component).toContain('role="tabpanel"');
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

  it("reemplaza URLs manuales por carga validada de evidencia y preserva la revisión humana", () => {
    [
      "uploadExecutiveEvidence: adminOrPmo",
      "validateExecutiveEvidenceUpload",
      "25 * 1024 * 1024",
      "Formato inválido para esta evidencia.",
      "Archivo validado y almacenado.",
      "Acta de aceptación (PDF, máx. 25 MB)",
      "Documento de minuta",
      "Documento PRD",
      "La carga por sí sola no acredita el hito.",
      "La aprobación de Delivery sigue siendo obligatoria.",
      "type=\"file\"",
    ].forEach((detail) => expect(`${component}\n${router}`).toContain(detail));

    expect(component).not.toContain('type="url" value={acceptanceForm.evidenceUrl}');
    expect(component).not.toContain('type="url" value={minuteForm.fileUrl}');
    expect(component).not.toContain('type="url" value={recoveryPlanForm.fileUrl}');
  });
});
