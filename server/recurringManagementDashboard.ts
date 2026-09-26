import type { ServiceMetricsV2 } from "./recurringServicesMetricsEngine";
import type { RecurringDashboardV2Source } from "./recurringServicesDashboardV2";

function numeric(value: string | number | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function currency(value: string | null | undefined): string {
  return value?.trim().toUpperCase() || "N/D";
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function addAmount(target: Record<string, number>, key: string, value: number) {
  target[key] = (target[key] ?? 0) + value;
}

export type RecurringManagementException = {
  serviceId: number;
  clientName: string;
  serviceName: string;
  code: string;
  severity: "critical" | "attention";
  label: string;
  impact: string;
  action: string;
};

export function buildRecurringManagementAnalytics(input: {
  source: RecurringDashboardV2Source;
  services: ServiceMetricsV2[];
  cutOffDate: string;
  fromDate?: string;
  deliverables: {
    rows: Array<{
      serviceId: number;
      cells: Array<{ workPlanItemId: number | null; dueDate: string | null; status: string }>;
    }>;
  };
  documents: {
    services: Array<{
      serviceId: number;
      documents: Array<{ status: string }>;
    }>;
  };
}) {
  const { source, services, cutOffDate, fromDate } = input;
  const deliverablesByService = new Map(input.deliverables.rows.map(row => [row.serviceId, row]));
  const documentsByService = new Map(input.documents.services.map(row => [row.serviceId, row]));
  const sourceServiceById = new Map(source.services.map(service => [service.id, service]));
  const latestSnapshotByService = new Map<number, RecurringDashboardV2Source["jsmSnapshots"][number]>();
  for (const snapshot of source.jsmSnapshots) {
    if (iso(snapshot.capturedAt).slice(0, 10) > cutOffDate) continue;
    const existing = latestSnapshotByService.get(snapshot.serviceId);
    if (!existing || iso(snapshot.capturedAt) > iso(existing.capturedAt)) latestSnapshotByService.set(snapshot.serviceId, snapshot);
  }

  const rows = services.map(service => {
    const sourceService = sourceServiceById.get(service.id);
    const billing = source.billingMonths.filter(row => row.serviceId === service.id);
    const expectedToDate: Record<string, number> = {};
    const expectedFuture: Record<string, number> = {};
    const invoicedReal: Record<string, number> = {};
    const comparableGap: Record<string, number> = {};
    let verifiedInvoiceCount = 0;
    let localInvoiceOnlyCount = 0;
    let ambiguousCount = 0;
    let currencyMismatchCount = 0;
    let amountMismatchCount = 0;

    for (const row of billing) {
      const expectedCurrency = currency(row.expectedCurrency ?? row.currency ?? sourceService?.currency);
      const expectedAmount = numeric(row.expectedAmount ?? row.amount);
      const expectedDate = row.expectedDueDate ?? row.dueDate;
      const expectedInWindow = !fromDate || !expectedDate || expectedDate >= fromDate;
      if (expectedInWindow) {
        if (expectedDate && expectedDate > cutOffDate) addAmount(expectedFuture, expectedCurrency, expectedAmount);
        else addAmount(expectedToDate, expectedCurrency, expectedAmount);
      }

      if (row.invoiceSource === "corporate_financial") {
        const invoiceCurrency = currency(row.invoiceCurrency ?? expectedCurrency);
        const invoiceAmount = numeric(row.invoiceAmount ?? expectedAmount);
        if (!fromDate || !row.invoiceDate || row.invoiceDate >= fromDate) addAmount(invoicedReal, invoiceCurrency, invoiceAmount);
        verifiedInvoiceCount += 1;
        if (row.reconciliationStatus === "currency_mismatch" || row.reconciliationStatus === "currency_and_amount_mismatch") currencyMismatchCount += 1;
        if (row.reconciliationStatus === "amount_mismatch" || row.reconciliationStatus === "currency_and_amount_mismatch") amountMismatchCount += 1;
        if (expectedInWindow && invoiceCurrency === expectedCurrency) addAmount(comparableGap, expectedCurrency, Math.max(0, expectedAmount - invoiceAmount));
      } else if (row.invoiceSource === "local_status") {
        localInvoiceOnlyCount += 1;
        if (expectedInWindow && (!expectedDate || expectedDate <= cutOffDate)) addAmount(comparableGap, expectedCurrency, expectedAmount);
      } else if (expectedInWindow && (!expectedDate || expectedDate <= cutOffDate)) {
        addAmount(comparableGap, expectedCurrency, expectedAmount);
      }
      if (row.reconciliationStatus === "ambiguous") ambiguousCount += 1;
    }

    const expectedCurrencies = Object.keys(expectedToDate).filter(key => expectedToDate[key] > 0);
    const invoiceCurrencies = Object.keys(invoicedReal).filter(key => invoicedReal[key] > 0);
    const currencyMismatch = currencyMismatchCount > 0;
    const missingVerifiedInvoice = verifiedInvoiceCount === 0 && billing.some(row => !(row.expectedDueDate ?? row.dueDate) || (row.expectedDueDate ?? row.dueDate)! <= cutOffDate);
    const reconciliationStatus = ambiguousCount > 0
      ? "ambiguous"
      : currencyMismatch
        ? "currency_mismatch"
        : amountMismatchCount > 0
          ? "amount_mismatch"
          : missingVerifiedInvoice
            ? "missing_invoice"
            : verifiedInvoiceCount > 0
              ? "matched"
              : "no_schedule";

    const deliverableRow = deliverablesByService.get(service.id);
    const documentRow = documentsByService.get(service.id);
    const penalties = (source.penalties ?? []).filter(item => item.serviceId === service.id);
    const penaltiesByCurrency: Record<string, { currency: string; count: number; amount: number }> = {};
    for (const penalty of penalties) {
      const penaltyCurrency = currency(penalty.currency ?? sourceService?.currency);
      const bucket = penaltiesByCurrency[penaltyCurrency] ?? { currency: penaltyCurrency, count: 0, amount: 0 };
      bucket.count += 1;
      bucket.amount += numeric(penalty.amount);
      penaltiesByCurrency[penaltyCurrency] = bucket;
    }

    const snapshot = latestSnapshotByService.get(service.id);
    const firstResponseMeasured = snapshot?.firstResponseMeasuredCount ?? 0;
    const resolutionMeasured = snapshot?.resolutionMeasuredCount ?? 0;
    const undatedDeliverables = deliverableRow?.cells.filter(cell => cell.workPlanItemId !== null && cell.dueDate === null).length ?? 0;
    const unvalidatedDocuments = documentRow?.documents.filter(document => document.status !== "valid" && document.status !== "missing").length ?? 0;
    const exceptions: Omit<RecurringManagementException, "serviceId" | "clientName" | "serviceName">[] = [];

    if (currencyMismatch) exceptions.push({ code: "CURRENCY_MISMATCH", severity: "critical", label: "Moneda contractual y factura no coinciden", impact: "Bloquea el porcentaje financiero comparable.", action: "Corregir la moneda contractual o aprobar una política de conversión con fecha." });
    if (missingVerifiedInvoice) exceptions.push({ code: "MISSING_VERIFIED_INVOICE", severity: "critical", label: "Programación sin factura corporativa vinculada", impact: "No se puede afirmar facturación real para el servicio.", action: "Vincular el Deal con la fuente financiera o confirmar que aún no existe factura." });
    if (ambiguousCount > 0) exceptions.push({ code: "AMBIGUOUS_INVOICE", severity: "critical", label: "Más de una factura coincide con una cuota", impact: "La evidencia no puede atribuirse automáticamente.", action: "Resolver manualmente la asociación de factura y cuota." });
    if (!sourceService?.jsmServiceDeskId) exceptions.push({ code: "JSM_NOT_LINKED", severity: "attention", label: "JSM no vinculado", impact: "Incidentes y cumplimiento SLA no son medibles.", action: "Vincular el Service Desk correcto o declarar una fuente alternativa." });
    if (service.sla.configuredRules > 0 && firstResponseMeasured + resolutionMeasured === 0) exceptions.push({ code: "SLA_NOT_MEASURED", severity: "attention", label: "SLA configurado sin muestra medida", impact: "El cumplimiento debe permanecer N/D.", action: "Persistir contadores medidos y cumplidos de respuesta y resolución." });
    if (undatedDeliverables > 0) exceptions.push({ code: "DELIVERABLES_WITHOUT_DATE", severity: "attention", label: `${undatedDeliverables} entregable(s) sin fecha exigible`, impact: "No existe calendario para medir cumplimiento.", action: "Registrar periodicidad y fecha exigible." });
    if (unvalidatedDocuments > 0) exceptions.push({ code: "DOCUMENTS_UNVALIDATED", severity: "attention", label: `${unvalidatedDocuments} documento(s) sin validación`, impact: "La presencia documental no acredita formalidad completa.", action: "Validar contrato y SoW del servicio." });

    return {
      serviceId: service.id,
      clientName: service.clientName,
      serviceName: service.serviceName,
      dealId: service.dealId,
      serviceType: service.serviceType,
      status: service.status,
      contractCurrency: currency(sourceService?.currency),
      expectedToDate,
      expectedFuture,
      invoicedReal,
      comparableGap,
      expectedCurrencies,
      invoiceCurrencies,
      verifiedInvoiceCount,
      localInvoiceOnlyCount,
      reconciliationStatus,
      exceptions,
      incidents: service.incidents,
      sla: {
        configuredRules: service.sla.configuredRules,
        jsmLinked: Boolean(sourceService?.jsmServiceDeskId),
        rules: source.slaConfigs
          .filter(rule => rule.serviceId === service.id)
          .map(rule => ({
            priority: rule.priority,
            firstResponseMinutes: rule.firstResponseMinutes ?? null,
            resolutionMinutes: rule.resolutionMinutes ?? null,
            coverageType: rule.coverageType ?? null,
            customCoverageDescription: rule.customCoverageDescription ?? null,
          })),
        firstResponseMeasured,
        firstResponseCompliance: service.sla.firstResponseCompliance,
        resolutionMeasured,
        resolutionCompliance: service.sla.resolutionCompliance,
      },
      deliverables: {
        planned: deliverableRow?.cells.filter(cell => cell.workPlanItemId !== null).length ?? 0,
        due: deliverableRow?.cells.filter(cell => cell.dueDate !== null && cell.dueDate <= cutOffDate && cell.status !== "waived").length ?? 0,
        delivered: deliverableRow?.cells.filter(cell => cell.status === "delivered" || cell.status === "accepted").length ?? 0,
        accepted: deliverableRow?.cells.filter(cell => cell.status === "accepted").length ?? 0,
        overdue: deliverableRow?.cells.filter(cell => ["overdue", "rejected", "completed_without_evidence"].includes(cell.status)).length ?? 0,
        withoutDate: undatedDeliverables,
      },
      documents: {
        present: documentRow?.documents.filter(document => document.status !== "missing").length ?? 0,
        valid: documentRow?.documents.filter(document => document.status === "valid").length ?? 0,
        required: documentRow?.documents.length ?? 2,
      },
      penalties: {
        count: penalties.length,
        byCurrency: Object.values(penaltiesByCurrency).sort((a, b) => a.currency.localeCompare(b.currency)),
        withEvidence: penalties.filter(item => Boolean(item.evidenceFileUrl)).length,
      },
    };
  });

  const currencies = Array.from(new Set(rows.flatMap(row => [...row.expectedCurrencies, ...row.invoiceCurrencies]))).sort();
  const currencySummary = currencies.map(itemCurrency => ({
    currency: itemCurrency,
    expectedToDate: rows.reduce((sum, row) => sum + (row.expectedToDate[itemCurrency] ?? 0), 0),
    expectedFuture: rows.reduce((sum, row) => sum + (row.expectedFuture[itemCurrency] ?? 0), 0),
    invoicedReal: rows.reduce((sum, row) => sum + (row.invoicedReal[itemCurrency] ?? 0), 0),
    comparableGap: rows.filter(row => row.reconciliationStatus !== "currency_mismatch").reduce((sum, row) => sum + (row.comparableGap[itemCurrency] ?? 0), 0),
    expectedContributors: rows.filter(row => (row.expectedToDate[itemCurrency] ?? 0) > 0).map(row => ({ serviceId: row.serviceId, clientName: row.clientName, serviceName: row.serviceName, amount: row.expectedToDate[itemCurrency] })),
    invoiceContributors: rows.filter(row => (row.invoicedReal[itemCurrency] ?? 0) > 0).map(row => ({ serviceId: row.serviceId, clientName: row.clientName, serviceName: row.serviceName, amount: row.invoicedReal[itemCurrency], invoices: row.verifiedInvoiceCount })),
  }));

  return {
    sourceCuts: {
      financialAt: source.financialReferences
        .map(reference => reference.syncedAt ? iso(reference.syncedAt) : null)
        .filter((value): value is string => value !== null)
        .sort()
        .at(-1) ?? null,
      jsmAt: source.jsmSnapshots
        .map(snapshot => iso(snapshot.capturedAt))
        .filter(value => value.slice(0, 10) <= cutOffDate)
        .sort()
        .at(-1) ?? null,
      documentsAt: source.documentControls
        .map(control => control.validatedAt ? iso(control.validatedAt) : null)
        .filter((value): value is string => value !== null)
        .sort()
        .at(-1) ?? null,
    },
    summary: {
      services: rows.length,
      withVerifiedInvoices: rows.filter(row => row.verifiedInvoiceCount > 0).length,
      financeExceptions: rows.filter(row => ["currency_mismatch", "amount_mismatch", "ambiguous", "missing_invoice"].includes(row.reconciliationStatus)).length,
      slaConfigured: rows.filter(row => row.sla.configuredRules > 0).length,
      jsmLinked: rows.filter(row => row.sla.jsmLinked).length,
      slaMeasured: rows.filter(row => row.sla.firstResponseMeasured + row.sla.resolutionMeasured > 0).length,
      penalties: rows.reduce((sum, row) => sum + row.penalties.count, 0),
    },
    currencies: currencySummary,
    services: rows,
    exceptions: rows.flatMap(row => row.exceptions.map(exception => ({ serviceId: row.serviceId, clientName: row.clientName, serviceName: row.serviceName, ...exception }))),
  };
}
