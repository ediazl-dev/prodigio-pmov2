/**
 * Motor determinista del Dashboard de Servicios Recurrentes V2.
 *
 * Reglas principales:
 * - Nunca suma monedas distintas.
 * - "Facturado" incluye cuotas con estado facturado y trata el estado histórico
 *   pagado únicamente como compatibilidad de una cuota ya facturada.
 * - El ciclo financiero recurrente termina en Facturado: no calcula cobros ni CxC.
 * - Una configuración SLA no equivale a cumplimiento SLA.
 * - Ausencia de evidencia se expresa con null y disponibilidad explícita.
 * - Todos los vencimientos se evalúan contra una fecha de corte ISO (YYYY-MM-DD).
 */

export const RECURRING_DASHBOARD_METRICS_VERSION = "2.1" as const;

export type RecurringHealthLevel = "critical" | "attention" | "stable" | "no_data";
export type EvidenceStatus = "available" | "not_configured" | "stale" | "error";

export interface RecurringServiceMetricSource {
  id: number;
  clientName: string;
  serviceName: string;
  dealId: string | null;
  serviceType: string;
  status: string;
  currentStage: string;
  currency: string | null;
  totalContractAmount: string | number | null;
  formalStartDate: string | null;
  endDate: string | null;
  jsmProjectKey: string | null;
  jsmServiceDeskId: string | null;
}

export interface RecurringBillingMetricSource {
  id: number;
  serviceId: number;
  dueDate: string | null;
  amount: string | number;
  currency: string | null;
  status: "pendiente" | "facturado" | "pagado";
  invoiceNumber?: string | null;
  expectedAmount?: string | number;
  expectedCurrency?: string;
  expectedDueDate?: string | null;
  invoiceAmount?: string | number | null;
  invoiceCurrency?: string | null;
  invoiceSource?: "corporate_financial" | "local_status" | "schedule";
  invoiceDate?: string | null;
  reconciliationStatus?: string;
}

export interface RecurringWorkPlanMetricSource {
  id: number;
  serviceId: number;
  itemType: string;
  dueDate: string | null;
  status: "pendiente" | "en_progreso" | "completado" | "vencido";
}

export interface RecurringDocumentMetricSource {
  id: number;
  serviceId: number;
  docType: string;
}

export interface RecurringSlaConfigMetricSource {
  id: number;
  serviceId: number;
  priority: string;
}

export interface RecurringOperationalEvidenceSource {
  serviceId: number;
  status: EvidenceStatus;
  observedAt: string | null;
  totalTickets: number | null;
  openTickets: number | null;
  criticalOpen: number | null;
  highOpen: number | null;
  overdueOpen: number | null;
  unresolvedOver30Days: number | null;
  firstResponseMeasured: number | null;
  firstResponseMet: number | null;
  resolutionMeasured: number | null;
  resolutionMet: number | null;
}

export interface RecurringServicesMetricsInput {
  cutOffDate: string;
  services: RecurringServiceMetricSource[];
  billingMonths: RecurringBillingMetricSource[];
  workPlanItems: RecurringWorkPlanMetricSource[];
  documents: RecurringDocumentMetricSource[];
  slaConfigs: RecurringSlaConfigMetricSource[];
  operationalEvidence?: RecurringOperationalEvidenceSource[];
}

export interface CurrencyMetrics {
  currency: string;
  contracted: number;
  scheduled: number;
  invoiced: number;
  pending: number;
  overdue: number;
  overdueItems: number;
}

export interface MetricSignal {
  code: string;
  level: Exclude<RecurringHealthLevel, "stable" | "no_data">;
  message: string;
}

export interface ServiceMetricsV2 {
  id: number;
  clientName: string;
  serviceName: string;
  dealId: string | null;
  serviceType: string;
  status: string;
  currentStage: string;
  health: RecurringHealthLevel;
  healthSignals: MetricSignal[];
  evidenceCoveragePercent: number;
  finance: {
    byCurrency: Record<string, CurrencyMetrics>;
    billingRows: number;
    overdueRows: number;
    planMatchesContract: boolean | null;
    source: "recurring_service_billing_months.status";
  };
  reports: {
    planned: number;
    due: number;
    completedDue: number;
    overdue: number;
    deliveryRate: number | null;
    onTimeRate: null;
    source: "recurring_service_work_plan";
  };
  formalization: {
    required: readonly ["contrato", "sow"];
    present: string[];
    missing: string[];
    coveragePercent: number;
    status: "complete" | "partial" | "missing";
    source: "recurring_service_documents";
  };
  incidents: {
    availability: EvidenceStatus;
    observedAt: string | null;
    total: number | null;
    open: number | null;
    criticalOpen: number | null;
    highOpen: number | null;
    overdueOpen: number | null;
    unresolvedOver30Days: number | null;
    source: "jsm_snapshot";
  };
  sla: {
    configuredRules: number;
    availability: EvidenceStatus;
    observedAt: string | null;
    firstResponseCompliance: number | null;
    resolutionCompliance: number | null;
    source: "jsm_snapshot";
  };
  qualityIssues: string[];
}

export interface RecurringServicesPortfolioMetricsV2 {
  contractVersion: typeof RECURRING_DASHBOARD_METRICS_VERSION;
  cutOffDate: string;
  generatedAt: string;
  services: ServiceMetricsV2[];
  portfolio: {
    totalServices: number;
    activeServices: number;
    statusCounts: Record<string, number>;
    typeCounts: Record<string, number>;
    healthCounts: Record<RecurringHealthLevel, number>;
    financeByCurrency: Record<string, CurrencyMetrics>;
    reports: {
      due: number;
      completedDue: number;
      overdue: number;
      deliveryRate: number | null;
      onTimeRate: null;
    };
    formalization: {
      complete: number;
      partial: number;
      missing: number;
    };
    incidents: {
      availableServices: number;
      total: number | null;
      open: number | null;
      criticalOpen: number | null;
      highOpen: number | null;
      overdueOpen: number | null;
      unresolvedOver30Days: number | null;
    };
    sla: {
      configuredServices: number;
      availableServices: number;
      firstResponseCompliance: number | null;
      resolutionCompliance: number | null;
    };
    qualityIssueCount: number;
  };
}

const REQUIRED_DOCUMENTS = ["contrato", "sow"] as const;
const MONEY_EPSILON = 0.01;

function amount(value: string | number | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCurrency(value: string | null | undefined): string {
  const normalized = value?.trim().toUpperCase();
  return normalized || "N/D";
}

function percentage(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function createCurrencyMetrics(currency: string): CurrencyMetrics {
  return {
    currency,
    contracted: 0,
    scheduled: 0,
    invoiced: 0,
    pending: 0,
    overdue: 0,
    overdueItems: 0,
  };
}

function addCurrencyMetrics(target: Record<string, CurrencyMetrics>, source: CurrencyMetrics) {
  const current = target[source.currency] ?? createCurrencyMetrics(source.currency);
  current.contracted += source.contracted;
  current.scheduled += source.scheduled;
  current.invoiced += source.invoiced;
  current.pending += source.pending;
  current.overdue += source.overdue;
  current.overdueItems += source.overdueItems;
  target[source.currency] = current;
}

function determineHealth(signals: MetricSignal[], evidenceDimensions: number): RecurringHealthLevel {
  if (evidenceDimensions === 0) return "no_data";
  if (signals.some(signal => signal.level === "critical")) return "critical";
  if (signals.some(signal => signal.level === "attention")) return "attention";
  return "stable";
}

export function calculateRecurringServicesMetrics(
  input: RecurringServicesMetricsInput,
): RecurringServicesPortfolioMetricsV2 {
  const operationalByService = new Map((input.operationalEvidence ?? []).map(item => [item.serviceId, item]));

  const services = input.services.map<ServiceMetricsV2>(service => {
    const billing = input.billingMonths.filter(item => item.serviceId === service.id);
    const workPlan = input.workPlanItems.filter(item => item.serviceId === service.id);
    const reports = workPlan.filter(item => item.itemType === "informe_mensual");
    const documents = input.documents.filter(item => item.serviceId === service.id);
    const slaConfigs = input.slaConfigs.filter(item => item.serviceId === service.id);
    const operational = operationalByService.get(service.id);
    const qualityIssues: string[] = [];
    const signals: MetricSignal[] = [];

    const serviceCurrency = normalizeCurrency(service.currency);
    const financeByCurrency: Record<string, CurrencyMetrics> = {};
    const contractBucket = createCurrencyMetrics(serviceCurrency);
    contractBucket.contracted = amount(service.totalContractAmount);
    financeByCurrency[serviceCurrency] = contractBucket;

    for (const row of billing) {
      const expectedCurrency = normalizeCurrency(row.expectedCurrency ?? row.currency ?? service.currency);
      const expectedBucket = financeByCurrency[expectedCurrency] ?? createCurrencyMetrics(expectedCurrency);
      const expectedAmount = amount(row.expectedAmount ?? row.amount);
      const expectedDueDate = row.expectedDueDate ?? row.dueDate;
      expectedBucket.scheduled += expectedAmount;

      const hasVerifiedInvoice = row.invoiceSource === "corporate_financial";
      if (!hasVerifiedInvoice) {
        expectedBucket.pending += expectedAmount;
        if (expectedDueDate && expectedDueDate < input.cutOffDate) {
          expectedBucket.overdue += expectedAmount;
          expectedBucket.overdueItems += 1;
        }
      }
      financeByCurrency[expectedCurrency] = expectedBucket;

      if (hasVerifiedInvoice) {
        const invoiceCurrency = normalizeCurrency(row.invoiceCurrency ?? expectedCurrency);
        const invoiceBucket = financeByCurrency[invoiceCurrency] ?? createCurrencyMetrics(invoiceCurrency);
        invoiceBucket.invoiced += amount(row.invoiceAmount ?? expectedAmount);
        financeByCurrency[invoiceCurrency] = invoiceBucket;
      }
    }

    const currencies = Object.keys(financeByCurrency);
    if (serviceCurrency === "N/D") qualityIssues.push("SERVICE_CURRENCY_MISSING");
    if (currencies.length > 1) qualityIssues.push("MIXED_SERVICE_CURRENCY");

    const planMatchesContract = currencies.length === 1
      ? Math.abs(financeByCurrency[currencies[0]].contracted - financeByCurrency[currencies[0]].scheduled) < MONEY_EPSILON
      : null;
    if (planMatchesContract === false) {
      qualityIssues.push("CONTRACT_BILLING_PLAN_MISMATCH");
      signals.push({
        code: "CONTRACT_BILLING_PLAN_MISMATCH",
        level: "attention",
        message: "El monto contratado no coincide con la programación de facturación.",
      });
    }

    const overdueRows = Object.values(financeByCurrency).reduce((sum, metric) => sum + metric.overdueItems, 0);
    if (overdueRows > 0) {
      signals.push({
        code: "OVERDUE_BILLING",
        level: "critical",
        message: `${overdueRows} cuota(s) permanecen pendientes de facturar después de su fecha de vencimiento.`,
      });
    }

    const dueReports = reports.filter(item => item.dueDate !== null && item.dueDate <= input.cutOffDate);
    const completedDueReports = dueReports.filter(item => item.status === "completado");
    const overdueReports = dueReports.filter(item => item.status !== "completado");
    if (overdueReports.length > 0) {
      signals.push({
        code: "OVERDUE_REPORTS",
        level: "critical",
        message: `${overdueReports.length} reporte(s) exigibles no están completados a la fecha de corte.`,
      });
    }

    const presentDocuments = Array.from(new Set(documents.map(item => item.docType)));
    const missingDocuments = REQUIRED_DOCUMENTS.filter(docType => !presentDocuments.includes(docType));
    const formalizationCoverage = Math.round(((REQUIRED_DOCUMENTS.length - missingDocuments.length) / REQUIRED_DOCUMENTS.length) * 100);
    const formalizationStatus = missingDocuments.length === 0 ? "complete" : missingDocuments.length === REQUIRED_DOCUMENTS.length ? "missing" : "partial";
    if (missingDocuments.includes("contrato")) {
      signals.push({ code: "CONTRACT_DOCUMENT_MISSING", level: "critical", message: "No existe contrato cargado como evidencia formal." });
    } else if (missingDocuments.length > 0) {
      signals.push({ code: "FORMAL_DOCUMENT_MISSING", level: "attention", message: `Falta evidencia formal: ${missingDocuments.join(", ")}.` });
    }

    const operationalStatus: EvidenceStatus = operational?.status ?? "not_configured";
    const firstResponseCompliance = operationalStatus === "available"
      ? percentage(operational?.firstResponseMet ?? null, operational?.firstResponseMeasured ?? null)
      : null;
    const resolutionCompliance = operationalStatus === "available"
      ? percentage(operational?.resolutionMet ?? null, operational?.resolutionMeasured ?? null)
      : null;

    if (service.jsmServiceDeskId === null) {
      qualityIssues.push("JSM_SERVICE_DESK_NOT_CONFIRMED");
      signals.push({ code: "JSM_EVIDENCE_UNAVAILABLE", level: "attention", message: "No existe un Service Desk JSM confirmado para medir incidentes y SLA." });
    } else if (operationalStatus !== "available") {
      qualityIssues.push(`JSM_EVIDENCE_${operationalStatus.toUpperCase()}`);
      signals.push({ code: "JSM_EVIDENCE_UNAVAILABLE", level: "attention", message: "La evidencia operacional JSM no está disponible o vigente." });
    }

    if ((operational?.criticalOpen ?? 0) > 0) {
      signals.push({ code: "CRITICAL_INCIDENT_OPEN", level: "critical", message: "Existe al menos un incidente crítico abierto." });
    } else if ((operational?.highOpen ?? 0) > 0) {
      signals.push({ code: "HIGH_INCIDENT_OPEN", level: "attention", message: "Existe al menos un incidente de alta prioridad abierto." });
    }

    const measuredSlaRates = [firstResponseCompliance, resolutionCompliance].filter((value): value is number => value !== null);
    if (measuredSlaRates.some(rate => rate < 90)) {
      signals.push({ code: "SLA_CRITICAL_BREACH", level: "critical", message: "El cumplimiento SLA medido es inferior a 90%." });
    } else if (measuredSlaRates.some(rate => rate < 95)) {
      signals.push({ code: "SLA_AT_RISK", level: "attention", message: "El cumplimiento SLA medido es inferior a 95%." });
    }

    const evidenceDimensions = [
      billing.length > 0 || amount(service.totalContractAmount) > 0,
      reports.length > 0,
      documents.length > 0,
      operationalStatus === "available",
      measuredSlaRates.length > 0,
    ].filter(Boolean).length;

    return {
      id: service.id,
      clientName: service.clientName,
      serviceName: service.serviceName,
      dealId: service.dealId,
      serviceType: service.serviceType,
      status: service.status,
      currentStage: service.currentStage,
      health: determineHealth(signals, evidenceDimensions),
      healthSignals: signals,
      evidenceCoveragePercent: Math.round((evidenceDimensions / 5) * 100),
      finance: {
        byCurrency: financeByCurrency,
        billingRows: billing.length,
        overdueRows,
        planMatchesContract,
        source: "recurring_service_billing_months.status",
      },
      reports: {
        planned: reports.length,
        due: dueReports.length,
        completedDue: completedDueReports.length,
        overdue: overdueReports.length,
        deliveryRate: percentage(completedDueReports.length, dueReports.length),
        onTimeRate: null,
        source: "recurring_service_work_plan",
      },
      formalization: {
        required: REQUIRED_DOCUMENTS,
        present: presentDocuments,
        missing: missingDocuments,
        coveragePercent: formalizationCoverage,
        status: formalizationStatus,
        source: "recurring_service_documents",
      },
      incidents: {
        availability: operationalStatus,
        observedAt: operational?.observedAt ?? null,
        total: operationalStatus === "available" ? operational?.totalTickets ?? null : null,
        open: operationalStatus === "available" ? operational?.openTickets ?? null : null,
        criticalOpen: operationalStatus === "available" ? operational?.criticalOpen ?? null : null,
        highOpen: operationalStatus === "available" ? operational?.highOpen ?? null : null,
        overdueOpen: operationalStatus === "available" ? operational?.overdueOpen ?? null : null,
        unresolvedOver30Days: operationalStatus === "available" ? operational?.unresolvedOver30Days ?? null : null,
        source: "jsm_snapshot",
      },
      sla: {
        configuredRules: slaConfigs.length,
        availability: operationalStatus,
        observedAt: operational?.observedAt ?? null,
        firstResponseCompliance,
        resolutionCompliance,
        source: "jsm_snapshot",
      },
      qualityIssues,
    };
  });

  const financeByCurrency: Record<string, CurrencyMetrics> = {};
  for (const service of services) {
    for (const metric of Object.values(service.finance.byCurrency)) addCurrencyMetrics(financeByCurrency, metric);
  }

  const statusCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};
  const healthCounts: Record<RecurringHealthLevel, number> = { critical: 0, attention: 0, stable: 0, no_data: 0 };
  for (const service of services) {
    statusCounts[service.status] = (statusCounts[service.status] ?? 0) + 1;
    typeCounts[service.serviceType] = (typeCounts[service.serviceType] ?? 0) + 1;
    healthCounts[service.health] += 1;
  }

  const reportDue = services.reduce((sum, service) => sum + service.reports.due, 0);
  const reportCompleted = services.reduce((sum, service) => sum + service.reports.completedDue, 0);
  const operationalServices = services.filter(service => service.incidents.availability === "available");
  const sumNullable = (values: Array<number | null>): number | null => {
    const available = values.filter((value): value is number => value !== null);
    return available.length > 0 ? available.reduce((sum, value) => sum + value, 0) : null;
  };
  const averageNullable = (values: Array<number | null>): number | null => {
    const available = values.filter((value): value is number => value !== null);
    if (available.length === 0) return null;
    return Math.round((available.reduce((sum, value) => sum + value, 0) / available.length) * 10) / 10;
  };

  return {
    contractVersion: RECURRING_DASHBOARD_METRICS_VERSION,
    cutOffDate: input.cutOffDate,
    generatedAt: new Date().toISOString(),
    services,
    portfolio: {
      totalServices: services.length,
      activeServices: services.filter(service => service.status === "activo").length,
      statusCounts,
      typeCounts,
      healthCounts,
      financeByCurrency,
      reports: {
        due: reportDue,
        completedDue: reportCompleted,
        overdue: services.reduce((sum, service) => sum + service.reports.overdue, 0),
        deliveryRate: percentage(reportCompleted, reportDue),
        onTimeRate: null,
      },
      formalization: {
        complete: services.filter(service => service.formalization.status === "complete").length,
        partial: services.filter(service => service.formalization.status === "partial").length,
        missing: services.filter(service => service.formalization.status === "missing").length,
      },
      incidents: {
        availableServices: operationalServices.length,
        total: sumNullable(operationalServices.map(service => service.incidents.total)),
        open: sumNullable(operationalServices.map(service => service.incidents.open)),
        criticalOpen: sumNullable(operationalServices.map(service => service.incidents.criticalOpen)),
        highOpen: sumNullable(operationalServices.map(service => service.incidents.highOpen)),
        overdueOpen: sumNullable(operationalServices.map(service => service.incidents.overdueOpen)),
        unresolvedOver30Days: sumNullable(operationalServices.map(service => service.incidents.unresolvedOver30Days)),
      },
      sla: {
        configuredServices: services.filter(service => service.sla.configuredRules > 0).length,
        availableServices: services.filter(service => service.sla.firstResponseCompliance !== null || service.sla.resolutionCompliance !== null).length,
        firstResponseCompliance: averageNullable(services.map(service => service.sla.firstResponseCompliance)),
        resolutionCompliance: averageNullable(services.map(service => service.sla.resolutionCompliance)),
      },
      qualityIssueCount: services.reduce((sum, service) => sum + service.qualityIssues.length, 0),
    },
  };
}
