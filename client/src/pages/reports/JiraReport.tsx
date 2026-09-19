/**
 * Reporte de Avance Jira — vista operacional de proyectos ABIERTOS.
 *
 * Qué cambia respecto de la versión anterior:
 *  - Los proyectos cerrados y cancelados no se reportan. El endpoint ya los filtra.
 *  - El avance del proyecto es el % de HITOS CERRADOS. El de tareas queda al
 *    lado, como lectura operacional, y nunca ocupa su lugar.
 *  - Un proyecto sin Hitos PMO definidos muestra N/D y no entra al promedio.
 *  - Las tarjetas de 12 columnas pasan a tabla densa con filtros y orden.
 */

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, ArrowUpDown, ChevronDown, ChevronUp, Loader2, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

import {
  DEFAULT_REPORT_SORT,
  EMPTY_REPORT_FILTERS,
  TONE,
  buildReportRows,
  countActiveReportFilters,
  filterReportRows,
  milestoneDaysLabel,
  milestoneDaysTone,
  progressLabel,
  reportClients,
  sortReportRows,
  summarizeReport,
  type ReportSortKey,
} from "./jiraReportViewModel";

const COLUMNS: Array<{ key: ReportSortKey | null; label: string; className: string; align?: "right" | "center" }> = [
  { key: "name", label: "Proyecto", className: "w-[268px]" },
  { key: "progress", label: "Avance por hitos", className: "w-[150px]" },
  { key: null, label: "Tareas", className: "w-[128px]" },
  { key: "urgency", label: "Próximo hito", className: "w-[186px]" },
  { key: "pending", label: "Por ejecutar", className: "w-[118px]", align: "center" },
  { key: "risks", label: "Riesgos", className: "w-[92px]", align: "center" },
  { key: null, label: "Equipo y carga", className: "" },
  { key: null, label: "", className: "w-[78px]" },
];

export default function JiraReport() {
  const [, navigate] = useLocation();
  const { data, isLoading, error, refetch } = trpc.jira.enrichedConsolidatedReport.useQuery(undefined, {
    staleTime: 60_000,
  });

  const [filters, setFilters] = useState(EMPTY_REPORT_FILTERS);
  const [sort, setSort] = useState(DEFAULT_REPORT_SORT);

  const allRows = useMemo(() => (data ? buildReportRows(data) : []), [data]);
  const visible = useMemo(() => sortReportRows(filterReportRows(allRows, filters), sort), [allRows, filters, sort]);
  const summary = useMemo(() => summarizeReport(visible, allRows), [visible, allRows]);
  const clients = useMemo(() => reportClients(allRows), [allRows]);

  const handleSort = (key: ReportSortKey) =>
    setSort(current =>
      current.key === key ? { key, direction: current.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" },
    );

  if (isLoading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <div className="text-center">
          <Loader2 size={30} className="mx-auto animate-spin text-[#E91E8C]" />
          <p className="mt-3 text-sm font-semibold text-slate-600">Consultando Jira…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
        <div className="flex items-center gap-2 font-bold">
          <AlertTriangle size={18} /> No fue posible cargar el reporte
        </div>
        <p className="mt-2 text-sm">{error?.message ?? "La lectura consolidada no está disponible."}</p>
        <Button className="mt-4" variant="outline" onClick={() => refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }

  const activeFilters = countActiveReportFilters(filters);

  return (
    <div className="space-y-3 pb-8">
      {/* Titular: el avance de la cartera, medido por hitos */}
      <section className="relative overflow-hidden rounded-2xl bg-[#0A1628] px-5 py-4 text-white shadow-[0_18px_50px_rgba(10,22,40,0.18)] sm:px-6">
        <span className="absolute left-0 top-0 h-full w-[5px] bg-[#E91E8C]" aria-hidden="true" />
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Reportes · Avance Jira · Vista operacional
            </p>
            <h1 className="mt-1.5 text-2xl font-black tracking-[-0.02em] sm:text-[24px]">
              {allRows.length} proyectos abiertos · {data.milestonesDone} de {data.milestonesTotal} hitos cerrados
            </h1>
            <p className="mt-1 text-xs text-slate-300">
              Los proyectos cerrados quedan fuera
              {data.withoutMilestones > 0
                ? ` · ${data.withoutMilestones} sin hitos definidos, no medibles`
                : ""}{" "}
              · actualizado {new Date(data.lastUpdated).toLocaleString("es-CL")}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-5">
            <div className="text-right">
              <p className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-slate-400">Avance por hitos</p>
              <p className="font-mono text-[30px] font-black leading-tight">{progressLabel(data.avgProgress)}</p>
            </div>
            <span className="h-[52px] w-px bg-white/15" />
            <div className="text-right">
              <p className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-slate-400">Tareas cerradas</p>
              <p className="font-mono text-[22px] font-bold leading-tight text-slate-300">
                {data.totalDone} / {data.totalIssues}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Filtros */}
      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={filters.search}
              onChange={event => setFilters({ ...filters, search: event.target.value })}
              placeholder="Proyecto, cliente o key Jira"
              aria-label="Buscar proyecto"
              className="h-9 w-[250px] pl-9"
            />
          </div>

          <Select value={filters.client} onValueChange={value => setFilters({ ...filters, client: value })}>
            <SelectTrigger className="h-9 w-[150px]" aria-label="Filtrar por cliente">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los clientes</SelectItem>
              {clients.map(client => (
                <SelectItem key={client} value={client}>
                  {client}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.progress} onValueChange={value => setFilters({ ...filters, progress: value })}>
            <SelectTrigger className="h-9 w-[178px]" aria-label="Filtrar por avance">
              <SelectValue placeholder="Avance" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Avance por hitos: todo</SelectItem>
              <SelectItem value="behind">Bajo 40%</SelectItem>
              <SelectItem value="measurable">Solo medibles</SelectItem>
              <SelectItem value="unmeasured">Sin hitos definidos</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.nextMilestone} onValueChange={value => setFilters({ ...filters, nextMilestone: value })}>
            <SelectTrigger className="h-9 w-[168px]" aria-label="Filtrar por próximo hito">
              <SelectValue placeholder="Próximo hito" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Próximo hito: todo</SelectItem>
              <SelectItem value="overdue">Vencido</SelectItem>
              <SelectItem value="due_soon">Vence en 14 días</SelectItem>
              <SelectItem value="none">Sin hitos</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.attention} onValueChange={value => setFilters({ ...filters, attention: value })}>
            <SelectTrigger className="h-9 w-[182px]" aria-label="Filtrar por señal de atención">
              <SelectValue placeholder="Atención" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toda la cartera</SelectItem>
              <SelectItem value="with_risks">Con riesgos abiertos</SelectItem>
              <SelectItem value="with_stalled">Con tareas estancadas</SelectItem>
              <SelectItem value="with_uncovered">Con objetivos sin tareas</SelectItem>
            </SelectContent>
          </Select>

          {activeFilters > 0 && (
            <button
              type="button"
              onClick={() => setFilters(EMPTY_REPORT_FILTERS)}
              className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-bold text-[#175CD3] transition hover:bg-slate-50"
            >
              <X size={13} /> Limpiar {activeFilters}
            </button>
          )}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-100 pt-2.5 text-[11.5px] text-slate-700">
          <span className="font-bold text-slate-900">
            {summary.count} de {summary.total} proyectos
          </span>
          {summary.withOverdueMilestone > 0 && (
            <span className="font-bold text-[#B42318]">{summary.withOverdueMilestone} con hitos vencidos</span>
          )}
          {summary.unmeasured > 0 && (
            <span className="font-bold text-[#B54708]">{summary.unmeasured} sin hitos definidos</span>
          )}
          <span>{summary.risksOpen} riesgos abiertos</span>
          {summary.stalled > 0 && <span>{summary.stalled} tareas estancadas</span>}
          <div className="flex-grow" />
          <span>
            {summary.pendingTasks} tareas programadas por ejecutar
            {summary.overdueTasks > 0 ? ` · ${summary.overdueTasks} vencidas` : ""}
          </span>
        </div>
      </section>

      {/* Tabla */}
      {visible.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-16 text-center">
          <Search className="mx-auto text-slate-300" size={36} />
          <p className="mt-3 font-bold text-slate-800">No hay proyectos para estos filtros</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <table className="w-full min-w-[1180px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70">
                {COLUMNS.map(column => {
                  const sorted = column.key !== null && sort.key === column.key;
                  return (
                    <th
                      key={column.label || "acciones"}
                      scope="col"
                      aria-sort={sorted ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
                      className={`px-3 py-2 text-[9.5px] font-black uppercase tracking-[0.1em] text-slate-500 ${column.className} ${
                        column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : ""
                      }`}
                    >
                      {column.key ? (
                        <button
                          type="button"
                          onClick={() => handleSort(column.key as ReportSortKey)}
                          className={`inline-flex items-center gap-1 uppercase tracking-[0.1em] transition hover:text-slate-900 ${sorted ? "text-slate-900" : ""}`}
                        >
                          {column.label}
                          {sorted ? (
                            sort.direction === "asc" ? (
                              <ChevronUp size={12} strokeWidth={3} />
                            ) : (
                              <ChevronDown size={12} strokeWidth={3} />
                            )
                          ) : (
                            <ArrowUpDown size={11} className="opacity-40" />
                          )}
                        </button>
                      ) : (
                        column.label || <span className="sr-only">Acciones</span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {visible.map((row, index) => {
                const tone = TONE[row.tone];
                const nextTone = TONE[milestoneDaysTone(row.nextMilestoneDays, row.nextMilestoneSummary !== null)];
                const load = row.teamSize > 0 ? Math.round((row.inProgress / row.teamSize) * 10) / 10 : null;

                return (
                  <tr
                    key={row.projectKey}
                    className={`border-b border-slate-50 transition hover:bg-slate-50/70 ${index % 2 === 1 ? "bg-slate-50/30" : ""}`}
                  >
                    <td className="px-3 py-2">
                      <a
                        href={`/reports/jira/${row.projectKey}`}
                        onClick={event => {
                          event.preventDefault();
                          navigate(`/reports/jira/${row.projectKey}`);
                        }}
                        className="block truncate text-[12px] font-bold text-slate-950 hover:text-[#175CD3]"
                        title={row.projectName}
                      >
                        {row.projectName}
                      </a>
                      <p className="mt-0.5 truncate text-[9.5px] text-slate-500">
                        <span className="font-mono">{row.projectKey}</span> · {row.clientName}
                      </p>
                    </td>

                    <td className="px-3 py-2">
                      {row.measurable ? (
                        <>
                          <div className="flex items-baseline gap-1.5">
                            <b className="font-mono text-[17px]" style={{ color: tone.text }}>
                              {progressLabel(row.milestonePct)}
                            </b>
                            <span className="text-[10px] text-slate-600">
                              {row.milestonesDone} de {row.milestonesTotal}
                            </span>
                          </div>
                          <div className="mt-1 h-[5px] overflow-hidden rounded bg-slate-100">
                            <i
                              className="block h-full rounded"
                              style={{ width: `${row.milestonePct}%`, background: tone.text }}
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <b className="text-[14px] text-[#B54708]">N/D</b>
                          <p className="text-[9.5px] text-[#B54708]">sin hitos definidos</p>
                        </>
                      )}
                    </td>

                    <td className="px-3 py-2">
                      <p className="font-mono text-[12px] font-bold text-slate-700">{progressLabel(row.taskPct)}</p>
                      <p className="text-[9.5px] text-slate-500">
                        {row.tasksDone} / {row.tasksTotal} tareas
                      </p>
                      {row.gapPoints !== null && row.gapPoints >= 20 && (
                        <p className="text-[9.5px] font-bold text-[#B54708]">+{row.gapPoints} pts de brecha</p>
                      )}
                    </td>

                    <td className="px-3 py-2">
                      <p className="truncate text-[11px] text-slate-800">
                        {row.nextMilestoneSummary ?? "Sin hitos"}
                      </p>
                      <p className="text-[9.5px] font-bold" style={{ color: nextTone.text }}>
                        {milestoneDaysLabel(row.nextMilestoneDays, row.nextMilestoneSummary !== null)}
                      </p>
                    </td>

                    <td className="px-3 py-2 text-center">
                      <p className="font-mono text-[13px] font-bold text-slate-950">{row.pendingTasks}</p>
                      <p className="text-[9.5px]" style={{ color: row.overdueTasks > 0 ? "#B42318" : "#64748B" }}>
                        {row.overdueTasks > 0 ? `${row.overdueTasks} vencidas` : "sin vencidas"}
                      </p>
                    </td>

                    <td className="px-3 py-2 text-center">
                      {row.risksOpen > 0 ? (
                        <span
                          className="inline-block rounded-full border px-2 py-0.5 font-mono text-[11px] font-bold"
                          style={
                            row.risksOpen >= 15
                              ? { color: "#B42318", background: "#FEF3F2", borderColor: "#FDA29B" }
                              : { color: "#B54708", background: "#FFFAEB", borderColor: "#FEDF89" }
                          }
                        >
                          {row.risksOpen}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">—</span>
                      )}
                    </td>

                    <td className="px-3 py-2">
                      <p className="text-[11px] text-slate-700">
                        {row.teamSize} personas · {row.inProgress} en curso
                      </p>
                      <p
                        className="text-[9.5px]"
                        style={{ color: load !== null && load > 3 ? "#B54708" : "#64748B" }}
                      >
                        {load !== null ? `${load} tareas en curso por persona` : "sin equipo asignado"}
                        {row.stalled > 0 ? ` · ${row.stalled} estancadas` : ""}
                      </p>
                    </td>

                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/reports/jira/${row.projectKey}`)}
                        aria-label={`Abrir ${row.projectName}`}
                        className="h-8 w-[70px] rounded-lg border border-slate-300 bg-white text-[11px] font-bold text-[#175CD3] transition hover:bg-slate-50"
                      >
                        Abrir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {summary.unmeasured > 0 && (
            <div className="flex items-start gap-2.5 border-t border-[#FEDF89] bg-[#FFFAEB] px-4 py-2.5">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[#B54708]" strokeWidth={2.4} />
              <p className="text-[11.5px] leading-[17px] text-[#7A3A06]">
                {summary.unmeasured} proyecto{summary.unmeasured === 1 ? "" : "s"} no tiene
                {summary.unmeasured === 1 ? "" : "n"} ningún Hito PMO definido, así que su avance no se puede medir con
                el criterio del comité. Aparece{summary.unmeasured === 1 ? "" : "n"} con N/D y no arrastra
                {summary.unmeasured === 1 ? "" : "n"} el promedio.
              </p>
            </div>
          )}
        </div>
      )}

      <footer className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[11px] text-slate-600">
        <span>Prodigio Tech · Reporte de Avance Jira · Confidencial</span>
        <span className="hidden h-5 w-px bg-slate-200 sm:block" />
        <span>El avance del proyecto se mide por hitos cerrados; el de tareas es la lectura operacional</span>
        <div className="flex-grow" />
        <span>Actualizado {new Date(data.lastUpdated).toLocaleString("es-CL")}</span>
      </footer>
    </div>
  );
}
