/**
 * Los pendientes de vincular, movidos por ENCIMA de la tabla de ya
 * sincronizados. Es la lista accionable de la página: hoy vive debajo de una
 * tabla de 27 filas que nadie necesita mirar.
 */

import type { PendingGroup } from "../jsmSetupGate";

interface JsmPendingItemsProps {
  groups: PendingGroup[];
  /** Acción primaria (dry-run o confirmar), si la etapa la permite. */
  actionLabel?: string | null;
  onAction?: () => void;
  actionDisabled?: boolean;
}

export function JsmPendingItems({ groups, actionLabel, onAction, actionDisabled }: JsmPendingItemsProps) {
  if (groups.length === 0) return null;

  const total = groups.reduce((sum, group) => sum + group.count, 0);

  return (
    <section className="overflow-hidden rounded-2xl border border-[#FEDF89] bg-white">
      <header className="flex flex-wrap items-center gap-3 border-b border-[#FEDF89] bg-[#FFFAEB] px-5 py-3">
        <h2 className="text-[15px] font-black text-[#7A3A06]">
          Pendientes de vincular ({total})
        </h2>
        <span className="text-[11.5px] text-[#7A3A06]">
          {groups.map(group => `${group.count} ${group.label.toLowerCase()}`).join(" · ")}
        </span>
        <div className="flex-grow" />
        {groups.map(
          group =>
            group.amountLabel && (
              <span key={group.key} className="font-mono text-[13px] font-black text-[#7A3A06]">
                {group.amountLabel}
              </span>
            ),
        )}
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            disabled={actionDisabled}
            className="h-9 rounded-lg border-0 bg-[#B54708] px-4 text-[12.5px] font-bold text-white transition hover:bg-[#93380A] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
          >
            {actionLabel}
          </button>
        )}
      </header>

      {groups.map(group => (
        <div key={group.key}>
          {groups.length > 1 && (
            <p className="border-b border-slate-100 bg-slate-50/70 px-5 py-1.5 text-[9.5px] font-black uppercase tracking-[0.1em] text-slate-500">
              {group.label}
            </p>
          )}
          <ul className="grid list-none grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
            {group.items.map(item => (
              <li key={`${group.key}-${item.id}`} className="flex items-center gap-2.5 border-b border-r border-slate-50 px-5 py-2.5">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg border border-[#FEDF89] bg-[#FFFAEB] font-mono text-[11px] font-black text-[#B54708]">
                  {item.note?.replace(/\D/g, "") || "•"}
                </span>
                <div className="min-w-0 flex-grow">
                  <p className="truncate text-[12.5px] font-bold text-slate-950">{item.title}</p>
                  {item.note && <p className="mt-0.5 truncate text-[10.5px] text-slate-600">{item.note}</p>}
                </div>
                {item.amountLabel && (
                  <span className="shrink-0 font-mono text-[12.5px] font-black text-slate-950">{item.amountLabel}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
