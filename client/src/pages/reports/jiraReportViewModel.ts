/**
 * Filtro, orden y lectura del reporte de avance Jira.
 *
 * LA REGLA: el Portafolio gobierna ciclo de vida, fase Jira, avance Jira
 * reportado, salud, PM, hitos y riesgos. El reporte live sólo agrega tareas,
 * agenda, cobertura y carga; nunca reemplaza evidencia faltante del snapshot.
 */

import type { RouterOutputs } from "@/lib/trpc";

export type JiraReportData = RouterOutputs["jira"]["enrichedConsolidatedReport"];
export type JiraProjectEntry = JiraReportData["projects"][number];

export type ProgressTone = "alert" | "warn" | "good" | "unmeasured";

export const TONE: Record<ProgressTone, { text: string; surface: string; border: string }> = {
  alert: { text: "#B42318", surface: "#FEF3F2", border: "#FDA29B" },
  warn: { text: "#B54708", surface: "#FFFAEB", border: "#FEDF89" },
  good: { text: "#067647", surface: "#ECFDF3", border: "#ABEFC6" },
  unmeasured: { text: "#475569", surface: "#F1F5F9", border: "#CBD5E1" },
};

/* ────────────────────────────────────────────────────────────────────────── */
/* Una fila del reporte                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

export interface ReportRow {
  projectKey: string | null;
  projectName: string;
  clientName: string;
  pmoProjectId: number | null;

  status: JiraProjectEntry["status"];
  stageLabel: string;
  stagesClosed: number;
  totalStages: number;
  operationalPhase: string | null;
  operationalProgressPct: number | null;
  executiveHealth: string | null;
  pmName: string | null;
  jiraEvidenceAvailability: JiraProjectEntry["jiraEvidenceAvailability"];
  jiraEvidenceAt: string | null;

  /** Hitos observados por el mismo snapshot usado en Portafolio. */
  milestonePct: number | null;
  milestonesDone: number | null;
  milestonesTotal: number | null;
  measurable: boolean;

  /** Lectura operacional, separada. */
  taskPct: number | null;
  tasksDone: number | null;
  tasksTotal: number | null;
  /** Puntos de más que las tareas frente a los hitos. null si falta uno. */
  gapPoints: number | null;

  nextMilestoneSummary: string | null;
  /** Positivo = días vencido. Negativo = días que faltan. null sin fecha. */
  nextMilestoneDays: number | null;

  pendingTasks: number;
  overdueTasks: number;
  noDueDateTasks: number;

  risksOpen: number | null;
  highRisksOpen: number | null;
  teamSize: number | null;
  inProgress: number | null;
  stalled: number;

  /** Objetivos declarados sin ninguna tarea planificada. */
  epicsWithoutTasks: number;
  epicsTotal: number;

  tone: ProgressTone;
}

export function buildReportRows(data: JiraReportData): ReportRow[] {
  return data.projects.map(entry => {
      const insights = entry.insights ?? null;
      const measurable = entry.milestonesCount !== null
        && entry.milestonesDone !== null
        && entry.milestonesCount > 0;
      const milestonePct = measurable
        ? Math.round(((entry.milestonesDone as number) / (entry.milestonesCount as number)) * 100)
        : null;

      // Las tareas salen del motor, que ya excluye riesgos, épicas e hitos del
      // denominador. Sin insights se cae al conteo crudo, que los incluye.
      const tasksTotal = insights?.progress.issuesTotal ?? entry.total ?? null;
      const tasksDone = insights?.progress.issuesDone ?? entry.done ?? null;
      const taskPct = tasksTotal !== null && tasksDone !== null && tasksTotal > 0
        ? Math.round((tasksDone / tasksTotal) * 100)
        : null;

      return {
        projectKey: entry.projectKey,
        projectName: entry.pmoProjectName || entry.projectName,
        clientName: entry.clientName,
        pmoProjectId: entry.pmoProjectId ?? null,

        status: entry.status,
        stageLabel: entry.stageLabel,
        stagesClosed: entry.stagesClosed,
        totalStages: entry.totalStages,
        operationalPhase: entry.operationalPhase,
        operationalProgressPct: entry.operationalProgressPct,
        executiveHealth: entry.executiveHealth,
        pmName: entry.pmName,
        jiraEvidenceAvailability: entry.jiraEvidenceAvailability,
        jiraEvidenceAt: entry.jiraEvidenceAt,

        milestonePct,
        milestonesDone: entry.milestonesDone,
        milestonesTotal: entry.milestonesCount,
        measurable,

        taskPct,
        tasksDone,
        tasksTotal,
        gapPoints: milestonePct !== null && taskPct !== null ? taskPct - milestonePct : null,

        nextMilestoneSummary: insights?.nextMilestone?.summary ?? null,
        nextMilestoneDays: insights?.nextMilestone?.days ?? null,

        pendingTasks: insights?.schedule.pendingTotal ?? 0,
        overdueTasks: insights?.schedule.overdue ?? 0,
        noDueDateTasks: insights?.schedule.noDueDate ?? 0,

        risksOpen: entry.risksOpen,
        highRisksOpen: entry.highRisksOpen,
        teamSize: entry.teamSize,
        inProgress: entry.inProgress,
        stalled: insights?.stalled.count ?? 0,

        epicsWithoutTasks: insights?.coverage.epicsWithoutTasks.length ?? 0,
        epicsTotal: insights?.coverage.epicsTotal ?? entry.epicsCount ?? 0,

        tone: toneFor(entry.operationalProgressPct),
      };
    });
}

function toneFor(milestonePct: number | null): ProgressTone {
  if (milestonePct === null) return "unmeasured";
  if (milestonePct >= 70) return "good";
  if (milestonePct >= 40) return "warn";
  return "alert";
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Filtros                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export interface ReportFilters {
  search: string;
  client: string;
  /** all | activo | pausado | completado | cancelado */
  lifecycle: string;
  /** all | measurable | unmeasured | behind (avance Jira < 40%) */
  progress: string;
  /** all | overdue | due_soon | none */
  nextMilestone: string;
  /** all | with_risks | with_stalled | with_uncovered */
  attention: string;
}

export const EMPTY_REPORT_FILTERS: ReportFilters = {
  search: "",
  client: "all",
  lifecycle: "all",
  progress: "all",
  nextMilestone: "all",
  attention: "all",
};

export function countActiveReportFilters(filters: ReportFilters): number {
  return Object.entries(filters).filter(([key, value]) =>
    key === "search" ? value.trim() !== "" : value !== "all",
  ).length;
}

export function filterReportRows(rows: ReportRow[], filters: ReportFilters): ReportRow[] {
  const needle = filters.search.trim().toLowerCase();

  return rows.filter(row => {
    if (needle) {
      const haystack = [
        row.projectName,
        row.clientName,
        row.projectKey ?? "",
        row.operationalPhase ?? "",
        row.executiveHealth ?? "",
        row.pmName ?? "",
        row.status,
      ].join(" ").toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    if (filters.client !== "all" && row.clientName !== filters.client) return false;
    if (filters.lifecycle !== "all" && row.status !== filters.lifecycle) return false;

    if (filters.progress === "measurable" && row.operationalProgressPct === null) return false;
    if (filters.progress === "unmeasured" && row.operationalProgressPct !== null) return false;
    if (filters.progress === "behind" && !(row.operationalProgressPct !== null && row.operationalProgressPct < 40)) return false;

    if (filters.nextMilestone === "overdue" && !(row.nextMilestoneDays !== null && row.nextMilestoneDays > 0)) {
      return false;
    }
    if (
      filters.nextMilestone === "due_soon" &&
      !(row.nextMilestoneDays !== null && row.nextMilestoneDays <= 0 && row.nextMilestoneDays >= -14)
    ) {
      return false;
    }
    if (filters.nextMilestone === "none" && row.nextMilestoneSummary !== null) return false;

    if (filters.attention === "with_risks" && !(row.risksOpen !== null && row.risksOpen > 0)) return false;
    if (filters.attention === "with_stalled" && row.stalled === 0) return false;
    if (filters.attention === "with_uncovered" && row.epicsWithoutTasks === 0) return false;

    return true;
  });
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Orden                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

export type ReportSortKey = "urgency" | "progress" | "name" | "client" | "pending" | "risks";

export interface ReportSort {
  key: ReportSortKey;
  direction: "asc" | "desc";
}

export const DEFAULT_REPORT_SORT: ReportSort = { key: "urgency", direction: "asc" };

export function sortReportRows(rows: ReportRow[], sort: ReportSort): ReportRow[] {
  const factor = sort.direction === "asc" ? 1 : -1;
  const copy = rows.slice();

  copy.sort((a, b) => {
    if (sort.key === "urgency") {
      const lifecycleRank = (status: ReportRow["status"]) =>
        status === "activo" ? 0 : status === "pausado" ? 1 : status === "completado" ? 2 : 3;
      const lifecycleDiff = lifecycleRank(a.status) - lifecycleRank(b.status);
      if (lifecycleDiff !== 0) return lifecycleDiff;
    }

    switch (sort.key) {
      case "urgency": {
        // Primero el hito vencido por más días; luego el avance más bajo.
        const aOverdue = a.nextMilestoneDays !== null && a.nextMilestoneDays > 0 ? a.nextMilestoneDays : -1;
        const bOverdue = b.nextMilestoneDays !== null && b.nextMilestoneDays > 0 ? b.nextMilestoneDays : -1;
        if (aOverdue !== bOverdue) return (bOverdue - aOverdue) * factor;
        return (nullsLast(a.operationalProgressPct, b.operationalProgressPct, -factor) ?? a.projectName.localeCompare(b.projectName, "es"));
      }
      case "progress":
        // Sin avance Jira va al final en las dos direcciones: N/D no es un extremo.
        return nullsLast(a.operationalProgressPct, b.operationalProgressPct, factor) ?? a.projectName.localeCompare(b.projectName, "es");
      case "name":
        return a.projectName.localeCompare(b.projectName, "es") * factor;
      case "client":
        return a.clientName.localeCompare(b.clientName, "es") * factor || a.projectName.localeCompare(b.projectName, "es");
      case "pending":
        return (b.pendingTasks - a.pendingTasks) * factor || a.projectName.localeCompare(b.projectName, "es");
      case "risks":
        return nullsLast(a.risksOpen, b.risksOpen, factor) ?? a.projectName.localeCompare(b.projectName, "es");
      default:
        return 0;
    }
  });

  return copy;
}

function nullsLast(a: number | null, b: number | null, factor: number): number | null {
  if (a === null && b === null) return null;
  if (a === null) return 1;
  if (b === null) return -1;
  const diff = (b - a) * factor;
  return diff === 0 ? null : diff;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Resumen                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export interface ReportSummary {
  count: number;
  total: number;
  active: number;
  paused: number;
  closed: number;
  cancelled: number;
  /** Promedio simple del avance Jira reportado, igual a las filas del Portafolio. */
  operationalProgressPct: number | null;
  milestonePct: number | null;
  milestonesDone: number;
  milestonesTotal: number;
  withoutMilestones: number;
  progressUnavailable: number;
  tasksDone: number;
  tasksTotal: number;
  withOverdueMilestone: number;
  risksOpen: number;
  pendingTasks: number;
  overdueTasks: number;
  stalled: number;
}

export function summarizeReport(filtered: ReportRow[], all: ReportRow[]): ReportSummary {
  const measurable = filtered.filter(row => row.measurable);
  const milestonesTotal = measurable.reduce((sum, row) => sum + (row.milestonesTotal ?? 0), 0);
  const milestonesDone = measurable.reduce((sum, row) => sum + (row.milestonesDone ?? 0), 0);
  const withOperationalProgress = filtered.filter(row => row.operationalProgressPct !== null);
  const withTasks = filtered.filter(row => row.tasksTotal !== null && row.tasksDone !== null);

  return {
    count: filtered.length,
    total: all.length,
    active: filtered.filter(row => row.status === "activo").length,
    paused: filtered.filter(row => row.status === "pausado").length,
    closed: filtered.filter(row => row.status === "completado").length,
    cancelled: filtered.filter(row => row.status === "cancelado").length,
    operationalProgressPct: withOperationalProgress.length > 0
      ? Math.round(withOperationalProgress.reduce((sum, row) => sum + (row.operationalProgressPct ?? 0), 0) / withOperationalProgress.length)
      : null,
    milestonePct: milestonesTotal > 0 ? Math.round((milestonesDone / milestonesTotal) * 100) : null,
    milestonesDone,
    milestonesTotal,
    withoutMilestones: filtered.filter(row => !row.measurable).length,
    progressUnavailable: filtered.filter(row => row.operationalProgressPct === null).length,
    tasksDone: withTasks.reduce((sum, row) => sum + (row.tasksDone ?? 0), 0),
    tasksTotal: withTasks.reduce((sum, row) => sum + (row.tasksTotal ?? 0), 0),
    withOverdueMilestone: filtered.filter(row => row.nextMilestoneDays !== null && row.nextMilestoneDays > 0).length,
    risksOpen: filtered.reduce((sum, row) => sum + (row.risksOpen ?? 0), 0),
    pendingTasks: filtered.reduce((sum, row) => sum + row.pendingTasks, 0),
    overdueTasks: filtered.reduce((sum, row) => sum + row.overdueTasks, 0),
    stalled: filtered.reduce((sum, row) => sum + row.stalled, 0),
  };
}

export function reportClients(rows: ReportRow[]): string[] {
  return Array.from(new Set(rows.map(row => row.clientName).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "es"),
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Formato                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export function progressLabel(value: number | null): string {
  return value === null ? "N/D" : `${value}%`;
}

export function milestoneDaysLabel(days: number | null, hasMilestone: boolean): string {
  if (!hasMilestone) return "ningún hito definido";
  if (days === null) return "sin fecha";
  if (days > 0) return `vencido hace ${days} d`;
  if (days === 0) return "vence hoy";
  return `en ${Math.abs(days)} d`;
}

export function milestoneDaysTone(days: number | null, hasMilestone: boolean): ProgressTone {
  if (!hasMilestone || days === null) return "warn";
  if (days > 0) return "alert";
  if (days >= -14) return "warn";
  return "unmeasured";
}
