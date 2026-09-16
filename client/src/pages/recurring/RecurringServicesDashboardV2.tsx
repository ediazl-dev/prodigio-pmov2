import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  DatabaseZap,
  FileCheck2,
  FileWarning,
  HelpCircle,
  Layers3,
  Link2,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { RECURRING_SERVICE_TYPE_LABELS } from "@shared/recurringServiceTypes";
import {
  countActiveFilters,
  currencyRows,
  formatCutOffDate,
  formatRecurringMoney,
  formatRecurringPercent,
  RECURRING_HEALTH_UI,
  type RecurringHealthKey,
} from "./recurringDashboardV2ViewModel";

const STATUS_LABELS: Record<string, string> = {
  activo: "Activo",
  pausado: "Pausado",
  completado: "Completado",
  cancelado: "Cancelado",
};

const STAGE_LABELS: Record<string, string> = {
  inicializacion: "Inicialización",
  plan_trabajo: "Plan de trabajo",
  jira_setup: "JSM Setup",
  ejecucion: "Ejecución",
  cierre: "Cierre",
};

const QUALITY_LABELS: Record<string, string> = {
  valid: "Confiable",
  warning: "Con brechas",
  blocked: "Bloqueado",
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthLabel(month: string) {
  return new Intl.DateTimeFormat("es-CL", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
}

const RECONCILIATION_LABELS: Record<string, { label: string; className: string }> = {
  comparable: { label: "Conciliado y comparable", className: "bg-emerald-50 text-emerald-800" },
  reference_not_comparable: { label: "Referencia UF no comparable", className: "bg-blue-50 text-blue-800" },
  missing_reference: { label: "Sin referencia corporativa", className: "bg-amber-50 text-amber-900" },
  ambiguous: { label: "Deal ambiguo", className: "bg-red-50 text-red-800" },
  no_deal: { label: "Sin Deal", className: "bg-red-50 text-red-800" },
};

function KpiCard({
  eyebrow,
  value,
  detail,
  icon: Icon,
  tone = "#175CD3",
  onClick,
}: {
  eyebrow: string;
  value: string | number;
  detail: string;
  icon: typeof Activity;
  tone?: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className="group min-w-0 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{eyebrow}</p>
          <p className="mt-2 truncate text-2xl font-black tracking-tight text-slate-950">{value}</p>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `${tone}12`, color: tone }}>
          <Icon size={18} strokeWidth={2.2} />
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-600">{detail}</p>
    </Tag>
  );
}

function EmptyValue({ text = "Sin evidencia disponible" }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
      <HelpCircle size={12} /> {text}
    </span>
  );
}

export default function RecurringServicesDashboardV2() {
  const [, navigate] = useLocation();
  const [cutOffDate, setCutOffDate] = useState(todayIso);
  const [clientName, setClientName] = useState("all");
  const [status, setStatus] = useState("all");
  const [serviceType, setServiceType] = useState("all");
  const [health, setHealth] = useState("all");
  const [currency, setCurrency] = useState("all");
  const [search, setSearch] = useState("");

  const filters = useMemo(
    () => ({ cutOffDate, clientName, status, serviceType, health, currency, search }),
    [cutOffDate, clientName, status, serviceType, health, currency, search],
  );
  const input = useMemo(
    () => ({
      cutOffDate,
      ...(clientName !== "all" ? { clientName } : {}),
      ...(status !== "all" ? { status } : {}),
      ...(serviceType !== "all" ? { serviceType } : {}),
      ...(health !== "all" ? { health } : {}),
      ...(currency !== "all" ? { currency } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
    }),
    [cutOffDate, clientName, status, serviceType, health, currency, search],
  );

  const { data, isLoading, error, refetch, isFetching } = trpc.recurringServices.dashboardV2.useQuery(input as any, {
    staleTime: 30_000,
  });

  const clearFilters = () => {
    setClientName("all");
    setStatus("all");
    setServiceType("all");
    setHealth("all");
    setCurrency("all");
    setSearch("");
  };

  if (isLoading) {
    return (
      <div className="grid min-h-[420px] place-items-center rounded-2xl border border-slate-200 bg-white">
        <div className="text-center">
          <RefreshCw className="mx-auto animate-spin text-[#E91E8C]" size={28} />
          <p className="mt-3 text-sm font-semibold text-slate-600">Construyendo la vista consolidada…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
        <div className="flex items-center gap-2 font-bold"><AlertTriangle size={18} /> No fue posible cargar la Torre de Control</div>
        <p className="mt-2 text-sm">{error?.message ?? "La respuesta consolidada no está disponible."}</p>
        <Button className="mt-4" variant="outline" onClick={() => refetch()}>Reintentar</Button>
      </div>
    );
  }

  const { kpis, metadata, filterOptions, matrix, quality, evidenceInventory, financeAnalytics, trends } = data;
  const finance = currencyRows(kpis.financeByCurrency);
  const activeFilterCount = countActiveFilters(filters);
  const requiresAttention = kpis.healthCounts.critical + kpis.healthCounts.attention;
  const operationalCoverage = kpis.totalServices > 0
    ? Math.round((kpis.incidents.availableServices / kpis.totalServices) * 100)
    : 0;

  return (
    <div className="space-y-5 pb-8">
      <section className="overflow-hidden rounded-2xl bg-[#0A1628] text-white shadow-[0_18px_50px_rgba(10,22,40,0.18)]">
        <div className="border-b border-white/10 px-5 py-5 sm:px-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[#E91E8C]/40 bg-[#E91E8C]/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#FF85C8]">
                  Torre de control V2
                </span>
                <span className="text-xs text-slate-400">Contrato de métricas {metadata.contractVersion}</span>
              </div>
              <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] sm:text-3xl">
                {requiresAttention} de {kpis.totalServices} servicios requieren atención
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Lectura ejecutiva de cartera, facturación, entregables, formalidad e indicadores operacionales. Los valores N/D no se reemplazan por supuestos.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.07] px-3 py-2 text-xs font-semibold text-slate-200">
                <CalendarDays size={15} className="text-[#FF85C8]" /> Corte
                <input
                  type="date"
                  value={cutOffDate}
                  onChange={event => setCutOffDate(event.target.value)}
                  className="bg-transparent font-bold text-white outline-none [color-scheme:dark]"
                />
              </label>
              <Button
                variant="outline"
                onClick={() => refetch()}
                disabled={isFetching}
                className="border-white/20 bg-white/[0.07] text-white hover:bg-white/15 hover:text-white"
              >
                <RefreshCw size={15} className={isFetching ? "mr-2 animate-spin" : "mr-2"} /> Actualizar lectura
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-y divide-white/10 sm:grid-cols-4 sm:divide-y-0">
          {(Object.keys(RECURRING_HEALTH_UI) as RecurringHealthKey[]).map(key => {
            const item = RECURRING_HEALTH_UI[key];
            const selected = health === key;
            return (
              <button
                key={key}
                onClick={() => setHealth(selected ? "all" : key)}
                aria-pressed={selected}
                className="group px-5 py-4 text-left transition hover:bg-white/[0.06]"
              >
                <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  <i className="h-2 w-2 rounded-full" style={{ background: item.tone }} /> {item.shortLabel}
                </span>
                <span className="mt-1 block text-2xl font-black">{kpis.healthCounts[key]}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 border-t border-white/10 px-5 py-3 text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <span>Fecha de corte: <b className="text-slate-200">{formatCutOffDate(metadata.cutOffDate)}</b></span>
          <span>Último snapshot JSM: <b className="text-slate-200">{metadata.latestJsmSnapshotAt ? new Date(metadata.latestJsmSnapshotAt).toLocaleString("es-CL") : "N/D"}</b></span>
          <span>{metadata.totalAfterFilters} de {metadata.totalBeforeFilters} servicios visibles</span>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-black text-slate-900"><SlidersHorizontal size={16} /> Filtros ejecutivos</div>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="inline-flex items-center gap-1 text-xs font-bold text-[#175CD3] hover:text-[#0A4AA8]">
              <X size={13} /> Limpiar {activeFilterCount} filtro{activeFilterCount === 1 ? "" : "s"}
            </button>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="relative md:col-span-2 xl:col-span-2">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cliente, servicio o Deal" className="pl-9" />
          </div>
          <Select value={clientName} onValueChange={setClientName}>
            <SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos los clientes</SelectItem>{filterOptions.clients.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos los estados</SelectItem>{filterOptions.statuses.map(item => <SelectItem key={item} value={item}>{STATUS_LABELS[item] ?? item}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={serviceType} onValueChange={setServiceType}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos los tipos</SelectItem>{filterOptions.serviceTypes.map(item => <SelectItem key={item} value={item}>{RECURRING_SERVICE_TYPE_LABELS[item as keyof typeof RECURRING_SERVICE_TYPE_LABELS] ?? item}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger><SelectValue placeholder="Moneda" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas las monedas</SelectItem>{filterOptions.currencies.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard eyebrow="Servicios gestionados" value={kpis.totalServices} detail={`${kpis.activeServices} activos en el universo filtrado`} icon={Layers3} />
        <KpiCard
          eyebrow="Reportes exigibles"
          value={formatRecurringPercent(kpis.reports.deliveryRate)}
          detail={`${kpis.reports.completedDue} entregados · ${kpis.reports.overdue} pendientes vencidos`}
          icon={FileCheck2}
          tone={kpis.reports.overdue > 0 ? "#B42318" : "#067647"}
        />
        <KpiCard
          eyebrow="Formalidad contractual"
          value={`${kpis.formalization.complete}/${kpis.totalServices}`}
          detail={`${kpis.formalization.partial + kpis.formalization.missing} servicios con evidencia incompleta`}
          icon={ShieldCheck}
          tone={kpis.formalization.partial + kpis.formalization.missing > 0 ? "#B54708" : "#067647"}
        />
        <KpiCard
          eyebrow="Cobertura operacional"
          value={`${operationalCoverage}%`}
          detail={`${kpis.incidents.availableServices} servicios con snapshot JSM vigente`}
          icon={DatabaseZap}
          tone={operationalCoverage === 100 ? "#067647" : "#475467"}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.45fr_0.55fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Compromiso financiero</p>
              <h3 className="mt-1 text-lg font-black text-slate-950">Contratado, facturado y cobrado por moneda</h3>
            </div>
            <span className="text-xs text-slate-500">Sin conversión ni suma entre monedas</span>
          </div>
          {finance.length === 0 ? (
            <div className="mt-5"><EmptyValue text="Sin planificación financiera" /></div>
          ) : (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {finance.map(row => {
                const invoicedPct = row.contracted > 0 ? Math.min(100, (row.invoiced / row.contracted) * 100) : 0;
                const collectedPct = row.contracted > 0 ? Math.min(100, (row.collected / row.contracted) * 100) : 0;
                return (
                  <article key={row.currency} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between">
                      <span className="rounded-lg bg-[#0A1628] px-2.5 py-1 text-xs font-black text-white">{row.currency}</span>
                      {row.overdueItems > 0 && <span className="text-xs font-bold text-red-700">{row.overdueItems} cuota{row.overdueItems === 1 ? "" : "s"} vencida{row.overdueItems === 1 ? "" : "s"}</span>}
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <div><p className="text-[9px] font-bold uppercase text-slate-500">Contratado</p><p className="mt-1 text-sm font-black text-slate-950">{formatRecurringMoney(row.contracted, row.currency)}</p></div>
                      <div><p className="text-[9px] font-bold uppercase text-slate-500">Facturado</p><p className="mt-1 text-sm font-black text-[#175CD3]">{formatRecurringMoney(row.invoiced, row.currency)}</p></div>
                      <div><p className="text-[9px] font-bold uppercase text-slate-500">Cobrado</p><p className="mt-1 text-sm font-black text-[#067647]">{formatRecurringMoney(row.collected, row.currency)}</p></div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-[#175CD3]" style={{ width: `${invoicedPct}%` }} /></div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-[#12A08D]" style={{ width: `${collectedPct}%` }} /></div>
                    </div>
                    <div className="mt-3 flex justify-between text-[10px] font-semibold text-slate-500">
                      <span>CxC {formatRecurringMoney(row.accountsReceivable, row.currency)}</span>
                      <span className={row.overdue > 0 ? "text-red-700" : ""}>Vencido {formatRecurringMoney(row.overdue, row.currency)}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Confiabilidad de la lectura</p>
          <div className="mt-3 flex items-end gap-2"><span className="text-3xl font-black text-slate-950">{quality.summary.valid}</span><span className="pb-1 text-xs text-slate-500">servicios confiables</span></div>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-xs"><span className="font-semibold text-amber-900">Con brechas</span><b className="text-amber-900">{quality.summary.warning}</b></div>
            <div className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2 text-xs"><span className="font-semibold text-red-900">Bloqueados</span><b className="text-red-900">{quality.summary.blocked}</b></div>
            <div className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-xs"><span className="font-semibold text-slate-700">Hallazgos</span><b className="text-slate-900">{quality.summary.issueCount}</b></div>
          </div>
          <div className="mt-4 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-600">
            Evidencias D2: {evidenceInventory.reportEvidence} reportes, {evidenceInventory.financialEvidence} financieras, {evidenceInventory.documentControls} controles documentales y {evidenceInventory.jsmSnapshots} snapshots.
          </div>
        </aside>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Analítica financiera recurrente</p>
              <h3 className="mt-1 text-lg font-black text-slate-950">Programado versus facturado, cobrado y vencido</h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">La planificación local se presenta por moneda. La referencia corporativa UF se compara solo cuando la moneda contractual también es UF.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl bg-white px-3 py-2 shadow-sm"><p className="text-[9px] font-bold uppercase text-slate-500">Deals conciliados</p><p className="mt-1 text-lg font-black text-slate-950">{financeAnalytics.summary.reconciledServices}/{kpis.totalServices}</p></div>
              <div className="rounded-xl bg-white px-3 py-2 shadow-sm"><p className="text-[9px] font-bold uppercase text-slate-500">Comparables UF</p><p className="mt-1 text-lg font-black text-slate-950">{financeAnalytics.summary.comparableUfServices}</p></div>
              <div className="rounded-xl bg-white px-3 py-2 shadow-sm"><p className="text-[9px] font-bold uppercase text-slate-500">Facturas verificadas</p><p className="mt-1 text-lg font-black text-slate-950">{financeAnalytics.summary.verifiedInvoiceEvidence}</p></div>
              <div className="rounded-xl bg-white px-3 py-2 shadow-sm"><p className="text-[9px] font-bold uppercase text-slate-500">Pagos verificados</p><p className="mt-1 text-lg font-black text-slate-950">{financeAnalytics.summary.verifiedPaymentEvidence}</p></div>
            </div>
          </div>
        </div>

        <div className="grid xl:grid-cols-[0.9fr_1.1fr]">
          <div className="border-b border-slate-200 p-5 sm:p-6 xl:border-b-0 xl:border-r">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-black text-slate-900"><TrendingUp size={16} className="text-[#175CD3]" /> Tendencia mensual</div>
              <span className="text-[10px] font-semibold text-slate-500">Hasta {formatCutOffDate(metadata.cutOffDate)}</span>
            </div>
            {trends.finance.length === 0 ? (
              <div className="mt-5"><EmptyValue text="Sin cuotas programadas" /></div>
            ) : (
              <div className="mt-4 max-h-[330px] space-y-3 overflow-y-auto pr-1">
                {trends.finance.map(item => {
                  const maxValue = Math.max(item.scheduled, item.invoiced, item.collected, 1);
                  return (
                    <div key={`${item.month}-${item.currency}`} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center justify-between"><b className="text-xs text-slate-900">{monthLabel(item.month)}</b><span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-700">{item.currency}</span></div>
                      <div className="mt-3 space-y-2 text-[10px] font-semibold text-slate-600">
                        {[
                          ["Programado", item.scheduled, "#94A3B8"],
                          ["Facturado", item.invoiced, "#175CD3"],
                          ["Cobrado", item.collected, "#12A08D"],
                        ].map(([label, value, color]) => (
                          <div key={String(label)} className="grid grid-cols-[68px_1fr_auto] items-center gap-2">
                            <span>{label}</span><span className="h-1.5 overflow-hidden rounded-full bg-slate-100"><i className="block h-full rounded-full" style={{ width: `${(Number(value) / maxValue) * 100}%`, background: String(color) }} /></span><b className="text-slate-800">{formatRecurringMoney(Number(value), item.currency)}</b>
                          </div>
                        ))}
                      </div>
                      {item.overdue > 0 && <p className="mt-2 text-right text-[10px] font-bold text-red-700">Vencido {formatRecurringMoney(item.overdue, item.currency)}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-5 sm:p-6">
            <div className="flex items-center gap-2 text-sm font-black text-slate-900"><Link2 size={16} className="text-[#E91E8C]" /> Reconciliación por servicio y Deal</div>
            <div className="mt-4 space-y-3">
              {financeAnalytics.services.map(service => {
                const reconciliation = RECONCILIATION_LABELS[service.reconciliationStatus] ?? RECONCILIATION_LABELS.missing_reference;
                return (
                  <article key={service.serviceId} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-950">{service.serviceName}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">{service.clientName} · Deal {service.dealId ?? "N/D"}</p>
                      </div>
                      <span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-black ${reconciliation.className}`}>{reconciliation.label}</span>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {service.localCurrencies.map(row => (
                        <div key={row.currency} className="rounded-lg bg-slate-50 p-3">
                          <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase text-slate-500">Plan local {row.currency}</span><WalletCards size={14} className="text-slate-400" /></div>
                          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-[10px]">
                            <span className="text-slate-500">Programado</span><b className="text-right text-slate-900">{formatRecurringMoney(row.scheduled, row.currency)}</b>
                            <span className="text-slate-500">Facturado</span><b className="text-right text-[#175CD3]">{formatRecurringMoney(row.invoiced, row.currency)}</b>
                            <span className="text-slate-500">Cobrado</span><b className="text-right text-emerald-700">{formatRecurringMoney(row.collected, row.currency)}</b>
                            <span className="text-slate-500">Vencido</span><b className={`text-right ${row.overdue > 0 ? "text-red-700" : "text-slate-900"}`}>{formatRecurringMoney(row.overdue, row.currency)}</b>
                          </div>
                        </div>
                      ))}
                      <div className="rounded-lg bg-slate-50 p-3">
                        <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase text-slate-500">Referencia corporativa</span><ReceiptText size={14} className="text-slate-400" /></div>
                        {service.corporateReference ? (
                          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-[10px]">
                            <span className="text-slate-500">Venta</span><b className="text-right text-slate-900">{service.corporateReference.valorVentaUF === null ? "N/D" : formatRecurringMoney(service.corporateReference.valorVentaUF, "UF")}</b>
                            <span className="text-slate-500">Utilizado</span><b className="text-right text-slate-900">{service.corporateReference.utilizadoUF === null ? "N/D" : formatRecurringMoney(service.corporateReference.utilizadoUF, "UF")}</b>
                            <span className="text-slate-500">Proyectado</span><b className="text-right text-slate-900">{service.corporateReference.proyectadoUF === null ? "N/D" : formatRecurringMoney(service.corporateReference.proyectadoUF, "UF")}</b>
                            <span className="text-slate-500">Línea</span><b className="text-right text-slate-900">{service.corporateReference.lineaNegocio ?? "N/D"}</b>
                          </div>
                        ) : <div className="mt-3"><EmptyValue text="Deal no presente en la fuente corporativa" /></div>}
                      </div>
                    </div>
                    <p className="mt-2 text-[10px] leading-4 text-slate-500">Evidencia confirmada: {service.verifiedEvidenceByCurrency.reduce((sum, row) => sum + row.items, 0)} registro(s). La ausencia de evidencia no cambia automáticamente el estado de la cuota.</p>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Matriz priorizada</p>
            <h3 className="mt-1 text-lg font-black text-slate-950">Situación de cada servicio</h3>
          </div>
          <Select value={health} onValueChange={setHealth}>
            <SelectTrigger className="w-full sm:w-[190px]"><SelectValue placeholder="Salud" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toda la salud</SelectItem>
              {(Object.keys(RECURRING_HEALTH_UI) as RecurringHealthKey[]).map(key => <SelectItem key={key} value={key}>{RECURRING_HEALTH_UI[key].shortLabel}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {matrix.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <Search className="mx-auto text-slate-300" size={36} />
            <p className="mt-3 font-bold text-slate-800">No hay servicios para estos filtros</p>
            <button onClick={clearFilters} className="mt-2 text-sm font-bold text-[#175CD3]">Restablecer filtros</button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {matrix.map(service => {
              const healthUi = RECURRING_HEALTH_UI[service.health as RecurringHealthKey];
              const serviceFinance = currencyRows(service.financeByCurrency);
              return (
                <button
                  key={service.serviceId}
                  onClick={() => navigate(`/recurring-services/${service.serviceId}`)}
                  className="grid w-full gap-4 px-5 py-5 text-left transition hover:bg-slate-50 md:grid-cols-12 md:items-center"
                >
                  <div className="md:col-span-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide" style={{ color: healthUi.tone, background: healthUi.surface, borderColor: healthUi.border }}>{healthUi.label}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{RECURRING_SERVICE_TYPE_LABELS[service.serviceType as keyof typeof RECURRING_SERVICE_TYPE_LABELS] ?? service.serviceType}</span>
                      <span className="text-[10px] font-bold uppercase text-slate-400">{STATUS_LABELS[service.status] ?? service.status}</span>
                    </div>
                    <p className="mt-2 font-black text-slate-950">{service.serviceName}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{service.clientName} · Deal {service.dealId ?? "N/D"} · {STAGE_LABELS[service.currentStage] ?? service.currentStage}</p>
                    {service.healthSignals.length > 0 ? (
                      <div className="mt-2 space-y-1">
                        {service.healthSignals.slice(0, 2).map(signal => <p key={signal.code} className="text-[11px] font-semibold text-slate-700">• {signal.message}</p>)}
                      </div>
                    ) : <p className="mt-2 text-[11px] font-semibold text-emerald-700">Sin alertas según la evidencia disponible.</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-3 md:col-span-3">
                    {serviceFinance.map(item => (
                      <div key={item.currency} className="rounded-lg bg-slate-50 p-2.5">
                        <p className="text-[9px] font-bold uppercase text-slate-500">{item.currency} contratado</p>
                        <p className="mt-1 text-xs font-black text-slate-900">{formatRecurringMoney(item.contracted, item.currency)}</p>
                        <p className={`mt-1 text-[10px] font-bold ${item.overdue > 0 ? "text-red-700" : "text-slate-500"}`}>Vencido {formatRecurringMoney(item.overdue, item.currency)}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-3 md:col-span-4">
                    <div><p className="text-[9px] font-bold uppercase text-slate-400">Reportes</p><p className={`mt-1 text-sm font-black ${service.reports.overdue > 0 ? "text-red-700" : "text-slate-900"}`}>{formatRecurringPercent(service.reports.deliveryRate)}</p><p className="text-[10px] text-slate-500">{service.reports.overdue} vencidos</p></div>
                    <div><p className="text-[9px] font-bold uppercase text-slate-400">Formalidad</p><p className="mt-1 text-sm font-black text-slate-900">{service.formalization.coveragePercent}%</p><p className="text-[10px] text-slate-500">{service.formalization.missing.length ? `Falta ${service.formalization.missing.join(", ")}` : "Completa"}</p></div>
                    <div><p className="text-[9px] font-bold uppercase text-slate-400">SLA respuesta</p><p className="mt-1 text-sm font-black text-slate-900">{formatRecurringPercent(service.sla.firstResponseCompliance)}</p><p className="text-[10px] text-slate-500">{service.incidents.open === null ? "Incidentes N/D" : `${service.incidents.open} abiertos`}</p></div>
                  </div>

                  <div className="flex items-center justify-between md:col-span-1 md:justify-end">
                    <span className="text-[10px] font-bold text-slate-500 md:hidden">Calidad {service.quality.score}% · {QUALITY_LABELS[service.quality.status] ?? service.quality.status}</span>
                    <ArrowRight size={18} className="text-slate-400" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <footer className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <span className="inline-flex items-center gap-2"><BarChart3 size={14} /> Generado {new Date(metadata.generatedAt).toLocaleString("es-CL")} · corte {formatCutOffDate(metadata.cutOffDate)}</span>
        <span className="inline-flex items-center gap-2"><CircleDollarSign size={14} /> Facturado y cobrado provienen del estado real de cada cuota.</span>
      </footer>
    </div>
  );
}
