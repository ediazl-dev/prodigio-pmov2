import React from "react";

export type InternalWorkPlanActivity = {
  code?: string | null;
  title?: string | null;
  track?: string | null;
  deliverable?: string | null;
  startDay?: number | null;
  endDay?: number | null;
  baselineStartDate?: unknown;
  baselineEndDate?: unknown;
  jiraDueDate?: unknown;
  jiraIssueKey?: string | null;
  jiraStatusName?: string | null;
  progress?: number | null;
};

export type InternalWorkPlanTableProps = {
  activities: InternalWorkPlanActivity[];
};

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim();
  if (!text) return null;
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T00:00:00Z`)
    : new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatInternalPlanDate(value: unknown): string {
  const date = parseDate(value);
  return date
    ? new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date)
    : "N/D";
}

function formatProgress(value: unknown): string {
  if (value === null || value === undefined || value === "") return "N/D";
  const progress = Number(value);
  return Number.isFinite(progress) ? `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%` : "N/D";
}

function jiraHref(issueKey: string): string {
  return `https://apiservice2.atlassian.net/browse/${encodeURIComponent(issueKey)}`;
}

export function InternalWorkPlanTable({ activities }: InternalWorkPlanTableProps) {
  return (
    <section className="edv2-card edv2-internal-plan" aria-labelledby="internal-work-plan-title" data-testid="internal-work-plan">
      <div className="edv2-card-head">
        <h3 id="internal-work-plan-title">Plan de trabajo interno</h3>
        <span>{activities.length} actividades · Excel</span>
      </div>
      <div className="edv2-table-wrap">
        <table className="edv2-table" aria-label="Plan de trabajo interno">
          <thead>
            <tr>
              <th>Código</th>
              <th>Actividad / track</th>
              <th>Línea base interna</th>
              <th>Due Jira actual</th>
              <th>Progreso</th>
              <th>Entregable</th>
              <th>Jira</th>
            </tr>
          </thead>
          <tbody>
            {activities.length ? activities.map((activity, index) => {
              const code = String(activity.code ?? `A${String(index + 1).padStart(2, "0")}`);
              const issueKey = String(activity.jiraIssueKey ?? "").trim();
              return (
                <tr key={`${code}-${index}`}>
                  <td><b>{code}</b><br /><small>{activity.startDay != null && activity.endDay != null ? `Día ${activity.startDay}–${activity.endDay}` : "Días N/D"}</small></td>
                  <td><b>{activity.title ?? "N/D"}</b><br /><small>{activity.track ?? "Track N/D"}</small></td>
                  <td>{formatInternalPlanDate(activity.baselineStartDate)} – {formatInternalPlanDate(activity.baselineEndDate)}</td>
                  <td>{formatInternalPlanDate(activity.jiraDueDate)}</td>
                  <td><span className="edv2-chip muted">{formatProgress(activity.progress)}</span></td>
                  <td>{activity.deliverable ?? "N/D"}</td>
                  <td>
                    {issueKey
                      ? <a href={jiraHref(issueKey)} target="_blank" rel="noreferrer" aria-label={`Abrir Jira ${issueKey}`}>{issueKey}</a>
                      : <span>N/D</span>}
                    <small className="edv2-internal-plan-status">{activity.jiraStatusName ?? "Estado Jira N/D"}</small>
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan={7}><span className="edv2-empty">No hay actividades del plan interno disponibles.</span></td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="edv2-note" style={{ margin: "12px 16px 16px" }}>
        <b>Lectura de fechas:</b> la línea base interna proviene del Excel y el due Jira es la fecha operacional observada; ninguna reemplaza la otra. Un cierre Jira no declara entregable cumplido sin acta de entrega.
      </p>
    </section>
  );
}
