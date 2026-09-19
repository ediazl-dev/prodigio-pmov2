/**
 * Tabla densa del portafolio.
 *
 * Reemplaza las tarjetas de ~96px por filas de ~56px: los 12 proyectos caben
 * casi en una pantalla y se pueden comparar de un vistazo, que es lo que una
 * lista existe para hacer.
 *
 * Accesibilidad: la fila deja de ser un `<div onClick>`. Es una tabla real, el
 * nombre del proyecto es el enlace y los encabezados ordenables son `<button>`
 * dentro de `<th>` con `aria-sort`. El botón de eliminar deja de depender de
 * `opacity: 0` en hover, que lo hacía invisible para el teclado.
 */

import { ProjectIdBadge } from "@/components/ProjectIdBadge";
import { ArrowUpDown, ChevronDown, ChevronUp, Link2, Trash2 } from "lucide-react";
import React from "react";
import { useLocation } from "wouter";
import {
  DEADLINE_LABEL,
  DEADLINE_TONE,
  PROJECT_TYPE_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  deadlineSummary,
  money,
  type PortfolioRow,
  type SortKey,
  type SortState,
} from "./portfolioViewModel";

interface ProjectTableProps {
  rows: PortfolioRow[];
  sort: SortState;
  onSortChange: (key: SortKey) => void;
  canDelete: (row: PortfolioRow) => boolean;
  onDelete: (row: PortfolioRow) => void;
}

const COLUMNS: Array<{ key: SortKey | null; label: string; className: string; align?: "right" | "center" }> = [
  { key: "name", label: "Proyecto", className: "w-[300px]" },
  { key: "client", label: "Cliente", className: "w-[150px]" },
  { key: "stage", label: "Etapa", className: "w-[190px]" },
  { key: "plazo", label: "Plazo", className: "w-[150px]" },
  { key: "urgency", label: "Estado", className: "w-[104px]", align: "center" },
  { key: null, label: "PM", className: "w-[130px]" },
  { key: "risks", label: "Riesgos", className: "w-[92px]", align: "center" },
  { key: "amount", label: "Contratado", className: "w-[130px]", align: "right" },
  { key: null, label: "", className: "w-[40px]" },
];

const PIPELINE_STAGE_IDS = ["sow", "jira", "risks", "planning", "design", "closure"] as const;

export function ProjectTable({ rows, sort, onSortChange, canDelete, onDelete }: ProjectTableProps) {
  const [, navigate] = useLocation();

  return (
    <div
      className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
      role="region"
      aria-label="Portafolio de proyectos; desplázate horizontalmente en pantallas estrechas"
      tabIndex={0}
    >
      <table className="w-full min-w-[1080px] border-collapse text-left">
        <caption className="sr-only">
          Portafolio completo con proyecto, cliente, etapa, plazo, estado, PM, riesgos y monto contratado.
        </caption>
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/70">
            {COLUMNS.map(column => {
              const sorted = column.key !== null && sort.key === column.key;
              return (
                <th
                  key={column.label || "acciones"}
                  scope="col"
                  aria-sort={
                    column.key ? (sorted ? (sort.direction === "asc" ? "ascending" : "descending") : "none") : undefined
                  }
                  className={`px-3 py-2 text-[9.5px] font-black uppercase tracking-[0.1em] text-slate-500 ${column.className} ${
                    column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : ""
                  }`}
                >
                  {column.key ? (
                    <button
                      type="button"
                      onClick={() => onSortChange(column.key as SortKey)}
                      className={`inline-flex items-center gap-1 uppercase tracking-[0.1em] transition hover:text-slate-900 ${
                        sorted ? "text-slate-900" : ""
                      }`}
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
          {rows.map((row, index) => {
            const statusTone = STATUS_TONE[row.status];
            const deadlineTone = DEADLINE_TONE[row.deadlineState];
            const ratio =
              row.daysUsed !== null && row.daysAllowed ? Math.min(100, Math.round((row.daysUsed / row.daysAllowed) * 100)) : 0;

            return (
              <tr
                key={row.projectId}
                className={`border-b border-slate-50 transition hover:bg-slate-50/70 ${index % 2 === 1 ? "bg-slate-50/30" : ""}`}
              >
                <td className="px-3 py-2">
                  <a
                    href={`/projects/${row.projectId}`}
                    onClick={event => {
                      event.preventDefault();
                      navigate(`/projects/${row.projectId}`);
                    }}
                    className="block truncate text-[12.5px] font-bold text-slate-950 hover:text-[#175CD3]"
                    title={row.projectName}
                  >
                    {row.projectName}
                  </a>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <ProjectIdBadge projectId={row.projectId} tone="muted" />
                    {row.dealId && <span className="font-mono text-[10px] text-slate-500">{row.dealId}</span>}
                    <span className="text-[10px] text-slate-500">
                      {PROJECT_TYPE_LABEL[row.projectType ?? "otro"] ?? row.projectType}
                    </span>
                    {row.origin === "linked" && (
                      <span
                        className="inline-flex items-center gap-0.5 rounded-full bg-violet-50 px-1.5 py-0.5 text-[9px] font-bold text-violet-700"
                        title="Proyecto vinculado desde Jira"
                      >
                        <Link2 size={8} /> Vinculado
                      </span>
                    )}
                  </div>
                </td>

                <td className="px-3 py-2 text-[11.5px] text-slate-700">
                  <span className="block truncate" title={row.clientName}>
                    {row.clientName}
                  </span>
                </td>

                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11.5px] font-semibold text-slate-800">{row.stageLabel}</span>
                    <span className="text-[10px] text-slate-500">
                      {row.stagesClosed} de {row.totalStages} cerradas
                    </span>
                  </div>
                  <div
                    className="mt-1 flex gap-[3px]"
                    role="img"
                    aria-label={`${row.stagesClosed} de ${row.totalStages} etapas cerradas, actualmente en ${row.stageLabel}`}
                  >
                    {PIPELINE_STAGE_IDS.slice(0, row.totalStages).map((stageId, position) => (
                      <i
                        key={stageId}
                        className="block h-[4px] flex-grow rounded-sm"
                        style={{
                          background:
                            row.closedStageIds.includes(stageId)
                              ? "#067647"
                              : position === row.stageIndex
                                ? "#175CD3"
                                : "#E2E8F0",
                        }}
                      />
                    ))}
                  </div>
                </td>

                <td className="px-3 py-2">
                  {row.daysUsed !== null && row.daysAllowed !== null ? (
                    <>
                      <div className="flex items-baseline gap-1.5">
                        <b className="font-mono text-[12px]" style={{ color: deadlineTone.text }}>
                          {row.daysUsed}/{row.daysAllowed}
                        </b>
                        <span className="text-[10px] text-slate-600">{deadlineSummary(row)}</span>
                      </div>
                      <div className="mt-1 h-[4px] overflow-hidden rounded bg-slate-100">
                        <i className="block h-full rounded" style={{ width: `${ratio}%`, background: deadlineTone.text }} />
                      </div>
                    </>
                  ) : (
                    <span className="text-[11px] text-slate-500">{deadlineSummary(row)}</span>
                  )}
                </td>

                <td className="px-3 py-2 text-center">
                  <span
                    className="inline-block w-full rounded-full border py-0.5 text-[10px] font-black uppercase tracking-wide"
                    style={{ color: statusTone.text, background: statusTone.surface, borderColor: statusTone.border }}
                  >
                    {STATUS_LABEL[row.status]}
                  </span>
                  {row.deadlineState !== "not_applicable" && row.deadlineState !== "on_track" && (
                    <span className="mt-0.5 block text-[9.5px] font-bold" style={{ color: deadlineTone.text }}>
                      {DEADLINE_LABEL[row.deadlineState]}
                    </span>
                  )}
                </td>

                <td className="px-3 py-2 text-[11.5px]">
                  {row.pmName ? (
                    <span className="block truncate text-slate-700" title={row.pmName}>
                      {row.pmName}
                    </span>
                  ) : (
                    <span className="text-slate-500">Sin asignar</span>
                  )}
                </td>

                <td className="px-3 py-2 text-center">
                  {row.highRisksOpen > 0 ? (
                    <span className="inline-block rounded-full border border-[#FEDF89] bg-[#FFFAEB] px-2 py-0.5 font-mono text-[11px] font-bold text-[#B54708]">
                      {row.highRisksOpen}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400">—</span>
                  )}
                </td>

                <td className="px-3 py-2 text-right">
                  {row.amount !== null && row.currency ? (
                    <span className="font-mono text-[12px] font-bold text-slate-950">
                      {money(row.amount, row.currency)}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500" title="Monto contratado no cargado">
                      Sin monto
                    </span>
                  )}
                </td>

                <td className="px-3 py-2">
                  {canDelete(row) && (
                    <button
                      type="button"
                      onClick={() => onDelete(row)}
                      aria-label={`Eliminar ${row.projectName}`}
                      title="Eliminar proyecto"
                      className="rounded-lg border border-slate-200 p-1.5 text-slate-400 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 focus-visible:border-red-300 focus-visible:text-red-600"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
