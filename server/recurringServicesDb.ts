/**
 * DB helpers for Recurring Services module.
 * Follows same patterns as server/db.ts — returns raw Drizzle rows.
 */
import { eq, and, desc, asc } from "drizzle-orm";
import {
  recurringServices, InsertRecurringService,
  recurringServiceBillingMonths, InsertRecurringServiceBillingMonth,
  recurringServiceDocuments, InsertRecurringServiceDocument,
  recurringServiceStages,
  recurringServiceWorkPlan, InsertRecurringServiceWorkPlanItem,
  recurringServiceSlaConfig, InsertRecurringServiceSlaConfigItem,
  recurringServicePenalties, InsertRecurringServicePenalty,
  recurringServiceAiAnalyses, InsertRecurringServiceAiAnalysis,
} from "../drizzle/schema";
import { getDb } from "./db";

// ─── Service CRUD ────────────────────────────────────────────────────────────

const STAGE_ORDER = ["inicializacion", "plan_trabajo", "jira_setup", "ejecucion", "cierre"] as const;

export async function listRecurringServices(filters?: { status?: string; serviceType?: string }) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(recurringServices).orderBy(desc(recurringServices.createdAt));
  let result = rows;
  if (filters?.status) result = result.filter((r: any) => r.status === filters.status);
  if (filters?.serviceType) result = result.filter((r: any) => r.serviceType === filters.serviceType);
  return result;
}

export async function getRecurringServiceById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(recurringServices).where(eq(recurringServices.id, id));
  return row ?? null;
}

export async function createRecurringService(data: InsertRecurringService) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(recurringServices).values(data);
  const serviceId = Number(result.insertId);
  // Create the 5 stage records
  const stages = STAGE_ORDER.map((stageId, idx) => ({
    serviceId,
    stageId: stageId as any,
    status: (idx === 0 ? "in_progress" : "locked") as any,
  }));
  await db.insert(recurringServiceStages).values(stages);
  return serviceId;
}

export async function updateRecurringService(id: number, data: Partial<InsertRecurringService>) {
  const db = await getDb();
  if (!db) return;
  await db.update(recurringServices).set(data).where(eq(recurringServices.id, id));
}

// ─── Stages ──────────────────────────────────────────────────────────────────

export async function getRecurringServiceStages(serviceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(recurringServiceStages)
    .where(eq(recurringServiceStages.serviceId, serviceId))
    .orderBy(asc(recurringServiceStages.id));
}

export async function getRecurringServiceStage(serviceId: number, stageId: string) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(recurringServiceStages)
    .where(and(eq(recurringServiceStages.serviceId, serviceId), eq(recurringServiceStages.stageId, stageId as any)));
  return row ?? null;
}

export async function completeRecurringStage(serviceId: number, stageId: string, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(recurringServiceStages)
    .set({ status: "completed" as any, completedAt: new Date(), completedBy: userId })
    .where(and(eq(recurringServiceStages.serviceId, serviceId), eq(recurringServiceStages.stageId, stageId as any)));

  // Unlock next stage
  const idx = STAGE_ORDER.indexOf(stageId as any);
  if (idx >= 0 && idx < STAGE_ORDER.length - 1) {
    const nextStage = STAGE_ORDER[idx + 1];
    await db.update(recurringServiceStages)
      .set({ status: "in_progress" as any })
      .where(and(eq(recurringServiceStages.serviceId, serviceId), eq(recurringServiceStages.stageId, nextStage)));
    await db.update(recurringServices).set({ currentStage: nextStage as any }).where(eq(recurringServices.id, serviceId));
  }
}

// ─── Billing Months ──────────────────────────────────────────────────────────

export async function getBillingMonths(serviceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(recurringServiceBillingMonths)
    .where(eq(recurringServiceBillingMonths.serviceId, serviceId))
    .orderBy(asc(recurringServiceBillingMonths.monthNumber));
}

export async function saveBillingMonths(serviceId: number, months: InsertRecurringServiceBillingMonth[]) {
  const db = await getDb();
  if (!db) return;
  await db.delete(recurringServiceBillingMonths).where(eq(recurringServiceBillingMonths.serviceId, serviceId));
  if (months.length > 0) {
    await db.insert(recurringServiceBillingMonths).values(months);
  }
  const total = months.reduce((sum, m) => sum + parseFloat(String(m.amount)), 0);
  await db.update(recurringServices).set({ totalContractAmount: String(total) as any }).where(eq(recurringServices.id, serviceId));
}

export async function updateBillingMonthStatus(id: number, status: string, invoiceNumber?: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(recurringServiceBillingMonths)
    .set({ status: status as any, invoiceNumber })
    .where(eq(recurringServiceBillingMonths.id, id));
}

export async function updateBillingMonthJiraKey(id: number, jiraIssueKey: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(recurringServiceBillingMonths)
    .set({ jiraIssueKey })
    .where(eq(recurringServiceBillingMonths.id, id));
}

// ─── Documents ───────────────────────────────────────────────────────────────

export async function getServiceDocuments(serviceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(recurringServiceDocuments)
    .where(eq(recurringServiceDocuments.serviceId, serviceId))
    .orderBy(desc(recurringServiceDocuments.uploadedAt));
}

export async function insertServiceDocument(data: InsertRecurringServiceDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(recurringServiceDocuments).values(data);
  return Number(result.insertId);
}

export async function deleteServiceDocument(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(recurringServiceDocuments).where(eq(recurringServiceDocuments.id, id));
}

// ─── Work Plan ───────────────────────────────────────────────────────────────

export async function getWorkPlanItems(serviceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(recurringServiceWorkPlan)
    .where(eq(recurringServiceWorkPlan.serviceId, serviceId))
    .orderBy(asc(recurringServiceWorkPlan.sortOrder), asc(recurringServiceWorkPlan.monthNumber));
}

export async function insertWorkPlanItem(data: InsertRecurringServiceWorkPlanItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(recurringServiceWorkPlan).values(data);
  return Number(result.insertId);
}

export async function updateWorkPlanItem(id: number, data: Partial<InsertRecurringServiceWorkPlanItem>) {
  const db = await getDb();
  if (!db) return;
  await db.update(recurringServiceWorkPlan).set(data).where(eq(recurringServiceWorkPlan.id, id));
}

export async function deleteWorkPlanItem(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(recurringServiceWorkPlan).where(eq(recurringServiceWorkPlan.id, id));
}

export async function bulkInsertWorkPlanItems(items: InsertRecurringServiceWorkPlanItem[]) {
  const db = await getDb();
  if (!db || items.length === 0) return;
  await db.insert(recurringServiceWorkPlan).values(items);
}

export async function updateWorkPlanItemJiraKey(id: number, jiraIssueKey: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(recurringServiceWorkPlan).set({ jiraIssueKey }).where(eq(recurringServiceWorkPlan.id, id));
}

// ─── SLA Config ──────────────────────────────────────────────────────────────

export async function getSlaConfig(serviceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(recurringServiceSlaConfig)
    .where(eq(recurringServiceSlaConfig.serviceId, serviceId))
    .orderBy(asc(recurringServiceSlaConfig.id));
}

export async function saveSlaConfig(serviceId: number, items: InsertRecurringServiceSlaConfigItem[]) {
  const db = await getDb();
  if (!db) return;
  await db.delete(recurringServiceSlaConfig).where(eq(recurringServiceSlaConfig.serviceId, serviceId));
  if (items.length > 0) {
    await db.insert(recurringServiceSlaConfig).values(items);
  }
}

// ─── Penalties ───────────────────────────────────────────────────────────────

export async function getPenalties(serviceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(recurringServicePenalties)
    .where(eq(recurringServicePenalties.serviceId, serviceId))
    .orderBy(desc(recurringServicePenalties.createdAt));
}

export async function insertPenalty(data: InsertRecurringServicePenalty) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(recurringServicePenalties).values(data);
  return Number(result.insertId);
}

export async function updatePenaltyJiraKey(id: number, jiraIssueKey: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(recurringServicePenalties).set({ jiraIssueKey }).where(eq(recurringServicePenalties.id, id));
}

export async function updatePenaltyStatus(id: number, status: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(recurringServicePenalties).set({ status: status as any }).where(eq(recurringServicePenalties.id, id));
}

// ─── Bulk delete helpers ─────────────────────────────────────────────────────

export async function deleteAllWorkPlanItems(serviceId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(recurringServiceWorkPlan).where(eq(recurringServiceWorkPlan.serviceId, serviceId));
}

export async function deleteAllSlaConfig(serviceId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(recurringServiceSlaConfig).where(eq(recurringServiceSlaConfig.serviceId, serviceId));
}

// ─── AI Analysis History ────────────────────────────────────────────────────

export async function insertAiAnalysis(data: InsertRecurringServiceAiAnalysis) {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.insert(recurringServiceAiAnalyses).values(data);
  return Number(result.insertId);
}

export async function getLatestAiAnalysis(serviceId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(recurringServiceAiAnalyses)
    .where(eq(recurringServiceAiAnalyses.serviceId, serviceId))
    .orderBy(desc(recurringServiceAiAnalyses.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getAiAnalysisHistory(serviceId: number, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(recurringServiceAiAnalyses)
    .where(eq(recurringServiceAiAnalyses.serviceId, serviceId))
    .orderBy(desc(recurringServiceAiAnalyses.createdAt))
    .limit(limit);
}

// ─── Dashboard KPIs ─────────────────────────────────────────────────────────

export async function getDashboardKpisData() {
  const db = await getDb();
  if (!db) return { services: [], billingMonths: [], slaConfigs: [], penalties: [] };

  const [services, billingMonths, slaConfigs, penalties] = await Promise.all([
    db.select().from(recurringServices).orderBy(desc(recurringServices.createdAt)),
    db.select().from(recurringServiceBillingMonths).orderBy(asc(recurringServiceBillingMonths.dueDate)),
    db.select().from(recurringServiceSlaConfig),
    db.select().from(recurringServicePenalties),
  ]);

  return { services, billingMonths, slaConfigs, penalties };
}
