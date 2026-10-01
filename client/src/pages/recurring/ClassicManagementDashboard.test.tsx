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
    contractCurrency: "UF",
    expectedToDate: { UF: 282 },
    expectedFuture: { UF: 282 },
    invoicedReal: { UF: 282 },
    comparableGap: {},
    expectedCurrencies: ["UF"],
    invoiceCurrencies: ["UF"],
    verifiedInvoiceCount: 3,
    billedJiraCount: 3,
    jiraBillingUnknownCount: 0,
    jiraBillingSourceProjects: ["CAMANSOP01"],
    localInvoiceOnlyCount: 0,
    reconciliationStatus: "ambiguous",
    incidents: { availability: "available", observedAt: "2026-09-25T10:00:00.000Z", total: 66, open: 32, criticalOpen: 0, highOpen: 3, overdueOpen: 0, unresolvedOver30Days: 14, source: "jsm_snapshot" },
    sla: { applicability: "applicable", configuredRules: 1, jsmLinked: true, rules: [{ priority: "high", firstResponseMinutes: 30, resolutionMinutes: 240, coverageType: "24x7", customCoverageDescription: null }], firstResponseMeasured: 0, firstResponseCompliance: null, resolutionMeasured: 0, resolutionCompliance: null },
    deliverables: { planned: 5, due: 0, delivered: 0, accepted: 0, overdue: 0, withoutDate: 5 },
    documents: { present: 2, valid: 0, required: 2 },
    penalties: { count: 0, byCurrency: [], withEvidence: 0 },
    exceptions: [
      { code: "AMBIGUOUS_JIRA_BILLING", severity: "attention", label: "Más de un hito Jira coincide con una cuota", impact: "Los candidatos adicionales no se suman automáticamente.", action: "Confirmar y persistir el vínculo Jira canónico por cuota." },
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
    contractCurrency: "UF",
    expectedToDate: { UF: Number(expected) },
    expectedFuture: { UF: dealId === "Deal4727" ? 780 : 0 },
    invoicedReal: dealId === "Deal4727" ? { UF: 390 } : {},
    comparableGap: dealId === "Deal4687" ? { UF: 320 } : {},
    expectedCurrencies: ["UF"],
    invoiceCurrencies: dealId === "Deal4727" ? ["UF"] : [],
    verifiedInvoiceCount: dealId === "Deal4727" ? 2 : 0,
    billedJiraCount: dealId === "Deal4727" ? 2 : 0,
    jiraBillingUnknownCount: dealId === "Deal4687" ? 1 : 0,
    jiraBillingSourceProjects: ["PSCSC4S"],
    localInvoiceOnlyCount: 0,
    reconciliationStatus: dealId === "Deal4687" ? "jira_unknown" : "matched",
    incidents: { availability: "not_applicable", observedAt: null, total: null, open: null, criticalOpen: null, highOpen: null, overdueOpen: null, unresolvedOver30Days: null, source: "jsm_snapshot" },
    sla: { applicability: "not_applicable", configuredRules: 0, jsmLinked: false, rules: [], firstResponseMeasured: 0, firstResponseCompliance: null, resolutionMeasured: 0, resolutionCompliance: null },
    deliverables: { planned: 5, due: 0, delivered: 0, accepted: 0, overdue: 0, withoutDate: 5 },
    documents: { present: 2, valid: 0, required: 2 },
    penalties: { count: 0, byCurrency: [], withEvidence: 0 },
    exceptions: dealId === "Deal4687" ? [{ code: "JIRA_BILLING_UNKNOWN", severity: "critical", label: "1 hito exigible sin estado de facturación Jira", impact: "No existe evidencia suficiente para afirmar si fue facturado.", action: "Completar Estado de Facturación o vincular el ticket correcto." }] : [],
  })),
] as any[];

const data = {
  metadata: { cutOffDate: "2026-09-26", fromDate: "2026-01-01", latestJsmSnapshotAt: "2026-09-25T10:00:00.000Z" },
  filterOptions: { clients: ["Camanchaca", "Consalud"], statuses: ["activo"], serviceTypes: ["soporte_incidentes", "staffing"], currencies: ["UF"], health: ["critical", "attention", "stable", "no_data"] },
  kpis: {
    totalServices: 3,
    activeServices: 3,
    incidents: { availableServices: 1 },
    financeByCurrency: {
      UF: { currency: "UF", contracted: 2214, scheduled: 1152, invoiced: 672, pending: 320, overdue: 320, overdueItems: 2 },
    },
    reports: { due: 0, completedDue: 0, overdue: 0, deliveryRate: null, onTimeRate: null },
    formalization: { complete: 3, partial: 0, missing: 0 },
    sla: { configuredServices: 3, availableServices: 0, firstResponseCompliance: null, resolutionCompliance: null },
  },
  trends: {
    finance: [
      { month: "2026-07", currency: "UF", scheduled: 254, future: 0, invoiced: 94, pending: 160, overdue: 160, unknown: 0, expectedItems: 2, invoiceItems: 1 },
      { month: "2026-08", currency: "UF", scheduled: 449, future: 0, invoiced: 289, pending: 160, overdue: 160, unknown: 0, expectedItems: 3, invoiceItems: 2 },
      { month: "2026-09", currency: "UF", scheduled: 289, future: 0, invoiced: 289, pending: 0, overdue: 0, unknown: 0, expectedItems: 2, invoiceItems: 2 },
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
    sourceCuts: { financialAt: "2026-09-26T06:00:00.000Z", jiraBillingAt: "2026-09-28T18:16:40.695-0300", jsmAt: "2026-09-25T10:00:00.000Z", documentsAt: null },
    summary: { services: 3, withVerifiedInvoices: 2, withJiraBilling: 2, financeExceptions: 2, slaApplicable: 1, slaConfigured: 1, jsmLinked: 1, slaMeasured: 0, penalties: 0 },
    currencies: [
      { currency: "UF", expectedToDate: 1152, expectedFuture: 1062, invoicedReal: 672, comparableGap: 0, expectedContributors: managementServices.map(service => ({ serviceId: service.serviceId, clientName: service.clientName, serviceName: service.serviceName, amount: service.expectedToDate.UF })), invoiceContributors: [{ serviceId: 1, clientName: "Camanchaca", serviceName: "Soporte SAP", amount: 282, invoices: 3 }, { serviceId: 3, clientName: "Consalud", serviceName: "Staffing Evolutivo", amount: 390, invoices: 2 }] },
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
    financeByCurrency: { UF: { currency: "UF", contracted: 0, scheduled: service.expectedToDate.UF, invoiced: 0, pending: service.expectedToDate.UF, overdue: service.expectedToDate.UF, overdueItems: 1 } },
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
  it("usa estados Jira y bloquea la brecha cuando existe una ambigüedad o estado N/D", () => {
    const model = buildClassicManagementModel(data);
    expect(model.finance.find(row => row.currency === "UF")).toMatchObject({ expectedToDate: 1152, invoicedReal: 672, comparableGap: 0, comparableServices: 1 });
    expect(model.finance.find(row => row.currency === "UF")?.blockedServices).toEqual([
      expect.objectContaining({ clientName: "Camanchaca" }),
      expect.objectContaining({ serviceName: "Staffing Operación" }),
    ]);
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
    expect(selectClassicPreferredCurrency(finance.map(row => ({ ...row, invoicedReal: 0 })))).toBe("UF");
    expect(selectClassicPreferredCurrency([])).toBe("");
  });
});

describe("ClassicManagementDashboard", () => {
  it("muestra facturación Jira en UF, conserva excepciones y evita falsos flujos", () => {
    const onOpenService = vi.fn();
    render(<ClassicManagementDashboard data={data} controls={controls} onControlsChange={() => undefined} onOpenService={onOpenService} />);

    expect(screen.queryByText("Respuesta financiera inmediata")).toBeNull();
    expect(screen.queryByTestId("usd-real-answer")).toBeNull();
    expect(screen.getByRole("tab", { name: "UF" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getAllByText("UF 672").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Facturado según Jira/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("1/1", { selector: "p" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("0/1", { selector: "p" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/No aplica SLA de incidentes/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/N\/D · estado por verificar/).length).toBeGreaterThan(0);
    expect(screen.getByText("Evolución del stock de tickets")).toBeTruthy();
    expect(screen.queryByText(/Incidentes resueltos/i)).toBeNull();
    expect(screen.queryByText(/resueltos del mes/i)).toBeNull();
    expect(screen.getByText("15", { selector: "p" })).toBeTruthy();
    expect(screen.getByText("0/3", { selector: "b" })).toBeTruthy();

    expect(screen.getByTestId("currency-mismatch-warning")).toBeTruthy();
    expect(screen.getByText(/moneda o el estado Jira no son comparables/)).toBeTruthy();

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
