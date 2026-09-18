/**
 * Plan de cobro con la plata a la vista.
 *
 * Hoy este bloque muestra seis cuadraditos de 28×28 con el número del mes y el
 * total del contrato. No dice cuánto está vencido, desde cuándo, ni qué hacer,
 * que es justamente la señal que vuelve crítico al servicio.
 */

import React from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import type { BillingPlan as BillingPlanModel, BillingRow, BillingRowState } from "../serviceDetailViewModel";

const STATE_SKIN: Record<BillingRowState, { badge: string; cta: string }> = {
  vencida: {
    badge: "border-[#FDA29B] bg-[#FEF3F2] text-[#B42318]",
    cta: "border-[#FDA29B] bg-[#FEF3F2] text-[#B42318]",
  },
  por_vencer: {
    badge: "border-[#FEDF89] bg-[#FFFAEB] text-[#B54708]",
    cta: "border-[#FEDF89] bg-[#FFFAEB] text-[#B54708]",
  },
  sin_fecha: {
    badge: "border-[#FEDF89] bg-[#FFFAEB] text-[#B54708]",
    cta: "border-[#FEDF89] bg-[#FFFAEB] text-[#B54708]",
  },
  facturada: {
    badge: "border-[#B2DDFF] bg-[#EFF6FF] text-[#175CD3]",
    cta: "border-[#B2DDFF] bg-[#EFF6FF] text-[#175CD3]",
  },
  cobrada: {
    badge: "border-[#ABEFC6] bg-[#ECFDF3] text-[#067647]",
    cta: "border-slate-300 bg-white text-slate-700",
  },
  programada: {
    badge: "border-slate-300 bg-slate-100 text-slate-600",
    cta: "border-slate-300 bg-white text-slate-700",
  },
};

interface BillingPlanProps {
  plan: BillingPlanModel;
  onRowAction?: (row: BillingRow) => void;
}

export function BillingPlan({ plan, onRowAction }: BillingPlanProps) {
  if (!plan.hasRows) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-[15px] font-black text-slate-950">Plan de cobro</h2>
        <p className="mt-2 text-[12.5px] text-slate-700">
          No configurado. Sin cuotas no hay vencimientos que medir y el servicio no aporta señal financiera.
        </p>
      </section>
    );
  }

  const overdueTotals = plan.totals.filter(total => total.overdue > 0);
  const overdueItems = plan.totals.reduce((sum, total) => sum + total.overdueItems, 0);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <header className="flex flex-wrap items-center gap-4 border-b border-slate-200 px-5 py-3.5">
        <div>
          <h2 className="text-[15px] font-black text-slate-950">Plan de cobro</h2>
          <p className="mt-0.5 text-[11px] text-slate-600">
            {plan.rows.length} cuota{plan.rows.length === 1 ? "" : "s"}
            {overdueItems > 0 && ` · ${overdueItems} vencida${overdueItems === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex-grow" />
        {plan.totals.map(total => (
          <div key={total.currency} className="flex flex-wrap items-center gap-5">
            <Figure label="Contratado" value={total.contractedLabel} />
            <Figure label="Facturado" value={total.invoicedLabel} className="text-[#175CD3]" />
            <Figure label="Cobrado" value={total.collectedLabel} className="text-[#067647]" />
            <div className="border-l border-slate-200 pl-5 text-right">
              <p className="text-[9px] font-bold uppercase tracking-wider text-[#B42318]">Vencido</p>
              <p className="font-mono text-[19px] font-black text-[#B42318]">{total.overdueLabel}</p>
            </div>
          </div>
        ))}
      </header>

      <div className="hidden items-center gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-2 text-[9.5px] font-black uppercase tracking-[0.1em] text-slate-500 md:flex">
        <span className="w-[70px] shrink-0">Cuota</span>
        <span className="w-[130px] shrink-0">Vence</span>
        <span className="w-[110px] shrink-0 text-right">Monto</span>
        <span className="w-[120px] shrink-0 text-center">Estado</span>
        <span className="flex-grow">Nota</span>
        <span className="w-[130px] shrink-0" />
      </div>

      <ul className="list-none">
        {plan.rows.map((row, index) => {
          const skin = STATE_SKIN[row.state];
          return (
            <li
              key={row.id}
              className={`grid grid-cols-2 items-center gap-3 border-b border-slate-50 px-5 py-3 md:flex md:py-2.5 ${index % 2 === 1 ? "bg-slate-50/40" : ""}`}
            >
              <b className="w-auto shrink-0 text-[12.5px] text-slate-950 md:w-[70px]">Mes {row.monthNumber}</b>
              <span className="w-auto shrink-0 text-right font-mono text-[12px] text-slate-700 md:w-[130px] md:text-left">{row.dueLabel}</span>
              <span className="w-auto shrink-0 font-mono text-[12.5px] font-bold text-slate-950 md:w-[110px] md:text-right">
                {row.amountLabel}
              </span>
              <span
                className={`w-auto shrink-0 rounded-full border py-1 text-center text-[10.5px] font-black uppercase tracking-wide md:w-[120px] ${skin.badge}`}
              >
                {row.stateLabel}
              </span>
              <span className="col-span-2 min-w-0 flex-grow text-[11.5px] text-slate-600">{row.note}</span>
              {row.actionLabel && onRowAction ? (
                <button
                  type="button"
                  onClick={() => onRowAction(row)}
                  className={`col-span-2 inline-flex h-8 w-full shrink-0 items-center justify-center gap-1 rounded-lg border text-[11.5px] font-bold transition hover:brightness-95 md:w-[130px] ${skin.cta}`}
                >
                  {row.actionLabel}
                  <ArrowRight size={13} />
                </button>
              ) : (
                <span className="hidden w-[130px] shrink-0 md:block" />
              )}
            </li>
          );
        })}
      </ul>

      {(plan.planMismatch || plan.missingDueDates > 0) && (
        <div className="flex items-start gap-2.5 border-t border-[#FEDF89] bg-[#FFFAEB] px-5 py-2.5">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[#B54708]" strokeWidth={2.4} />
          <div className="text-[11.5px] leading-[17px] text-[#7A3A06]">
            {plan.planMismatch && (
              <p>
                El plan suma <b>{plan.planMismatch.plannedLabel}</b> y el contrato dice{" "}
                <b>{plan.planMismatch.expectedLabel}</b>. Mientras no cuadren, lo facturado no reconcilia con lo
                contratado.
              </p>
            )}
            {plan.missingDueDates > 0 && (
              <p className={plan.planMismatch ? "mt-1" : ""}>
                {plan.missingDueDates} cuota{plan.missingDueDates === 1 ? "" : "s"} sin fecha de vencimiento:{" "}
                {plan.missingDueDates === 1 ? "nunca se contará" : "nunca se contarán"} como vencida
                {plan.missingDueDates === 1 ? "" : "s"}, aunque el dinero esté pendiente.
              </p>
            )}
          </div>
        </div>
      )}

      {overdueTotals.length === 0 && (
        <p className="border-t border-slate-200 px-5 py-2.5 text-[11.5px] text-slate-600">
          Ninguna cuota pasada de su fecha de vencimiento al corte.
        </p>
      )}
    </section>
  );
}

function Figure({ label, value, className = "text-slate-950" }: { label: string; value: string; className?: string }) {
  return (
    <div className="text-right">
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`font-mono text-[15px] font-black ${className}`}>{value}</p>
    </div>
  );
}
