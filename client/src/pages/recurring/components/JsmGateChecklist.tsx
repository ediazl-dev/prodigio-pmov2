/**
 * La checklist de cierre de JSM Setup.
 *
 * Cada bloqueo que el servidor calcula pasa a ser un paso con estado y acción.
 * El paso "current" es el único que se muestra expandido con su control real;
 * el resto ocupa una línea. Así la página responde «qué me falta» sin scroll.
 *
 * Los controles reales (los dos selects de tipo de issue, el botón de dry-run)
 * los inyecta la página con `renderControl`, porque dependen de mutaciones que
 * viven allí. Este componente solo decide el orden, el estado y la jerarquía.
 */

import React, { type ReactNode } from "react";
import { AlertTriangle, Check, Lock } from "lucide-react";
import type { GateStep, GateStepState, JsmSetupGate } from "../jsmSetupGate";

const STEP_SKIN: Record<GateStepState, { row: string; circle: string; title: string; detail: string }> = {
  done: {
    row: "bg-[#F7FDF9] border-b border-slate-100",
    circle: "bg-[#ECFDF3] border-[#ABEFC6] text-[#067647]",
    title: "text-slate-950",
    detail: "text-slate-700",
  },
  warning: {
    row: "bg-[#FFFCF5] border-b border-slate-100",
    circle: "bg-[#FFFAEB] border-[#FEDF89] text-[#B54708]",
    title: "text-slate-950",
    detail: "text-slate-700",
  },
  current: {
    row: "bg-white border-b border-slate-100 border-l-4 border-l-[#E91E8C]",
    circle: "bg-[#FDF2F8] border-[#F9A8D4] text-[#9D174D]",
    title: "text-slate-950",
    detail: "text-slate-700",
  },
  pending: {
    row: "bg-white border-b border-slate-100",
    circle: "bg-slate-100 border-slate-300 text-slate-600",
    title: "text-slate-950",
    detail: "text-slate-700",
  },
  blocked: {
    row: "bg-slate-50/70 border-b border-slate-100",
    circle: "bg-slate-100 border-slate-300 text-slate-500",
    title: "text-slate-600",
    detail: "text-slate-600",
  },
};

interface JsmGateChecklistProps {
  gate: JsmSetupGate;
  /** Control real del paso. Solo se pinta en el paso "current". */
  renderControl?: (step: GateStep) => ReactNode;
  /** Acción secundaria de un paso ya resuelto (p. ej. "Revalidar vínculo"). */
  onStepAction?: (step: GateStep) => void;
}

export function JsmGateChecklist({ gate, renderControl, onStepAction }: JsmGateChecklistProps) {
  // Si la derivación local no coincide con el servidor, no mostramos la
  // checklist: mostramos lo que el servidor dice, tal cual. Es preferible una
  // lista fea y correcta a una bonita que miente sobre si se puede cerrar.
  if (gate.serverMismatch) {
    return (
      <section className="overflow-hidden rounded-2xl border border-[#FDA29B] bg-white">
        <header className="flex flex-wrap items-center gap-2 border-b border-[#FDA29B] bg-[#FEF3F2] px-5 py-3">
          <AlertTriangle size={16} className="text-[#B42318]" />
          <h2 className="text-[15px] font-black text-[#B42318]">Qué falta para cerrar</h2>
          <span className="text-[11px] text-[#7F1D1D]">
            La checklist local no coincide con la validación del servidor; se muestra la del servidor.
          </span>
        </header>
        <ul className="divide-y divide-slate-100">
          {gate.blockers.map(blocker => (
            <li key={blocker} className="px-5 py-3 text-[12.5px] text-slate-800">
              • {blocker}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-3.5">
        <h2 className="text-[16px] font-black tracking-tight text-slate-950">Qué falta para cerrar</h2>
        <span className="text-[11px] text-slate-600">
          {gate.doneCount} de {gate.totalCount} pasos listos
        </span>
      </header>

      <ol className="list-none">
        {gate.steps.map(step => {
          const skin = STEP_SKIN[step.state];
          const isCurrent = step.state === "current";
          const control = isCurrent && renderControl ? renderControl(step) : null;

          return (
            <li key={step.id} className={`px-5 ${isCurrent ? "py-4" : "py-3"} ${skin.row}`}>
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full border font-mono text-[12px] font-black ${skin.circle}`}
                  aria-hidden="true"
                >
                  {step.state === "done" ? (
                    <Check size={14} strokeWidth={3} />
                  ) : step.state === "warning" ? (
                    <AlertTriangle size={13} strokeWidth={2.6} />
                  ) : step.state === "blocked" ? (
                    <Lock size={12} strokeWidth={2.4} />
                  ) : (
                    step.order
                  )}
                </span>

                <b className={`w-[calc(100%-40px)] shrink-0 text-[13px] sm:w-[250px] ${skin.title}`}>
                  {step.order} · {step.title}
                </b>

                <span className={`min-w-0 flex-grow text-[12.5px] ${skin.detail}`}>{step.detail}</span>

                {isCurrent && (
                  <span className="shrink-0 rounded-full border border-[#F9A8D4] bg-[#FDF2F8] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#9D174D]">
                    Siguiente paso
                  </span>
                )}

                {!isCurrent &&
                  step.actionLabel &&
                  onStepAction &&
                  (step.state === "done" || step.state === "warning") && (
                  <button
                    type="button"
                    onClick={() => onStepAction(step)}
                    className={`h-8 shrink-0 rounded-lg border px-3 text-[11.5px] font-bold transition ${
                      step.state === "warning"
                        ? "border-[#FEDF89] bg-[#FFFAEB] text-[#B54708] hover:brightness-95"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {step.actionLabel}
                  </button>
                )}
              </div>

              {control && <div className="mt-3 sm:ml-[38px]">{control}</div>}
              {isCurrent && step.hint && !control && (
                <p className="ml-[38px] mt-2 text-[11px] text-slate-600">{step.hint}</p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
