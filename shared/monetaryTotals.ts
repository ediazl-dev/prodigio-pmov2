export interface MonetaryItem {
  amount?: string | number | null;
  currency?: string | null;
}

export interface MonetaryTotalsSummary {
  totals: Record<string, number>;
  entries: Array<[string, number]>;
  hasMissingCurrency: boolean;
  hasInvalidAmount: boolean;
  isSingleCurrency: boolean;
  isMultiCurrency: boolean;
}

export function summarizeMonetaryItems(items: MonetaryItem[]): MonetaryTotalsSummary {
  const totals: Record<string, number> = {};
  let hasMissingCurrency = false;
  let hasInvalidAmount = false;

  for (const item of items) {
    const currency = typeof item.currency === "string" ? item.currency.trim().toUpperCase() : "";
    const amount = typeof item.amount === "number" ? item.amount : Number.parseFloat(String(item.amount ?? ""));
    if (!currency) hasMissingCurrency = true;
    if (!Number.isFinite(amount)) hasInvalidAmount = true;
    if (!currency || !Number.isFinite(amount)) continue;
    totals[currency] = (totals[currency] ?? 0) + amount;
  }

  const entries = Object.entries(totals);
  return {
    totals,
    entries,
    hasMissingCurrency,
    hasInvalidAmount,
    isSingleCurrency: entries.length === 1 && !hasMissingCurrency && !hasInvalidAmount,
    isMultiCurrency: entries.length > 1,
  };
}
