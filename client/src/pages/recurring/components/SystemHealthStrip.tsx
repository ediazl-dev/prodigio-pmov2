/**
 * Zona 4 — Salud del sistema. Segundo orden, al pie, colapsado.
 *
 * Aquí baja el "Historial de actualización" que hoy comparte el primer scroll
 * con la cartera. Es telemetría del ETL: dice si el dato llegó, no qué hacer
 * con el dato. El resumen de una línea es lo único de primer orden que tiene
 * (¿falló la última corrida?), y ese resumen se ve sin abrir nada.
 */

import { useState } from "react";
import { BarChart3, ChevronDown, Clock3, RefreshCw } from "lucide-react";
import { formatCutOffDate } from "../recurringDashboardV2ViewModel";
import type { DashboardV2Data } from "../recurringDashboardV3ViewModel";

const RUN_STATUS_UI: Record<string, { label: string; className: string }> = {
  success: { label: "Exitosa", className: "bg-emerald-100 text-emerald-900" },
  partial: { label: "Parcial", className: "bg-amber-100 text-amber-950" },
  error: { label: "Error", className: "bg-red-100 text-red-900" },
  skipped: { label: "Omitida", className: "bg-slate-100 text-slate-700" },
};

type JsmRun = {
  id: number | string;
  trigger: string;
  status: string;
  completedAt: string;
  successCount: number;
  partialCount: number;
  errorCount: number;
  skippedCount: number;
  errors: Array<{ serviceName: string; errorMessage?: string | null }>;
};

interface SystemHealthStripProps {
  metadata: DashboardV2Data["metadata"];
  evidenceInventory: DashboardV2Data["evidenceInventory"];
  runs: JsmRun[];
  isLoadingRuns: boolean;
  runsError: string | null;
  onRetryRuns: () => void;
}

export function SystemHealthStrip({
  metadata,
  evidenceInventory,
  runs,
  isLoadingRuns,
  runsError,
  onRetryRuns,
}: SystemHealthStripProps) {
  const [open, setOpen] = useState(false);

  const partial = runs.filter(run => run.status === "partial").length;
  const failed = runs.filter(run => run.status === "error").length;

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-[11.5px] text-slate-700">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Salud del sistema</span>

        <span className="inline-flex items-center gap-1.5">
          <BarChart3 size={13} className="text-slate-400" />
          Lectura generada el <b>{new Date(metadata.generatedAt).toLocaleString("es-CL")}</b> · corte{" "}
          {formatCutOffDate(metadata.cutOffDate)}
        </span>

        <span className="hidden h-5 w-px bg-slate-200 sm:block" />

        <span>
          Último snapshot JSM{" "}
          <b>{metadata.latestJsmSnapshotAt ? new Date(metadata.latestJsmSnapshotAt).toLocaleString("es-CL") : "N/D"}</b>
        </span>

        <span className="hidden h-5 w-px bg-slate-200 sm:block" />

        <span>
          {runs.length} corrida{runs.length === 1 ? "" : "s"}
          {partial > 0 && <> · <b className="text-[#B54708]">{partial} parcial{partial === 1 ? "" : "es"}</b></>}
          {failed > 0 && <> · <b className="text-[#B42318]">{failed} con error</b></>}
        </span>

        <span className="hidden h-5 w-px bg-slate-200 sm:block" />

        <span>
          Evidencias D2: {evidenceInventory.reportEvidence} reportes · {evidenceInventory.financialEvidence} financieras
          · {evidenceInventory.documentControls} controles · {evidenceInventory.jsmSnapshots} snapshots
        </span>

        <div className="flex-grow" />

        <button
          type="button"
          onClick={() => setOpen(value => !value)}
          aria-expanded={open}
          aria-controls="jsm-history"
          className="inline-flex items-center gap-1 text-xs font-bold text-[#175CD3] hover:text-[#0A4AA8]"
        >
          <Clock3 size={14} />
          {open ? "Ocultar historial" : "Ver historial de actualización"}
          <ChevronDown size={14} className={open ? "rotate-180 transition" : "transition"} />
        </button>
      </div>

      {open && (
        <div id="jsm-history" className="border-t border-slate-200 p-4">
          {isLoadingRuns ? (
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-600">
              <RefreshCw size={14} className="animate-spin" /> Cargando ejecuciones…
            </div>
          ) : runsError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900">
              <p className="font-bold">Historial no disponible</p>
              <p className="mt-1 leading-5">{runsError}</p>
              <button type="button" onClick={onRetryRuns} className="mt-2 font-bold text-red-800 underline underline-offset-2">
                Reintentar
              </button>
            </div>
          ) : runs.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
              Aún no existen corridas D9 registradas. La actualización manual generará la primera evidencia.
            </p>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {runs.map(run => {
                const statusUi = RUN_STATUS_UI[run.status] ?? RUN_STATUS_UI.partial;
                return (
                  <article key={run.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-black text-slate-900">
                          {run.trigger === "scheduled" ? "Actualización diaria" : "Actualización manual"}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-600">
                          {new Date(run.completedAt).toLocaleString("es-CL")}
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black ${statusUi.className}`}>
                        {statusUi.label}
                      </span>
                    </div>
                    <div className="mt-2.5 grid grid-cols-4 gap-1 text-center">
                      {(
                        [
                          { label: "OK", value: run.successCount, tone: "text-[#067647]" },
                          { label: "Parcial", value: run.partialCount, tone: "text-[#B54708]" },
                          { label: "Error", value: run.errorCount, tone: "text-[#B42318]" },
                          { label: "Omit.", value: run.skippedCount, tone: "text-slate-700" },
                        ] as const
                      ).map(item => (
                        <div key={item.label} className="rounded-lg bg-white px-1 py-1.5">
                          <b className={`block font-mono text-sm ${item.tone}`}>{item.value}</b>
                          <span className="text-[9px] font-bold uppercase text-slate-500">{item.label}</span>
                        </div>
                      ))}
                    </div>
                    {run.errors.length > 0 && (
                      <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-[#B42318]">
                        {run.errors[0].serviceName}: {run.errors[0].errorMessage ?? "Cobertura parcial sin detalle adicional."}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
