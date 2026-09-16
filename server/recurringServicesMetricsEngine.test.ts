import { describe, expect, it } from "vitest";
import {
  calculateRecurringServicesMetrics,
  type RecurringServicesMetricsInput,
} from "./recurringServicesMetricsEngine";

function baseInput(): RecurringServicesMetricsInput {
  return {
    cutOffDate: "2026-09-16",
    services: [
      {
        id: 1,
        clientName: "Cliente Uno",
        serviceName: "Soporte Productivo",
        dealId: "100",
        serviceType: "soporte_incidentes",
        status: "activo",
        currentStage: "ejecucion",
        currency: "USD",
        totalContractAmount: "300",
        formalStartDate: "2026-07-01",
        endDate: "2026-12-31",
        jsmProjectKey: null,
        jsmServiceDeskId: null,
      },
    ],
    billingMonths: [
      { id: 1, serviceId: 1, dueDate: "2026-08-31", amount: "100", currency: "USD", status: "pendiente" },
      { id: 2, serviceId: 1, dueDate: "2026-09-16", amount: "100", currency: "USD", status: "facturado" },
      { id: 3, serviceId: 1, dueDate: "2026-10-31", amount: "100", currency: "USD", status: "pagado" },
    ],
    workPlanItems: [
      { id: 1, serviceId: 1, itemType: "informe_mensual", dueDate: "2026-08-31", status: "completado" },
      { id: 2, serviceId: 1, itemType: "informe_mensual", dueDate: "2026-09-16", status: "pendiente" },
      { id: 3, serviceId: 1, itemType: "informe_mensual", dueDate: "2026-10-31", status: "pendiente" },
    ],
    documents: [
      { id: 1, serviceId: 1, docType: "contrato" },
      { id: 2, serviceId: 1, docType: "sow" },
    ],
    slaConfigs: [
      { id: 1, serviceId: 1, priority: "critical" },
    ],
  };
}

describe("calculateRecurringServicesMetrics", () => {
  it("separa programado, facturado y cobrado sin tratar lo pendiente como facturado", () => {
    const result = calculateRecurringServicesMetrics(baseInput());
    const usd = result.services[0].finance.byCurrency.USD;

    expect(usd).toMatchObject({
      contracted: 300,
      scheduled: 300,
      invoiced: 200,
      collected: 100,
      accountsReceivable: 100,
      pending: 100,
      overdue: 100,
      overdueItems: 1,
    });
  });

  it("usa la fecha de corte: el vencimiento igual al corte es exigible pero no está atrasado", () => {
    const result = calculateRecurringServicesMetrics(baseInput());
    const service = result.services[0];

    expect(service.reports.due).toBe(2);
    expect(service.reports.completedDue).toBe(1);
    expect(service.reports.overdue).toBe(1);
    expect(service.reports.deliveryRate).toBe(50);
    expect(service.finance.overdueRows).toBe(1);
  });

  it("no presenta configuración SLA como cumplimiento y conserva N/D sin evidencia JSM", () => {
    const result = calculateRecurringServicesMetrics(baseInput());
    const service = result.services[0];

    expect(service.sla.configuredRules).toBe(1);
    expect(service.sla.availability).toBe("not_configured");
    expect(service.sla.firstResponseCompliance).toBeNull();
    expect(service.sla.resolutionCompliance).toBeNull();
    expect(result.portfolio.sla.availableServices).toBe(0);
    expect(result.portfolio.sla.firstResponseCompliance).toBeNull();
  });

  it("mantiene monedas separadas y nunca publica un total cruzado", () => {
    const input = baseInput();
    input.services.push({
      ...input.services[0],
      id: 2,
      clientName: "Cliente Dos",
      serviceName: "Staffing",
      dealId: "200",
      serviceType: "staffing",
      currency: "CLP",
      totalContractAmount: "900000",
    });
    input.billingMonths.push({ id: 4, serviceId: 2, dueDate: "2026-09-30", amount: "900000", currency: "CLP", status: "pendiente" });
    input.documents.push({ id: 3, serviceId: 2, docType: "contrato" }, { id: 4, serviceId: 2, docType: "sow" });

    const result = calculateRecurringServicesMetrics(input);

    expect(Object.keys(result.portfolio.financeByCurrency).sort()).toEqual(["CLP", "USD"]);
    expect(result.portfolio.financeByCurrency.USD.contracted).toBe(300);
    expect(result.portfolio.financeByCurrency.CLP.contracted).toBe(900000);
    expect(result.portfolio).not.toHaveProperty("totalContractValue");
  });

  it("calcula cumplimiento SLA solo desde evidencia medible", () => {
    const input = baseInput();
    input.services[0].jsmServiceDeskId = "7";
    input.operationalEvidence = [
      {
        serviceId: 1,
        status: "available",
        observedAt: "2026-09-16T10:00:00.000Z",
        totalTickets: 20,
        openTickets: 3,
        criticalOpen: 0,
        highOpen: 1,
        firstResponseMeasured: 20,
        firstResponseMet: 19,
        resolutionMeasured: 10,
        resolutionMet: 8,
      },
    ];

    const result = calculateRecurringServicesMetrics(input);
    const service = result.services[0];

    expect(service.sla.firstResponseCompliance).toBe(95);
    expect(service.sla.resolutionCompliance).toBe(80);
    expect(service.health).toBe("critical");
    expect(service.healthSignals.map(signal => signal.code)).toContain("SLA_CRITICAL_BREACH");
  });

  it("declara salud estable solo cuando hay evidencia y ninguna señal crítica o de atención", () => {
    const input = baseInput();
    input.billingMonths[0].status = "pagado";
    input.workPlanItems[1].status = "completado";
    input.services[0].jsmServiceDeskId = "7";
    input.operationalEvidence = [
      {
        serviceId: 1,
        status: "available",
        observedAt: "2026-09-16T10:00:00.000Z",
        totalTickets: 2,
        openTickets: 0,
        criticalOpen: 0,
        highOpen: 0,
        firstResponseMeasured: 2,
        firstResponseMet: 2,
        resolutionMeasured: 2,
        resolutionMet: 2,
      },
    ];

    const result = calculateRecurringServicesMetrics(input);

    expect(result.services[0].health).toBe("stable");
    expect(result.services[0].healthSignals).toEqual([]);
  });

  it("marca sin datos cuando no existe evidencia medible", () => {
    const input = baseInput();
    input.services[0] = {
      ...input.services[0],
      totalContractAmount: null,
      jsmServiceDeskId: "7",
    };
    input.billingMonths = [];
    input.workPlanItems = [];
    input.documents = [];
    input.slaConfigs = [];
    input.operationalEvidence = [];

    const result = calculateRecurringServicesMetrics(input);

    expect(result.services[0].health).toBe("no_data");
    expect(result.services[0].formalization.status).toBe("missing");
    expect(result.services[0].incidents.total).toBeNull();
    expect(result.services[0].healthSignals.map(signal => signal.code)).toContain("CONTRACT_DOCUMENT_MISSING");
  });
});
