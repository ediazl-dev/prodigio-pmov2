import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  CircleDollarSign,
  Gauge,
  Loader2,
} from "lucide-react";

const C = {
  navy: "#0B1A2E",
  teal: "#0D9488",
  accent: "#e91e8c",
  green: "#059669",
  amber: "#D97706",
  red: "#DC2626",
  border: "#E2E8F0",
  surface: "#FFFFFF",
  muted: "#64748B",
  soft: "#F8FAFC",
};

type SummaryMilestone = {
  key: string;
  code: string;
  title: string;
  baselineDate: string | null;
  jiraDate: string | null;
  actualDate: string | null;
  amountUf: number | null;
  status: "accepted" | "closed_jira" | "overdue" | "pending" | "billed" | "paid";
  statusLabel: string;
  evidence: string | null;
};

export type ProjectExecutiveSummaryModel = {
  dashboardPath: string;
  dashboardMode: "contractual_v2" | "historical";
  phase: string | null;
  progressPct: number | null;
  pipelineStage: string | null;
  stagesClosed: number;
  totalStages: number;
  projectManager: string | null;
  health: string | null;
  milestonesFulfilled: number | null;
  milestonesTotal: number | null;
  openRisks: number | null;
  highRisks: number | null;
  financialSource: string;
  financialCutoff: Date | string | null;
  financial: {
    contractedUf: number | null;
    consumedUf: number | null;
    budgetUf: number | null;
    projectedCostUf: number | null;
    projectedMarginUf: number | null;
    projectedMarginPct: number | null;
    capacityProjectedUf: number | null;
    billedUf: number | null;
    collectedUf: number | null;
    wipUf: number | null;
    backlogUf: number | null;
  };
  milestones: SummaryMilestone[];
  milestoneDetailSource: "contractual" | "billing" | "counts_only";
};

function finite(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function isoDate(value: unknown): string | null {
  if (!value) return null;
  return String(value).slice(0, 10);
}

function normalizedCode(value: unknown): string {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function dueStatus(date: string | null, cutoff: string): "overdue" | "pending" {
  return date && date < cutoff ? "overdue" : "pending";
}

export function buildProjectExecutiveSummary(input: {
  projectId: number;
  linkedDashboard?: any;
  baseline?: any;
  executiveDashboard?: any;
  billingMilestones?: any[];
  cutoffDate?: string;
}): ProjectExecutiveSummaryModel {
  const linked = input.linkedDashboard ?? {};
  const evidence = linked.portfolioEvidence ?? {};
  const baseline = input.baseline ?? null;
  const executive = input.executiveDashboard ?? null;
  const rawFinancial = linked.financial?.projectFinancial ?? null;
  const executiveFinance = executive?.projectFinance ?? null;
  const cutoffDate = input.cutoffDate ?? new Date().toISOString().slice(0, 10);
  const approvedBaseline = baseline?.source?.sourceStatus === "approved";
  const financeByCode = new Map<string, any>(
    (executiveFinance?.milestones ?? []).map((milestone: any) => [normalizedCode(milestone.milestoneCode), milestone]),
  );
  const executiveByCode = new Map<string, any>(
    (executive?.contractual?.milestones ?? []).map((milestone: any) => [normalizedCode(milestone.milestoneCode ?? milestone.code), milestone]),
  );

  let milestones: SummaryMilestone[] = [];
  let milestoneDetailSource: ProjectExecutiveSummaryModel["milestoneDetailSource"] = "counts_only";
  if (baseline?.milestones?.length) {
    milestoneDetailSource = "contractual";
    milestones = baseline.milestones.map((milestone: any) => {
      const code = String(milestone.milestoneCode ?? "");
      const executiveMilestone = executiveByCode.get(normalizedCode(code));
      const financeMilestone = financeByCode.get(normalizedCode(code));
      const accepted = executiveMilestone?.acceptanceStatus === "accepted";
      const jiraClosed = Boolean(milestone.jiraClosedDate) || String(milestone.semanticStatus ?? "").toLowerCase() === "fulfilled";
      const referenceDate = isoDate(milestone.baselineDate ?? milestone.jiraDueDate);
      const delayed = !accepted && String(milestone.semanticStatus ?? "").toLowerCase() === "delayed";
      const overdue = delayed || dueStatus(referenceDate, cutoffDate) === "overdue";
      const status: SummaryMilestone["status"] = accepted
        ? "accepted"
        : overdue
          ? "overdue"
          : jiraClosed
            ? "closed_jira"
            : "pending";
      return {
        key: `contract-${milestone.id}`,
        code,
        title: milestone.title,
        baselineDate: isoDate(milestone.baselineDate),
        jiraDate: isoDate(milestone.jiraDueDate),
        actualDate: isoDate(executiveMilestone?.acceptedAt ?? milestone.jiraClosedDate),
        amountUf: finite(financeMilestone?.amountUf),
        status,
        statusLabel: status === "accepted" ? "Aceptado" : status === "closed_jira" ? "Cerrado Jira · sin acta" : status === "overdue" ? (jiraClosed ? "Vencido · Jira cerrado sin acta" : "Vencido") : "Pendiente",
        evidence: executiveMilestone?.acceptanceFileName ?? null,
      };
    });
  } else if (input.billingMilestones?.length) {
    milestoneDetailSource = "billing";
    milestones = input.billingMilestones.map((milestone: any) => {
      const statusValue = String(milestone.status ?? "pendiente").toLowerCase();
      const status: SummaryMilestone["status"] = statusValue === "pagado" ? "paid" : statusValue === "facturado" ? "billed" : dueStatus(isoDate(milestone.dueDate), cutoffDate);
      return {
        key: `billing-${milestone.id}`,
        code: `H${String(milestone.milestoneNumber).padStart(2, "0")}`,
        title: milestone.description,
        baselineDate: isoDate(milestone.dueDate),
        jiraDate: null,
        actualDate: isoDate(milestone.paidAt),
        amountUf: String(milestone.currency ?? "").toUpperCase() === "UF" ? finite(milestone.amount) : null,
        status,
        statusLabel: status === "paid" ? "Marcado como pagado" : status === "billed" ? "Marcado como facturado" : status === "overdue" ? "Vencido · sin evidencia" : "Pendiente",
        evidence: milestone.invoiceNumber ?? null,
      };
    });
  }

  return {
    dashboardPath: approvedBaseline
      ? `/projects/${input.projectId}/executive-dashboard-v2`
      : `/projects/${input.projectId}/linked-dashboard`,
    dashboardMode: approvedBaseline ? "contractual_v2" : "historical",
    phase: evidence.operationalPhase ?? null,
    progressPct: finite(evidence.operationalProgressPct),
    pipelineStage: evidence.stageLabel ?? null,
    stagesClosed: finite(evidence.stagesClosed) ?? 0,
    totalStages: finite(evidence.totalStages) ?? 6,
    projectManager: evidence.pmName ?? null,
    health: evidence.executiveHealth ?? null,
    milestonesFulfilled: finite(evidence.milestonesFulfilled),
    milestonesTotal: finite(evidence.milestonesTotal),
    openRisks: finite(evidence.openRisks),
    highRisks: finite(evidence.highRisksOpen),
    financialSource: executiveFinance?.source ?? (rawFinancial ? "financial_sync" : "POR_CONFIRMAR"),
    financialCutoff: executiveFinance?.capturedAt ?? rawFinancial?.syncedAt ?? null,
    financial: {
      contractedUf: finite(executiveFinance?.overview?.contractedUf ?? rawFinancial?.valorVentaUF ?? evidence.amount),
      consumedUf: finite(executiveFinance?.costs?.consumedUf ?? rawFinancial?.utilizadoUF),
      budgetUf: finite(executiveFinance?.costs?.budgetUf ?? rawFinancial?.presupuestoUF),
      projectedCostUf: finite(executiveFinance?.costs?.projectedCostUf ?? rawFinancial?.costoProyectadoUF),
      projectedMarginUf: finite(executiveFinance?.margin?.projectedUf ?? rawFinancial?.margenProyectadoUF),
      projectedMarginPct: finite(executiveFinance?.margin?.projectedPct ?? rawFinancial?.margenProyectadoPorc),
      capacityProjectedUf: finite(executiveFinance?.costs?.capacityProjectedUf ?? rawFinancial?.proyectadoUF),
      billedUf: finite(executiveFinance?.billing?.billedUf),
      collectedUf: finite(executiveFinance?.billing?.collectedUf),
      wipUf: finite(executiveFinance?.billing?.wipUf),
      backlogUf: finite(executiveFinance?.billing?.backlogUf),
    },
    milestones,
    milestoneDetailSource,
  };
}

function formatUf(value: number | null): string {
  return value == null ? "N/D" : `UF ${new Intl.NumberFormat("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)}`;
}

function formatPct(value: number | null): string {
  if (value == null) return "N/D";
  const pct = Math.abs(value) <= 1 ? value * 100 : value;
  return `${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 }).format(pct)}%`;
}

function formatDate(value: string | null): string {
  if (!value) return "N/D";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function financialSourceLabel(source: string): string {
  if (source === "financial_sync") return "Planilla financiera sincronizada";
  if (source === "snapshot") return "Snapshot financiero persistido";
  return "Sin evidencia financiera";
}

function formatCutoff(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <article style={{ background: C.soft, border: `1px solid ${C.border}`, borderRadius: 10, padding: "13px 14px", minWidth: 0 }}>
    <span style={{ display: "block", color: C.muted, fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".09em" }}>{label}</span>
    <strong style={{ display: "block", color: C.navy, fontSize: 20, marginTop: 5, overflowWrap: "anywhere" }}>{value}</strong>
    <small style={{ display: "block", color: C.muted, fontSize: 10, marginTop: 3 }}>{note}</small>
  </article>;
}

function StatusBadge({ milestone }: { milestone: SummaryMilestone }) {
  const palette = milestone.status === "accepted" || milestone.status === "paid"
    ? { color: C.green, background: "#ECFDF5", border: "#A7F3D0" }
    : milestone.status === "overdue"
      ? { color: C.red, background: "#FEF2F2", border: "#FECACA" }
      : milestone.status === "closed_jira" || milestone.status === "billed"
        ? { color: C.amber, background: "#FFFBEB", border: "#FDE68A" }
        : { color: C.muted, background: "#F1F5F9", border: C.border };
  return <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, border: `1px solid ${palette.border}`, background: palette.background, color: palette.color, fontSize: 10, fontWeight: 800, padding: "4px 8px", whiteSpace: "nowrap" }}>{milestone.statusLabel}</span>;
}

export function ProjectExecutiveSummary({ projectId, onNavigate }: { projectId: number; onNavigate: (path: string) => void }) {
  const linkedDashboard = trpc.advance.getLinkedDashboard.useQuery({ projectId }, { staleTime: 60_000, retry: 1 });
  const baseline = trpc.portfolioConsole.getBaseline.useQuery({ projectId }, { staleTime: 60_000, retry: 1 });
  const billing = trpc.wbs.getBilling.useQuery({ projectId }, { staleTime: 60_000, retry: 1 });
  const approvedBaseline = baseline.data?.source?.sourceStatus === "approved";
  const executiveDashboard = trpc.advance.getExecutiveDashboardV2.useQuery(
    { projectId },
    { enabled: approvedBaseline, staleTime: 60_000, retry: 1 },
  );

  const model = buildProjectExecutiveSummary({
    projectId,
    linkedDashboard: linkedDashboard.data,
    baseline: baseline.data,
    executiveDashboard: executiveDashboard.data,
    billingMilestones: billing.data,
  });
  const loading = linkedDashboard.isLoading || baseline.isLoading || billing.isLoading || (approvedBaseline && executiveDashboard.isLoading);
  const issueSummary = model.milestonesTotal == null ? "N/D" : `${model.milestonesFulfilled ?? 0}/${model.milestonesTotal}`;
  const visibleMilestones = model.milestones.slice(0, 10);
  const financialCutoff = formatCutoff(model.financialCutoff);

  return <section aria-labelledby={`project-executive-summary-${projectId}`} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: "0 2px 16px rgba(10,22,40,.08)", marginBottom: 24, overflow: "hidden" }}>
    <header style={{ padding: "18px 20px", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", borderBottom: `1px solid ${C.border}`, background: "linear-gradient(110deg,#FFFFFF 0%,#F8FAFC 75%,#FDF2F8 100%)" }}>
      <div style={{ width: 42, height: 42, borderRadius: 11, background: "linear-gradient(135deg,#7C3AED,#06B6D4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Gauge size={20} color="#fff" aria-hidden="true" />
      </div>
      <div style={{ flex: 1, minWidth: 230 }}>
        <h2 id={`project-executive-summary-${projectId}`} style={{ margin: 0, color: C.navy, fontSize: 16, fontWeight: 850 }}>Vista ejecutiva del proyecto</h2>
        <p style={{ margin: "3px 0 0", color: C.muted, fontSize: 11 }}>Resumen de avance, hitos, costos y exposición. El análisis completo se abre en una pantalla dedicada.</p>
      </div>
      <Button onClick={() => onNavigate(model.dashboardPath)} style={{ background: C.accent, color: "#fff", border: 0, fontWeight: 800, fontSize: 12, borderRadius: 8 }}>
        Abrir Dashboard Ejecutivo <ArrowUpRight size={15} style={{ marginLeft: 6 }} />
      </Button>
      <span style={{ width: "100%", textAlign: "right", color: C.muted, fontSize: 10 }}>
        {model.dashboardMode === "contractual_v2" ? "Vista completa contractual v2" : "Vista completa con evidencia histórica disponible"}
      </span>
    </header>

    {loading ? <div style={{ minHeight: 180, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: C.muted, fontSize: 12 }}><Loader2 className="animate-spin" size={16} /> Consolidando resumen ejecutivo…</div> : <>
      <div style={{ padding: "16px 20px 4px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
          <Metric label="Fase Jira" value={model.phase ?? "N/D"} note={model.progressPct == null ? "Avance N/D" : `Avance ${formatPct(model.progressPct)}`} />
          <Metric label="Pipeline PMO" value={model.pipelineStage ?? "N/D"} note={`${model.stagesClosed}/${model.totalStages} etapas completadas`} />
          <Metric label="Hitos Jira" value={issueSummary} note="Cerrados / total observado" />
          <Metric label="Project Manager" value={model.projectManager ?? "N/D"} note="Responsable observado" />
          <Metric label="Riesgos" value={model.openRisks == null ? "N/D" : `${model.openRisks} abiertos`} note={model.highRisks == null ? "Altos N/D" : `${model.highRisks} altos`} />
        </div>
      </div>

      <div style={{ padding: "14px 20px 4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9, flexWrap: "wrap" }}><CircleDollarSign size={16} color={C.teal} /><h3 style={{ margin: 0, color: C.navy, fontSize: 13, fontWeight: 800 }}>Finanzas esenciales</h3><span style={{ color: C.muted, fontSize: 10 }}>Fuente: {financialSourceLabel(model.financialSource)}{financialCutoff ? ` · corte ${financialCutoff}` : ""}</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
          <Metric label="Contratado" value={formatUf(model.financial.contractedUf)} note="Valor de venta" />
          <Metric label="Costo consumido" value={formatUf(model.financial.consumedUf)} note="A la fecha" />
          <Metric label="Presupuesto costo" value={formatUf(model.financial.budgetUf)} note="Base disponible" />
          <Metric label="Costo proyectado" value={formatUf(model.financial.projectedCostUf)} note="Estimación a término" />
          <Metric label="Margen proyectado" value={formatPct(model.financial.projectedMarginPct)} note={formatUf(model.financial.projectedMarginUf)} />
          <Metric label="Capacity proyectada" value={formatUf(model.financial.capacityProjectedUf)} note="Plan + ejecutado" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(135px,1fr))", gap: 8, marginTop: 8 }}>
          <Metric label="Facturado SII" value={formatUf(model.financial.billedUf)} note="Sólo facturas verificadas" />
          <Metric label="Cobrado" value={formatUf(model.financial.collectedUf)} note="Sólo pagos verificados" />
          <Metric label="WIP" value={formatUf(model.financial.wipUf)} note="Devengado no facturado" />
          <Metric label="Backlog" value={formatUf(model.financial.backlogUf)} note="Contratado no devengado" />
        </div>
      </div>

      <div style={{ padding: "14px 20px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 9 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><CalendarClock size={16} color={C.amber} /><h3 style={{ margin: 0, color: C.navy, fontSize: 13, fontWeight: 800 }}>Hitos y cumplimiento</h3></div>
          <span style={{ color: C.muted, fontSize: 10 }}>{model.milestoneDetailSource === "contractual" ? "Baseline, Jira y aceptación separados" : model.milestoneDetailSource === "billing" ? "Hitos financieros históricos" : "Sólo existe conteo consolidado"}</span>
        </div>
        {visibleMilestones.length ? <div style={{ overflowX: "auto", border: `1px solid ${C.border}`, borderRadius: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800, fontSize: 11 }}>
            <thead><tr style={{ background: C.soft, borderBottom: `1px solid ${C.border}` }}>
              {['Hito','Descripción','Baseline','Plan Jira','Fecha real','Valor','Estado / evidencia'].map((label) => <th key={label} style={{ padding: "9px 10px", color: C.muted, textAlign: "left", fontSize: 9, textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</th>)}
            </tr></thead>
            <tbody>{visibleMilestones.map((milestone) => <tr key={milestone.key} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: "9px 10px", color: C.navy, fontWeight: 800, fontFamily: "monospace" }}>{milestone.code}</td>
              <td style={{ padding: "9px 10px", color: C.navy, maxWidth: 260 }}>{milestone.title}</td>
              <td style={{ padding: "9px 10px", color: C.muted }}>{formatDate(milestone.baselineDate)}</td>
              <td style={{ padding: "9px 10px", color: C.muted }}>{formatDate(milestone.jiraDate)}</td>
              <td style={{ padding: "9px 10px", color: C.muted }}>{formatDate(milestone.actualDate)}</td>
              <td style={{ padding: "9px 10px", color: C.navy, fontWeight: 750 }}>{formatUf(milestone.amountUf)}</td>
              <td style={{ padding: "9px 10px" }}><StatusBadge milestone={milestone} />{milestone.evidence ? <small style={{ display: "block", color: C.muted, marginTop: 4, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={milestone.evidence}>{milestone.evidence}</small> : null}</td>
            </tr>)}</tbody>
          </table>
        </div> : <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start", color: "#92400E", fontSize: 11 }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <div><strong>Detalle individual de hitos N/D.</strong> El conteo consolidado disponible es {issueSummary}; no se inventan fechas, montos ni aceptaciones.</div>
        </div>}
        {model.milestones.length > visibleMilestones.length ? <p style={{ margin: "8px 0 0", color: C.muted, fontSize: 10 }}>{model.milestones.length - visibleMilestones.length} hito(s) adicional(es) disponibles en el Dashboard Ejecutivo.</p> : null}
      </div>
    </>}
  </section>;
}
