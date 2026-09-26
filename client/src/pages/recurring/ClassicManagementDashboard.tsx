import React, { useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Landmark,
  ShieldCheck,
  TicketCheck,
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
  formatSlaMinutes,
  type ClassicCurrencyRow,
} from "./classicManagementViewModel";
import { RECURRING_SERVICE_TYPE_LABELS, RECURRING_SERVICE_TYPE_OPTIONS } from "@shared/recurringServiceTypes";
import { EvidenceTabs } from "./components/EvidenceTabs";
import { DeliverablesPanel, FinancePanel, FormalityPanel, OperationsPanel } from "./components/EvidencePanels";

const C = {
  navy: "#0A1628",
  blue: "#175CD3",
  teal: "#0D7A6B",
  gold: "#B8860B",
  red: "#B42318",
  green: "#067647",
  g50: "#F8FAFC",
  g100: "#F4F7FB",
  g150: "#EBF0F7",
  g200: "#D8E2EF",
  g400: "#64748B",
};

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

const PRIORITY_LABELS: Record<string, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

function formatMoney(value: number, currency: string) {
  return `${currency} ${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(value)}`;
}

function formatPercent(value: number | null) {
  return value === null ? "N/D" : `${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 }).format(value)}%`;
}

function formatMonth(value: string) {
  const [year, month] = value.split("-");
  const labels = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${labels[Number(month) - 1] ?? month} ${year.slice(2)}`;
}

function CurrencyValues({ rows, field }: { rows: ClassicCurrencyRow[]; field: keyof ClassicCurrencyRow }) {
  if (rows.length === 0) return <span className="text-slate-500">N/D</span>;
  return (
    <div className="space-y-1">
      {rows.map(row => (
        <div key={row.currency} className="font-mono text-[15px] font-black leading-tight text-slate-950">
          {field === "contracted" && row.contracted === 0 && row.scheduled > 0
            ? `${row.currency} N/D`
            : formatMoney(Number(row[field] ?? 0), row.currency)}
        </div>
      ))}
    </div>
  );
}

function MetricCard({
  label,
  children,
  note,
  icon: Icon,
  tone = "blue",
}: {
  label: string;
  children: React.ReactNode;
  note: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone?: "blue" | "green" | "amber" | "red";
}) {
  const styles = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-red-200 bg-red-50 text-red-700",
  }[tone];
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <span className={`grid h-8 w-8 place-items-center rounded-lg border ${styles}`}><Icon size={15} /></span>
      </div>
      <div className="mt-3 min-h-8">{children}</div>
      <p className="mt-2 text-[10.5px] leading-4 text-slate-500">{note}</p>
    </article>
  );
}

function Progress({ value, tone = C.teal }: { value: number | null; tone?: string }) {
  const safe = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
      <div className="h-full rounded-full transition-[width]" style={{ width: `${safe}%`, background: tone }} />
    </div>
  );
}

function BillingEvolution({ rows }: { rows: ReturnType<typeof buildClassicManagementModel>["financeMonthly"] }) {
  const currencies = Array.from(new Set(rows.map(row => row.currency))).sort();
  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">No hay programación financiera mensual para la ventana disponible.</p>;
  }
  return (
    <div className="space-y-4">
      {currencies.map(currency => {
        const currencyRows = rows.filter(row => row.currency === currency);
        const max = Math.max(...currencyRows.map(row => row.scheduled), 1);
        return (
          <section key={currency} aria-label={`Evolución financiera ${currency}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <strong className="text-xs text-slate-900">Moneda {currency}</strong>
              <span className="text-[10px] font-bold text-slate-500">Programado vs. facturado</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {currencyRows.map(row => {
                const invoicedPct = row.scheduled > 0 ? (row.invoiced / row.scheduled) * 100 : 0;
                return (
                  <div key={`${row.month}:${row.currency}`} className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between text-[11px]">
                      <b className="text-slate-900">{formatMonth(row.month)}</b>
                      <span className="font-mono font-bold text-slate-600">{formatPercent(invoicedPct)}</span>
                    </div>
                    <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, invoicedPct)}%`, maxWidth: `${Math.max(3, (row.scheduled / max) * 100)}%` }} />
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                      <span className="text-slate-500">Facturado <b className="block text-slate-900">{formatMoney(row.invoiced, currency)}</b></span>
                      <span className="text-slate-500">Pendiente <b className="block text-[#B42318]">{formatMoney(row.pending, currency)}</b></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function IncidentEvolution({ rows }: { rows: ReturnType<typeof buildClassicManagementModel>["incidentMonthly"] }) {
  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">Sin snapshots JSM suficientes para construir una evolución mensual.</p>;
  }
  const max = Math.max(...rows.map(row => row.total), 1);
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map(row => (
        <article key={row.month} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <b className="text-xs text-slate-900">{formatMonth(row.month)}</b>
            <span className="text-[10px] font-bold text-slate-500">{row.servicesMeasured} medido(s)</span>
          </div>
          <div className="mt-3 flex h-20 items-end gap-2" aria-label={`${row.resolved} resueltos y ${row.open} pendientes`}>
            <div className="flex-1 rounded-t-md bg-emerald-400" style={{ height: `${Math.max(4, (row.resolved / max) * 100)}%` }} title={`${row.resolved} resueltos`} />
            <div className="flex-1 rounded-t-md bg-red-400" style={{ height: `${Math.max(row.open > 0 ? 4 : 0, (row.open / max) * 100)}%` }} title={`${row.open} pendientes`} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
            <span className="text-slate-500">Resueltos <b className="block font-mono text-emerald-700">{row.resolved}</b></span>
            <span className="text-slate-500">Pendientes <b className="block font-mono text-red-700">{row.open}</b></span>
          </div>
        </article>
      ))}
    </div>
  );
}

function FinanceCell({ rows }: { rows: ClassicCurrencyRow[] }) {
  if (rows.length === 0) return <span className="text-slate-500">N/D</span>;
  return (
    <div className="space-y-2">
      {rows.map(row => (
        <div key={row.currency} className="min-w-[150px]">
          <div className="flex items-center justify-between gap-3 text-[10px]">
            <b>{formatMoney(row.invoiced, row.currency)}</b>
            <span>{formatPercent(row.invoicingProgress)}</span>
          </div>
          <Progress value={row.invoicingProgress} />
          <p className="mt-1 text-[9px] text-slate-500">de {formatMoney(row.scheduled, row.currency)} programado</p>
        </div>
      ))}
    </div>
  );
}

export function ClassicManagementDashboard({
  data,
  legacy,
  onOpenService,
  canManageJsm = false,
  onConfigureJsm = () => undefined,
}: {
  data: RouterOutputs["recurringServices"]["dashboardV2"];
  legacy: RouterOutputs["recurringServices"]["dashboardKpis"];
  onOpenService: (serviceId: number) => void;
  canManageJsm?: boolean;
  onConfigureJsm?: () => void;
}) {
  const model = buildClassicManagementModel(data, legacy);
  const { operations } = model;
  const incidentMeasured = operations.summary.measuredServices > 0;
  const evidenceQueue = buildActionQueue(data.matrix, { stageLabels: STAGE_LABELS });
  const evidenceTabs = buildEvidenceTabs(data, evidenceQueue);
  const [activeEvidenceTab, setActiveEvidenceTab] = useState<SignalDomain>(() => defaultEvidenceTab(evidenceTabs));
  const tabByKey = Object.fromEntries(evidenceTabs.map(tab => [tab.key, tab])) as Record<
    SignalDomain,
    (typeof evidenceTabs)[number]
  >;

  return (
    <div className="mb-8 space-y-5" data-testid="classic-management-dashboard">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.13em] text-[#175CD3]"><BarChart3 size={15} /> Resumen gerencial consolidado</div>
            <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">Cartera recurrente: contrato, facturación y operación</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">La lectura termina en Facturado. Los montos se mantienen separados por moneda y los incidentes provienen del último snapshot JSM vigente.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-[10.5px] text-slate-600">
            <b className="block text-slate-900">Corte {model.metadata.cutOffDate}</b>
            <span>JSM: {model.metadata.latestJsmSnapshotAt ? new Date(model.metadata.latestJsmSnapshotAt).toLocaleString("es-CL") : "N/D"}</span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-[10.5px] font-bold">
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{model.statusCounts.activo} activos</span>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">{model.statusCounts.completado} completados</span>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">{model.statusCounts.pausado} pausados</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{model.statusCounts.total} servicios totales</span>
        </div>
      </section>

      <section aria-label="Indicadores gerenciales" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Monto comprometido" note="Valor contractual vigente; no suma monedas distintas." icon={Landmark}>
          <CurrencyValues rows={model.finance} field="contracted" />
        </MetricCard>
        <MetricCard label="Facturado total" note="Facturas corporativas conciliadas y cuotas facturadas." icon={FileCheck2} tone="green">
          <CurrencyValues rows={model.finance} field="invoiced" />
        </MetricCard>
        <MetricCard label="Incidentes resueltos" note={`${operations.summary.measuredServices} servicio(s) con snapshot JSM vigente.`} icon={TicketCheck} tone="green">
          <div className="font-mono text-2xl font-black text-emerald-700">{incidentMeasured ? operations.summary.resolved : "N/D"}</div>
        </MetricCard>
        <MetricCard label="Incidentes pendientes" note={`${operations.summary.overdueOpen} vencido(s); ${operations.summary.unresolvedOver30Days} con más de 30 días.`} icon={Tickets} tone={operations.summary.open > 0 ? "red" : "green"}>
          <div className="font-mono text-2xl font-black text-slate-950">{incidentMeasured ? operations.summary.open : "N/D"}</div>
        </MetricCard>
        <MetricCard label="Pendiente de facturar" note="Programado aún no respaldado por factura emitida." icon={Clock3} tone="amber">
          <CurrencyValues rows={model.finance} field="pending" />
        </MetricCard>
        <MetricCard label="Reportes mensuales" note={`${model.reports.completedDue} entregados de ${model.reports.due} exigibles; ${model.reports.overdue} vencidos.`} icon={FileCheck2} tone={model.reports.overdue > 0 ? "amber" : "green"}>
          <div className="font-mono text-2xl font-black text-slate-950">{formatPercent(model.reports.deliveryRate)}</div>
        </MetricCard>
        <MetricCard label="Resolución dentro de SLA" note={`${data.kpis.sla.availableServices} servicio(s) con ciclos SLA medidos.`} icon={ShieldCheck} tone={(data.kpis.sla.resolutionCompliance ?? 100) < 80 ? "amber" : "green"}>
          <div className="font-mono text-2xl font-black text-slate-950">{formatPercent(data.kpis.sla.resolutionCompliance)}</div>
        </MetricCard>
        <MetricCard label="Formalidad completa" note={`${model.formalization.partial} parciales y ${model.formalization.missing} sin respaldo mínimo.`} icon={CheckCircle2} tone={model.formalization.missing > 0 ? "amber" : "green"}>
          <div className="font-mono text-2xl font-black text-slate-950">{model.formalization.complete}/{data.kpis.totalServices}</div>
        </MetricCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-sm font-black text-slate-950">Facturación mensual por moneda</h3>
            <p className="mt-1 text-[11px] text-slate-600">Últimos seis períodos con programación; cada moneda se analiza por separado.</p>
          </div>
          <BillingEvolution rows={model.financeMonthly} />
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-sm font-black text-slate-950">Incidentes por mes</h3>
            <p className="mt-1 text-[11px] text-slate-600">Último snapshot disponible de cada servicio en cada mes; no representa tickets creados durante el mes.</p>
          </div>
          <IncidentEvolution rows={model.incidentMonthly} />
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-black text-slate-950">Pendientes operativos y SLA configurado</h3>
            <p className="mt-1 text-[11px] text-slate-600">Los SLA se muestran por prioridad configurada; cuando la prioridad del ticket no está disponible, no se asigna una regla específica.</p>
          </div>
          <span className="rounded-full bg-red-50 px-3 py-1 text-[10px] font-black text-red-700">{operations.summary.open} pendientes</span>
        </div>
        {operations.pendingServices.length === 0 ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">No hay incidentes abiertos en los snapshots vigentes.</div>
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {operations.pendingServices.map(service => (
              <article key={service.serviceId} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{service.clientName}</p>
                    <button type="button" onClick={() => onOpenService(service.serviceId)} className="mt-1 text-left text-sm font-black text-[#175CD3] hover:underline">{service.serviceName}</button>
                  </div>
                  <span className="rounded-lg bg-red-100 px-2.5 py-1 font-mono text-sm font-black text-red-700">{service.open} abiertos</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold">
                  <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">Críticos {service.criticalOpen}</span>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">Altos {service.highOpen}</span>
                  <span className="rounded-full bg-slate-200 px-2.5 py-1 text-slate-700">Vencidos {service.overdueOpen}</span>
                  <span className="rounded-full bg-slate-200 px-2.5 py-1 text-slate-700">+30 días {service.unresolvedOver30Days}</span>
                </div>
                <div className="mt-3 border-t border-slate-200 pt-3">
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">SLA configurado por prioridad</p>
                  {service.slaRules.length === 0 ? (
                    <p className="mt-2 text-[11px] font-bold text-amber-700">Sin reglas SLA configuradas.</p>
                  ) : (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {service.slaRules.map(rule => (
                        <div key={rule.priority} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px]">
                          <b className="text-slate-900">{PRIORITY_LABELS[rule.priority] ?? rule.priority}</b>
                          <p className="mt-1 text-slate-600">Respuesta {formatSlaMinutes(rule.firstResponseMinutes)} · Resolución {formatSlaMinutes(rule.resolutionMinutes)}</p>
                          <p className="text-slate-500">Cobertura {rule.coverageType ?? "N/D"}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section aria-label="Indicadores complementarios" className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><ShieldCheck size={17} className="text-[#175CD3]" /><h3 className="text-sm font-black text-slate-950">SLA medido</h3></div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-[9px] font-bold uppercase text-slate-500">Primera respuesta</p><p className="mt-2 font-mono text-2xl font-black">{formatPercent(data.kpis.sla.firstResponseCompliance)}</p><Progress value={data.kpis.sla.firstResponseCompliance} /></div>
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-[9px] font-bold uppercase text-slate-500">Resolución</p><p className="mt-2 font-mono text-2xl font-black">{formatPercent(data.kpis.sla.resolutionCompliance)}</p><Progress value={data.kpis.sla.resolutionCompliance} /></div>
          </div>
          <p className="mt-3 text-[10.5px] text-slate-600">{data.kpis.sla.configuredServices} servicio(s) con reglas; {data.kpis.sla.availableServices} con medición real.</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><AlertTriangle size={17} className="text-[#B42318]" /><h3 className="text-sm font-black text-slate-950">Multas</h3></div>
          <p className="mt-4 font-mono text-3xl font-black text-slate-950">{model.penalties.total}</p>
          <p className="mt-1 text-[10.5px] text-slate-600">Registros cursados; no se suman montos de monedas distintas.</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-[10px]">
            {[
              ["Identificadas", model.penalties.byStatus.identificada ?? 0],
              ["Aplicadas", model.penalties.byStatus.aplicada ?? 0],
              ["Disputadas", model.penalties.byStatus.disputada ?? 0],
              ["Resueltas", model.penalties.byStatus.resuelta ?? 0],
            ].map(([label, value]) => <div key={String(label)} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2"><span className="text-slate-600">{label}</span><b>{value}</b></div>)}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-black text-slate-950">Distribución por tipo</h3>
          <div className="mt-4 space-y-3">
            {RECURRING_SERVICE_TYPE_OPTIONS.map(option => {
              const count = model.typeCounts[option.value] ?? 0;
              const pct = model.statusCounts.total > 0 ? Math.round((count / model.statusCounts.total) * 100) : 0;
              return (
                <div key={option.value}>
                  <div className="flex justify-between text-[10.5px]"><span className="font-bold text-slate-600">{option.label}</span><b>{count}</b></div>
                  <Progress value={pct} tone={option.color} />
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section aria-labelledby="classic-consolidated-evidence-title" className="space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#175CD3]">Información consolidada de la cartera</p>
          <h3 id="classic-consolidated-evidence-title" className="mt-1 text-base font-black text-slate-950">
            Facturación, entregables, formalidad y operación JSM
          </h3>
          <p className="mt-1 text-[11px] leading-5 text-slate-600">
            Este es el único cuerpo consolidado de estas cuatro dimensiones. La Torre V2 conserva foco en alertas, prioridades y servicios individuales.
          </p>
        </div>
        <EvidenceTabs
          tabs={evidenceTabs}
          active={activeEvidenceTab}
          onChange={setActiveEvidenceTab}
          panels={{
            finanzas: <FinancePanel data={data} tab={tabByKey.finanzas} />,
            entregables: <DeliverablesPanel data={data} tab={tabByKey.entregables} />,
            formalidad: <FormalityPanel data={data} tab={tabByKey.formalidad} />,
            operacion: (
              <OperationsPanel
                data={data}
                tab={tabByKey.operacion}
                canManageJsm={canManageJsm}
                onConfigureJsm={onConfigureJsm}
              />
            ),
          }}
        />
      </section>

      <section id="cartera" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-sm font-black text-slate-950">Resumen por servicio</h3>
          <p className="mt-1 text-[11px] text-slate-600">Detalle final de contrato, facturación, incidentes, SLA, reportes y multas.</p>
        </div>
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[1180px] border-collapse text-xs">
            <thead><tr className="border-b-2 border-slate-200 text-left text-[9px] font-black uppercase tracking-wider text-slate-500">
              {['Servicio', 'Estado', 'Facturación', 'Incidentes', 'SLA', 'Reportes', 'Multas', 'Acción'].map(label => <th key={label} className="px-3 py-3">{label}</th>)}
            </tr></thead>
            <tbody>
              {model.services.map(service => {
                const source = data.matrix.find(item => item.serviceId === service.serviceId)!;
                return (
                  <tr key={service.serviceId} className="border-b border-slate-100 align-top hover:bg-slate-50">
                    <td className="px-3 py-4"><b className="block max-w-[240px] text-slate-950">{service.serviceName}</b><span className="text-[10px] text-slate-500">{service.clientName} · {RECURRING_SERVICE_TYPE_LABELS[service.serviceType as keyof typeof RECURRING_SERVICE_TYPE_LABELS] ?? service.serviceType}</span></td>
                    <td className="px-3 py-4"><b>{STATUS_LABELS[service.status] ?? service.status}</b><span className="block text-[10px] text-slate-500">{STAGE_LABELS[service.currentStage] ?? service.currentStage}</span></td>
                    <td className="px-3 py-4"><FinanceCell rows={service.finance} /></td>
                    <td className="px-3 py-4">{service.incidents.open === null ? <span className="text-slate-500">N/D</span> : <><b className="font-mono text-slate-950">{service.incidents.resolved} resueltos</b><span className="block text-[10px] text-red-700">{service.incidents.open} pendientes · {service.incidents.overdueOpen} vencidos</span></>}</td>
                    <td className="px-3 py-4"><b>{formatPercent(service.sla.resolutionCompliance)}</b><span className="block text-[10px] text-slate-500">{service.sla.configuredRules} regla(s)</span></td>
                    <td className="px-3 py-4"><b>{formatPercent(source.reports.deliveryRate)}</b><span className="block text-[10px] text-slate-500">{source.reports.overdue} vencido(s)</span></td>
                    <td className="px-3 py-4"><b>{service.penalties.count}</b>{service.penalties.count > 0 && <span className="block text-[10px] text-slate-500">{formatMoney(service.penalties.amount, service.penalties.currency)}</span>}</td>
                    <td className="px-3 py-4"><button type="button" onClick={() => onOpenService(service.serviceId)} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] font-black text-blue-700 hover:bg-blue-100">Ver servicio</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="grid gap-3 lg:hidden">
          {model.services.map(service => (
            <article key={service.serviceId} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">{service.clientName}</p>
              <h4 className="mt-1 text-sm font-black text-slate-950">{service.serviceName}</h4>
              <div className="mt-3 grid grid-cols-2 gap-3 text-[10.5px]">
                <div><span className="text-slate-500">Facturación</span><FinanceCell rows={service.finance} /></div>
                <div><span className="text-slate-500">Incidentes</span><b className="block">{service.incidents.open === null ? "N/D" : `${service.incidents.resolved} resueltos / ${service.incidents.open} pendientes`}</b></div>
                <div><span className="text-slate-500">SLA resolución</span><b className="block">{formatPercent(service.sla.resolutionCompliance)}</b></div>
                <div><span className="text-slate-500">Multas</span><b className="block">{service.penalties.count}</b></div>
              </div>
              <button type="button" onClick={() => onOpenService(service.serviceId)} className="mt-4 w-full rounded-lg bg-slate-950 px-3 py-2.5 text-xs font-black text-white">Ver servicio</button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
