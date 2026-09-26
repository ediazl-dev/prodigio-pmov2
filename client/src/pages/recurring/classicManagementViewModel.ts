import type { RouterOutputs } from "@/lib/trpc";

export type DashboardV2Data = RouterOutputs["recurringServices"]["dashboardV2"];
export type ClassicComparison = "monthly" | "cumulative";
export type ClassicWindow = "current_month" | "last_3_months" | "ytd" | "contract" | "custom";

export type ClassicDashboardControls = {
  cutOffDate: string;
  window: ClassicWindow;
  customFromDate: string;
  comparison: ClassicComparison;
  clientName: string;
  serviceType: string;
  status: string;
  onlyExceptions: boolean;
};

export const DEFAULT_CLASSIC_CONTROLS: ClassicDashboardControls = {
  cutOffDate: new Date().toISOString().slice(0, 10),
  window: "ytd",
  customFromDate: "",
  comparison: "monthly",
  clientName: "all",
  serviceType: "all",
  status: "activo",
  onlyExceptions: false,
};

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function deriveClassicFromDate(window: ClassicWindow, cutOffDate: string, customFromDate = ""): string | undefined {
  const cutOff = new Date(`${cutOffDate}T12:00:00.000Z`);
  if (!Number.isFinite(cutOff.getTime())) return undefined;
  if (window === "contract") return undefined;
  if (window === "custom") return customFromDate || undefined;
  if (window === "current_month") return `${cutOffDate.slice(0, 7)}-01`;
  if (window === "ytd") return `${cutOffDate.slice(0, 4)}-01-01`;
  const start = new Date(Date.UTC(cutOff.getUTCFullYear(), cutOff.getUTCMonth() - 2, 1, 12));
  return isoDate(start);
}

export type ClassicCurrencyRow = {
  currency: string;
  expectedToDate: number;
  expectedFuture: number;
  invoicedReal: number;
  comparableGap: number | null;
  comparableServices: number;
  blockedServices: Array<{ serviceId: number; clientName: string; serviceName: string }>;
  expectedContributors: DashboardV2Data["management"]["currencies"][number]["expectedContributors"];
  invoiceContributors: DashboardV2Data["management"]["currencies"][number]["invoiceContributors"];
};

export function buildClassicManagementModel(
  data: DashboardV2Data,
  options: { comparison?: ClassicComparison; onlyExceptions?: boolean } = {},
) {
  const comparison = options.comparison ?? "monthly";
  const management = data.management;
  const finance: ClassicCurrencyRow[] = management.currencies.map(row => {
    const blockedServices = management.services
      .filter(service => service.reconciliationStatus === "currency_mismatch")
      .filter(service => service.expectedCurrencies.includes(row.currency) || service.invoiceCurrencies.includes(row.currency))
      .map(service => ({ serviceId: service.serviceId, clientName: service.clientName, serviceName: service.serviceName }));
    const comparableServices = management.services.filter(service =>
      service.reconciliationStatus !== "currency_mismatch"
      && (service.expectedToDate[row.currency] ?? 0) > 0,
    );
    return {
      ...row,
      comparableGap: comparableServices.length > 0
        ? comparableServices.reduce((sum, service) => sum + (service.comparableGap[row.currency] ?? 0), 0)
        : null,
      comparableServices: comparableServices.length,
      blockedServices,
    };
  });

  const rawMonthly = data.trends.finance.map(row => ({
    month: row.month,
    currency: row.currency,
    expected: row.scheduled,
    future: row.future,
    invoiced: row.invoiced,
    pending: row.pending,
    overdue: row.overdue,
    expectedItems: row.expectedItems,
    invoiceItems: row.invoiceItems,
  }));
  const financeMonthly = comparison === "monthly"
    ? rawMonthly
    : Array.from(new Set(rawMonthly.map(row => row.currency))).flatMap(itemCurrency => {
        let expected = 0;
        let invoiced = 0;
        let pending = 0;
        let overdue = 0;
        return rawMonthly
          .filter(row => row.currency === itemCurrency)
          .sort((a, b) => a.month.localeCompare(b.month))
          .map(row => {
            expected += row.expected;
            invoiced += row.invoiced;
            pending += row.pending;
            overdue += row.overdue;
            return { ...row, expected, invoiced, pending, overdue };
          });
      });

  const visibleServices = options.onlyExceptions
    ? management.services.filter(service => service.exceptions.length > 0)
    : management.services;
  const statusCounts = management.services.reduce<Record<string, number>>((counts, service) => {
    counts[service.status] = (counts[service.status] ?? 0) + 1;
    return counts;
  }, { total: management.services.length });
  const typeCounts = management.services.reduce<Record<string, number>>((counts, service) => {
    counts[service.serviceType] = (counts[service.serviceType] ?? 0) + 1;
    return counts;
  }, {});
  const penaltiesByCurrency = new Map<string, { currency: string; count: number; amount: number }>();
  for (const service of management.services) {
    for (const penalty of service.penalties.byCurrency) {
      const current = penaltiesByCurrency.get(penalty.currency) ?? { currency: penalty.currency, count: 0, amount: 0 };
      current.count += penalty.count;
      current.amount += penalty.amount;
      penaltiesByCurrency.set(penalty.currency, current);
    }
  }

  return {
    metadata: data.metadata,
    sourceCuts: management.sourceCuts,
    summary: management.summary,
    finance,
    financeMonthly,
    operations: data.operations,
    services: visibleServices,
    allServices: management.services,
    exceptions: management.exceptions,
    statusCounts,
    typeCounts,
    governance: {
      deliverables: {
        planned: management.services.reduce((sum, service) => sum + service.deliverables.planned, 0),
        due: management.services.reduce((sum, service) => sum + service.deliverables.due, 0),
        delivered: management.services.reduce((sum, service) => sum + service.deliverables.delivered, 0),
        accepted: management.services.reduce((sum, service) => sum + service.deliverables.accepted, 0),
        overdue: management.services.reduce((sum, service) => sum + service.deliverables.overdue, 0),
        withoutDate: management.services.reduce((sum, service) => sum + service.deliverables.withoutDate, 0),
      },
      documents: {
        presentServices: management.services.filter(service => service.documents.present === service.documents.required).length,
        validServices: management.services.filter(service => service.documents.valid === service.documents.required).length,
        present: management.services.reduce((sum, service) => sum + service.documents.present, 0),
        valid: management.services.reduce((sum, service) => sum + service.documents.valid, 0),
        required: management.services.reduce((sum, service) => sum + service.documents.required, 0),
      },
      penalties: {
        count: management.summary.penalties,
        withEvidence: management.services.reduce((sum, service) => sum + service.penalties.withEvidence, 0),
        byCurrency: Array.from(penaltiesByCurrency.values()).sort((a, b) => a.currency.localeCompare(b.currency)),
      },
    },
  };
}

export function formatSlaMinutes(minutes: number | null): string {
  if (minutes === null) return "N/D";
  if (minutes < 60) return `${minutes} min`;
  if (minutes % 60 === 0) return `${minutes / 60} h`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}
