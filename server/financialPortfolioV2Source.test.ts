import { describe, expect, it, vi } from "vitest";
import { financialBillingItems, financialData, financialSyncBatches, projects, recurringServices } from "../drizzle/schema";
import { loadFinancialPortfolioV2 } from "./financialPortfolioV2Source";

describe("loadFinancialPortfolioV2", () => {
  it("carga fuentes locales, aplica filtros y expone lote/años/paginación", async () => {
    const snapshots = [
      { dealId: "Deal1", projectName: "Proyecto uno", clientName: "Cliente A", lineaNegocio: "Delivery", valorVentaUF: "100", sourceActive: true },
      { dealId: "Deal2", projectName: "Proyecto dos", clientName: "Cliente B", lineaNegocio: "Operaciones", valorVentaUF: "200", sourceActive: true },
      { dealId: "DealOld", projectName: "Obsoleto", clientName: "Cliente C", sourceActive: false },
    ];
    const billing = [
      { sourceKey: "b1", dealId: "Deal1", milestoneName: "M1", plannedDate: "2025-02-01", invoicedAt: "2025-02-10", amount: "10", currency: "UF", amountUsdSource: "400", billingStatus: "FACTURADO", sourceActive: true },
      { sourceKey: "b2", dealId: "Deal2", milestoneName: "M2", plannedDate: "2026-03-01", invoicedAt: "2026-03-10", amount: "20", currency: "UF", amountUsdSource: "800", billingStatus: "FACTURADO", sourceActive: true },
    ];
    const projectRows = [{ id: 1, name: "Proyecto uno", clientName: "Cliente A", dealId: "Deal1", status: "activo" }];
    const serviceRows: unknown[] = [];
    const latestBatch = [{
      id: 4,
      workbookSha256: "a".repeat(64),
      createdAt: new Date("2026-09-25T03:00:00Z"),
      projectSourceRows: 2,
      billingSourceRows: 2,
      activeFinancialItems: 2,
      activeBillingItems: 2,
      billingPeriodFrom: "2025-02-10",
      billingPeriodTo: "2026-03-10",
    }];
    const db = {
      select: vi.fn(() => ({
        from: (table: unknown) => {
          if (table === financialData) return Promise.resolve(snapshots);
          if (table === financialBillingItems) return Promise.resolve(billing);
          if (table === projects) return Promise.resolve(projectRows);
          if (table === recurringServices) return Promise.resolve(serviceRows);
          if (table === financialSyncBatches) return { orderBy: () => ({ limit: async () => latestBatch }) };
          return Promise.resolve([]);
        },
      })),
    };

    const result = await loadFinancialPortfolioV2({
      from: "2026-01-01",
      to: "2026-12-31",
      lifecycle: "all",
      page: 1,
      pageSize: 20,
    }, db);

    expect(result.pagination).toEqual({ page: 1, pageSize: 20, total: 2, totalPages: 1 });
    expect(result.options).toEqual({
      clients: ["Cliente A", "Cliente B"],
      linesOfBusiness: ["Delivery", "Operaciones"],
      availableYears: [2026, 2025],
    });
    expect(result.source).toMatchObject({ batchId: 4, projectSourceRows: 2, billingSourceRows: 2 });
    expect(result.items.find(item => item.financialId === "Deal1")?.lifecycle).toBe("open");
    expect(result.items.find(item => item.financialId === "Deal2")?.lifecycle).toBe("closed");
  });
});
