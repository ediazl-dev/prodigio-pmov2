/**
 * Barra de filtros del portafolio.
 *
 * Hoy la página filtra por texto y por estado. Con 12 proyectos ya duele;
 * con 40 es inservible. Aquí se agregan cliente, tipo, etapa, PM y salud de
 * plazo, y una línea de resumen que dice qué universo estás mirando.
 */

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, SlidersHorizontal, X } from "lucide-react";
import React from "react";
import {
  DEADLINE_LABEL,
  PROJECT_TYPE_LABEL,
  STATUS_LABEL,
  countActiveFilters,
  moneyList,
  type FilterOptions,
  type PortfolioFilters as Filters,
  type PortfolioSummary,
} from "./portfolioViewModel";

const STATUS_VALUES = ["activo", "pausado", "completado", "cancelado"] as const;
const HEALTH_VALUES = ["overdue", "at_risk", "on_track", "no_deadline"] as const;

interface PortfolioFiltersProps {
  filters: Filters;
  onChange: (next: Filters) => void;
  onClear: () => void;
  options: FilterOptions;
  summary: PortfolioSummary;
}

export function PortfolioFilters({ filters, onChange, onClear, options, summary }: PortfolioFiltersProps) {
  const active = countActiveFilters(filters);
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-auto">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={filters.search}
            onChange={event => set({ search: event.target.value })}
            placeholder="Proyecto, cliente, Deal o PM"
            aria-label="Buscar en el portafolio"
            className="h-9 w-full pl-9 sm:w-[260px]"
          />
        </div>

        <Select value={filters.status} onValueChange={value => set({ status: value })}>
          <SelectTrigger className="h-9 w-full sm:w-[140px]" aria-label="Filtrar por estado">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {STATUS_VALUES.map(value => (
              <SelectItem key={value} value={value}>
                {STATUS_LABEL[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.client} onValueChange={value => set({ client: value })}>
          <SelectTrigger className="h-9 w-full sm:w-[160px]" aria-label="Filtrar por cliente">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {options.clients.map(client => (
              <SelectItem key={client} value={client}>
                {client}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.stage} onValueChange={value => set({ stage: value })}>
          <SelectTrigger className="h-9 w-full sm:w-[140px]" aria-label="Filtrar por etapa">
            <SelectValue placeholder="Etapa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las etapas</SelectItem>
            {options.stages.map(stage => (
              <SelectItem key={stage.id} value={stage.id}>
                {stage.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.projectType} onValueChange={value => set({ projectType: value })}>
          <SelectTrigger className="h-9 w-full sm:w-[132px]" aria-label="Filtrar por tipo">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {options.projectTypes.map(type => (
              <SelectItem key={type} value={type}>
                {PROJECT_TYPE_LABEL[type] ?? type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.pm} onValueChange={value => set({ pm: value })}>
          <SelectTrigger className="h-9 w-full sm:w-[150px]" aria-label="Filtrar por PM">
            <SelectValue placeholder="PM" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los PM</SelectItem>
            {options.unassignedCount > 0 && (
              <SelectItem value="unassigned">Sin asignar ({options.unassignedCount})</SelectItem>
            )}
            {options.pms.map(pm => (
              <SelectItem key={pm.id} value={pm.id}>
                {pm.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.health} onValueChange={value => set({ health: value })}>
          <SelectTrigger className="h-9 w-full sm:w-[148px]" aria-label="Filtrar por salud de plazo">
            <SelectValue placeholder="Plazo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda la salud</SelectItem>
            {HEALTH_VALUES.map(value => (
              <SelectItem key={value} value={value}>
                {DEADLINE_LABEL[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {active > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-bold text-[#175CD3] transition hover:bg-slate-50"
          >
            <X size={13} /> Limpiar {active}
          </button>
        )}
      </div>

      <div
        className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-100 pt-2.5 text-[11.5px] text-slate-700"
        aria-live="polite"
      >
        <span className="inline-flex items-center gap-1.5 font-bold text-slate-900">
          <SlidersHorizontal size={13} className="text-slate-400" />
          {summary.count} de {summary.total} proyectos
        </span>
        <span>{summary.active} activos · {summary.closed} cerrados</span>
        {summary.overdue > 0 && (
          <span className="font-bold text-[#B42318]">
            {summary.overdue} con la etapa vencida
          </span>
        )}
        {summary.highRisks > 0 && (
          <span className="font-bold text-[#B54708]">{summary.highRisks} riesgos altos abiertos</span>
        )}
        <div className="flex-grow" />
        <span className="font-mono text-slate-900">{moneyList(summary.amountByCurrency)}</span>
        {summary.withoutAmount > 0 && (
          <span className="text-[#B54708]">
            {summary.withoutAmount} sin monto cargado
          </span>
        )}
      </div>
    </section>
  );
}
