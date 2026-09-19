import type { PortfolioRow } from "./executivePortfolio";

export type PortfolioConsoleState = "CRITICO" | "ROJO" | "NARANJO" | "AMARILLO" | "VERDE" | "POR_CONFIRMAR";

const SEVERITY: Record<PortfolioConsoleState, number | null> = {
  CRITICO: 100,
  ROJO: 75,
  NARANJO: 50,
  AMARILLO: 25,
  VERDE: 0,
  POR_CONFIRMAR: null,
};

export function normalizePortfolioConsoleState(value: string | null | undefined): PortfolioConsoleState {
  const normalized = value
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim() ?? "";
  if (normalized.includes("CRITICO")) return "CRITICO";
  if (normalized.includes("ROJO")) return "ROJO";
  if (normalized.includes("NARANJO") || normalized.includes("RIESGO")) return "NARANJO";
  if (normalized.includes("AMARILLO")) return "AMARILLO";
  if (normalized.includes("VERDE") || normalized.includes("ESTABLE")) return "VERDE";
  return "POR_CONFIRMAR";
}

export interface ConsoleFallbackProject {
  id: number;
  projectName: string;
  clientName: string;
}

export function buildPortfolioConsoleFallback(
  project: ConsoleFallbackProject,
  row: PortfolioRow | null,
  jiraProjectKey: string | null,
) {
  const jiraUsable = row?.jiraEvidenceAvailability === "available" || row?.jiraEvidenceAvailability === "partial";
  const estado = normalizePortfolioConsoleState(jiraUsable ? row?.executiveHealth : null);
  const pa = SEVERITY[estado];
  const evidenceMissing = !row || row.jiraEvidenceAvailability === "missing" || row.jiraEvidenceAvailability === "error" || row.jiraEvidenceAvailability === "stale";

  return {
    projectId: project.id,
    projectName: project.projectName,
    clientName: project.clientName,
    dealId: row?.dealId ?? null,
    jiraProjectKey,
    estado,
    ige: null as number | null,
    jiraProgressPct: row?.operationalProgressPct ?? null,
    pa,
    ufEnRiesgo: null as number | null,
    contractedAmount: row?.amount ?? null,
    contractedCurrency: row?.currency ?? null,
    amountSource: row?.amountSource ?? "missing",
    pmName: row?.pmName ?? null,
    pmSource: row?.pmSource ?? "missing",
    gatillos: [] as string[],
    overdueP0Requirements: null as number | null,
    hitosVencidos: null as number | null,
    totalHitos: row?.milestonesTotal ?? null,
    hitosCumplidos: row?.milestonesFulfilled ?? null,
    openRisks: row?.openRisks ?? null,
    highRisksOpen: row?.highRisksOpen ?? null,
    riskSource: row?.riskSource ?? "missing",
    operationalPhase: row?.operationalPhase ?? null,
    lifecycleStatus: row?.status ?? "activo",
    pipelineStage: row?.stageLabel ?? null,
    requiereAtencion: estado !== "VERDE" || evidenceMissing,
    deterioro: null as number | null,
    sinBaseline: true,
    evidenceMissing,
    jiraEvidenceAvailability: row?.jiraEvidenceAvailability ?? "missing",
    jiraEvidenceAt: row?.jiraEvidenceAt ?? null,
    jiraSourceUpdatedAt: row?.jiraSourceUpdatedAt ?? null,
  };
}
