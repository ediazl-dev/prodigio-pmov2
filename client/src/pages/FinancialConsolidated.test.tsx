import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ queryInputs: [] as unknown[] }));

const data = {
  period: { from: "2026-01-01", to: "2026-09-25" },
  comparisonPeriod: { from: "2025-01-01", to: "2025-09-25" },
  granularity: "month",
  compareMode: "prior_year",
  sourceWindow: { from: "2023-06-16", to: "2026-09-21" },
  coverage: { financialItems: 46, billingItems: 306, billingItemsWithComparableUsd: 305, billingItemsWithInvoiceDate: 253, activeSourceItems: 43 },
  lifecycle: { total: 43, open: 5, closed: 34, internal: 4 },
  portfolio: {
    selectedContractedUF: 110900.91, selectedProjectedCostUF: 53117.42, selectedProjectedMarginUF: 50982.31, commercialContractedUF: 106320.91,
    openContractedUF: 16794.33, closedContractedUF: 89526.58, internalInvestmentUF: 4580, openProjectedCostUF: 9383.46, openProjectedMarginUF: 5349.86,
  },
  current: {
    billedNative: { UF: 15134.9, USD: 174000 }, billedUsdComparable: 776307.24, billedItems: 60, billedDeals: 16, billedClients: 12,
    overdueAtCutoffNative: { UF: 4688.6, USD: 140375 }, overdueAtCutoffItems: 26,
    topClients: [{ client: "Tanner", amountUsdComparable: 293693.88, nativeAmounts: { UF: 7380 }, sharePct: 37.83, billedItems: 8 }],
  },
  comparison: {
    billedNative: { UF: 30000 }, billedUsdComparable: 1597021.43, billedItems: 104, billedDeals: 20, billedClients: 15,
    overdueAtCutoffNative: {}, overdueAtCutoffItems: 0, topClients: [],
  },
  change: { billedUsdAbsolute: -820714.19, billedUsdPct: -51.39, billedItemsAbsolute: -44 },
  series: [{ key: "2026-01", label: "ene 2026", billedUsdComparable: 60657.15, billedNative: { UF: 896 }, plannedNative: { UF: 2895 }, billedItems: 4, plannedItems: 14 }],
  deviations: {
    costOverruns: [{ financialId: "Deal1934", clientName: "Tanner", projectName: "Tanner SFA", budgetDeltaUF: 3277.76 }],
    marginGaps: [{ financialId: "Deal1934", clientName: "Tanner", projectName: "Tanner SFA", marginGapPp: -39.97 }],
  },
  items: [
    {
      financialId: "Deal1934", clientName: "Tanner", projectName: "Tanner SFA", lineOfBusiness: "Delivery", pm: "Eduardo", lifecycle: "open", lifecycleSource: "project_active", operationalLinks: [],
      contractedUF: 8200, budgetUF: 2050, consumedUF: 2450.77, projectedCostUF: 5327.76, budgetDeltaUF: 3277.76, projectedMarginUF: 2872.23, projectedMarginPct: 0.3502, marginTargetPct: 0.75, marginGapPp: -39.97,
      billedRangeNative: { UF: 7380 }, billedRangeUsdComparable: 293693.88, billedHistoricalNative: { UF: 7380 }, overdueAtCutoffNative: { UF: 820 }, overdueAtCutoffCount: 2,
      nextMilestone: null, billingItemCount: 10, sourceActive: true, syncedAt: "2026-09-25T09:39:11Z",
    },
    {
      financialId: "Deal4532", clientName: "MaxAgro", projectName: "Assessment MaxAgro", lineOfBusiness: "Delivery", pm: "Eduardo", lifecycle: "closed", lifecycleSource: "project_closed", operationalLinks: [],
      contractedUF: 552, budgetUF: 315, consumedUF: 401.06, projectedCostUF: 401.06, budgetDeltaUF: 86.06, projectedMarginUF: 150.93, projectedMarginPct: 0.2734, marginTargetPct: 0.4293, marginGapPp: -15.59,
      billedRangeNative: { UF: 552 }, billedRangeUsdComparable: 21967.35, billedHistoricalNative: { UF: 552 }, overdueAtCutoffNative: {}, overdueAtCutoffCount: 0,
      nextMilestone: null, billingItemCount: 4, sourceActive: true, syncedAt: "2026-09-25T09:39:11Z",
    },
  ],
  pagination: { page: 1, pageSize: 20, total: 43, totalPages: 3 },
  options: { clients: ["CCLA", "MaxAgro", "Tanner"], linesOfBusiness: ["Delivery", "Operaciones"], availableYears: [2027, 2026, 2025, 2024, 2023] },
  source: { batchId: 1, syncedAt: "2026-09-25T09:39:11Z", activeBillingItems: 306 },
};

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 1, role: "admin" } }) }));
vi.mock("@/lib/trpc", () => ({
  trpc: { portfolioConsole: { getFinancialPortfolioV2: { useQuery: (input: unknown) => { mocks.queryInputs.push(input); return { data, isLoading: false, isFetching: false, error: null }; } } } },
}));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ComposedChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Line: () => null,
  CartesianGrid: () => null,
  Cell: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

import FinancialConsolidated from "./FinancialConsolidated";

describe("FinancialConsolidated v2", () => {
  beforeEach(() => { mocks.queryInputs.length = 0; });
  afterEach(() => cleanup());

  it("muestra ventana, cliente líder y facturación histórica de un cerrado", () => {
    const { container } = render(<FinancialConsolidated />);
    expect(screen.getByText("Facturación, costos y margen con historia verificable")).toBeTruthy();
    expect(screen.getAllByText(/01 ene 2026/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Tanner").length).toBeGreaterThan(0);
    expect(container.textContent).toContain("37,8% del comparable");
    expect(screen.getAllByText("Assessment MaxAgro").length).toBeGreaterThan(0);
    expect(screen.getAllByText("UF 552").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Estado respaldado por gestión").length).toBeGreaterThan(0);
  });

  it("envía filtros de año, lifecycle y cliente al endpoint paginado", () => {
    render(<FinancialConsolidated />);
    fireEvent.change(screen.getByLabelText("Período"), { target: { value: "2025" } });
    fireEvent.change(screen.getByLabelText("Ciclo de vida"), { target: { value: "closed" } });
    fireEvent.change(screen.getByLabelText("Cliente"), { target: { value: "Tanner" } });
    const latest = mocks.queryInputs.at(-1) as Record<string, unknown>;
    expect(latest).toMatchObject({ from: "2025-01-01", to: "2025-12-31", lifecycle: "closed", client: "Tanner", page: 1, pageSize: 20 });
  });
});
