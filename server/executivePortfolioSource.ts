/**
 * Lectura de datos para el panel de control ejecutivo.
 *
 * Separa el acceso a base de datos del cálculo: aquí solo se leen filas y se
 * las entrega al motor puro `buildExecutivePortfolio`, que es el que se testea.
 *
 * El cálculo de días hábiles NO se repite: se reutiliza `getComplianceMetrics`,
 * que ya descuenta feriados, pausas y extensiones. Una sola implementación de
 * esa regla en todo el sistema.
 */

import { getComplianceMetrics, getDb } from "./db";
import {
  billingMilestones,
  lessonsLearned,
  projects,
  risks,
  stageDeadlineExtensions,
  stageDeadlines,
  users,
} from "../drizzle/schema";
import {
  buildExecutivePortfolio,
  type ExecutivePortfolio,
  type ExecutivePortfolioInput,
} from "./executivePortfolio";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Lectura vacía pero válida, para cuando no hay base de datos configurada. */
function emptyPortfolio(cutOffDate: string): ExecutivePortfolio {
  return buildExecutivePortfolio({
    cutOffDate,
    generatedAt: new Date().toISOString(),
    projects: [],
    compliance: [],
    deadlines: [],
    extensions: [],
    risks: [],
    milestones: [],
    lessons: [],
    users: [],
  });
}

export async function getExecutivePortfolio(cutOffDate = todayIso()): Promise<ExecutivePortfolio> {
  const db = await getDb();
  if (!db) return emptyPortfolio(cutOffDate);

  const [
    projectRows,
    deadlineRows,
    extensionRows,
    riskRows,
    milestoneRows,
    lessonRows,
    userRows,
    compliance,
  ] = await Promise.all([
    db.select().from(projects),
    db.select().from(stageDeadlines),
    db.select().from(stageDeadlineExtensions),
    db.select().from(risks),
    db.select().from(billingMilestones),
    db.select().from(lessonsLearned),
    db.select().from(users),
    getComplianceMetrics(),
  ]);

  const input: ExecutivePortfolioInput = {
    cutOffDate,
    generatedAt: new Date().toISOString(),
    projects: projectRows.map(row => ({
      id: row.id,
      projectName: row.projectName,
      clientName: row.clientName,
      dealId: row.dealId ?? null,
      projectType: row.projectType ?? null,
      status: row.status,
      currentStage: row.currentStage,
      pmId: row.pmId ?? null,
      totalAmount: row.totalAmount ?? null,
      currency: row.currency ?? null,
      startDate: row.startDate ?? null,
      endDate: row.endDate ?? null,
    })),
    compliance: compliance.details,
    deadlines: deadlineRows.map(row => ({
      stageId: row.stageId,
      maxBusinessDays: row.maxBusinessDays,
      label: row.label,
    })),
    extensions: extensionRows.map(row => ({
      projectId: row.projectId,
      stageId: row.stageId,
      type: row.type,
      extraDays: row.extraDays ?? 0,
    })),
    risks: riskRows.map(row => ({
      projectId: row.projectId,
      status: row.status ?? null,
      impact: row.impact,
      probability: row.probability,
      mitigation: row.mitigation ?? null,
      confirmed: row.confirmed,
    })),
    milestones: milestoneRows.map(row => ({
      projectId: row.projectId,
      amount: row.amount ?? null,
      currency: row.currency ?? null,
      dueDate: row.dueDate ?? null,
      status: row.status ?? null,
    })),
    lessons: lessonRows.map(row => ({
      projectId: row.projectId,
      finalScore: row.finalScore ?? null,
    })),
    users: userRows.map(row => ({ id: row.id, name: row.name ?? null })),
  };

  return buildExecutivePortfolio(input);
}
