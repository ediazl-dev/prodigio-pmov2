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
  jiraProjectKey?: string | null;
  /** Distingue proyectos creados en PMO de proyectos vinculados desde Jira. */
  origin?: string | null;
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
  confirmed: boolean;
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

export interface ExecutiveFinancialSource {
  dealId: string;
  projectName: string | null;
  clientName: string | null;
  pm: string | null;
  estadoProyecto: string | null;
  valorVentaUF: string | number | null;
  syncedAt: Date | string | null;
}

export interface ExecutiveJiraSnapshotSource {
  projectId: number;
  jiraProjectKey: string;
  status: "success" | "partial" | "error";
  operationalPhase: string | null;
  executiveStatus: string | null;
  financialStatus: string | null;
  advanceReportedPct: number | null;
  projectManagerName: string | null;
  milestonesTotal: number | null;
  milestonesFulfilled: number | null;
  milestonesPending: number | null;
  risksTotal: number | null;
  risksOpen: number | null;
  risksHighPriorityOpen: number | null;
  sourceUpdatedAt: Date | string | null;
  capturedAt: Date | string;
  lastSuccessAt: Date | string | null;
  errorCode: string | null;
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
  financial?: ExecutiveFinancialSource[];
  jiraSnapshots?: ExecutiveJiraSnapshotSource[];
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Salidas                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export type AttentionState = "overdue" | "at_risk" | "on_track" | "no_deadline";

/** Un proyecto cerrado o cancelado no tiene plazo vigente que medir. */
export type DeadlineState = AttentionState | "not_applicable";

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

/** Una fila por proyecto para la lista completa del portafolio. */
export interface PortfolioRow {
  projectId: number;
  projectName: string;
  clientName: string;
  dealId: string | null;
  projectType: string | null;
  origin: string | null;
  status: ProjectStatus;
  stageId: string;
  stageLabel: string;
  stageIndex: number;
  totalStages: number;
  /** Etapas efectivamente cerradas, no la posición del cursor. */
  stagesClosed: number;
  closedStageIds: string[];
  daysUsed: number | null;
  daysAllowed: number | null;
  overDays: number | null;
  deadlineState: DeadlineState;
  pmId: number | null;
  pmKey: string | null;
  pmName: string | null;
  amount: number | null;
  currency: string | null;
  /** Un monto ausente se conserva como ausencia, no como cero. */
  amountMissing: boolean;
  amountSource: "financial_data" | "project" | "billing_milestones" | "missing";
  highRisksOpen: number;
  openRisks: number | null;
  riskSource: "pmo_confirmed" | "jira_snapshot" | "missing";
  operationalPhase: string | null;
  operationalPhaseSource: "jira_snapshot" | "financial_data" | "missing";
  operationalProgressPct: number | null;
  executiveHealth: string | null;
  jiraEvidenceStatus: "success" | "partial" | "error" | "missing";
  jiraEvidenceAt: string | null;
  jiraEvidenceStale: boolean;
  milestonesTotal: number | null;
  milestonesFulfilled: number | null;
  milestoneSource: "jira_snapshot" | "missing";
  deadlineReason: "measured" | "missing_stage_opening" | "not_applicable";
  startDate: string | null;
  endDate: string | null;
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
  /** Plazo base configurado para la etapa. */
  allowedDays: number;
  /** Promedio del plazo efectivo de cierres, incluidas extensiones. */
  avgEffectiveAllowedDays: number | null;
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
  /** Todos los proyectos en orden de entrada; la UI filtra y ordena. */
  portfolio: PortfolioRow[];
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
  const normalizeDeal = (value: string | null | undefined) => value?.replace(/\s+/g, "").toLowerCase() ?? "";
  const financialByDeal = new Map(
    (input.financial ?? []).map(row => [normalizeDeal(row.dealId), row]),
  );
  const jiraSnapshotByProject = new Map(
    (input.jiraSnapshots ?? []).map(snapshot => [snapshot.projectId, snapshot]),
  );
  const milestonesByProject = new Map<number, ExecutiveMilestoneSource[]>();
  for (const milestone of input.milestones) {
    const existing = milestonesByProject.get(milestone.projectId) ?? [];
    existing.push(milestone);
    milestonesByProject.set(milestone.projectId, existing);
  }

  const dealFor = (project: ExecutiveProjectSource) => {
    if (project.dealId?.trim()) return project.dealId.trim();
    const match = project.projectName.match(/\bDeal\s*([A-Za-z0-9_-]+)/i);
    return match ? `Deal${match[1]}` : null;
  };

  const amountFor = (project: ExecutiveProjectSource) => {
    const financial = financialByDeal.get(normalizeDeal(dealFor(project)));
    const financialAmount = toNumber(financial?.valorVentaUF);
    if (financialAmount !== null) {
      return { amount: financialAmount, currency: "UF", source: "financial_data" as const };
    }
    const projectAmount = toNumber(project.totalAmount);
    if (projectAmount !== null) {
      return { amount: projectAmount, currency: normalizeCurrency(project.currency), source: "project" as const };
    }
    const projectMilestones = milestonesByProject.get(project.id) ?? [];
    const milestoneCurrencies = Array.from(new Set(projectMilestones.map(item => normalizeCurrency(item.currency))));
    const milestoneAmounts = projectMilestones.map(item => toNumber(item.amount));
    if (projectMilestones.length > 0 && milestoneCurrencies.length === 1 && milestoneAmounts.every((value): value is number => value !== null)) {
      return {
        amount: milestoneAmounts.reduce((sum, value) => sum + value, 0),
        currency: milestoneCurrencies[0],
        source: "billing_milestones" as const,
      };
    }
    return { amount: null, currency: null, source: "missing" as const };
  };

  const pmFor = (project: ExecutiveProjectSource) => {
    const localName = project.pmId !== null ? (userById.get(project.pmId) ?? null) : null;
    if (localName) return { pmId: project.pmId, pmKey: String(project.pmId), pmName: localName };
    const jiraName = jiraSnapshotByProject.get(project.id)?.projectManagerName?.trim() || null;
    if (jiraName) return { pmId: null, pmKey: `name:${jiraName.toLowerCase()}`, pmName: jiraName };
    const financialName = financialByDeal.get(normalizeDeal(dealFor(project)))?.pm?.trim() || null;
    return {
      pmId: null,
      pmKey: financialName ? `name:${financialName.toLowerCase()}` : null,
      pmName: financialName,
    };
  };
  const activeProjects = input.projects.filter(project => project.status === "activo");
  const closedProjects = input.projects.filter(project => project.status === "completado");
  const closedIds = new Set(closedProjects.map(project => project.id));

  /* ── Riesgos altos abiertos, por proyecto ───────────────────────────────── */

  const highOpenRisks = input.risks.filter(
    risk => risk.confirmed && risk.status === "abierto" && risk.impact === "alto",
  );
  const highOpenByProject = new Map<number, number>();
  for (const risk of highOpenRisks) {
    highOpenByProject.set(risk.projectId, (highOpenByProject.get(risk.projectId) ?? 0) + 1);
  }
  const confirmedRisksByProject = new Map<number, ExecutiveRiskSource[]>();
  for (const risk of input.risks.filter(item => item.confirmed)) {
    const existing = confirmedRisksByProject.get(risk.projectId) ?? [];
    existing.push(risk);
    confirmedRisksByProject.set(risk.projectId, existing);
  }

  const risksFor = (projectId: number) => {
    const local = confirmedRisksByProject.get(projectId) ?? [];
    if (local.length > 0) {
      return {
        openRisks: local.filter(risk => risk.status === "abierto").length,
        highRisksOpen: highOpenByProject.get(projectId) ?? 0,
        source: "pmo_confirmed" as const,
      };
    }
    const snapshot = jiraSnapshotByProject.get(projectId);
    if (snapshot?.lastSuccessAt && snapshot.risksOpen !== null) {
      return {
        openRisks: snapshot.risksOpen,
        highRisksOpen: snapshot.risksHighPriorityOpen ?? 0,
        source: "jira_snapshot" as const,
      };
    }
    return { openRisks: null, highRisksOpen: 0, source: "missing" as const };
  };

  const completedStages = input.compliance.filter(
    detail => detail.status === "on_time" || detail.status === "late",
  );
  const closedStagesByProject = new Map<number, Set<string>>();
  for (const detail of completedStages) {
    const closedStageIds = closedStagesByProject.get(detail.projectId) ?? new Set<string>();
    closedStageIds.add(detail.stageId);
    closedStagesByProject.set(detail.projectId, closedStageIds);
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

  function deadlineFor(project: ExecutiveProjectSource) {
    const detail = inProgressByProject.get(project.id) ?? null;
    const measurable = detail !== null && detail.totalAllowed > 0;
    const overDays = measurable ? detail.daysUsed - detail.totalAllowed : null;

    let state: AttentionState = "no_deadline";
    if (measurable) {
      if (overDays! > 0) state = "overdue";
      else if (detail.daysUsed >= detail.totalAllowed * AT_RISK_RATIO) state = "at_risk";
      else state = "on_track";
    }

    return {
      detail,
      overDays,
      state,
      daysUsed: detail?.daysUsed ?? null,
      daysAllowed: measurable ? detail.totalAllowed : null,
    };
  }

  const attention: AttentionRow[] = activeProjects.map(project => {
    const deadline = deadlineFor(project);
    const pm = pmFor(project);
    const risk = risksFor(project.id);
    const contracted = amountFor(project);

    return {
      projectId: project.id,
      projectName: project.projectName,
      clientName: project.clientName,
      dealId: dealFor(project),
      pmName: pm.pmName,
      stageId: deadline.detail?.stageId ?? project.currentStage,
      stageLabel: labelFor(deadline.detail?.stageId ?? project.currentStage),
      daysUsed: deadline.daysUsed,
      daysAllowed: deadline.daysAllowed,
      overDays: deadline.overDays,
      state: deadline.state,
      highRisksOpen: risk.highRisksOpen,
      amount: contracted.amount,
      currency: contracted.currency,
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

  const portfolio: PortfolioRow[] = input.projects.map(project => {
    const hasLiveDeadline = project.status === "activo" || project.status === "pausado";
    const deadline = hasLiveDeadline ? deadlineFor(project) : null;
    const contracted = amountFor(project);
    const pm = pmFor(project);
    const risk = risksFor(project.id);
    const snapshot = jiraSnapshotByProject.get(project.id) ?? null;
    const financial = financialByDeal.get(normalizeDeal(dealFor(project)));
    const jiraEvidenceAt = toIso(snapshot?.lastSuccessAt ?? null);
    const jiraEvidenceAgeMs = jiraEvidenceAt
      ? new Date(input.generatedAt).getTime() - new Date(jiraEvidenceAt).getTime()
      : Number.POSITIVE_INFINITY;
    const jiraEvidenceStale = !snapshot || snapshot.status === "error" || jiraEvidenceAgeMs > 36 * 60 * 60 * 1000;
    const operationalPhase = snapshot?.lastSuccessAt && snapshot.operationalPhase?.trim()
      ? snapshot.operationalPhase.trim()
      : financial?.estadoProyecto?.trim() || null;
    const operationalPhaseSource = snapshot?.lastSuccessAt && snapshot.operationalPhase?.trim()
      ? "jira_snapshot" as const
      : financial?.estadoProyecto?.trim()
        ? "financial_data" as const
        : "missing" as const;
    const milestonesTotal = snapshot?.lastSuccessAt ? snapshot.milestonesTotal : null;
    const milestonesFulfilled = snapshot?.lastSuccessAt ? snapshot.milestonesFulfilled : null;
    const operationalProgressPct = snapshot?.lastSuccessAt
      ? snapshot.advanceReportedPct ?? (
          milestonesTotal && milestonesFulfilled !== null
            ? round1((milestonesFulfilled / milestonesTotal) * 100)
            : null
        )
      : null;

    return {
      projectId: project.id,
      projectName: project.projectName,
      clientName: project.clientName,
      dealId: dealFor(project),
      projectType: project.projectType,
      origin: project.origin ?? null,
      status: project.status,
      stageId: project.currentStage,
      stageLabel: labelFor(project.currentStage),
      stageIndex: STAGE_ORDER.indexOf(project.currentStage),
      totalStages: STAGE_ORDER.length,
      stagesClosed: closedStagesByProject.get(project.id)?.size ?? 0,
      closedStageIds: Array.from(closedStagesByProject.get(project.id) ?? []),
      daysUsed: deadline?.daysUsed ?? null,
      daysAllowed: deadline?.daysAllowed ?? null,
      overDays: deadline?.overDays ?? null,
      deadlineState: deadline?.state ?? "not_applicable",
      deadlineReason: !hasLiveDeadline ? "not_applicable" : deadline?.detail ? "measured" : "missing_stage_opening",
      pmId: pm.pmId,
      pmKey: pm.pmKey,
      pmName: pm.pmName,
      amount: contracted.amount,
      currency: contracted.currency,
      amountMissing: contracted.amount === null,
      amountSource: contracted.source,
      highRisksOpen: risk.highRisksOpen,
      openRisks: risk.openRisks,
      riskSource: risk.source,
      operationalPhase,
      operationalPhaseSource,
      operationalProgressPct,
      executiveHealth: snapshot?.lastSuccessAt ? snapshot.executiveStatus : null,
      jiraEvidenceStatus: snapshot?.status ?? "missing",
      jiraEvidenceAt,
      jiraEvidenceStale,
      milestonesTotal,
      milestonesFulfilled,
      milestoneSource: snapshot?.lastSuccessAt ? "jira_snapshot" : "missing",
      startDate: project.startDate,
      endDate: project.endDate,
    };
  });

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
    const contracted = amountFor(project);
    if (contracted.amount === null || contracted.currency === null) continue;
    const figure = figureFor(contracted.currency);
    if (project.status === "activo") figure.contractedActive += contracted.amount;
    else if (project.status === "completado") figure.contractedClosed += contracted.amount;
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
    const closedProjectIds = new Set(stageDetails.map(detail => detail.projectId));
    const stageExtensions = input.extensions.filter(
      extension => extension.stageId === stageId && extension.type === "extend" && closedProjectIds.has(extension.projectId),
    );

    return {
      stageId,
      label: labelFor(stageId),
      allowedDays: deadline?.maxBusinessDays ?? 0,
      avgEffectiveAllowedDays: average(stageDetails.map(detail => detail.totalAllowed)),
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
    portfolio,
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

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** null con lista vacía: un promedio de nada no es 0. */
function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return round1(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
