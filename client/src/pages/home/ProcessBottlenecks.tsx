/**
 * «Dónde se atasca el proceso»: plazo asignado contra plazo realmente usado,
 * por etapa del pipeline y sobre toda la cartera.
 *
 * Es la lectura de mejora de proceso. Un proyecto que se pasa es una anécdota;
 * una etapa que se pasa en todos los proyectos es un problema de diseño del
 * proceso, y esa diferencia solo se ve agregando.
 */

import { AlertTriangle } from "lucide-react";
import {
  TONE,
  bottleneckTone,
  days,
  worstBottleneck,
  type BottleneckRow,
} from "./executiveDashboardFormat";

export function ProcessBottlenecks({
  rows,
  totalClosedStages,
}: {
  rows: BottleneckRow[];
  totalClosedStages: number;
}) {
  const worst = worstBottleneck(rows);
  const worstOver =
    worst &&
    worst.avgUsedDays !== null &&
    worst.avgEffectiveAllowedDays !== null &&
    worst.avgUsedDays > worst.avgEffectiveAllowedDays;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-3">
        <h2 className="text-[15px] font-black text-slate-950">
          Dónde se atasca el proceso
        </h2>
        <span className="text-[11px] text-slate-600">
          {totalClosedStages > 0
            ? `Plazo asignado contra plazo realmente usado, en las ${totalClosedStages} etapas cerradas de la cartera`
            : "Se llena a medida que las etapas van cerrando"}
        </span>
      </header>

      <div
        className="overflow-x-auto"
        tabIndex={0}
        aria-label="Tabla de cuellos de botella por etapa"
      >
        <div className="min-w-[720px]">
          <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-2 text-[9.5px] font-black uppercase tracking-[0.1em] text-slate-500">
            <span className="w-[150px] shrink-0">Etapa</span>
            <span className="w-[90px] shrink-0 text-right">Plazo efectivo</span>
            <span className="w-[96px] shrink-0 text-right">Uso medio</span>
            <span className="flex-grow">Consumo del plazo</span>
            <span className="w-[108px] shrink-0 text-right">Se pasaron</span>
            <span className="w-[112px] shrink-0 text-right">Extensiones</span>
          </div>

          <ul className="list-none">
            {rows.map((row, index) => {
              const tone = TONE[bottleneckTone(row)];
              const ratio =
                row.avgUsedDays !== null &&
                row.avgEffectiveAllowedDays !== null &&
                row.avgEffectiveAllowedDays > 0
                  ? row.avgUsedDays / row.avgEffectiveAllowedDays
                  : 0;

              return (
                <li
                  key={row.stageId}
                  className={`flex items-center gap-3 border-b border-slate-50 px-5 py-2 ${index % 2 === 1 ? "bg-slate-50/40" : ""}`}
                >
                  <b className="w-[150px] shrink-0 text-[12px] text-slate-950">
                    {row.label}
                  </b>
                  <span className="w-[90px] shrink-0 text-right font-mono text-[12px] text-slate-600">
                    {row.avgEffectiveAllowedDays !== null
                      ? `${row.avgEffectiveAllowedDays} d`
                      : "N/D"}
                  </span>
                  <span
                    className="w-[96px] shrink-0 text-right font-mono text-[12px] font-bold"
                    style={{ color: tone.text }}
                  >
                    {days(row.avgUsedDays)}
                  </span>
                  <span
                    className="block min-w-0 flex-grow overflow-hidden rounded bg-slate-100"
                    style={{ height: 8 }}
                    role="progressbar"
                    aria-label={`Consumo de plazo de ${row.label}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.min(100, Math.round(ratio * 100))}
                  >
                    <i
                      className="block h-full rounded"
                      style={{
                        width: `${Math.min(100, Math.round(ratio * 76))}%`,
                        background: tone.text,
                      }}
                    />
                  </span>
                  <span
                    className="w-[108px] shrink-0 text-right text-[11.5px]"
                    style={{ color: tone.text }}
                  >
                    {row.closedCount > 0
                      ? `${row.overCount} de ${row.closedCount}`
                      : "sin cierres"}
                  </span>
                  <span className="w-[112px] shrink-0 text-right text-[11.5px] text-slate-600">
                    {row.extensionCount > 0
                      ? `${row.extensionCount} · +${row.extraDays} d`
                      : "0"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {worst && worstOver && (
        <div className="flex items-start gap-2.5 border-t border-[#FEDF89] bg-[#FFFAEB] px-5 py-2.5">
          <AlertTriangle
            size={14}
            className="mt-0.5 shrink-0 text-[#B54708]"
            strokeWidth={2.4}
          />
          <p className="text-[11.5px] leading-[17px] text-[#7A3A06]">
            <b>{worst.label}</b> es la etapa que más se pasa de plazo
            {worst.extensionCount > 0
              ? " y la que más extensiones concentra"
              : ""}
            : {days(worst.avgUsedDays)} de uso medio contra{" "}
            {worst.avgEffectiveAllowedDays} d efectivos
            {worst.avgEffectiveAllowedDays !== worst.allowedDays
              ? ` (base ${worst.allowedDays} d)`
              : ""}
            . Es el cuello de botella del proceso, no una excepción de un
            proyecto.
          </p>
        </div>
      )}
    </section>
  );
}
