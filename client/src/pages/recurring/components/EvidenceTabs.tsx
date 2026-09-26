/**
 * Consolidado gerencial de la vista Clásico. Agrupa Financiero, Entregables,
 * Formalidad y Operación JSM en cuatro pestañas sin duplicarlas en Torre V2.
 *
 * La pestaña por defecto es la primera CON hallazgos, no siempre la primera de
 * la lista: la página se abre donde hay trabajo.
 */

import React, { type ReactNode } from "react";
import type { EvidenceTab, SignalDomain } from "../recurringDashboardV3ViewModel";

const BADGE_TONE: Record<EvidenceTab["tone"], string> = {
  alert: "border-[#FDA29B] bg-[#FEF3F2] text-[#B42318]",
  warn: "border-[#FEDF89] bg-[#FFFAEB] text-[#B54708]",
  calm: "border-slate-300 bg-slate-100 text-slate-600",
};

interface EvidenceTabsProps {
  tabs: EvidenceTab[];
  active: SignalDomain;
  onChange: (key: SignalDomain) => void;
  panels: Record<SignalDomain, ReactNode>;
}

export function EvidenceTabs({ tabs, active, onChange, panels }: EvidenceTabsProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div
        role="tablist"
        aria-label="Evidencia de respaldo"
        className="flex items-stretch gap-0.5 border-b border-slate-200 bg-slate-50/70 px-4"
      >
        {tabs.map(tab => {
          const selected = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`evidence-tab-${tab.key}`}
              aria-selected={selected}
              aria-controls={`evidence-panel-${tab.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.key)}
              onKeyDown={event => handleTabKeys(event, tabs, tab.key, onChange)}
              className={`inline-flex h-[46px] items-center gap-2 border-b-[3px] px-4 text-[12.5px] transition ${
                selected
                  ? "border-[#E91E8C] bg-white font-black text-slate-950"
                  : "border-transparent font-semibold text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
              <span
                className={`inline-flex h-[19px] min-w-[22px] items-center justify-center rounded-full border px-1.5 font-mono text-[10px] font-black ${BADGE_TONE[tab.tone]}`}
              >
                {tab.badge}
              </span>
            </button>
          );
        })}
        <div className="flex-grow" />
        <span className="self-center pr-1 text-[11px] text-slate-600">
          Se abre donde hay hallazgos
        </span>
      </div>

      {tabs.map(tab => (
        <div
          key={tab.key}
          role="tabpanel"
          id={`evidence-panel-${tab.key}`}
          aria-labelledby={`evidence-tab-${tab.key}`}
          hidden={tab.key !== active}
        >
          {tab.key === active ? panels[tab.key] : null}
        </div>
      ))}
    </section>
  );
}

/** Flechas izquierda/derecha entre pestañas, como pide el patrón ARIA de tabs. */
function handleTabKeys(
  event: React.KeyboardEvent<HTMLButtonElement>,
  tabs: EvidenceTab[],
  current: SignalDomain,
  onChange: (key: SignalDomain) => void,
) {
  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
  event.preventDefault();
  const index = tabs.findIndex(tab => tab.key === current);
  const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
  onChange(tabs[next].key);
  document.getElementById(`evidence-tab-${tabs[next].key}`)?.focus();
}
