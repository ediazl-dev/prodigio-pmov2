export type FinancialLifecycle = "open" | "closed" | "internal";
export type FinancialLifecycleSource =
  | "project_active"
  | "service_active"
  | "project_closed"
  | "service_closed"
  | "absent_from_open_universe"
  | "internal_initiative";
export type FinancialGranularity = "month" | "quarter" | "year";
export type FinancialCompareMode = "none" | "previous_period" | "prior_year";
export type FinancialCurrencyTotals = Record<string, number>;

type AmountLike = string | number | null | undefined;

export interface FinancialSnapshotInput {
  id?: number;
  dealId: string;
  estadoProyecto?: string | null;
  projectName?: string | null;
  clientName?: string | null;
  pm?: string | null;
  valorVentaUF?: AmountLike;
  presupuestoUF?: AmountLike;
  utilizadoUF?: AmountLike;
  costoProyectadoUF?: AmountLike;
  margenProyectadoUF?: AmountLike;
  margenProyectadoPorc?: AmountLike;
  margenTargetPorc?: AmountLike;
  lineaNegocio?: string | null;
  sourceActive?: boolean | null;
  syncedAt?: Date | string | null;
}

export interface FinancialBillingItemInput {
  sourceKey: string;
  dealId: string;
  projectName?: string | null;
  clientName?: string | null;
  milestoneName: string;
  plannedDate?: string | null;
  deliveredAt?: string | null;
  invoicedAt?: string | null;
  amount?: AmountLike;
  currency?: string | null;
  amountUsdSource?: AmountLike;
  billingStatus?: string | null;
  deliveryStatus?: string | null;
  delayCause?: string | null;
  lineOfBusiness?: string | null;
  sourceActive?: boolean | null;
}

export interface FinancialOperationalItemInput {
  kind: "project" | "service";
  id: number;
  name: string;
  clientName?: string | null;
  dealId?: string | null;
  status: string;
}

export interface FinancialPortfolioFilters {
  lifecycle?: "all" | FinancialLifecycle;
  client?: string | null;
  lineOfBusiness?: string | null;
  search?: string | null;
}

export interface FinancialPortfolioV2Input {
  snapshots: FinancialSnapshotInput[];
  billingItems: FinancialBillingItemInput[];
  operationalItems: FinancialOperationalItemInput[];
  from: string;
  to: string;
  granularity?: FinancialGranularity;
  compareMode?: FinancialCompareMode;
  filters?: FinancialPortfolioFilters;
  aliases?: Array<{ sourceId: string; canonicalId: string }>;
}

export interface FinancialPeriod {
  from: string;
  to: string;
}

export interface FinancialClientRanking {
  client: string;
  amountUsdComparable: number | null;
  nativeAmounts: FinancialCurrencyTotals;
  sharePct: number | null;
  billedItems: number;
}

export interface FinancialSeriesPoint {
  key: string;
  label: string;
  billedUsdComparable: number | null;
  billedNative: FinancialCurrencyTotals;
  plannedNative: FinancialCurrencyTotals;
  billedItems: number;
  plannedItems: number;
}

export interface FinancialPortfolioItem {
  financialId: string;
  clientName: string;
  projectName: string;
  lineOfBusiness: string | null;
  pm: string | null;
  lifecycle: FinancialLifecycle;
  lifecycleSource: FinancialLifecycleSource;
  operationalLinks: Array<{ kind: "project" | "service"; id: number; status: string }>;
  contractedUF: number | null;
  budgetUF: number | null;
  consumedUF: number | null;
  projectedCostUF: number | null;
  budgetDeltaUF: number | null;
  projectedMarginUF: number | null;
  projectedMarginPct: number | null;
  marginTargetPct: number | null;
  marginGapPp: number | null;
  billedRangeNative: FinancialCurrencyTotals;
  billedRangeUsdComparable: number | null;
  billedHistoricalNative: FinancialCurrencyTotals;
  overdueAtCutoffNative: FinancialCurrencyTotals;
  overdueAtCutoffCount: number;
  nextMilestone: { name: string; plannedDate: string; amount: number | null; currency: string } | null;
  billingItemCount: number;
  sourceActive: boolean;
  syncedAt: string | null;
}

export interface FinancialPeriodMetrics {
  billedNative: FinancialCurrencyTotals;
  billedUsdComparable: number | null;
  billedItems: number;
  billedDeals: number;
  billedClients: number;
  overdueAtCutoffNative: FinancialCurrencyTotals;
  overdueAtCutoffItems: number;
  topClients: FinancialClientRanking[];
}

export interface FinancialPortfolioV2Result {
  period: FinancialPeriod;
  comparisonPeriod: FinancialPeriod | null;
  granularity: FinancialGranularity;
  compareMode: FinancialCompareMode;
  sourceWindow: { from: string | null; to: string | null };
  coverage: {
    financialItems: number;
    billingItems: number;
    billingItemsWithComparableUsd: number;
    billingItemsWithInvoiceDate: number;
    activeSourceItems: number;
  };
  lifecycle: { total: number; open: number; closed: number; internal: number };
  portfolio: {
    selectedContractedUF: number;
    selectedProjectedCostUF: number;
    selectedProjectedMarginUF: number;
    commercialContractedUF: number;
    openContractedUF: number;
    closedContractedUF: number;
    internalInvestmentUF: number;
    openProjectedCostUF: number;
    openProjectedMarginUF: number;
  };
  current: FinancialPeriodMetrics;
  comparison: FinancialPeriodMetrics | null;
  change: {
    billedUsdAbsolute: number | null;
    billedUsdPct: number | null;
    billedItemsAbsolute: number | null;
  };
  series: FinancialSeriesPoint[];
  deviations: {
    costOverruns: Array<{ financialId: string; clientName: string; projectName: string; budgetDeltaUF: number }>;
    marginGaps: Array<{ financialId: string; clientName: string; projectName: string; marginGapPp: number }>;
  };
  items: FinancialPortfolioItem[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN_STATUSES = new Set(["activo", "pausado", "active", "paused"]);
const CLOSED_STATUSES = new Set(["completado", "cancelado", "cerrado", "completed", "cancelled", "closed"]);

function numberOrNull(value: AmountLike): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function normalizeSpaces(value: string | null | undefined): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function canonicalFinancialId(value: string | null | undefined): string | null {
  const raw = normalizeSpaces(value);
  if (!raw) return null;
  const explicit = raw.match(/^Deal\s*[-_]?\s*(\d+)(.*)$/i);
  if (explicit) {
    const suffix = explicit[2].replace(/\s+/g, "");
    return `Deal${explicit[1]}${suffix}`;
  }
  if (/^\d{4,}$/.test(raw)) return `Deal${raw}`;
  return raw;
}

export function extractFinancialIdFromName(value: string | null | undefined): string | null {
  const raw = normalizeSpaces(value);
  const match = raw.match(/\bDeal\s*[-_]?\s*(\d+[A-Za-z0-9_-]*)\b/i);
  return match?.[1] ? canonicalFinancialId(`Deal${match[1]}`) : null;
}

function financialKey(value: string | null | undefined): string | null {
  return canonicalFinancialId(value)?.toLocaleLowerCase("es-CL") ?? null;
}

function normalizeStatus(value: string | null | undefined): string {
  return normalizeSpaces(value).toLocaleLowerCase("es-CL");
}

function normalizeClientKey(value: string | null | undefined): string {
  return normalizeSpaces(value).toLocaleLowerCase("es-CL");
}

function normalizeCurrency(value: string | null | undefined): string {
  const currency = normalizeSpaces(value).toUpperCase();
  return currency || "N/D";
}

function isIsoDate(value: string | null | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)));
}

export function normalizeFinancialPeriod(from: string, to: string): FinancialPeriod {
  if (!isIsoDate(from) || !isIsoDate(to)) throw new Error("El período financiero debe usar fechas YYYY-MM-DD válidas");
  if (from > to) throw new Error("La fecha inicial no puede ser posterior a la fecha final");
  return { from, to };
}

function isoFromMs(value: number): string {
  return new Date(value).toISOString().slice(0, 10);
}

export function buildComparisonPeriod(period: FinancialPeriod, mode: FinancialCompareMode): FinancialPeriod | null {
  if (mode === "none") return null;
  const fromMs = Date.parse(`${period.from}T00:00:00Z`);
  const toMs = Date.parse(`${period.to}T00:00:00Z`);
  if (mode === "previous_period") {
    const days = Math.floor((toMs - fromMs) / DAY_MS) + 1;
    const comparisonTo = fromMs - DAY_MS;
    return { from: isoFromMs(comparisonTo - (days - 1) * DAY_MS), to: isoFromMs(comparisonTo) };
  }
  const shiftYear = (iso: string) => {
    const date = new Date(`${iso}T00:00:00Z`);
    const targetYear = date.getUTCFullYear() - 1;
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    const shifted = new Date(Date.UTC(targetYear, month, day));
    if (shifted.getUTCMonth() !== month) return new Date(Date.UTC(targetYear, month + 1, 0)).toISOString().slice(0, 10);
    return shifted.toISOString().slice(0, 10);
  };
  return { from: shiftYear(period.from), to: shiftYear(period.to) };
}

function addCurrency(total: FinancialCurrencyTotals, currency: string, amount: number | null): void {
  if (amount === null) return;
  total[currency] = round((total[currency] ?? 0) + amount);
}

function sumNullable(values: Array<number | null>): number {
  return round(values.reduce<number>((sum, value) => sum + (value ?? 0), 0));
}

function isInternalSnapshot(snapshot: FinancialSnapshotInput): boolean {
  const id = normalizeSpaces(snapshot.dealId).toLocaleLowerCase("es-CL");
  const client = normalizeClientKey(snapshot.clientName);
  const name = normalizeSpaces(snapshot.projectName).toLocaleLowerCase("es-CL");
  return id.startsWith("int-") || id.includes("innovacion") || id.includes("innovación") || name.includes("iniciativa interna") || (client === "prodigio" && !id.startsWith("deal"));
}

function resolveOperationalId(item: FinancialOperationalItemInput): string | null {
  return canonicalFinancialId(item.dealId) ?? extractFinancialIdFromName(item.name);
}

export function deriveFinancialLifecycle(
  snapshot: FinancialSnapshotInput,
  operationalItems: FinancialOperationalItemInput[],
): { lifecycle: FinancialLifecycle; source: FinancialLifecycleSource; links: FinancialPortfolioItem["operationalLinks"] } {
  if (isInternalSnapshot(snapshot)) return { lifecycle: "internal", source: "internal_initiative", links: [] };
  const snapshotKey = financialKey(snapshot.dealId);
  const matches = operationalItems.filter(item => financialKey(resolveOperationalId(item)) === snapshotKey);
  const links = matches.map(item => ({ kind: item.kind, id: item.id, status: item.status }));
  const activeProject = matches.find(item => item.kind === "project" && OPEN_STATUSES.has(normalizeStatus(item.status)));
  if (activeProject) return { lifecycle: "open", source: "project_active", links };
  const activeService = matches.find(item => item.kind === "service" && OPEN_STATUSES.has(normalizeStatus(item.status)));
  if (activeService) return { lifecycle: "open", source: "service_active", links };
  const closedProject = matches.find(item => item.kind === "project" && CLOSED_STATUSES.has(normalizeStatus(item.status)));
  if (closedProject) return { lifecycle: "closed", source: "project_closed", links };
  const closedService = matches.find(item => item.kind === "service" && CLOSED_STATUSES.has(normalizeStatus(item.status)));
  if (closedService) return { lifecycle: "closed", source: "service_closed", links };
  return { lifecycle: "closed", source: "absent_from_open_universe", links };
}

function resolveAlias(value: string, aliases: Map<string, string>): string {
  const key = financialKey(value) ?? value.toLocaleLowerCase("es-CL");
  return aliases.get(key) ?? canonicalFinancialId(value) ?? value;
}

function inRange(value: string | null | undefined, period: FinancialPeriod): boolean {
  return Boolean(isIsoDate(value) && value >= period.from && value <= period.to);
}

function isBilledAt(item: FinancialBillingItemInput, cutoff: string): boolean {
  return normalizeStatus(item.billingStatus) === "facturado" && Boolean(isIsoDate(item.invoicedAt) && item.invoicedAt <= cutoff);
}

function periodKey(date: string, granularity: FinancialGranularity): { key: string; label: string } {
  const [year, month] = date.split("-").map(Number);
  if (granularity === "year") return { key: String(year), label: String(year) };
  if (granularity === "quarter") {
    const quarter = Math.floor((month - 1) / 3) + 1;
    return { key: `${year}-Q${quarter}`, label: `T${quarter} ${year}` };
  }
  return { key: date.slice(0, 7), label: new Intl.DateTimeFormat("es-CL", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date.slice(0, 7)}-01T00:00:00Z`)) };
}

function buildPeriodMetrics(
  period: FinancialPeriod,
  billingItems: FinancialBillingItemInput[],
  clientByDeal: Map<string, string>,
): FinancialPeriodMetrics {
  const billedNative: FinancialCurrencyTotals = {};
  const overdueNative: FinancialCurrencyTotals = {};
  const billedDeals = new Set<string>();
  const billedClients = new Set<string>();
  const clientBuckets = new Map<string, { client: string; amountUsd: number; usdCoverage: number; native: FinancialCurrencyTotals; items: number }>();
  let billedUsd = 0;
  let billedUsdCoverage = 0;
  let billedItems = 0;
  let overdueAtCutoffItems = 0;

  for (const item of billingItems) {
    if (item.sourceActive === false) continue;
    const amount = numberOrNull(item.amount);
    const currency = normalizeCurrency(item.currency);
    const dealKey = financialKey(item.dealId) ?? normalizeStatus(item.dealId);
    const client = normalizeSpaces(item.clientName) || clientByDeal.get(dealKey) || "Sin cliente";
    const clientKey = normalizeClientKey(client);

    if (normalizeStatus(item.billingStatus) === "facturado" && inRange(item.invoicedAt, period)) {
      billedItems += 1;
      billedDeals.add(dealKey);
      billedClients.add(clientKey);
      addCurrency(billedNative, currency, amount);
      const amountUsd = numberOrNull(item.amountUsdSource);
      if (amountUsd !== null) {
        billedUsd += amountUsd;
        billedUsdCoverage += 1;
      }
      const bucket = clientBuckets.get(clientKey) ?? { client, amountUsd: 0, usdCoverage: 0, native: {}, items: 0 };
      addCurrency(bucket.native, currency, amount);
      bucket.items += 1;
      if (amountUsd !== null) {
        bucket.amountUsd += amountUsd;
        bucket.usdCoverage += 1;
      }
      clientBuckets.set(clientKey, bucket);
    }

    const plannedAtCutoff = isIsoDate(item.plannedDate) && item.plannedDate <= period.to;
    if (plannedAtCutoff && !isBilledAt(item, period.to)) {
      overdueAtCutoffItems += 1;
      addCurrency(overdueNative, currency, amount);
    }
  }

  const comparableTotal = billedUsdCoverage > 0 ? round(billedUsd, 2) : null;
  const topClients = Array.from(clientBuckets.values())
    .map(bucket => ({
      client: bucket.client,
      amountUsdComparable: bucket.usdCoverage > 0 ? round(bucket.amountUsd, 2) : null,
      nativeAmounts: bucket.native,
      sharePct: comparableTotal && bucket.usdCoverage > 0 ? round((bucket.amountUsd / comparableTotal) * 100, 2) : null,
      billedItems: bucket.items,
    }))
    .sort((left, right) => (right.amountUsdComparable ?? -1) - (left.amountUsdComparable ?? -1));

  return {
    billedNative,
    billedUsdComparable: comparableTotal,
    billedItems,
    billedDeals: billedDeals.size,
    billedClients: billedClients.size,
    overdueAtCutoffNative: overdueNative,
    overdueAtCutoffItems,
    topClients,
  };
}

function buildSeries(period: FinancialPeriod, granularity: FinancialGranularity, items: FinancialBillingItemInput[]): FinancialSeriesPoint[] {
  const points = new Map<string, FinancialSeriesPoint>();
  const ensure = (date: string) => {
    const periodData = periodKey(date, granularity);
    const existing = points.get(periodData.key);
    if (existing) return existing;
    const created: FinancialSeriesPoint = {
      ...periodData,
      billedUsdComparable: null,
      billedNative: {},
      plannedNative: {},
      billedItems: 0,
      plannedItems: 0,
    };
    points.set(periodData.key, created);
    return created;
  };

  for (const item of items) {
    if (item.sourceActive === false) continue;
    const amount = numberOrNull(item.amount);
    const currency = normalizeCurrency(item.currency);
    if (normalizeStatus(item.billingStatus) === "facturado" && inRange(item.invoicedAt, period)) {
      const point = ensure(item.invoicedAt!);
      addCurrency(point.billedNative, currency, amount);
      point.billedItems += 1;
      const usd = numberOrNull(item.amountUsdSource);
      if (usd !== null) point.billedUsdComparable = round((point.billedUsdComparable ?? 0) + usd, 2);
    }
    if (inRange(item.plannedDate, period)) {
      const point = ensure(item.plannedDate!);
      addCurrency(point.plannedNative, currency, amount);
      point.plannedItems += 1;
    }
  }
  return Array.from(points.values()).sort((left, right) => left.key.localeCompare(right.key));
}

function matchesFilters(item: FinancialPortfolioItem, filters: FinancialPortfolioFilters | undefined): boolean {
  if (!filters) return true;
  if (filters.lifecycle && filters.lifecycle !== "all" && item.lifecycle !== filters.lifecycle) return false;
  if (filters.client && normalizeClientKey(item.clientName) !== normalizeClientKey(filters.client)) return false;
  if (filters.lineOfBusiness && normalizeStatus(item.lineOfBusiness) !== normalizeStatus(filters.lineOfBusiness)) return false;
  const search = normalizeStatus(filters.search);
  if (search) {
    const haystack = normalizeStatus(`${item.financialId} ${item.clientName} ${item.projectName} ${item.pm ?? ""}`);
    if (!haystack.includes(search)) return false;
  }
  return true;
}

export function buildFinancialPortfolioV2(input: FinancialPortfolioV2Input): FinancialPortfolioV2Result {
  const period = normalizeFinancialPeriod(input.from, input.to);
  const granularity = input.granularity ?? "month";
  const compareMode = input.compareMode ?? "none";
  const comparisonPeriod = buildComparisonPeriod(period, compareMode);
  const aliases = new Map<string, string>();
  for (const alias of input.aliases ?? []) {
    const sourceKey = financialKey(alias.sourceId) ?? normalizeStatus(alias.sourceId);
    aliases.set(sourceKey, canonicalFinancialId(alias.canonicalId) ?? alias.canonicalId);
  }

  const activeSnapshots = input.snapshots.filter(snapshot => snapshot.sourceActive !== false);
  const clientByDeal = new Map<string, string>();
  for (const snapshot of activeSnapshots) {
    const key = financialKey(resolveAlias(snapshot.dealId, aliases));
    if (key && snapshot.clientName) clientByDeal.set(key, normalizeSpaces(snapshot.clientName));
  }
  const activeBilling = input.billingItems
    .filter(item => item.sourceActive !== false)
    .map(item => ({ ...item, dealId: resolveAlias(item.dealId, aliases) }));

  const items: FinancialPortfolioItem[] = activeSnapshots.map(snapshot => {
    const financialId = resolveAlias(snapshot.dealId, aliases);
    const lifecycle = deriveFinancialLifecycle({ ...snapshot, dealId: financialId }, input.operationalItems);
    const dealKey = financialKey(financialId) ?? normalizeStatus(financialId);
    const billing = activeBilling.filter(item => (financialKey(item.dealId) ?? normalizeStatus(item.dealId)) === dealKey);
    const billedRangeNative: FinancialCurrencyTotals = {};
    const billedHistoricalNative: FinancialCurrencyTotals = {};
    const overdueAtCutoffNative: FinancialCurrencyTotals = {};
    let billedRangeUsd = 0;
    let billedRangeUsdCoverage = 0;
    let overdueAtCutoffCount = 0;

    for (const item of billing) {
      const amount = numberOrNull(item.amount);
      const currency = normalizeCurrency(item.currency);
      if (normalizeStatus(item.billingStatus) === "facturado" && inRange(item.invoicedAt, period)) {
        addCurrency(billedRangeNative, currency, amount);
        const usd = numberOrNull(item.amountUsdSource);
        if (usd !== null) {
          billedRangeUsd += usd;
          billedRangeUsdCoverage += 1;
        }
      }
      if (isBilledAt(item, period.to)) addCurrency(billedHistoricalNative, currency, amount);
      if (isIsoDate(item.plannedDate) && item.plannedDate <= period.to && !isBilledAt(item, period.to)) {
        overdueAtCutoffCount += 1;
        addCurrency(overdueAtCutoffNative, currency, amount);
      }
    }

    const future = billing
      .filter(item => isIsoDate(item.plannedDate) && item.plannedDate > period.to && !isBilledAt(item, period.to))
      .sort((left, right) => left.plannedDate!.localeCompare(right.plannedDate!))[0];
    const budgetUF = numberOrNull(snapshot.presupuestoUF);
    const projectedCostUF = numberOrNull(snapshot.costoProyectadoUF);
    const projectedMarginPct = numberOrNull(snapshot.margenProyectadoPorc);
    const marginTargetPct = numberOrNull(snapshot.margenTargetPorc);

    return {
      financialId,
      clientName: normalizeSpaces(snapshot.clientName) || "Sin cliente",
      projectName: normalizeSpaces(snapshot.projectName) || financialId,
      lineOfBusiness: normalizeSpaces(snapshot.lineaNegocio) || null,
      pm: normalizeSpaces(snapshot.pm) || null,
      lifecycle: lifecycle.lifecycle,
      lifecycleSource: lifecycle.source,
      operationalLinks: lifecycle.links,
      contractedUF: numberOrNull(snapshot.valorVentaUF),
      budgetUF,
      consumedUF: numberOrNull(snapshot.utilizadoUF),
      projectedCostUF,
      budgetDeltaUF: budgetUF !== null && projectedCostUF !== null ? round(projectedCostUF - budgetUF) : null,
      projectedMarginUF: numberOrNull(snapshot.margenProyectadoUF),
      projectedMarginPct,
      marginTargetPct,
      marginGapPp: projectedMarginPct !== null && marginTargetPct !== null ? round((projectedMarginPct - marginTargetPct) * 100, 2) : null,
      billedRangeNative,
      billedRangeUsdComparable: billedRangeUsdCoverage > 0 ? round(billedRangeUsd, 2) : null,
      billedHistoricalNative,
      overdueAtCutoffNative,
      overdueAtCutoffCount,
      nextMilestone: future ? {
        name: future.milestoneName,
        plannedDate: future.plannedDate!,
        amount: numberOrNull(future.amount),
        currency: normalizeCurrency(future.currency),
      } : null,
      billingItemCount: billing.length,
      sourceActive: snapshot.sourceActive !== false,
      syncedAt: snapshot.syncedAt ? new Date(snapshot.syncedAt).toISOString() : null,
    };
  }).filter(item => matchesFilters(item, input.filters));

  const includedDeals = new Set(items.map(item => financialKey(item.financialId) ?? normalizeStatus(item.financialId)));
  const filteredBilling = activeBilling.filter(item => includedDeals.has(financialKey(item.dealId) ?? normalizeStatus(item.dealId)));
  const current = buildPeriodMetrics(period, filteredBilling, clientByDeal);
  const comparison = comparisonPeriod ? buildPeriodMetrics(comparisonPeriod, filteredBilling, clientByDeal) : null;
  const currentUsd = current.billedUsdComparable;
  const comparisonUsd = comparison?.billedUsdComparable ?? null;

  const invoicedDates = activeBilling.map(item => item.invoicedAt).filter(isIsoDate).sort();
  const costOverruns = items
    .filter(item => item.budgetDeltaUF !== null && item.budgetDeltaUF > 0)
    .map(item => ({ financialId: item.financialId, clientName: item.clientName, projectName: item.projectName, budgetDeltaUF: item.budgetDeltaUF! }))
    .sort((left, right) => right.budgetDeltaUF - left.budgetDeltaUF);
  const marginGaps = items
    .filter(item => item.marginGapPp !== null && item.marginGapPp < 0)
    .map(item => ({ financialId: item.financialId, clientName: item.clientName, projectName: item.projectName, marginGapPp: item.marginGapPp! }))
    .sort((left, right) => left.marginGapPp - right.marginGapPp);

  return {
    period,
    comparisonPeriod,
    granularity,
    compareMode,
    sourceWindow: { from: invoicedDates[0] ?? null, to: invoicedDates.at(-1) ?? null },
    coverage: {
      financialItems: input.snapshots.length,
      billingItems: input.billingItems.length,
      billingItemsWithComparableUsd: activeBilling.filter(item => numberOrNull(item.amountUsdSource) !== null).length,
      billingItemsWithInvoiceDate: activeBilling.filter(item => isIsoDate(item.invoicedAt)).length,
      activeSourceItems: activeSnapshots.length,
    },
    lifecycle: {
      total: items.length,
      open: items.filter(item => item.lifecycle === "open").length,
      closed: items.filter(item => item.lifecycle === "closed").length,
      internal: items.filter(item => item.lifecycle === "internal").length,
    },
    portfolio: {
      selectedContractedUF: sumNullable(items.map(item => item.contractedUF)),
      selectedProjectedCostUF: sumNullable(items.map(item => item.projectedCostUF)),
      selectedProjectedMarginUF: sumNullable(items.map(item => item.projectedMarginUF)),
      commercialContractedUF: sumNullable(items.filter(item => item.lifecycle !== "internal").map(item => item.contractedUF)),
      openContractedUF: sumNullable(items.filter(item => item.lifecycle === "open").map(item => item.contractedUF)),
      closedContractedUF: sumNullable(items.filter(item => item.lifecycle === "closed").map(item => item.contractedUF)),
      internalInvestmentUF: sumNullable(items.filter(item => item.lifecycle === "internal").map(item => item.contractedUF)),
      openProjectedCostUF: sumNullable(items.filter(item => item.lifecycle === "open").map(item => item.projectedCostUF)),
      openProjectedMarginUF: sumNullable(items.filter(item => item.lifecycle === "open").map(item => item.projectedMarginUF)),
    },
    current,
    comparison,
    change: {
      billedUsdAbsolute: currentUsd !== null && comparisonUsd !== null ? round(currentUsd - comparisonUsd, 2) : null,
      billedUsdPct: currentUsd !== null && comparisonUsd !== null && comparisonUsd !== 0 ? round(((currentUsd - comparisonUsd) / comparisonUsd) * 100, 2) : null,
      billedItemsAbsolute: comparison ? current.billedItems - comparison.billedItems : null,
    },
    series: buildSeries(period, granularity, filteredBilling),
    deviations: { costOverruns, marginGaps },
    items: items.sort((left, right) => {
      const lifecycleOrder = { open: 0, closed: 1, internal: 2 } as const;
      return lifecycleOrder[left.lifecycle] - lifecycleOrder[right.lifecycle] || left.clientName.localeCompare(right.clientName, "es-CL") || left.financialId.localeCompare(right.financialId);
    }),
  };
}
