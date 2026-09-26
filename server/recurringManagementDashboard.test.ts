import { describe, expect, it } from "vitest";
import { buildRecurringServicesDashboardV2, type RecurringDashboardV2Source } from "./recurringServicesDashboardV2";

function service(
  id: number,
  clientName: string,
  serviceName: string,
  dealId: string,
  amount: string,
  jsm: boolean,
): RecurringDashboardV2Source["services"][number] {
  return {
    id,
    clientName,
    serviceName,
    dealId,
    serviceType: id === 1 ? "soporte_incidentes" : "staffing",
    status: "activo",
    currentStage: "ejecucion",
    currency: "USD",
    totalContractAmount: amount,
    formalStartDate: "2026-01-01",
    endDate: "2027-03-31",
    jsmProjectKey: jsm ? "CAMANSOP01" : null,
    jsmServiceDeskId: jsm ? "101" : null,
    jsmProjectId: jsm ? "10001" : null,
    jsmLinkHealth: jsm ? "healthy" : null,
    pipedriveDealCurrency: "USD",
    pipedriveDealAmount: amount,
  };
}

const source: RecurringDashboardV2Source = {
  services: [
    service(1, "Camanchaca", "Soporte SAP", "Deal2383", "564", true),
    service(2, "Consalud", "Staffing Operación", "Deal4687", "480", false),
    service(3, "Consalud", "Staffing Evolutivo", "Deal4727", "1170", false),
  ],
  billingMonths: [
    ...Array.from({ length: 6 }, (_, index) => ({
      id: index + 1,
      serviceId: 1,
      monthNumber: index + 1,
      dueDate: index < 3 ? `2026-0${index + 1}-28` : `2026-${index + 7}-28`,
      amount: "94",
      currency: "USD",
      status: "pendiente" as const,
    })),
    ...Array.from({ length: 4 }, (_, index) => ({
      id: 10 + index,
      serviceId: 2,
      monthNumber: index + 1,
      dueDate: `2026-0${index + 1}-15`,
      amount: "120",
      currency: "USD",
      status: "pendiente" as const,
    })),
    ...Array.from({ length: 9 }, (_, index) => ({
      id: 20 + index,
      serviceId: 3,
      monthNumber: index + 1,
      dueDate: index < 3 ? `2026-0${index + 1}-20` : `2026-${index + 7}-20`,
      amount: "130",
      currency: "USD",
      status: "pendiente" as const,
    })),
  ],
  workPlanItems: Array.from({ length: 15 }, (_, index) => ({
    id: index + 1,
    serviceId: Math.floor(index / 5) + 1,
    itemType: "informe_mensual",
    dueDate: null,
    status: "pendiente" as const,
  })),
  documents: [
    { id: 1, serviceId: 1, docType: "contrato" },
    { id: 2, serviceId: 1, docType: "sow" },
    { id: 3, serviceId: 2, docType: "contrato" },
    { id: 4, serviceId: 2, docType: "sow" },
    { id: 5, serviceId: 3, docType: "contrato" },
    { id: 6, serviceId: 3, docType: "sow" },
  ],
  documentControls: [],
  reportEvidence: [],
  financialEvidence: [],
  financialReferences: [],
  slaConfigs: [
    { id: 1, serviceId: 1, priority: "high", firstResponseMinutes: 30, resolutionMinutes: 240, coverageType: "24x7" },
    { id: 2, serviceId: 2, priority: "high", firstResponseMinutes: 60, resolutionMinutes: 480, coverageType: "8x5" },
    { id: 3, serviceId: 3, priority: "high", firstResponseMinutes: 60, resolutionMinutes: 480, coverageType: "8x5" },
  ],
  jsmSnapshots: [{
    serviceId: 1,
    capturedAt: "2026-09-26T06:00:00.000Z",
    status: "success",
    incidentCount: 66,
    openIncidentCount: 32,
    criticalOpenCount: 0,
    overdueIncidentCount: 0,
    unresolvedOver30DaysCount: 14,
    firstResponseMeasuredCount: 0,
    firstResponseMetCount: 0,
    resolutionMeasuredCount: 0,
    resolutionMetCount: 0,
    priorityBreakdown: { high: 3 },
  }],
  corporateBillingItems: Array.from({ length: 3 }, (_, index) => ({
    id: 100 + index,
    sourceKey: `Deal2383:mes-${index + 1}`,
    dealId: "Deal2383",
    milestoneName: `Mes ${index + 1}`,
    plannedDate: `2026-0${index + 1}-28`,
    invoicedAt: `2026-0${index + 1}-25`,
    amount: "94",
    currency: "UF",
    billingStatus: "Facturado",
    sourceActive: true,
  })),
  penalties: [],
};

describe("dashboard gerencial recurrente", () => {
  it("separa programación USD de facturas UF y atribuye cada cifra al servicio correcto", () => {
    const result = buildRecurringServicesDashboardV2(source, { cutOffDate: "2026-09-26" });
    const management = result.management;
    const camanchaca = management.services.find(row => row.dealId === "Deal2383")!;
    const deal4687 = management.services.find(row => row.dealId === "Deal4687")!;
    const deal4727 = management.services.find(row => row.dealId === "Deal4727")!;
    const usd = management.currencies.find(row => row.currency === "USD")!;
    const uf = management.currencies.find(row => row.currency === "UF")!;

    expect(management.summary).toMatchObject({
      services: 3,
      withVerifiedInvoices: 1,
      financeExceptions: 3,
      slaConfigured: 3,
      jsmLinked: 1,
      slaMeasured: 0,
      penalties: 0,
    });
    expect(camanchaca).toMatchObject({
      expectedToDate: { USD: 282 },
      expectedFuture: { USD: 282 },
      invoicedReal: { UF: 282 },
      verifiedInvoiceCount: 3,
      reconciliationStatus: "currency_mismatch",
    });
    expect(camanchaca).not.toHaveProperty("invoicingProgress");
    expect(deal4687).toMatchObject({ expectedToDate: { USD: 480 }, invoicedReal: {}, reconciliationStatus: "missing_invoice" });
    expect(deal4727).toMatchObject({ expectedToDate: { USD: 390 }, expectedFuture: { USD: 780 }, invoicedReal: {}, reconciliationStatus: "missing_invoice" });
    expect(usd).toMatchObject({ expectedToDate: 1152, expectedFuture: 1062, invoicedReal: 0, comparableGap: 870 });
    expect(uf).toMatchObject({ expectedToDate: 0, expectedFuture: 0, invoicedReal: 282, comparableGap: 0 });
    expect(uf.invoiceContributors).toEqual([
      expect.objectContaining({ clientName: "Camanchaca", amount: 282, invoices: 3 }),
    ]);
  });

  it("mantiene SLA como N/D sin denominador y expone operación, gobierno y brechas", () => {
    const result = buildRecurringServicesDashboardV2(source, { cutOffDate: "2026-09-26" });
    const camanchaca = result.management.services.find(row => row.dealId === "Deal2383")!;

    expect(camanchaca.incidents).toMatchObject({ total: 66, open: 32, highOpen: 3, unresolvedOver30Days: 14 });
    expect(camanchaca.sla).toMatchObject({ jsmLinked: true, firstResponseMeasured: 0, firstResponseCompliance: null, resolutionMeasured: 0, resolutionCompliance: null });
    expect(result.management.services.filter(row => row.sla.jsmLinked)).toHaveLength(1);
    expect(result.management.services.reduce((sum, row) => sum + row.deliverables.withoutDate, 0)).toBe(15);
    expect(result.management.services.reduce((sum, row) => sum + row.documents.present, 0)).toBe(6);
    expect(result.management.services.reduce((sum, row) => sum + row.documents.valid, 0)).toBe(0);
    expect(result.management.exceptions.some(row => row.code === "DELIVERABLES_WITHOUT_DATE")).toBe(true);
    expect(result.management.exceptions.some(row => row.code === "DOCUMENTS_UNVALIDATED")).toBe(true);
  });

  it("separa las multas por moneda sin agregarlas entre sí", () => {
    const result = buildRecurringServicesDashboardV2({
      ...source,
      penalties: [
        { id: 1, serviceId: 1, penaltyDate: "2026-09-01", description: "Multa UF", amount: "2", currency: "UF", status: "aplicada", evidenceFileUrl: "/evidence/uf" },
        { id: 2, serviceId: 1, penaltyDate: "2026-09-02", description: "Multa USD", amount: "100", currency: "USD", status: "disputada", evidenceFileUrl: null },
      ],
    }, { cutOffDate: "2026-09-26" });
    const camanchaca = result.management.services.find(row => row.dealId === "Deal2383")!;

    expect(result.management.summary.penalties).toBe(2);
    expect(camanchaca.penalties).toEqual({
      count: 2,
      byCurrency: [
        { currency: "UF", count: 1, amount: 2 },
        { currency: "USD", count: 1, amount: 100 },
      ],
      withEvidence: 1,
    });
  });

  it("ignora snapshots posteriores al corte", () => {
    const result = buildRecurringServicesDashboardV2({
      ...source,
      jsmSnapshots: [
        ...source.jsmSnapshots,
        { ...source.jsmSnapshots[0], capturedAt: "2026-10-01T06:00:00.000Z", openIncidentCount: 99 },
      ],
    }, { cutOffDate: "2026-09-26" });

    expect(result.management.services.find(row => row.dealId === "Deal2383")?.incidents.open).toBe(32);
    expect(result.metadata.latestJsmSnapshotAt).toBe("2026-09-26T06:00:00.000Z");
  });

  it("aplica la fecha inicial a series y montos visibles sin perder las excepciones del servicio", () => {
    const result = buildRecurringServicesDashboardV2(source, {
      cutOffDate: "2026-09-26",
      fromDate: "2026-02-01",
    });

    expect(result.metadata.fromDate).toBe("2026-02-01");
    expect(result.trends.finance.every(row => row.month >= "2026-02")).toBe(true);
    expect(result.management.services.find(row => row.dealId === "Deal2383")?.reconciliationStatus).toBe("currency_mismatch");
    expect(result.management.currencies.find(row => row.currency === "UF")?.invoicedReal).toBe(188);
  });

  it("filtra todo el universo cuando se solicitan sólo servicios con excepciones", () => {
    const cleanSource: RecurringDashboardV2Source = {
      ...source,
      services: [{ ...source.services[0], dealId: "Deal999", currency: "USD", totalContractAmount: "100" }],
      billingMonths: [{ id: 999, serviceId: 1, monthNumber: 1, dueDate: "2026-01-31", amount: "100", currency: "USD", status: "pendiente" }],
      workPlanItems: [],
      documents: source.documents.filter(row => row.serviceId === 1),
      documentControls: [
        { id: 1, serviceId: 1, documentId: 1, validationStatus: "valid", validFrom: "2026-01-01", validUntil: "2026-12-31", validatedAt: "2026-01-02T10:00:00.000Z" },
        { id: 2, serviceId: 1, documentId: 2, validationStatus: "valid", validFrom: "2026-01-01", validUntil: "2026-12-31", validatedAt: "2026-01-02T10:00:00.000Z" },
      ],
      slaConfigs: [],
      penalties: [],
      corporateBillingItems: [{ id: 999, sourceKey: "Deal999:mes-1", dealId: "Deal999", milestoneName: "Mes 1", plannedDate: "2026-01-31", invoicedAt: "2026-01-30", amount: "100", currency: "USD", sourceActive: true }],
    };
    const all = buildRecurringServicesDashboardV2(cleanSource, { cutOffDate: "2026-09-26" });
    const exceptionsOnly = buildRecurringServicesDashboardV2(cleanSource, { cutOffDate: "2026-09-26", filters: { onlyExceptions: true } });

    expect(all.management.services).toHaveLength(1);
    expect(all.management.exceptions).toHaveLength(0);
    expect(exceptionsOnly.management.services).toHaveLength(0);
    expect(exceptionsOnly.metadata.totalAfterFilters).toBe(0);
  });
});
