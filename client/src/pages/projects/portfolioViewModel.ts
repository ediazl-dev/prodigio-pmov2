/**
 * Filtro, orden y resumen del portafolio de proyectos.
 *
 * Lógica pura y testeada: la tabla solo pinta lo que este archivo decide. El
 * cálculo de las cifras por proyecto vive en el servidor
 * (`server/executivePortfolio.ts`); aquí se decide qué se muestra y en qué orden.
 *
 * Reglas:
 * - Un monto ausente NO es cero. `amountMissing` se respeta en el orden (va al
 *   final, nunca arriba como si valiera 0) y se muestra como vacío explícito.
 * - Nunca se suman monedas distintas: el resumen es una lista por moneda.
 */

import type { RouterOutputs } from "@/lib/trpc";

export type PortfolioRow = RouterOutputs["projects"]["executive"]["portfolio"][number];
export type DeadlineState = PortfolioRow["deadlineState"];
export type ProjectStatus = PortfolioRow["status"];

/* ────────────────────────────────────────────────────────────────────────── */
/* Etiquetas y tonos                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  activo: "Activo",
  pausado: "Pausado",
  completado: "Completado",
  cancelado: "Cancelado",
};

export const STATUS_TONE: Record<ProjectStatus, { text: string; surface: string; border: string }> = {
  activo: { text: "#067647", surface: "#ECFDF3", border: "#ABEFC6" },
  pausado: { text: "#B54708", surface: "#FFFAEB", border: "#FEDF89" },
  completado: { text: "#175CD3", surface: "#EFF6FF", border: "#B2DDFF" },
  cancelado: { text: "#B42318", surface: "#FEF3F2", border: "#FDA29B" },
};

export const DEADLINE_LABEL: Record<DeadlineState, string> = {
  overdue: "Vencida",
  at_risk: "En riesgo",
  on_track: "Al día",
  no_deadline: "Sin apertura PMO",
  not_applicable: "—",
};

export const DEADLINE_TONE: Record<DeadlineState, { text: string; surface: string; border: string }> = {
  overdue: { text: "#B42318", surface: "#FEF3F2", border: "#FDA29B" },
  at_risk: { text: "#B54708", surface: "#FFFAEB", border: "#FEDF89" },
  on_track: { text: "#067647", surface: "#ECFDF3", border: "#ABEFC6" },
  no_deadline: { text: "#475569", surface: "#F1F5F9", border: "#CBD5E1" },
  not_applicable: { text: "#64748B", surface: "#FFFFFF", border: "#E2E8F0" },
};

export const PROJECT_TYPE_LABEL: Record<string, string> = {
  apigee: "Apigee",
  desarrollo: "Desarrollo",
  integracion: "Integración",
  data: "Data",
  otro: "Otro",
};

/* ────────────────────────────────────────────────────────────────────────── */
/* Filtros                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export interface PortfolioFilters {
  search: string;
  status: string;
  client: string;
  projectType: string;
  stage: string;
  /** "all" | "unassigned" | id del PM como string */
  pm: string;
  health: string;
}

export const EMPTY_FILTERS: PortfolioFilters = {
  search: "",
  status: "all",
  client: "all",
  projectType: "all",
  stage: "all",
  pm: "all",
  health: "all",
};

export function countActiveFilters(filters: PortfolioFilters): number {
  return Object.entries(filters).filter(([key, value]) =>
    key === "search" ? value.trim() !== "" : value !== "all",
  ).length;
}

export function filterPortfolio(rows: PortfolioRow[], filters: PortfolioFilters): PortfolioRow[] {
  const needle = filters.search.trim().toLowerCase();

  return rows.filter(row => {
    if (needle) {
      const haystack = [
        row.projectName,
        row.clientName,
        row.dealId ?? "",
        row.pmName ?? "",
        row.operationalPhase ?? "",
        row.executiveHealth ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    if (filters.status !== "all" && row.status !== filters.status) return false;
    if (filters.client !== "all" && row.clientName !== filters.client) return false;
    if (filters.projectType !== "all" && (row.projectType ?? "otro") !== filters.projectType) return false;
    if (filters.stage !== "all" && row.stageId !== filters.stage) return false;
    if (filters.health !== "all" && row.deadlineState !== filters.health) return false;

    if (filters.pm !== "all") {
      if (filters.pm === "unassigned") {
        if (row.pmKey !== null) return false;
      } else if (row.pmKey !== filters.pm) {
        return false;
      }
    }

    return true;
  });
}

export interface FilterOptions {
  clients: string[];
  projectTypes: string[];
  stages: Array<{ id: string; label: string }>;
  pms: Array<{ id: string; name: string }>;
  /** Cuántos proyectos no tienen PM asignado; 0 oculta la opción. */
  unassignedCount: number;
}

export function buildFilterOptions(rows: PortfolioRow[]): FilterOptions {
  const stages = new Map<string, string>();
  const pms = new Map<string, string>();

  for (const row of rows) {
    stages.set(row.stageId, row.stageLabel);
    if (row.pmKey !== null) pms.set(row.pmKey, row.pmName ?? row.pmKey);
  }

  return {
    clients: unique(rows.map(row => row.clientName)),
    projectTypes: unique(rows.map(row => row.projectType ?? "otro")),
    stages: Array.from(stages.entries()).map(([id, label]) => ({ id, label })),
    pms: Array.from(pms.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "es")),
    unassignedCount: rows.filter(row => row.pmKey === null).length,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Orden                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

export type SortKey = "urgency" | "name" | "client" | "stage" | "plazo" | "amount" | "risks";
export type SortDirection = "asc" | "desc";

export interface SortState {
  key: SortKey;
  direction: SortDirection;
}

export const DEFAULT_SORT: SortState = { key: "urgency", direction: "asc" };

/** Peso de urgencia: lo vencido primero, lo ya cerrado al final. */
const URGENCY_WEIGHT: Record<DeadlineState, number> = {
  overdue: 0,
  at_risk: 1,
  no_deadline: 2,
  on_track: 3,
  not_applicable: 4,
};

export function sortPortfolio(rows: PortfolioRow[], sort: SortState): PortfolioRow[] {
  const factor = sort.direction === "asc" ? 1 : -1;
  const copy = rows.slice();

  copy.sort((a, b) => {
    switch (sort.key) {
      case "urgency":
        return (
          (URGENCY_WEIGHT[a.deadlineState] - URGENCY_WEIGHT[b.deadlineState]) * factor ||
          ((b.overDays ?? -Infinity) - (a.overDays ?? -Infinity)) * factor ||
          a.projectName.localeCompare(b.projectName, "es")
        );
      case "name":
        return a.projectName.localeCompare(b.projectName, "es") * factor;
      case "client":
        return (
          a.clientName.localeCompare(b.clientName, "es") * factor ||
          a.projectName.localeCompare(b.projectName, "es")
        );
      case "stage":
        return (a.stageIndex - b.stageIndex) * factor || a.projectName.localeCompare(b.projectName, "es");
      case "plazo":
        // Sin plazo medible va siempre al final, en cualquier dirección.
        return (
          nullsLast(a.overDays, b.overDays, factor) ?? a.projectName.localeCompare(b.projectName, "es")
        );
      case "amount":
        // Un monto ausente no es cero: va al final, nunca arriba.
        return nullsLast(a.amount, b.amount, factor) ?? a.projectName.localeCompare(b.projectName, "es");
      case "risks":
        return nullsLast(a.highRisksOpen, b.highRisksOpen, factor) ?? a.projectName.localeCompare(b.projectName, "es");
      default:
        return 0;
    }
  });

  return copy;
}

/** Compara dos números que pueden faltar, dejando los ausentes al final. */
function nullsLast(a: number | null, b: number | null, factor: number): number | null {
  if (a === null && b === null) return null;
  if (a === null) return 1;
  if (b === null) return -1;
  const diff = (a - b) * factor;
  return diff === 0 ? null : diff;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Resumen del universo filtrado                                              */
/* ────────────────────────────────────────────────────────────────────────── */

export interface PortfolioSummary {
  count: number;
  total: number;
  active: number;
  closed: number;
  overdue: number;
  highRisks: number;
  /** Proyectos sin monto contratado cargado. Es un vacío que hay que mostrar. */
  withoutAmount: number;
  /** Una entrada por moneda. Nunca se suman entre sí. */
  amountByCurrency: Array<{ currency: string; value: number }>;
}

export function summarizePortfolio(filtered: PortfolioRow[], all: PortfolioRow[]): PortfolioSummary {
  const byCurrency = new Map<string, number>();
  for (const row of filtered) {
    if (row.amount === null || row.currency === null) continue;
    byCurrency.set(row.currency, (byCurrency.get(row.currency) ?? 0) + row.amount);
  }

  return {
    count: filtered.length,
    total: all.length,
    active: filtered.filter(row => row.status === "activo").length,
    closed: filtered.filter(row => row.status === "completado").length,
    overdue: filtered.filter(row => row.deadlineState === "overdue").length,
    highRisks: filtered.reduce((sum, row) => sum + (row.highRisksOpen ?? 0), 0),
    withoutAmount: filtered.filter(row => row.amountMissing).length,
    amountByCurrency: Array.from(byCurrency.entries())
      .map(([currency, value]) => ({ currency, value }))
      .sort((a, b) => a.currency.localeCompare(b.currency, "es")),
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Formato                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export function money(value: number, currency: string): string {
  return `${currency} ${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(value)}`;
}

export function moneyList(entries: Array<{ currency: string; value: number }>): string {
  if (entries.length === 0) return "Sin monto cargado";
  return entries.map(entry => money(entry.value, entry.currency)).join(" + ");
}

export function deadlineSummary(row: PortfolioRow): string {
  if (row.deadlineState === "not_applicable") return "—";
  if (row.daysUsed === null || row.daysAllowed === null) return "Sin apertura PMO";
  const over = row.overDays ?? 0;
  if (over > 0) return `+${over} d de exceso`;
  return `quedan ${Math.abs(over)} d`;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "es"));
}
