import React from "react";
export type ExecutiveMilestoneEvidenceRow = {
  id: number;
  milestoneCode?: string | null;
  code?: string | null;
  title?: string | null;
  baselineDate?: unknown;
  jiraDueDate?: unknown;
  committedDate?: unknown;
  jiraClosedDate?: unknown;
  jiraIssueKey?: string | null;
  jiraStatusName?: string | null;
  semanticStatus?: string | null;
  acceptedAt?: unknown;
  acceptanceStatus?: string | null;
  acceptanceEvidenceUrl?: string | null;
  acceptanceFileName?: string | null;
  lastObservedAt?: unknown;
};

export type ExecutiveMilestoneFinanceRow = {
  amountUf?: unknown;
  amountSource?: string | null;
};

export type ExecutiveMilestoneEvidenceTableProps = {
  milestones: ExecutiveMilestoneEvidenceRow[];
  milestoneFinanceByCode?: ReadonlyMap<string, ExecutiveMilestoneFinanceRow> | Record<string, ExecutiveMilestoneFinanceRow | undefined>;
  source?: { contractFileName?: string | null } | null;
  canManageRequirements: boolean;
  onRegisterActa: (milestoneId: number) => void;
  projectFinancialMode?: "internal" | "commercial";
};

function parseDateValue(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  if (!text) return null;
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T00:00:00Z`)
    : new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatExecutiveMilestoneDate(value: unknown): string {
  const date = parseDateValue(value);
  if (!date) return "N/D";
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatExecutiveMilestoneObservation(value: unknown): string {
  const date = parseDateValue(value);
  return date ? new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Santiago" }).format(date) : "N/D";
}

function formatAmount(value: unknown): string {
  if (value === null || value === undefined || value === "") return "N/D";
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? `UF ${numeric.toLocaleString("es-CL", { maximumFractionDigits: 2 })}`
    : "N/D";
}

function getFinance(
  financeByCode: ExecutiveMilestoneEvidenceTableProps["milestoneFinanceByCode"],
  code: string,
): ExecutiveMilestoneFinanceRow | undefined {
  if (!financeByCode) return undefined;
  return typeof (financeByCode as ReadonlyMap<string, ExecutiveMilestoneFinanceRow>).get === "function"
    ? (financeByCode as ReadonlyMap<string, ExecutiveMilestoneFinanceRow>).get(code)
    : (financeByCode as Record<string, ExecutiveMilestoneFinanceRow | undefined>)[code];
}

function isJiraOrigin(source: ExecutiveMilestoneEvidenceTableProps["source"]): boolean {
  return String(source?.contractFileName ?? "").toLowerCase().startsWith("baseline-jira-");
}

function amountNote(finance: ExecutiveMilestoneFinanceRow | undefined, jiraOrigin: boolean): string {
  if (jiraOrigin && finance?.amountSource === "sale_weight") return "Venta × peso Jira · referencial; no acredita contrato ni factura";
  if (jiraOrigin) return "Monto referencial; no acredita contrato ni factura";
  if (finance?.amountSource === "sale_weight") return "Venta × peso";
  if (finance?.amountSource === "contract_weight") return "Contrato × peso";
  if (finance?.amountSource === "payment_schedule") return "Calendario financiero";
  if (finance?.amountSource === "billing_milestone") return "Hito de facturación";
  return "N/D";
}

function latestObservedAt(milestones: ExecutiveMilestoneEvidenceRow[]): unknown {
  return milestones.reduce<unknown>((latest, milestone) => {
    const candidate = parseDateValue(milestone.lastObservedAt);
    const current = parseDateValue(latest);
    if (!candidate) return latest;
    if (!current || candidate.getTime() > current.getTime()) return candidate;
    return latest;
  }, null);
}

function milestoneCode(milestone: ExecutiveMilestoneEvidenceRow): string {
  return milestone.milestoneCode ?? milestone.code ?? "N/D";
}

function jiraStatusTone(status: string | null | undefined): "ok" | "warn" | "bad" | "muted" {
  const normalized = String(status ?? "").toLowerCase();
  if (/done|complete|cumplid|cerrad|resuelto|finaliz/.test(normalized)) return "ok";
  if (/block|bloque|delay|retras|atras/.test(normalized)) return "bad";
  if (/progress|progreso|pend|open|abiert/.test(normalized)) return "warn";
  return "muted";
}

export function ExecutiveMilestoneEvidenceTable({
  milestones,
  milestoneFinanceByCode,
  source,
  canManageRequirements,
  onRegisterActa,
  projectFinancialMode = "commercial",
}: ExecutiveMilestoneEvidenceTableProps) {
  const jiraOrigin = isJiraOrigin(source);
  const latestObservation = latestObservedAt(milestones);
  const amountHeading = jiraOrigin ? "Monto referencial" : "Monto";
  const isInternal = projectFinancialMode === "internal";

  return <>
    <div className="edv2-card-head">
      <h3>{isInternal ? "Actividades y evidencia de entrega" : "Calendario y evidencia por hito"}</h3>
      <span>{isInternal ? "Plan interno / acta / Jira" : "SoW / acta / Jira"}</span>
    </div>
    <div className="edv2-table-wrap">
      <table className="edv2-table" aria-label="Calendario y evidencia por hito" style={{ minWidth: 1280 }}>
        <thead>
          <tr>
            <th>Hito</th>
            {!isInternal && <th>{amountHeading}</th>}
            <th>{isInternal ? "Línea base interna" : "Fecha base contractual"}</th>
            <th>{isInternal ? "Due Jira actual" : "Programada Jira"}</th>
            <th>Cierre Jira</th>
            <th>Aceptación</th>
            <th>Acta</th>
            <th>Estado Jira</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {milestones.length ? milestones.map((milestone) => {
            const code = milestoneCode(milestone);
            const finance = getFinance(milestoneFinanceByCode, code);
            const acceptedByActa = String(milestone.acceptanceStatus ?? "").toLowerCase() === "accepted"
              && Boolean(parseDateValue(milestone.acceptedAt)) && Boolean(milestone.acceptanceEvidenceUrl?.trim());
            const jiraStatus = String(milestone.jiraStatusName ?? "").trim() || "N/D";
            const jiraKey = String(milestone.jiraIssueKey ?? "").trim() || "N/D";
            return <tr key={milestone.id}>
              <td>
                <b>{code}</b><br />
                <span>{milestone.title ?? "N/D"}</span>
              </td>
              {!isInternal && <td>
                <b>{formatAmount(finance?.amountUf)}</b><br />
                <small>{amountNote(finance, jiraOrigin)}</small>
              </td>}
              <td>{formatExecutiveMilestoneDate(milestone.baselineDate)}</td>
              <td>{formatExecutiveMilestoneDate(milestone.jiraDueDate || milestone.committedDate)}</td>
              <td>{formatExecutiveMilestoneDate(milestone.jiraClosedDate)}</td>
              <td>
                <span className={`edv2-chip ${acceptedByActa ? "ok" : "warn"}`}>
                  {acceptedByActa ? `Aceptada · ${formatExecutiveMilestoneDate(milestone.acceptedAt)}` : "Sin acta"}
                </span>
              </td>
              <td>
                {milestone.acceptanceEvidenceUrl
                  ? <a href={milestone.acceptanceEvidenceUrl} target="_blank" rel="noreferrer">{milestone.acceptanceFileName ?? "Abrir acta"}</a>
                  : <span>N/D</span>}
              </td>
              <td>
                <span className={`edv2-chip ${jiraStatusTone(milestone.jiraStatusName)}`}>{jiraStatus}</span><br />
                <small>Clave: {jiraKey}</small>
              </td>
              <td>
                {canManageRequirements && !acceptedByActa
                  ? <button
                    type="button"
                    data-testid={`register-acta-${milestone.id}`}
                    aria-label={`Registrar acta para ${code}`}
                    onClick={() => onRegisterActa(milestone.id)}
                    style={{ background: "transparent", color: "#007A70", border: "1px solid #007A70", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}
                  >Registrar acta</button>
                  : acceptedByActa
                    ? <span className="edv2-chip ok">Registrada</span>
                    : <span className="edv2-chip muted">Sin acción</span>}
              </td>
            </tr>;
          }) : <tr><td colSpan={9}><span className="edv2-empty">No hay hitos disponibles para mostrar.</span></td></tr>}
        </tbody>
      </table>
    </div>
    <p className="edv2-note" data-testid="milestone-evidence-footer" style={{ margin: "12px 16px 16px" }}>
      <b>Última observación PMO:</b> {formatExecutiveMilestoneObservation(latestObservation)} (Chile) · Jira informa estado y planificación operativa; la aceptación requiere acta con fecha vinculada al hito.
      {isInternal ? <> <b>Plan interno:</b> la línea base del Excel y el due Jira se muestran separados; un cierre Jira no declara entregable cumplido sin acta.</> : null}
      {!isInternal && jiraOrigin && milestones.some(milestone => !parseDateValue(milestone.baselineDate)) ? <> <b>Fuente Jira:</b> hay hitos con línea base contractual pendiente; sus fechas programadas no reemplazan el compromiso original.</> : null}
    </p>
  </>;
}
