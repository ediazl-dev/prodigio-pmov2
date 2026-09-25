import { eq, notInArray } from "drizzle-orm";
import {
  financialBillingItems,
  financialData,
  financialSyncBatches,
  type InsertFinancialBillingItem,
  type InsertFinancialData,
} from "../drizzle/schema";
import { getDb } from "./db";

export interface ApplyFinancialWorkbookSnapshotInput {
  workbookSha256: string;
  projectSourceRows: number;
  billingSourceRows: number;
  financialRecords: InsertFinancialData[];
  billingRecords: InsertFinancialBillingItem[];
  billingPeriodFrom: string | null;
  billingPeriodTo: string | null;
}

export interface ApplyFinancialWorkbookSnapshotResult {
  batchId: number;
  financialInsert: number;
  financialUpdate: number;
  financialInactivated: number;
  billingInsert: number;
  billingUpdate: number;
  billingInactivated: number;
}

export async function applyFinancialWorkbookSnapshot(
  input: ApplyFinancialWorkbookSnapshotInput,
  database?: any,
): Promise<ApplyFinancialWorkbookSnapshotResult> {
  const db = database ?? await getDb();
  if (!db) throw new Error("DB not available");
  const appliedAt = new Date();

  return (db as any).transaction(async (tx: any) => {
    const existingFinancial: Array<{ dealId: string; sourceActive: boolean }> = await tx
      .select({ dealId: financialData.dealId, sourceActive: financialData.sourceActive })
      .from(financialData);
    const existingBilling: Array<{ sourceKey: string; sourceActive: boolean }> = await tx
      .select({ sourceKey: financialBillingItems.sourceKey, sourceActive: financialBillingItems.sourceActive })
      .from(financialBillingItems);

    const existingFinancialIds = new Set(existingFinancial.map(row => row.dealId));
    const existingBillingKeys = new Set(existingBilling.map(row => row.sourceKey));
    const incomingFinancialIds = new Set(input.financialRecords.map(row => row.dealId));
    const incomingBillingKeys = new Set(input.billingRecords.map(row => row.sourceKey));
    const financialInsert = input.financialRecords.filter(row => !existingFinancialIds.has(row.dealId)).length;
    const financialUpdate = input.financialRecords.length - financialInsert;
    const billingInsert = input.billingRecords.filter(row => !existingBillingKeys.has(row.sourceKey)).length;
    const billingUpdate = input.billingRecords.length - billingInsert;
    const financialInactivated = existingFinancial.filter(row => row.sourceActive && !incomingFinancialIds.has(row.dealId)).length;
    const billingInactivated = existingBilling.filter(row => row.sourceActive && !incomingBillingKeys.has(row.sourceKey)).length;

    const [batchInsert] = await tx.insert(financialSyncBatches).values({
      workbookSha256: input.workbookSha256,
      projectSourceRows: input.projectSourceRows,
      billingSourceRows: input.billingSourceRows,
      activeFinancialItems: input.financialRecords.length,
      activeBillingItems: input.billingRecords.length,
      financialInserted: financialInsert,
      financialUpdated: financialUpdate,
      financialInactivated,
      billingInserted: billingInsert,
      billingUpdated: billingUpdate,
      billingInactivated,
      billingPeriodFrom: input.billingPeriodFrom,
      billingPeriodTo: input.billingPeriodTo,
    });
    const batchId = Number(batchInsert.insertId);
    if (!Number.isInteger(batchId) || batchId <= 0) throw new Error("No fue posible identificar el lote financiero aplicado");

    for (const row of input.financialRecords) {
      const updateSet: Record<string, unknown> = {
        ...row,
        sourceActive: true,
        sourceBatchId: batchId,
        sourceLastSeenAt: appliedAt,
        syncedAt: appliedAt,
      };
      delete updateSet.id;
      delete updateSet.createdAt;
      delete updateSet.sourceFirstSeenAt;
      await tx
        .insert(financialData)
        .values({
          ...row,
          sourceActive: true,
          sourceBatchId: batchId,
          sourceFirstSeenAt: appliedAt,
          sourceLastSeenAt: appliedAt,
          syncedAt: appliedAt,
        })
        .onDuplicateKeyUpdate({ set: updateSet });
    }

    for (const row of input.billingRecords) {
      const updateSet: Record<string, unknown> = {
        ...row,
        sourceActive: true,
        sourceBatchId: batchId,
        sourceLastSeenAt: appliedAt,
        updatedAt: appliedAt,
      };
      delete updateSet.id;
      delete updateSet.createdAt;
      delete updateSet.sourceFirstSeenAt;
      await tx
        .insert(financialBillingItems)
        .values({
          ...row,
          sourceActive: true,
          sourceBatchId: batchId,
          sourceFirstSeenAt: appliedAt,
          sourceLastSeenAt: appliedAt,
        })
        .onDuplicateKeyUpdate({ set: updateSet });
    }

    if (input.financialRecords.length > 0) {
      await tx.update(financialData)
        .set({ sourceActive: false, updatedAt: appliedAt })
        .where(notInArray(financialData.dealId, Array.from(incomingFinancialIds)));
    }
    if (input.billingRecords.length > 0) {
      await tx.update(financialBillingItems)
        .set({ sourceActive: false, updatedAt: appliedAt })
        .where(notInArray(financialBillingItems.sourceKey, Array.from(incomingBillingKeys)));
    }

    // La tabla de lotes es inmutable; el update sólo reafirma los conteos calculados dentro de la misma transacción.
    await tx.update(financialSyncBatches).set({
      activeFinancialItems: input.financialRecords.length,
      activeBillingItems: input.billingRecords.length,
    }).where(eq(financialSyncBatches.id, batchId));

    return {
      batchId,
      financialInsert,
      financialUpdate,
      financialInactivated,
      billingInsert,
      billingUpdate,
      billingInactivated,
    };
  });
}
