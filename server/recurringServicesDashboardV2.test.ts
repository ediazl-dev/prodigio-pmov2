import { describe, expect, it } from "vitest";
import { buildRecurringServicesDashboardV2, type RecurringDashboardV2Source } from "./recurringServicesDashboardV2";

const source: RecurringDashboardV2Source = {
  services: [
    {
      id: 1,
      clientName: "Cliente A",
      serviceName: "Soporte Plataforma",
      dealId: "Deal100",
      serviceType: "soporte_incidentes",
      status: "activo",
      currentStage: "ejecucion",
      currency: "UF",
      totalContractAmount: "120",
      formalStartDate: "2026-01-01",
      endDate: "2026-12-31",
      jsmProjectKey: "SUP",
      jsmServiceDeskId: "10",
      pipedriveDealCurrency: "UF",
      pipedriveDealAmount: "120",
      jsmProjectId: "10010",
      jsmLinkHealth: "healthy",
    },
    {
      id: 2,
      clientName: "Cliente B",
      serviceName: "Staffing Cloud",
      dealId: "Deal200",
      serviceType: "staffing",
      status: "activo",
      currentStage: "ejecucion",
      currency: "USD",
      totalContractAmount: "2400",
      formalStartDate: "2026-01-01",
      endDate: "2026-12-31",
      jsmProjectKey: null,
      jsmServiceDeskId: null,
      pipedriveDealCurrency: "USD",
      pipedriveDealAmount: "2400",
      jsmProjectId: null,
      jsmLinkHealth: null,
    },
  ],
  billingMonths: [
    { id: 1, serviceId: 1, dueDate: "2026-01-31", amount: "60", currency: "UF", status: "pagado" },
    { id: 2, serviceId: 1, dueDate: "2026-02-28", amount: "60", currency: "UF", status: "pendiente" },
    { id: 3, serviceId: 2, dueDate: "2026-02-28", amount: "1200", currency: "USD", status: "facturado" },
    { id: 4, serviceId: 2, dueDate: "2026-03-31", amount: "1200", currency: "USD", status: "pendiente" },
  ],
  workPlanItems: [
    { id: 1, serviceId: 1, itemType: "informe_mensual", dueDate: "2026-01-31", status: "completado" },
    { id: 2, serviceId: 1, itemType: "informe_mensual", dueDate: "2026-02-28", status: "pendiente" },
  ],
  documents: [
    { id: 1, serviceId: 1, docType: "contrato" },
    { id: 2, serviceId: 1, docType: "sow" },
    { id: 3, serviceId: 2, docType: "contrato" },
    { id: 4, serviceId: 2, docType: "sow" },
  ],
  slaConfigs: [{ id: 1, serviceId: 1, priority: "high" }],
  jsmSnapshots: [
    {
      serviceId: 1,
      capturedAt: "2026-02-28T10:00:00.000Z",
      status: "success",
      incidentCount: 10,
      openIncidentCount: 2,
      criticalOpenCount: 0,
      overdueIncidentCount: 1,
      unresolvedOver30DaysCount: 0,
      firstResponseMeasuredCount: 10,
      firstResponseMetCount: 10,
      resolutionMeasuredCount: 8,
      resolutionMetCount: 8,
      priorityBreakdown: { high: 1 },
    },
    {
      serviceId: 1,
      capturedAt: "2026-03-15T10:00:00.000Z",
      status: "success",
      incidentCount: 12,
      openIncidentCount: 1,
      criticalOpenCount: 0,
      overdueIncidentCount: 0,
      unresolvedOver30DaysCount: 0,
      firstResponseMeasuredCount: 12,
      firstResponseMetCount: 12,
      resolutionMeasuredCount: 10,
      resolutionMetCount: 10,
      priorityBreakdown: { high: 0 },
    },
  ],
  documentControls: [{ serviceId: 1 }],
  reportEvidence: [],
  financialEvidence: [],
  financialReferences: [{ id: 10, dealId: "Deal100", clientName: "Cliente A", projectName: "Soporte", valorVentaUF: "120" }],
};

describe("buildRecurringServicesDashboardV2", () => {
  it("mantiene monedas separadas y recalcula KPIs sobre el universo filtrado", () => {
    const result = buildRecurringServicesDashboardV2(source, {
      cutOffDate: "2026-03-16",
      filters: { serviceType: "staffing" },
    });

    expect(result.metadata.totalBeforeFilters).toBe(2);
    expect(result.metadata.totalAfterFilters).toBe(1);
    expect(result.kpis.totalServices).toBe(1);
    expect(result.kpis.financeByCurrency.USD.contracted).toBe(2400);
    expect(result.kpis.financeByCurrency.UF).toBeUndefined();
  });

  it("aplica búsqueda y filtros de moneda en servidor", () => {
    const result = buildRecurringServicesDashboardV2(source, {
      cutOffDate: "2026-03-16",
      filters: { currency: "uf", search: "soporte" },
    });

    expect(result.matrix.map(item => item.serviceId)).toEqual([1]);
  });

  it("usa el último snapshot vigente y expone SLA medido", () => {
    const result = buildRecurringServicesDashboardV2(source, {
      cutOffDate: "2026-03-16",
      staleAfterHours: 48,
    });
    const service = result.matrix.find(item => item.serviceId === 1);

    expect(service?.incidents.total).toBe(12);
    expect(service?.sla.firstResponseCompliance).toBe(100);
    expect(result.metadata.latestJsmSnapshotAt).toBe("2026-03-15T10:00:00.000Z");
  });

  it("expresa snapshots antiguos como evidencia obsoleta y no como cumplimiento", () => {
    const result = buildRecurringServicesDashboardV2(source, {
      cutOffDate: "2026-04-30",
      staleAfterHours: 36,
    });
    const service = result.matrix.find(item => item.serviceId === 1);

    expect(service?.incidents.availability).toBe("stale");
    expect(service?.sla.firstResponseCompliance).toBeNull();
  });

  it("filtra por semáforo después de calcularlo y conserva la calidad por servicio", () => {
    const all = buildRecurringServicesDashboardV2(source, { cutOffDate: "2026-03-16" });
    const targetHealth = all.matrix[0].health;
    const filtered = buildRecurringServicesDashboardV2(source, {
      cutOffDate: "2026-03-16",
      filters: { health: targetHealth },
    });

    expect(filtered.matrix.length).toBeGreaterThan(0);
    expect(filtered.matrix.every(item => item.health === targetHealth)).toBe(true);
    expect(filtered.matrix.every(item => item.quality.serviceId === item.serviceId)).toBe(true);
  });

  it("construye series financieras mensuales sin sumar monedas", () => {
    const result = buildRecurringServicesDashboardV2(source, { cutOffDate: "2026-03-16" });

    expect(result.trends.finance).toContainEqual({
      month: "2026-02",
      currency: "UF",
      scheduled: 60,
      invoiced: 0,
      collected: 0,
      pending: 60,
      overdue: 60,
    });
    expect(result.trends.finance).toContainEqual({
      month: "2026-02",
      currency: "USD",
      scheduled: 1200,
      invoiced: 1200,
      collected: 0,
      pending: 0,
      overdue: 0,
    });
  });
});
