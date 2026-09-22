import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { STATUS_LABEL, STATUS_TONE } from "@/pages/projects/portfolioViewModel";
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

const COLUMNS: Array<{ key: ReportSortKey | null; label: string; className: string; align?: "center" }> = [
  { key: "name", label: "Proyecto", className: "w-[235px]" },
  { key: null, label: "Estado / salud", className: "w-[135px]", align: "center" },
  { key: null, label: "Fase / pipeline", className: "w-[175px]" },
  { key: "progress", label: "Avance Jira", className: "w-[115px]" },
  { key: null, label: "Hitos", className: "w-[100px]", align: "center" },
  { key: null, label: "Tareas", className: "w-[110px]" },
  { key: "urgency", label: "Próximo hito", className: "w-[170px]" },
  { key: "risks", label: "Riesgos", className: "w-[95px]", align: "center" },
  { key: null, label: "PM", className: "w-[130px]" },
  { key: null, label: "", className: "w-[78px]" },
];

function cleanHealth(value: string | null): string | null {
  return value?.replace(/^[^A-Za-zÁÉÍÓÚáéíóúÑñ0-9]+/, "").trim() || null;
}

function healthTone(value: string | null) {
  const normalized = cleanHealth(value)?.toLowerCase() ?? "";
  if (normalized.includes("crítico") || normalized.includes("critico") || normalized.includes("rojo")) {
    return { text: "#B42318", surface: "#FEF3F2", border: "#FDA29B" };
  }
  if (normalized.includes("naranjo") || normalized.includes("riesgo")) {
    return { text: "#B54708", surface: "#FFFAEB", border: "#FEDF89" };
  }
  if (normalized.includes("amarillo")) {
    return { text: "#A15C07", surface: "#FEFCE8", border: "#FDE68A" };
  }
  if (normalized.includes("verde") || normalized.includes("estable")) {
    return { text: "#067647", surface: "#ECFDF3", border: "#ABEFC6" };
  }
  return { text: "#475569", surface: "#F1F5F9", border: "#CBD5E1" };
}

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
          <p className="mt-3 text-sm font-semibold text-slate-600">Consultando Portafolio y Jira…</p>
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
        <Button className="mt-4" variant="outline" onClick={() => refetch()}>Reintentar</Button>
      </div>
    );
  }

  const activeFilters = countActiveReportFilters(filters);

  return (
    <div className="w-full max-w-[calc(100vw-1rem)] min-w-0 space-y-3 overflow-x-hidden pb-8 sm:max-w-full">
      <section className="relative overflow-hidden rounded-2xl bg-[#0A1628] px-5 py-4 text-white shadow-[0_18px_50px_rgba(10,22,40,0.18)] sm:px-6">
        <span className="absolute left-0 top-0 h-full w-[5px] bg-[#E91E8C]" aria-hidden="true" />
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Reportes · Avance Jira · Universo Portafolio</p>
            <h1 className="mt-1.5 text-2xl font-black tracking-[-0.02em] sm:text-[24px]">
              {summary.count} de {summary.total} proyectos · {summary.active} activos · {summary.closed} cerrados
            </h1>
            <p className="mt-1 text-xs text-slate-300">
              Ciclo de vida, fase, avance, salud, PM, hitos y riesgos provienen del mismo read model del Portafolio
              {data.jiraLiveReports < data.totalJiraSpaces ? ` · detalle live ${data.jiraLiveReports}/${data.totalJiraSpaces}` : ""}
              {" · actualizado "}{new Date(data.lastUpdated).toLocaleString("es-CL")}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-5">
            <div className="text-right">
              <p className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-slate-400">Avance Jira promedio</p>
              <p className="font-mono text-[30px] font-black leading-tight">{progressLabel(summary.operationalProgressPct)}</p>
            </div>
            <span className="h-[52px] w-px bg-white/15" />
            <div className="text-right">
              <p className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-slate-400">Hitos cerrados</p>
              <p className="font-mono text-[22px] font-bold leading-tight text-slate-300">{summary.milestonesDone} / {summary.milestonesTotal}</p>
            </div>
            <span className="h-[52px] w-px bg-white/15" />
            <div className="text-right">
              <p className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-slate-400">Tareas live</p>
              <p className="font-mono text-[22px] font-bold leading-tight text-slate-300">{summary.tasksDone} / {summary.tasksTotal}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={filters.search}
              onChange={event => setFilters({ ...filters, search: event.target.value })}
              placeholder="Proyecto, cliente, key, fase o PM"
              aria-label="Buscar proyecto"
              className="h-9 w-[250px] pl-9"
            />
          </div>

          <Select value={filters.client} onValueChange={value => setFilters({ ...filters, client: value })}>
            <SelectTrigger className="h-9 w-[150px]" aria-label="Filtrar por cliente"><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los clientes</SelectItem>
              {clients.map(client => <SelectItem key={client} value={client}>{client}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filters.lifecycle} onValueChange={value => setFilters({ ...filters, lifecycle: value })}>
            <SelectTrigger className="h-9 w-[145px]" aria-label="Filtrar por ciclo de vida"><SelectValue placeholder="Ciclo de vida" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="activo">Activos</SelectItem>
              <SelectItem value="pausado">Pausados</SelectItem>
              <SelectItem value="completado">Completados</SelectItem>
              <SelectItem value="cancelado">Cancelados</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.progress} onValueChange={value => setFilters({ ...filters, progress: value })}>
            <SelectTrigger className="h-9 w-[165px]" aria-label="Filtrar por avance Jira"><SelectValue placeholder="Avance Jira" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Avance Jira: todo</SelectItem>
              <SelectItem value="behind">Bajo 40%</SelectItem>
              <SelectItem value="measurable">Con avance Jira</SelectItem>
              <SelectItem value="unmeasured">Avance Jira N/D</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.nextMilestone} onValueChange={value => setFilters({ ...filters, nextMilestone: value })}>
            <SelectTrigger className="h-9 w-[168px]" aria-label="Filtrar por próximo hito"><SelectValue placeholder="Próximo hito" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Próximo hito: todo</SelectItem>
              <SelectItem value="overdue">Vencido</SelectItem>
              <SelectItem value="due_soon">Vence en 14 días</SelectItem>
              <SelectItem value="none">Sin próximo hito</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.attention} onValueChange={value => setFilters({ ...filters, attention: value })}>
            <SelectTrigger className="h-9 w-[182px]" aria-label="Filtrar por señal de atención"><SelectValue placeholder="Atención" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toda la cartera</SelectItem>
              <SelectItem value="with_risks">Con riesgos abiertos</SelectItem>
              <SelectItem value="with_stalled">Con tareas estancadas</SelectItem>
              <SelectItem value="with_uncovered">Con objetivos sin tareas</SelectItem>
            </SelectContent>
          </Select>

          {activeFilters > 0 && (
            <button type="button" onClick={() => setFilters(EMPTY_REPORT_FILTERS)} className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-bold text-[#175CD3] transition hover:bg-slate-50">
              <X size={13} /> Limpiar {activeFilters}
            </button>
          )}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-100 pt-2.5 text-[11.5px] text-slate-700">
          <span className="font-bold text-slate-900">{summary.count} de {summary.total} proyectos</span>
          <span>{summary.active} activos · {summary.closed} completados</span>
          {summary.progressUnavailable > 0 && <span className="font-bold text-[#B54708]">{summary.progressUnavailable} con avance Jira N/D</span>}
          {summary.withoutMilestones > 0 && <span>{summary.withoutMilestones} sin hitos medibles</span>}
          <span>{summary.risksOpen} riesgos abiertos</span>
          {summary.stalled > 0 && <span>{summary.stalled} tareas estancadas</span>}
          <div className="flex-grow" />
          <span>{summary.pendingTasks} tareas por ejecutar{summary.overdueTasks > 0 ? ` · ${summary.overdueTasks} vencidas` : ""}</span>
        </div>
      </section>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-16 text-center">
          <Search className="mx-auto text-slate-300" size={36} />
          <p className="mt-3 font-bold text-slate-800">No hay proyectos para estos filtros</p>
        </div>
      ) : (
        <div className="w-full max-w-[calc(100vw-1rem)] min-w-0 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)] sm:max-w-full" role="region" aria-label="Reporte Jira alineado al Portafolio; desplázate horizontalmente en pantallas estrechas" tabIndex={0}>
          <table className="w-full min-w-[1270px] table-fixed border-collapse text-left">
            <caption className="sr-only">Proyectos con ciclo de vida, salud, fase, avance Jira, hitos, tareas, riesgos y PM.</caption>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70">
                {COLUMNS.map(column => {
                  const sorted = column.key !== null && sort.key === column.key;
                  return (
                    <th key={column.label || "acciones"} scope="col" aria-sort={column.key ? (sorted ? (sort.direction === "asc" ? "ascending" : "descending") : "none") : undefined} className={`px-3 py-2 text-[9.5px] font-black uppercase tracking-[0.1em] text-slate-500 ${column.className} ${column.align === "center" ? "text-center" : ""}`}>
                      {column.key ? (
                        <button type="button" onClick={() => handleSort(column.key as ReportSortKey)} className={`inline-flex items-center gap-1 uppercase tracking-[0.1em] transition hover:text-slate-900 ${sorted ? "text-slate-900" : ""}`}>
                          {column.label}
                          {sorted ? (sort.direction === "asc" ? <ChevronUp size={12} strokeWidth={3} /> : <ChevronDown size={12} strokeWidth={3} />) : <ArrowUpDown size={11} className="opacity-40" />}
                        </button>
                      ) : (column.label || <span className="sr-only">Acciones</span>)}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {visible.map((row, index) => {
                const progressTone = TONE[row.tone];
                const nextTone = TONE[milestoneDaysTone(row.nextMilestoneDays, row.nextMilestoneSummary !== null)];
                const statusTone = STATUS_TONE[row.status];
                const currentHealth = cleanHealth(row.executiveHealth);
                const currentHealthTone = healthTone(currentHealth);
                const target = row.projectKey ? `/reports/jira/${row.projectKey}` : `/projects/${row.pmoProjectId}`;

                return (
                  <tr key={row.pmoProjectId} className={`border-b border-slate-50 align-top transition hover:bg-slate-50/70 ${index % 2 === 1 ? "bg-slate-50/30" : ""}`}>
                    <td className="px-3 py-2.5">
                      <a href={target} onClick={event => { event.preventDefault(); navigate(target); }} className="block break-words text-[12px] font-bold leading-4 text-slate-950 hover:text-[#175CD3]" title={row.projectName}>{row.projectName}</a>
                      <p className="mt-1 text-[9.5px] text-slate-500"><span className="font-mono">PMO-{row.pmoProjectId}</span>{row.projectKey ? ` · ${row.projectKey}` : " · Sin Jira"}</p>
                      <p className="text-[9.5px] text-slate-500">{row.clientName}</p>
                    </td>

                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-block w-full rounded-full border py-0.5 text-[9px] font-black uppercase tracking-wide" style={{ color: statusTone.text, background: statusTone.surface, borderColor: statusTone.border }}>{STATUS_LABEL[row.status]}</span>
                      <span className="mt-1 block rounded-full border px-1 py-0.5 text-[9px] font-bold" style={{ color: currentHealthTone.text, background: currentHealthTone.surface, borderColor: currentHealthTone.border }}>Salud: {currentHealth ?? "N/D"}</span>
                      {row.jiraEvidenceAvailability !== "available" && <span className="mt-1 block text-[8.5px] font-bold text-[#B54708]">Evidencia {row.jiraEvidenceAvailability}</span>}
                    </td>

                    <td className="px-3 py-2.5">
                      <p className="text-[11px] font-bold text-slate-900">{row.operationalPhase ?? "Fase Jira N/D"}</p>
                      <p className="mt-0.5 text-[9.5px] text-slate-500">Pipeline PMO: {row.stageLabel}</p>
                      <p className="text-[9px] text-slate-400">{row.stagesClosed}/{row.totalStages} etapas completadas</p>
                    </td>

                    <td className="px-3 py-2.5">
                      <p className="font-mono text-[17px] font-black" style={{ color: progressTone.text }}>{progressLabel(row.operationalProgressPct)}</p>
                      {row.operationalProgressPct !== null && <div className="mt-1 h-[5px] overflow-hidden rounded bg-slate-100"><i className="block h-full rounded" style={{ width: `${row.operationalProgressPct}%`, background: progressTone.text }} /></div>}
                      <p className="mt-1 text-[8.5px] text-slate-500">Snapshot del Portafolio</p>
                    </td>

                    <td className="px-3 py-2.5 text-center">
                      {row.measurable ? <><b className="font-mono text-[13px] text-slate-900">{row.milestonesDone}/{row.milestonesTotal}</b><span className="block text-[9.5px] text-slate-500">{progressLabel(row.milestonePct)}</span></> : <><b className="text-[12px] text-slate-500">N/D</b><span className="block text-[9px] text-slate-500">sin hitos medibles</span></>}
                    </td>

                    <td className="px-3 py-2.5">
                      <p className="font-mono text-[12px] font-bold text-slate-700">{progressLabel(row.taskPct)}</p>
                      <p className="text-[9.5px] text-slate-500">{row.tasksDone ?? "N/D"} / {row.tasksTotal ?? "N/D"} tareas live</p>
                      <p className="text-[9px] text-slate-500">{row.pendingTasks} por ejecutar · {row.overdueTasks} vencidas</p>
                    </td>

                    <td className="px-3 py-2.5">
                      <p className="break-words text-[10.5px] text-slate-800">{row.nextMilestoneSummary ?? "Sin próximo hito"}</p>
                      <p className="text-[9.5px] font-bold" style={{ color: nextTone.text }}>{milestoneDaysLabel(row.nextMilestoneDays, row.nextMilestoneSummary !== null)}</p>
                    </td>

                    <td className="px-3 py-2.5 text-center">
                      {row.risksOpen !== null ? <><b className="font-mono text-[13px] text-slate-900">{row.risksOpen}</b><span className="block text-[9px] text-slate-500">abiertos</span>{(row.highRisksOpen ?? 0) > 0 && <span className="block text-[9px] font-bold text-[#B54708]">{row.highRisksOpen} altos</span>}</> : <span className="text-[10px] text-slate-500">N/D</span>}
                    </td>

                    <td className="px-3 py-2.5"><span className="block break-words text-[10.5px] text-slate-700">{row.pmName ?? "N/D"}</span></td>

                    <td className="px-3 py-2.5">
                      <button type="button" onClick={() => navigate(target)} aria-label={`Abrir ${row.projectName}`} className="h-8 w-[70px] rounded-lg border border-slate-300 bg-white text-[11px] font-bold text-[#175CD3] transition hover:bg-slate-50">Abrir</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {(summary.progressUnavailable > 0 || summary.withoutMilestones > 0) && (
            <div className="flex items-start gap-2.5 border-t border-[#FEDF89] bg-[#FFFAEB] px-4 py-2.5">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[#B54708]" strokeWidth={2.4} />
              <p className="text-[11.5px] leading-[17px] text-[#7A3A06]">
                Los valores N/D se preservan exactamente como en Portafolio: {summary.progressUnavailable} sin avance Jira utilizable y {summary.withoutMilestones} sin hitos medibles. No se sustituyen con porcentajes de issues.
              </p>
            </div>
          )}
        </div>
      )}

      <footer className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[11px] text-slate-600">
        <span>Prodigio Tech · Reporte de Avance Jira · Confidencial</span>
        <span className="hidden h-5 w-px bg-slate-200 sm:block" />
        <span>Avance Jira, hitos, riesgos y salud coinciden con Portafolio; tareas y agenda son detalle live</span>
        <div className="flex-grow" />
        <span>Actualizado {new Date(data.lastUpdated).toLocaleString("es-CL")}</span>
      </footer>
    </div>
  );
}
