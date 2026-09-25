import { desc } from "drizzle-orm";
import {
  financialBillingItems,
  financialData,
  financialSyncBatches,
  projects,
  recurringServices,
} from "../drizzle/schema";
import { getDb } from "./db";
import {
  buildFinancialPortfolioV2,
  type FinancialCompareMode,
  type FinancialGranularity,
  type FinancialLifecycle,
} from "./financialPortfolioV2";

export interface FinancialPortfolioV2Query {
  from: string;
  to: string;
  granularity?: FinancialGranularity;
  compareMode?: FinancialCompareMode;
  lifecycle?: "all" | FinancialLifecycle;
  client?: string | null;
  lineOfBusiness?: string | null;
  search?: string | null;
  page?: number;
  pageSize?: number;
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map(value => String(value ?? "").trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right, "es-CL"));
}

function yearFromDate(value: string | null | undefined): number | null {
  const match = String(value ?? "").match(/^(\d{4})-/);
  return match ? Number(match[1]) : null;
}

export async function loadFinancialPortfolioV2(query: FinancialPortfolioV2Query, database?: any) {
  const db = database ?? await getDb();
  if (!db) throw new Error("Base de datos no disponible");
  const page = Math.max(1, Math.trunc(query.page ?? 1));
  const pageSize = Math.min(100, Math.max(10, Math.trunc(query.pageSize ?? 20)));

  const [snapshots, billingItems, projectRows, serviceRows, latestBatchRows] = await Promise.all([
    db.select().from(financialData),
    db.select().from(financialBillingItems),
    db.select({
      id: projects.id,
      name: projects.projectName,
      clientName: projects.clientName,
      dealId: projects.dealId,
      status: projects.status,
    }).from(projects),
    db.select({
      id: recurringServices.id,
      name: recurringServices.serviceName,
      clientName: recurringServices.clientName,
      dealId: recurringServices.dealId,
      status: recurringServices.status,
    }).from(recurringServices),
    db.select().from(financialSyncBatches).orderBy(desc(financialSyncBatches.createdAt), desc(financialSyncBatches.id)).limit(1),
  ]);

  const operationalItems = [
    ...projectRows.map((row: any) => ({ ...row, kind: "project" as const })),
    ...serviceRows.map((row: any) => ({ ...row, kind: "service" as const })),
  ];
  const result = buildFinancialPortfolioV2({
    snapshots,
    billingItems,
    operationalItems,
    from: query.from,
    to: query.to,
    granularity: query.granularity,
    compareMode: query.compareMode,
    filters: {
      lifecycle: query.lifecycle,
      client: query.client,
      lineOfBusiness: query.lineOfBusiness,
      search: query.search,
    },
  });

  const total = result.items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;
  const activeSnapshots = snapshots.filter((row: any) => row.sourceActive !== false);
  const yearValues: number[] = billingItems
    .flatMap((item: any) => [yearFromDate(item.invoicedAt), yearFromDate(item.plannedDate)])
    .filter((year: number | null): year is number => year !== null);
  const availableYears = Array.from(new Set<number>(yearValues)).sort((left, right) => right - left);
  const latestBatch = latestBatchRows[0] ?? null;

  return {
    ...result,
    items: result.items.slice(offset, offset + pageSize),
    pagination: {
      page: safePage,
      pageSize,
      total,
      totalPages,
    },
    options: {
      clients: uniqueSorted(activeSnapshots.map((row: any) => row.clientName)),
      linesOfBusiness: uniqueSorted(activeSnapshots.map((row: any) => row.lineaNegocio)),
      availableYears,
    },
    source: latestBatch ? {
      batchId: latestBatch.id,
      workbookSha256: latestBatch.workbookSha256,
      syncedAt: latestBatch.createdAt,
      projectSourceRows: latestBatch.projectSourceRows,
      billingSourceRows: latestBatch.billingSourceRows,
      activeFinancialItems: latestBatch.activeFinancialItems,
      activeBillingItems: latestBatch.activeBillingItems,
      billingPeriodFrom: latestBatch.billingPeriodFrom,
      billingPeriodTo: latestBatch.billingPeriodTo,
    } : null,
  };
}
