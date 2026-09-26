import { sameDeal } from "./projectFinancialIdentity";

export type RecurringBillingStatus = "pendiente" | "facturado" | "pagado";
export type RecurringBillingReconciliationStatus =
  | "matched"
  | "currency_mismatch"
  | "amount_mismatch"
  | "currency_and_amount_mismatch"
  | "local_invoice_only"
  | "not_invoiced"
  | "ambiguous";

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
  expectedAmount: string | number;
  expectedCurrency: string;
  expectedDueDate: string | null;
  invoiceAmount: string | number | null;
  invoiceCurrency: string | null;
  invoiceSource: "corporate_financial" | "local_status" | "schedule";
  invoiceDate: string | null;
  corporateSourceKey: string | null;
  reconciliationStatus: RecurringBillingReconciliationStatus;
  matchedCorporateItemCount: number;
  legacyPaidStatus: boolean;
};

function milestoneNumber(value: string): number | null {
  const match = value.match(/(?:mes|cuota)\s*0*(\d+)/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizedCurrency(value: string | null | undefined): string {
  const normalized = value?.trim().toUpperCase();
  return normalized || "N/D";
}

function numeric(value: string | number | null | undefined): number | null {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : null;
}

function eligibleInvoices(items: CorporateBillingItem[], dealId: string | null, cutOffDate: string) {
  if (!dealId) return [];
  return items
    .filter(item => item.sourceActive)
    .filter(item => item.invoicedAt !== null && item.invoicedAt <= cutOffDate)
    .filter(item => sameDeal(item.dealId, dealId))
    .sort((a, b) => (a.invoicedAt ?? "").localeCompare(b.invoicedAt ?? "") || a.sourceKey.localeCompare(b.sourceKey));
}

function candidatesForRow(invoices: CorporateBillingItem[], row: RecurringBillingScheduleRow) {
  const numbered = invoices.filter(item => milestoneNumber(item.milestoneName) === row.monthNumber);
  if (numbered.length > 0) return numbered;
  return row.dueDate ? invoices.filter(item => item.plannedDate === row.dueDate) : [];
}

function matchStatus(row: RecurringBillingScheduleRow, invoice: CorporateBillingItem): RecurringBillingReconciliationStatus {
  const expectedCurrency = normalizedCurrency(row.currency);
  const invoiceCurrency = normalizedCurrency(invoice.currency);
  const expectedAmount = numeric(row.amount);
  const invoiceAmount = numeric(invoice.amount);
  const currencyMismatch = expectedCurrency !== invoiceCurrency;
  const amountMismatch = expectedAmount !== null && invoiceAmount !== null && Math.abs(expectedAmount - invoiceAmount) > 0.01;
  if (currencyMismatch && amountMismatch) return "currency_and_amount_mismatch";
  if (currencyMismatch) return "currency_mismatch";
  if (amountMismatch) return "amount_mismatch";
  return "matched";
}

/**
 * Concilia sin destruir la programación contractual.
 * `amount`, `currency` y `dueDate` permanecen como fueron planificados; la factura
 * corporativa se expone en campos `invoice*` separados.
 */
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
    const candidates = candidatesForRow(invoices, row);
    const match = candidates.length === 1 ? candidates[0] : null;
    const legacyPaidStatus = row.status === "pagado";
    const expectedCurrency = normalizedCurrency(row.currency);

    if (match) {
      return {
        ...row,
        status: "facturado" as const,
        expectedAmount: row.amount,
        expectedCurrency,
        expectedDueDate: row.dueDate,
        invoiceAmount: match.amount,
        invoiceCurrency: normalizedCurrency(match.currency),
        invoiceNumber: row.invoiceNumber ?? match.sourceKey,
        invoiceSource: "corporate_financial" as const,
        invoiceDate: match.invoicedAt,
        corporateSourceKey: match.sourceKey,
        reconciliationStatus: matchStatus(row, match),
        matchedCorporateItemCount: 1,
        legacyPaidStatus,
      };
    }

    if (candidates.length > 1) {
      return {
        ...row,
        status: row.status === "facturado" || legacyPaidStatus ? "facturado" as const : "pendiente" as const,
        expectedAmount: row.amount,
        expectedCurrency,
        expectedDueDate: row.dueDate,
        invoiceAmount: null,
        invoiceCurrency: null,
        invoiceSource: row.status === "facturado" || legacyPaidStatus ? "local_status" as const : "schedule" as const,
        invoiceDate: null,
        corporateSourceKey: null,
        reconciliationStatus: "ambiguous" as const,
        matchedCorporateItemCount: candidates.length,
        legacyPaidStatus,
      };
    }

    if (row.status === "facturado" || legacyPaidStatus) {
      return {
        ...row,
        status: "facturado" as const,
        expectedAmount: row.amount,
        expectedCurrency,
        expectedDueDate: row.dueDate,
        invoiceAmount: row.amount,
        invoiceCurrency: expectedCurrency,
        invoiceSource: "local_status" as const,
        invoiceDate: null,
        corporateSourceKey: null,
        reconciliationStatus: "local_invoice_only" as const,
        matchedCorporateItemCount: 0,
        legacyPaidStatus,
      };
    }

    return {
      ...row,
      status: "pendiente" as const,
      expectedAmount: row.amount,
      expectedCurrency,
      expectedDueDate: row.dueDate,
      invoiceAmount: null,
      invoiceCurrency: null,
      invoiceSource: "schedule" as const,
      invoiceDate: null,
      corporateSourceKey: null,
      reconciliationStatus: "not_invoiced" as const,
      matchedCorporateItemCount: 0,
      legacyPaidStatus: false,
    };
  });
}
