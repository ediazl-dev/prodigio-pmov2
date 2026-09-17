import {
  calculateRecurringServicesMetrics,
  type EvidenceStatus,
  type RecurringOperationalEvidenceSource,
  type RecurringServicesMetricsInput,
  type ServiceMetricsV2,
} from "./recurringServicesMetricsEngine";
import {
  diagnoseRecurringServicesQuality,
  normalizeRecurringDealId,
  type RecurringServicesQualityInput,
  type ServiceDataQuality,
} from "./recurringServicesQualityEngine";

export type DashboardHealthFilter = "critical" | "attention" | "stable" | "no_data";

export interface RecurringDashboardV2Filters {
  serviceId?: number;
  clientName?: string;
  status?: string;
  serviceType?: string;
  health?: DashboardHealthFilter;
  currency?: string;
  search?: string;
}

export interface DashboardV2JsmSnapshot {
  serviceId: number;
  capturedAt: Date | string;
  status: "success" | "partial" | "error" | "not_configured";
  incidentCount: number | null;
  openIncidentCount: number | null;
  criticalOpenCount: number | null;
  overdueIncidentCount: number | null;
  unresolvedOver30DaysCount: number | null;
  firstResponseMeasuredCount: number | null;
  firstResponseMetCount: number | null;
  resolutionMeasuredCount: number | null;
  resolutionMetCount: number | null;
  priorityBreakdown: unknown;
}

export interface RecurringDashboardV2Source
  extends Omit<RecurringServicesMetricsInput, "cutOffDate" | "operationalEvidence">,
    RecurringServicesQualityInput {
  services: Array<RecurringServicesMetricsInput["services"][number] & RecurringServicesQualityInput["services"][number]>;
  billingMonths: Array<RecurringServicesMetricsInput["billingMonths"][number] & RecurringServicesQualityInput["billingMonths"][number]>;
  documents: Array<RecurringServicesMetricsInput["documents"][number] & RecurringServicesQualityInput["documents"][number]>;
  jsmSnapshots: DashboardV2JsmSnapshot[];
  documentControls: Array<{
    id?: number;
    serviceId: number;
    documentId: number;
    validationStatus: "pending" | "valid" | "expired" | "rejected";
    validFrom: string | null;
    validUntil: string | null;
    validatedAt: Date | string | null;
  }>;
  reportEvidence: Array<{
    id?: number;
    serviceId: number;
    workPlanItemId: number | null;
    periodStart: string;
    periodEnd: string;
    dueDate: string;
    status: "pending" | "delivered" | "accepted" | "rejected" | "waived";
    deliveredAt: Date | string | null;
    acceptedAt: Date | string | null;
    evidenceDocumentId: number | null;
    source?: "manual" | "jsm" | "import";
  }>;
  financialEvidence: Array<{ serviceId: number; evidenceType: string; status: string; amount: string | number; currency: string; occurredAt: Date | string }>;
}

export interface RecurringDashboardV2Options {
  cutOffDate: string;
  filters?: RecurringDashboardV2Filters;
  staleAfterHours?: number;
}

const HEALTH_ORDER: Record<DashboardHealthFilter, number> = {
  critical: 0,
  attention: 1,
  no_data: 2,
  stable: 3,
};

function isoDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function monthKey(value: Date | string | null): string | null {
  if (!value) return null;
  const normalized = value instanceof Date ? value.toISOString() : value;
  return normalized.slice(0, 7);
}

function numeric(value: string | number | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizedCurrency(value: string | null | undefined): string {
  return value?.trim().toUpperCase() || "N/D";
}

function priorityCount(value: unknown, key: string): number | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const candidate = record[key] ?? record[key.toUpperCase()] ?? record[key.toLowerCase()];
  return typeof candidate === "number" && Number.isFinite(candidate) ? candidate : null;
}

function latestOperationalEvidence(
  snapshots: DashboardV2JsmSnapshot[],
  cutOffDate: string,
  staleAfterHours: number,
): RecurringOperationalEvidenceSource[] {
  const latest = new Map<number, DashboardV2JsmSnapshot>();
  for (const snapshot of snapshots) {
    const current = latest.get(snapshot.serviceId);
    if (!current || isoDate(snapshot.capturedAt) > isoDate(current.capturedAt)) latest.set(snapshot.serviceId, snapshot);
  }

  const cutOff = new Date(`${cutOffDate}T23:59:59.999Z`).getTime();
  return Array.from(latest.values()).map(snapshot => {
    const capturedAt = isoDate(snapshot.capturedAt);
    const ageHours = Math.max(0, (cutOff - new Date(capturedAt).getTime()) / 3_600_000);
    let status: EvidenceStatus;
    if (snapshot.status === "error") status = "error";
    else if (snapshot.status === "not_configured") status = "not_configured";
    else if (ageHours > staleAfterHours) status = "stale";
    else status = "available";

    return {
      serviceId: snapshot.serviceId,
      status,
      observedAt: capturedAt,
      totalTickets: snapshot.incidentCount,
      openTickets: snapshot.openIncidentCount,
      criticalOpen: snapshot.criticalOpenCount,
      highOpen: priorityCount(snapshot.priorityBreakdown, "high"),
      overdueOpen: snapshot.overdueIncidentCount,
      unresolvedOver30Days: snapshot.unresolvedOver30DaysCount,
      firstResponseMeasured: snapshot.firstResponseMeasuredCount,
      firstResponseMet: snapshot.firstResponseMetCount,
      resolutionMeasured: snapshot.resolutionMeasuredCount,
      resolutionMet: snapshot.resolutionMetCount,
    };
  });
}

function baseServiceIds(source: RecurringDashboardV2Source, filters: RecurringDashboardV2Filters): Set<number> {
  const search = filters.search?.trim().toLocaleLowerCase("es");
  const currency = filters.currency ? normalizedCurrency(filters.currency) : undefined;
  return new Set(
    source.services
      .filter(service => !filters.serviceId || service.id === filters.serviceId)
      .filter(service => !filters.clientName || service.clientName === filters.clientName)
      .filter(service => !filters.status || service.status === filters.status)
      .filter(service => !filters.serviceType || service.serviceType === filters.serviceType)
      .filter(service => !currency || normalizedCurrency(service.currency) === currency)
      .filter(service => {
        if (!search) return true;
        return [service.clientName, service.serviceName, service.dealId ?? ""]
          .join(" ")
          .toLocaleLowerCase("es")
          .includes(search);
      })
      .map(service => service.id),
  );
}

function restrictSource(source: RecurringDashboardV2Source, serviceIds: Set<number>): RecurringDashboardV2Source {
  return {
    ...source,
    services: source.services.filter(item => serviceIds.has(item.id)),
    billingMonths: source.billingMonths.filter(item => serviceIds.has(item.serviceId)),
    workPlanItems: source.workPlanItems.filter(item => serviceIds.has(item.serviceId)),
    documents: source.documents.filter(item => serviceIds.has(item.serviceId)),
    slaConfigs: source.slaConfigs.filter(item => serviceIds.has(item.serviceId)),
    jsmSnapshots: source.jsmSnapshots.filter(item => serviceIds.has(item.serviceId)),
    documentControls: source.documentControls.filter(item => serviceIds.has(item.serviceId)),
    reportEvidence: source.reportEvidence.filter(item => serviceIds.has(item.serviceId)),
    financialEvidence: source.financialEvidence.filter(item => serviceIds.has(item.serviceId)),
  };
}

function calculateForSource(source: RecurringDashboardV2Source, cutOffDate: string, staleAfterHours: number) {
  return calculateRecurringServicesMetrics({
    cutOffDate,
    services: source.services,
    billingMonths: source.billingMonths,
    workPlanItems: source.workPlanItems,
    documents: source.documents,
    slaConfigs: source.slaConfigs,
    operationalEvidence: latestOperationalEvidence(source.jsmSnapshots, cutOffDate, staleAfterHours),
  });
}

function financeTrend(source: RecurringDashboardV2Source, cutOffDate: string) {
  const buckets = new Map<string, { month: string; currency: string; scheduled: number; invoiced: number; collected: number; pending: number; overdue: number }>();
  for (const row of source.billingMonths) {
    const month = monthKey(row.dueDate);
    if (!month) continue;
    const service = source.services.find(item => item.id === row.serviceId);
    const currency = normalizedCurrency(row.currency ?? service?.currency);
    const key = `${month}:${currency}`;
    const bucket = buckets.get(key) ?? { month, currency, scheduled: 0, invoiced: 0, collected: 0, pending: 0, overdue: 0 };
    const value = numeric(row.amount);
    bucket.scheduled += value;
    if (row.status === "pagado") {
      bucket.invoiced += value;
      bucket.collected += value;
    } else if (row.status === "facturado") {
      bucket.invoiced += value;
    } else {
      bucket.pending += value;
      if (row.dueDate && row.dueDate < cutOffDate) bucket.overdue += value;
    }
    buckets.set(key, bucket);
  }
  return Array.from(buckets.values()).sort((a, b) => a.month.localeCompare(b.month) || a.currency.localeCompare(b.currency));
}

function financialAnalytics(
  source: RecurringDashboardV2Source,
  services: ServiceMetricsV2[],
  cutOffDate: string,
) {
  const cutOff = new Date(`${cutOffDate}T23:59:59.999Z`).getTime();
  const confirmedEvidence = source.financialEvidence.filter(row => {
    const occurredAt = new Date(row.occurredAt).getTime();
    return row.status === "confirmed" && Number.isFinite(occurredAt) && occurredAt <= cutOff;
  });

  const rows = services.map(service => {
    const normalizedDealId = normalizeRecurringDealId(service.dealId);
    const matches = normalizedDealId
      ? source.financialReferences.filter(reference => normalizeRecurringDealId(reference.dealId) === normalizedDealId)
      : [];
    const reference = matches.length === 1 ? matches[0] : null;
    const localCurrencies = Object.values(service.finance.byCurrency).sort((a, b) => a.currency.localeCompare(b.currency));
    const comparableToCorporateUf = localCurrencies.length === 1 && localCurrencies[0].currency === "UF" && reference !== null;
    const evidence = confirmedEvidence.filter(row => row.serviceId === service.id);
    const evidenceByCurrency: Record<string, { currency: string; invoiced: number; collected: number; creditNotes: number; items: number }> = {};

    for (const item of evidence) {
      const currency = normalizedCurrency(item.currency);
      const bucket = evidenceByCurrency[currency] ?? { currency, invoiced: 0, collected: 0, creditNotes: 0, items: 0 };
      const value = numeric(item.amount);
      if (item.evidenceType === "invoice") bucket.invoiced += value;
      if (item.evidenceType === "payment") bucket.collected += value;
      if (item.evidenceType === "credit_note") bucket.creditNotes += value;
      bucket.items += 1;
      evidenceByCurrency[currency] = bucket;
    }

    const status = !normalizedDealId
      ? "no_deal"
      : matches.length === 0
        ? "missing_reference"
        : matches.length > 1
          ? "ambiguous"
          : comparableToCorporateUf
            ? "comparable"
            : "reference_not_comparable";

    return {
      serviceId: service.id,
      clientName: service.clientName,
      serviceName: service.serviceName,
      dealId: service.dealId,
      reconciliationStatus: status,
      localCurrencies,
      verifiedEvidenceByCurrency: Object.values(evidenceByCurrency).sort((a, b) => a.currency.localeCompare(b.currency)),
      corporateReference: reference
        ? {
            valorVentaUF: reference.valorVentaUF === null ? null : numeric(reference.valorVentaUF),
            presupuestoUF: reference.presupuestoUF == null ? null : numeric(reference.presupuestoUF),
            utilizadoUF: reference.utilizadoUF == null ? null : numeric(reference.utilizadoUF),
            planificadoUF: reference.planificadoUF == null ? null : numeric(reference.planificadoUF),
            proyectadoUF: reference.proyectadoUF == null ? null : numeric(reference.proyectadoUF),
            lineaNegocio: reference.lineaNegocio ?? null,
            syncedAt: reference.syncedAt ? isoDate(reference.syncedAt) : null,
          }
        : null,
    };
  });

  const latestCorporateSyncAt = source.financialReferences
    .map(reference => reference.syncedAt ? isoDate(reference.syncedAt) : null)
    .filter((value): value is string => value !== null)
    .sort()
    .at(-1) ?? null;

  return {
    summary: {
      reconciledServices: rows.filter(row => row.corporateReference !== null).length,
      comparableUfServices: rows.filter(row => row.reconciliationStatus === "comparable").length,
      missingReferenceServices: rows.filter(row => row.reconciliationStatus === "missing_reference").length,
      ambiguousServices: rows.filter(row => row.reconciliationStatus === "ambiguous").length,
      verifiedInvoiceEvidence: confirmedEvidence.filter(row => row.evidenceType === "invoice").length,
      verifiedPaymentEvidence: confirmedEvidence.filter(row => row.evidenceType === "payment").length,
      latestCorporateSyncAt,
    },
    services: rows,
  };
}

type ReportCellStatus =
  | "accepted"
  | "delivered"
  | "completed_without_evidence"
  | "rejected"
  | "waived"
  | "overdue"
  | "planned"
  | "unscheduled_evidence";

interface ReportCell {
  workPlanItemId: number | null;
  evidenceId: number | null;
  period: string;
  dueDate: string | null;
  status: ReportCellStatus;
  evidenceStatus: string | null;
  deliveredAt: string | null;
  acceptedAt: string | null;
  evidenceDocumentId: number | null;
  deliveryTiming: "unknown" | "on_time" | "late";
}

function dateOnly(value: Date | string | null): string | null {
  if (!value) return null;
  return isoDate(value).slice(0, 10);
}

function reportCellStatus(
  evidence: RecurringDashboardV2Source["reportEvidence"][number] | undefined,
  workPlanStatus: string | null,
  dueDate: string | null,
  cutOffDate: string,
): ReportCellStatus {
  if (evidence?.status === "accepted") return "accepted";
  if (evidence?.status === "delivered") return "delivered";
  if (evidence?.status === "rejected") return "rejected";
  if (evidence?.status === "waived") return "waived";
  if (workPlanStatus === "completado") return "completed_without_evidence";
  if (dueDate && dueDate <= cutOffDate) return "overdue";
  return evidence ? "unscheduled_evidence" : "planned";
}

function deliverablesAnalytics(source: RecurringDashboardV2Source, cutOffDate: string) {
  const plannedReports = source.workPlanItems.filter(item => item.itemType === "informe_mensual");
  const usedEvidence = new Set<number>();
  const rows = source.services.map(service => {
    const items = plannedReports.filter(item => item.serviceId === service.id);
    const serviceEvidence = source.reportEvidence.filter(item => item.serviceId === service.id);
    const cells: ReportCell[] = items.map(item => {
      const dueMonth = monthKey(item.dueDate);
      const evidence = serviceEvidence.find(candidate => candidate.workPlanItemId === item.id)
        ?? serviceEvidence.find(candidate => !candidate.workPlanItemId && monthKey(candidate.periodStart) === dueMonth);
      if (evidence?.id !== undefined) usedEvidence.add(evidence.id);
      const deliveredDate = dateOnly(evidence?.deliveredAt ?? null);
      const dueDate = item.dueDate ?? evidence?.dueDate ?? null;
      return {
        workPlanItemId: item.id,
        evidenceId: evidence?.id ?? null,
        period: dueMonth ?? monthKey(evidence?.periodStart ?? null) ?? "sin-fecha",
        dueDate,
        status: reportCellStatus(evidence, item.status, dueDate, cutOffDate),
        evidenceStatus: evidence?.status ?? null,
        deliveredAt: evidence?.deliveredAt ? isoDate(evidence.deliveredAt) : null,
        acceptedAt: evidence?.acceptedAt ? isoDate(evidence.acceptedAt) : null,
        evidenceDocumentId: evidence?.evidenceDocumentId ?? null,
        deliveryTiming: !deliveredDate || !dueDate ? "unknown" : deliveredDate <= dueDate ? "on_time" : "late",
      };
    });

    for (const evidence of serviceEvidence) {
      if (evidence.id !== undefined && usedEvidence.has(evidence.id)) continue;
      const deliveredDate = dateOnly(evidence.deliveredAt);
      cells.push({
        workPlanItemId: evidence.workPlanItemId,
        evidenceId: evidence.id ?? null,
        period: monthKey(evidence.periodStart) ?? "sin-fecha",
        dueDate: evidence.dueDate,
        status: reportCellStatus(evidence, null, evidence.dueDate, cutOffDate),
        evidenceStatus: evidence.status,
        deliveredAt: evidence.deliveredAt ? isoDate(evidence.deliveredAt) : null,
        acceptedAt: evidence.acceptedAt ? isoDate(evidence.acceptedAt) : null,
        evidenceDocumentId: evidence.evidenceDocumentId,
        deliveryTiming: !deliveredDate ? "unknown" : deliveredDate <= evidence.dueDate ? "on_time" : "late",
      });
    }

    cells.sort((a, b) => a.period.localeCompare(b.period));
    return { serviceId: service.id, clientName: service.clientName, serviceName: service.serviceName, cells };
  });

  const cells = rows.flatMap(row => row.cells);
  const dueCells = cells.filter(cell => cell.dueDate !== null && cell.dueDate <= cutOffDate && cell.status !== "waived");
  const deliveredCells = dueCells.filter(cell => cell.status === "delivered" || cell.status === "accepted");
  const timedDeliveries = deliveredCells.filter(cell => cell.deliveryTiming !== "unknown");
  return {
    periods: distinctSorted(cells.map(cell => cell.period)),
    summary: {
      planned: cells.filter(cell => cell.workPlanItemId !== null).length,
      due: dueCells.length,
      deliveredWithEvidence: deliveredCells.length,
      accepted: dueCells.filter(cell => cell.status === "accepted").length,
      overdue: dueCells.filter(cell => ["overdue", "rejected", "completed_without_evidence"].includes(cell.status)).length,
      completedWithoutEvidence: dueCells.filter(cell => cell.status === "completed_without_evidence").length,
      deliveryRate: dueCells.length > 0 ? Math.round((deliveredCells.length / dueCells.length) * 1000) / 10 : null,
      acceptanceRate: dueCells.length > 0 ? Math.round((dueCells.filter(cell => cell.status === "accepted").length / dueCells.length) * 1000) / 10 : null,
      onTimeRate: timedDeliveries.length > 0 ? Math.round((timedDeliveries.filter(cell => cell.deliveryTiming === "on_time").length / timedDeliveries.length) * 1000) / 10 : null,
    },
    rows,
  };
}

function documentAnalytics(source: RecurringDashboardV2Source, cutOffDate: string) {
  const requiredTypes = ["contrato", "sow"] as const;
  type DocumentStatus = "valid" | "pending" | "unvalidated" | "expired" | "rejected" | "missing";
  type RequiredDocumentRow = {
    documentId: number | null;
    docType: (typeof requiredTypes)[number];
    status: DocumentStatus;
    validUntil: string | null;
    validatedAt: string | null;
  };
  const statusRank = { valid: 5, pending: 4, unvalidated: 3, expired: 2, rejected: 1, missing: 0 } as const;
  const services = source.services.map(service => {
    const serviceDocuments = source.documents.filter(document => document.serviceId === service.id);
    const documents: RequiredDocumentRow[] = requiredTypes.map(docType => {
      const candidates = serviceDocuments
        .filter(document => document.docType === docType)
        .map(document => {
          const control = source.documentControls.find(item => item.documentId === document.id);
          const status: DocumentStatus = !control
            ? "unvalidated"
            : control.validationStatus === "valid" && control.validUntil && control.validUntil < cutOffDate
              ? "expired"
              : control.validationStatus;
          return {
            documentId: document.id,
            docType,
            status,
            validUntil: control?.validUntil ?? null,
            validatedAt: control?.validatedAt ? isoDate(control.validatedAt) : null,
          };
        })
        .sort((a, b) => statusRank[b.status] - statusRank[a.status]);
      return candidates.length > 0
        ? candidates[0]
        : { documentId: null, docType, status: "missing", validUntil: null, validatedAt: null };
    });
    const status = documents.every(item => item.status === "valid")
      ? "valid"
      : documents.some(item => item.status === "missing" || item.status === "expired" || item.status === "rejected")
        ? "at_risk"
        : "pending_validation";
    return {
      serviceId: service.id,
      clientName: service.clientName,
      serviceName: service.serviceName,
      status,
      documents,
      additionalDocuments: serviceDocuments.filter(document => !requiredTypes.includes(document.docType as typeof requiredTypes[number])).length,
    };
  });
  const requiredDocuments = services.flatMap(service => service.documents);
  return {
    requiredTypes,
    summary: {
      required: requiredDocuments.length,
      present: requiredDocuments.filter(item => item.status !== "missing").length,
      valid: requiredDocuments.filter(item => item.status === "valid").length,
      pendingValidation: requiredDocuments.filter(item => item.status === "pending" || item.status === "unvalidated").length,
      expiredOrRejected: requiredDocuments.filter(item => item.status === "expired" || item.status === "rejected").length,
      missing: requiredDocuments.filter(item => item.status === "missing").length,
      validServices: services.filter(service => service.status === "valid").length,
    },
    services,
  };
}

function reportTrend(source: RecurringDashboardV2Source, cutOffDate: string) {
  const buckets = new Map<string, { month: string; planned: number; due: number; completedDue: number; overdue: number }>();
  for (const row of source.workPlanItems.filter(item => item.itemType === "informe_mensual")) {
    const month = monthKey(row.dueDate);
    if (!month) continue;
    const bucket = buckets.get(month) ?? { month, planned: 0, due: 0, completedDue: 0, overdue: 0 };
    bucket.planned += 1;
    if (row.dueDate && row.dueDate <= cutOffDate) {
      bucket.due += 1;
      if (row.status === "completado") bucket.completedDue += 1;
      else bucket.overdue += 1;
    }
    buckets.set(month, bucket);
  }
  return Array.from(buckets.values()).sort((a, b) => a.month.localeCompare(b.month));
}

function incidentTrend(source: RecurringDashboardV2Source) {
  const buckets = new Map<string, { capturedAt: string; total: number; open: number; criticalOpen: number; servicesMeasured: number }>();
  for (const snapshot of source.jsmSnapshots.filter(item => item.status === "success" || item.status === "partial")) {
    const capturedAt = isoDate(snapshot.capturedAt).slice(0, 10);
    const bucket = buckets.get(capturedAt) ?? { capturedAt, total: 0, open: 0, criticalOpen: 0, servicesMeasured: 0 };
    bucket.total += snapshot.incidentCount ?? 0;
    bucket.open += snapshot.openIncidentCount ?? 0;
    bucket.criticalOpen += snapshot.criticalOpenCount ?? 0;
    bucket.servicesMeasured += 1;
    buckets.set(capturedAt, bucket);
  }
  return Array.from(buckets.values()).sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
}

function distinctSorted(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim())).map(value => value.trim()))).sort((a, b) => a.localeCompare(b, "es"));
}

function qualityForSource(source: RecurringDashboardV2Source) {
  return diagnoseRecurringServicesQuality({
    services: source.services,
    billingMonths: source.billingMonths,
    documents: source.documents,
    financialReferences: source.financialReferences,
  });
}

export function buildRecurringServicesDashboardV2(source: RecurringDashboardV2Source, options: RecurringDashboardV2Options) {
  const filters = options.filters ?? {};
  const staleAfterHours = options.staleAfterHours ?? 36;
  const initialIds = baseServiceIds(source, filters);
  const initialSource = restrictSource(source, initialIds);
  const initialMetrics = calculateForSource(initialSource, options.cutOffDate, staleAfterHours);
  const healthIds = filters.health
    ? new Set(initialMetrics.services.filter(service => service.health === filters.health).map(service => service.id))
    : initialIds;
  const filteredSource = restrictSource(initialSource, healthIds);
  const metrics = filters.health ? calculateForSource(filteredSource, options.cutOffDate, staleAfterHours) : initialMetrics;
  const quality = qualityForSource(filteredSource);
  const qualityByService = new Map(quality.services.map(item => [item.serviceId, item]));

  const matrix = metrics.services
    .map(service => ({
      serviceId: service.id,
      clientName: service.clientName,
      serviceName: service.serviceName,
      dealId: service.dealId,
      serviceType: service.serviceType,
      status: service.status,
      currentStage: service.currentStage,
      health: service.health,
      healthSignals: service.healthSignals,
      evidenceCoveragePercent: service.evidenceCoveragePercent,
      financeByCurrency: service.finance.byCurrency,
      reports: service.reports,
      formalization: service.formalization,
      incidents: service.incidents,
      sla: service.sla,
      quality: qualityByService.get(service.id) as ServiceDataQuality,
    }))
    .sort((a, b) => HEALTH_ORDER[a.health] - HEALTH_ORDER[b.health] || a.clientName.localeCompare(b.clientName, "es") || a.serviceName.localeCompare(b.serviceName, "es"));

  const latestSnapshotAt = filteredSource.jsmSnapshots
    .map(item => isoDate(item.capturedAt))
    .sort()
    .at(-1) ?? null;
  const financeAnalytics = financialAnalytics(filteredSource, metrics.services, options.cutOffDate);
  const deliverables = deliverablesAnalytics(filteredSource, options.cutOffDate);
  const documents = documentAnalytics(filteredSource, options.cutOffDate);

  return {
    metadata: {
      contractVersion: metrics.contractVersion,
      cutOffDate: metrics.cutOffDate,
      generatedAt: metrics.generatedAt,
      staleAfterHours,
      totalBeforeFilters: source.services.length,
      totalAfterFilters: metrics.services.length,
      appliedFilters: filters,
      latestJsmSnapshotAt: latestSnapshotAt,
    },
    filterOptions: {
      clients: distinctSorted(source.services.map(item => item.clientName)),
      statuses: distinctSorted(source.services.map(item => item.status)),
      serviceTypes: distinctSorted(source.services.map(item => item.serviceType)),
      currencies: distinctSorted(source.services.map(item => normalizedCurrency(item.currency))),
      health: ["critical", "attention", "stable", "no_data"] as const,
    },
    kpis: metrics.portfolio,
    trends: {
      finance: financeTrend(filteredSource, options.cutOffDate),
      reports: reportTrend(filteredSource, options.cutOffDate),
      incidents: incidentTrend(filteredSource),
    },
    financeAnalytics,
    deliverables,
    documents,
    matrix,
    quality,
    evidenceInventory: {
      documentControls: filteredSource.documentControls.length,
      reportEvidence: filteredSource.reportEvidence.length,
      financialEvidence: filteredSource.financialEvidence.length,
      jsmSnapshots: filteredSource.jsmSnapshots.length,
    },
  };
}
