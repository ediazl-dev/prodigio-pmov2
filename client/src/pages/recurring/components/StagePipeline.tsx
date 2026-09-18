/**
 * Pipeline de etapas, subido al tercer bloque.
 *
 * Es el único control que hace avanzar el servicio, así que deja de estar
 * debajo de dos bloques de métricas. También baja de tamaño: la tarjeta hero
 * de 28px de padding con marca de agua y animación de pulso pasa a ser una
 * fila de cinco chips con la etapa en curso destacada y una sola CTA.
 */

import { ArrowRight, Check, Lock } from "lucide-react";
import type { PipelineStage, StagePipeline as StagePipelineModel } from "../serviceDetailViewModel";

const SKIN: Record<PipelineStage["state"], { box: string; dot: string; title: string; note: string }> = {
  done: {
    box: "border-[#ABEFC6] bg-[#F7FDF9] hover:bg-[#ECFDF3]",
    dot: "bg-[#067647]",
    title: "text-slate-950",
    note: "text-slate-600",
  },
  active: {
    box: "border-[#FEDF89] bg-[#FFFAEB] shadow-[inset_3px_0_0_#B54708] hover:brightness-[0.98]",
    dot: "bg-[#B54708]",
    title: "text-slate-950",
    note: "text-[#7A3A06]",
  },
  locked: {
    box: "border-slate-200 bg-slate-50/70",
    dot: "bg-slate-300",
    title: "text-slate-600",
    note: "text-slate-500",
  },
};

interface StagePipelineProps {
  pipeline: StagePipelineModel;
  onOpenStage: (stage: PipelineStage) => void;
}

export function StagePipeline({ pipeline, onOpenStage }: StagePipelineProps) {
  const active = pipeline.activeStage;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-[14px] font-black text-slate-950">Pipeline de etapas</h2>
        <span className="text-[11px] text-slate-600">{pipeline.progressLabel}</span>
        <div className="flex-grow" />
        {active && (
          <button
            type="button"
            onClick={() => onOpenStage(active)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border-0 bg-[#B54708] px-4 text-[12.5px] font-bold text-white transition hover:bg-[#93380A]"
          >
            Continuar {active.label}
            <ArrowRight size={14} />
          </button>
        )}
      </div>

      <ol className="mt-3 grid list-none grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {pipeline.stages.map(stage => {
          const skin = SKIN[stage.state];
          const content = (
            <>
              <span className="flex items-center gap-2">
                <i className={`block h-2.5 w-2.5 shrink-0 rounded-full ${skin.dot}`} aria-hidden="true" />
                <b className={`text-[12px] font-bold ${skin.title}`}>{stage.label}</b>
                {stage.state === "done" && <Check size={12} className="text-[#067647]" strokeWidth={3} />}
                {stage.state === "locked" && <Lock size={11} className="text-slate-400" strokeWidth={2.4} />}
              </span>
              <span className={`mt-1 block text-[10.5px] ${skin.note}`}>{stage.note}</span>
            </>
          );

          return (
            <li key={stage.id}>
              {stage.navigable ? (
                <button
                  type="button"
                  onClick={() => onOpenStage(stage)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${skin.box}`}
                >
                  {content}
                </button>
              ) : (
                <div className={`rounded-xl border px-3 py-2.5 ${skin.box}`} aria-disabled="true">
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
