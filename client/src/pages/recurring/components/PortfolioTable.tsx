import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  CircleDollarSign,
  FileCheck2,
  FilterX,
  Gauge,
  Search,
} from "lucide-react";
import React, { type ReactNode } from "react";
import { useLocation } from "wouter";
import { RECURRING_SERVICE_TYPE_LABELS } from "@shared/recurringServiceTypes";
import { RECURRING_HEALTH_UI, formatRecurringPercent } from "../recurringDashboardV2ViewModel";
import type { PortfolioRow } from "../recurringDashboardV3ViewModel";

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

interface PortfolioTableProps {
  rows: PortfolioRow[];
  visibleLabel: string;
  search: string;
  onSearchChange: (value: string) => void;
  clientName: string;
  onClientChange: (value: string) => void;
  serviceType: string;
  onServiceTypeChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  currency: string;
  onCurrencyChange: (value: string) => void;
  filterOptions: { clients: string[]; serviceTypes: string[]; statuses: string[]; currencies: string[] };
  onClearFilters: () => void;
  activeFilterCount: number;
}

interface MetricPanelProps {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone?: "alert" | "good" | "neutral";
  children?: ReactNode;
}

function MetricPanel({ icon, label, value, detail, tone = "neutral", children }: MetricPanelProps) {
  const toneClass = {
    alert: "border-red-200 bg-red-50/65 text-[#B42318]",
    good: "border-emerald-200 bg-emerald-50/65 text-[#067647]",
    neutral: "border-slate-200 bg-slate-50/80 text-slate-900",
  }[tone];

  return (
    <div className={`min-w-0 rounded-xl border p-3.5 ${toneClass}`}>
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.11em] text-slate-600">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white shadow-sm">{icon}</span>
        {label}
      </div>
      <p className="mt-3 break-words font-mono text-[17px] font-black leading-tight">{value}</p>
      <p className="mt-1 min-h-[30px] text-[11px] leading-[15px] text-slate-600">{detail}</p>
      {children}
    </div>
  );
}

export function PortfolioTable(props: PortfolioTableProps) {
  const [, navigate] = useLocation();

  return (
    <section
      id="cartera"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
    >
      <header className="border-b border-slate-200 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[18px] font-black tracking-tight text-slate-950">Cartera de servicios</h2>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-slate-600">
                {props.rows.length} visible{props.rows.length === 1 ? "" : "s"}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-600">
              Cada bloque corresponde a un servicio independiente · {props.visibleLabel}
            </p>
          </div>
          {props.activeFilterCount > 0 && (
            <button
              type="button"
              onClick={props.onClearFilters}
              className="inline-flex h-9 items-center justify-center gap-1.5 self-start rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 sm:self-auto"
            >
              <FilterX size={14} />
              Limpiar {props.activeFilterCount} filtro{props.activeFilterCount === 1 ? "" : "s"}
            </button>
          )}
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(230px,1.5fr)_repeat(4,minmax(135px,1fr))]">
          <div className="relative sm:col-span-2 xl:col-span-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={props.search}
              onChange={event => props.onSearchChange(event.target.value)}
              placeholder="Cliente, servicio o Deal"
              aria-label="Buscar servicio"
              className="h-10 w-full bg-slate-50 pl-9"
            />
          </div>
          <Select value={props.clientName} onValueChange={props.onClientChange}>
            <SelectTrigger className="h-10 w-full bg-white" aria-label="Filtrar por cliente">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los clientes</SelectItem>
              {props.filterOptions.clients.map(item => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={props.serviceType} onValueChange={props.onServiceTypeChange}>
            <SelectTrigger className="h-10 w-full bg-white" aria-label="Filtrar por tipo">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {props.filterOptions.serviceTypes.map(item => (
                <SelectItem key={item} value={item}>
                  {RECURRING_SERVICE_TYPE_LABELS[item as keyof typeof RECURRING_SERVICE_TYPE_LABELS] ?? item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={props.status} onValueChange={props.onStatusChange}>
            <SelectTrigger className="h-10 w-full bg-white" aria-label="Filtrar por estado">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {props.filterOptions.statuses.map(item => (
                <SelectItem key={item} value={item}>
                  {STATUS_LABELS[item] ?? item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={props.currency} onValueChange={props.onCurrencyChange}>
            <SelectTrigger className="h-10 w-full bg-white" aria-label="Filtrar por moneda">
              <SelectValue placeholder="Moneda" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las monedas</SelectItem>
              {props.filterOptions.currencies.map(item => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      {props.rows.length === 0 ? (
        <div className="px-5 py-14 text-center">
          <Search className="mx-auto text-slate-300" size={36} />
          <p className="mt-3 font-bold text-slate-800">No hay servicios para estos filtros</p>
          {props.activeFilterCount > 0 && (
            <button type="button" onClick={props.onClearFilters} className="mt-2 text-sm font-bold text-[#175CD3]">
              Restablecer {props.activeFilterCount} filtro{props.activeFilterCount === 1 ? "" : "s"}
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-4 bg-slate-100/80 p-3 sm:p-4" aria-label="Servicios visibles">
          {props.rows.map((row, index) => {
            const healthUi = RECURRING_HEALTH_UI[row.health];
            const hasOverdue = row.overdue.byCurrency.length > 0;
            const typeLabel =
              RECURRING_SERVICE_TYPE_LABELS[row.serviceTypeKey as keyof typeof RECURRING_SERVICE_TYPE_LABELS] ??
              row.serviceTypeKey;
            const serviceTitleId = `portfolio-service-${row.serviceId}`;

            return (
              <li key={row.serviceId}>
                <article
                  aria-labelledby={serviceTitleId}
                  className="group overflow-hidden rounded-2xl border bg-white shadow-[0_8px_24px_rgba(15,23,42,0.07)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(15,23,42,0.11)]"
                  style={{ borderColor: healthUi.border }}
                >
                  <div className="h-1.5 w-full" style={{ background: healthUi.tone }} aria-hidden="true" />
                  <div className="p-4 sm:p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-slate-950 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-white">
                            Servicio {String(index + 1).padStart(2, "0")}
                          </span>
                          <span
                            className="inline-flex h-6 items-center rounded-full border px-2.5 text-[10px] font-black uppercase tracking-wider"
                            style={{ color: healthUi.tone, background: healthUi.surface, borderColor: healthUi.border }}
                          >
                            {healthUi.label}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-wide text-slate-600">
                            {typeLabel}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-wide text-slate-600">
                            {STAGE_LABELS[row.stageKey] ?? row.stageKey}
                          </span>
                        </div>
                        <a
                          id={serviceTitleId}
                          href={`/recurring-services/${row.serviceId}`}
                          onClick={event => {
                            event.preventDefault();
                            navigate(`/recurring-services/${row.serviceId}`);
                          }}
                          className="mt-3 block text-[17px] font-black leading-tight text-slate-950 transition hover:text-[#175CD3] sm:text-[19px]"
                        >
                          {row.serviceName}
                        </a>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-slate-600">
                          <span className="inline-flex items-center gap-1.5 font-semibold">
                            <Building2 size={14} className="text-slate-400" /> {row.clientName}
                          </span>
                          <span>Deal {row.dealId ?? "N/D"}</span>
                          <span>ID interno {row.serviceId}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => navigate(`/recurring-services/${row.serviceId}`)}
                        aria-label={`Abrir ${row.serviceName}`}
                        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0F2F52] px-4 text-xs font-black text-white shadow-sm transition hover:bg-[#175CD3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#175CD3] focus-visible:ring-offset-2"
                      >
                        Abrir servicio
                        <ArrowRight size={15} />
                      </button>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <MetricPanel
                        icon={<CircleDollarSign size={16} />}
                        label="Facturación vencida"
                        value={row.overdue.label}
                        detail={
                          row.contractedLabel === "N/D"
                            ? "Contrato sin monto disponible"
                            : `Contratado: ${row.contractedLabel}`
                        }
                        tone={hasOverdue ? "alert" : "good"}
                      >
                        {row.overdueRatio !== null && (
                          <div className="mt-3">
                            <div className="mb-1 flex items-center justify-between text-[9.5px] font-bold text-slate-600">
                              <span>Exposición vencida</span>
                              <span>{row.overdueRatio}%</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-white">
                              <i
                                className="block h-full rounded-full bg-[#B42318]"
                                style={{ width: `${row.overdueRatio}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </MetricPanel>

                      <MetricPanel
                        icon={<FileCheck2 size={16} />}
                        label="Reportes"
                        value={formatRecurringPercent(row.reportsRate)}
                        detail={row.reportsDue === 0 ? "Sin reportes exigibles al corte" : `${row.reportsOverdue} vencidos de ${row.reportsDue} exigibles`}
                        tone={row.reportsOverdue > 0 ? "alert" : "neutral"}
                      />

                      <MetricPanel
                        icon={<Gauge size={16} />}
                        label="Formalidad"
                        value={`${row.formalizationCoverage}%`}
                        detail={
                          row.formalizationMissing.length
                            ? `Pendiente: ${row.formalizationMissing.join(", ")}`
                            : "Documentación formal completa"
                        }
                        tone={row.formalizationMissing.length ? "alert" : "good"}
                      />

                      <MetricPanel
                        icon={<Activity size={16} />}
                        label="Operación JSM"
                        value={formatRecurringPercent(row.slaFirstResponse)}
                        detail={row.incidentsOpen === null ? "Incidentes y SLA sin medición" : `${row.incidentsOpen} incidentes abiertos`}
                        tone={row.incidentsOpen !== null && row.incidentsOpen > 0 ? "alert" : "neutral"}
                      >
                        <p className="mt-2 text-[9.5px] font-bold uppercase tracking-wide text-slate-500">
                          Calidad de evidencia {row.qualityScore}/100
                        </p>
                      </MetricPanel>
                    </div>

                    <section
                      aria-label={`Señales abiertas de ${row.serviceName}`}
                      className="mt-4 rounded-xl border p-3.5"
                      style={{ borderColor: healthUi.border, background: healthUi.surface }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle size={15} style={{ color: healthUi.tone }} />
                          <h4 className="text-[10px] font-black uppercase tracking-[0.11em] text-slate-700">
                            Señales abiertas del servicio
                          </h4>
                        </div>
                        <span className="rounded-full bg-white/80 px-2 py-1 text-[9.5px] font-black text-slate-600">
                          {row.signals.length} señal{row.signals.length === 1 ? "" : "es"}
                        </span>
                      </div>
                      {row.signals.length === 0 ? (
                        <p className="mt-2 text-[11.5px] font-semibold text-[#067647]">
                          Sin alertas según la evidencia disponible.
                        </p>
                      ) : (
                        <ul className="mt-2 grid gap-2 md:grid-cols-2">
                          {row.signals.map(signal => (
                            <li
                              key={signal.code}
                              className="rounded-lg border border-white/90 bg-white/80 px-3 py-2 text-[11.5px] leading-[17px] text-slate-800 shadow-sm"
                            >
                              {signal.message}
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
