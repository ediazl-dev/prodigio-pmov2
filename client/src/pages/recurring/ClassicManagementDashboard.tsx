import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarRange,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  FileWarning,
  Landmark,
  Link2Off,
  ReceiptText,
  ShieldCheck,
  Tickets,
} from "lucide-react";
import type { RouterOutputs } from "@/lib/trpc";
import {
  buildActionQueue,
  buildEvidenceTabs,
  defaultEvidenceTab,
  type SignalDomain,
} from "./recurringDashboardV3ViewModel";
import {
  buildClassicManagementModel,
  DEFAULT_CLASSIC_CONTROLS,
  formatSlaMinutes,
  type ClassicDashboardControls,
} from "./classicManagementViewModel";
import { RECURRING_SERVICE_TYPE_LABELS, RECURRING_SERVICE_TYPE_OPTIONS } from "@shared/recurringServiceTypes";
import { EvidenceTabs } from "./components/EvidenceTabs";
import { DeliverablesPanel, FormalityPanel, OperationsPanel } from "./components/EvidencePanels";

const PRIORITY_LABELS: Record<string, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

const RECONCILIATION_LABELS: Record<string, { label: string; className: string }> = {
  matched: { label: "Conciliado", className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  currency_mismatch: { label: "Moneda distinta", className: "border-red-200 bg-red-50 text-red-800" },
  amount_mismatch: { label: "Monto distinto", className: "border-amber-200 bg-amber-50 text-amber-800" },
  ambiguous: { label: "Conciliación ambigua", className: "border-red-200 bg-red-50 text-red-800" },
  missing_invoice: { label: "Sin factura verificada", className: "border-amber-200 bg-amber-50 text-amber-900" },
  no_schedule: { label: "Sin programación", className: "border-slate-200 bg-slate-50 text-slate-700" },
};

function formatMoney(value: number, currency: string) {
  return `${currency} ${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(value)}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "N/D";
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatMonth(value: string) {
  const [year, month] = value.split("-");
  const labels = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${labels[Number(month) - 1] ?? month} ${year.slice(2)}`;
}

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  tone = "blue",
}: {
  label: string;
  value: React.ReactNode;
  note: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone?: "blue" | "green" | "amber" | "red";
}) {
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-red-200 bg-red-50 text-red-700",
  };
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <span className={`grid h-8 w-8 place-items-center rounded-lg border ${tones[tone]}`}><Icon size={15} /></span>
      </div>
      <div className="mt-3 font-mono text-2xl font-black text-slate-950">{value}</div>
      <p className="mt-2 text-[10.5px] leading-4 text-slate-600">{note}</p>
    </article>
  );
}

function SourceCut({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-[10px] font-bold text-slate-800">{formatDate(value)}</p>
    </div>
  );
}

function BillingEvolution({
  rows,
  currency,
  comparison,
}: {
  rows: ReturnType<typeof buildClassicManagementModel>["financeMonthly"];
  currency: string;
  comparison: "monthly" | "cumulative";
}) {
  const visible = rows.filter(row => row.currency === currency);
  if (visible.length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">No hay programación ni facturas {currency} en la ventana seleccionada.</p>;
  }
  const max = Math.max(...visible.flatMap(row => [row.expected, row.invoiced, row.future]), 1);
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-label={`Esperado versus facturado real en ${currency}`}>
      {visible.map(row => (
        <article key={`${row.month}:${row.currency}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <b className="text-xs text-slate-900">{formatMonth(row.month)}</b>
            <span className="text-[9px] font-bold uppercase text-slate-500">{comparison === "monthly" ? "Mes" : "Acumulado"}</span>
          </div>
          <div className="mt-3 space-y-2 text-[10px]">
            {[
              ["Esperado al corte", row.expected, "bg-slate-500"],
              ["Facturado real", row.invoiced, "bg-blue-600"],
              ["Cuotas futuras", row.future, "border border-dashed border-amber-500 bg-amber-100"],
            ].map(([label, value, style]) => (
              <div key={String(label)} className="grid grid-cols-[92px_1fr_auto] items-center gap-2">
                <span className="text-slate-600">{label}</span>
                <span className="h-2 overflow-hidden rounded-full bg-white">
                  <i className={`block h-full rounded-full ${style}`} style={{ width: `${Math.max(Number(value) > 0 ? 3 : 0, (Number(value) / max) * 100)}%` }} />
                </span>
                <b className="font-mono text-slate-900">{formatMoney(Number(value), currency)}</b>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

function TicketStockEvolution({ rows }: { rows: RouterOutputs["recurringServices"]["dashboardV2"]["operations"]["monthly"] }) {
  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">Sin snapshots JSM suficientes en la ventana seleccionada.</p>;
  }
  const max = Math.max(...rows.flatMap(row => [row.open, row.highOpen, row.unresolvedOver30Days]), 1);
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map(row => (
        <article key={row.month} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <b className="text-xs text-slate-900">{formatMonth(row.month)}</b>
            <span className="text-[9px] font-bold text-slate-500">{row.servicesMeasured} servicio(s) observado(s)</span>
          </div>
          <div className="mt-3 flex h-20 items-end gap-2" aria-label={`${row.open} abiertos, ${row.highOpen} altos y ${row.unresolvedOver30Days} con más de 30 días`}>
            <div className="flex-1 rounded-t-md bg-blue-500" style={{ height: `${Math.max(row.open > 0 ? 4 : 0, (row.open / max) * 100)}%` }} title={`${row.open} abiertos`} />
            <div className="flex-1 rounded-t-md bg-amber-500" style={{ height: `${Math.max(row.highOpen > 0 ? 4 : 0, (row.highOpen / max) * 100)}%` }} title={`${row.highOpen} altos`} />
            <div className="flex-1 rounded-t-md bg-red-500" style={{ height: `${Math.max(row.unresolvedOver30Days > 0 ? 4 : 0, (row.unresolvedOver30Days / max) * 100)}%` }} title={`${row.unresolvedOver30Days} con más de 30 días`} />
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[9px]">
            <span className="text-blue-700">Abiertos <b className="block font-mono text-sm">{row.open}</b></span>
            <span className="text-amber-700">Altos <b className="block font-mono text-sm">{row.highOpen}</b></span>
            <span className="text-red-700">+30 días <b className="block font-mono text-sm">{row.unresolvedOver30Days}</b></span>
          </div>
        </article>
      ))}
    </div>
  );
}

function FinanceEvidencePanel({ data }: { data: RouterOutputs["recurringServices"]["dashboardV2"] }) {
  return (
    <div className="p-5 sm:p-6">
      <div className="flex items-center gap-2"><ReceiptText size={16} className="text-[#175CD3]" /><h4 className="text-sm font-black text-slate-950">Programación contractual y factura corporativa</h4></div>
      <p className="mt-1 text-[11px] text-slate-600">La factura real se acredita sólo desde la fuente financiera; los estados locales quedan como señal de conciliación.</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {data.management.services.map(service => {
          const status = RECONCILIATION_LABELS[service.reconciliationStatus] ?? RECONCILIATION_LABELS.no_schedule;
          const expected = service.expectedCurrencies.map(item => formatMoney((service.expectedToDate[item] ?? 0) + (service.expectedFuture[item] ?? 0), item));
          const invoiced = service.invoiceCurrencies.map(item => formatMoney(service.invoicedReal[item] ?? 0, item));
          return (
            <article key={service.serviceId} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><b className="text-xs text-slate-950">{service.serviceName}</b><p className="mt-1 text-[10px] text-slate-600">{service.clientName} · Deal {service.dealId ?? "N/D"}</p></div><span className={`w-fit rounded-full border px-2 py-1 text-[9px] font-black ${status.className}`}>{status.label}</span></div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-[10px]"><div><p className="font-bold uppercase text-slate-500">Plan esperado</p><p className="mt-1 font-mono font-black text-slate-950">{expected.join(" · ") || "N/D"}</p></div><div><p className="font-bold uppercase text-slate-500">Factura real</p><p className="mt-1 font-mono font-black text-emerald-700">{invoiced.join(" · ") || "Sin factura verificada"}</p></div></div>
              {service.reconciliationStatus === "currency_mismatch" && <p className="mt-3 rounded-lg bg-red-50 p-2 text-[10px] font-bold text-red-800">Monedas no comparables; porcentaje bloqueado.</p>}
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function ClassicManagementDashboard({
  data,
  onOpenService,
  canManageJsm = false,
  onConfigureJsm = () => undefined,
  controls,
  onControlsChange,
}: {
  data: RouterOutputs["recurringServices"]["dashboardV2"];
  legacy?: RouterOutputs["recurringServices"]["dashboardKpis"];
  onOpenService: (serviceId: number) => void;
  canManageJsm?: boolean;
  onConfigureJsm?: () => void;
  controls?: ClassicDashboardControls;
  onControlsChange?: (next: ClassicDashboardControls) => void;
}) {
  const [localControls, setLocalControls] = useState(DEFAULT_CLASSIC_CONTROLS);
  const effectiveControls = controls ?? localControls;
  const updateControls = (patch: Partial<ClassicDashboardControls>) => {
    const next = { ...effectiveControls, ...patch };
    if (onControlsChange) onControlsChange(next);
    else setLocalControls(next);
  };
  const model = useMemo(
    () => buildClassicManagementModel(data, { comparison: effectiveControls.comparison, onlyExceptions: effectiveControls.onlyExceptions }),
    [data, effectiveControls.comparison, effectiveControls.onlyExceptions],
  );
  const [selectedCurrency, setSelectedCurrency] = useState(() => model.finance.some(row => row.currency === "USD") ? "USD" : model.finance[0]?.currency ?? "USD");
  const activeCurrency = model.finance.find(row => row.currency === selectedCurrency) ?? model.finance[0];
  const [expandedServiceId, setExpandedServiceId] = useState<number | null>(null);
  const evidenceQueue = buildActionQueue(data.matrix, { stageLabels: {} });
  const evidenceTabs = buildEvidenceTabs(data, evidenceQueue);
  const [activeEvidenceTab, setActiveEvidenceTab] = useState<SignalDomain>(() => defaultEvidenceTab(evidenceTabs));
  const tabByKey = Object.fromEntries(evidenceTabs.map(tab => [tab.key, tab])) as Record<SignalDomain, (typeof evidenceTabs)[number]>;
  const usd = model.finance.find(row => row.currency === "USD");
  const usdContracts = model.allServices.filter(service => service.expectedCurrencies.includes("USD"));
  const complianceMeasured = model.summary.slaMeasured > 0;

  return (
    <div className="mb-8 space-y-5" data-testid="classic-management-dashboard">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.13em] text-[#175CD3]"><BarChart3 size={15} /> Dashboard gerencial consolidado</div>
            <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">Estado verificable de los servicios recurrentes</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">Separa programación contractual, facturas corporativas, operación JSM y evidencia de gobierno. El ciclo financiero termina en <b>Facturado</b>.</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:w-[520px]">
            <SourceCut label="Fuente financiera" value={model.sourceCuts.financialAt} />
            <SourceCut label="Snapshot JSM" value={model.sourceCuts.jsmAt} />
            <SourceCut label="Validación documental" value={model.sourceCuts.documentsAt} />
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7" aria-label="Filtros del dashboard gerencial">
          <label className="text-[10px] font-bold text-slate-600">Corte
            <input aria-label="Fecha de corte" type="date" value={effectiveControls.cutOffDate} onChange={event => updateControls({ cutOffDate: event.target.value })} className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-900" />
          </label>
          <label className="text-[10px] font-bold text-slate-600">Ventana
            <select aria-label="Ventana temporal" value={effectiveControls.window} onChange={event => updateControls({ window: event.target.value as ClassicDashboardControls["window"] })} className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-900">
              <option value="current_month">Mes actual</option><option value="last_3_months">Últimos 3 meses</option><option value="ytd">Año a la fecha</option><option value="contract">Contrato completo</option><option value="custom">Rango personalizado</option>
            </select>
          </label>
          {effectiveControls.window === "custom" && <label className="text-[10px] font-bold text-slate-600">Desde
            <input aria-label="Fecha inicial" type="date" max={effectiveControls.cutOffDate} value={effectiveControls.customFromDate} onChange={event => updateControls({ customFromDate: event.target.value })} className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-900" />
          </label>}
          <label className="text-[10px] font-bold text-slate-600">Comparación
            <select aria-label="Tipo de comparación" value={effectiveControls.comparison} onChange={event => updateControls({ comparison: event.target.value as ClassicDashboardControls["comparison"] })} className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-900"><option value="monthly">Mensual</option><option value="cumulative">Acumulada</option></select>
          </label>
          <label className="text-[10px] font-bold text-slate-600">Cliente
            <select aria-label="Filtrar por cliente" value={effectiveControls.clientName} onChange={event => updateControls({ clientName: event.target.value })} className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-900"><option value="all">Todos</option>{data.filterOptions.clients.map(client => <option key={client} value={client}>{client}</option>)}</select>
          </label>
          <label className="text-[10px] font-bold text-slate-600">Tipo
            <select aria-label="Filtrar por tipo" value={effectiveControls.serviceType} onChange={event => updateControls({ serviceType: event.target.value })} className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-900"><option value="all">Todos</option>{RECURRING_SERVICE_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
          </label>
          <label className="text-[10px] font-bold text-slate-600">Estado
            <select aria-label="Filtrar por estado" value={effectiveControls.status} onChange={event => updateControls({ status: event.target.value })} className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-900"><option value="all">Todos</option>{data.filterOptions.statuses.map(status => <option key={status} value={status}>{status}</option>)}</select>
          </label>
          <label className="flex h-9 items-center gap-2 self-end rounded-lg border border-slate-300 bg-slate-50 px-3 text-[10px] font-black text-slate-700">
            <input aria-label="Mostrar sólo excepciones" type="checkbox" checked={effectiveControls.onlyExceptions} onChange={event => updateControls({ onlyExceptions: event.target.checked })} /> Sólo excepciones
          </label>
        </div>
      </section>

      <section data-testid="usd-real-answer" className={`rounded-2xl border p-5 shadow-sm ${usd?.invoicedReal ? "border-emerald-200 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.13em] text-amber-800">Respuesta financiera inmediata</p>
            <h3 className="mt-1 text-lg font-black text-slate-950">Facturación real USD: {formatMoney(usd?.invoicedReal ?? 0, "USD")}</h3>
            <p className="mt-1 text-xs leading-5 text-slate-700">{usd?.invoicedReal ? "Existen facturas corporativas USD verificadas en la ventana." : "Ningún servicio tiene una factura corporativa USD verificada en la ventana seleccionada."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {usdContracts.map(service => <span key={service.serviceId} className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-[10px] font-bold text-slate-800">{service.clientName} · Deal {service.dealId ?? "N/D"} programado en USD</span>)}
          </div>
        </div>
      </section>

      <section aria-label="Respuestas gerenciales inmediatas" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Servicios" value={model.summary.services} note="Universo después de filtros." icon={Landmark} />
        <MetricCard label="Factura verificada" value={`${model.summary.withVerifiedInvoices}/${model.summary.services}`} note="Con al menos una factura corporativa." icon={ReceiptText} tone="green" />
        <MetricCard label="Excepciones financieras" value={model.summary.financeExceptions} note="Moneda, monto, ambigüedad o factura ausente." icon={AlertTriangle} tone={model.summary.financeExceptions > 0 ? "red" : "green"} />
        <MetricCard label="Cobertura JSM" value={`${model.summary.jsmLinked}/${model.summary.services}`} note="Service Desk confirmado." icon={Tickets} tone="amber" />
        <MetricCard label="SLA medible" value={`${model.summary.slaMeasured}/${model.summary.services}`} note="Exige denominador de tickets medidos." icon={ShieldCheck} tone={model.summary.slaMeasured > 0 ? "green" : "amber"} />
        <MetricCard label="Multas" value={model.summary.penalties} note="Registros persistidos al corte." icon={CircleDollarSign} tone={model.summary.penalties > 0 ? "red" : "green"} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#175CD3]">Finanzas por moneda</p><h3 className="mt-1 text-base font-black text-slate-950">Quién programa y quién factura</h3><p className="mt-1 text-[11px] text-slate-600">Nunca se suman ni convierten UF y USD. Las diferencias de moneda bloquean comparaciones engañosas.</p></div>
          <div role="tablist" aria-label="Moneda financiera" className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            {model.finance.map(row => <button key={row.currency} type="button" role="tab" aria-selected={activeCurrency?.currency === row.currency} onClick={() => setSelectedCurrency(row.currency)} className={`rounded-lg px-4 py-2 text-xs font-black ${activeCurrency?.currency === row.currency ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-white"}`}>{row.currency}</button>)}
          </div>
        </div>
        {activeCurrency ? <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Programado al corte" value={formatMoney(activeCurrency.expectedToDate, activeCurrency.currency)} note={`${activeCurrency.expectedContributors.length} servicio(s) contribuyen.`} icon={CalendarRange} />
            <MetricCard label="Facturado real" value={formatMoney(activeCurrency.invoicedReal, activeCurrency.currency)} note={`${activeCurrency.invoiceContributors.reduce((sum, item) => sum + item.invoices, 0)} factura(s) corporativa(s).`} icon={ReceiptText} tone="green" />
            <MetricCard label="Brecha comparable" value={activeCurrency.comparableGap === null ? "N/D" : formatMoney(activeCurrency.comparableGap, activeCurrency.currency)} note={activeCurrency.blockedServices.length > 0 ? `Excluye ${activeCurrency.blockedServices.length} servicio(s) con moneda no comparable.` : "Sólo programación y factura en la misma moneda."} icon={Clock3} tone={activeCurrency.comparableGap && activeCurrency.comparableGap > 0 ? "amber" : "blue"} />
            <MetricCard label="Cuotas futuras" value={formatMoney(activeCurrency.expectedFuture, activeCurrency.currency)} note="Separadas del esperado al corte." icon={CalendarRange} tone="amber" />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-4"><h4 className="text-xs font-black text-slate-900">Programación atribuida</h4><div className="mt-3 space-y-2">{activeCurrency.expectedContributors.length === 0 ? <p className="text-xs text-slate-600">Sin programación {activeCurrency.currency} al corte.</p> : activeCurrency.expectedContributors.map(item => <div key={item.serviceId} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-[11px]"><span><b className="block text-slate-900">{item.clientName}</b><span className="text-slate-500">{item.serviceName}</span></span><b className="font-mono text-slate-950">{formatMoney(item.amount, activeCurrency.currency)}</b></div>)}</div></article>
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-4"><h4 className="text-xs font-black text-slate-900">Facturas reales atribuidas</h4><div className="mt-3 space-y-2">{activeCurrency.invoiceContributors.length === 0 ? <p className="text-xs font-bold text-amber-800">No hay facturas corporativas {activeCurrency.currency} verificadas.</p> : activeCurrency.invoiceContributors.map(item => <div key={item.serviceId} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-[11px]"><span><b className="block text-slate-900">{item.clientName}</b><span className="text-slate-500">{item.invoices} factura(s) · {item.serviceName}</span></span><b className="font-mono text-emerald-700">{formatMoney(item.amount, activeCurrency.currency)}</b></div>)}</div></article>
          </div>
          {activeCurrency.blockedServices.length > 0 && <div data-testid="currency-mismatch-warning" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-900"><b>Diferencia de moneda:</b> {activeCurrency.blockedServices.map(item => `${item.clientName} · ${item.serviceName}`).join(", ")}. No se calcula porcentaje ni brecha cruzando monedas.</div>}
          <div className="mt-5 border-t border-slate-200 pt-5"><div className="mb-3"><h4 className="text-sm font-black text-slate-950">Esperado vs. facturado real</h4><p className="mt-1 text-[11px] text-slate-600">Lectura {effectiveControls.comparison === "monthly" ? "mensual" : "acumulada"}; las cuotas futuras usan una señal visual separada.</p></div><BillingEvolution rows={model.financeMonthly} currency={activeCurrency.currency} comparison={effectiveControls.comparison} /></div>
        </> : <p className="mt-4 text-sm text-slate-600">Sin programación financiera disponible.</p>}
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-black text-slate-950">Embudo de cobertura SLA</h3>
          <p className="mt-1 text-[11px] text-slate-600">Configuración no equivale a medición ni cumplimiento.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {[
              ["1. Reglas configuradas", `${model.summary.slaConfigured}/${model.summary.services}`],
              ["2. JSM vinculado", `${model.summary.jsmLinked}/${model.summary.services}`],
              ["3. Muestra medida", `${model.summary.slaMeasured}/${model.summary.services}`],
              ["4. Cumplimiento", complianceMeasured ? "Ver detalle" : "N/D"],
            ].map(([label, value], index) => <div key={String(label)} className={`rounded-xl border p-3 ${index < 2 ? "border-blue-200 bg-blue-50" : "border-amber-200 bg-amber-50"}`}><p className="text-[9px] font-black uppercase text-slate-600">{label}</p><p className="mt-1 font-mono text-xl font-black text-slate-950">{value}</p></div>)}
          </div>
          <div className="mt-4 space-y-3">{model.allServices.map(service => <article key={service.serviceId} className="rounded-xl border border-slate-200 p-3"><div className="flex items-start justify-between gap-3"><div><b className="text-xs text-slate-950">{service.clientName} · {service.serviceName}</b><p className="mt-1 text-[10px] text-slate-600">{service.sla.jsmLinked ? `${service.incidents.open ?? 0} abiertos · ${service.incidents.highOpen ?? 0} altos · ${service.incidents.unresolvedOver30Days ?? 0} con +30 días` : "JSM no vinculado; cumplimiento no medible"}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-700">{service.sla.firstResponseMeasured + service.sla.resolutionMeasured} mediciones</span></div><div className="mt-2 flex flex-wrap gap-2">{service.sla.rules.map(rule => <span key={`${service.serviceId}:${rule.priority}`} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] text-slate-700">{PRIORITY_LABELS[rule.priority] ?? rule.priority}: resp. {formatSlaMinutes(rule.firstResponseMinutes)} · resol. {formatSlaMinutes(rule.resolutionMinutes)} · {rule.coverageType ?? "N/D"}</span>)}</div></article>)}</div>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-sm font-black text-slate-950">Evolución del stock de tickets</h3><p className="mt-1 text-[11px] text-slate-600">Snapshots agregados: abiertos, altos y con más de 30 días. No representa flujo mensual de cierre.</p><div className="mt-4"><TicketStockEvolution rows={model.operations.monthly} /></div><p className="mt-3 rounded-lg bg-slate-50 p-3 text-[10px] leading-4 text-slate-600">Un valor cero de tickets con reloj vencido detectado no demuestra cumplimiento SLA si el denominador medido es cero.</p></article>
      </section>

      <section className="grid gap-4 lg:grid-cols-3" aria-label="Gobierno operacional">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><FileWarning size={17} className="text-amber-600" /><h3 className="text-sm font-black text-slate-950">Entregables</h3></div><p className="mt-4 font-mono text-3xl font-black text-slate-950">{model.governance.deliverables.planned}</p><p className="text-[10px] text-slate-600">planificados</p><div className="mt-3 rounded-xl bg-amber-50 p-3"><b className="font-mono text-xl text-amber-800">{model.governance.deliverables.withoutDate}</b><p className="text-[10px] text-amber-900">sin fecha exigible; cumplimiento N/D hasta calendarizar.</p></div></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><FileCheck2 size={17} className="text-blue-600" /><h3 className="text-sm font-black text-slate-950">Formalidad</h3></div><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-blue-50 p-3"><p className="text-[9px] font-bold uppercase text-slate-500">Presencia</p><b className="font-mono text-2xl text-slate-950">{model.governance.documents.presentServices}/{model.summary.services}</b></div><div className="rounded-xl bg-amber-50 p-3"><p className="text-[9px] font-bold uppercase text-slate-500">Validación</p><b className="font-mono text-2xl text-slate-950">{model.governance.documents.validServices}/{model.summary.services}</b></div></div><p className="mt-3 text-[10px] text-slate-600">{model.governance.documents.present}/{model.governance.documents.required} documentos presentes · {model.governance.documents.valid}/{model.governance.documents.required} validados.</p></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><CircleDollarSign size={17} className="text-red-600" /><h3 className="text-sm font-black text-slate-950">Multas</h3></div><p className="mt-4 font-mono text-3xl font-black text-slate-950">{model.governance.penalties.count}</p><p className="text-[10px] text-slate-600">registros · {model.governance.penalties.withEvidence} con evidencia.</p><div className="mt-3 space-y-2">{model.governance.penalties.byCurrency.length === 0 ? <p className="rounded-xl bg-emerald-50 p-3 text-[10px] font-bold text-emerald-800">Sin multas persistidas al corte.</p> : model.governance.penalties.byCurrency.map(row => <div key={row.currency} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs"><span>{row.count} en {row.currency}</span><b className="font-mono">{formatMoney(row.amount, row.currency)}</b></div>)}</div></article>
      </section>

      <section className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm" aria-labelledby="exceptions-title">
        <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.13em] text-red-700">Calidad de datos y acción</p><h3 id="exceptions-title" className="mt-1 text-base font-black text-slate-950">Excepciones que impiden una lectura completa</h3></div><span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-800">{model.exceptions.length}</span></div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">{model.exceptions.map((exception, index) => <article key={`${exception.serviceId}:${exception.code}:${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-start gap-3"><span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${exception.severity === "critical" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{exception.code === "JSM_NOT_LINKED" ? <Link2Off size={14} /> : <AlertTriangle size={14} />}</span><div><p className="text-[10px] font-black uppercase text-slate-500">{exception.clientName} · {exception.serviceName}</p><h4 className="mt-1 text-xs font-black text-slate-950">{exception.label}</h4><p className="mt-1 text-[10px] text-slate-600"><b>Impacto:</b> {exception.impact}</p><p className="mt-1 text-[10px] text-blue-800"><b>Acción:</b> {exception.action}</p></div></div></article>)}</div>
      </section>

      <section aria-labelledby="classic-consolidated-evidence-title" className="space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm"><p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#175CD3]">Evidencia consolidada de la cartera</p><h3 id="classic-consolidated-evidence-title" className="mt-1 text-base font-black text-slate-950">Finanzas, entregables, formalidad y operación JSM</h3><p className="mt-1 text-[11px] leading-5 text-slate-600">Este cuerpo se mantiene exclusivamente en Clásico; Torre V2 conserva alertas y cartera por servicio.</p></div>
        <EvidenceTabs tabs={evidenceTabs} active={activeEvidenceTab} onChange={setActiveEvidenceTab} panels={{ finanzas: <FinanceEvidencePanel data={data} />, entregables: <DeliverablesPanel data={data} tab={tabByKey.entregables} />, formalidad: <FormalityPanel data={data} tab={tabByKey.formalidad} />, operacion: <OperationsPanel data={data} tab={tabByKey.operacion} canManageJsm={canManageJsm} onConfigureJsm={onConfigureJsm} /> }} />
      </section>

      <section id="cartera" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h3 className="text-sm font-black text-slate-950">Resumen final por servicio</h3><p className="mt-1 text-[11px] text-slate-600">Cada KPI conserva servicio, Deal, moneda, fuente y acción recomendada.</p></div><span className="text-[10px] font-bold text-slate-500">{model.services.length} de {model.allServices.length} servicio(s)</span></div>
        <div className="mt-4 space-y-3">{model.services.map(service => {
          const status = RECONCILIATION_LABELS[service.reconciliationStatus] ?? RECONCILIATION_LABELS.no_schedule;
          const expanded = expandedServiceId === service.serviceId;
          const expectedText = service.expectedCurrencies.map(item => formatMoney(service.expectedToDate[item] ?? 0, item)).join(" · ") || "N/D";
          const invoiceText = service.invoiceCurrencies.map(item => formatMoney(service.invoicedReal[item] ?? 0, item)).join(" · ") || "Sin factura verificada";
          return <article key={service.serviceId} className="overflow-hidden rounded-xl border border-slate-200"><div className="grid gap-3 bg-white p-4 lg:grid-cols-[1.5fr_0.8fr_1fr_1fr_1fr_auto] lg:items-center"><div><p className="text-[9px] font-black uppercase tracking-wider text-slate-500">{service.clientName} · Deal {service.dealId ?? "N/D"}</p><h4 className="mt-1 text-sm font-black text-slate-950">{service.serviceName}</h4><p className="mt-1 text-[10px] text-slate-500">{RECURRING_SERVICE_TYPE_LABELS[service.serviceType as keyof typeof RECURRING_SERVICE_TYPE_LABELS] ?? service.serviceType}</p></div><div><p className="text-[9px] font-bold uppercase text-slate-500">Conciliación</p><span className={`mt-1 inline-flex rounded-full border px-2 py-1 text-[9px] font-black ${status.className}`}>{status.label}</span></div><div><p className="text-[9px] font-bold uppercase text-slate-500">Esperado al corte</p><b className="mt-1 block font-mono text-xs text-slate-950">{expectedText}</b><p className="text-[9px] text-slate-500">Contrato {service.contractCurrency}</p></div><div><p className="text-[9px] font-bold uppercase text-slate-500">Facturado real</p><b className="mt-1 block font-mono text-xs text-emerald-700">{invoiceText}</b><p className="text-[9px] text-slate-500">{service.verifiedInvoiceCount} factura(s)</p></div><div><p className="text-[9px] font-bold uppercase text-slate-500">Operación</p><b className="mt-1 block text-xs text-slate-950">{service.sla.jsmLinked ? `${service.incidents.open ?? 0} abiertos` : "JSM N/D"}</b><p className="text-[9px] text-slate-500">SLA {service.sla.firstResponseMeasured + service.sla.resolutionMeasured > 0 ? "medido" : "N/D"} · {service.penalties.count} multa(s)</p></div><button type="button" aria-expanded={expanded} aria-controls={`service-${service.serviceId}-detail`} onClick={() => setExpandedServiceId(expanded ? null : service.serviceId)} className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-[10px] font-black text-slate-800 hover:bg-slate-50">{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Detalle</button></div>{expanded && <div id={`service-${service.serviceId}-detail`} className="border-t border-slate-200 bg-slate-50 p-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-[9px] font-black uppercase text-slate-500">Incidentes</p><p className="mt-1 text-xs text-slate-800">{service.sla.jsmLinked ? `${service.incidents.open ?? 0} abiertos · ${service.incidents.highOpen ?? 0} altos · ${service.incidents.unresolvedOver30Days ?? 0} +30 días` : "Sin fuente JSM vinculada"}</p></div><div><p className="text-[9px] font-black uppercase text-slate-500">Entregables</p><p className="mt-1 text-xs text-slate-800">{service.deliverables.delivered}/{service.deliverables.due} entregados · {service.deliverables.withoutDate} sin fecha</p></div><div><p className="text-[9px] font-black uppercase text-slate-500">Documentos</p><p className="mt-1 text-xs text-slate-800">{service.documents.present}/{service.documents.required} presentes · {service.documents.valid}/{service.documents.required} validados</p></div><div><p className="text-[9px] font-black uppercase text-slate-500">Acción prioritaria</p><p className="mt-1 text-xs text-slate-800">{service.exceptions[0]?.action ?? "Mantener monitoreo y evidencia al corte."}</p></div></div><button type="button" onClick={() => onOpenService(service.serviceId)} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-[10px] font-black text-white">Ver servicio <ArrowRight size={13} /></button></div>}</article>;
        })}{model.services.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">No hay servicios que cumplan los filtros actuales.</div>}</div>
      </section>
    </div>
  );
}
