import { describe, expect, it } from "vitest";
import {
  buildStaffingContractPlan,
  getRecurringServiceContractPolicy,
  parseStaffingContractTerms,
  sanitizeGeneratedRecurringPlan,
} from "./recurringServiceContractPolicy";

describe("política contractual de servicios recurrentes", () => {
  it("declara Staffing sin SLA de incidentes, DR, 24x7 ni sync JSM por defecto", () => {
    expect(getRecurringServiceContractPolicy("staffing")).toMatchObject({
      incidentSlaApplicable: false,
      drApplicable: false,
      coverage247Applicable: false,
      jsmWorkPlanSyncDefault: false,
      jsmBillingSyncDefault: false,
    });
  });

  it("elimina facturación duplicada y controles de soporte inventados para Staffing", () => {
    const result = sanitizeGeneratedRecurringPlan({
      serviceType: "staffing",
      hasSeparateBillingSchedule: true,
      items: [
        { itemType: "informe_mensual", title: "Reporte mensual" },
        { itemType: "facturacion", title: "Facturación 195 USD" },
        { itemType: "coverage_definition", title: "Cobertura 24x7" },
        { itemType: "tarea_programada", title: "Prueba DR trimestral" },
        { itemType: "tarea_programada", title: "Consolidar horas" },
      ],
      sla: [
        {
          priority: "critical",
          firstResponseMinutes: 15,
          resolutionMinutes: 120,
          coverageType: "24x7",
        },
      ],
    });

    expect(result.items.map(item => item.title)).toEqual([
      "Reporte mensual",
      "Consolidar horas",
    ]);
    expect(result.sla).toEqual([]);
    expect(result.excluded).toHaveLength(4);
  });

  it("genera para seis meses sólo horas, reporte, revisión y feedback con fechas trazables", () => {
    const plan = buildStaffingContractPlan({
      durationMonths: 6,
      reportDueDates: ["2026-09-03", "2026-10-05", null, null, null, null],
      approvalDueDates: ["2026-09-08", "2026-10-08", null, null, null, null],
      reportDeliveryBusinessDays: 3,
      approvalWindowBusinessDays: 3,
    });

    expect(plan).toHaveLength(24);
    expect(plan.filter(item => item.itemType === "informe_mensual")).toHaveLength(6);
    expect(plan.some(item => item.itemType === "facturacion")).toBe(false);
    expect(plan.some(item => /24\s*x\s*7|DR|parche/i.test(`${item.title} ${item.description}`))).toBe(false);
    expect(plan[0].dueDate).toBe("2026-09-03");
    expect(plan[2].dueDate).toBe("2026-09-08");
  });

  it("extrae los dos plazos del SoW y falla cerrado si falta alguno", () => {
    expect(parseStaffingContractTerms(
      "El Reporte Mensual se entrega dentro de los primeros 3 días hábiles. El cliente dispone de 3 días hábiles para observaciones o aprobación.",
    )).toEqual({ reportDeliveryBusinessDays: 3, approvalWindowBusinessDays: 3 });
    expect(parseStaffingContractTerms("Se debe entregar un reporte mensual.")).toBeNull();
  });
});
