/**
 * «Proyectos activos, por urgencia». Reemplaza a «Proyectos Recientes».
 *
 * El orden cambia de criterio: antes era `projects.slice(0, 8)` — los últimos
 * creados. Ahora es el exceso de plazo de la etapa en curso, que es lo que
 * decide dónde hay que meter la mano hoy.
 */

import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";
import { ProjectIdBadge } from "@/components/ProjectIdBadge";
import {
  ATTENTION_STATE,
  TONE,
  money,
  signedDays,
  type AttentionRow,
} from "./executiveDashboardFormat";

interface AttentionListProps {
  rows: AttentionRow[];
  /** Cuántas filas mostrar antes de "ver todos". */
  limit?: number;
}

export function AttentionList({ rows, limit = 6 }: AttentionListProps) {
  const [, navigate] = useLocation();
  const visible = rows.slice(0, limit);
  const overdue = rows.filter(row => row.state === "overdue").length;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-3.5">
        <span
          className={`grid h-[25px] w-[25px] shrink-0 place-items-center rounded-lg ${overdue > 0 ? "bg-red-50" : "bg-emerald-50"}`}
        >
          {overdue > 0 ? (
            <AlertTriangle
              size={14}
              className="text-[#B42318]"
              strokeWidth={2.2}
            />
          ) : (
            <CheckCircle2
              size={14}
              className="text-[#067647]"
              strokeWidth={2.2}
            />
          )}
        </span>
        <div className="min-w-0">
          <h2 className="text-[16px] font-black tracking-tight text-slate-950">
            Proyectos activos, por urgencia
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-600">
            Ordenados por exceso de plazo de la etapa en curso, no por fecha de
            creación
          </p>
        </div>
        <div className="flex-grow" />
        {rows.length > visible.length && (
          <button
            type="button"
            onClick={() => navigate("/projects")}
            className="text-xs font-bold text-[#175CD3] hover:text-[#0A4AA8]"
          >
            Ver los {rows.length} activos
          </button>
        )}
      </header>

      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-[12.5px] text-slate-600">
          No hay proyectos activos en la cartera.
        </p>
      ) : (
        <>
          <div
            className="overflow-x-auto"
            tabIndex={0}
            aria-label="Tabla de proyectos activos por urgencia"
          >
            <div className="min-w-[1040px]">
              <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-2 text-[9.5px] font-black uppercase tracking-[0.1em] text-slate-500">
                <span className="w-[330px] shrink-0">Proyecto</span>
                <span className="w-[110px] shrink-0">Etapa</span>
                <span className="w-[180px] shrink-0">Plazo de la etapa</span>
                <span className="w-[104px] shrink-0 text-center">Estado</span>
                <span className="flex-grow">Riesgos altos</span>
                <span className="w-[120px] shrink-0 text-right">
                  Contratado
                </span>
                <span className="w-[78px] shrink-0" />
              </div>

              <ul className="list-none">
                {visible.map((row, index) => {
                  const state = ATTENTION_STATE[row.state];
                  const tone = TONE[state.tone];
                  const ratio =
                    row.daysUsed !== null && row.daysAllowed
                      ? Math.min(
                          100,
                          Math.round((row.daysUsed / row.daysAllowed) * 100)
                        )
                      : 0;

                  return (
                    <li
                      key={row.projectId}
                      className={`flex items-center gap-3 border-b border-slate-50 px-5 py-2.5 ${index % 2 === 1 ? "bg-slate-50/40" : ""}`}
                    >
                      <div className="w-[330px] shrink-0">
                        <div className="flex items-center gap-2">
                          <a
                            href={`/projects/${row.projectId}`}
                            onClick={event => {
                              event.preventDefault();
                              navigate(`/projects/${row.projectId}`);
                            }}
                            className="min-w-0 truncate text-[12.5px] font-bold text-slate-950 hover:text-[#175CD3]"
                          >
                            {row.projectName}
                          </a>
                          <ProjectIdBadge
                            projectId={row.projectId}
                            className="shrink-0"
                          />
                        </div>
                        <p className="mt-0.5 truncate text-[10.5px] text-slate-600">
                          {row.clientName}
                          {row.dealId ? ` · ${row.dealId}` : ""} ·{" "}
                          {row.pmName ?? "PM sin asignar"}
                        </p>
                      </div>

                      <span className="w-[110px] shrink-0 text-[11.5px] font-semibold text-slate-700">
                        {row.stageLabel}
                      </span>

                      <div className="w-[180px] shrink-0">
                        {row.daysUsed !== null && row.daysAllowed !== null ? (
                          <>
                            <div className="flex items-baseline gap-1.5">
                              <b
                                className="font-mono text-[13px]"
                                style={{ color: tone.text }}
                              >
                                {row.daysUsed} / {row.daysAllowed}
                              </b>
                              <span className="text-[10.5px] text-slate-600">
                                {signedDays(row.overDays)}
                              </span>
                            </div>
                            <div className="mt-1.5 h-[5px] overflow-hidden rounded bg-slate-100">
                              <i
                                className="block h-full rounded"
                                style={{
                                  width: `${ratio}%`,
                                  background: tone.text,
                                }}
                              />
                            </div>
                          </>
                        ) : (
                          <span className="text-[11.5px] text-slate-600">
                            Sin apertura registrada
                          </span>
                        )}
                      </div>

                      <span
                        className="w-[104px] shrink-0 rounded-full border py-1 text-center text-[10px] font-black uppercase tracking-wide"
                        style={{
                          color: tone.text,
                          background: tone.surface,
                          borderColor: tone.border,
                        }}
                      >
                        {state.label}
                      </span>

                      <span
                        className="min-w-0 flex-grow text-[11.5px]"
                        style={{
                          color: row.highRisksOpen > 0 ? "#B54708" : "#475569",
                        }}
                      >
                        {row.highRisksOpen > 0
                          ? `${row.highRisksOpen} alto${row.highRisksOpen === 1 ? "" : "s"} abierto${row.highRisksOpen === 1 ? "" : "s"}`
                          : "Sin riesgos altos"}
                      </span>

                      <span className="w-[120px] shrink-0 text-right font-mono text-[12.5px] font-bold text-slate-950">
                        {row.amount !== null && row.currency
                          ? money(row.amount, row.currency)
                          : "N/D"}
                      </span>

                      <button
                        type="button"
                        onClick={() => navigate(`/projects/${row.projectId}`)}
                        aria-label={`Abrir ${row.projectName}`}
                        className="inline-flex h-8 w-[78px] shrink-0 items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white text-[11.5px] font-bold text-[#175CD3] transition hover:bg-slate-50"
                      >
                        Abrir
                        <ArrowRight size={13} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
