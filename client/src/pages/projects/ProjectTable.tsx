/**
 * Tabla densa y trazable del portafolio.
 *
 * Distingue explícitamente la fase operativa Jira del pipeline interno PMO,
 * y separa el ciclo de vida del proyecto de su salud ejecutiva.
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
  { key: "name", label: "Proyecto", className: "w-[225px] xl:w-[20%]" },
  { key: "client", label: "Cliente", className: "w-[105px] xl:w-[9%]" },
  { key: "stage", label: "Fase / pipeline", className: "w-[190px] xl:w-[17%]" },
  { key: null, label: "Hitos", className: "w-[82px] xl:w-[7%]", align: "center" },
  { key: "plazo", label: "Plazo PMO", className: "w-[110px] xl:w-[10%]" },
  { key: "urgency", label: "Estado / salud", className: "w-[120px] xl:w-[11%]", align: "center" },
  { key: null, label: "PM", className: "w-[110px] xl:w-[10%]" },
  { key: "risks", label: "Riesgos", className: "w-[82px] xl:w-[7%]", align: "center" },
  { key: "amount", label: "Contratado", className: "w-[105px] xl:w-[8%]", align: "right" },
  { key: null, label: "", className: "w-[34px] xl:w-[3%]" },
];

const PIPELINE_STAGE_IDS = ["sow", "jira", "risks", "planning", "design", "closure"] as const;

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

const AMOUNT_SOURCE_LABEL: Record<PortfolioRow["amountSource"], string> = {
  financial_data: "Fuente: datos financieros por Deal",
  project: "Fuente: ficha del proyecto",
  billing_milestones: "Fuente: suma de hitos de facturación en una sola moneda",
  missing: "Monto contratado sin evidencia disponible",
};

export function ProjectTable({ rows, sort, onSortChange, canDelete, onDelete }: ProjectTableProps) {
  const [, navigate] = useLocation();

  return (
    <div
      className="w-full max-w-full min-w-0 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
      role="region"
      aria-label="Portafolio de proyectos; desplázate horizontalmente en pantallas estrechas"
      tabIndex={0}
    >
      <table className="w-full min-w-[1160px] table-fixed border-collapse text-left xl:min-w-0">
        <caption className="sr-only">
          Portafolio completo con proyecto, cliente, fase Jira, pipeline PMO, hitos, plazo PMO, ciclo de vida, salud, PM, riesgos y monto contratado.
        </caption>
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/70">
            {COLUMNS.map(column => {
              const sorted = column.key !== null && sort.key === column.key;
              return (
                <th
                  key={column.label || "acciones"}
                  scope="col"
                  aria-sort={column.key ? (sorted ? (sort.direction === "asc" ? "ascending" : "descending") : "none") : undefined}
                  className={`px-2.5 py-2 text-[9px] font-black uppercase tracking-[0.08em] text-slate-500 ${column.className} ${
                    column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : ""
                  }`}
                >
                  {column.key ? (
                    <button
                      type="button"
                      onClick={() => onSortChange(column.key as SortKey)}
                      className={`inline-flex items-center gap-1 uppercase tracking-[0.08em] transition hover:text-slate-900 ${sorted ? "text-slate-900" : ""}`}
                    >
                      {column.label}
                      {sorted ? (
                        sort.direction === "asc" ? <ChevronUp size={12} strokeWidth={3} /> : <ChevronDown size={12} strokeWidth={3} />
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
            const currentHealth = cleanHealth(row.executiveHealth);
            const currentHealthTone = healthTone(currentHealth);
            const ratio = row.daysUsed !== null && row.daysAllowed
              ? Math.min(100, Math.round((row.daysUsed / row.daysAllowed) * 100))
              : 0;
            const milestonePct = row.milestonesTotal && row.milestonesFulfilled !== null
              ? Math.round((row.milestonesFulfilled / row.milestonesTotal) * 100)
              : null;

            return (
              <tr
                key={row.projectId}
                className={`border-b border-slate-50 align-top transition hover:bg-slate-50/70 ${index % 2 === 1 ? "bg-slate-50/30" : ""}`}
              >
                <td className="px-2.5 py-2.5">
                  <a
                    href={`/projects/${row.projectId}`}
                    onClick={event => {
                      event.preventDefault();
                      navigate(`/projects/${row.projectId}`);
                    }}
                    className="block break-all text-[12px] font-bold leading-4 text-slate-950 hover:text-[#175CD3]"
                    title={row.projectName}
                  >
                    {row.projectName}
                  </a>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <ProjectIdBadge projectId={row.projectId} tone="muted" />
                    {row.dealId && <span className="font-mono text-[9.5px] text-slate-500">{row.dealId}</span>}
                    <span className="text-[9.5px] text-slate-500">{PROJECT_TYPE_LABEL[row.projectType ?? "otro"] ?? row.projectType}</span>
                    {row.origin === "linked" && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-50 px-1.5 py-0.5 text-[9px] font-bold text-violet-700" title="Proyecto vinculado desde Jira">
                        <Link2 size={8} /> Vinculado
                      </span>
                    )}
                  </div>
                </td>

                <td className="px-2.5 py-2.5 text-[11px] text-slate-700">
                  <span className="block break-words" title={row.clientName}>{row.clientName}</span>
                </td>

                <td className="px-2.5 py-2.5">
                  <div className="text-[11.5px] font-bold leading-4 text-slate-900">
                    {row.operationalPhase ?? "Fase operativa N/D"}
                  </div>
                  <div className="mt-0.5 text-[9.5px] text-slate-500">
                    Pipeline PMO: {row.stageLabel} · {row.stagesClosed}/{row.totalStages} completadas
                  </div>
                  <div
                    className="mt-1 flex gap-[3px]"
                    role="img"
                    aria-label={`${row.stagesClosed} de ${row.totalStages} etapas PMO completadas, cursor en ${row.stageLabel}`}
                  >
                    {PIPELINE_STAGE_IDS.slice(0, row.totalStages).map((stageId, position) => (
                      <i
                        key={stageId}
                        className="block h-[4px] flex-grow rounded-sm"
                        style={{
                          background: row.closedStageIds.includes(stageId)
                            ? "#067647"
                            : position === row.stageIndex
                              ? "#175CD3"
                              : "#E2E8F0",
                        }}
                      />
                    ))}
                  </div>
                  {row.operationalProgressPct !== null && (
                    <div className="mt-1 font-mono text-[9.5px] text-[#175CD3]">Avance Jira {row.operationalProgressPct}%</div>
                  )}
                </td>

                <td className="px-2.5 py-2.5 text-center">
                  {row.milestonesTotal !== null && row.milestonesFulfilled !== null ? (
                    <div title={`Fuente Jira: ${row.milestonesFulfilled} de ${row.milestonesTotal} hitos cumplidos`}>
                      <b className="font-mono text-[12px] text-slate-900">{row.milestonesFulfilled}/{row.milestonesTotal}</b>
                      <span className="mt-0.5 block text-[9.5px] text-slate-500">cerrados</span>
                      {milestonePct !== null && <span className="block font-mono text-[9.5px] text-slate-500">{milestonePct}%</span>}
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-500">N/D</span>
                  )}
                </td>

                <td className="px-2.5 py-2.5">
                  {row.daysUsed !== null && row.daysAllowed !== null ? (
                    <>
                      <div className="flex items-baseline gap-1.5">
                        <b className="font-mono text-[11.5px]" style={{ color: deadlineTone.text }}>{row.daysUsed}/{row.daysAllowed}</b>
                        <span className="text-[9.5px] text-slate-600">{deadlineSummary(row)}</span>
                      </div>
                      <div className="mt-1 h-[4px] overflow-hidden rounded bg-slate-100">
                        <i className="block h-full rounded" style={{ width: `${ratio}%`, background: deadlineTone.text }} />
                      </div>
                    </>
                  ) : (
                    <div>
                      <span className="text-[10px] font-semibold text-slate-700">{deadlineSummary(row)}</span>
                      {row.deadlineReason === "missing_stage_opening" && (
                        <>
                          <span className="mt-0.5 block text-[8.5px] leading-3 text-slate-500">
                            {row.configuredDaysAllowed !== null
                              ? `Plazo configurado: ${row.configuredDaysAllowed} días hábiles`
                              : "Sin plazo configurado"}
                          </span>
                          <span className="block text-[8.5px] leading-3 text-slate-500">Falta fecha de apertura · no mide avance Jira</span>
                        </>
                      )}
                    </div>
                  )}
                </td>

                <td className="px-2.5 py-2.5 text-center">
                  <span
                    className="inline-block w-full rounded-full border py-0.5 text-[9.5px] font-black uppercase tracking-wide"
                    style={{ color: statusTone.text, background: statusTone.surface, borderColor: statusTone.border }}
                    title="Ciclo de vida administrativo en PMO"
                  >
                    {STATUS_LABEL[row.status]}
                  </span>
                  <span
                    className="mt-1 block rounded-full border px-1 py-0.5 text-[9px] font-bold"
                    style={{ color: currentHealthTone.text, background: currentHealthTone.surface, borderColor: currentHealthTone.border }}
                    title={row.jiraEvidenceAt ? `Salud ejecutiva Jira. Evidencia: ${new Date(row.jiraEvidenceAt).toLocaleString("es-CL")}` : "Salud ejecutiva sin evidencia Jira"}
                  >
                    Salud: {currentHealth ?? "N/D"}
                  </span>
                  {row.jiraEvidenceStale && row.origin === "linked" && (
                    <span className="mt-0.5 block text-[8.5px] font-bold text-[#B54708]">Evidencia Jira pendiente</span>
                  )}
                  {row.jiraEvidenceStatus === "partial" && !row.jiraEvidenceStale && (
                    <span className="mt-0.5 block text-[8.5px] font-bold text-[#B54708]">Evidencia Jira parcial</span>
                  )}
                </td>

                <td className="px-2.5 py-2.5 text-[11px]">
                  {row.pmName ? <span className="block break-words text-slate-700" title={row.pmName}>{row.pmName}</span> : <span className="text-slate-500">N/D</span>}
                </td>

                <td className="px-2.5 py-2.5 text-center">
                  {row.openRisks !== null ? (
                    <div title={`Fuente: ${row.riskSource === "jira_snapshot" ? "snapshot Jira" : "matriz PMO confirmada"}`}>
                      <b className="font-mono text-[12px] text-slate-900">{row.openRisks}</b>
                      <span className="block text-[9px] text-slate-500">abiertos</span>
                      {(row.highRisksOpen ?? 0) > 0 && <span className="block text-[9px] font-bold text-[#B54708]">{row.highRisksOpen} altos</span>}
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-500">N/D</span>
                  )}
                </td>

                <td className="px-2.5 py-2.5 text-right">
                  {row.amount !== null && row.currency ? (
                    <div title={AMOUNT_SOURCE_LABEL[row.amountSource]}>
                      <span className="font-mono text-[11.5px] font-bold text-slate-950">{money(row.amount, row.currency)}</span>
                      <span className="mt-0.5 block text-[8.5px] text-slate-500">
                        {row.amountSource === "financial_data" ? "Finanzas" : row.amountSource === "billing_milestones" ? "Hitos" : "Ficha"}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-500" title={AMOUNT_SOURCE_LABEL.missing}>N/D</span>
                  )}
                </td>

                <td className="px-2.5 py-2.5">
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
