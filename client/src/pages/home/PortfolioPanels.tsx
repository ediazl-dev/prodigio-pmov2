/**
 * Los dos panes del medio: qué pasa con los activos y qué aprendimos de los
 * cerrados. Responden preguntas distintas, así que van lado a lado y no
 * mezclados en una sola grilla de KPIs.
 */

import {
  days,
  moneyList,
  percent,
  type ExecutivePortfolio,
} from "./executiveDashboardFormat";

/* ── Activos: dónde están y qué los frena ────────────────────────────────── */

export function ActivePanel({ portfolio }: { portfolio: ExecutivePortfolio }) {
  const { headline, stageDistribution, money: figures } = portfolio;
  const maxCount = Math.max(
    1,
    ...stageDistribution.map(row => row.active + row.closed)
  );

  const overdueMilestones = figures.reduce(
    (sum, figure) => sum + figure.overdueItems,
    0
  );
  const overdueLabel = moneyList(
    figures.map(figure => ({
      currency: figure.currency,
      value: figure.overdue,
    }))
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 className="text-[15px] font-black text-slate-950">
          Los {headline.active} activos
        </h2>
        <span className="text-[11px] text-slate-600">
          dónde están y qué los frena
        </span>
      </div>

      <ul className="mt-3.5 list-none space-y-1.5">
        {stageDistribution.map(row => {
          const total = row.active + row.closed;
          const color =
            total === 0
              ? "#CBD5E1"
              : row.stageId === "closure"
                ? "#067647"
                : "#175CD3";
          return (
            <li
              key={row.stageId}
              className="grid grid-cols-[96px_minmax(0,1fr)_34px] items-center gap-2.5"
            >
              <span className="text-[11.5px] font-semibold text-slate-700">
                {row.label}
              </span>
              <span className="block h-[18px] overflow-hidden rounded bg-slate-100">
                <i
                  className="block h-full rounded"
                  style={{
                    width: `${Math.round((total / maxCount) * 100)}%`,
                    background: color,
                  }}
                />
              </span>
              <b
                className={`text-right font-mono text-[12.5px] ${total === 0 ? "text-slate-400" : "text-slate-950"}`}
              >
                {total}
              </b>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 grid grid-cols-1 gap-2.5 border-t border-slate-200 pt-3.5 sm:grid-cols-3">
        <Figure
          label="Pausados"
          value={String(headline.paused)}
          note={
            headline.paused === 0 ? "ninguno detenido" : "proyectos detenidos"
          }
          tone={headline.paused > 0 ? "text-[#B54708]" : "text-slate-950"}
        />
        <Figure
          label="Sin plazo medible"
          value={String(headline.stagesUnmeasured)}
          note="etapas sin apertura registrada"
          tone={
            headline.stagesUnmeasured > 0 ? "text-[#B54708]" : "text-slate-950"
          }
        />
        <Figure
          label="Hitos vencidos"
          value={String(overdueMilestones)}
          note={overdueMilestones > 0 ? overdueLabel : "sin cobros atrasados"}
          tone={overdueMilestones > 0 ? "text-[#B42318]" : "text-slate-950"}
        />
      </div>
    </section>
  );
}

/* ── Cerrados: qué aprendimos ────────────────────────────────────────────── */

export function ClosedPanel({ portfolio }: { portfolio: ExecutivePortfolio }) {
  const { closed } = portfolio;

  const slipLabel =
    closed.avgRealDurationDays !== null &&
    closed.avgPlannedDurationDays !== null
      ? `contra ${days(closed.avgPlannedDurationDays)} planificados`
      : "sin plazo de referencia";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 className="text-[15px] font-black text-slate-950">
          Los {closed.projects} cerrados
        </h2>
        <span className="text-[11px] text-slate-600">
          qué aprendimos de ellos
        </span>
      </div>

      {closed.projects === 0 ? (
        <p className="mt-4 text-[12.5px] leading-5 text-slate-700">
          Todavía no hay proyectos cerrados. Cuando el primero cierre, aquí
          aparece su cumplimiento de plazo, el derrape y si dejó retrospectiva.
        </p>
      ) : (
        <>
          <div className="mt-3.5 grid grid-cols-2 gap-2.5">
            <Card
              label="Etapas en plazo"
              value={`${closed.onTime} / ${closed.onTime + closed.late}`}
              note={
                closed.late > 0
                  ? `${closed.late} se pasó del plazo asignado`
                  : "ninguna se pasó del plazo"
              }
              tone={closed.late > 0 ? "warn" : "good"}
            />
            <Card
              label="Derrape promedio"
              value={
                closed.avgSlipDays === null
                  ? "N/D"
                  : `+${days(closed.avgSlipDays)}`
              }
              note="sobre las etapas que se pasaron"
              tone={closed.avgSlipDays === null ? "plain" : "warn"}
            />
            <Card
              label="Duración real"
              value={days(closed.avgRealDurationDays)}
              note={slipLabel}
              tone="plain"
            />
            <Card
              label="Lecciones registradas"
              value={`${closed.lessonsRegistered} / ${closed.projects}`}
              note={
                closed.lessonsMissing > 0
                  ? `${closed.lessonsMissing} cierre${closed.lessonsMissing === 1 ? "" : "s"} sin retrospectiva`
                  : closed.avgScore !== null
                    ? `puntaje medio ${closed.avgScore}`
                    : "todas registradas"
              }
              tone={closed.lessonsMissing > 0 ? "warn" : "good"}
            />
          </div>

          <div className="mt-3.5 border-t border-slate-200 pt-3">
            <p className="text-[11.5px] leading-[17px] text-slate-700">
              {closed.lessonsMissing > 0
                ? `${closed.lessonsMissing} de ${closed.projects} cierres no dejaron retrospectiva. Sin ella, el dato de por qué se pasaron de plazo se pierde y la tasa del próximo trimestre no se puede explicar.`
                : `Cumplimiento de ${percent(closed.ratePercent)} en las etapas de los proyectos cerrados, con retrospectiva en todos.`}
            </p>
          </div>
        </>
      )}
    </section>
  );
}

/* ── Piezas ──────────────────────────────────────────────────────────────── */

function Figure({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone: string;
}) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </p>
      <b className={`mt-0.5 block font-mono text-[20px] ${tone}`}>{value}</b>
      <span className="text-[10.5px] text-slate-600">{note}</span>
    </div>
  );
}

function Card({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone: "good" | "warn" | "plain";
}) {
  const skin =
    tone === "good"
      ? {
          box: "border-[#ABEFC6] bg-[#F7FDF9]",
          label: "text-[#067647]",
          value: "text-[#067647]",
        }
      : tone === "warn"
        ? {
            box: "border-[#FEDF89] bg-[#FFFCF5]",
            label: "text-[#B54708]",
            value: "text-[#B54708]",
          }
        : {
            box: "border-slate-200 bg-white",
            label: "text-slate-500",
            value: "text-slate-950",
          };

  return (
    <div className={`rounded-xl border p-3 ${skin.box}`}>
      <p
        className={`text-[9px] font-bold uppercase tracking-[0.08em] ${skin.label}`}
      >
        {label}
      </p>
      <b className={`mt-0.5 block font-mono text-[22px] ${skin.value}`}>
        {value}
      </b>
      <span className="text-[10.5px] text-slate-600">{note}</span>
    </div>
  );
}
