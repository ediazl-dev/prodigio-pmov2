/**
 * Financial Data Fetcher - Reads financial and capacity data from the
 * financial_data database table (synced from Google Sheets "Artefactos_proyectos").
 *
 * This module was migrated from a Google Sheets rclone-based approach to
 * a database-backed approach to ensure production reliability.
 * Data is synced from the Google Sheet into the financial_data table
 * and read directly from the DB at runtime.
 */
import {
  getFinancialDataByDealId,
  getActiveFinancialData,
} from "./db";
import { normalizeDealId } from "./projectFinancialIdentity";

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface ProjectFinancial {
  dealId: string;
  estadoProyecto: string;
  projectName: string;
  clientName: string;
  pm: string;
  valorVentaUF: number | null;
  presupuestoUF: number | null;
  utilizadoUF: number | null;
  utilizadoUFPorc: number | null;
  margenBrutoNotaVentaUF: number | null;
  porcentajeAvanceProyecto: number | null;
  costoProyectadoUF: number | null;
  margenProyectadoUF: number | null;
  margenProyectadoPorc: number | null;
  margenTargetPorc: number | null;
  capacityU: number | null;
  planificadoUF: number | null;
  proyectadoUF: number | null;
  margenProyectadoSegunCapacity: number | null;
  notas: string | null;
  otrosCostosUF: number | null;
  lineaNegocio: string | null;
  presupuestoHH: number | null;
  capacityHH: number | null;
  hhPorcUtilizado: number | null;
}

export interface Alert {
  type: "critical" | "warning" | "info" | "success";
  category: string;
  title: string;
  description: string;
  value?: string;
}

export interface PortfolioContext {
  avgMargenProyectadoPorc: number;
  avgMargenTargetPorc: number;
  avgUtilizadoPorc: number;
  totalActiveProjects: number;
  projectRank: number | null;
}

export interface FinancialDashboardData {
  projectFinancial: ProjectFinancial | null;
  alerts: Alert[];
  portfolioContext: PortfolioContext | null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Convert a Drizzle decimal string to a number or null */
function toNum(val: string | null | undefined): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

/** Convert a DB row into the ProjectFinancial interface */
function rowToProjectFinancial(row: any): ProjectFinancial {
  return {
    dealId: row.dealId,
    estadoProyecto: row.estadoProyecto || "",
    projectName: row.projectName || "",
    clientName: row.clientName || "",
    pm: row.pm || "",
    valorVentaUF: toNum(row.valorVentaUF),
    presupuestoUF: toNum(row.presupuestoUF),
    utilizadoUF: toNum(row.utilizadoUF),
    utilizadoUFPorc: toNum(row.utilizadoUFPorc),
    margenBrutoNotaVentaUF: toNum(row.margenBrutoNotaVentaUF),
    porcentajeAvanceProyecto: toNum(row.porcentajeAvanceProyecto),
    costoProyectadoUF: toNum(row.costoProyectadoUF),
    margenProyectadoUF: toNum(row.margenProyectadoUF),
    margenProyectadoPorc: toNum(row.margenProyectadoPorc),
    margenTargetPorc: toNum(row.margenTargetPorc),
    capacityU: toNum(row.capacityU),
    planificadoUF: toNum(row.planificadoUF),
    proyectadoUF: toNum(row.proyectadoUF),
    margenProyectadoSegunCapacity: toNum(row.margenProyectadoSegunCapacity),
    notas: row.notas || null,
    otrosCostosUF: toNum(row.otrosCostosUF),
    lineaNegocio: row.lineaNegocio || null,
    presupuestoHH: toNum(row.presupuestoHH),
    capacityHH: toNum(row.capacityHH),
    hhPorcUtilizado: toNum(row.hhPorcUtilizado),
  };
}

// ── Main function ───────────────────────────────────────────────────────────

/**
 * Extract financial data for a specific deal from the database.
 * @param dealId - The deal identifier, e.g. "Deal1996" or "1996"
 */
export async function getFinancialDataForDeal(dealId: string): Promise<FinancialDashboardData> {
  const empty: FinancialDashboardData = { projectFinancial: null, alerts: [], portfolioContext: null };

  if (!dealId) return empty;

  // Normalize dealId: ensure it starts with "Deal"
  const normalizedDealId = dealId.startsWith("Deal") ? dealId : `Deal${dealId}`;

  // Fetch from database
  let dbRow: any;
  try {
    dbRow = await getFinancialDataByDealId(normalizedDealId);
  } catch (err) {
    console.error("[FinancialDataFetcher] Error reading from database:", err);
    return empty;
  }

  let projectFinancial: ProjectFinancial | null = null;
  if (dbRow) {
    projectFinancial = rowToProjectFinancial(dbRow);
  }

  // Fetch active projects for portfolio context
  let activeRows: any[] = [];
  try {
    activeRows = await getActiveFinancialData();
  } catch (err) {
    console.error("[FinancialDataFetcher] Error reading active projects:", err);
  }

  const activeProjects = activeRows.map(rowToProjectFinancial);

  // ── Generate alerts ─────────────────────────────────────────────────────

  const alerts: Alert[] = [];

  if (projectFinancial) {
    const fin = projectFinancial;

    // 1. Budget utilization alerts
    if (fin.utilizadoUFPorc !== null) {
      if (fin.utilizadoUFPorc > 1) {
        const pct = (fin.utilizadoUFPorc * 100).toFixed(0);
        alerts.push({
          type: "critical",
          category: "Presupuesto",
          title: "Sobrecosto detectado",
          description: `El proyecto ha consumido ${pct}% del presupuesto asignado (${fin.utilizadoUF?.toFixed(0) ?? "?"} UF de ${fin.presupuestoUF?.toFixed(0) ?? "?"} UF).`,
          value: `${pct}%`,
        });
      } else if (fin.utilizadoUFPorc > 0.85) {
        alerts.push({
          type: "warning",
          category: "Presupuesto",
          title: "Presupuesto en zona de riesgo",
          description: `Se ha utilizado el ${(fin.utilizadoUFPorc * 100).toFixed(0)}% del presupuesto. Quedan ${((1 - fin.utilizadoUFPorc) * (fin.presupuestoUF ?? 0)).toFixed(0)} UF disponibles.`,
          value: `${(fin.utilizadoUFPorc * 100).toFixed(0)}%`,
        });
      } else {
        alerts.push({
          type: "success",
          category: "Presupuesto",
          title: "Presupuesto controlado",
          description: `Utilización del ${(fin.utilizadoUFPorc * 100).toFixed(0)}% del presupuesto.`,
        });
      }
    }

    // 2. Margin vs Target alerts
    if (fin.margenProyectadoPorc !== null && fin.margenTargetPorc !== null) {
      const margenPct = fin.margenProyectadoPorc * 100;
      const targetPct = fin.margenTargetPorc * 100;
      const gap = margenPct - targetPct;

      if (fin.margenProyectadoPorc < 0) {
        alerts.push({
          type: "critical",
          category: "Margen",
          title: "Margen negativo — Proyecto con pérdida",
          description: `El margen proyectado es ${margenPct.toFixed(1)}%. El proyecto generará pérdidas de ${Math.abs(fin.margenProyectadoUF ?? 0).toFixed(0)} UF.`,
          value: `${margenPct.toFixed(1)}%`,
        });
      } else if (gap < -10) {
        alerts.push({
          type: "critical",
          category: "Margen",
          title: "Margen muy por debajo del target",
          description: `El margen proyectado (${margenPct.toFixed(1)}%) está ${Math.abs(gap).toFixed(1)}pp por debajo del target P&L (${targetPct.toFixed(1)}%).`,
          value: `${gap.toFixed(1)}pp`,
        });
      } else if (gap < 0) {
        alerts.push({
          type: "warning",
          category: "Margen",
          title: "Margen bajo target P&L",
          description: `El margen proyectado (${margenPct.toFixed(1)}%) está ${Math.abs(gap).toFixed(1)}pp por debajo del target (${targetPct.toFixed(1)}%).`,
          value: `${gap.toFixed(1)}pp`,
        });
      } else {
        alerts.push({
          type: "success",
          category: "Margen",
          title: "Margen supera el target",
          description: `El margen proyectado (${margenPct.toFixed(1)}%) supera el target P&L (${targetPct.toFixed(1)}%) en +${gap.toFixed(1)}pp.`,
          value: `+${gap.toFixed(1)}pp`,
        });
      }
    }

    // 3. Capacity vs Presupuesto alerts
    if (fin.proyectadoUF !== null && fin.presupuestoUF !== null && fin.presupuestoUF > 0) {
      const capacityRatio = fin.proyectadoUF / fin.presupuestoUF;
      if (capacityRatio > 1.1) {
        alerts.push({
          type: "warning",
          category: "Capacity",
          title: "Capacity proyectado excede presupuesto",
          description: `El capacity proyectado (${fin.proyectadoUF.toFixed(0)} UF) supera el presupuesto (${fin.presupuestoUF.toFixed(0)} UF) en ${((capacityRatio - 1) * 100).toFixed(0)}%.`,
          value: `${(capacityRatio * 100).toFixed(0)}%`,
        });
      }
    }

    // 4. Margin by capacity vs margin by advance
    if (fin.margenProyectadoSegunCapacity !== null && fin.margenProyectadoPorc !== null) {
      const diff = (fin.margenProyectadoSegunCapacity - fin.margenProyectadoPorc) * 100;
      if (Math.abs(diff) > 5) {
        alerts.push({
          type: "info",
          category: "Análisis",
          title: "Diferencia entre márgenes",
          description: `El margen según capacity (${(fin.margenProyectadoSegunCapacity * 100).toFixed(1)}%) difiere del margen según avance (${(fin.margenProyectadoPorc * 100).toFixed(1)}%) en ${Math.abs(diff).toFixed(1)}pp.`,
          value: `${diff > 0 ? "+" : ""}${diff.toFixed(1)}pp`,
        });
      }
    }

    // 5. Advance vs budget utilization mismatch
    if (fin.porcentajeAvanceProyecto !== null && fin.utilizadoUFPorc !== null) {
      const advancePct = fin.porcentajeAvanceProyecto * 100;
      const budgetPct = fin.utilizadoUFPorc * 100;
      if (budgetPct > advancePct + 15) {
        alerts.push({
          type: "warning",
          category: "Eficiencia",
          title: "Gasto adelantado al avance",
          description: `Se ha gastado ${budgetPct.toFixed(0)}% del presupuesto pero el avance es solo ${advancePct.toFixed(0)}%. Posible ineficiencia.`,
          value: `${(budgetPct - advancePct).toFixed(0)}pp`,
        });
      }
    }
  }

  // ── Portfolio context ─────────────────────────────────────────────────────

  let portfolioContext: PortfolioContext | null = null;
  const activeWithData = activeProjects.filter(p => p && p.dealId && p.margenProyectadoPorc !== null);

  if (activeWithData.length > 0) {
    const avgMargen = activeWithData.reduce((s, p) => s + (p.margenProyectadoPorc ?? 0), 0) / activeWithData.length;
    const activeWithTarget = activeWithData.filter(p => p.margenTargetPorc !== null);
    const avgTarget = activeWithTarget.length > 0
      ? activeWithTarget.reduce((s, p) => s + (p.margenTargetPorc ?? 0), 0) / activeWithTarget.length
      : 0;
    const activeWithUtilizado = activeWithData.filter(p => p.utilizadoUFPorc !== null);
    const avgUtilizado = activeWithUtilizado.length > 0
      ? activeWithUtilizado.reduce((s, p) => s + (p.utilizadoUFPorc ?? 0), 0) / activeWithUtilizado.length
      : 0;

    // Rank by margin (descending)
    let rank: number | null = null;
    if (projectFinancial && projectFinancial.margenProyectadoPorc !== null) {
      const sorted = [...activeWithData].sort((a, b) => (b.margenProyectadoPorc ?? 0) - (a.margenProyectadoPorc ?? 0));
      const idx = sorted.findIndex(p => p && p.dealId && p.dealId === projectFinancial!.dealId);
      rank = idx >= 0 ? idx + 1 : null;
    }

    portfolioContext = {
      avgMargenProyectadoPorc: avgMargen,
      avgMargenTargetPorc: avgTarget,
      avgUtilizadoPorc: avgUtilizado,
      totalActiveProjects: activeWithData.length,
      projectRank: rank,
    };
  }

  return { projectFinancial, alerts, portfolioContext };
}

/**
 * Extract deal ID from a JIRA project name.
 * Examples:
 *   "[PMO Ruta Pass] Plan Modernización TI - Deal 1996" → "Deal1996"
 *   "Ruta Pass - Plan Modernización TI (Deal1996)" → "Deal1996"
 *   "Deal1996" → "Deal1996"
 *   "1996" → "Deal1996"
 */
export function extractDealId(projectNameOrDealId: string): string | null {
  return normalizeDealId(projectNameOrDealId);
}
