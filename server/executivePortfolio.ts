/**
 * Motor determinista del panel de control ejecutivo.
 *
 * Es una función pura: recibe filas crudas y devuelve la lectura agregada. No
 * toca la base de datos, así que se puede testear sin levantar nada — el mismo
 * patrón que `recurringServicesMetricsEngine.ts`.
 *
 * Reglas:
 * - NUNCA se suman monedas distintas. Todo el dinero se agrega por moneda.
 * - "Facturado" incluye hitos facturados O pagados. "Cobrado", solo pagados.
 * - "Vencido" es un hito pendiente cuya fecha ya pasó el corte.
 * - Los plazos se leen de `getComplianceMetrics().details`, que ya descuenta
 *   feriados, pausas y extensiones. Este motor NO recalcula días hábiles.
 * - Una etapa sin plazo definido no se cuenta como cumplida ni como atrasada:
 *   se cuenta aparte.
 */

export const EXECUTIVE_PORTFOLIO_VERSION = "1.0" as const;

/* ────────────────────────────────────────────────────────────────────────── */
/* Entradas                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

export type ProjectStatus = "activo" | "pausado" | "completado" | "cancelado";
export type StageId = "sow" | "jira" | "risks" | "planning" | "design" | "closure";

export interface ExecutiveProjectSource {
  id: number;
  projectName: string;
  clientName: string;
  dealId: string | null;
  projectType: string | null;
  status: ProjectStatus;
  currentStage: StageId;
  pmId: number | null;
  totalAmount: string | number | null;
  currency: string | null;
  startDate: string | null;
  endDate: string | null;
}

/** Una fila de `getComplianceMetrics().details`. */
export interface ExecutiveComplianceDetail {
  projectId: number;
  projectName: string;
  stageId: string;
  status: "on_time" | "late" | "in_progress" | "not_started";
  daysUsed: number;
  totalAllowed: number;
}

export interface ExecutiveDeadlineSource {
  stageId: string;
  maxBusinessDays: number;
  label: string;
}

export interface ExecutiveExtensionSource {
  projectId: number;
  stageId: string;
  type: "pause" | "resume" | "extend";
  extraDays: number | null;
}

export interface ExecutiveRiskSource {
  projectId: number;
  status: "abierto" | "mitigado" | "cerrado" | null;
  impact: "alto" | "medio" | "bajo" | "por_confirmar";
  probability: "alta" | "media" | "baja" | "por_confirmar";
  mitigation: string | null;
}

export interface ExecutiveMilestoneSource {
  projectId: number;
  amount: string | number | null;
  currency: string | null;
  dueDate: string | null;
  status: "pendiente" | "facturado" | "pagado" | null;
}

export interface ExecutiveLessonSource {
  projectId: number;
  finalScore: number | null;
}

export interface ExecutiveUserSource {
  id: number;
  name: string | null;
}

export interface ExecutivePortfolioInput {
  cutOffDate: string;
  generatedAt: string;
  projects: ExecutiveProjectSource[];
  compliance: ExecutiveComplianceDetail[];
  deadlines: ExecutiveDeadlineSource[];
  extensions: ExecutiveExtensionSource[];
  risks: ExecutiveRiskSource[];
  milestones: ExecutiveMilestoneSource[];
  lessons: ExecutiveLessonSource[];
  users: ExecutiveUserSource[];
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Salidas                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export type AttentionState = "overdue" | "at_risk" | "on_track" | "no_deadline";

export interface AttentionRow {
  projectId: number;
  projectName: string;
  clientName: string;
  dealId: string | null;
  pmName: string | null;
  stageId: string;
  stageLabel: string;
  /** null cuando la etapa en curso no tiene apertura registrada. */
  daysUsed: number | null;
  daysAllowed: number | null;
  /** Positivo = días hábiles de exceso. null si no hay plazo medible. */
  overDays: number | null;
  state: AttentionState;
  highRisksOpen: number;
  amount: number | null;
  currency: string | null;
}

export interface CurrencyFigure {
  currency: string;
  contractedActive: number;
  contractedClosed: number;
  invoiced: number;
  collected: number;
  overdue: number;
  overdueItems: number;
}

export interface StageDistributionRow {
  stageId: string;
  label: string;
  active: number;
  closed: number;
}

export interface BottleneckRow {
  stageId: string;
  label: string;
  allowedDays: number;
  /** Etapas de esta fase ya cerradas en toda la cartera. */
  closedCount: number;
  /** Promedio de días hábiles usados. null si ninguna cerró. */
  avgUsedDays: number | null;
  overCount: number;
  extensionCount: number;
  extraDays: number;
}

export interface ExecutivePortfolio {
  version: typeof EXECUTIVE_PORTFOLIO_VERSION;
  cutOffDate: string;
  generatedAt: string;

  headline: {
    totalProjects: number;
    active: number;
    paused: number;
    closed: number;
    cancelled: number;
    people: number;
    stagesInProgress: number;
    stagesOverdue: number;
    /** Etapas en curso sin apertura o sin plazo: no se pueden medir. */
    stagesUnmeasured: number;
    worstOverDays: number | null;
  };

  money: CurrencyFigure[];

  compliance: {
    onTime: number;
    late: number;
    total: number;
    /** null cuando no hay ninguna etapa cerrada: no se inventa un 0%. */
    ratePercent: number | null;
  };

  risks: {
    highOpen: number;
    projectsWithHighOpen: number;
    withoutMitigation: number;
  };

  attention: AttentionRow[];
  stageDistribution: StageDistributionRow[];

  closed: {
    projects: number;
    onTime: number;
    late: number;
    ratePercent: number | null;
    /** Promedio de exceso sobre las etapas que se pasaron. null si ninguna. */
    avgSlipDays: number | null;
    /** Días hábiles de etapa realmente usados, promedio por proyecto cerrado. */
    avgRealDurationDays: number | null;
    /** Días hábiles asignados, promedio por proyecto cerrado. */
    avgPlannedDurationDays: number | null;
    lessonsRegistered: number;
    lessonsMissing: number;
    avgScore: number | null;
  };

  bottlenecks: BottleneckRow[];
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Motor                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

const STAGE_LABEL_FALLBACK: Record<string, string> = {
  sow: "SoW",
  jira: "Jira",
  risks: "Riesgos",
  planning: "Planificación",
  design: "Avance",
  closure: "Cierre",
};

const STAGE_ORDER: StageId[] = ["sow", "jira", "risks", "planning", "design", "closure"];

/** Umbral a partir del cual una etapa en curso se marca en riesgo. */
const AT_RISK_RATIO = 0.8;

export function buildExecutivePortfolio(input: ExecutivePortfolioInput): ExecutivePortfolio {
  const labelFor = (stageId: string) =>
    input.deadlines.find(deadline => deadline.stageId === stageId)?.label ??
    STAGE_LABEL_FALLBACK[stageId] ??
    stageId;

  const userById = new Map(input.users.map(user => [user.id, user.name]));
  const activeProjects = input.projects.filter(project => project.status === "activo");
  const closedProjects = input.projects.filter(project => project.status === "completado");
  const closedIds = new Set(closedProjects.map(project => project.id));

  /* ── Riesgos altos abiertos, por proyecto ───────────────────────────────── */

  const highOpenRisks = input.risks.filter(risk => risk.status === "abierto" && risk.impact === "alto");
  const highOpenByProject = new Map<number, number>();
  for (const risk of highOpenRisks) {
    highOpenByProject.set(risk.projectId, (highOpenByProject.get(risk.projectId) ?? 0) + 1);
  }

  /* ── Etapas en curso: lo que se atrasa hoy ──────────────────────────────── */

  const inProgress = input.compliance.filter(detail => detail.status === "in_progress");
  const inProgressByProject = new Map<number, ExecutiveComplianceDetail>();
  for (const detail of inProgress) {
    // Un proyecto tiene una sola etapa en curso; si hubiera más, gana la de mayor exceso.
    const current = inProgressByProject.get(detail.projectId);
    if (!current || detail.daysUsed - detail.totalAllowed > current.daysUsed - current.totalAllowed) {
      inProgressByProject.set(detail.projectId, detail);
    }
  }

  const attention: AttentionRow[] = activeProjects.map(project => {
    const detail = inProgressByProject.get(project.id) ?? null;
    const measurable = detail !== null && detail.totalAllowed > 0;
    const overDays = measurable ? detail!.daysUsed - detail!.totalAllowed : null;

    let state: AttentionState = "no_deadline";
    if (measurable) {
      if (overDays! > 0) state = "overdue";
      else if (detail!.daysUsed >= detail!.totalAllowed * AT_RISK_RATIO) state = "at_risk";
      else state = "on_track";
    }

    return {
      projectId: project.id,
      projectName: project.projectName,
      clientName: project.clientName,
      dealId: project.dealId,
      pmName: project.pmId !== null ? (userById.get(project.pmId) ?? null) : null,
      stageId: detail?.stageId ?? project.currentStage,
      stageLabel: labelFor(detail?.stageId ?? project.currentStage),
      daysUsed: detail?.daysUsed ?? null,
      daysAllowed: measurable ? detail!.totalAllowed : null,
      overDays,
      state,
      highRisksOpen: highOpenByProject.get(project.id) ?? 0,
      amount: toNumber(project.totalAmount),
      currency: normalizeCurrency(project.currency),
    };
  });

  // Orden: primero lo vencido por más días, luego lo en riesgo, luego el resto.
  const STATE_WEIGHT: Record<AttentionState, number> = {
    overdue: 0,
    at_risk: 1,
    no_deadline: 2,
    on_track: 3,
  };
  attention.sort(
    (a, b) =>
      STATE_WEIGHT[a.state] - STATE_WEIGHT[b.state] ||
      (b.overDays ?? -Infinity) - (a.overDays ?? -Infinity) ||
      a.projectName.localeCompare(b.projectName, "es"),
  );

  const stagesOverdue = attention.filter(row => row.state === "overdue").length;
  const stagesUnmeasured = attention.filter(row => row.state === "no_deadline").length;
  const overDaysValues = attention
    .map(row => row.overDays)
    .filter((value): value is number => value !== null && value > 0);

  /* ── Dinero, por moneda y nunca agregado entre monedas ──────────────────── */

  const money = new Map<string, CurrencyFigure>();
  const figureFor = (currency: string) => {
    const existing = money.get(currency);
    if (existing) return existing;
    const created: CurrencyFigure = {
      currency,
      contractedActive: 0,
      contractedClosed: 0,
      invoiced: 0,
      collected: 0,
      overdue: 0,
      overdueItems: 0,
    };
    money.set(currency, created);
    return created;
  };

  for (const project of input.projects) {
    const amount = toNumber(project.totalAmount);
    if (amount === null) continue;
    const figure = figureFor(normalizeCurrency(project.currency));
    if (project.status === "activo") figure.contractedActive += amount;
    else if (project.status === "completado") figure.contractedClosed += amount;
  }

  for (const milestone of input.milestones) {
    const amount = toNumber(milestone.amount);
    if (amount === null) continue;
    const figure = figureFor(normalizeCurrency(milestone.currency));
    if (milestone.status === "facturado" || milestone.status === "pagado") figure.invoiced += amount;
    if (milestone.status === "pagado") figure.collected += amount;
    if (milestone.status === "pendiente" && milestone.dueDate && milestone.dueDate < input.cutOffDate) {
      figure.overdue += amount;
      figure.overdueItems += 1;
    }
  }

  /* ── Cumplimiento de plazo en toda la cartera ───────────────────────────── */

  const completedStages = input.compliance.filter(
    detail => detail.status === "on_time" || detail.status === "late",
  );
  const onTime = completedStages.filter(detail => detail.status === "on_time").length;
  const late = completedStages.length - onTime;

  /* ── Distribución por etapa ─────────────────────────────────────────────── */

  const stageDistribution: StageDistributionRow[] = STAGE_ORDER.map(stageId => ({
    stageId,
    label: labelFor(stageId),
    active: activeProjects.filter(project => project.currentStage === stageId).length,
    closed: closedProjects.filter(project => project.currentStage === stageId).length,
  }));

  /* ── Proyectos cerrados: qué aprendimos ─────────────────────────────────── */

  const closedStages = completedStages.filter(detail => closedIds.has(detail.projectId));
  const closedOnTime = closedStages.filter(detail => detail.status === "on_time").length;
  const closedLate = closedStages.length - closedOnTime;
  const slips = closedStages
    .filter(detail => detail.status === "late")
    .map(detail => detail.daysUsed - detail.totalAllowed);

  const usedByProject = new Map<number, number>();
  const allowedByProject = new Map<number, number>();
  for (const detail of closedStages) {
    usedByProject.set(detail.projectId, (usedByProject.get(detail.projectId) ?? 0) + detail.daysUsed);
    allowedByProject.set(detail.projectId, (allowedByProject.get(detail.projectId) ?? 0) + detail.totalAllowed);
  }

  const lessonsByProject = new Set(input.lessons.map(lesson => lesson.projectId));
  const lessonsRegistered = closedProjects.filter(project => lessonsByProject.has(project.id)).length;
  const scores = input.lessons
    .filter(lesson => closedIds.has(lesson.projectId) && lesson.finalScore !== null)
    .map(lesson => lesson.finalScore as number);

  /* ── Cuellos de botella del proceso ─────────────────────────────────────── */

  const bottlenecks: BottleneckRow[] = STAGE_ORDER.map(stageId => {
    const deadline = input.deadlines.find(item => item.stageId === stageId);
    const stageDetails = completedStages.filter(detail => detail.stageId === stageId);
    const stageExtensions = input.extensions.filter(
      extension => extension.stageId === stageId && extension.type === "extend",
    );

    return {
      stageId,
      label: labelFor(stageId),
      allowedDays: deadline?.maxBusinessDays ?? 0,
      closedCount: stageDetails.length,
      avgUsedDays: average(stageDetails.map(detail => detail.daysUsed)),
      overCount: stageDetails.filter(detail => detail.daysUsed > detail.totalAllowed).length,
      extensionCount: stageExtensions.length,
      extraDays: stageExtensions.reduce((sum, extension) => sum + (extension.extraDays ?? 0), 0),
    };
  });

  return {
    version: EXECUTIVE_PORTFOLIO_VERSION,
    cutOffDate: input.cutOffDate,
    generatedAt: input.generatedAt,

    headline: {
      totalProjects: input.projects.length,
      active: activeProjects.length,
      paused: input.projects.filter(project => project.status === "pausado").length,
      closed: closedProjects.length,
      cancelled: input.projects.filter(project => project.status === "cancelado").length,
      people: input.users.length,
      stagesInProgress: attention.filter(row => row.state !== "no_deadline").length,
      stagesOverdue,
      stagesUnmeasured,
      worstOverDays: overDaysValues.length ? Math.max(...overDaysValues) : null,
    },

    money: Array.from(money.values()).sort((a, b) => a.currency.localeCompare(b.currency, "es")),

    compliance: {
      onTime,
      late,
      total: completedStages.length,
      ratePercent: completedStages.length > 0 ? round1((onTime / completedStages.length) * 100) : null,
    },

    risks: {
      highOpen: highOpenRisks.length,
      projectsWithHighOpen: highOpenByProject.size,
      withoutMitigation: highOpenRisks.filter(risk => !risk.mitigation?.trim()).length,
    },

    attention,
    stageDistribution,

    closed: {
      projects: closedProjects.length,
      onTime: closedOnTime,
      late: closedLate,
      ratePercent: closedStages.length > 0 ? round1((closedOnTime / closedStages.length) * 100) : null,
      avgSlipDays: average(slips),
      avgRealDurationDays: average(Array.from(usedByProject.values())),
      avgPlannedDurationDays: average(Array.from(allowedByProject.values())),
      lessonsRegistered,
      lessonsMissing: closedProjects.length - lessonsRegistered,
      avgScore: average(scores),
    },

    bottlenecks,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Utilidades                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCurrency(value: string | null | undefined): string {
  const normalized = value?.trim().toUpperCase();
  return normalized || "N/D";
}

/** null con lista vacía: un promedio de nada no es 0. */
function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return round1(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
