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
    { id: 1, serviceId: 1, monthNumber: 1, dueDate: "2026-01-31", amount: "60", currency: "UF", status: "pagado" },
    { id: 2, serviceId: 1, monthNumber: 2, dueDate: "2026-02-28", amount: "60", currency: "UF", status: "pendiente" },
    { id: 3, serviceId: 2, monthNumber: 1, dueDate: "2026-02-28", amount: "1200", currency: "USD", status: "facturado" },
    { id: 4, serviceId: 2, monthNumber: 2, dueDate: "2026-03-31", amount: "1200", currency: "USD", status: "pendiente" },
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
  documentControls: [
    { id: 1, serviceId: 1, documentId: 1, validationStatus: "valid", validFrom: "2026-01-01", validUntil: "2026-12-31", validatedAt: "2026-01-02T12:00:00.000Z" },
    { id: 2, serviceId: 1, documentId: 2, validationStatus: "valid", validFrom: "2026-01-01", validUntil: "2026-12-31", validatedAt: "2026-01-02T12:00:00.000Z" },
  ],
  reportEvidence: [
    { id: 1, serviceId: 1, workPlanItemId: 1, periodStart: "2026-01-01", periodEnd: "2026-01-31", dueDate: "2026-01-31", status: "accepted", deliveredAt: "2026-01-30T12:00:00.000Z", acceptedAt: "2026-02-02T12:00:00.000Z", evidenceDocumentId: 10, source: "manual" },
  ],
  financialEvidence: [
    { serviceId: 1, evidenceType: "invoice", status: "confirmed", amount: "60", currency: "UF", occurredAt: "2026-01-31T12:00:00.000Z" },
    { serviceId: 2, evidenceType: "invoice", status: "pending_validation", amount: "1200", currency: "USD", occurredAt: "2026-02-28T12:00:00.000Z" },
  ],
  financialReferences: [{ id: 10, dealId: "Deal100", clientName: "Cliente A", projectName: "Soporte", valorVentaUF: "120", presupuestoUF: "80", utilizadoUF: "40", planificadoUF: "45", proyectadoUF: "82", lineaNegocio: "Servicios", syncedAt: "2026-03-15T08:00:00.000Z" }],
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
    expect(service?.incidents.overdueOpen).toBe(0);
    expect(service?.incidents.unresolvedOver30Days).toBe(0);
    expect(service?.sla.firstResponseCompliance).toBe(100);
    expect(result.kpis.incidents.overdueOpen).toBe(0);
    expect(result.kpis.incidents.unresolvedOver30Days).toBe(0);
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
      pending: 60,
      overdue: 60,
    });
    expect(result.trends.finance).toContainEqual({
      month: "2026-02",
      currency: "USD",
      scheduled: 1200,
      invoiced: 1200,
      pending: 0,
      overdue: 0,
    });
  });

  it("marca como facturada una cuota cuando la fuente corporativa coincide por Deal", () => {
    const result = buildRecurringServicesDashboardV2(
      {
        ...source,
        corporateBillingItems: [
          {
            id: 88,
            sourceKey: "Deal100:mes-2",
            dealId: "Deal100",
            milestoneName: "Mes 2",
            plannedDate: "2026-02-28",
            invoicedAt: "2026-02-20",
            amount: "60",
            currency: "UF",
            billingStatus: "Facturado",
            sourceActive: true,
          },
        ],
      },
      { cutOffDate: "2026-03-15" },
    );

    const service = result.matrix.find(item => item.serviceId === 1)!;
    expect(service.financeByCurrency.UF.invoiced).toBe(120);
    expect(service.financeByCurrency.UF.pending).toBe(0);
    expect(service.financeByCurrency.UF).not.toHaveProperty("collected");
    expect(result.financeAnalytics.summary.verifiedInvoiceEvidence).toBe(1);
  });

  it("reconcilia por Deal y mantiene separada la evidencia financiera confirmada", () => {
    const result = buildRecurringServicesDashboardV2(source, { cutOffDate: "2026-03-16" });
    const reconciled = result.financeAnalytics.services.find(item => item.serviceId === 1);
    const missing = result.financeAnalytics.services.find(item => item.serviceId === 2);

    expect(reconciled?.reconciliationStatus).toBe("comparable");
    expect(reconciled?.corporateReference?.valorVentaUF).toBe(120);
    expect(reconciled?.verifiedEvidenceByCurrency).toEqual([
      { currency: "UF", invoiced: 60, creditNotes: 0, items: 1 },
    ]);
    expect(missing?.reconciliationStatus).toBe("missing_reference");
    expect(result.financeAnalytics.summary.verifiedInvoiceEvidence).toBe(1);
    expect(result.financeAnalytics.summary).not.toHaveProperty("verifiedPaymentEvidence");
    expect(result.financeAnalytics.summary.latestCorporateSyncAt).toBe("2026-03-15T08:00:00.000Z");
  });

  it("no compara una referencia corporativa UF contra un contrato local en otra moneda", () => {
    const result = buildRecurringServicesDashboardV2(
      {
        ...source,
        financialReferences: [
          ...source.financialReferences,
          { id: 11, dealId: "Deal200", clientName: "Cliente B", projectName: "Staffing", valorVentaUF: "55" },
        ],
      },
      { cutOffDate: "2026-03-16" },
    );

    const service = result.financeAnalytics.services.find(item => item.serviceId === 2);
    expect(service?.reconciliationStatus).toBe("reference_not_comparable");
    expect(service?.localCurrencies[0].currency).toBe("USD");
    expect(service?.corporateReference?.valorVentaUF).toBe(55);
  });

  it("construye el heatmap de reportes con entrega, aceptación, mora y falta de evidencia", () => {
    const result = buildRecurringServicesDashboardV2(source, { cutOffDate: "2026-03-16" });
    const service = result.deliverables.rows.find(item => item.serviceId === 1);

    expect(result.deliverables.periods).toEqual(["2026-01", "2026-02"]);
    expect(result.deliverables.summary).toMatchObject({
      planned: 2,
      due: 2,
      deliveredWithEvidence: 1,
      accepted: 1,
      overdue: 1,
      completedWithoutEvidence: 0,
      deliveryRate: 50,
      acceptanceRate: 50,
      onTimeRate: 100,
    });
    expect(service?.cells.map(cell => cell.status)).toEqual(["accepted", "overdue"]);
  });

  it("distingue documentos presentes sin validar de documentos vigentes y faltantes", () => {
    const result = buildRecurringServicesDashboardV2(source, { cutOffDate: "2026-03-16" });
    const complete = result.documents.services.find(item => item.serviceId === 1);
    const unvalidated = result.documents.services.find(item => item.serviceId === 2);

    expect(result.documents.summary).toMatchObject({ required: 4, present: 4, valid: 2, pendingValidation: 2, missing: 0, validServices: 1 });
    expect(complete?.status).toBe("valid");
    expect(unvalidated?.status).toBe("pending_validation");
    expect(unvalidated?.documents.every(document => document.status === "unvalidated")).toBe(true);
  });

  it("marca un documento como vencido por fecha aunque el control persista como válido", () => {
    const result = buildRecurringServicesDashboardV2(
      {
        ...source,
        documentControls: source.documentControls.map(control => control.documentId === 1 ? { ...control, validUntil: "2026-02-28" } : control),
      },
      { cutOffDate: "2026-03-16" },
    );

    const service = result.documents.services.find(item => item.serviceId === 1);
    expect(service?.status).toBe("at_risk");
    expect(service?.documents.find(document => document.docType === "contrato")?.status).toBe("expired");
  });

  it("filtra exactamente por serviceId para alimentar el detalle 360°", () => {
    const result = buildRecurringServicesDashboardV2(source, {
      cutOffDate: "2026-03-16",
      filters: { serviceId: 2 },
    });

    expect(result.metadata.totalBeforeFilters).toBe(2);
    expect(result.metadata.totalAfterFilters).toBe(1);
    expect(result.matrix.map(item => item.serviceId)).toEqual([2]);
    expect(result.financeAnalytics.services.map(item => item.serviceId)).toEqual([2]);
    expect(result.deliverables.rows.map(item => item.serviceId)).toEqual([2]);
    expect(result.documents.services.map(item => item.serviceId)).toEqual([2]);
  });
});
