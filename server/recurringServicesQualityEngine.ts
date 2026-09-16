import { RECURRING_SERVICE_TYPE_VALUES, type RecurringServiceType } from "../shared/recurringServiceTypes";

export type DataQualitySeverity = "info" | "warning" | "error";
export type DataQualityDimension = "deal" | "currency" | "service_type" | "contract" | "documents" | "jsm";
export type DataQualityStatus = "valid" | "warning" | "blocked";

export interface RecurringServiceQualitySource {
  id: number;
  clientName: string;
  serviceName: string;
  dealId: string | null;
  serviceType: string;
  currency: string | null;
  totalContractAmount: string | number | null;
  pipedriveDealCurrency: string | null;
  pipedriveDealAmount: string | number | null;
  jsmProjectKey: string | null;
  jsmProjectId: string | null;
  jsmServiceDeskId: string | null;
  jsmLinkHealth: string | null;
}

export interface RecurringBillingQualitySource {
  serviceId: number;
  amount: string | number;
  currency: string | null;
}

export interface RecurringDocumentQualitySource {
  serviceId: number;
  docType: string;
}

export interface RecurringFinancialReferenceSource {
  id: number;
  dealId: string;
  clientName: string | null;
  projectName: string | null;
  valorVentaUF: string | number | null;
  presupuestoUF?: string | number | null;
  utilizadoUF?: string | number | null;
  planificadoUF?: string | number | null;
  proyectadoUF?: string | number | null;
  lineaNegocio?: string | null;
  syncedAt?: Date | string | null;
}

export interface DataQualityIssue {
  code: string;
  dimension: DataQualityDimension;
  severity: DataQualitySeverity;
  message: string;
  blocksTrustedMetrics: boolean;
}

export interface ConfirmedCorrection {
  field: "serviceType" | "currency";
  currentValue: string | null;
  proposedValue: string;
  evidence: string;
}

export interface ServiceDataQuality {
  serviceId: number;
  status: DataQualityStatus;
  score: number;
  trustedDimensions: number;
  totalDimensions: 6;
  normalizedDealId: string | null;
  financialMatchCount: number;
  issues: DataQualityIssue[];
  confirmedCorrections: ConfirmedCorrection[];
}

export interface RecurringServicesQualityInput {
  services: RecurringServiceQualitySource[];
  billingMonths: RecurringBillingQualitySource[];
  documents: RecurringDocumentQualitySource[];
  financialReferences: RecurringFinancialReferenceSource[];
}

export interface RecurringServicesQualityResult {
  generatedAt: string;
  services: ServiceDataQuality[];
  summary: {
    valid: number;
    warning: number;
    blocked: number;
    issueCount: number;
    confirmedCorrectionCount: number;
  };
}

const REQUIRED_DOCUMENTS = ["contrato", "sow"] as const;
const DIMENSIONS: DataQualityDimension[] = ["deal", "currency", "service_type", "contract", "documents", "jsm"];
const CANONICAL_TYPES = new Set<string>(RECURRING_SERVICE_TYPE_VALUES);
const MONEY_EPSILON = 0.01;

export function normalizeRecurringDealId(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const compact = value.trim().toUpperCase().replace(/^DEAL[\s_-]*/, "").replace(/[\s_-]/g, "");
  return compact || null;
}

function normalizeCurrency(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase();
  return normalized || null;
}

function amount(value: string | number | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusFromIssues(issues: DataQualityIssue[]): DataQualityStatus {
  if (issues.some(issue => issue.severity === "error")) return "blocked";
  if (issues.some(issue => issue.severity === "warning")) return "warning";
  return "valid";
}

function addIssue(
  issues: DataQualityIssue[],
  issue: DataQualityIssue,
) {
  issues.push(issue);
}

export function diagnoseRecurringServicesQuality(
  input: RecurringServicesQualityInput,
): RecurringServicesQualityResult {
  const financialByDeal = new Map<string, RecurringFinancialReferenceSource[]>();
  for (const reference of input.financialReferences) {
    const normalized = normalizeRecurringDealId(reference.dealId);
    if (!normalized) continue;
    financialByDeal.set(normalized, [...(financialByDeal.get(normalized) ?? []), reference]);
  }

  const services = input.services.map<ServiceDataQuality>(service => {
    const issues: DataQualityIssue[] = [];
    const confirmedCorrections: ConfirmedCorrection[] = [];
    const normalizedDealId = normalizeRecurringDealId(service.dealId);
    const financialMatches = normalizedDealId ? (financialByDeal.get(normalizedDealId) ?? []) : [];
    const billing = input.billingMonths.filter(row => row.serviceId === service.id);
    const documents = input.documents.filter(row => row.serviceId === service.id);
    const serviceCurrency = normalizeCurrency(service.currency);
    const pipedriveCurrency = normalizeCurrency(service.pipedriveDealCurrency);
    const billingCurrencies = new Set(billing.map(row => normalizeCurrency(row.currency)).filter((value): value is string => value !== null));

    if (!normalizedDealId) {
      addIssue(issues, { code: "DEAL_MISSING", dimension: "deal", severity: "error", message: "El servicio no tiene Deal identificable.", blocksTrustedMetrics: true });
    } else if (financialMatches.length === 0) {
      addIssue(issues, { code: "DEAL_NOT_RECONCILED", dimension: "deal", severity: "warning", message: "El Deal no tiene coincidencia en la fuente financiera corporativa.", blocksTrustedMetrics: false });
    } else if (financialMatches.length > 1) {
      addIssue(issues, { code: "DEAL_AMBIGUOUS", dimension: "deal", severity: "error", message: "El Deal coincide con más de un registro financiero.", blocksTrustedMetrics: true });
    }

    if (!serviceCurrency) {
      addIssue(issues, { code: "CURRENCY_MISSING", dimension: "currency", severity: "error", message: "La moneda contractual no está informada.", blocksTrustedMetrics: true });
      if (pipedriveCurrency && billingCurrencies.size <= 1) {
        confirmedCorrections.push({ field: "currency", currentValue: service.currency, proposedValue: pipedriveCurrency, evidence: "Moneda única informada por Pipedrive y sin contradicción en cuotas." });
      }
    } else {
      const mismatchedBillingCurrencies = Array.from(billingCurrencies).filter(currency => currency !== serviceCurrency);
      if (mismatchedBillingCurrencies.length > 0) {
        addIssue(issues, { code: "BILLING_CURRENCY_MISMATCH", dimension: "currency", severity: "error", message: `Las cuotas contienen moneda(s) ${mismatchedBillingCurrencies.join(", ")} distinta(s) de ${serviceCurrency}.`, blocksTrustedMetrics: true });
      }
      if (pipedriveCurrency && pipedriveCurrency !== serviceCurrency) {
        addIssue(issues, { code: "PIPEDRIVE_CURRENCY_MISMATCH", dimension: "currency", severity: "warning", message: `Pipedrive informa ${pipedriveCurrency} y el contrato local ${serviceCurrency}.`, blocksTrustedMetrics: false });
      }
    }

    if (!CANONICAL_TYPES.has(service.serviceType)) {
      addIssue(issues, { code: "SERVICE_TYPE_NON_CANONICAL", dimension: "service_type", severity: "error", message: "El tipo de servicio no pertenece al catálogo canónico.", blocksTrustedMetrics: true });
    }
    if (/\bstaffing\b/i.test(service.serviceName) && service.serviceType !== "staffing") {
      addIssue(issues, { code: "STAFFING_NAME_TYPE_MISMATCH", dimension: "service_type", severity: "error", message: "El nombre contractual identifica Staffing, pero el tipo persistido es distinto.", blocksTrustedMetrics: true });
      confirmedCorrections.push({ field: "serviceType", currentValue: service.serviceType, proposedValue: "staffing" satisfies RecurringServiceType, evidence: "La denominación persistida del servicio contiene explícitamente “Staffing”." });
    }

    const scheduledAmount = billing.reduce((sum, row) => sum + amount(row.amount), 0);
    const contractedAmount = amount(service.totalContractAmount);
    if (billing.length === 0) {
      addIssue(issues, { code: "BILLING_PLAN_MISSING", dimension: "contract", severity: "error", message: "No existe programación de facturación.", blocksTrustedMetrics: true });
    } else if (Math.abs(contractedAmount - scheduledAmount) >= MONEY_EPSILON) {
      addIssue(issues, { code: "CONTRACT_BILLING_PLAN_MISMATCH", dimension: "contract", severity: "error", message: "El monto contratado no coincide con la suma de cuotas programadas.", blocksTrustedMetrics: true });
    }

    const presentDocumentTypes = new Set(documents.map(document => document.docType));
    for (const requiredDocument of REQUIRED_DOCUMENTS) {
      if (!presentDocumentTypes.has(requiredDocument)) {
        addIssue(issues, { code: `${requiredDocument.toUpperCase()}_MISSING`, dimension: "documents", severity: requiredDocument === "contrato" ? "error" : "warning", message: `Falta el documento obligatorio ${requiredDocument}.`, blocksTrustedMetrics: requiredDocument === "contrato" });
      }
    }

    if (!service.jsmProjectKey && !service.jsmServiceDeskId) {
      addIssue(issues, { code: "JSM_NOT_LINKED", dimension: "jsm", severity: "warning", message: "No existe vínculo JSM; incidentes y SLA quedarán N/D.", blocksTrustedMetrics: false });
    } else if (service.jsmProjectKey && !service.jsmServiceDeskId) {
      addIssue(issues, { code: "JSM_SERVICE_DESK_NOT_CONFIRMED", dimension: "jsm", severity: "warning", message: "Existe proyecto Jira, pero falta confirmar el Service Desk JSM.", blocksTrustedMetrics: false });
    } else if (!service.jsmProjectKey && service.jsmServiceDeskId) {
      addIssue(issues, { code: "JSM_PROJECT_NOT_CONFIRMED", dimension: "jsm", severity: "error", message: "Existe Service Desk sin proyecto Jira confirmado.", blocksTrustedMetrics: true });
    } else if (service.jsmLinkHealth !== "healthy") {
      addIssue(issues, { code: "JSM_LINK_NOT_HEALTHY", dimension: "jsm", severity: "warning", message: "El vínculo JSM no tiene salud vigente confirmada.", blocksTrustedMetrics: false });
    }

    if (financialMatches.length === 1 && serviceCurrency !== "UF") {
      addIssue(issues, { code: "FINANCIAL_REFERENCE_UF_NOT_DIRECTLY_COMPARABLE", dimension: "contract", severity: "info", message: "La referencia corporativa está expresada en UF y no debe compararse directamente con el contrato local sin tipo de cambio y fecha.", blocksTrustedMetrics: false });
    }

    const affectedDimensions = new Set(issues.filter(issue => issue.severity !== "info").map(issue => issue.dimension));
    const trustedDimensions = DIMENSIONS.length - affectedDimensions.size;
    const score = Math.round((trustedDimensions / DIMENSIONS.length) * 100);
    return {
      serviceId: service.id,
      status: statusFromIssues(issues),
      score,
      trustedDimensions,
      totalDimensions: 6,
      normalizedDealId,
      financialMatchCount: financialMatches.length,
      issues,
      confirmedCorrections,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    services,
    summary: {
      valid: services.filter(service => service.status === "valid").length,
      warning: services.filter(service => service.status === "warning").length,
      blocked: services.filter(service => service.status === "blocked").length,
      issueCount: services.reduce((sum, service) => sum + service.issues.length, 0),
      confirmedCorrectionCount: services.reduce((sum, service) => sum + service.confirmedCorrections.length, 0),
    },
  };
}
