import React, { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Database,
  Filter,
  LineChart as LineChartIcon,
  Search,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const TODAY = new Date().toISOString().slice(0, 10);
const CURRENT_YEAR = Number(TODAY.slice(0, 4));
const COLORS = ["#e91e8c", "#2563eb", "#0f766e", "#d97706", "#7c3aed", "#dc2626", "#0891b2", "#475569"];

type NativeAmounts = Record<string, number>;

function formatNumber(value: number | null | undefined, maximumFractionDigits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "N/D";
  return new Intl.NumberFormat("es-CL", { maximumFractionDigits }).format(value);
}

function formatUf(value: number | null | undefined): string {
  return value === null || value === undefined ? "N/D" : `UF ${formatNumber(value, 2)}`;
}

function formatUsd(value: number | null | undefined): string {
  return value === null || value === undefined
    ? "N/D"
    : new Intl.NumberFormat("es-CL", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatPct(value: number | null | undefined): string {
  return value === null || value === undefined ? "N/D" : `${formatNumber(value * 100, 1)}%`;
}

function formatNative(amounts: NativeAmounts | null | undefined): string {
  const entries = Object.entries(amounts ?? {}).filter(([, amount]) => Number.isFinite(amount));
  if (entries.length === 0) return "N/D";
  return entries.map(([currency, amount]) => `${currency} ${formatNumber(amount, 2)}`).join(" · ");
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "N/D";
  const date = value instanceof Date ? value : new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return "N/D";
  return new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function lifecycleLabel(value: string): string {
  if (value === "open") return "Abierto";
  if (value === "closed") return "Cerrado";
  return "Inversión interna";
}

function lifecycleClass(value: string): string {
  if (value === "open") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (value === "closed") return "bg-slate-100 text-slate-700 border-slate-200";
  return "bg-violet-50 text-violet-700 border-violet-200";
}

function changePresentation(value: number | null | undefined) {
  if (value === null || value === undefined) return { icon: ArrowRight, text: "Sin comparación", className: "text-slate-500" };
  if (value > 0) return { icon: ArrowUpRight, text: `+${formatNumber(value, 1)}%`, className: "text-emerald-700" };
  if (value < 0) return { icon: ArrowDownRight, text: `${formatNumber(value, 1)}%`, className: "text-red-700" };
  return { icon: ArrowRight, text: "0%", className: "text-slate-600" };
}

function MetricCard({ label, value, note, icon: Icon, tone = "slate" }: {
  label: string;
  value: string;
  note: string;
  icon: typeof CircleDollarSign;
  tone?: "slate" | "pink" | "blue" | "amber" | "red" | "green";
}) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    pink: "bg-pink-50 text-pink-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    green: "bg-emerald-50 text-emerald-700",
  };
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className={`rounded-xl p-2.5 ${tones[tone]}`}><Icon className="h-5 w-5" aria-hidden="true" /></div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</span>
      </div>
      <p className="mt-5 text-2xl font-bold tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-600">{note}</p>
    </section>
  );
}

function FilterSelect({ label, value, onChange, children }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-[150px] flex-col gap-1 text-xs font-semibold text-slate-600">
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={event => onChange(event.target.value)}
        className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-pink-500 focus:ring-2 focus:ring-pink-100"
      >
        {children}
      </select>
    </label>
  );
}

export default function FinancialConsolidated() {
  const { user } = useAuth();
  const [preset, setPreset] = useState(String(CURRENT_YEAR));
  const [from, setFrom] = useState(`${CURRENT_YEAR}-01-01`);
  const [to, setTo] = useState(TODAY);
  const [compareMode, setCompareMode] = useState<"none" | "previous_period" | "prior_year">("prior_year");
  const [granularity, setGranularity] = useState<"month" | "quarter" | "year">("month");
  const [lifecycle, setLifecycle] = useState<"all" | "open" | "closed" | "internal">("all");
  const [client, setClient] = useState("all");
  const [lineOfBusiness, setLineOfBusiness] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const queryInput = useMemo(() => ({
    from,
    to,
    compareMode,
    granularity,
    lifecycle,
    client: client === "all" ? null : client,
    lineOfBusiness: lineOfBusiness === "all" ? null : lineOfBusiness,
    search: search.trim() || null,
    page,
    pageSize: 20,
  }), [from, to, compareMode, granularity, lifecycle, client, lineOfBusiness, search, page]);

  const { data, isLoading, isFetching, error } = trpc.portfolioConsole.getFinancialPortfolioV2.useQuery(queryInput, {
    enabled: Boolean(user),
    placeholderData: previous => previous,
  });

  const setPeriodPreset = (value: string) => {
    setPreset(value);
    setPage(1);
    if (value === "custom") return;
    if (value === "all") {
      setFrom(data?.sourceWindow.from ?? "2023-01-01");
      setTo(TODAY);
      setGranularity("year");
      return;
    }
    const year = Number(value);
    setFrom(`${year}-01-01`);
    setTo(year === CURRENT_YEAR ? TODAY : `${year}-12-31`);
    setGranularity(year === CURRENT_YEAR ? "month" : "quarter");
  };

  if (isLoading || !data) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
        <Skeleton className="h-9 w-80" />
        <Skeleton className="mt-3 h-5 w-full max-w-2xl" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map(item => <Skeleton key={item} className="h-40 rounded-2xl" />)}
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <section className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
          <AlertTriangle className="h-8 w-8 text-red-600" />
          <h1 className="mt-4 text-xl font-bold text-slate-950">No fue posible cargar el portafolio financiero</h1>
          <p className="mt-2 text-sm text-red-700">{error.message}</p>
        </section>
      </main>
    );
  }

  const topClient = data.current.topClients[0] ?? null;
  const change = changePresentation(data.change.billedUsdPct);
  const ChangeIcon = change.icon;
  const visibleYearOptions = data.options.availableYears.filter(year => year <= CURRENT_YEAR);
  const nonOpen = data.lifecycle.closed + data.lifecycle.internal;
  const portfolioMetric = lifecycle === "all"
    ? { label: "Cartera comercial", value: data.portfolio.commercialContractedUF }
    : lifecycle === "open"
      ? { label: "Cartera abierta", value: data.portfolio.openContractedUF }
      : lifecycle === "closed"
        ? { label: "Cartera cerrada", value: data.portfolio.closedContractedUF }
        : { label: "Inversión interna", value: data.portfolio.internalInvestmentUF };
  const totalNativeOverdue = formatNative(data.current.overdueAtCutoffNative);
  const rangeLabel = `${formatDate(data.period.from)} — ${formatDate(data.period.to)}`;
  const comparisonLabel = data.comparisonPeriod ? `${formatDate(data.comparisonPeriod.from)} — ${formatDate(data.comparisonPeriod.to)}` : "sin comparación";
  const chartData = data.series.map(point => ({
    label: point.label,
    facturadoUsd: point.billedUsdComparable,
    hitosFacturados: point.billedItems,
    hitosPlanificados: point.plannedItems,
  }));
  const clientChart = data.current.topClients.slice(0, 8).map(item => ({
    client: item.client,
    amountUsd: item.amountUsdComparable ?? 0,
  }));

  return (
    <main className="min-h-screen min-w-0 overflow-x-hidden bg-slate-50 p-4 text-slate-900 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <header className="rounded-3xl bg-slate-950 px-5 py-6 text-white shadow-lg sm:px-8 sm:py-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-pink-400">Portafolio financiero</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Facturación, costos y margen con historia verificable</h1>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Ventana analizada: <strong className="text-white">{rangeLabel}</strong>. Valores contratados y costos en UF; facturación conserva su moneda nativa y usa sólo <strong className="text-white">EN_USD de la planilla</strong> para rankings comparables.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs sm:flex sm:min-w-[380px] sm:justify-between">
              <div><span className="block text-slate-400">Fuente</span><strong>{data.source ? `Lote #${data.source.batchId}` : "N/D"}</strong></div>
              <div><span className="block text-slate-400">Sincronizado</span><strong>{formatDate(data.source?.syncedAt)}</strong></div>
              <div><span className="block text-slate-400">Cobertura</span><strong>{formatDate(data.sourceWindow.from)} — {formatDate(data.sourceWindow.to)}</strong></div>
              <div><span className="block text-slate-400">Hitos vigentes</span><strong>{data.source?.activeBillingItems ?? data.coverage.billingItems}</strong></div>
            </div>
          </div>
        </header>

        <section aria-label="Filtros financieros" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900"><Filter className="h-4 w-4 text-pink-600" /> Ventana y segmentación</div>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <FilterSelect label="Período" value={preset} onChange={setPeriodPreset}>
              {visibleYearOptions.map(year => <option key={year} value={String(year)}>{year}{year === CURRENT_YEAR ? " · YTD" : ""}</option>)}
              <option value="all">Todo el histórico</option>
              <option value="custom">Rango personalizado</option>
            </FilterSelect>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">Desde<input aria-label="Fecha inicial" type="date" value={from} onChange={event => { setFrom(event.target.value); setPreset("custom"); setPage(1); }} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-pink-500 focus:ring-2 focus:ring-pink-100" /></label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">Hasta<input aria-label="Fecha final" type="date" value={to} onChange={event => { setTo(event.target.value); setPreset("custom"); setPage(1); }} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-pink-500 focus:ring-2 focus:ring-pink-100" /></label>
            <FilterSelect label="Comparar con" value={compareMode} onChange={value => { setCompareMode(value as typeof compareMode); setPage(1); }}>
              <option value="prior_year">Mismo período año anterior</option>
              <option value="previous_period">Período anterior</option>
              <option value="none">Sin comparación</option>
            </FilterSelect>
            <FilterSelect label="Vista temporal" value={granularity} onChange={value => setGranularity(value as typeof granularity)}>
              <option value="month">Mensual</option><option value="quarter">Trimestral</option><option value="year">Anual</option>
            </FilterSelect>
            <FilterSelect label="Ciclo de vida" value={lifecycle} onChange={value => { setLifecycle(value as typeof lifecycle); setPage(1); }}>
              <option value="all">Todos</option><option value="open">Abiertos</option><option value="closed">Cerrados</option><option value="internal">Inversión interna</option>
            </FilterSelect>
            <FilterSelect label="Cliente" value={client} onChange={value => { setClient(value); setPage(1); }}>
              <option value="all">Todos</option>{data.options.clients.map(item => <option key={item} value={item}>{item}</option>)}
            </FilterSelect>
            <FilterSelect label="Línea de negocio" value={lineOfBusiness} onChange={value => { setLineOfBusiness(value); setPage(1); }}>
              <option value="all">Todas</option>{data.options.linesOfBusiness.map(item => <option key={item} value={item}>{item}</option>)}
            </FilterSelect>
            <label className="relative flex min-w-[220px] flex-1 flex-col gap-1 text-xs font-semibold text-slate-600">Buscar proyecto o Deal<span className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input aria-label="Buscar proyecto o Deal" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Cliente, proyecto, PM o Deal" className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm font-normal text-slate-900 focus:border-pink-500 focus:ring-2 focus:ring-pink-100" /></span></label>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
            <span><CalendarRange className="mr-1 inline h-4 w-4" />{rangeLabel}</span>
            <span>Comparación: {comparisonLabel}</span>
            {isFetching && <span className="font-semibold text-pink-600">Actualizando lectura…</span>}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6" aria-label="Indicadores ejecutivos">
          <MetricCard label="Facturado en ventana" value={formatUsd(data.current.billedUsdComparable)} note={`${formatNative(data.current.billedNative)} · ${data.current.billedItems} hitos`} icon={CircleDollarSign} tone="pink" />
          <MetricCard label="Cliente líder" value={topClient?.client ?? "N/D"} note={topClient ? `${formatUsd(topClient.amountUsdComparable)} · ${formatNumber(topClient.sharePct, 1)}% del comparable` : "Sin facturación comparable"} icon={Users} tone="blue" />
          <MetricCard label={portfolioMetric.label} value={formatUf(portfolioMetric.value)} note={`${data.lifecycle.open} abiertos · ${nonOpen} no abiertos`} icon={WalletCards} tone="green" />
          <MetricCard label="Costo proyectado seleccionado" value={formatUf(data.portfolio.selectedProjectedCostUF)} note={`Margen proyectado ${formatUf(data.portfolio.selectedProjectedMarginUF)}`} icon={Target} tone="amber" />
          <MetricCard label="Vencido no facturado" value={totalNativeOverdue} note={`${data.current.overdueAtCutoffItems} hitos al corte; no son facturas SII`} icon={Clock3} tone="red" />
          <MetricCard label="Cobertura de fuente" value={`${data.coverage.activeSourceItems}/${data.coverage.financialItems}`} note={`${data.coverage.billingItemsWithInvoiceDate}/${data.coverage.billingItems} hitos con fecha de factura`} icon={Database} tone="slate" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Evolución temporal</p><h2 className="mt-1 text-xl font-bold text-slate-950">Facturación comparable e hitos</h2></div>
              <div className={`flex items-center gap-1 text-sm font-bold ${change.className}`}><ChangeIcon className="h-4 w-4" />{change.text} vs. comparación</div>
            </div>
            <div className="mt-5 h-[320px] w-full" aria-label="Gráfico de evolución de facturación">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis yAxisId="usd" tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={value => `$${formatNumber(Number(value) / 1000, 0)}K`} />
                  <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                  <Tooltip formatter={(value: number, name: string) => name === "Facturado USD" ? formatUsd(value) : formatNumber(value, 0)} />
                  <Bar yAxisId="count" dataKey="hitosPlanificados" name="Hitos planificados" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="count" dataKey="hitosFacturados" name="Hitos facturados" fill="#f9a8d4" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="usd" type="monotone" dataKey="facturadoUsd" name="Facturado USD" stroke="#e91e8c" strokeWidth={3} dot={{ r: 3 }} connectNulls={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">La línea usa exclusivamente el equivalente <strong>EN_USD</strong> entregado por la fuente. Las barras cuentan hitos; no convierten ni suman monedas.</p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Concentración</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">Clientes con mayor facturación</h2>
            <div className="mt-5 h-[320px] w-full" aria-label="Ranking de clientes por facturación en USD">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={clientChart} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={value => `$${formatNumber(Number(value) / 1000, 0)}K`} />
                  <YAxis type="category" dataKey="client" width={105} tick={{ fontSize: 11, fill: "#334155" }} />
                  <Tooltip formatter={(value: number) => formatUsd(value)} />
                  <Bar dataKey="amountUsd" name="Facturado USD" radius={[0, 6, 6, 0]}>{clientChart.map((entry, index) => <Cell key={`${entry.client}-${index}`} fill={COLORS[index % COLORS.length]} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><TrendingDown className="h-5 w-5 text-red-600" /><h2 className="text-lg font-bold text-slate-950">Mayores sobrecostos proyectados</h2></div>
            <div className="mt-4 space-y-3">
              {data.deviations.costOverruns.slice(0, 5).map(item => <div key={item.financialId} className="flex items-center justify-between gap-4 rounded-xl bg-red-50 px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{item.projectName}</p><p className="text-xs text-slate-500">{item.clientName} · {item.financialId}</p></div><strong className="whitespace-nowrap text-sm text-red-700">+{formatUf(item.budgetDeltaUF)}</strong></div>)}
              {data.deviations.costOverruns.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No hay sobrecostos proyectados con evidencia suficiente.</p>}
            </div>
          </article>
          <article className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-amber-600" /><h2 className="text-lg font-bold text-slate-950">Brechas de margen vs. target</h2></div>
            <div className="mt-4 space-y-3">
              {data.deviations.marginGaps.slice(0, 5).map(item => <div key={item.financialId} className="flex items-center justify-between gap-4 rounded-xl bg-amber-50 px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{item.projectName}</p><p className="text-xs text-slate-500">{item.clientName} · {item.financialId}</p></div><strong className="whitespace-nowrap text-sm text-amber-800">{formatNumber(item.marginGapPp, 1)} pp</strong></div>)}
              {data.deviations.marginGaps.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No hay brechas negativas de margen con evidencia suficiente.</p>}
            </div>
          </article>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Detalle gobernable</p><h2 className="mt-1 text-xl font-bold text-slate-950">Portafolio por proyecto o servicio financiero</h2><p className="mt-1 text-xs text-slate-500">Abierto sólo si aparece activo en PMO o Servicios Recurrentes. Todo lo demás se clasifica como cerrado; inversión interna se separa.</p></div>
            <div className="flex items-center gap-2 self-end">
              <span className="text-xs text-slate-500">{data.pagination.total === 0 ? 0 : (data.pagination.page - 1) * data.pagination.pageSize + 1}–{Math.min(data.pagination.page * data.pagination.pageSize, data.pagination.total)} de {data.pagination.total}</span>
              <button aria-label="Página anterior" disabled={data.pagination.page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))} className="rounded-lg border border-slate-300 p-2 text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
              <button aria-label="Página siguiente" disabled={data.pagination.page >= data.pagination.totalPages} onClick={() => setPage(value => Math.min(data.pagination.totalPages, value + 1))} className="rounded-lg border border-slate-300 p-2 text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="divide-y divide-slate-100 lg:hidden">
            {data.items.map(item => (
              <article key={`mobile-${item.financialId}`} className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><h3 className="font-semibold text-slate-950">{item.projectName}</h3><p className="mt-1 text-xs text-slate-500">{item.clientName} · {item.financialId}{item.pm ? ` · PM ${item.pm}` : ""}</p></div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${lifecycleClass(item.lifecycle)}`}>{lifecycleLabel(item.lifecycle)}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-slate-50 p-3"><span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Contratado</span><strong className="mt-1 block text-slate-950">{formatUf(item.contractedUF)}</strong></div>
                  <div className="rounded-xl bg-slate-50 p-3"><span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Consumido</span><strong className="mt-1 block text-slate-950">{formatUf(item.consumedUF)}</strong></div>
                  <div className="rounded-xl bg-slate-50 p-3"><span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Costo proyectado</span><strong className={item.budgetDeltaUF !== null && item.budgetDeltaUF > 0 ? "mt-1 block text-red-700" : "mt-1 block text-slate-950"}>{formatUf(item.projectedCostUF)}</strong><span className="text-[11px] text-slate-500">Ppto. {formatUf(item.budgetUF)}</span></div>
                  <div className="rounded-xl bg-slate-50 p-3"><span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Margen proyectado</span><strong className={item.marginGapPp !== null && item.marginGapPp < 0 ? "mt-1 block text-amber-700" : "mt-1 block text-emerald-700"}>{formatPct(item.projectedMarginPct)}</strong><span className="text-[11px] text-slate-500">Target {formatPct(item.marginTargetPct)}</span></div>
                </div>
                <dl className="grid gap-2 text-xs">
                  <div className="flex justify-between gap-4"><dt className="text-slate-500">Facturado en ventana</dt><dd className="text-right font-semibold text-slate-900">{formatNative(item.billedRangeNative)} · {formatUsd(item.billedRangeUsdComparable)}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-slate-500">Facturado histórico</dt><dd className="text-right font-semibold text-slate-900">{formatNative(item.billedHistoricalNative)}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-slate-500">Vencido no facturado</dt><dd className={item.overdueAtCutoffCount > 0 ? "text-right font-semibold text-red-700" : "text-right font-semibold text-slate-600"}>{formatNative(item.overdueAtCutoffNative)} · {item.overdueAtCutoffCount} hitos</dd></div>
                </dl>
                <div className="rounded-xl border border-slate-200 p-3 text-xs"><span className="font-bold text-slate-700">Próxima acción: </span>{item.nextMilestone ? `${item.nextMilestone.name} · ${formatDate(item.nextMilestone.plannedDate)} · ${item.nextMilestone.currency} ${formatNumber(item.nextMilestone.amount, 2)}` : "Sin próximo hito informado"}</div>
              </article>
            ))}
            {data.items.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No existen ítems para la combinación de filtros seleccionada.</p>}
          </div>
          <div className="hidden overflow-x-auto lg:block">
            <table className="min-w-[1320px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Proyecto / cliente</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Contratado</th><th className="px-4 py-3 text-right">Consumido</th><th className="px-4 py-3 text-right">Costo proyectado</th><th className="px-4 py-3 text-right">Margen proy.</th><th className="px-4 py-3 text-right">Facturado ventana</th><th className="px-4 py-3 text-right">Facturado histórico</th><th className="px-4 py-3 text-right">Vencido no facturado</th><th className="px-5 py-3">Próxima acción</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map(item => (
                  <tr key={item.financialId} className="align-top hover:bg-slate-50/70">
                    <td className="px-5 py-4"><p className="max-w-[260px] font-semibold text-slate-950">{item.projectName}</p><p className="mt-1 text-xs text-slate-500">{item.clientName} · {item.financialId}{item.pm ? ` · PM ${item.pm}` : ""}</p></td>
                    <td className="px-4 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${lifecycleClass(item.lifecycle)}`}>{lifecycleLabel(item.lifecycle)}</span><p className="mt-2 max-w-[150px] text-[11px] leading-4 text-slate-500">{item.lifecycleSource === "absent_from_open_universe" ? "No figura abierto en PMO/Servicios" : "Estado respaldado por gestión"}</p></td>
                    <td className="px-4 py-4 text-right font-semibold text-slate-900">{formatUf(item.contractedUF)}</td>
                    <td className="px-4 py-4 text-right">{formatUf(item.consumedUF)}</td>
                    <td className={`px-4 py-4 text-right font-semibold ${item.budgetDeltaUF !== null && item.budgetDeltaUF > 0 ? "text-red-700" : "text-slate-900"}`}>{formatUf(item.projectedCostUF)}<span className="mt-1 block text-[11px] font-normal text-slate-500">vs. ppto. {formatUf(item.budgetUF)}</span></td>
                    <td className={`px-4 py-4 text-right font-semibold ${item.marginGapPp !== null && item.marginGapPp < 0 ? "text-amber-700" : "text-emerald-700"}`}>{formatPct(item.projectedMarginPct)}<span className="mt-1 block text-[11px] font-normal text-slate-500">target {formatPct(item.marginTargetPct)}</span></td>
                    <td className="px-4 py-4 text-right font-semibold text-slate-900">{formatNative(item.billedRangeNative)}<span className="mt-1 block text-[11px] font-normal text-slate-500">{formatUsd(item.billedRangeUsdComparable)}</span></td>
                    <td className="px-4 py-4 text-right font-semibold text-slate-900">{formatNative(item.billedHistoricalNative)}</td>
                    <td className={`px-4 py-4 text-right font-semibold ${item.overdueAtCutoffCount > 0 ? "text-red-700" : "text-slate-500"}`}>{formatNative(item.overdueAtCutoffNative)}<span className="mt-1 block text-[11px] font-normal">{item.overdueAtCutoffCount} hitos</span></td>
                    <td className="px-5 py-4">{item.nextMilestone ? <><p className="max-w-[220px] font-medium text-slate-900">{item.nextMilestone.name}</p><p className="mt-1 text-xs text-slate-500">{formatDate(item.nextMilestone.plannedDate)} · {item.nextMilestone.currency} {formatNumber(item.nextMilestone.amount, 2)}</p></> : <span className="text-slate-500">Sin próximo hito informado</span>}</td>
                  </tr>
                ))}
                {data.items.length === 0 && <tr><td colSpan={10} className="px-6 py-12 text-center text-sm text-slate-500">No existen ítems para la combinación de filtros seleccionada.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="rounded-2xl border border-slate-200 bg-white p-5 text-xs leading-5 text-slate-600 shadow-sm">
          <div className="flex items-start gap-3"><LineChartIcon className="mt-0.5 h-5 w-5 shrink-0 text-pink-600" /><div><p className="font-bold text-slate-900">Reglas de lectura</p><p className="mt-1">“Facturado” proviene de <strong>Estado Facturacion = FACTURADO</strong> y Fecha de Factura de la hoja corporativa; no se infiere desde hitos aceptados. “Vencido no facturado” usa la fecha planificada y no representa una factura SII. Montos UF, CLP y USD se mantienen separados; sólo EN_USD se usa para comparaciones entre monedas.</p></div></div>
        </footer>
      </div>
    </main>
  );
}
