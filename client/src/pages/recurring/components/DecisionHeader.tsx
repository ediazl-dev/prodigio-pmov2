/**
 * Zona 1 — Decidir. Barra de contexto + cifras de primer orden + confianza.
 *
 * La barra dark pasa de ~280px a ~128px: el titular, los chips de salud como
 * filtro y las acciones caben en dos filas. Los contadores de salud dejan de
 * ser tarjetas decorativas y son el filtro.
 */

import { Button } from "@/components/ui/button";
import { CalendarDays, DatabaseZap, RefreshCw } from "lucide-react";
import { RECURRING_HEALTH_UI, formatCutOffDate, type RecurringHealthKey } from "../recurringDashboardV2ViewModel";
import type { ConfidenceReading, DecisionMetric } from "../recurringDashboardV3ViewModel";

const TONE_STYLES: Record<DecisionMetric["tone"], { border: string; accent: string; value: string }> = {
  alert: { border: "border-[#FDA29B]", accent: "border-l-4 border-l-[#B42318]", value: "text-[#B42318]" },
  warn: { border: "border-[#FEDF89]", accent: "border-l-4 border-l-[#B54708]", value: "text-[#B54708]" },
  calm: { border: "border-slate-200", accent: "", value: "text-slate-950" },
};

const SEGMENT_COLOR: Record<ConfidenceReading["segments"][number]["tone"], string> = {
  alert: "bg-[#B42318]",
  warn: "bg-[#B54708]",
  calm: "bg-[#067647]",
};

interface DecisionHeaderProps {
  requiresAttention: number;
  totalServices: number;
  cutOffDate: string;
  onCutOffDateChange: (value: string) => void;
  healthCounts: Record<RecurringHealthKey, number>;
  health: string;
  onHealthChange: (value: string) => void;
  visibleLabel: string;
  contractVersion: string;
  metrics: DecisionMetric[];
  confidence: ConfidenceReading;
  isFetching: boolean;
  onRefetch: () => void;
  canRefreshJsm: boolean;
  isRefreshingJsm: boolean;
  onRefreshJsm: () => void;
}

export function DecisionHeader(props: DecisionHeaderProps) {
  const healthKeys = Object.keys(RECURRING_HEALTH_UI) as RecurringHealthKey[];

  return (
    <>
      <section className="relative overflow-hidden rounded-2xl bg-[#0A1628] px-5 py-4 text-white shadow-[0_18px_50px_rgba(10,22,40,0.18)] sm:px-6">
        <span className="absolute left-0 top-0 h-full w-[5px] bg-[#E91E8C]" aria-hidden="true" />

        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Torre de control · Servicios recurrentes
            </p>
            <h1 className="mt-1.5 text-2xl font-black tracking-[-0.02em] sm:text-[26px]">
              {props.requiresAttention} de {props.totalServices} servicios requieren acción
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {healthKeys.map(key => {
                const item = RECURRING_HEALTH_UI[key];
                const selected = props.health === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => props.onHealthChange(selected ? "all" : key)}
                    aria-pressed={selected}
                    className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 transition ${
                      selected ? "border-white/55 bg-white/[0.18]" : "border-white/15 bg-white/[0.06] hover:bg-white/[0.12]"
                    }`}
                  >
                    <i className="h-2 w-2 rounded-full" style={{ background: item.tone }} aria-hidden="true" />
                    <span className="text-[11px] font-bold">{item.shortLabel}</span>
                    <b className="font-mono text-[13px] font-black">{props.healthCounts[key]}</b>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-[38px] items-center gap-2 rounded-xl border border-white/15 bg-white/[0.07] px-3 text-xs font-semibold text-slate-200">
              <CalendarDays size={15} className="text-[#FF85C8]" />
              Corte
              <input
                type="date"
                value={props.cutOffDate}
                onChange={event => props.onCutOffDateChange(event.target.value)}
                className="bg-transparent font-bold text-white outline-none [color-scheme:dark]"
                aria-label="Fecha de corte"
              />
            </label>
            <Button
              variant="outline"
              onClick={props.onRefetch}
              disabled={props.isFetching}
              className="h-[38px] border-white/20 bg-white/[0.07] text-white hover:bg-white/15 hover:text-white"
            >
              <RefreshCw size={15} className={props.isFetching ? "mr-2 animate-spin" : "mr-2"} />
              Actualizar lectura
            </Button>
            {props.canRefreshJsm && (
              <Button
                onClick={props.onRefreshJsm}
                disabled={props.isRefreshingJsm}
                className="h-[38px] bg-[#C91879] text-white hover:bg-[#A9145F]"
              >
                <DatabaseZap size={15} className={props.isRefreshingJsm ? "mr-2 animate-pulse" : "mr-2"} />
                Actualizar JSM
              </Button>
            )}
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <span className="text-[11px] text-slate-400">
            Corte {formatCutOffDate(props.cutOffDate)} · {props.visibleLabel} · contrato de métricas{" "}
            {props.contractVersion}
          </span>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {props.metrics.map(metric => {
          const tone = TONE_STYLES[metric.tone];
          return (
            <article
              key={metric.key}
              className={`flex min-h-[106px] flex-col justify-between rounded-2xl border bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] ${tone.border} ${tone.accent}`}
            >
              <p className={`text-[10px] font-bold uppercase tracking-[0.12em] ${tone.value}`}>{metric.eyebrow}</p>
              <p className={`font-mono text-[28px] font-black leading-none tracking-tight ${tone.value}`}>
                {metric.value}
              </p>
              <p className="text-[11px] leading-4 text-slate-600">{metric.detail}</p>
            </article>
          );
        })}
      </section>

      <section className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-600">Confianza de la lectura</span>
        <div className="flex items-center gap-1" role="img" aria-label={`${props.confidence.valid} de ${props.confidence.total} servicios con lectura confiable`}>
          {props.confidence.segments.map(segment => (
            <i key={segment.key} className={`block h-[7px] w-10 rounded ${SEGMENT_COLOR[segment.tone]}`} />
          ))}
        </div>
        <span className="text-xs text-slate-700">
          <b className={props.confidence.valid === props.confidence.total ? "text-[#067647]" : "text-[#B42318]"}>
            {props.confidence.valid} de {props.confidence.total}
          </b>{" "}
          servicios con lectura confiable · {props.confidence.warning} con brechas · {props.confidence.blocked}{" "}
          bloqueados
        </span>
        <div className="flex-grow" />
        <span className="text-[11px] text-slate-600">Las cifras en N/D no se reemplazan por supuestos</span>
      </section>
    </>
  );
}
