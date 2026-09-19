/**
 * Motor de lectura operacional de un proyecto en Jira.
 *
 * Función pura sobre una lista de issues ya traída: no llama a Jira, no toca la
 * base de datos, y por eso se puede testear entera. Mismo patrón que
 * `recurringServicesMetricsEngine.ts` y `executivePortfolio.ts`.
 *
 * LA REGLA DE FONDO: el avance de un proyecto se mide por HITOS CERRADOS.
 * El avance de tareas es una lectura operacional distinta y se muestra al lado,
 * nunca en su lugar. Si un proyecto no tiene hitos definidos, su avance es
 * `null` — N/D — y no se sustituye por el porcentaje de tareas. Un proyecto sin
 * hitos no es un proyecto al 43%: es un proyecto que no se puede medir, y eso
 * es un hallazgo, no un detalle.
 */

export const JIRA_INSIGHTS_VERSION = "1.0" as const;

/** Días sin movimiento a partir de los cuales una tarea en curso se da por estancada. */
export const DEFAULT_STALLED_DAYS = 14;

/** El reporte operacional excluye proyectos cerrados y cancelados. */
export function isOpenJiraReportProjectStatus(status: string | null | undefined): boolean {
  return status !== "completado" && status !== "cancelado";
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Entrada                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export type IssueCategory = "Done" | "In Progress" | "To Do";
export type IssueKind = "epic" | "milestone" | "risk" | "scope_change" | "progress_marker" | "task";

/** Forma mínima de un issue. Desacopla el motor del cliente de Jira. */
export interface InsightIssue {
  key: string;
  summary: string;
  kind: IssueKind;
  status: string;
  category: IssueCategory;
  assignee: string | null;
  dueDate: string | null;
  updated: string | null;
  /** Clave del padre (épica o hito) cuando existe. */
  parentKey: string | null;
}

export interface JiraInsightsInput {
  /** Fecha de corte, YYYY-MM-DD. */
  today: string;
  issues: InsightIssue[];
  stalledAfterDays?: number;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Salida                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

export type MilestoneState = "done" | "overdue" | "due_soon" | "scheduled" | "no_date";

export interface MilestoneRow {
  key: string;
  summary: string;
  status: string;
  state: MilestoneState;
  dueDate: string | null;
  /** Positivo = días de atraso. Negativo = días que faltan. null sin fecha. */
  days: number | null;
  tasksTotal: number;
  tasksDone: number;
  /** null cuando el hito no tiene ninguna tarea colgando. */
  taskPct: number | null;
}

export interface EpicRow {
  key: string;
  summary: string;
  status: string;
  category: IssueCategory;
  tasksTotal: number;
  tasksDone: number;
  /** null cuando la épica no tiene tareas: no es 0% de avance, es 0 trabajo planificado. */
  taskPct: number | null;
}

export interface WorkloadRow {
  assignee: string;
  total: number;
  done: number;
  inProgress: number;
  toDo: number;
  overdue: number;
  stalled: number;
}

export interface StalledRow {
  key: string;
  summary: string;
  assignee: string | null;
  status: string;
  daysIdle: number;
}

export interface JiraProgressInsights {
  version: typeof JIRA_INSIGHTS_VERSION;
  today: string;

  /** El avance, con su criterio explícito. */
  progress: {
    /** "milestones" o "none" — nunca se cae a tareas en silencio. */
    measuredBy: "milestones" | "none";
    milestonesTotal: number;
    milestonesDone: number;
    /** null cuando no hay hitos definidos. */
    milestonePct: number | null;
    issuesTotal: number;
    issuesDone: number;
    /** null cuando no hay tareas. */
    issuePct: number | null;
    /**
     * Puntos de diferencia entre el avance de tareas y el de hitos.
     * Positivo = hay más movimiento que entrega. null si falta alguno.
     */
    gapPoints: number | null;
  };

  milestones: MilestoneRow[];
  nextMilestone: MilestoneRow | null;

  /** Qué hay programado por ejecutar, y para cuándo. */
  schedule: {
    pendingTotal: number;
    overdue: number;
    next7: number;
    next14: number;
    next30: number;
    later: number;
    /** Tareas pendientes sin fecha: no se pueden programar ni vencer. */
    noDueDate: number;
  };

  /** ¿Lo programado cubre los objetivos declarados del proyecto? */
  coverage: {
    epicsTotal: number;
    /** Objetivos declarados sin ninguna tarea planificada. */
    epicsWithoutTasks: Array<{ key: string; summary: string }>;
    /** Trabajo que no responde a ninguna épica ni hito. */
    tasksWithoutParent: number;
    milestonesWithoutTasks: Array<{ key: string; summary: string }>;
    milestonesWithoutDueDate: number;
    /** % de épicas con al menos una tarea. null si no hay épicas. */
    epicCoveragePct: number | null;
  };

  epics: EpicRow[];

  /** Flujo, no solo conteo. */
  flow: {
    byStatus: Array<{ status: string; count: number; pct: number; category: IssueCategory }>;
    /** Tareas tocadas en los últimos 7 días. */
    movedLast7: number;
    movedLast30: number;
  };

  stalled: {
    afterDays: number;
    count: number;
    items: StalledRow[];
  };

  workload: WorkloadRow[];
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Motor                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

export function buildJiraProgressInsights(input: JiraInsightsInput): JiraProgressInsights {
  const stalledAfterDays = input.stalledAfterDays ?? DEFAULT_STALLED_DAYS;

  const milestonesRaw = input.issues.filter(issue => issue.kind === "milestone");
  const epicsRaw = input.issues.filter(issue => issue.kind === "epic");
  const tasks = input.issues.filter(issue => issue.kind === "task");

  /* ── Hijos por padre ────────────────────────────────────────────────────── */

  const childrenByParent = new Map<string, InsightIssue[]>();
  for (const task of tasks) {
    if (!task.parentKey) continue;
    const bucket = childrenByParent.get(task.parentKey) ?? [];
    bucket.push(task);
    childrenByParent.set(task.parentKey, bucket);
  }

  /* ── Hitos: la columna vertebral ────────────────────────────────────────── */

  const milestones: MilestoneRow[] = milestonesRaw
    .map(milestone => {
      const children = childrenByParent.get(milestone.key) ?? [];
      const tasksDone = children.filter(child => child.category === "Done").length;
      const days = milestone.dueDate ? daysBetween(milestone.dueDate, input.today) : null;

      let state: MilestoneState;
      if (milestone.category === "Done") state = "done";
      else if (days === null) state = "no_date";
      else if (days > 0) state = "overdue";
      else if (days >= -7) state = "due_soon";
      else state = "scheduled";

      return {
        key: milestone.key,
        summary: milestone.summary,
        status: milestone.status,
        state,
        dueDate: milestone.dueDate,
        days,
        tasksTotal: children.length,
        tasksDone,
        taskPct: children.length > 0 ? pct(tasksDone, children.length) : null,
      };
    })
    .sort(byMilestoneOrder);

  const milestonesDone = milestones.filter(row => row.state === "done").length;
  const hasMilestones = milestones.length > 0;

  // El próximo hito es el primero no cerrado: vencido si lo hay, si no el más cercano.
  const pending = milestones.filter(row => row.state !== "done");
  const nextMilestone =
    pending.find(row => row.state === "overdue") ??
    pending.find(row => row.days !== null) ??
    pending[0] ??
    null;

  /* ── Avance de tareas, como lectura paralela ────────────────────────────── */

  const issuesDone = tasks.filter(task => task.category === "Done").length;
  const issuePct = tasks.length > 0 ? pct(issuesDone, tasks.length) : null;
  const milestonePct = hasMilestones ? pct(milestonesDone, milestones.length) : null;

  /* ── Agenda: qué hay por ejecutar y para cuándo ─────────────────────────── */

  const pendingTasks = tasks.filter(task => task.category !== "Done");
  const schedule = {
    pendingTotal: pendingTasks.length,
    overdue: 0,
    next7: 0,
    next14: 0,
    next30: 0,
    later: 0,
    noDueDate: 0,
  };

  for (const task of pendingTasks) {
    if (!task.dueDate) {
      schedule.noDueDate += 1;
      continue;
    }
    const days = daysBetween(task.dueDate, input.today);
    if (days > 0) schedule.overdue += 1;
    else if (days >= -7) schedule.next7 += 1;
    else if (days >= -14) schedule.next14 += 1;
    else if (days >= -30) schedule.next30 += 1;
    else schedule.later += 1;
  }

  /* ── Épicas y cobertura de objetivos ────────────────────────────────────── */

  const epics: EpicRow[] = epicsRaw
    .map(epic => {
      const children = childrenByParent.get(epic.key) ?? [];
      const tasksDone = children.filter(child => child.category === "Done").length;
      return {
        key: epic.key,
        summary: epic.summary,
        status: epic.status,
        category: epic.category,
        tasksTotal: children.length,
        tasksDone,
        taskPct: children.length > 0 ? pct(tasksDone, children.length) : null,
      };
    })
    .sort((a, b) => (a.taskPct ?? -1) - (b.taskPct ?? -1) || a.key.localeCompare(b.key));

  const epicsWithoutTasks = epics
    .filter(epic => epic.tasksTotal === 0)
    .map(epic => ({ key: epic.key, summary: epic.summary }));

  const parentKeys = new Set([...milestonesRaw, ...epicsRaw].map(issue => issue.key));
  const tasksWithoutParent = tasks.filter(
    task => !task.parentKey || !parentKeys.has(task.parentKey),
  ).length;

  const milestonesWithoutTasks = milestones
    .filter(row => row.tasksTotal === 0 && row.state !== "done")
    .map(row => ({ key: row.key, summary: row.summary }));

  /* ── Flujo por estado ───────────────────────────────────────────────────── */

  const statusMap = new Map<string, { count: number; category: IssueCategory }>();
  for (const task of tasks) {
    const entry = statusMap.get(task.status) ?? { count: 0, category: task.category };
    entry.count += 1;
    statusMap.set(task.status, entry);
  }

  const byStatus = Array.from(statusMap.entries())
    .map(([status, entry]) => ({
      status,
      count: entry.count,
      pct: tasks.length > 0 ? pct(entry.count, tasks.length) : 0,
      category: entry.category,
    }))
    .sort((a, b) => b.count - a.count);

  const movedLast7 = tasks.filter(task => idleDays(task.updated, input.today, 7)).length;
  const movedLast30 = tasks.filter(task => idleDays(task.updated, input.today, 30)).length;

  /* ── Estancadas ─────────────────────────────────────────────────────────── */

  const stalledItems: StalledRow[] = tasks
    .filter(task => task.category === "In Progress" && task.updated !== null)
    .map(task => ({
      key: task.key,
      summary: task.summary,
      assignee: task.assignee,
      status: task.status,
      daysIdle: daysBetween(task.updated as string, input.today),
    }))
    .filter(row => row.daysIdle >= stalledAfterDays)
    .sort((a, b) => b.daysIdle - a.daysIdle);

  const stalledKeys = new Set(stalledItems.map(item => item.key));

  /* ── Carga por persona ──────────────────────────────────────────────────── */

  const workloadMap = new Map<string, WorkloadRow>();
  for (const task of tasks) {
    const assignee = task.assignee ?? "Sin asignar";
    const row =
      workloadMap.get(assignee) ??
      { assignee, total: 0, done: 0, inProgress: 0, toDo: 0, overdue: 0, stalled: 0 };

    row.total += 1;
    if (task.category === "Done") row.done += 1;
    else if (task.category === "In Progress") row.inProgress += 1;
    else row.toDo += 1;

    if (task.category !== "Done" && task.dueDate && daysBetween(task.dueDate, input.today) > 0) {
      row.overdue += 1;
    }
    if (stalledKeys.has(task.key)) row.stalled += 1;

    workloadMap.set(assignee, row);
  }

  const workload = Array.from(workloadMap.values()).sort(
    (a, b) => b.inProgress - a.inProgress || b.total - a.total || a.assignee.localeCompare(b.assignee, "es"),
  );

  return {
    version: JIRA_INSIGHTS_VERSION,
    today: input.today,

    progress: {
      measuredBy: hasMilestones ? "milestones" : "none",
      milestonesTotal: milestones.length,
      milestonesDone,
      milestonePct,
      issuesTotal: tasks.length,
      issuesDone,
      issuePct,
      gapPoints: milestonePct !== null && issuePct !== null ? issuePct - milestonePct : null,
    },

    milestones,
    nextMilestone,
    schedule,

    coverage: {
      epicsTotal: epics.length,
      epicsWithoutTasks,
      tasksWithoutParent,
      milestonesWithoutTasks,
      milestonesWithoutDueDate: milestones.filter(row => row.dueDate === null).length,
      epicCoveragePct:
        epics.length > 0 ? pct(epics.length - epicsWithoutTasks.length, epics.length) : null,
    },

    epics,
    flow: { byStatus, movedLast7, movedLast30 },
    stalled: { afterDays: stalledAfterDays, count: stalledItems.length, items: stalledItems },
    workload,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Utilidades                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

/** Orden de lectura: lo vencido primero, lo cerrado al final. */
const MILESTONE_WEIGHT: Record<MilestoneState, number> = {
  overdue: 0,
  due_soon: 1,
  scheduled: 2,
  no_date: 3,
  done: 4,
};

function byMilestoneOrder(a: MilestoneRow, b: MilestoneRow): number {
  return (
    MILESTONE_WEIGHT[a.state] - MILESTONE_WEIGHT[b.state] ||
    (b.days ?? -Infinity) - (a.days ?? -Infinity) ||
    a.key.localeCompare(b.key)
  );
}

/** Días transcurridos desde `date` hasta `today`. Positivo = ya pasó. */
export function daysBetween(date: string, today: string): number {
  const from = Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
  const to = Date.parse(`${today.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / 86_400_000);
}

function idleDays(updated: string | null, today: string, withinDays: number): boolean {
  if (!updated) return false;
  return daysBetween(updated, today) <= withinDays;
}

function pct(part: number, total: number): number {
  return Math.round((part / total) * 100);
}
