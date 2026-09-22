import {
  calculatePortfolioFunnel,
  type ContractData,
  type InvoiceData,
  type PaymentData,
  type PaymentScheduleItemData,
  type RevenueEventData,
} from "./financialEngine";

export type ExecutiveMilestoneFinanceInput = {
  milestoneCode: string;
  title: string;
  billingWeight: string | number | null;
  jiraIssueKey?: string | null;
  acceptanceStatus?: string | null;
};

export type BillingMilestoneFinanceInput = {
  milestoneNumber: number;
  amount: string | number | null;
  currency: string | null;
  jiraIssueKey?: string | null;
};

export type ExecutiveMilestoneAmountSource =
  | "payment_schedule"
  | "billing_milestone"
  | "sale_weight"
  | "contract_weight"
  | "currency_blocked"
  | "missing";

export type ExecutiveProjectFinance = {
  currency: "UF";
  source: "snapshot" | "financial_sync" | "POR_CONFIRMAR";
  capturedAt: Date | string | null;
  overview: {
    contractedUf: number | null;
    contractedSource: "financial_sync" | "contract" | "missing";
    acceptedUf: number | null;
    milestoneAmountCoverage: { withAmount: number; total: number };
  };
  costs: {
    budgetUf: number | null;
    consumedUf: number | null;
    consumedPct: number | null;
    projectedCostUf: number | null;
    capacityUsedUf: number | null;
    capacityPlannedUf: number | null;
    capacityProjectedUf: number | null;
    otherCostsUf: number | null;
  };
  margin: {
    noteSaleUf: number | null;
    projectedUf: number | null;
    projectedPct: number | null;
    targetPct: number | null;
    gapPp: number | null;
  };
  billing: {
    available: boolean;
    contractCount: number;
    scheduleItemCount: number;
    revenueEventCount: number;
    invoiceCount: number;
    paymentCount: number;
    accruedUf: number | null;
    billedUf: number | null;
    collectedUf: number | null;
    wipUf: number | null;
    accountsReceivableUf: number | null;
    backlogUf: number | null;
  };
  milestones: Array<{
    milestoneCode: string;
    title: string;
    weightPct: number | null;
    weightSource: "field" | "title" | "missing";
    amountUf: number | null;
    amountSource: ExecutiveMilestoneAmountSource;
    accepted: boolean;
    acceptedAmountUf: number | null;
  }>;
  warnings: string[];
};

type FinancialRecord = Record<string, unknown> | null | undefined;

type BuildExecutiveProjectFinanceInput = {
  projectId: number;
  dealId: string | null;
  cutoffDate: string;
  financial: FinancialRecord;
  financialSource: ExecutiveProjectFinance["source"];
  capturedAt?: Date | string | null;
  milestones: ExecutiveMilestoneFinanceInput[];
  billingMilestones: BillingMilestoneFinanceInput[];
  contracts: ContractData[];
  scheduleItems: PaymentScheduleItemData[];
  revenueEvents: RevenueEventData[];
  invoices: InvoiceData[];
  payments: PaymentData[];
};

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizedDeal(value: unknown): string | null {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/^deal\s*/, "").replace(/\s+/g, "");
  return normalized || null;
}

function normalizedMilestoneCode(value: unknown): string {
  const normalized = String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const numbered = normalized.match(/^([A-Z]+)0*(\d+)$/);
  return numbered ? `${numbered[1]}${Number(numbered[2])}` : normalized;
}

function milestoneNumber(value: unknown): number | null {
  const match = String(value ?? "").match(/(\d+)$/);
  return match ? Number(match[1]) : null;
}

function isUf(value: unknown): boolean {
  return String(value ?? "").trim().toUpperCase() === "UF";
}

function resolveMilestoneWeight(milestone: ExecutiveMilestoneFinanceInput) {
  const explicit = finiteNumber(milestone.billingWeight);
  if (explicit != null && explicit > 0) return { value: explicit, source: "field" as const };
  const title = String(milestone.title ?? "");
  const pattern = /\((\d+(?:[.,]\d+)?)\s*%\)/g;
  let titleWeight: number | null = null;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(title)) !== null) titleWeight = finiteNumber(match[1]?.replace(",", "."));
  if (titleWeight != null && titleWeight > 0) return { value: titleWeight, source: "title" as const };
  if (explicit === 0) return { value: 0, source: "field" as const };
  return { value: null, source: "missing" as const };
}

function sumNullable(values: Array<number | null>): number | null {
  return values.every((value) => value != null)
    ? values.reduce<number>((sum, value) => sum + (value ?? 0), 0)
    : null;
}

export function buildExecutiveProjectFinance(input: BuildExecutiveProjectFinanceInput): ExecutiveProjectFinance {
  const financial = input.financial ?? {};
  const financialSaleUf = finiteNumber(financial.valorVentaUF);
  const normalizedInputDeal = normalizedDeal(input.dealId);
  const candidateContracts = input.contracts.filter((contract) =>
    contract.projectId === input.projectId
    || Boolean(normalizedInputDeal && normalizedDeal(contract.dealId) === normalizedInputDeal),
  );
  const blockedContracts = candidateContracts.filter((contract) => !isUf(contract.moneda));
  const matchedContracts = candidateContracts.filter((contract) => isUf(contract.moneda));
  const matchedContractIds = new Set(matchedContracts.map((contract) => contract.id));
  const matchedSchedule = input.scheduleItems.filter((item) => matchedContractIds.has(item.contractId));
  const matchedRevenue = input.revenueEvents.filter((item) => matchedContractIds.has(item.contractId));
  const matchedInvoices = input.invoices.filter((item) => matchedContractIds.has(item.contractId));
  const matchedInvoiceIds = new Set(matchedInvoices.map((invoice) => invoice.id));
  const matchedPayments = input.payments.filter((item) => matchedInvoiceIds.has(item.invoiceId));
  const billingFunnel = matchedContracts.length
    ? calculatePortfolioFunnel(matchedContracts, matchedSchedule, matchedRevenue, matchedInvoices, matchedPayments, input.cutoffDate)
    : null;
  const contractValueUf = billingFunnel?.contratado ?? null;
  const contractedUf = financialSaleUf ?? contractValueUf;
  const contractedSource = financialSaleUf != null ? "financial_sync" : contractValueUf != null ? "contract" : "missing";

  const scheduleByCode = new Map<string, PaymentScheduleItemData[]>();
  for (const item of matchedSchedule) {
    const code = normalizedMilestoneCode(item.milestoneCode);
    if (!code) continue;
    scheduleByCode.set(code, [...(scheduleByCode.get(code) ?? []), item]);
  }

  let titleDerivedWeights = 0;
  const milestoneFinance = input.milestones.map((milestone) => {
    const code = normalizedMilestoneCode(milestone.milestoneCode);
    const resolvedWeight = resolveMilestoneWeight(milestone);
    const weightPct = resolvedWeight.value;
    if (resolvedWeight.source === "title") titleDerivedWeights += 1;
    const scheduleCandidates = scheduleByCode.get(code) ?? [];
    const uniqueSchedule = scheduleCandidates.length === 1 ? scheduleCandidates[0] : null;
    const milestoneNo = milestoneNumber(milestone.milestoneCode);
    const billingCandidates = input.billingMilestones.filter((candidate) =>
      Boolean(milestone.jiraIssueKey && candidate.jiraIssueKey === milestone.jiraIssueKey)
      || Boolean(milestoneNo != null && candidate.milestoneNumber === milestoneNo),
    );
    const uniqueBilling = billingCandidates.length === 1 ? billingCandidates[0] : null;

    let amountUf: number | null = null;
    let amountSource: ExecutiveMilestoneAmountSource = "missing";
    const scheduleAmount = finiteNumber(uniqueSchedule?.valorUF);
    if (uniqueSchedule && scheduleAmount != null) {
      amountUf = scheduleAmount;
      amountSource = "payment_schedule";
    } else if (uniqueBilling) {
      const directAmount = finiteNumber(uniqueBilling.amount);
      if (directAmount != null && isUf(uniqueBilling.currency)) {
        amountUf = directAmount;
        amountSource = "billing_milestone";
      } else if (directAmount != null) {
        amountSource = "currency_blocked";
      }
    }

    if (amountUf == null && amountSource !== "currency_blocked" && weightPct != null && weightPct >= 0) {
      if (financialSaleUf != null) {
        amountUf = financialSaleUf * (weightPct / 100);
        amountSource = "sale_weight";
      } else if (contractValueUf != null) {
        amountUf = contractValueUf * (weightPct / 100);
        amountSource = "contract_weight";
      }
    }

    const accepted = String(milestone.acceptanceStatus ?? "").toLowerCase() === "accepted";
    return {
      milestoneCode: milestone.milestoneCode,
      title: milestone.title,
      weightPct,
      weightSource: resolvedWeight.source,
      amountUf,
      amountSource,
      accepted,
      acceptedAmountUf: accepted && amountUf != null ? amountUf : amountUf == null ? null : 0,
    };
  });

  const warnings: string[] = [];
  if (contractedUf == null) warnings.push("Monto contratado no disponible para el proyecto.");
  if (blockedContracts.length) warnings.push(`${blockedContracts.length} contrato(s) excluido(s) por moneda distinta o no informada; no se suman monedas.`);
  if (!billingFunnel) warnings.push("No existe contrato enlazado al proyecto o Deal; devengo, facturación y cobro permanecen N/D.");
  if (titleDerivedWeights) warnings.push(`${titleDerivedWeights} hito(s) recuperaron el peso desde su título contractual porque el campo numérico estaba en cero.`);
  const amountCoverage = milestoneFinance.filter((milestone) => milestone.amountUf != null).length;
  if (amountCoverage < milestoneFinance.length) warnings.push(`Monto disponible para ${amountCoverage} de ${milestoneFinance.length} hitos.`);
  if (financialSaleUf != null && contractValueUf != null && Math.abs(financialSaleUf - contractValueUf) > 0.01) {
    warnings.push("El valor de venta sincronizado difiere del contrato financiero registrado.");
  }

  const projectedMarginPct = finiteNumber(financial.margenProyectadoPorc);
  const targetPct = finiteNumber(financial.margenTargetPorc);
  return {
    currency: "UF",
    source: input.financialSource,
    capturedAt: input.capturedAt ?? null,
    overview: {
      contractedUf,
      contractedSource,
      acceptedUf: sumNullable(milestoneFinance.map((milestone) => milestone.acceptedAmountUf)),
      milestoneAmountCoverage: { withAmount: amountCoverage, total: milestoneFinance.length },
    },
    costs: {
      budgetUf: finiteNumber(financial.presupuestoUF),
      consumedUf: finiteNumber(financial.utilizadoUF),
      consumedPct: finiteNumber(financial.utilizadoUFPorc),
      projectedCostUf: finiteNumber(financial.costoProyectadoUF),
      capacityUsedUf: finiteNumber(financial.capacityU),
      capacityPlannedUf: finiteNumber(financial.planificadoUF),
      capacityProjectedUf: finiteNumber(financial.proyectadoUF),
      otherCostsUf: finiteNumber(financial.otrosCostosUF),
    },
    margin: {
      noteSaleUf: finiteNumber(financial.margenBrutoNotaVentaUF),
      projectedUf: finiteNumber(financial.margenProyectadoUF),
      projectedPct: projectedMarginPct,
      targetPct,
      gapPp: projectedMarginPct != null && targetPct != null ? (projectedMarginPct - targetPct) * 100 : null,
    },
    billing: {
      available: Boolean(billingFunnel),
      contractCount: matchedContracts.length,
      scheduleItemCount: matchedSchedule.length,
      revenueEventCount: matchedRevenue.length,
      invoiceCount: matchedInvoices.length,
      paymentCount: matchedPayments.length,
      accruedUf: billingFunnel?.devengado ?? null,
      billedUf: billingFunnel?.facturado ?? null,
      collectedUf: billingFunnel?.cobrado ?? null,
      wipUf: billingFunnel?.wip ?? null,
      accountsReceivableUf: billingFunnel?.ar ?? null,
      backlogUf: billingFunnel?.backlog ?? null,
    },
    milestones: milestoneFinance,
    warnings,
  };
}
