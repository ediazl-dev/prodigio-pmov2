/**
 * View model del detalle de un servicio recurrente.
 *
 * Reglas heredadas del contrato de métricas 2.0, replicadas aquí porque el
 * plan de cobro se pinta desde `getById` y no desde el motor:
 *   - "Facturado" = cuotas en estado facturado O pagado.
 *   - "Cobrado"   = solo cuotas pagadas.
 *   - "Vencido"   = cuota pendiente cuya fecha de vencimiento ya pasó el corte.
 *   - Nunca se suman monedas distintas.
 *   - Una cuota sin fecha de vencimiento NO puede estar vencida: se marca
 *     aparte en vez de contarla como al día.
 */

import type { RouterOutputs } from "@/lib/trpc";
import type { ActionQueueItem } from "./recurringDashboardV3ViewModel";

export type ServiceByIdOutput = RouterOutputs["recurringServices"]["getById"];
export type BillingMonth = ServiceByIdOutput["billingMonths"][number];
export type ServiceStage = ServiceByIdOutput["stages"][number];
export type ServiceDocument = ServiceByIdOutput["documents"][number];

/* ────────────────────────────────────────────────────────────────────────── */
/* Plan de cobro, con la plata que hoy no se ve                               */
/* ────────────────────────────────────────────────────────────────────────── */

export type BillingRowState =
  | "cobrada"
  | "facturada"
  | "vencida"
  | "por_vencer"
  | "programada"
  | "sin_fecha";

export interface BillingRow {
  id: number;
  monthNumber: number;
  dueDate: string | null;
  dueLabel: string;
  amount: number;
  currency: string;
  amountLabel: string;
  state: BillingRowState;
  stateLabel: string;
  missingDueDate: boolean;
  daysOverdue: number | null;
  note: string;
  actionLabel: string | null;
  jiraIssueKey: string | null;
}

export interface BillingCurrencyTotals {
  currency: string;
  contracted: number;
  invoiced: number;
  collected: number;
  overdue: number;
  overdueItems: number;
  contractedLabel: string;
  invoicedLabel: string;
  collectedLabel: string;
  overdueLabel: string;
}

export interface BillingPlan {
  rows: BillingRow[];
  totals: BillingCurrencyTotals[];
  /** Cuotas sin fecha de vencimiento: no pueden vencer, y eso hay que decirlo. */
  missingDueDates: number;
  /** El plan no suma lo contratado. Es el mismo hallazgo que CONTRACT_BILLING_PLAN_MISMATCH. */
  planMismatch: { expectedLabel: string; plannedLabel: string } | null;
  hasRows: boolean;
}

const STATE_LABEL: Record<BillingRowState, string> = {
  cobrada: "Cobrada",
  facturada: "Facturada",
  vencida: "Vencida",
  por_vencer: "Por vencer",
  programada: "Programada",
  sin_fecha: "Sin fecha",
};

export function buildBillingPlan(
  billingMonths: BillingMonth[],
  cutOffDate: string,
  contractTotal: { amount: number; currency: string } | null,
): BillingPlan {
  const rows: BillingRow[] = billingMonths
    .slice()
    .sort((a, b) => a.monthNumber - b.monthNumber)
    .map(month => {
      const amount = Number(month.amount ?? 0);
      const currency = (month.currency ?? "N/D").toUpperCase();
      const amountLabel = formatMoney(amount, currency);
      const missingDueDate = !month.dueDate;
      const days = month.dueDate ? daysBetween(month.dueDate, cutOffDate) : null;

      let state: BillingRowState;
      if (month.status === "pagado") state = "cobrada";
      else if (month.status === "facturado") state = "facturada";
      else if (!month.dueDate) state = "sin_fecha";
      else if (days !== null && days > 0) state = "vencida";
      else if (days !== null && days > -15) state = "por_vencer";
      else state = "programada";

      return {
        id: month.id,
        monthNumber: month.monthNumber,
        dueDate: month.dueDate ?? null,
        dueLabel: formatDate(month.dueDate),
        amount,
        currency,
        amountLabel,
        state,
        stateLabel: STATE_LABEL[state],
        missingDueDate,
        daysOverdue: state === "vencida" ? days : null,
        note: noteFor(state, days, missingDueDate),
        actionLabel: actionFor(state),
        jiraIssueKey: month.jiraIssueKey ?? null,
      };
    });

  // Totales por moneda. Nunca se agrega entre monedas distintas.
  const byCurrency = new Map<string, BillingCurrencyTotals>();
  for (const row of rows) {
    const entry =
      byCurrency.get(row.currency) ??
      {
        currency: row.currency,
        contracted: 0,
        invoiced: 0,
        collected: 0,
        overdue: 0,
        overdueItems: 0,
        contractedLabel: "",
        invoicedLabel: "",
        collectedLabel: "",
        overdueLabel: "",
      };

    entry.contracted += row.amount;
    if (row.state === "facturada" || row.state === "cobrada") entry.invoiced += row.amount;
    if (row.state === "cobrada") entry.collected += row.amount;
    if (row.state === "vencida") {
      entry.overdue += row.amount;
      entry.overdueItems += 1;
    }
    byCurrency.set(row.currency, entry);
  }

  const totals = Array.from(byCurrency.values())
    .map(entry => ({
      ...entry,
      contractedLabel: formatMoney(entry.contracted, entry.currency),
      invoicedLabel: formatMoney(entry.invoiced, entry.currency),
      collectedLabel: formatMoney(entry.collected, entry.currency),
      overdueLabel: formatMoney(entry.overdue, entry.currency),
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency, "es"));

  // El descuadre solo se puede afirmar con una moneda: comparar un contrato en
  // USD contra un plan en dos monedas no significa nada.
  let planMismatch: BillingPlan["planMismatch"] = null;
  if (contractTotal && totals.length === 1 && totals[0].currency === contractTotal.currency.toUpperCase()) {
    if (Math.abs(totals[0].contracted - contractTotal.amount) > 0.01) {
      planMismatch = {
        expectedLabel: formatMoney(contractTotal.amount, contractTotal.currency.toUpperCase()),
        plannedLabel: totals[0].contractedLabel,
      };
    }
  }

  return {
    rows,
    totals,
    missingDueDates: rows.filter(row => row.missingDueDate).length,
    planMismatch,
    hasRows: rows.length > 0,
  };
}

function noteFor(state: BillingRowState, days: number | null, missingDueDate: boolean): string {
  let note: string;
  switch (state) {
    case "vencida":
      note = days === null
        ? "Pendiente después de su vencimiento"
        : `Pendiente ${days} día${days === 1 ? "" : "s"} después del vencimiento`;
      break;
    case "por_vencer":
      note = days === null ? "Próxima a vencer" : `Vence en ${Math.abs(days)} día${Math.abs(days) === 1 ? "" : "s"}`;
      break;
    case "sin_fecha":
      note = "Sin fecha de vencimiento: nunca se contará como vencida";
      break;
    case "facturada":
      note = "Facturada, pendiente de cobro";
      break;
    case "cobrada":
      note = "Cobrada";
      break;
    default:
      note = "Sin acción requerida todavía";
  }
  return missingDueDate && state !== "sin_fecha" ? `${note} · fecha de vencimiento pendiente` : note;
}

function actionFor(state: BillingRowState): string | null {
  if (["vencida", "por_vencer", "facturada", "sin_fecha"].includes(state)) return "Revisar cuota";
  return null;
}

export function resolveServiceSignalStage(item: Pick<ActionQueueItem, "domain">): string {
  if (item.domain === "formalidad") return "init";
  if (item.domain === "operacion") return "jsm-setup";
  return "execution";
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Pipeline de etapas                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

export const SERVICE_STAGES = [
  { id: "inicializacion", label: "Inicialización", sublabel: "Contrato y documentos", path: "init" },
  { id: "plan_trabajo", label: "Plan de trabajo", sublabel: "SLAs y actividades", path: "work-plan" },
  { id: "jira_setup", label: "JSM Setup", sublabel: "Plataforma de gestión", path: "jsm-setup" },
  { id: "ejecucion", label: "Ejecución", sublabel: "Dashboard operativo", path: "execution" },
  { id: "cierre", label: "Cierre", sublabel: "Cierre del contrato", path: "closure" },
] as const;

export type StageState = "done" | "active" | "locked";

export interface PipelineStage {
  id: string;
  label: string;
  sublabel: string;
  path: string;
  state: StageState;
  note: string;
  /** Solo las etapas cerradas o en curso son navegables. */
  navigable: boolean;
}

export interface StagePipeline {
  stages: PipelineStage[];
  activeIndex: number;
  activeStage: PipelineStage | null;
  progressLabel: string;
}

export function buildStagePipeline(stages: ServiceStage[]): StagePipeline {
  const byId = new Map(stages.map(stage => [stage.stageId, stage]));

  const built: PipelineStage[] = SERVICE_STAGES.map(definition => {
    const stage = byId.get(definition.id);
    const status = stage?.status ?? "locked";
    const state: StageState = status === "completed" ? "done" : status === "in_progress" ? "active" : "locked";
    return {
      id: definition.id,
      label: definition.label,
      sublabel: definition.sublabel,
      path: definition.path,
      state,
      note:
        state === "done"
          ? stage?.completedAt
            ? `Cerrada ${formatDate(String(stage.completedAt))}`
            : "Completada"
          : state === "active"
            ? "En curso"
            : definition.sublabel,
      navigable: state !== "locked",
    };
  });

  const activeIndex = built.findIndex(stage => stage.state === "active");

  return {
    stages: built,
    activeIndex,
    activeStage: activeIndex >= 0 ? built[activeIndex] : null,
    progressLabel:
      activeIndex >= 0
        ? `Etapa ${activeIndex + 1} de ${built.length} en curso`
        : built.every(stage => stage.state === "done")
          ? "Todas las etapas completadas"
          : "Ninguna etapa en curso",
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Documentos                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

const DOC_TYPE_LABEL: Record<string, string> = {
  contrato: "Contrato",
  sow: "SoW",
  propuesta_tecnica: "Propuesta técnica",
  pl: "P&L",
  otro: "Otro",
};

/** Contrato y SoW son los dos exigibles del motor de métricas. */
const REQUIRED_DOC_TYPES = ["contrato", "sow"];

export interface DocumentRow {
  id: number;
  docType: string;
  fileName: string;
  fileUrl: string;
  typeLabel: string;
  required: boolean;
}

export function buildDocumentRows(documents: ServiceDocument[]): DocumentRow[] {
  return documents
    .map(document => ({
      id: document.id,
      docType: document.docType,
      fileName: document.fileName,
      fileUrl: document.fileUrl,
      typeLabel: DOC_TYPE_LABEL[document.docType] ?? document.docType,
      required: REQUIRED_DOC_TYPES.includes(document.docType),
    }))
    .sort((a, b) => Number(b.required) - Number(a.required) || a.typeLabel.localeCompare(b.typeLabel, "es"));
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Utilidades                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export function formatMoney(value: number, currency: string): string {
  return `${currency} ${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(value)}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "N/D";
  const parsed = new Date(String(value).length === 10 ? `${value}T12:00:00` : String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString("es-CL");
}

/** Días transcurridos desde `dueDate` hasta `cutOffDate`. Positivo = vencido. */
export function daysBetween(dueDate: string, cutOffDate: string): number {
  const due = Date.parse(`${dueDate.slice(0, 10)}T00:00:00Z`);
  const cut = Date.parse(`${cutOffDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(due) || Number.isNaN(cut)) return 0;
  return Math.round((cut - due) / 86_400_000);
}
