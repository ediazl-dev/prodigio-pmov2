import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClassicManagementDashboard } from "./ClassicManagementDashboard";
import {
  buildClassicManagementModel,
  deriveClassicFromDate,
  formatSlaMinutes,
  selectClassicPreferredCurrency,
  type ClassicDashboardControls,
} from "./classicManagementViewModel";

const managementServices = [
  {
    serviceId: 1,
    clientName: "Camanchaca",
    serviceName: "Soporte SAP",
    dealId: "Deal2383",
    serviceType: "soporte_incidentes",
    status: "activo",
    contractCurrency: "USD",
    expectedToDate: { USD: 282 },
    expectedFuture: { USD: 282 },
    invoicedReal: { UF: 282 },
    comparableGap: {},
    expectedCurrencies: ["USD"],
    invoiceCurrencies: ["UF"],
    verifiedInvoiceCount: 3,
    localInvoiceOnlyCount: 0,
    reconciliationStatus: "currency_mismatch",
    incidents: { availability: "available", observedAt: "2026-09-25T10:00:00.000Z", total: 66, open: 32, criticalOpen: 0, highOpen: 3, overdueOpen: 0, unresolvedOver30Days: 14, source: "jsm_snapshot" },
    sla: { configuredRules: 1, jsmLinked: true, rules: [{ priority: "high", firstResponseMinutes: 30, resolutionMinutes: 240, coverageType: "24x7", customCoverageDescription: null }], firstResponseMeasured: 0, firstResponseCompliance: null, resolutionMeasured: 0, resolutionCompliance: null },
    deliverables: { planned: 5, due: 0, delivered: 0, accepted: 0, overdue: 0, withoutDate: 5 },
    documents: { present: 2, valid: 0, required: 2 },
    penalties: { count: 0, byCurrency: [], withEvidence: 0 },
    exceptions: [
      { code: "CURRENCY_MISMATCH", severity: "critical", label: "Moneda contractual y factura no coinciden", impact: "Bloquea el porcentaje financiero comparable.", action: "Corregir la moneda contractual o aprobar una política de conversión con fecha." },
      { code: "SLA_NOT_MEASURED", severity: "attention", label: "SLA configurado sin muestra medida", impact: "El cumplimiento debe permanecer N/D.", action: "Persistir contadores medidos y cumplidos de respuesta y resolución." },
    ],
  },
  ...[
    [2, "Staffing Operación", "Deal4687", 480],
    [3, "Staffing Evolutivo", "Deal4727", 390],
  ].map(([serviceId, serviceName, dealId, expected]) => ({
    serviceId: Number(serviceId),
    clientName: "Consalud",
    serviceName: String(serviceName),
    dealId: String(dealId),
    serviceType: "staffing",
    status: "activo",
    contractCurrency: "USD",
    expectedToDate: { USD: Number(expected) },
    expectedFuture: { USD: dealId === "Deal4727" ? 780 : 0 },
    invoicedReal: {},
    comparableGap: { USD: Number(expected) },
    expectedCurrencies: ["USD"],
    invoiceCurrencies: [],
    verifiedInvoiceCount: 0,
    localInvoiceOnlyCount: 0,
    reconciliationStatus: "missing_invoice",
    incidents: { availability: "not_configured", observedAt: null, total: null, open: null, criticalOpen: null, highOpen: null, overdueOpen: null, unresolvedOver30Days: null, source: "jsm_snapshot" },
    sla: { configuredRules: 1, jsmLinked: false, rules: [{ priority: "high", firstResponseMinutes: 60, resolutionMinutes: 480, coverageType: "8x5", customCoverageDescription: null }], firstResponseMeasured: 0, firstResponseCompliance: null, resolutionMeasured: 0, resolutionCompliance: null },
    deliverables: { planned: 5, due: 0, delivered: 0, accepted: 0, overdue: 0, withoutDate: 5 },
    documents: { present: 2, valid: 0, required: 2 },
    penalties: { count: 0, byCurrency: [], withEvidence: 0 },
    exceptions: [{ code: "MISSING_VERIFIED_INVOICE", severity: "critical", label: "Programación sin registro corporativo facturado", impact: "No existe evidencia suficiente para afirmar facturación del servicio en la fuente corporativa.", action: "Vincular el Deal con la fuente financiera o confirmar que aún no existe un registro marcado Facturado." }],
  })),
] as any[];

const data = {
  metadata: { cutOffDate: "2026-09-26", fromDate: "2026-01-01", latestJsmSnapshotAt: "2026-09-25T10:00:00.000Z" },
  filterOptions: { clients: ["Camanchaca", "Consalud"], statuses: ["activo"], serviceTypes: ["soporte_incidentes", "staffing"], currencies: ["USD"], health: ["critical", "attention", "stable", "no_data"] },
  kpis: {
    totalServices: 3,
    activeServices: 3,
    incidents: { availableServices: 1 },
    financeByCurrency: {
      UF: { currency: "UF", contracted: 0, scheduled: 0, invoiced: 282, pending: 0, overdue: 0, overdueItems: 0 },
      USD: { currency: "USD", contracted: 2214, scheduled: 1152, invoiced: 0, pending: 870, overdue: 870, overdueItems: 7 },
    },
    reports: { due: 0, completedDue: 0, overdue: 0, deliveryRate: null, onTimeRate: null },
    formalization: { complete: 3, partial: 0, missing: 0 },
    sla: { configuredServices: 3, availableServices: 0, firstResponseCompliance: null, resolutionCompliance: null },
  },
  trends: {
    finance: [
      { month: "2026-01", currency: "USD", scheduled: 344, future: 0, invoiced: 0, pending: 250, overdue: 250, expectedItems: 3, invoiceItems: 0 },
      { month: "2026-01", currency: "UF", scheduled: 0, future: 0, invoiced: 94, pending: 0, overdue: 0, expectedItems: 0, invoiceItems: 1 },
      { month: "2026-02", currency: "USD", scheduled: 344, future: 0, invoiced: 0, pending: 250, overdue: 250, expectedItems: 3, invoiceItems: 0 },
      { month: "2026-02", currency: "UF", scheduled: 0, future: 0, invoiced: 94, pending: 0, overdue: 0, expectedItems: 0, invoiceItems: 1 },
    ],
  },
  financeAnalytics: {
    summary: { reconciledServices: 1, comparableUfServices: 0, missingReferenceServices: 2, ambiguousServices: 0, verifiedInvoiceEvidence: 3, latestCorporateSyncAt: "2026-09-26T06:00:00.000Z" },
    services: managementServices.map(service => ({ serviceId: service.serviceId, clientName: service.clientName, serviceName: service.serviceName, dealId: service.dealId, reconciliationStatus: service.serviceId === 1 ? "reference_not_comparable" : "missing_reference", localCurrencies: [{ currency: "USD", contracted: 0, scheduled: service.expectedToDate.USD, invoiced: 0, pending: service.expectedToDate.USD, overdue: service.expectedToDate.USD, overdueItems: 1 }], verifiedEvidenceByCurrency: service.serviceId === 1 ? [{ currency: "UF", invoiced: 282, creditNotes: 0, items: 3 }] : [], corporateReference: null })),
  },
  deliverables: { periods: [], summary: { planned: 15, due: 0, deliveredWithEvidence: 0, accepted: 0, overdue: 0, completedWithoutEvidence: 0, deliveryRate: null, acceptanceRate: null, onTimeRate: null }, rows: managementServices.map(service => ({ serviceId: service.serviceId, clientName: service.clientName, serviceName: service.serviceName, cells: [] })) },
  documents: { requiredTypes: ["contrato", "sow"], summary: { required: 6, present: 6, valid: 0, pendingValidation: 6, expiredOrRejected: 0, missing: 0, validServices: 0 }, services: managementServices.map(service => ({ serviceId: service.serviceId, clientName: service.clientName, serviceName: service.serviceName, status: "pending_validation", documents: [], additionalDocuments: 0 })) },
  operations: {
    summary: { measuredServices: 1, unmeasuredServices: 2, total: 66, resolved: 34, open: 32, resolutionRate: 51.5, criticalOpen: 0, highOpen: 3, overdueOpen: 0, unresolvedOver30Days: 14 },
    monthly: [{ month: "2026-09", total: 66, nonOpen: 34, open: 32, criticalOpen: 0, highOpen: 3, unresolvedOver30Days: 14, overdueOpen: 0, servicesMeasured: 1 }],
    pendingServices: [],
  },
  management: {
    sourceCuts: { financialAt: "2026-09-26T06:00:00.000Z", jsmAt: "2026-09-25T10:00:00.000Z", documentsAt: null },
    summary: { services: 3, withVerifiedInvoices: 1, financeExceptions: 3, slaConfigured: 3, jsmLinked: 1, slaMeasured: 0, penalties: 0 },
    currencies: [
      { currency: "UF", expectedToDate: 0, expectedFuture: 0, invoicedReal: 282, comparableGap: 0, expectedContributors: [], invoiceContributors: [{ serviceId: 1, clientName: "Camanchaca", serviceName: "Soporte SAP", amount: 282, invoices: 3 }] },
      { currency: "USD", expectedToDate: 1152, expectedFuture: 1062, invoicedReal: 0, comparableGap: 870, expectedContributors: managementServices.map(service => ({ serviceId: service.serviceId, clientName: service.clientName, serviceName: service.serviceName, amount: service.expectedToDate.USD })), invoiceContributors: [] },
    ],
    services: managementServices,
    exceptions: managementServices.flatMap(service => service.exceptions.map((exception: any) => ({ serviceId: service.serviceId, clientName: service.clientName, serviceName: service.serviceName, ...exception }))),
  },
  matrix: managementServices.map(service => ({
    serviceId: service.serviceId,
    clientName: service.clientName,
    serviceName: service.serviceName,
    dealId: service.dealId,
    status: service.status,
    currentStage: "ejecucion",
    serviceType: service.serviceType,
    health: "critical",
    financeByCurrency: { USD: { currency: "USD", contracted: 0, scheduled: service.expectedToDate.USD, invoiced: 0, pending: service.expectedToDate.USD, overdue: service.expectedToDate.USD, overdueItems: 1 } },
    incidents: service.incidents,
    sla: service.sla,
    reports: { planned: 5, due: 0, completedDue: 0, overdue: 0, deliveryRate: null, onTimeRate: null },
    formalization: { required: ["contrato", "sow"], present: ["contrato", "sow"], missing: [], coveragePercent: 100, status: "complete", source: "recurring_service_documents" },
    healthSignals: [{ code: "OVERDUE_BILLING", level: "critical", message: "Facturación pendiente" }],
    quality: { serviceId: service.serviceId, issues: [] },
  })),
} as any;

const controls: ClassicDashboardControls = {
  cutOffDate: "2026-09-26",
  window: "ytd",
  customFromDate: "",
  comparison: "monthly",
  clientName: "all",
  serviceType: "all",
  status: "activo",
  onlyExceptions: false,
};

afterEach(cleanup);

describe("classicManagementViewModel", () => {
  it("separa facturación real y bloquea la brecha cuando no existe base comparable", () => {
    const model = buildClassicManagementModel(data);
    expect(model.finance.find(row => row.currency === "USD")).toMatchObject({ expectedToDate: 1152, invoicedReal: 0, comparableGap: 870, comparableServices: 2 });
    expect(model.finance.find(row => row.currency === "UF")).toMatchObject({ expectedToDate: 0, invoicedReal: 282, comparableGap: null, comparableServices: 0 });
    expect(model.finance.find(row => row.currency === "UF")?.blockedServices).toEqual([expect.objectContaining({ clientName: "Camanchaca" })]);
  });

  it("deriva ventanas deterministas y formatea tiempos SLA", () => {
    expect(deriveClassicFromDate("current_month", "2026-09-26")).toBe("2026-09-01");
    expect(deriveClassicFromDate("last_3_months", "2026-09-26")).toBe("2026-07-01");
    expect(deriveClassicFromDate("ytd", "2026-09-26")).toBe("2026-01-01");
    expect(deriveClassicFromDate("contract", "2026-09-26")).toBeUndefined();
    expect(formatSlaMinutes(30)).toBe("30 min");
    expect(formatSlaMinutes(240)).toBe("4 h");
  });

  it("elige la moneda inicial por evidencia sin comparar montos entre monedas", () => {
    const finance = buildClassicManagementModel(data).finance;
    expect(selectClassicPreferredCurrency(finance)).toBe("UF");
    expect(selectClassicPreferredCurrency(finance.map(row => ({ ...row, invoicedReal: 0 })))).toBe("USD");
    expect(selectClassicPreferredCurrency([])).toBe("");
  });
});

describe("ClassicManagementDashboard", () => {
  it("prioriza la moneda con evidencia, conserva excepciones y evita el banner USD y falsos flujos", () => {
    const onOpenService = vi.fn();
    render(<ClassicManagementDashboard data={data} controls={controls} onControlsChange={() => undefined} onOpenService={onOpenService} />);

    expect(screen.queryByText("Respuesta financiera inmediata")).toBeNull();
    expect(screen.queryByTestId("usd-real-answer")).toBeNull();
    expect(screen.getByRole("tab", { name: "UF" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getAllByText("UF 282").length).toBeGreaterThan(0);
    expect(screen.getByText("3/3", { selector: "p" })).toBeTruthy();
    expect(screen.getAllByText("1/3", { selector: "p" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("0/3", { selector: "p" }).length).toBeGreaterThan(0);
    expect(screen.getByText("Evolución del stock de tickets")).toBeTruthy();
    expect(screen.queryByText(/Incidentes resueltos/i)).toBeNull();
    expect(screen.queryByText(/resueltos del mes/i)).toBeNull();
    expect(screen.getByText("15", { selector: "p" })).toBeTruthy();
    expect(screen.getByText("0/3", { selector: "b" })).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "USD" }));
    expect(screen.getByRole("tab", { name: "USD" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByTestId("currency-mismatch-warning")).toBeTruthy();
    expect(screen.getByText(/No se calcula porcentaje ni brecha cruzando monedas/)).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: /Detalle/ })[0]);
    fireEvent.click(screen.getByRole("button", { name: /Ver servicio/ }));
    expect(onOpenService).toHaveBeenCalledWith(1);
  });

  it("conserva el consolidado exclusivamente representado por sus cuatro pestañas", () => {
    render(<ClassicManagementDashboard data={data} controls={controls} onControlsChange={() => undefined} onOpenService={() => undefined} />);
    expect(screen.getByText("Evidencia consolidada de la cartera")).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Financiero/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Entregables/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Formalidad/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Operación JSM/ })).toBeTruthy();
    expect(screen.getByText("Resumen final por servicio")).toBeTruthy();
  });

  it("emite cambios accesibles de ventana, comparación y excepción", () => {
    const onControlsChange = vi.fn();
    render(<ClassicManagementDashboard data={data} controls={controls} onControlsChange={onControlsChange} onOpenService={() => undefined} />);
    fireEvent.change(screen.getByLabelText("Ventana temporal"), { target: { value: "last_3_months" } });
    fireEvent.change(screen.getByLabelText("Tipo de comparación"), { target: { value: "cumulative" } });
    fireEvent.click(screen.getByLabelText("Mostrar sólo excepciones"));
    expect(onControlsChange).toHaveBeenCalledWith(expect.objectContaining({ window: "last_3_months" }));
    expect(onControlsChange).toHaveBeenCalledWith(expect.objectContaining({ comparison: "cumulative" }));
    expect(onControlsChange).toHaveBeenCalledWith(expect.objectContaining({ onlyExceptions: true }));
  });
});
