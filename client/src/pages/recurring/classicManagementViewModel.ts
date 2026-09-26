import type { RouterOutputs } from "@/lib/trpc";

export type DashboardV2Data = RouterOutputs["recurringServices"]["dashboardV2"];
export type ClassicKpisData = RouterOutputs["recurringServices"]["dashboardKpis"];

export type ClassicCurrencyRow = {
  currency: string;
  contracted: number;
  scheduled: number;
  invoiced: number;
  pending: number;
  overdue: number;
  invoicingProgress: number | null;
};

export type ClassicServiceRow = {
  serviceId: number;
  clientName: string;
  serviceName: string;
  status: string;
  currentStage: string;
  serviceType: string;
  finance: ClassicCurrencyRow[];
  incidents: {
    availability: string;
    total: number | null;
    resolved: number | null;
    open: number | null;
    criticalOpen: number | null;
    highOpen: number | null;
    overdueOpen: number | null;
  };
  sla: {
    configuredRules: number;
    firstResponseCompliance: number | null;
    resolutionCompliance: number | null;
  };
  penalties: { count: number; amount: number; currency: string };
};

export function buildClassicManagementModel(data: DashboardV2Data, legacy: ClassicKpisData) {
  const finance = Object.values(data.kpis.financeByCurrency)
    .map(row => ({
      currency: row.currency,
      contracted: row.contracted,
      scheduled: row.scheduled,
      invoiced: row.invoiced,
      pending: row.pending,
      overdue: row.overdue,
      invoicingProgress: row.scheduled > 0 ? Math.round((row.invoiced / row.scheduled) * 1000) / 10 : null,
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency));

  const penaltiesByService = new Map(
    legacy.servicesSummary.map(service => [service.id, {
      count: service.penaltiesCount,
      amount: service.penaltiesAmount,
      currency: service.currency,
    }]),
  );

  const services: ClassicServiceRow[] = data.matrix.map(service => {
    const serviceFinance = Object.values(service.financeByCurrency)
      .map(row => ({
        currency: row.currency,
        contracted: row.contracted,
        scheduled: row.scheduled,
        invoiced: row.invoiced,
        pending: row.pending,
        overdue: row.overdue,
        invoicingProgress: row.scheduled > 0 ? Math.round((row.invoiced / row.scheduled) * 1000) / 10 : null,
      }))
      .sort((a, b) => a.currency.localeCompare(b.currency));
    const total = service.incidents.total;
    const open = service.incidents.open;
    return {
      serviceId: service.serviceId,
      clientName: service.clientName,
      serviceName: service.serviceName,
      status: service.status,
      currentStage: service.currentStage,
      serviceType: service.serviceType,
      finance: serviceFinance,
      incidents: {
        availability: service.incidents.availability,
        total,
        resolved: total === null || open === null ? null : Math.max(0, total - open),
        open,
        criticalOpen: service.incidents.criticalOpen,
        highOpen: service.incidents.highOpen,
        overdueOpen: service.incidents.overdueOpen,
      },
      sla: {
        configuredRules: service.sla.configuredRules,
        firstResponseCompliance: service.sla.firstResponseCompliance,
        resolutionCompliance: service.sla.resolutionCompliance,
      },
      penalties: penaltiesByService.get(service.serviceId) ?? { count: 0, amount: 0, currency: serviceFinance[0]?.currency ?? "N/D" },
    };
  });

  const financeMonths = Array.from(new Set(data.trends.finance.map(row => row.month))).sort().slice(-6);
  const incidentMonths = data.operations.monthly.slice(-6);

  return {
    metadata: data.metadata,
    finance,
    financeMonthly: data.trends.finance.filter(row => financeMonths.includes(row.month)),
    incidentMonthly: incidentMonths,
    operations: data.operations,
    reports: data.kpis.reports,
    formalization: data.kpis.formalization,
    services,
    penalties: legacy.penalties,
    typeCounts: legacy.typeCounts,
    statusCounts: legacy.statusCounts,
  };
}

export function formatSlaMinutes(minutes: number | null): string {
  if (minutes === null) return "N/D";
  if (minutes < 60) return `${minutes} min`;
  if (minutes % 60 === 0) return `${minutes / 60} h`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}
