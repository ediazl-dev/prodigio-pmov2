import { describe, expect, it, vi } from "vitest";
import { financialBillingItems, financialData, financialSyncBatches } from "../drizzle/schema";
import { applyFinancialWorkbookSnapshot } from "./financialSyncRepository";

describe("applyFinancialWorkbookSnapshot", () => {
  it("aplica ambas hojas en una transacción y calcula inserciones, updates e inactivaciones", async () => {
    const insertedTables: unknown[] = [];
    const updatedTables: unknown[] = [];
    const tx = {
      select: vi.fn(() => ({
        from: vi.fn(async (table: unknown) => {
          if (table === financialData) return [
            { dealId: "Deal1", sourceActive: true },
            { dealId: "DealOld", sourceActive: true },
          ];
          if (table === financialBillingItems) return [
            { sourceKey: "bill-1", sourceActive: true },
            { sourceKey: "bill-old", sourceActive: true },
          ];
          return [];
        }),
      })),
      insert: vi.fn((table: unknown) => ({
        values: vi.fn((row: Record<string, unknown>) => {
          insertedTables.push(table);
          if (table === financialSyncBatches) return Promise.resolve([{ insertId: 77 }]);
          return { onDuplicateKeyUpdate: vi.fn(async () => row) };
        }),
      })),
      update: vi.fn((table: unknown) => ({
        set: vi.fn(() => ({
          where: vi.fn(async () => {
            updatedTables.push(table);
          }),
        })),
      })),
    };
    const database = { transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)) };

    const result = await applyFinancialWorkbookSnapshot({
      workbookSha256: "a".repeat(64),
      projectSourceRows: 2,
      billingSourceRows: 2,
      billingPeriodFrom: "2024-01-01",
      billingPeriodTo: "2026-09-01",
      financialRecords: [{ dealId: "Deal1" }, { dealId: "Deal2" }],
      billingRecords: [
        { sourceKey: "bill-1", dealId: "Deal1", milestoneName: "M1" },
        { sourceKey: "bill-2", dealId: "Deal2", milestoneName: "M2" },
      ],
    }, database);

    expect(database.transaction).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      batchId: 77,
      financialInsert: 1,
      financialUpdate: 1,
      financialInactivated: 1,
      billingInsert: 1,
      billingUpdate: 1,
      billingInactivated: 1,
    });
    expect(insertedTables.filter(table => table === financialSyncBatches)).toHaveLength(1);
    expect(insertedTables.filter(table => table === financialData)).toHaveLength(2);
    expect(insertedTables.filter(table => table === financialBillingItems)).toHaveLength(2);
    expect(updatedTables).toContain(financialData);
    expect(updatedTables).toContain(financialBillingItems);
    expect(updatedTables).toContain(financialSyncBatches);
  });

  it("no confirma escrituras si cualquier operación falla", async () => {
    let committed = false;
    const database = {
      transaction: vi.fn(async () => {
        throw new Error("simulated transaction rollback");
      }),
    };
    await expect(applyFinancialWorkbookSnapshot({
      workbookSha256: "b".repeat(64),
      projectSourceRows: 1,
      billingSourceRows: 1,
      billingPeriodFrom: null,
      billingPeriodTo: null,
      financialRecords: [{ dealId: "Deal1" }],
      billingRecords: [{ sourceKey: "bill-1", dealId: "Deal1", milestoneName: "M1" }],
    }, database)).rejects.toThrow(/rollback/);
    expect(committed).toBe(false);
  });
});
