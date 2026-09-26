/**
 * View model del rediseño de la Torre de Control (orden por decisión).
 *
 * Reglas que este archivo hace cumplir:
 * - NUNCA se suman monedas distintas (regla del motor de métricas 2.0).
 *   El monto expuesto se expresa por moneda; para ORDENAR se usa el mayor
 *   monto vencido de una sola moneda, nunca la suma de varias.
 * - Una dimensión sin evidencia no ocupa espacio de primer orden: se colapsa
 *   a una línea con su causa y su acción.
 * - N/D nunca se sustituye por 0 ni por un supuesto.
 *
 * No requiere cambios de backend: todo sale del payload actual de
 * `trpc.recurringServices.dashboardV2`.
 */

import type { RouterOutputs } from "@/lib/trpc";
import { formatRecurringMoney, type RecurringHealthKey } from "./recurringDashboardV2ViewModel";

export type DashboardV2Data = RouterOutputs["recurringServices"]["dashboardV2"];
export type MatrixRow = DashboardV2Data["matrix"][number];
export type MetricSignal = MatrixRow["healthSignals"][number];
export type SignalLevel = MetricSignal["level"];
export type CurrencyMetrics = MatrixRow["financeByCurrency"][string];

/* ────────────────────────────────────────────────────────────────────────── */
/* Tono visual por severidad                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export interface ToneTokens {
  label: string;
  text: string;
  surface: string;
  border: string;
}

export const SIGNAL_TONE: Record<SignalLevel, ToneTokens> = {
  critical: { label: "Crítico", text: "#B42318", surface: "#FEF3F2", border: "#FDA29B" },
  attention: { label: "Atención", text: "#B54708", surface: "#FFFAEB", border: "#FEDF89" },
};

export const NEUTRAL_TONE: ToneTokens = {
  label: "Sin datos",
  text: "#475569",
  surface: "#F1F5F9",
  border: "#CBD5E1",
};

/** Magenta de marca para texto/fondo accionable. #E91E8C con texto blanco no pasa AA (4.18:1). */
export const BRAND_ACTION = "#C91879";

/* ────────────────────────────────────────────────────────────────────────── */
/* Catálogo de señales: qué significa cada código y qué se hace con él        */
/* ────────────────────────────────────────────────────────────────────────── */

export type SignalDomain = "finanzas" | "entregables" | "formalidad" | "operacion";

interface SignalSpec {
  domain: SignalDomain;
  /** Texto del botón de la fila. */
  action: string;
  /** Pestaña de evidencia que debería quedar abierta al volver a la lista. */
  evidenceTab: SignalDomain;
}

/**
 * Códigos emitidos hoy por `recurringServicesMetricsEngine.ts`.
 * Un código no listado cae en DEFAULT_SIGNAL_SPEC y sigue funcionando.
 */
export const SIGNAL_CATALOG: Record<string, SignalSpec> = {
  OVERDUE_BILLING: { domain: "finanzas", action: "Gestionar facturación", evidenceTab: "finanzas" },
  CONTRACT_BILLING_PLAN_MISMATCH: { domain: "finanzas", action: "Revisar plan", evidenceTab: "finanzas" },
  OVERDUE_REPORTS: { domain: "entregables", action: "Revisar entregables", evidenceTab: "entregables" },
  CONTRACT_DOCUMENT_MISSING: { domain: "formalidad", action: "Cargar contrato", evidenceTab: "formalidad" },
  FORMAL_DOCUMENT_MISSING: { domain: "formalidad", action: "Completar formalidad", evidenceTab: "formalidad" },
  JSM_EVIDENCE_UNAVAILABLE: { domain: "operacion", action: "Revisar JSM", evidenceTab: "operacion" },
  CRITICAL_INCIDENT_OPEN: { domain: "operacion", action: "Ver incidentes", evidenceTab: "operacion" },
  HIGH_INCIDENT_OPEN: { domain: "operacion", action: "Ver incidentes", evidenceTab: "operacion" },
  SLA_CRITICAL_BREACH: { domain: "operacion", action: "Revisar SLA", evidenceTab: "operacion" },
  SLA_AT_RISK: { domain: "operacion", action: "Revisar SLA", evidenceTab: "operacion" },
};

const DEFAULT_SIGNAL_SPEC: SignalSpec = {
  domain: "operacion",
  action: "Abrir servicio",
  evidenceTab: "operacion",
};

export function specForSignal(code: string): SignalSpec {
  return SIGNAL_CATALOG[code] ?? DEFAULT_SIGNAL_SPEC;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Facturación vencida, sin mezclar monedas                                   */
/* ────────────────────────────────────────────────────────────────────────── */

export interface OverdueBreakdown {
  /** Una entrada por moneda con saldo vencido. */
  byCurrency: Array<{ currency: string; overdue: number; contracted: number; items: number }>;
  /** Etiqueta lista para pintar: "USD 480" o "USD 480 + CLP 1.200.000". */
  label: string;
  /** Total de cuotas vencidas (contar cuotas sí es válido entre monedas). */
  items: number;
  /**
   * Mayor monto vencido de UNA sola moneda. Sirve solo para ordenar la cola;
   * no es un total y no debe mostrarse como cifra.
   */
  sortKey: number;
  /** % de lo contratado, solo cuando hay una única moneda involucrada. */
  percentOfContracted: number | null;
}

export function overdueBreakdown(financeByCurrency: Record<string, CurrencyMetrics>): OverdueBreakdown {
  const rows = Object.values(financeByCurrency);
  const monetaryRows = rows.filter(row => row.currency !== "N/D");
  const byCurrency = monetaryRows
    .filter(row => row.overdue > 0)
    .map(row => ({ currency: row.currency, overdue: row.overdue, contracted: row.contracted, items: row.overdueItems }))
    .sort((a, b) => b.overdue - a.overdue);

  const items = rows.reduce((sum, row) => sum + row.overdueItems, 0);
  const label = byCurrency.length
    ? byCurrency.map(row => formatRecurringMoney(row.overdue, row.currency)).join(" + ")
    : "Sin pendientes vencidos";
  const sortKey = byCurrency.length ? byCurrency[0].overdue : 0;

  const single = monetaryRows.length === 1 && byCurrency.length === 1 ? byCurrency[0] : null;
  const percentOfContracted =
    single && single.contracted > 0 ? Math.round((single.overdue / single.contracted) * 100) : null;

  return { byCurrency, label, items, sortKey, percentOfContracted };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Cola de acción: una fila por hallazgo, no por servicio                     */
/* ────────────────────────────────────────────────────────────────────────── */

export interface ActionQueueItem {
  /** Estable entre renders: sirve como key y para deduplicar. */
  id: string;
  serviceId: number;
  serviceName: string;
  clientName: string;
  dealId: string | null;
  stageLabel: string;
  code: string;
  level: SignalLevel;
  message: string;
  domain: SignalDomain;
  /** Cifra o estado que se muestra a la derecha. */
  impactValue: string;
  impactNote: string;
  impactIsMoney: boolean;
  actionLabel: string;
  href: string;
  tone: ToneTokens;
  /** Clave de orden interna; expuesta para tests. */
  sortKey: number;
}

const LEVEL_WEIGHT: Record<SignalLevel, number> = { critical: 0, attention: 1 };

interface BuildQueueOptions {
  /** Etiquetas de etapa ya existentes en la página (STAGE_LABELS). */
  stageLabels?: Record<string, string>;
  /** Ruta base del detalle. Por defecto la actual del router. */
  detailPath?: (serviceId: number) => string;
}

/**
 * Aplana `matrix[].healthSignals` en una lista ordenada.
 *
 * Orden: severidad (critical antes que attention) → monto vencido de una sola
 * moneda, de mayor a menor → nombre del servicio, para que sea determinista.
 */
export function buildActionQueue(matrix: MatrixRow[], options: BuildQueueOptions = {}): ActionQueueItem[] {
  const stageLabels = options.stageLabels ?? {};
  const detailPath = options.detailPath ?? ((id: number) => `/recurring-services/${id}`);

  const items: ActionQueueItem[] = [];

  for (const row of matrix) {
    const overdue = overdueBreakdown(row.financeByCurrency);

    row.healthSignals.forEach((signal, index) => {
      const spec = specForSignal(signal.code);
      const impact = impactForSignal(signal, row, overdue);

      items.push({
        id: `${row.serviceId}:${signal.code}:${index}`,
        serviceId: row.serviceId,
        serviceName: row.serviceName,
        clientName: row.clientName,
        dealId: row.dealId,
        stageLabel: stageLabels[row.currentStage] ?? row.currentStage,
        code: signal.code,
        level: signal.level,
        message: signal.message,
        domain: spec.domain,
        impactValue: impact.value,
        impactNote: impact.note,
        impactIsMoney: impact.isMoney,
        actionLabel: spec.action,
        href: detailPath(row.serviceId),
        tone: SIGNAL_TONE[signal.level],
        sortKey: overdue.sortKey,
      });
    });
  }

  return items.sort(
    (a, b) =>
      LEVEL_WEIGHT[a.level] - LEVEL_WEIGHT[b.level] ||
      b.sortKey - a.sortKey ||
      a.serviceName.localeCompare(b.serviceName, "es"),
  );
}

function impactForSignal(
  signal: MetricSignal,
  row: MatrixRow,
  overdue: OverdueBreakdown,
): { value: string; note: string; isMoney: boolean; sortKey: number } {
  switch (signal.code) {
    case "OVERDUE_BILLING":
      return {
        value: overdue.label,
        note:
          overdue.percentOfContracted !== null
            ? `${overdue.percentOfContracted}% de lo contratado`
            : `${overdue.items} cuota${overdue.items === 1 ? "" : "s"} vencida${overdue.items === 1 ? "" : "s"}`,
        isMoney: true,
        sortKey: overdue.sortKey,
      };

    case "CONTRACT_BILLING_PLAN_MISMATCH":
      return { value: "Plan descuadrado", note: "Contratado ≠ programado", isMoney: false, sortKey: 0 };

    case "OVERDUE_REPORTS":
      return {
        value: `${row.reports.overdue} reporte${row.reports.overdue === 1 ? "" : "s"}`,
        note: `de ${row.reports.due} exigible${row.reports.due === 1 ? "" : "s"}`,
        isMoney: false,
        sortKey: 0,
      };

    case "CONTRACT_DOCUMENT_MISSING":
    case "FORMAL_DOCUMENT_MISSING":
      return {
        value: row.formalization.missing.length
          ? `Falta ${row.formalization.missing.join(", ")}`
          : "Formalidad incompleta",
        note: `Cobertura ${row.formalization.coveragePercent}%`,
        isMoney: false,
        sortKey: 0,
      };

    case "JSM_EVIDENCE_UNAVAILABLE":
      return { value: "Sin medición", note: "SLA e incidentes en N/D", isMoney: false, sortKey: 0 };

    case "CRITICAL_INCIDENT_OPEN":
    case "HIGH_INCIDENT_OPEN":
      return {
        value: row.incidents.open === null ? "N/D" : `${row.incidents.open} abiertos`,
        note: row.incidents.criticalOpen === null ? "Sin snapshot" : `${row.incidents.criticalOpen} críticos`,
        isMoney: false,
        sortKey: 0,
      };

    case "SLA_CRITICAL_BREACH":
    case "SLA_AT_RISK":
      return {
        value:
          row.sla.firstResponseCompliance === null ? "N/D" : `${row.sla.firstResponseCompliance}% 1ª resp.`,
        note: row.sla.resolutionCompliance === null ? "Resolución N/D" : `${row.sla.resolutionCompliance}% resolución`,
        isMoney: false,
        sortKey: 0,
      };

    default:
      return { value: "Revisar", note: signal.code, isMoney: false, sortKey: 0 };
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Cifras de primer orden                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

export interface DecisionMetric {
  key: "vencido" | "reportes" | "formalidad" | "operacion";
  eyebrow: string;
  value: string;
  detail: string;
  /** "alert" pinta rojo, "warn" ámbar, "calm" neutro. Nunca verde por defecto. */
  tone: "alert" | "warn" | "calm";
}

export function buildDecisionMetrics(data: DashboardV2Data): DecisionMetric[] {
  const { kpis, matrix, documents } = data;

  const overdueByCurrency = Object.values(kpis.financeByCurrency).filter(row => row.overdue > 0);
  const overdueItems = Object.values(kpis.financeByCurrency).reduce((sum, row) => sum + row.overdueItems, 0);
  const servicesWithOverdue = matrix.filter(row =>
    Object.values(row.financeByCurrency).some(currency => currency.overdue > 0),
  ).length;

  const pendingDocs = documents.summary.pendingValidation;
  const riskyDocs = documents.summary.missing + documents.summary.expiredOrRejected;

  const coverage =
    kpis.totalServices > 0 ? Math.round((kpis.incidents.availableServices / kpis.totalServices) * 100) : 0;

  return [
    {
      key: "vencido",
      eyebrow: "Por facturar vencido",
      value: overdueByCurrency.length
        ? overdueByCurrency.map(row => formatRecurringMoney(row.overdue, row.currency)).join(" + ")
        : "Sin pendientes vencidos",
      detail: overdueByCurrency.length
        ? `${overdueItems} cuota${overdueItems === 1 ? "" : "s"} en ${servicesWithOverdue} servicio${servicesWithOverdue === 1 ? "" : "s"}`
        : "Ninguna cuota pendiente de facturar después de su vencimiento",
      tone: overdueByCurrency.length ? "alert" : "calm",
    },
    {
      key: "reportes",
      eyebrow: "Reportes vencidos",
      value: String(kpis.reports.overdue),
      detail:
        kpis.reports.due > 0
          ? `${kpis.reports.completedDue} entregados de ${kpis.reports.due} exigibles`
          : "Ningún reporte exigible al corte",
      tone: kpis.reports.overdue > 0 ? "alert" : "calm",
    },
    {
      key: "formalidad",
      eyebrow: riskyDocs > 0 ? "Formalidad en riesgo" : "Formalidad sin validar",
      value: String(riskyDocs > 0 ? riskyDocs : pendingDocs),
      detail:
        riskyDocs > 0
          ? `${riskyDocs} documento${riskyDocs === 1 ? "" : "s"} faltante, vencido o rechazado`
          : `${kpis.formalization.complete}/${kpis.totalServices} con contrato y SoW presentes`,
      tone: riskyDocs > 0 ? "alert" : pendingDocs > 0 ? "warn" : "calm",
    },
    {
      key: "operacion",
      eyebrow: "Operación medida",
      value: `${coverage}%`,
      detail: `${kpis.incidents.availableServices} de ${kpis.activeServices} activos con snapshot JSM vigente`,
      tone: coverage === 100 ? "calm" : "warn",
    },
  ];
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Pestañas de evidencia y regla de colapso en N/D                            */
/* ────────────────────────────────────────────────────────────────────────── */

export interface EvidenceTab {
  key: SignalDomain;
  label: string;
  /** Hallazgos abiertos de esa dimensión. */
  findings: number;
  /** false ⇒ el panel se colapsa a una línea con causa y acción. */
  hasEvidence: boolean;
  /** Texto del estado colapsado. Solo se usa cuando hasEvidence es false. */
  emptyTitle: string;
  emptyReason: string;
  emptyAction: string;
  tone: "alert" | "warn" | "calm";
  /** Lo que se muestra en el badge: número, o "N/D" cuando no hay medición. */
  badge: string;
}

export function buildEvidenceTabs(data: DashboardV2Data, queue: ActionQueueItem[]): EvidenceTab[] {
  const { kpis, matrix, deliverables, documents, trends, activeServicesWithoutJsm } = withDerived(data);

  const countFor = (domain: SignalDomain) => queue.filter(item => item.domain === domain).length;

  const financeHasEvidence =
    trends.finance.length > 0 || Object.values(kpis.financeByCurrency).some(row => row.currency !== "N/D");
  const deliverablesHaveEvidence = deliverables.periods.length > 0;
  const documentsHaveEvidence = documents.summary.present > 0;
  const jsmHasEvidence = kpis.incidents.availableServices > 0;

  return [
    {
      key: "finanzas",
      label: "Financiero",
      findings: countFor("finanzas"),
      hasEvidence: financeHasEvidence,
      emptyTitle: "Sin planificación financiera cargada",
      emptyReason: "Ningún servicio del universo filtrado tiene cuotas programadas.",
      emptyAction: "Revisar cartera",
      tone: countFor("finanzas") > 0 ? "alert" : "calm",
      badge: financeHasEvidence ? String(countFor("finanzas")) : "N/D",
    },
    {
      key: "entregables",
      label: "Entregables",
      findings: countFor("entregables"),
      hasEvidence: deliverablesHaveEvidence,
      emptyTitle: "Sin reportes mensuales planificados",
      emptyReason: "No existen hitos de reporte en el plan de trabajo de estos servicios.",
      emptyAction: "Revisar cartera",
      tone: countFor("entregables") > 0 ? "alert" : "calm",
      badge: deliverablesHaveEvidence ? String(countFor("entregables")) : "N/D",
    },
    {
      key: "formalidad",
      label: "Formalidad",
      findings: countFor("formalidad"),
      hasEvidence: documentsHaveEvidence,
      emptyTitle: "Sin documentos cargados",
      emptyReason: "Ningún servicio tiene contrato ni SoW en el repositorio.",
      emptyAction: "Revisar cartera",
      tone:
        documents.summary.missing + documents.summary.expiredOrRejected > 0
          ? "alert"
          : documents.summary.pendingValidation > 0
            ? "warn"
            : "calm",
      badge: documentsHaveEvidence ? String(documents.summary.pendingValidation) : "N/D",
    },
    {
      key: "operacion",
      label: "Operación JSM",
      findings: countFor("operacion"),
      hasEvidence: jsmHasEvidence,
      emptyTitle: "Sin medición operacional: todavía no hay nada que mostrar",
      emptyReason: `${activeServicesWithoutJsm} de ${kpis.activeServices} servicios activos no tienen snapshot JSM vigente, así que incidentes, antigüedad y SLA quedan en N/D.`,
      emptyAction: "Revisar Spaces JSM",
      tone: jsmHasEvidence ? "calm" : "warn",
      badge: jsmHasEvidence ? String(countFor("operacion")) : "N/D",
    },
  ];
}

/** Primera pestaña con hallazgos, aunque esté colapsada; después, la primera con evidencia. */
export function defaultEvidenceTab(tabs: EvidenceTab[]): SignalDomain {
  const withFindings = tabs.find(tab => tab.findings > 0);
  if (withFindings) return withFindings.key;
  const withEvidence = tabs.find(tab => tab.hasEvidence);
  return withEvidence ? withEvidence.key : tabs[0].key;
}

function withDerived(data: DashboardV2Data) {
  return {
    ...data,
    activeServicesWithoutJsm: Math.max(0, data.kpis.activeServices - data.kpis.incidents.availableServices),
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Confianza de la lectura (barra bajo las cifras)                            */
/* ────────────────────────────────────────────────────────────────────────── */

export interface ConfidenceReading {
  valid: number;
  warning: number;
  blocked: number;
  total: number;
  issueCount: number;
  /** Un segmento por servicio, en el orden en que se pintan. */
  segments: Array<{ key: string; tone: "alert" | "warn" | "calm" }>;
}

export function buildConfidence(data: DashboardV2Data): ConfidenceReading {
  const { quality } = data;
  const total = quality.summary.valid + quality.summary.warning + quality.summary.blocked;

  const segments: ConfidenceReading["segments"] = [
    ...Array.from({ length: quality.summary.blocked }, (_, i) => ({ key: `b${i}`, tone: "alert" as const })),
    ...Array.from({ length: quality.summary.warning }, (_, i) => ({ key: `w${i}`, tone: "warn" as const })),
    ...Array.from({ length: quality.summary.valid }, (_, i) => ({ key: `v${i}`, tone: "calm" as const })),
  ];

  return {
    valid: quality.summary.valid,
    warning: quality.summary.warning,
    blocked: quality.summary.blocked,
    total,
    issueCount: quality.summary.issueCount,
    segments,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Utilidades de la tabla de cartera                                          */
/* ────────────────────────────────────────────────────────────────────────── */

export interface PortfolioRow {
  serviceId: number;
  serviceName: string;
  clientName: string;
  dealId: string | null;
  serviceTypeKey: string;
  stageKey: string;
  health: RecurringHealthKey;
  overdue: OverdueBreakdown;
  contractedLabel: string;
  /** 0–100, solo cuando hay una única moneda; si no, null y no se pinta barra. */
  overdueRatio: number | null;
  signals: MetricSignal[];
  reportsOverdue: number;
  reportsDue: number;
  reportsRate: number | null;
  formalizationCoverage: number;
  formalizationMissing: string[];
  slaFirstResponse: number | null;
  incidentsOpen: number | null;
  qualityScore: number;
  qualityStatus: string;
}

export function buildPortfolioRows(matrix: MatrixRow[]): PortfolioRow[] {
  return matrix.map(row => {
    const overdue = overdueBreakdown(row.financeByCurrency);
    const currencies = Object.values(row.financeByCurrency).filter(item => item.currency !== "N/D");
    const single = currencies.length === 1 ? currencies[0] : null;

    return {
      serviceId: row.serviceId,
      serviceName: row.serviceName,
      clientName: row.clientName,
      dealId: row.dealId,
      serviceTypeKey: row.serviceType,
      stageKey: row.currentStage,
      health: row.health as RecurringHealthKey,
      overdue,
      contractedLabel: currencies.length
        ? currencies.map(item => formatRecurringMoney(item.contracted, item.currency)).join(" + ")
        : "N/D",
      overdueRatio:
        single && single.contracted > 0 ? Math.min(100, Math.round((single.overdue / single.contracted) * 100)) : null,
      signals: row.healthSignals,
      reportsOverdue: row.reports.overdue,
      reportsDue: row.reports.due,
      reportsRate: row.reports.deliveryRate,
      formalizationCoverage: row.formalization.coveragePercent,
      formalizationMissing: row.formalization.missing,
      slaFirstResponse: row.sla.firstResponseCompliance,
      incidentsOpen: row.incidents.open,
      qualityScore: row.quality.score,
      qualityStatus: row.quality.status,
    };
  });
}
