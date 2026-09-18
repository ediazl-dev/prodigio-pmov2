/**
 * Los elementos YA vinculados, como lista de consulta.
 *
 * Hoy esta tabla ocupa dos tercios de la página para mostrar 27 filas que ya
 * están resueltas. Aquí baja de jerarquía: altura fija, scroll propio, y por
 * debajo de los pendientes. Sigue siendo consultable, deja de ser el centro.
 */

import React, { useState } from "react";
import { Check, ExternalLink } from "lucide-react";
import type { JsmIssuesSummary } from "../jsmSetupGate";

const TYPE_CHIP: Record<string, string> = {
  tarea_programada: "border-[#ABEFC6] bg-[#ECFDF3] text-[#05603A]",
  informe_mensual: "border-[#B2DDFF] bg-[#EFF6FF] text-[#175CD3]",
  facturacion: "border-[#F9A8D4] bg-[#FDF2F8] text-[#9D174D]",
  coverage_definition: "border-slate-300 bg-slate-100 text-slate-700",
  sla_definition: "border-[#FEDF89] bg-[#FFFAEB] text-[#7A3A06]",
};

interface JsmLinkedItemsProps {
  summary: JsmIssuesSummary;
  /** Base de Jira para armar el enlace a cada issue. */
  jiraBaseUrl: string;
}

export function JsmLinkedItems({ summary, jiraBaseUrl }: JsmLinkedItemsProps) {
  const [tab, setTab] = useState<"actividades" | "facturacion">("actividades");

  const activities = summary.syncedWorkItems;
  const billing = summary.syncedBilling;
  const rows = tab === "actividades" ? activities : billing;

  if (activities.length === 0 && billing.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <header className="flex flex-wrap items-center gap-2.5 border-b border-slate-200 px-5 py-2.5">
        <Check size={15} className="text-[#067647]" strokeWidth={2.4} />
        <h2 className="text-[14px] font-black text-slate-950">Ya vinculados</h2>
        <span className="text-[11.5px] text-slate-600">Lista de consulta.</span>
        <div className="flex-grow" />
        {(
          [
            { id: "actividades" as const, label: `Actividades (${activities.length})` },
            { id: "facturacion" as const, label: `Facturación (${billing.length})` },
          ]
        ).map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            aria-pressed={tab === item.id}
            className={`h-[30px] rounded-full border px-3 text-[11.5px] font-bold transition ${
              tab === item.id
                ? "border-slate-300 bg-slate-100 text-slate-950"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {item.label}
          </button>
        ))}
      </header>

      {rows.length === 0 ? (
        <div className="grid h-[196px] place-items-center px-5 text-center">
          <div>
            <p className="text-[13px] font-bold text-slate-700">
              Ningún {tab === "actividades" ? "elemento del plan" : "hito de facturación"} vinculado todavía
            </p>
            <p className="mt-1.5 text-[12px] text-slate-600">
              Los pendientes están arriba, en «Pendientes de vincular».
            </p>
          </div>
        </div>
      ) : (
        <ul className="h-[196px] list-none overflow-y-auto px-5 py-2">
          {rows.map(row => (
            <li
              key={row.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-slate-100 py-2 sm:flex sm:gap-3 sm:py-1.5"
            >
              <a
                href={`${jiraBaseUrl}/browse/${row.jiraKey}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-auto shrink-0 items-center gap-1 font-mono text-[11.5px] font-bold sm:w-[132px]"
              >
                {row.jiraKey}
                <ExternalLink size={11} />
              </a>
              <span className="col-span-2 row-start-2 min-w-0 whitespace-normal text-[12px] text-slate-800 sm:col-auto sm:row-auto sm:flex-grow sm:truncate">
                {row.title}
              </span>
              {"type" in row && row.type && (
                <span
                  className={`col-start-1 row-start-3 w-fit shrink-0 rounded-full border px-2 py-0.5 text-center font-mono text-[9.5px] font-bold sm:col-auto sm:row-auto sm:w-[132px] ${
                    TYPE_CHIP[row.type] ?? TYPE_CHIP.coverage_definition
                  }`}
                >
                  {row.type}
                </span>
              )}
              {"frequency" in row && (
                <span className="col-start-2 row-start-3 w-auto shrink-0 text-right text-[11px] text-slate-600 sm:col-auto sm:row-auto sm:w-[78px]">
                  {row.frequency ?? "—"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
