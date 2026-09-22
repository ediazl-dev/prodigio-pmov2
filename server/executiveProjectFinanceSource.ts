import { eq } from "drizzle-orm";
import {
  billingMilestones,
  contracts,
  invoices,
  payments,
  paymentScheduleItems,
  revenueEvents,
} from "../drizzle/schema";
import { getDb } from "./db";
import {
  buildExecutiveProjectFinance,
  type ExecutiveMilestoneFinanceInput,
  type ExecutiveProjectFinance,
} from "./executiveProjectFinance";

type LoadExecutiveProjectFinanceInput = {
  projectId: number;
  dealId: string | null;
  cutoffDate: string;
  financial: Record<string, unknown> | null | undefined;
  financialSource: ExecutiveProjectFinance["source"];
  capturedAt?: Date | string | null;
  milestones: ExecutiveMilestoneFinanceInput[];
};

export async function loadExecutiveProjectFinance(input: LoadExecutiveProjectFinanceInput) {
  const db = await getDb();
  if (!db) {
    return buildExecutiveProjectFinance({
      ...input,
      billingMilestones: [],
      contracts: [],
      scheduleItems: [],
      revenueEvents: [],
      invoices: [],
      payments: [],
    });
  }

  const [projectBillingMilestones, allContracts, allScheduleItems, allRevenueEvents, allInvoices, allPayments] = await Promise.all([
    db.select().from(billingMilestones).where(eq(billingMilestones.projectId, input.projectId)),
    db.select().from(contracts),
    db.select().from(paymentScheduleItems),
    db.select().from(revenueEvents),
    db.select().from(invoices),
    db.select().from(payments),
  ]);

  return buildExecutiveProjectFinance({
    ...input,
    billingMilestones: projectBillingMilestones,
    contracts: allContracts,
    scheduleItems: allScheduleItems,
    revenueEvents: allRevenueEvents,
    invoices: allInvoices,
    payments: allPayments,
  });
}
