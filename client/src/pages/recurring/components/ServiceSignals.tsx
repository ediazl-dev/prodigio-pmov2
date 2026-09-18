/**
 * «Qué hacer con este servicio»: las señales de gestión, arriba y accionables.
 *
 * Reutiliza `buildActionQueue` del rediseño del dashboard pasándole una matriz
 * de un solo servicio. Así una señal se ve igual, se ordena igual y ofrece la
 * misma acción en la cartera y en el detalle: una sola fuente de verdad.
 *
 * REQUISITO: el kit del dashboard (recurringDashboardV3ViewModel.ts) debe estar
 * aplicado antes que este.
 */

import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import type { ActionQueueItem } from "../recurringDashboardV3ViewModel";

interface ServiceSignalsProps {
  items: ActionQueueItem[];
  onAction: (item: ActionQueueItem) => void;
}

export function ServiceSignals({ items, onAction }: ServiceSignalsProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-3.5">
        <span className="grid h-[25px] w-[25px] shrink-0 place-items-center rounded-lg bg-red-50">
          <AlertTriangle size={14} className="text-[#B42318]" strokeWidth={2.2} />
        </span>
        <h2 className="text-[16px] font-black tracking-tight text-slate-950">Qué hacer con este servicio</h2>
        <span className="text-[11px] text-slate-600">
          {items.length === 0
            ? "Sin señales abiertas según la evidencia disponible"
            : `${items.length} señal${items.length === 1 ? "" : "es"} abierta${items.length === 1 ? "" : "s"} · las mismas que lo clasifican en la Torre de Control`}
        </span>
      </header>

      {items.length === 0 ? (
        <div className="flex items-center gap-4 px-5 py-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50">
            <CheckCircle2 size={20} className="text-[#067647]" strokeWidth={2.2} />
          </span>
          <p className="text-[12.5px] leading-5 text-slate-700">
            Este servicio no tiene señales críticas ni de atención. Eso no significa que todo esté medido: revisa la
            cobertura de evidencia en la pestaña Evidencias.
          </p>
        </div>
      ) : (
        <ul className="list-none divide-y divide-slate-100">
          {items.map((item, index) => (
            <li
              key={item.id}
              className={`flex flex-wrap items-center gap-3 px-5 py-3 ${index % 2 === 1 ? "bg-slate-50/40" : ""}`}
            >
              <span
                className="inline-flex h-[22px] w-[78px] shrink-0 items-center justify-center rounded-full border text-[10px] font-black uppercase tracking-wider"
                style={{ color: item.tone.text, background: item.tone.surface, borderColor: item.tone.border }}
              >
                {item.tone.label}
              </span>

              <div className="min-w-0 flex-grow">
                <p className="text-[12.5px] leading-[18px] text-slate-800">{item.message}</p>
                <p className="mt-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {item.code}
                </p>
              </div>

              <div className="w-[150px] shrink-0 text-right">
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
                onClick={() => onAction(item)}
                className="inline-flex h-9 w-[152px] shrink-0 items-center justify-center gap-1.5 rounded-lg border text-xs font-bold transition hover:brightness-95"
                style={{ color: item.tone.text, background: item.tone.surface, borderColor: item.tone.border }}
              >
                {item.actionLabel}
                <ArrowRight size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
