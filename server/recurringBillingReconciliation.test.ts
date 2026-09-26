import { describe, expect, it } from "vitest";
import { reconcileRecurringBillingMonths } from "./recurringBillingReconciliation";

const services = [{ id: 2100001, dealId: "Deal2383" }];
const billingMonths = [
  { id: 1, serviceId: 2100001, monthNumber: 1, dueDate: "2026-06-06", amount: "94", currency: "USD", status: "pendiente" as const },
  { id: 2, serviceId: 2100001, monthNumber: 2, dueDate: "2026-07-06", amount: "94", currency: "USD", status: "pagado" as const },
  { id: 3, serviceId: 2100001, monthNumber: 3, dueDate: "2026-08-06", amount: "94", currency: "USD", status: "pendiente" as const },
];

const corporateBillingItems = [
  { id: 10, sourceKey: "source-1", dealId: "2383", milestoneName: "Mes 01", plannedDate: "2026-06-06", invoicedAt: "2026-06-20", amount: "100", currency: "UF", sourceActive: true },
  { id: 11, sourceKey: "source-2", dealId: "Deal2383", milestoneName: "Mes 03", plannedDate: "2026-08-06", invoicedAt: "2026-09-01", amount: "95", currency: "USD", sourceActive: true },
];

describe("reconcileRecurringBillingMonths", () => {
  it("preserva monto y moneda esperados y separa la factura corporativa", () => {
    const rows = reconcileRecurringBillingMonths({
      services,
      billingMonths,
      corporateBillingItems,
      cutOffDate: "2026-08-31",
    });

    expect(rows.map(row => row.status)).toEqual(["facturado", "facturado", "pendiente"]);
    expect(rows[0]).toMatchObject({
      amount: "94",
      currency: "USD",
      expectedAmount: "94",
      expectedCurrency: "USD",
      invoiceAmount: "100",
      invoiceCurrency: "UF",
      invoiceSource: "corporate_financial",
      invoiceDate: "2026-06-20",
      corporateSourceKey: "source-1",
      reconciliationStatus: "currency_and_amount_mismatch",
    });
    expect(rows[2].invoiceSource).toBe("schedule");
    expect(rows[0]).not.toHaveProperty("collected");
  });

  it("normaliza pagado histórico a facturado sin afirmar pago", () => {
    const [row] = reconcileRecurringBillingMonths({
      services,
      billingMonths: [billingMonths[1]],
      corporateBillingItems: [],
      cutOffDate: "2026-08-31",
    });

    expect(row).toMatchObject({
      status: "facturado",
      expectedAmount: "94",
      invoiceAmount: "94",
      invoiceCurrency: "USD",
      invoiceSource: "local_status",
      reconciliationStatus: "local_invoice_only",
      legacyPaidStatus: true,
    });
  });

  it("ignora facturas futuras o inactivas a la fecha de corte", () => {
    const [row] = reconcileRecurringBillingMonths({
      services,
      billingMonths: [billingMonths[2]],
      corporateBillingItems: [
        corporateBillingItems[1],
        { ...corporateBillingItems[1], id: 12, sourceKey: "source-3", invoicedAt: "2026-08-01", sourceActive: false },
      ],
      cutOffDate: "2026-08-31",
    });

    expect(row.status).toBe("pendiente");
    expect(row.reconciliationStatus).toBe("not_invoiced");
  });

  it("marca la conciliación ambigua cuando más de una factura coincide con la misma cuota", () => {
    const [row] = reconcileRecurringBillingMonths({
      services,
      billingMonths: [billingMonths[0]],
      corporateBillingItems: [
        corporateBillingItems[0],
        { ...corporateBillingItems[0], id: 13, sourceKey: "source-duplicate" },
      ],
      cutOffDate: "2026-08-31",
    });

    expect(row.reconciliationStatus).toBe("ambiguous");
    expect(row.matchedCorporateItemCount).toBe(2);
    expect(row.invoiceAmount).toBeNull();
  });
});
