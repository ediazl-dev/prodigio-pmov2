/**
 * Paneles del detalle de avance Jira.
 *
 * Los cinco responden la misma pregunta desde ángulos distintos: cómo se ve el
 * avance de tareas, sabiendo que el avance del PROYECTO son los hitos cerrados.
 *
 *  - MilestoneBackbone: los hitos como columna vertebral, con las tareas que
 *    cuelgan de cada uno. El avance de tareas se lee dentro del hito que habilita.
 *  - CoveragePanel: ¿lo programado cubre los objetivos declarados?
 *  - SchedulePanel: qué hay por ejecutar y para cuándo.
 *  - WorkloadPanel: asignación por participante.
 *  - StalledPanel: tareas en curso sin movimiento.
 *  - EpicProgressPanel: avance por épica.
 *
 * Todos leen `report.insights`, que el motor calcula en el servidor.
 */

import { AlertTriangle, Clock, Target, Users } from "lucide-react";
import type { RouterOutputs } from "@/lib/trpc";

export type AdvanceReport = RouterOutputs["jira"]["advanceReport"];
export type Insights = AdvanceReport["insights"];
type MilestoneRow = Insights["milestones"][number];

const TONE = {
  alert: { text: "#B42318", surface: "#FEF3F2", border: "#FDA29B" },
  warn: { text: "#B54708", surface: "#FFFAEB", border: "#FEDF89" },
  good: { text: "#067647", surface: "#ECFDF3", border: "#ABEFC6" },
  calm: { text: "#475569", surface: "#F1F5F9", border: "#CBD5E1" },
} as const;

const MILESTONE_UI: Record<MilestoneRow["state"], { label: string; tone: keyof typeof TONE }> = {
  overdue: { label: "Vencido", tone: "alert" },
  due_soon: { label: "Próximo", tone: "warn" },
  scheduled: { label: "Programado", tone: "calm" },
  no_date: { label: "Sin fecha", tone: "warn" },
  done: { label: "Cerrado", tone: "good" },
};

function formatDate(value: string | null): string {
  if (!value) return "Sin fecha";
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("es-CL");
}

function daysLabel(row: MilestoneRow): string {
  if (row.state === "done") return "cerrado";
  if (row.days === null) return "sin agendar";
  if (row.days > 0) return `vencido hace ${row.days} d`;
  if (row.days === 0) return "vence hoy";
  return `en ${Math.abs(row.days)} d`;
}

/* ═══ Hitos como columna vertebral ═══════════════════════════════════════ */

export function MilestoneBackbone({ insights }: { insights: Insights }) {
  const { milestones, progress } = insights;

  if (milestones.length === 0) {
    return (
      <section className="rounded-2xl border border-[#FEDF89] bg-[#FFFAEB] p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#B54708]" />
          <div>
            <p className="text-[14px] font-black text-[#7A3A06]">Este proyecto no tiene hitos definidos</p>
            <p className="mt-1.5 text-[12.5px] leading-5 text-[#7A3A06]">
              El avance del proyecto se mide por hitos cerrados, así que aquí no hay avance que reportar. Las{" "}
              {progress.issuesTotal} tareas siguen visibles abajo como lectura operacional, pero no equivalen al avance
              del proyecto. Define los Hitos PMO en Jira para que este reporte pueda medirlo.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const withoutTasks = milestones.filter(row => row.tasksTotal === 0 && row.state !== "done").length;
  const overdue = milestones.filter(row => row.state === "overdue").length;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
        <h2 className="text-[15px] font-black text-slate-950">Hitos del proyecto</h2>
        <span className="text-[11px] text-slate-600">
          La columna vertebral: cada hito con las tareas que lo habilitan
        </span>
        <div className="flex-grow" />
        <span className="text-[11px] font-bold" style={{ color: overdue > 0 ? "#B42318" : "#475569" }}>
          {progress.milestonesDone} de {progress.milestonesTotal} cerrados
          {overdue > 0 ? ` · ${overdue} vencido${overdue === 1 ? "" : "s"}` : ""}
          {withoutTasks > 0 ? ` · ${withoutTasks} sin tareas` : ""}
        </span>
      </header>

      <ul className="list-none">
        {milestones.map((row, index) => {
          const ui = MILESTONE_UI[row.state];
          const tone = TONE[ui.tone];
          return (
            <li
              key={row.key}
              className={`flex flex-wrap items-center gap-3 border-b border-slate-50 px-4 py-2.5 ${index % 2 === 1 ? "bg-slate-50/40" : ""}`}
            >
              <i className="block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: tone.text }} aria-hidden="true" />

              <div className="w-[300px] shrink-0">
                <p
                  className="truncate text-[12.5px] font-bold"
                  style={{ color: row.state === "done" ? "#475569" : "#0F172A" }}
                  title={row.summary}
                >
                  {row.summary}
                </p>
                <p className="font-mono text-[9.5px] text-slate-500">{row.key}</p>
              </div>

              <span
                className="w-[96px] shrink-0 rounded-full border py-0.5 text-center text-[9.5px] font-black uppercase tracking-wide"
                style={{ color: tone.text, background: tone.surface, borderColor: tone.border }}
              >
                {ui.label}
              </span>

              <div className="w-[148px] shrink-0">
                <p className="text-[11px] text-slate-700">{formatDate(row.dueDate)}</p>
                <p className="text-[9.5px] font-bold" style={{ color: tone.text }}>
                  {daysLabel(row)}
                </p>
              </div>

              <div className="min-w-0 flex-grow">
                {row.tasksTotal > 0 ? (
                  <>
                    <div className="flex items-baseline gap-2">
                      <b className="font-mono text-[11.5px] text-slate-700">
                        {row.tasksDone} / {row.tasksTotal}
                      </b>
                      <span className="text-[10px] text-slate-600">tareas cerradas</span>
                    </div>
                    <div className="mt-1 h-[5px] max-w-[260px] overflow-hidden rounded bg-slate-100">
                      <i className="block h-full rounded" style={{ width: `${row.taskPct ?? 0}%`, background: tone.text }} />
                    </div>
                  </>
                ) : (
                  <span className="text-[11px] font-bold text-[#B54708]">
                    Sin tareas asociadas: nada planificado para cerrarlo
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ═══ Cobertura de objetivos ═════════════════════════════════════════════ */

export function CoveragePanel({ insights }: { insights: Insights }) {
  const { coverage } = insights;
  const covered = coverage.epicsTotal - coverage.epicsWithoutTasks.length;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-2">
        <Target size={15} className="text-slate-500" />
        <h2 className="text-[14px] font-black text-slate-950">¿Lo programado cubre los objetivos?</h2>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Stat
          label="Épicas con trabajo"
          value={coverage.epicsTotal > 0 ? `${covered} / ${coverage.epicsTotal}` : "N/D"}
          note={
            coverage.epicsTotal === 0
              ? "sin épicas declaradas"
              : `${coverage.epicsWithoutTasks.length} objetivo${coverage.epicsWithoutTasks.length === 1 ? "" : "s"} sin ninguna tarea`
          }
          tone={coverage.epicsWithoutTasks.length > 0 ? "warn" : "calm"}
        />
        <Stat
          label="Hitos sin tareas"
          value={String(coverage.milestonesWithoutTasks.length)}
          note="de los hitos abiertos"
          tone={coverage.milestonesWithoutTasks.length > 0 ? "alert" : "calm"}
        />
        <Stat
          label="Tareas huérfanas"
          value={String(coverage.tasksWithoutParent)}
          note="no cuelgan de ninguna épica ni hito"
          tone="calm"
        />
        <Stat
          label="Hitos sin fecha"
          value={String(coverage.milestonesWithoutDueDate)}
          note="no pueden vencer ni agendarse"
          tone={coverage.milestonesWithoutDueDate > 0 ? "warn" : "calm"}
        />
      </div>

      {coverage.epicsWithoutTasks.length > 0 && (
        <div className="mt-3 border-t border-slate-200 pt-2.5">
          <p className="text-[11px] font-bold text-[#7A3A06]">Objetivos declarados sin trabajo planificado</p>
          <ul className="mt-1.5 list-none space-y-1">
            {coverage.epicsWithoutTasks.slice(0, 6).map(epic => (
              <li key={epic.key} className="flex items-center gap-2">
                <span className="w-[92px] shrink-0 font-mono text-[9.5px] text-slate-500">{epic.key}</span>
                <span className="truncate text-[11px] text-slate-700">{epic.summary}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/* ═══ Agenda ═════════════════════════════════════════════════════════════ */

export function SchedulePanel({ insights }: { insights: Insights }) {
  const { schedule } = insights;
  const rows = [
    { label: "Vencidas", count: schedule.overdue, tone: "alert" as const },
    { label: "Próximos 7 días", count: schedule.next7, tone: "warn" as const },
    { label: "Próximos 14 días", count: schedule.next14, tone: "warn" as const },
    { label: "Próximos 30 días", count: schedule.next30, tone: "calm" as const },
    { label: "Más adelante", count: schedule.later, tone: "calm" as const },
    { label: "Sin fecha", count: schedule.noDueDate, tone: "alert" as const },
  ];
  const max = Math.max(1, ...rows.map(row => row.count));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center gap-2">
        <Clock size={15} className="text-slate-500" />
        <h2 className="text-[14px] font-black text-slate-950">Tareas programadas por ejecutar</h2>
        <span className="text-[11px] text-slate-600">{schedule.pendingTotal} pendientes</span>
      </div>

      <ul className="mt-3 list-none space-y-1.5">
        {rows.map(row => (
          <li key={row.label} className="grid grid-cols-[128px_minmax(0,1fr)_34px] items-center gap-2.5">
            <span className="text-[11.5px] font-semibold" style={{ color: TONE[row.tone].text }}>
              {row.label}
            </span>
            <span className="block h-4 overflow-hidden rounded bg-slate-100">
              <i
                className="block h-full rounded"
                style={{ width: `${Math.round((row.count / max) * 100)}%`, background: TONE[row.tone].text }}
              />
            </span>
            <b className="text-right font-mono text-[12px]" style={{ color: TONE[row.tone].text }}>
              {row.count}
            </b>
          </li>
        ))}
      </ul>

      {schedule.noDueDate > 0 && (
        <p className="mt-3 border-t border-slate-200 pt-2.5 text-[11.5px] leading-[17px] text-slate-700">
          <b className="text-[#B42318]">
            {schedule.noDueDate} de las {schedule.pendingTotal} pendientes no tienen fecha.
          </b>{" "}
          No se pueden agendar ni vencer, así que no aparecen en ninguna alerta de plazo.
        </p>
      )}
    </section>
  );
}

/* ═══ Carga por persona ══════════════════════════════════════════════════ */

export function WorkloadPanel({ insights }: { insights: Insights }) {
  const { workload } = insights;
  if (workload.length === 0) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center gap-2">
        <Users size={15} className="text-slate-500" />
        <h2 className="text-[14px] font-black text-slate-950">Asignación por persona</h2>
        <span className="text-[11px] text-slate-600">
          {workload.length} responsables · {workload.reduce((sum, row) => sum + row.inProgress, 0)} tareas en curso
        </span>
      </div>

      <div className="mt-2.5 overflow-x-auto">
        <div className="min-w-[620px]">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-1.5 text-[9px] font-black uppercase tracking-[0.1em] text-slate-500">
            <span className="w-[150px] shrink-0">Persona</span>
            <span className="flex-grow">Reparto</span>
            <span className="w-[52px] shrink-0 text-right">Total</span>
            <span className="w-[68px] shrink-0 text-right">Vencidas</span>
            <span className="w-[74px] shrink-0 text-right">Estancadas</span>
          </div>

          <ul className="list-none">
            {workload.map(row => {
              const total = Math.max(1, row.total);
              const width = (value: number) => `${Math.round((value / total) * 100)}%`;
              return (
                <li key={row.assignee} className="flex items-center gap-2.5 border-b border-slate-50 py-1.5">
                  <span
                    className="w-[150px] shrink-0 truncate text-[11.5px] font-semibold"
                    style={{ color: row.assignee === "Sin asignar" ? "#B54708" : "#0F172A" }}
                    title={row.assignee}
                  >
                    {row.assignee}
                  </span>
                  <span className="flex h-3.5 min-w-0 flex-grow overflow-hidden rounded bg-slate-100">
                    <i className="block h-full" style={{ width: width(row.done), background: "#067647" }} />
                    <i className="block h-full" style={{ width: width(row.inProgress), background: "#175CD3" }} />
                    <i className="block h-full" style={{ width: width(row.toDo), background: "#CBD5E1" }} />
                  </span>
                  <b className="w-[52px] shrink-0 text-right font-mono text-[11.5px] text-slate-950">{row.total}</b>
                  <span
                    className="w-[68px] shrink-0 text-right font-mono text-[11.5px]"
                    style={{ color: row.overdue > 0 ? "#B42318" : "#94A3B8" }}
                  >
                    {row.overdue > 0 ? row.overdue : "—"}
                  </span>
                  <span
                    className="w-[74px] shrink-0 text-right font-mono text-[11.5px]"
                    style={{ color: row.stalled > 0 ? "#B42318" : "#94A3B8" }}
                  >
                    {row.stalled > 0 ? row.stalled : "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3.5 text-[10px] text-slate-600">
        <Legend color="#067647" label="Cerradas" />
        <Legend color="#175CD3" label="En curso" />
        <Legend color="#CBD5E1" label="Por hacer" />
      </div>
    </section>
  );
}

/* ═══ Estancadas ═════════════════════════════════════════════════════════ */

export function StalledPanel({ insights }: { insights: Insights }) {
  const { stalled, progress } = insights;
  const inProgress = insights.workload.reduce((sum, row) => sum + row.inProgress, 0);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[14px] font-black text-slate-950">Tareas estancadas</h2>
        <span className="text-[11px] text-slate-600">sin movimiento hace {stalled.afterDays} días o más</span>
      </div>

      <div className="mt-2.5 flex items-baseline gap-2">
        <b className="font-mono text-[30px]" style={{ color: stalled.count > 0 ? "#B42318" : "#067647" }}>
          {stalled.count}
        </b>
        <span className="text-[11.5px] text-slate-700">de las {inProgress} en curso</span>
      </div>

      {stalled.count === 0 ? (
        <p className="mt-2.5 text-[11.5px] leading-[17px] text-slate-700">
          Ninguna tarea en curso lleva más de {stalled.afterDays} días sin movimiento.
        </p>
      ) : (
        <>
          <ul className="mt-2.5 list-none space-y-1.5">
            {stalled.items.slice(0, 6).map(item => (
              <li key={item.key} className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-2.5 py-1.5">
                <span className="w-[86px] shrink-0 font-mono text-[9.5px] text-slate-500">{item.key}</span>
                <div className="min-w-0 flex-grow">
                  <p className="truncate text-[11px] text-slate-800">{item.summary}</p>
                  <p className="text-[9.5px] text-slate-500">{item.assignee ?? "Sin asignar"}</p>
                </div>
                <span className="shrink-0 font-mono text-[11px] font-bold text-[#B42318]">{item.daysIdle} d</span>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-[11px] leading-4 text-slate-600">
            Con {inProgress} tareas «en progreso» y {progress.issuesDone} cerradas, saber cuántas están realmente
            detenidas cambia la lectura del avance.
          </p>
        </>
      )}
    </section>
  );
}

/* ═══ Avance por épica ═══════════════════════════════════════════════════ */

export function EpicProgressPanel({ insights }: { insights: Insights }) {
  const { epics } = insights;
  if (epics.length === 0) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[14px] font-black text-slate-950">Avance por épica</h2>
        <span className="text-[11px] text-slate-600">{epics.length} épicas · las de menor avance primero</span>
      </div>

      <ul className="mt-3 grid list-none grid-cols-1 gap-x-6 gap-y-2 xl:grid-cols-2">
        {epics.map(epic => {
          const measurable = epic.tasksTotal > 0;
          const color = !measurable
            ? "#B54708"
            : (epic.taskPct as number) >= 60
              ? "#067647"
              : (epic.taskPct as number) > 0
                ? "#B54708"
                : "#B42318";
          return (
            <li key={epic.key} className="grid grid-cols-[200px_minmax(0,1fr)_76px] items-center gap-2.5">
              <span className="truncate text-[11px] text-slate-700" title={epic.summary}>
                {epic.summary}
              </span>
              <span className="block h-3 overflow-hidden rounded bg-slate-100">
                <i
                  className="block h-full rounded"
                  style={{ width: measurable ? `${epic.taskPct}%` : "100%", background: measurable ? color : "#FEDF89" }}
                />
              </span>
              <span className="text-right font-mono text-[11px] font-bold" style={{ color }}>
                {measurable ? `${epic.tasksDone}/${epic.tasksTotal}` : "sin tareas"}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ═══ Piezas ═════════════════════════════════════════════════════════════ */

function Stat({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone: keyof typeof TONE;
}) {
  const skin = TONE[tone];
  const accented = tone === "alert" || tone === "warn";
  return (
    <div
      className="rounded-xl border p-3"
      style={{ borderColor: accented ? skin.border : "#E2E8F0", background: accented ? skin.surface : "#FFFFFF" }}
    >
      <p className="text-[9px] font-bold uppercase tracking-[0.08em]" style={{ color: accented ? skin.text : "#64748B" }}>
        {label}
      </p>
      <b className="mt-0.5 block font-mono text-[22px]" style={{ color: accented ? skin.text : "#0F172A" }}>
        {value}
      </b>
      <span className="text-[10.5px] text-slate-600">{note}</span>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i className="block h-2.5 w-2.5 rounded-sm" style={{ background: color }} aria-hidden="true" />
      {label}
    </span>
  );
}
