export type ExecutiveState = "VERDE" | "AMARILLO" | "NARANJO" | "ROJO" | "CRITICO" | "POR_CONFIRMAR";

export type GovernanceTriggerCode = "G-01" | "G-02" | "G-03" | "G-04" | "G-05" | "G-06" | "G-07";

export type CardinalMilestone = {
  code: string;
  baselineDate?: string | null;
  committedDate?: string | null;
  acceptedAt?: string | null;
  acceptanceEvidenceUrl?: string | null;
  isCritical?: boolean;
  billingWeight?: number | string | null;
  valueUf?: number | string | null;
};

export type ExecutiveFinancialInputs = {
  budgetCostUf?: number | null;
  executedCostUf?: number | null;
  saleValueUf?: number | null;
  targetMarginUf?: number | null;
  projectedMarginUf?: number | null;
  annualWacc?: number | null;
  blockedHeadcount?: number | null;
  dailyRateUf?: number | null;
  blockedDays?: number | null;
  penaltyUf?: number | null;
};

export type ExecutiveGovernanceInputs = {
  minutesCoveragePct?: number | null;
  commitmentCompliancePct?: number | null;
  hasValidRecoveryPlan?: boolean | null;
  consecutiveMinutesGap?: number | null;
  overdueP0Requirements?: number | null;
  recoveryPlanRequired?: boolean | null;
  recoveryPlanOverdue?: boolean | null;
  consecutiveRedVerdicts?: number | null;
};

export type ExecutiveOperationalInputs = {
  jiraProgressPct?: number | null;
  backlogConfidencePct?: number | null;
};

export type ExecutiveGovernanceInput = {
  cutoffDate: string;
  milestones: CardinalMilestone[];
  financial?: ExecutiveFinancialInputs | null;
  governance?: ExecutiveGovernanceInputs | null;
  operational?: ExecutiveOperationalInputs | null;
};

export type CardinalProgress = {
  totalMilestones: number;
  committedCount: number;
  acceptedCount: number;
  openOverdueCount: number;
  acceptedOnTimeCount: number;
  dueOnCutoffCount: number;
  chcT: number | null;
  chcG: number | null;
  expectedG: number | null;
  breachRate: number | null;
  otdH: number | null;
  spiH: number | null;
  drcDays: number | null;
};

export type FinancialImpact = {
  evCostUf: number | null;
  cpiH: number | null;
  costPerAcceptedMilestoneUf: number | null;
  cvUf: number | null;
  carryUf: number | null;
  cashUf: number | null;
  penaltyUf: number | null;
  totalDamageUf: number | null;
  costPerDayUf: number | null;
  eacFloorUf: number | null;
  eacCeilingUf: number | null;
  vacFloorUf: number | null;
  vacCeilingUf: number | null;
  terminalMarginFloorPct: number | null;
  terminalMarginCeilingPct: number | null;
  financialHealthNorm: number | null;
};

export type CommercialExposure = {
  acceptedBillingPct: number | null;
  mismatchPp: number | null;
  retainedUf: number | null;
};

export type GovernanceOutcome = {
  minutesCoveragePct: number | null;
  commitmentCompliancePct: number | null;
  governanceNorm: number | null;
  backlogConfidencePct: number | null;
  jiraBiasPp: number | null;
  penalties: number;
  ige: number | null;
  igeState: Exclude<ExecutiveState, "CRITICO" | "POR_CONFIRMAR"> | null;
  activeTriggers: GovernanceTriggerCode[];
  state: ExecutiveState;
};

export type ExecutiveGovernanceResult = {
  cutoffDate: string;
  contractual: CardinalProgress;
  financial: FinancialImpact;
  exposure: CommercialExposure;
  governance: GovernanceOutcome;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function fixed(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function numberOrNull(value: number | string | null | undefined) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function percentOrNull(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  return fixed(Math.max(0, Math.min(100, value)));
}

function dayStamp(value?: string | null) {
  if (!value) return null;
  const normalized = value.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) return null;
  const timestamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(timestamp) ? null : timestamp;
}

function effectiveDate(milestone: CardinalMilestone) {
  return milestone.committedDate ?? milestone.baselineDate ?? null;
}

/** La aceptación exige fecha y evidencia; Jira no puede producirla. */
export function isMilestoneAcceptedAtCutoff(milestone: CardinalMilestone, cutoffDate: string) {
  const acceptance = dayStamp(milestone.acceptedAt);
  const cutoff = dayStamp(cutoffDate);
  return Boolean(acceptance != null && cutoff != null && acceptance <= cutoff && milestone.acceptanceEvidenceUrl);
}

export function calculateCardinalProgress(milestones: CardinalMilestone[], cutoffDate: string): CardinalProgress {
  const cutoff = dayStamp(cutoffDate);
  if (cutoff == null) throw new Error("La fecha de corte debe usar formato ISO YYYY-MM-DD");

  const evidence = milestones.map((milestone) => ({
    milestone,
    effective: dayStamp(effectiveDate(milestone)),
    accepted: isMilestoneAcceptedAtCutoff(milestone, cutoffDate),
  }));
  const committed = evidence.filter((item) => item.effective != null && item.effective < cutoff);
  const accepted = committed.filter((item) => item.accepted);
  const overdue = committed.filter((item) => !item.accepted);
  const onTime = accepted.filter((item) => {
    const acceptedAt = dayStamp(item.milestone.acceptedAt);
    return acceptedAt != null && item.effective != null && acceptedAt <= item.effective;
  });
  const criticalOverdue = overdue.filter((item) => item.milestone.isCritical && item.effective != null);
  const drc = criticalOverdue.length
    ? Math.max(...criticalOverdue.map((item) => Math.floor((cutoff - (item.effective as number)) / DAY_MS)))
    : null;
  const total = milestones.length;
  const chcT = committed.length ? fixed((accepted.length / committed.length) * 100) : null;
  const chcG = total ? fixed((accepted.length / total) * 100) : null;
  const expectedG = total ? fixed((committed.length / total) * 100) : null;

  return {
    totalMilestones: total,
    committedCount: committed.length,
    acceptedCount: accepted.length,
    openOverdueCount: overdue.length,
    acceptedOnTimeCount: onTime.length,
    dueOnCutoffCount: evidence.filter((item) => item.effective === cutoff && !item.accepted).length,
    chcT,
    chcG,
    expectedG,
    breachRate: committed.length ? fixed((overdue.length / committed.length) * 100) : null,
    otdH: committed.length ? fixed((onTime.length / committed.length) * 100) : null,
    spiH: expectedG && expectedG > 0 && chcG != null ? fixed(chcG / expectedG) : null,
    drcDays: drc,
  };
}

/** Los pesos de facturación sólo se usan aquí, como exposición comercial. */
export function calculateCommercialExposure(milestones: CardinalMilestone[], cutoffDate: string, progress: CardinalProgress): CommercialExposure {
  const weights = milestones.map((milestone) => numberOrNull(milestone.billingWeight));
  const totalWeight = weights.every((weight) => weight != null) ? weights.reduce((total, weight) => total + (weight as number), 0) : null;
  const acceptedWeight = milestones.reduce((total, milestone) => {
    const weight = numberOrNull(milestone.billingWeight);
    return isMilestoneAcceptedAtCutoff(milestone, cutoffDate) && weight != null ? total + weight : total;
  }, 0);
  const acceptedBillingPct = totalWeight && totalWeight > 0 ? fixed((acceptedWeight / totalWeight) * 100) : null;
  const mismatchPp = acceptedBillingPct != null && progress.chcG != null ? fixed(acceptedBillingPct - progress.chcG) : null;

  const overdueValues = milestones
    .filter((milestone) => {
      const effective = dayStamp(effectiveDate(milestone));
      const cutoff = dayStamp(cutoffDate);
      return effective != null && cutoff != null && effective < cutoff && !isMilestoneAcceptedAtCutoff(milestone, cutoffDate);
    })
    .map((milestone) => numberOrNull(milestone.valueUf));
  const retainedUf = overdueValues.length && overdueValues.every((value) => value != null)
    ? fixed(overdueValues.reduce((total, value) => total + (value as number), 0))
    : null;

  return { acceptedBillingPct, mismatchPp, retainedUf };
}

export function calculateFinancialImpact(progress: CardinalProgress, exposure: CommercialExposure, financial?: ExecutiveFinancialInputs | null): FinancialImpact {
  const budget = numberOrNull(financial?.budgetCostUf);
  const executed = numberOrNull(financial?.executedCostUf);
  const sale = numberOrNull(financial?.saleValueUf);
  const evCostUf = budget != null && progress.chcG != null ? fixed((progress.chcG / 100) * budget) : null;
  const cpiH = evCostUf != null && executed != null && executed > 0 ? fixed(evCostUf / executed, 4) : null;
  const costPerAcceptedMilestoneUf = executed != null && progress.acceptedCount > 0 ? fixed(executed / progress.acceptedCount) : null;
  const cvUf = evCostUf != null && executed != null ? fixed(evCostUf - executed) : null;
  const blockedHeadcount = numberOrNull(financial?.blockedHeadcount);
  const dailyRate = numberOrNull(financial?.dailyRateUf);
  const blockedDays = numberOrNull(financial?.blockedDays);
  const carryUf = blockedHeadcount != null && dailyRate != null && blockedDays != null ? fixed(blockedHeadcount * dailyRate * blockedDays) : null;
  const wacc = numberOrNull(financial?.annualWacc);
  const cashUf = exposure.retainedUf != null && wacc != null && progress.drcDays != null
    ? fixed(exposure.retainedUf * wacc * progress.drcDays / 365)
    : null;
  const penaltyUf = numberOrNull(financial?.penaltyUf);
  const totalDamageUf = cvUf != null && carryUf != null && cashUf != null && penaltyUf != null
    ? fixed(Math.abs(cvUf) + carryUf + cashUf + penaltyUf)
    : null;
  const costPerDayUf = carryUf != null && cashUf != null && progress.drcDays != null && progress.drcDays > 0
    ? fixed((carryUf + cashUf) / progress.drcDays)
    : null;
  const eacFloorUf = executed != null && budget != null && evCostUf != null ? fixed(executed + (budget - evCostUf)) : null;
  const eacCeilingUf = budget != null && cpiH != null && cpiH > 0 ? fixed(budget / cpiH) : null;
  const vacFloorUf = budget != null && eacFloorUf != null ? fixed(budget - eacFloorUf) : null;
  const vacCeilingUf = budget != null && eacCeilingUf != null ? fixed(budget - eacCeilingUf) : null;
  const terminalMarginFloorPct = sale != null && sale > 0 && eacFloorUf != null ? fixed(((sale - eacFloorUf) / sale) * 100) : null;
  const terminalMarginCeilingPct = sale != null && sale > 0 && eacCeilingUf != null ? fixed(((sale - eacCeilingUf) / sale) * 100) : null;
  const targetMargin = numberOrNull(financial?.targetMarginUf);
  const projectedMargin = numberOrNull(financial?.projectedMarginUf);
  const cpiNorm = cpiH != null ? Math.min(1, Math.max(0, cpiH)) * 100 : null;
  const marginGapRelative = targetMargin != null && projectedMargin != null && Math.abs(targetMargin) > 0
    ? Math.min(1, Math.max(0, (targetMargin - projectedMargin) / Math.abs(targetMargin)))
    : null;
  const financialHealthNorm = cpiNorm != null && marginGapRelative != null
    ? fixed((0.6 * cpiNorm) + (0.4 * (1 - marginGapRelative) * 100))
    : null;

  return {
    evCostUf, cpiH, costPerAcceptedMilestoneUf, cvUf, carryUf, cashUf, penaltyUf, totalDamageUf, costPerDayUf,
    eacFloorUf, eacCeilingUf, vacFloorUf, vacCeilingUf, terminalMarginFloorPct, terminalMarginCeilingPct, financialHealthNorm,
  };
}

function stateFromIge(ige: number): Exclude<ExecutiveState, "CRITICO" | "POR_CONFIRMAR"> {
  if (ige >= 85) return "VERDE";
  if (ige >= 70) return "AMARILLO";
  if (ige >= 50) return "NARANJO";
  return "ROJO";
}

export function calculateExecutiveGovernance(input: ExecutiveGovernanceInput): ExecutiveGovernanceResult {
  const contractual = calculateCardinalProgress(input.milestones, input.cutoffDate);
  const exposure = calculateCommercialExposure(input.milestones, input.cutoffDate, contractual);
  const financial = calculateFinancialImpact(contractual, exposure, input.financial);
  const minutesCoveragePct = percentOrNull(input.governance?.minutesCoveragePct);
  const commitmentCompliancePct = percentOrNull(input.governance?.commitmentCompliancePct);
  const hasValidRecoveryPlan = input.governance?.hasValidRecoveryPlan;
  const governanceNorm = minutesCoveragePct != null && commitmentCompliancePct != null && hasValidRecoveryPlan != null
    ? fixed((0.5 * minutesCoveragePct) + (0.3 * commitmentCompliancePct) + (0.2 * (hasValidRecoveryPlan ? 100 : 0)))
    : null;
  const backlogConfidencePct = percentOrNull(input.operational?.backlogConfidencePct);
  const jiraProgressPct = percentOrNull(input.operational?.jiraProgressPct);
  const jiraBiasPp = jiraProgressPct != null && contractual.chcT != null ? fixed(jiraProgressPct - contractual.chcT) : null;
  const overdueP0Requirements = input.governance?.overdueP0Requirements ?? 0;
  const icbPenalty = backlogConfidencePct != null && backlogConfidencePct < 70 ? 10 * (70 - backlogConfidencePct) / 70 : 0;
  const biasPenalty = jiraBiasPp != null && jiraBiasPp > 15 ? 5 : 0;
  const p0Penalty = Math.max(0, overdueP0Requirements) * 5;
  const penalties = fixed(Math.min(icbPenalty + biasPenalty + p0Penalty, 15));
  const hasCompleteIgeInputs = contractual.chcT != null && contractual.chcG != null && financial.financialHealthNorm != null && governanceNorm != null;
  const ige = hasCompleteIgeInputs
    ? fixed(Math.max(0, Math.min(100, (0.4 * contractual.chcT!) + (0.15 * contractual.chcG!) + (0.25 * financial.financialHealthNorm!) + (0.2 * governanceNorm!) - penalties)))
    : null;
  const activeTriggers: GovernanceTriggerCode[] = [];
  if (financial.cpiH != null && financial.cpiH < 0.6) activeTriggers.push("G-01");
  if (input.financial?.executedCostUf != null && input.financial?.budgetCostUf != null && Number(input.financial.executedCostUf) > Number(input.financial.budgetCostUf) && contractual.chcT != null && contractual.chcT < 60) activeTriggers.push("G-02");
  if (contractual.drcDays != null && contractual.drcDays > 15) activeTriggers.push("G-03");
  if ((input.governance?.consecutiveMinutesGap ?? 0) >= 3) activeTriggers.push("G-04");
  if (input.governance?.recoveryPlanRequired && input.governance?.recoveryPlanOverdue) activeTriggers.push("G-05");
  if ((input.governance?.consecutiveRedVerdicts ?? 0) >= 2) activeTriggers.push("G-06");
  if (exposure.mismatchPp != null && exposure.mismatchPp > 20 && contractual.chcT != null && contractual.chcT < 70) activeTriggers.push("G-07");
  const igeState = ige == null ? null : stateFromIge(ige);
  const state: ExecutiveState = activeTriggers.length ? "CRITICO" : igeState ?? "POR_CONFIRMAR";

  return {
    cutoffDate: input.cutoffDate,
    contractual,
    financial,
    exposure,
    governance: { minutesCoveragePct, commitmentCompliancePct, governanceNorm, backlogConfidencePct, jiraBiasPp, penalties, ige, igeState, activeTriggers, state },
  };
}
