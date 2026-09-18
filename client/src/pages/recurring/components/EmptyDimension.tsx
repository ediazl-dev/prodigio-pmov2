/**
 * La regla de colapso en N/D, hecha componente.
 *
 * Una dimensión sin evidencia no muestra casillas vacías: muestra una línea
 * con la causa y la acción que la resolvería. Cuando la evidencia llega, el
 * panel real vuelve a ocupar su lugar sin que nadie cambie nada.
 *
 * Contraejemplo que este componente reemplaza: hoy, con cobertura JSM en 0%,
 * la página pinta seis casillas grandes que dicen "N/D" y dos barras de SLA
 * al 0%. Ocupan media pantalla y no dicen nada.
 */

import type { LucideIcon } from "lucide-react";
import { DatabaseZap } from "lucide-react";

interface EmptyDimensionProps {
  title: string;
  reason: string;
  actionLabel: string;
  onAction?: () => void;
  icon?: LucideIcon;
  tone?: "warn" | "calm";
  /** Métricas de contexto opcionales; se pintan bajo la línea, en pequeño. */
  facts?: Array<{ label: string; value: string; note?: string }>;
  /** Qué recupera el panel cuando haya evidencia. Explica el hueco. */
  restores?: string;
}

export function EmptyDimension({
  title,
  reason,
  actionLabel,
  onAction,
  icon: Icon = DatabaseZap,
  tone = "warn",
  facts,
  restores,
}: EmptyDimensionProps) {
  const palette =
    tone === "warn"
      ? { border: "border-[#FEDF89]", bg: "bg-[#FFFAEB]", text: "text-[#7A3A06]", icon: "text-[#B54708]", button: "bg-[#B54708] hover:bg-[#93380A]" }
      : { border: "border-slate-200", bg: "bg-slate-50", text: "text-slate-800", icon: "text-slate-600", button: "bg-slate-700 hover:bg-slate-800" };

  return (
    <div className="p-5 sm:p-6">
      <div className={`flex flex-col gap-4 rounded-xl border ${palette.border} ${palette.bg} p-5 sm:flex-row sm:items-center`}>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white">
          <Icon size={22} className={palette.icon} strokeWidth={2.1} />
        </span>
        <div className="flex-grow">
          <p className={`text-sm font-black ${palette.text}`}>{title}</p>
          <p className={`mt-1 text-xs leading-5 ${palette.text}`}>{reason}</p>
        </div>
        {onAction && (
          <button
            type="button"
            onClick={onAction}
            className={`h-[38px] shrink-0 rounded-lg px-4 text-[12.5px] font-bold text-white transition ${palette.button}`}
          >
            {actionLabel}
          </button>
        )}
      </div>

      {facts && facts.length > 0 && (
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {facts.map(fact => (
            <div key={fact.label} className="rounded-xl border border-slate-200 p-3">
              <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">{fact.label}</p>
              <p className="mt-1 font-mono text-[22px] font-black text-slate-950">{fact.value}</p>
              {fact.note && <p className="text-[10.5px] text-slate-600">{fact.note}</p>}
            </div>
          ))}
        </div>
      )}

      {restores && <p className="mt-4 text-[11.5px] leading-5 text-slate-600">{restores}</p>}
    </div>
  );
}
