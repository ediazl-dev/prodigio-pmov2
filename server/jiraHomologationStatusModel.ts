import { resolveProjectDeal, sameDeal, type ProjectDealSource } from "./projectFinancialIdentity";

export type JiraHomologationRun = {
  id: number;
  runId?: string;
  source: string;
  status: string;
  inputCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  errorMessage: string | null;
  startedAt?: Date | string | null;
  finishedAt: Date | string | null;
  createdAt: Date | string;
  details: unknown;
};

export type JiraHomologationFinancialRow = {
  dealId: string;
  valorVentaUF: string | number | null;
  presupuestoUF: string | number | null;
  utilizadoUF: string | number | null;
  costoProyectadoUF: string | number | null;
  margenProyectadoUF: string | number | null;
  margenProyectadoPorc: string | number | null;
  planificadoUF?: string | number | null;
  proyectadoUF: string | number | null;
  syncedAt: Date | string | null;
};

export type JiraHomologationExceptionSource = {
  id: number;
  domain: string;
  sourceKey: string | null;
  reason: string;
  severity: string;
  updatedAt?: Date | string | null;
};

export type JiraHomologationGap = {
  kind: "governance" | "document" | "mapping" | "financial";
  severity: "info" | "warning" | "blocking";
  label: string;
  explanation: string;
  recommendedAction: string;
  blocksSync: boolean;
};

export type JiraHomologationCoverageItem = {
  key: "onboarding" | "financial" | "sow" | "gantt" | "risks" | "wbs";
  label: string;
  status: "available" | "partial" | "missing";
  detail: string;
};

export type JiraHomologationExceptionView = JiraHomologationExceptionSource & {
  title: string;
  whatHappened: string;
  impact: string;
  recommendedAction: string;
  blocksSync: boolean;
};

export type JiraHomologationFinancialView = {
  status: "available" | "not_found" | "unlinked";
  dealId: string | null;
  dealSource: ProjectDealSource;
  formallyLinked: boolean;
  sourceLabel: string | null;
  syncedAt: Date | string | null;
  currency: "UF" | null;
  contractedUf: number | null;
  budgetUf: number | null;
  consumedUf: number | null;
  projectedCostUf: number | null;
  projectedMarginUf: number | null;
  projectedMarginPct: number | null;
  capacityProjectedUf: number | null;
};

export type JiraHomologationHistorySummary = {
  recentRuns: JiraHomologationRun[];
  totalRuns: number;
  hasMore: boolean;
  visibleLimit: number;
  statusCounts: {
    applied: number;
    partial: number;
    error: number;
    running: number;
  };
};

type BuildInput = {
  project: { projectName: string; dealId: string | null };
  linkedDealIds?: Array<string | null | undefined>;
  onboardingStatus: string | null;
  financial: JiraHomologationFinancialRow | null;
  counts: {
    risks: { imported: number; mapped: number };
    wbs: { imported: number; mapped: number };
    documents: { sow: number; gantt: number; milestoneAcceptances: number };
    openExceptions: number;
  };
  exceptions: JiraHomologationExceptionSource[];
  reconciliationRuns: JiraHomologationRun[];
  totalReconciliationRuns: number;
  reconciliationStatusCounts?: Partial<JiraHomologationHistorySummary["statusCounts"]>;
  visibleHistoryLimit?: number;
};

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function classifyException(exception: JiraHomologationExceptionSource): JiraHomologationExceptionView {
  const normalizedReason = exception.reason.toLowerCase();
  const blocksSync = exception.severity === "blocking";
  if (exception.domain === "planning" && normalizedReason.includes("clave de padre")) {
    return {
      ...exception,
      title: "Jerarquía Jira incompleta",
      whatHappened: `${exception.sourceKey ?? "Un ítem Jira"} no informa una épica o tarea padre.`,
      impact: "El ítem se conserva, pero no se asigna automáticamente a una jerarquía para evitar una relación incorrecta.",
      recommendedAction: "Revisar el padre correcto en Jira o aprobar manualmente la relación en la homologación.",
      blocksSync,
    };
  }
  if (exception.domain === "documents") {
    return {
      ...exception,
      title: "Documento requiere validación",
      whatHappened: exception.reason,
      impact: "La referencia no se incorporó como evidencia válida para proteger la trazabilidad documental.",
      recommendedAction: "Cargar o corregir el archivo desde la sección documental del proyecto.",
      blocksSync,
    };
  }
  if (exception.domain === "finance") {
    return {
      ...exception,
      title: "Vínculo financiero requiere revisión",
      whatHappened: exception.reason,
      impact: "Las cifras dudosas no se asociaron automáticamente al proyecto.",
      recommendedAction: "Validar el Deal y formalizar la asociación en la ficha del proyecto.",
      blocksSync,
    };
  }
  if (exception.domain === "risks") {
    return {
      ...exception,
      title: "Riesgo Jira requiere revisión",
      whatHappened: exception.reason,
      impact: "El riesgo no se actualizó automáticamente para no sobrescribir información confirmada.",
      recommendedAction: "Revisar el mapping y resolver el dato faltante antes de reintentar.",
      blocksSync,
    };
  }
  return {
    ...exception,
    title: "Caso pendiente de revisión",
    whatHappened: exception.reason,
    impact: "El sistema omitió sólo este caso para proteger los datos confirmados; el resto de la corrida se conserva.",
    recommendedAction: "Revisar la fuente indicada y resolver o aceptar la excepción de forma manual.",
    blocksSync,
  };
}

export function buildJiraHomologationStatusModel(input: BuildInput) {
  const resolvedDeal = resolveProjectDeal({
    projectDealId: input.project.dealId,
    projectName: input.project.projectName,
    linkedDealIds: input.linkedDealIds,
  });
  const matchingFinancial = resolvedDeal.dealId && sameDeal(resolvedDeal.dealId, input.financial?.dealId)
    ? input.financial
    : null;
  const financial: JiraHomologationFinancialView = matchingFinancial
    ? {
        status: "available",
        dealId: resolvedDeal.dealId,
        dealSource: resolvedDeal.source,
        formallyLinked: resolvedDeal.formallyLinked,
        sourceLabel: "Planilla financiera sincronizada",
        syncedAt: matchingFinancial.syncedAt,
        currency: "UF",
        contractedUf: finiteNumber(matchingFinancial.valorVentaUF),
        budgetUf: finiteNumber(matchingFinancial.presupuestoUF),
        consumedUf: finiteNumber(matchingFinancial.utilizadoUF),
        projectedCostUf: finiteNumber(matchingFinancial.costoProyectadoUF),
        projectedMarginUf: finiteNumber(matchingFinancial.margenProyectadoUF),
        projectedMarginPct: finiteNumber(matchingFinancial.margenProyectadoPorc),
        capacityProjectedUf: finiteNumber(matchingFinancial.proyectadoUF),
      }
    : {
        status: resolvedDeal.dealId ? "not_found" : "unlinked",
        dealId: resolvedDeal.dealId,
        dealSource: resolvedDeal.source,
        formallyLinked: resolvedDeal.formallyLinked,
        sourceLabel: null,
        syncedAt: null,
        currency: null,
        contractedUf: null,
        budgetUf: null,
        consumedUf: null,
        projectedCostUf: null,
        projectedMarginUf: null,
        projectedMarginPct: null,
        capacityProjectedUf: null,
      };

  const onboardingReady = input.onboardingStatus === "ready";
  const risksComplete = input.counts.risks.imported >= input.counts.risks.mapped;
  const wbsComplete = input.counts.wbs.imported >= input.counts.wbs.mapped;
  const coverage: JiraHomologationCoverageItem[] = [
    { key: "onboarding", label: "Vínculo Jira", status: onboardingReady ? "available" : "missing", detail: onboardingReady ? "Listo para sincronizar" : "Onboarding no finalizado" },
    { key: "financial", label: "Datos financieros", status: financial.status === "available" ? "available" : "missing", detail: financial.status === "available" ? `${financial.dealId} disponible en planilla` : financial.dealId ? `${financial.dealId} sin fila financiera` : "Deal no identificado" },
    { key: "sow", label: "SoW contractual", status: input.counts.documents.sow > 0 ? "available" : "missing", detail: input.counts.documents.sow > 0 ? `${input.counts.documents.sow} archivo(s)` : "Sin archivo cargado" },
    { key: "gantt", label: "Gantt contractual", status: input.counts.documents.gantt > 0 ? "available" : "missing", detail: input.counts.documents.gantt > 0 ? `${input.counts.documents.gantt} archivo(s)` : "Sin archivo cargado" },
    { key: "risks", label: "Riesgos", status: risksComplete ? "available" : "partial", detail: input.counts.risks.mapped > 0 ? `${input.counts.risks.imported}/${input.counts.risks.mapped} mappings cubiertos` : `${input.counts.risks.imported} registro(s) con clave Jira · sin mappings exigidos` },
    { key: "wbs", label: "Backlog", status: wbsComplete ? "available" : "partial", detail: input.counts.wbs.mapped > 0 ? `${input.counts.wbs.imported}/${input.counts.wbs.mapped} mappings cubiertos` : `${input.counts.wbs.imported} registro(s) con clave Jira · sin mappings exigidos` },
  ];

  const gaps: JiraHomologationGap[] = [];
  if (!onboardingReady) gaps.push({ kind: "governance", severity: "blocking", label: "Completar onboarding Jira", explanation: "El vínculo Jira todavía no está listo para una sincronización controlada.", recommendedAction: "Completar y aprobar el onboarding antes de sincronizar.", blocksSync: true });
  if (financial.status === "available" && !financial.formallyLinked) gaps.push({ kind: "financial", severity: "info", label: "Formalizar el vínculo financiero", explanation: `${financial.dealId} fue detectado en el nombre y coincide con la planilla; las cifras están disponibles, pero el campo Deal de la ficha sigue vacío.`, recommendedAction: "Validar y guardar el Deal en la ficha para dejar la asociación explícita.", blocksSync: false });
  if (financial.status === "not_found") gaps.push({ kind: "financial", severity: "warning", label: "Revisar datos financieros", explanation: `${financial.dealId} fue identificado, pero no tiene una fila disponible en la planilla sincronizada.`, recommendedAction: "Verificar el Deal en la fuente financiera o esperar la siguiente sincronización de la planilla.", blocksSync: false });
  if (financial.status === "unlinked") gaps.push({ kind: "financial", severity: "warning", label: "Identificar Deal financiero", explanation: "No existe un Deal formal ni uno explícito en el nombre del proyecto; por eso las cifras permanecen N/D.", recommendedAction: "Registrar el Deal correcto en la ficha del proyecto.", blocksSync: false });
  if (!input.counts.documents.sow) gaps.push({ kind: "document", severity: "warning", label: "Cargar SoW contractual", explanation: "No existe un SoW verificable asociado a esta homologación.", recommendedAction: "Cargar el PDF contractual desde la sección documental.", blocksSync: false });
  if (!input.counts.documents.gantt) gaps.push({ kind: "document", severity: "warning", label: "Cargar Gantt contractual", explanation: "No existe una línea base contractual cargada para contrastar fechas Jira.", recommendedAction: "Cargar la Gantt aprobada desde la sección documental.", blocksSync: false });
  if (!risksComplete) gaps.push({ kind: "mapping", severity: "warning", label: "Completar mappings de riesgos", explanation: `Se importaron ${input.counts.risks.imported} de ${input.counts.risks.mapped} riesgos esperados.`, recommendedAction: "Revisar mappings pendientes antes de la próxima corrida.", blocksSync: false });
  if (!wbsComplete) gaps.push({ kind: "mapping", severity: "warning", label: "Completar mappings de backlog", explanation: `Se importaron ${input.counts.wbs.imported} de ${input.counts.wbs.mapped} ítems esperados.`, recommendedAction: "Revisar mappings pendientes antes de la próxima corrida.", blocksSync: false });

  const visibleLimit = Math.max(1, input.visibleHistoryLimit ?? 3);
  const statusCounts = {
    applied: input.reconciliationStatusCounts?.applied ?? input.reconciliationRuns.filter((run) => run.status === "applied").length,
    partial: input.reconciliationStatusCounts?.partial ?? input.reconciliationRuns.filter((run) => run.status === "partial").length,
    error: input.reconciliationStatusCounts?.error ?? input.reconciliationRuns.filter((run) => run.status === "error").length,
    running: input.reconciliationStatusCounts?.running ?? input.reconciliationRuns.filter((run) => run.status === "running").length,
  };
  const history: JiraHomologationHistorySummary = {
    recentRuns: input.reconciliationRuns.slice(0, visibleLimit),
    totalRuns: input.totalReconciliationRuns,
    hasMore: input.totalReconciliationRuns > visibleLimit,
    visibleLimit,
    statusCounts,
  };

  return {
    financial,
    coverage,
    gaps,
    exceptions: input.exceptions.map(classifyException),
    history,
  };
}
