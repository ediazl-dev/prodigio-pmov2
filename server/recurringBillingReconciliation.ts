import { sameDeal } from "./projectFinancialIdentity";

export type RecurringBillingStatus = "pendiente" | "facturado" | "pagado";

export interface RecurringBillingScheduleRow {
  id: number;
  serviceId: number;
  monthNumber: number;
  dueDate: string | null;
  amount: string | number;
  currency: string | null;
  status: RecurringBillingStatus;
  invoiceNumber?: string | null;
}

export interface RecurringServiceBillingIdentity {
  id: number;
  dealId: string | null;
}

export interface CorporateBillingItem {
  id: number;
  sourceKey: string;
  dealId: string;
  milestoneName: string;
  plannedDate: string | null;
  invoicedAt: string | null;
  amount: string | number | null;
  currency: string | null;
  billingStatus?: string | null;
  sourceActive: boolean;
}

export type ReconciledRecurringBillingRow<T extends RecurringBillingScheduleRow> = Omit<T, "status"> & {
  status: "pendiente" | "facturado";
  invoiceSource: "corporate_financial" | "local_status" | "schedule";
  invoiceDate: string | null;
  corporateSourceKey: string | null;
  legacyPaidStatus: boolean;
};

function milestoneNumber(value: string): number | null {
  const match = value.match(/(?:mes|cuota)\s*0*(\d+)/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizedCurrency(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase();
  return normalized || null;
}

function eligibleInvoices(items: CorporateBillingItem[], dealId: string | null, cutOffDate: string) {
  if (!dealId) return [];
  return items
    .filter(item => item.sourceActive)
    .filter(item => item.invoicedAt !== null && item.invoicedAt <= cutOffDate)
    .filter(item => sameDeal(item.dealId, dealId))
    .sort((a, b) => (a.invoicedAt ?? "").localeCompare(b.invoicedAt ?? "") || a.sourceKey.localeCompare(b.sourceKey));
}

export function reconcileRecurringBillingMonths<T extends RecurringBillingScheduleRow>(input: {
  services: RecurringServiceBillingIdentity[];
  billingMonths: T[];
  corporateBillingItems: CorporateBillingItem[];
  cutOffDate: string;
}): Array<ReconciledRecurringBillingRow<T>> {
  const serviceById = new Map(input.services.map(service => [service.id, service]));

  return input.billingMonths.map(row => {
    const service = serviceById.get(row.serviceId);
    const invoices = eligibleInvoices(input.corporateBillingItems, service?.dealId ?? null, input.cutOffDate);
    const numbered = invoices.filter(item => milestoneNumber(item.milestoneName) === row.monthNumber);
    const byPlannedDate = row.dueDate
      ? invoices.filter(item => item.plannedDate === row.dueDate)
      : [];
    const match = numbered.length === 1 ? numbered[0] : numbered.length === 0 && byPlannedDate.length === 1 ? byPlannedDate[0] : null;
    const legacyPaidStatus = row.status === "pagado";

    if (match) {
      const corporateAmount = Number(match.amount);
      const amount = Number.isFinite(corporateAmount) && corporateAmount > 0 ? match.amount! : row.amount;
      return {
        ...row,
        amount,
        currency: normalizedCurrency(match.currency) ?? row.currency,
        status: "facturado" as const,
        invoiceNumber: row.invoiceNumber ?? match.sourceKey,
        invoiceSource: "corporate_financial" as const,
        invoiceDate: match.invoicedAt,
        corporateSourceKey: match.sourceKey,
        legacyPaidStatus,
      };
    }

    if (row.status === "facturado" || legacyPaidStatus) {
      return {
        ...row,
        status: "facturado" as const,
        invoiceSource: "local_status" as const,
        invoiceDate: null,
        corporateSourceKey: null,
        legacyPaidStatus,
      };
    }

    return {
      ...row,
      status: "pendiente" as const,
      invoiceSource: "schedule" as const,
      invoiceDate: null,
      corporateSourceKey: null,
      legacyPaidStatus: false,
    };
  });
}
