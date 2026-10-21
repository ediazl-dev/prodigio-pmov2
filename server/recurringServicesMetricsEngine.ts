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

import type { JiraBillingEvidence } from "./jiraBillingEvidence";
import { getRecurringServiceContractPolicy } from "./recurringServiceContractPolicy";
import { isRecurringServiceClosed } from "../shared/recurringServiceLifecycle";

export const RECURRING_DASHBOARD_METRICS_VERSION = "2.2" as const;

export type RecurringHealthLevel = "critical" | "attention" | "stable" | "no_data";
export type EvidenceStatus = "available" | "not_configured" | "stale" | "error" | "not_applicable";

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
  monthNumber?: number;
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
  sourceKind?: "recurring_service_documents" | "document_artifacts";
}

/** Raw canonical artifact shape accepted by the recurring read model. */
export interface RecurringCanonicalDocumentArtifactSource {
  id: number;
  serviceId?: number;
  entityType?: string | null;
  entityId?: number;
  requirementCode: string;
  artifactStatus: string;
  version: number;
  fileName: string;
  fileUrl?: string | null;
  fileKey?: string | null;
  observedAt?: Date | string | null;
  createdAt?: Date | string | null;
}

/** Latest-decision fields used only to preserve canonical validation controls. */
export interface RecurringCanonicalDocumentDecisionSource {
  id: number;
  artifactId: number;
  decision: string;
  validFrom?: string | null;
  validUntil?: string | null;
  openEndedValidity?: boolean;
  decidedAt?: Date | string | null;
}

export interface RecurringCanonicalDocumentEvidenceSource {
  artifacts: RecurringCanonicalDocumentArtifactSource[];
  decisions: RecurringCanonicalDocumentDecisionSource[];
}

export interface RecurringDocumentControlMetricSource {
  id?: number;
  serviceId: number;
  documentId: number;
  validationStatus: "pending" | "valid" | "expired" | "rejected";
  validFrom: string | null;
  validUntil: string | null;
  validatedAt: Date | string | null;
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
  documentControls?: RecurringDocumentControlMetricSource[];
  slaConfigs: RecurringSlaConfigMetricSource[];
  operationalEvidence?: RecurringOperationalEvidenceSource[];
  reportEvidence?: Array<{ serviceId: number; workPlanItemId: number | null; status: string; deliveredAt?: Date | string | null; acceptedAt?: Date | string | null }>;
  jiraBilling?: Record<number, JiraBillingEvidence>;
  /** Canonical artifacts are optional for compatibility with legacy fixtures. */
  canonicalDocumentEvidence?: RecurringCanonicalDocumentEvidenceSource;
  canonicalDocumentArtifacts?: RecurringCanonicalDocumentArtifactSource[];
  canonicalDocumentDecisions?: RecurringCanonicalDocumentDecisionSource[];
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
  lifecycleStatus: "open" | "closed";
  health: RecurringHealthLevel;
  healthSignals: MetricSignal[];
  evidenceCoveragePercent: number;
  finance: {
    byCurrency: Record<string, CurrencyMetrics>;
    billingRows: number;
    overdueRows: number;
    planMatchesContract: boolean | null;
    billingStatusUnknownRows: number;
    source: "jira_operational" | "corporate_historical";
  };
  reports: {
    planned: number;
    due: number;
    completedDue: number;
    overdue: number;
    unconfirmed: number;
    deliveryRate: number | null;
    onTimeRate: null;
    source: "recurring_service_work_plan";
  };
  formalization: {
    required: readonly ["contrato", "sow"];
    requiredMode: "any";
    present: string[];
    missing: string[];
    coveragePercent: number;
    status: "complete" | "partial" | "missing";
    source: "recurring_service_documents" | "document_artifacts";
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
    applicability: "applicable" | "not_applicable";
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
const CONTRACTUAL_REQUIREMENT_LABEL = "Contrato o SoW";
const MONEY_EPSILON = 0.01;

function canonicalDocType(requirementCode: string): "contrato" | "sow" | null {
  if (requirementCode === "contract" || requirementCode === "contrato") return "contrato";
  if (requirementCode === "sow") return "sow";
  return null;
}

function dateTime(value: Date | string | null | undefined): number {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Merge canonical document_artifacts into the legacy document/control read model.
 *
 * Active canonical artifacts own their contractual type: a legacy row of the same
 * type is not duplicated, and an archived/superseded canonical history prevents
 * an older legacy row from silently becoming the current source.  A canonical
 * artifact remains present when its latest decision is pending/rejected/expired;
 * only the generated control changes, so presence is never treated as validation.
 */
export function mergeRecurringCanonicalDocumentEvidence(
  legacyDocuments: RecurringDocumentMetricSource[],
  legacyControls: RecurringDocumentControlMetricSource[],
  canonicalArtifacts: RecurringCanonicalDocumentArtifactSource[] = [],
  canonicalDecisions: RecurringCanonicalDocumentDecisionSource[] = [],
): { documents: RecurringDocumentMetricSource[]; documentControls: RecurringDocumentControlMetricSource[] } {
  const contractualArtifacts = canonicalArtifacts.filter(artifact => {
    const docType = canonicalDocType(artifact.requirementCode);
    return Boolean(docType) && (!artifact.entityType || artifact.entityType === "recurring_service");
  });
  const canonicalTypes = new Set(contractualArtifacts.map(artifact => `${artifact.serviceId ?? artifact.entityId}:${canonicalDocType(artifact.requirementCode)}`));
  const documents = legacyDocuments.filter(document => !canonicalTypes.has(`${document.serviceId}:${document.docType}`));
  const documentControls = legacyControls.filter(control => documents.some(document => document.id === control.documentId && document.serviceId === control.serviceId));

  const latestDecision = (artifactId: number) => canonicalDecisions
    .filter(decision => decision.artifactId === artifactId)
    .sort((left, right) => dateTime(right.decidedAt) - dateTime(left.decidedAt) || right.id - left.id)[0];

  const activeByType = new Map<string, RecurringCanonicalDocumentArtifactSource>();
  for (const artifact of contractualArtifacts) {
    const docType = canonicalDocType(artifact.requirementCode);
    if (!docType || artifact.artifactStatus !== "active") continue;
    const key = `${artifact.serviceId ?? artifact.entityId}:${docType}`;
    const current = activeByType.get(key);
    if (!current || artifact.version > current.version || (artifact.version === current.version && artifact.id > current.id)) activeByType.set(key, artifact);
  }

  for (const artifact of Array.from(activeByType.values())) {
    const docType = canonicalDocType(artifact.requirementCode)!;
    const decision = latestDecision(artifact.id);
    const normalizedDecision = decision?.decision ?? "pending";
    const validationStatus: RecurringDocumentControlMetricSource["validationStatus"] = normalizedDecision === "valid"
      ? decision?.openEndedValidity || decision?.validUntil ? "valid" : "pending"
      : normalizedDecision === "rejected" || normalizedDecision === "revoked"
        ? "rejected"
        : "pending";
    documents.push({ id: artifact.id, serviceId: artifact.serviceId ?? artifact.entityId!, docType, sourceKind: "document_artifacts" });
    documentControls.push({
      id: decision?.id,
      serviceId: artifact.serviceId ?? artifact.entityId!,
      documentId: artifact.id,
      validationStatus,
      validFrom: decision?.validFrom ?? null,
      validUntil: decision?.validUntil ?? null,
      validatedAt: decision?.decidedAt ?? null,
    });
  }

  return { documents, documentControls };
}

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

function isCurrentOperationalStatus(status: string): boolean {
  return status === "activo" || status === "pausado";
}

export function calculateRecurringServicesMetrics(
  input: RecurringServicesMetricsInput,
): RecurringServicesPortfolioMetricsV2 {
  const canonicalEvidence = input.canonicalDocumentEvidence ?? {
    artifacts: input.canonicalDocumentArtifacts ?? [],
    decisions: input.canonicalDocumentDecisions ?? [],
  };
  const mergedDocuments = mergeRecurringCanonicalDocumentEvidence(
    input.documents,
    input.documentControls ?? [],
    canonicalEvidence.artifacts,
    canonicalEvidence.decisions,
  );
  const effectiveDocuments = mergedDocuments.documents;
  const operationalByService = new Map((input.operationalEvidence ?? []).map(item => [item.serviceId, item]));

  const services = input.services.map<ServiceMetricsV2>(service => {
    const closed = isRecurringServiceClosed(service.status);
    const billing = input.billingMonths.filter(item => item.serviceId === service.id);
    const workPlan = input.workPlanItems.filter(item => item.serviceId === service.id);
    const reports = workPlan.filter(item => item.itemType === "informe_mensual");
    const documents = effectiveDocuments.filter(item => item.serviceId === service.id);
    const slaConfigs = input.slaConfigs.filter(item => item.serviceId === service.id);
    const slaApplicable = getRecurringServiceContractPolicy(service.serviceType as Parameters<typeof getRecurringServiceContractPolicy>[0]).incidentSlaApplicable;
    const operational = slaApplicable ? operationalByService.get(service.id) : undefined;
    const jiraBilling = input.jiraBilling?.[service.id];
    const jiraOperational = input.jiraBilling !== undefined;
    const jiraByMonth = new Map(jiraBilling?.items.filter(item => item.monthNumber != null).map(item => [item.monthNumber, item]) ?? []);
    let billingStatusUnknownRows = 0;
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

      const jiraItem = jiraOperational && row.monthNumber != null ? jiraByMonth.get(row.monthNumber) : undefined;
      const jiraStatus = jiraOperational ? jiraItem?.billingStatus ?? "unknown" : null;
      const hasVerifiedInvoice = !jiraOperational && row.invoiceSource === "corporate_financial";
      if (jiraStatus === "unknown") {
        if (!expectedDueDate || expectedDueDate <= input.cutOffDate) billingStatusUnknownRows += 1;
      } else if (jiraStatus === "not_billed" || (!jiraBilling && !hasVerifiedInvoice)) {
        expectedBucket.pending += expectedAmount;
        if (expectedDueDate && expectedDueDate < input.cutOffDate) {
          expectedBucket.overdue += expectedAmount;
          expectedBucket.overdueItems += 1;
        }
      }
      financeByCurrency[expectedCurrency] = expectedBucket;

      if (jiraStatus === "billed" && jiraItem?.amount != null && jiraItem.currency) {
        const invoiceCurrency = normalizeCurrency(jiraItem.currency);
        const invoiceBucket = financeByCurrency[invoiceCurrency] ?? createCurrencyMetrics(invoiceCurrency);
        invoiceBucket.invoiced += jiraItem.amount;
        financeByCurrency[invoiceCurrency] = invoiceBucket;
      } else if (hasVerifiedInvoice) {
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
    if (billingStatusUnknownRows > 0) signals.push({
      code: "BILLING_STATUS_UNCONFIRMED", level: "attention",
      message: `${billingStatusUnknownRows} cuota(s) exigible(s) sin estado de facturación acreditado en Jira; verificar emisión.`,
    });
    if (service.endDate && service.endDate < input.cutOffDate && service.status === "activo") {
      signals.push({
        code: "CONTRACT_TERM_ELAPSED_ACTIVE",
        level: "attention",
        message: `La fecha de término contractual (${service.endDate}) ya pasó, pero la ficha sigue activa; verificar continuidad o cierre administrativo.`,
      });
    }

    const dueReports = reports.filter(item => item.dueDate !== null && item.dueDate <= input.cutOffDate);
    const reportEvidence = (input.reportEvidence ?? []).filter(item => item.serviceId === service.id);
    const deliveredIds = new Set(reportEvidence.filter(item => ["delivered", "accepted"].includes(item.status) && (item.deliveredAt || (item.status === "accepted" && item.acceptedAt))).map(item => item.workPlanItemId));
    const rejectedIds = new Set(reportEvidence.filter(item => item.status === "rejected").map(item => item.workPlanItemId));
    const completedDueReports = dueReports.filter(item => service.serviceType === "staffing" ? deliveredIds.has(item.id) : item.status === "completado");
    const reportsWithoutCompletion = dueReports.filter(item => item.status !== "completado");
    // El estado del plan no prueba entrega; para Staffing sólo la evidencia vinculada acredita el reporte.
    const unconfirmedReports = service.serviceType === "staffing" ? dueReports.filter(item => !deliveredIds.has(item.id) && !rejectedIds.has(item.id)) : [];
    const overdueReports = service.serviceType === "staffing" ? dueReports.filter(item => rejectedIds.has(item.id)) : reportsWithoutCompletion;
    if (overdueReports.length > 0) {
      signals.push({
        code: "OVERDUE_REPORTS",
        level: "critical",
        message: `${overdueReports.length} reporte(s) exigibles no están completados a la fecha de corte.`,
      });
    }
    if (unconfirmedReports.length > 0) {
      signals.push({
        code: "REPORT_DELIVERY_UNCONFIRMED",
        level: "attention",
        message: `${unconfirmedReports.length} reporte(s) exigible(s) sin entrega acreditada en PMO; verificar evidencia, sin presumir incumplimiento.`,
      });
    }

    const presentDocuments = Array.from(new Set(documents.map(item => item.docType)));
    const hasContractualEvidence = presentDocuments.some(docType => REQUIRED_DOCUMENTS.includes(docType as typeof REQUIRED_DOCUMENTS[number]));
    // Recurrent services require one contractual base: Contrato OR SoW. Keep
    // the candidate list for API compatibility, but never publish 50% coverage.
    const missingDocuments = hasContractualEvidence ? [] : [CONTRACTUAL_REQUIREMENT_LABEL];
    const formalizationCoverage = hasContractualEvidence ? 100 : 0;
    const formalizationStatus = hasContractualEvidence ? "complete" : "missing";
    if (!hasContractualEvidence) {
      signals.push({ code: "CONTRACT_DOCUMENT_MISSING", level: "critical", message: "No existe Contrato o SoW cargado como evidencia formal." });
    }

    const operationalStatus: EvidenceStatus = slaApplicable ? operational?.status ?? "not_configured" : "not_applicable";
    const firstResponseCompliance = operationalStatus === "available"
      ? percentage(operational?.firstResponseMet ?? null, operational?.firstResponseMeasured ?? null)
      : null;
    const resolutionCompliance = operationalStatus === "available"
      ? percentage(operational?.resolutionMet ?? null, operational?.resolutionMeasured ?? null)
      : null;

    if (slaApplicable && service.jsmServiceDeskId === null) {
      qualityIssues.push("JSM_SERVICE_DESK_NOT_CONFIRMED");
      signals.push({ code: "JSM_EVIDENCE_UNAVAILABLE", level: "attention", message: "No existe un Service Desk JSM confirmado para medir incidentes y SLA." });
    } else if (slaApplicable && operationalStatus !== "available") {
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
      slaApplicable && operationalStatus === "available",
      slaApplicable && measuredSlaRates.length > 0,
    ].filter(Boolean).length;

    const historicalHealth = determineHealth(signals, evidenceDimensions);

    return {
      id: service.id,
      clientName: service.clientName,
      serviceName: service.serviceName,
      dealId: service.dealId,
      serviceType: service.serviceType,
      status: service.status,
      currentStage: service.currentStage,
      lifecycleStatus: closed ? "closed" : "open",
      // Closed services retain historical severity for bounded presentation,
      // but never expose current action signals.
      health: historicalHealth,
      healthSignals: closed ? [] : signals,
      evidenceCoveragePercent: Math.round((evidenceDimensions / (slaApplicable ? 5 : 3)) * 100),
      finance: {
        byCurrency: financeByCurrency,
        billingRows: billing.length,
        overdueRows,
        planMatchesContract,
        billingStatusUnknownRows,
        source: jiraOperational ? "jira_operational" : "corporate_historical",
      },
      reports: {
        planned: reports.length,
        due: dueReports.length,
        completedDue: completedDueReports.length,
        overdue: overdueReports.length,
        unconfirmed: unconfirmedReports.length,
        deliveryRate: unconfirmedReports.length > 0 ? null : percentage(completedDueReports.length, dueReports.length),
        onTimeRate: null,
        source: "recurring_service_work_plan",
      },
      formalization: {
        required: REQUIRED_DOCUMENTS,
        requiredMode: "any",
        present: presentDocuments,
        missing: missingDocuments,
        coveragePercent: formalizationCoverage,
        status: formalizationStatus,
        source: documents.some(document => document.sourceKind === "document_artifacts") ? "document_artifacts" : "recurring_service_documents",
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
        applicability: slaApplicable ? "applicable" : "not_applicable",
        configuredRules: slaApplicable ? slaConfigs.length : 0,
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
    if (isCurrentOperationalStatus(service.status)) healthCounts[service.health] += 1;
  }

  const currentServices = services.filter(service => isCurrentOperationalStatus(service.status));
  const reportDue = currentServices.reduce((sum, service) => sum + service.reports.due, 0);
  const reportCompleted = currentServices.reduce((sum, service) => sum + service.reports.completedDue, 0);
  const operationalServices = currentServices.filter(service => service.incidents.availability === "available");
  const applicableServices = currentServices.filter(service => service.sla.applicability === "applicable");
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
        overdue: currentServices.reduce((sum, service) => sum + service.reports.overdue, 0),
        deliveryRate: percentage(reportCompleted, reportDue),
        onTimeRate: null,
      },
      formalization: {
        complete: currentServices.filter(service => service.formalization.status === "complete").length,
        partial: currentServices.filter(service => service.formalization.status === "partial").length,
        missing: currentServices.filter(service => service.formalization.status === "missing").length,
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
        configuredServices: applicableServices.filter(service => service.sla.configuredRules > 0).length,
        availableServices: applicableServices.filter(service => service.sla.firstResponseCompliance !== null || service.sla.resolutionCompliance !== null).length,
        firstResponseCompliance: averageNullable(applicableServices.map(service => service.sla.firstResponseCompliance)),
        resolutionCompliance: averageNullable(applicableServices.map(service => service.sla.resolutionCompliance)),
      },
      qualityIssueCount: currentServices.reduce((sum, service) => sum + service.qualityIssues.length, 0),
    },
  };
}
