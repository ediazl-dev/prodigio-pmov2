/**
 * Cola de acción: el bloque nuevo. Una fila por hallazgo, no por servicio.
 *
 * Un servicio con tres señales abiertas ocupa tres filas, porque cada señal
 * es una decisión distinta con un responsable distinto.
 */

import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";
import type { ActionQueueItem } from "../recurringDashboardV3ViewModel";

interface ActionQueueProps {
  items: ActionQueueItem[];
  /** Total sin filtrar, para el subtítulo. */
  totalFindings: number;
  onlyCritical: boolean;
  onToggleOnlyCritical: () => void;
}

export function ActionQueue({ items, totalFindings, onlyCritical, onToggleOnlyCritical }: ActionQueueProps) {
  const [, navigate] = useLocation();

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <header className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-red-50">
          <AlertTriangle size={16} className="text-[#B42318]" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <h2 className="text-[17px] font-black tracking-tight text-slate-950">Cola de acción</h2>
          <p className="mt-0.5 text-[11px] text-slate-600">
            {totalFindings} hallazgo{totalFindings === 1 ? "" : "s"} abierto{totalFindings === 1 ? "" : "s"}, ordenados
            por severidad y por monto expuesto
          </p>
        </div>
        <div className="flex-grow" />
        <button
          type="button"
          onClick={onToggleOnlyCritical}
          aria-pressed={onlyCritical}
          className={`h-8 rounded-full border px-3 text-[11.5px] font-bold transition ${
            onlyCritical
              ? "border-[#FDA29B] bg-[#FEF3F2] text-[#B42318]"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          Solo críticos
        </button>
        <a href="#cartera" className="text-xs font-bold text-[#175CD3] hover:text-[#0A4AA8]">
          Ver toda la cartera
        </a>
      </header>

      {items.length === 0 ? (
        <EmptyQueue hadFindings={totalFindings > 0} />
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map(item => (
            <li key={item.id}>
              <div className="grid gap-3 px-5 py-3.5 transition hover:bg-slate-50/70 xl:grid-cols-[auto_minmax(200px,280px)_minmax(240px,1fr)_150px_152px] xl:items-center">
                <span
                  className="inline-flex h-[22px] shrink-0 items-center justify-center rounded-full border px-2.5 text-[10px] font-black uppercase tracking-wider"
                  style={{ color: item.tone.text, background: item.tone.surface, borderColor: item.tone.border }}
                >
                  {item.tone.label}
                </span>

                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold text-slate-950">{item.serviceName}</p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-600">
                    {item.clientName} · Deal {item.dealId ?? "N/D"} · {item.stageLabel}
                  </p>
                </div>

                <div className="min-w-0 flex-grow">
                  <p className="text-[12.5px] leading-[18px] text-slate-800">{item.message}</p>
                  <p className="mt-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {item.code}
                  </p>
                </div>

                <div className="text-left xl:text-right">
                  <p
                    className={
                      item.impactIsMoney
                        ? "font-mono text-[17px] font-black text-[#B42318]"
                        : "text-[13px] font-bold text-slate-600"
                    }
                  >
                    {item.impactValue}
                  </p>
                  <p className="mt-0.5 text-[10.5px] text-slate-600">{item.impactNote}</p>
                </div>

                <button
                  type="button"
                  onClick={() => navigate(item.href)}
                  className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border text-xs font-bold transition hover:brightness-95 sm:w-[152px]"
                  style={{ color: item.tone.text, background: item.tone.surface, borderColor: item.tone.border }}
                >
                  {item.actionLabel}
                  <ArrowRight size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Estado vacío. Cuando la cartera no tiene señales, el bloque se reduce a una
 * línea y la cartera de servicios sube al primer scroll.
 */
function EmptyQueue({ hadFindings }: { hadFindings: boolean }) {
  return (
    <div className="flex items-center gap-4 px-5 py-6">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50">
        <CheckCircle2 size={22} className="text-[#067647]" strokeWidth={2.2} />
      </span>
      <div>
        <p className="text-[15px] font-black text-slate-950">
          {hadFindings ? "Sin hallazgos para este filtro" : "Sin hallazgos abiertos"}
        </p>
        <p className="mt-1 text-[12.5px] leading-5 text-slate-700">
          {hadFindings
            ? "Quita el filtro de severidad o de salud para ver el resto de la cola."
            : "Ningún servicio del universo filtrado tiene señales críticas ni de atención según la evidencia disponible."}
        </p>
      </div>
    </div>
  );
}
