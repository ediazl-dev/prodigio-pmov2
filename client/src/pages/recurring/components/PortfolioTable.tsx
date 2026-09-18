/**
 * Zona 2 — Cartera. Es la antigua "Matriz priorizada", movida desde el pie de
 * la página al segundo bloque, con encabezados de columna y las señales
 * completas en vez de las dos primeras.
 *
 * Cambio de accesibilidad: la fila deja de ser un <button> gigante. El nombre
 * del servicio es el enlace y "Abrir" es el botón explícito, para que el tab
 * recorra la tabla de forma previsible.
 */

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Search } from "lucide-react";
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

export function PortfolioTable(props: PortfolioTableProps) {
  const [, navigate] = useLocation();

  return (
    <section
      id="cartera"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
    >
      <header className="flex flex-col gap-3 border-b border-slate-200 px-5 py-3.5 xl:flex-row xl:items-center">
        <div className="min-w-0">
          <h2 className="text-[17px] font-black tracking-tight text-slate-950">Cartera de servicios</h2>
          <p className="mt-0.5 text-[11px] text-slate-600">{props.visibleLabel} · abre un servicio para su detalle</p>
        </div>
        <div className="flex-grow" />
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={props.search}
              onChange={event => props.onSearchChange(event.target.value)}
              placeholder="Cliente, servicio o Deal"
              aria-label="Buscar servicio"
              className="h-9 w-[220px] pl-9"
            />
          </div>
          <Select value={props.clientName} onValueChange={props.onClientChange}>
            <SelectTrigger className="h-9 w-[150px]" aria-label="Filtrar por cliente">
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
            <SelectTrigger className="h-9 w-[140px]" aria-label="Filtrar por tipo">
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
            <SelectTrigger className="h-9 w-[140px]" aria-label="Filtrar por estado">
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
            <SelectTrigger className="h-9 w-[132px]" aria-label="Filtrar por moneda">
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

      <div className="hidden items-center gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-2 text-[9.5px] font-black uppercase tracking-[0.1em] text-slate-500 2xl:flex">
        <span className="w-[320px] shrink-0">Servicio</span>
        <span className="w-[190px] shrink-0 text-right">Vencido / contratado</span>
        <span className="flex-grow">Señales abiertas</span>
        <span className="w-[86px] shrink-0 text-center">Reportes</span>
        <span className="w-[104px] shrink-0 text-center">Formalidad</span>
        <span className="w-[86px] shrink-0 text-center">SLA</span>
        <span className="w-[84px] shrink-0" />
      </div>

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
        <ul className="divide-y divide-slate-100">
          {props.rows.map(row => {
            const healthUi = RECURRING_HEALTH_UI[row.health];
            return (
              <li
                key={row.serviceId}
                className="grid grid-cols-1 gap-4 px-5 py-4 transition hover:bg-slate-50/70 sm:grid-cols-2 2xl:flex 2xl:items-center 2xl:gap-3"
              >
                <div className="min-w-0 sm:col-span-2 2xl:w-[320px] 2xl:shrink-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex h-[22px] items-center rounded-full border px-2.5 text-[10px] font-black uppercase tracking-wider"
                      style={{ color: healthUi.tone, background: healthUi.surface, borderColor: healthUi.border }}
                    >
                      {healthUi.label}
                    </span>
                    <span className="text-[9.5px] font-bold uppercase tracking-wide text-slate-600">
                      {RECURRING_SERVICE_TYPE_LABELS[row.serviceTypeKey as keyof typeof RECURRING_SERVICE_TYPE_LABELS] ??
                        row.serviceTypeKey}{" "}
                      · {STAGE_LABELS[row.stageKey] ?? row.stageKey}
                    </span>
                  </div>
                  <a
                    href={`/recurring-services/${row.serviceId}`}
                    onClick={event => {
                      event.preventDefault();
                      navigate(`/recurring-services/${row.serviceId}`);
                    }}
                    className="mt-1.5 block truncate text-[13.5px] font-bold text-slate-950 hover:text-[#175CD3]"
                  >
                    {row.serviceName}
                  </a>
                  <p className="mt-0.5 truncate text-[11px] text-slate-600">
                    {row.clientName} · Deal {row.dealId ?? "N/D"}
                  </p>
                </div>

                <div className="min-w-0 text-left 2xl:w-[190px] 2xl:shrink-0 2xl:text-right">
                  <p className="mb-1 text-[9px] font-black uppercase tracking-[0.1em] text-slate-500 2xl:hidden">
                    Vencido / contratado
                  </p>
                  <p
                    className={`font-mono text-[15px] font-black ${
                      row.overdue.byCurrency.length ? "text-[#B42318]" : "text-slate-600"
                    }`}
                  >
                    {row.overdue.label}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-600">
                    {row.contractedLabel === "N/D" ? "Contrato sin monto disponible" : `de ${row.contractedLabel} contratado`}
                  </p>
                  {row.overdueRatio !== null && (
                    <div className="mt-1.5 h-[5px] overflow-hidden rounded bg-slate-100">
                      <i className="block h-full rounded bg-[#B42318]" style={{ width: `${row.overdueRatio}%` }} />
                    </div>
                  )}
                </div>

                <ul className="min-w-0 space-y-0.5 sm:col-span-2 2xl:flex-grow">
                  <li className="mb-1 text-[9px] font-black uppercase tracking-[0.1em] text-slate-500 2xl:hidden">
                    Señales abiertas
                  </li>
                  {row.signals.length === 0 ? (
                    <li className="text-[11.5px] font-semibold text-[#067647]">
                      Sin alertas según la evidencia disponible.
                    </li>
                  ) : (
                    row.signals.map(signal => (
                      <li key={signal.code} className="text-[11.5px] leading-[17px] text-slate-800">
                        • {signal.message}
                      </li>
                    ))
                  )}
                </ul>

                <div className="min-w-0 text-left 2xl:w-[86px] 2xl:shrink-0 2xl:text-center">
                  <p className="mb-1 text-[9px] font-black uppercase tracking-[0.1em] text-slate-500 2xl:hidden">Reportes</p>
                  <p
                    className={`font-mono text-sm font-bold ${
                      row.reportsOverdue > 0 ? "text-[#B42318]" : "text-slate-600"
                    }`}
                  >
                    {formatRecurringPercent(row.reportsRate)}
                  </p>
                  <p className="text-[10px] text-slate-600">
                    {row.reportsDue === 0 ? "0 exigibles" : `${row.reportsOverdue} vencidos`}
                  </p>
                </div>

                <div className="min-w-0 text-left 2xl:w-[104px] 2xl:shrink-0 2xl:text-center">
                  <p className="mb-1 text-[9px] font-black uppercase tracking-[0.1em] text-slate-500 2xl:hidden">Formalidad</p>
                  <p className="text-[13px] font-bold text-slate-950">{row.formalizationCoverage}%</p>
                  <p className="text-[10px] text-slate-600">
                    {row.formalizationMissing.length ? `Falta ${row.formalizationMissing.join(", ")}` : "Completa"}
                  </p>
                </div>

                <div className="min-w-0 text-left 2xl:w-[86px] 2xl:shrink-0 2xl:text-center">
                  <p className="mb-1 text-[9px] font-black uppercase tracking-[0.1em] text-slate-500 2xl:hidden">SLA</p>
                  <p className="font-mono text-sm font-bold text-slate-600">
                    {formatRecurringPercent(row.slaFirstResponse)}
                  </p>
                  <p className="text-[10px] text-slate-600">
                    {row.incidentsOpen === null ? "Incidentes N/D" : `${row.incidentsOpen} abiertos`}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => navigate(`/recurring-services/${row.serviceId}`)}
                  aria-label={`Abrir ${row.serviceName}`}
                  className="inline-flex h-9 w-full items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white text-xs font-bold text-[#175CD3] transition hover:bg-slate-50 sm:w-[84px] 2xl:shrink-0"
                >
                  Abrir
                  <ArrowRight size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
