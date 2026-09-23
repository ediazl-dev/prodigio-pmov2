import { ArrowLeft, Loader2 } from "lucide-react";
import { useParams } from "wouter";
import React, { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ProjectIdBadge } from "@/components/ProjectIdBadge";
import { ExecutiveRequirementEmptyState, ExecutiveRequirementsStatusBanner, getExecutiveRequirementsHeaderTag } from "./ExecutiveRequirementEmptyState";
import { ExecutiveFinancialAxis, formatUfOrNd } from "./ExecutiveFinancialAxis";

const stateTone: Record<string, { accent: string; label: string }> = {
  VERDE: { accent: "verde", label: "VERDE" },
  AMARILLO: { accent: "ambar", label: "AMARILLO" },
  NARANJO: { accent: "ambar", label: "NARANJO" },
  ROJO: { accent: "rojo", label: "ROJO" },
  CRITICO: { accent: "magenta", label: "CRÍTICO" },
  POR_CONFIRMAR: { accent: "gris", label: "POR CONFIRMAR" },
};

function numberOrPending(value: unknown, digits = 0) {
  if (value === null || value === undefined || value === "") return "N/D";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString("es-CL", { maximumFractionDigits: digits, minimumFractionDigits: digits }) : "N/D";
}

function percentOrPending(value: unknown) {
  if (value === null || value === undefined || value === "") return "N/D";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${numeric.toFixed(0)}%` : "N/D";
}

function ratioPercentOrPending(value: unknown) {
  if (value === null || value === undefined || value === "") return "N/D";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${(numeric * 100).toFixed(0)}%` : "N/D";
}

function formatDate(value: unknown) {
  if (!value || typeof value !== "string") return "N/D";
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) ? "N/D" : new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

const timelineStatusPresentation: Record<string, { label: string; tone: "ok" | "warn" | "bad" | "muted" }> = {
  COMPROMETIDO: { label: "COMPROMETIDO", tone: "muted" },
  PENDIENTE_ACTA: { label: "PENDIENTE ACTA", tone: "warn" },
  VENCIDO_SIN_ACTA: { label: "VENCIDO SIN ACTA", tone: "bad" },
  ACEPTADO: { label: "ACEPTADO", tone: "ok" },
  EN_RIESGO: { label: "EN RIESGO", tone: "bad" },
  SIN_FECHA_COMPROMETIDA: { label: "N/D", tone: "muted" },
};

export type ExecutiveDerivedView = "cfo" | "commercial" | "cto";

export type ExecutiveDerivedMetrics = {
  cfo: { cv: string; cpiH: string; totalDamage: string };
  commercial: { acceptedBilling: string; mismatch: string; retainedUf: string };
  cto: { linkedMilestones: string; overdue: string; reliableBacklog: string };
};

export function ExecutiveDerivedPerspectivePanel({ view, metrics }: { view: ExecutiveDerivedView; metrics: ExecutiveDerivedMetrics }) {
  if (view === "cfo") return <article id="panel-cfo" role="tabpanel" aria-labelledby="tab-cfo" className="edv2-derived-panel" data-derived-view="cfo"><div><p className="edv2-eyebrow">Lectura financiera</p><h3>Exposición de margen y caja con base cardinal.</h3><p>El costo ejecutado no se traduce en valor ganado mientras no exista aceptación. El rango EAC y los daños se mantienen condicionados a la fuente financiera disponible.</p></div><div className="edv2-derived-metrics"><span><i>CV</i><b>{metrics.cfo.cv}</b></span><span><i>CPI-H</i><b>{metrics.cfo.cpiH}</b></span><span><i>Daño total</i><b>{metrics.cfo.totalDamage}</b></span></div><p className="edv2-derived-callout"><b>Decisión requerida:</b> completar WACC, dotación bloqueada, tarifa diaria y cláusula de penalidad si no vienen en la sincronización; hasta entonces no se extrapola una pérdida final.</p></article>;
  if (view === "commercial") return <article id="panel-commercial" role="tabpanel" aria-labelledby="tab-commercial" className="edv2-derived-panel" data-derived-view="commercial"><div><p className="edv2-eyebrow">Lectura comercial</p><h3>Hitos aceptados y facturación SII se muestran por separado.</h3><p>La exposición contractual usa montos de hitos; la facturación real se acredita sólo con una factura emitida o aceptada en el registro financiero.</p></div><div className="edv2-derived-metrics"><span><i>Valor de hitos aceptados</i><b>{metrics.commercial.acceptedBilling}</b></span><span><i>Descalce</i><b>{metrics.commercial.mismatch}</b></span><span><i>UF retenidas</i><b>{metrics.commercial.retainedUf}</b></span></div><p className="edv2-derived-callout"><b>Lectura de contrato:</b> no se declara una nueva fecha comercial como aceptada sin contraparte, documento y evidencia vinculada al hito.</p></article>;
  return <article id="panel-cto" role="tabpanel" aria-labelledby="tab-cto" className="edv2-derived-panel" data-derived-view="cto"><div><p className="edv2-eyebrow">Lectura tecnológica</p><h3>La trazabilidad técnica se observa, pero no acredita entrega.</h3><p>Jira aporta una señal de ejecución y de vínculo con los hitos; el dashboard preserva su condición de indicador secundario hasta contar con snapshot operacional auditable.</p></div><div className="edv2-derived-metrics"><span><i>Hitos con issue Jira</i><b>{metrics.cto.linkedMilestones}</b></span><span><i>Vencidos abiertos</i><b>{metrics.cto.overdue}</b></span><span><i>Backlog confiable</i><b>{metrics.cto.reliableBacklog}</b></span></div><p className="edv2-derived-callout"><b>Restricción:</b> completar una issue, épica o sprint no cambia por sí solo el estado de un hito contractual. La aceptación documentada sigue siendo el único gatillo de avance.</p></article>;
}

function MetricTile({ tone = "rojo", label, value, detail, audit }: { tone?: string; label: string; value: string; detail: string; audit: string }) {
  return <article className={`edv2-kpi ${tone}`} title={audit}>
    <span className="edv2-kpi-label">{label}</span>
    <strong className="edv2-kpi-value">{value}</strong>
    <p>{detail}</p>
    <small>ⓘ Fórmula, fuente y corte</small>
  </article>;
}

function SectionHeader({ number, title, lead, tag }: { number: string; title: string; lead: string; tag?: string }) {
  return <header className="edv2-section-header">
    <span>{number}</span>
    <div><h2>{title}</h2><p>{lead}</p></div>
    {tag ? <b>{tag}</b> : null}
  </header>;
}

const prdRubric = [
  ["01", "Diagnóstico de causa raíz", "Cinco porqués o Ishikawa por hito vencido, con evidencia vinculada.", 15],
  ["02", "Re-baseline con contraparte", "Fecha, dueños, dependencia crítica y aceptación formal por cada hito.", 20],
  ["03", "Recuperación de cronograma", "Fast-tracking o crashing con costo UF, días recuperados y riesgo introducido.", 15],
  ["04", "Recuperación financiera", "Change request, descope, eficiencia o absorción con monto y decisión.", 20],
  ["05", "Desbloqueo de dependencias", "RACI, escalamiento nominado y compromiso para bloqueos críticos.", 10],
  ["06", "Higiene de control", "Trazabilidad hito↔épica, estimación de backlog y cadencia de minutas.", 10],
  ["07", "Riesgos y disparadores", "Mitigación, dueño, umbral de activación y condición de detención.", 10],
] as const;

type ExecutiveEvidenceDocumentType = "minute" | "acceptance" | "recovery_plan";
type ExecutiveEvidenceUploadResult = { uploadReceiptToken: string; fileName: string; sha256: string; notice: string };
type ExecutiveEvidenceUploadFeedback = { error: string; notice: string; isPending: boolean };
const EXECUTIVE_EVIDENCE_MAX_BYTES = 25 * 1024 * 1024;
const executiveEvidenceAccept: Record<ExecutiveEvidenceDocumentType, string> = {
  minute: ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  acceptance: ".pdf,application/pdf",
  recovery_plan: ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function executiveEvidenceFormatLabel(documentType: ExecutiveEvidenceDocumentType) {
  return documentType === "acceptance" ? "PDF" : "PDF o DOCX";
}

function readEvidenceFileBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No fue posible leer el archivo seleccionado."));
    reader.onload = () => resolve(String(reader.result ?? "").split(",")[1] ?? "");
    reader.readAsDataURL(file);
  });
}

function emptyEvidenceUploadFeedback(): Record<ExecutiveEvidenceDocumentType, ExecutiveEvidenceUploadFeedback> {
  return {
    minute: { error: "", notice: "", isPending: false },
    acceptance: { error: "", notice: "", isPending: false },
    recovery_plan: { error: "", notice: "", isPending: false },
  };
}

function friendlyEvidenceError(error: unknown) {
  const message = error instanceof Error ? error.message : "No fue posible completar la operación documental.";
  if (/invalid url|evidenceurl|fileurl|filename|too_small/i.test(message)) {
    return "El archivo no quedó validado. Vuelve a seleccionarlo y espera la confirmación antes de registrar.";
  }
  return message;
}

export default function ExecutiveDashboardV2() {
  const { user, loading: authLoading } = useAuth({ redirectOnUnauthenticated: true });
  const params = useParams<{ id: string }>();
  const projectId = Number(params.id);
  const [derivedView, setDerivedView] = useState<"cfo" | "commercial" | "cto">("cfo");
  const [minuteFormOpen, setMinuteFormOpen] = useState(false);
  const [minuteForm, setMinuteForm] = useState({ meetingDate: "", title: "", fileName: "", uploadReceiptToken: "", commitmentTitle: "", commitmentOwner: "", commitmentDueDate: "" });
  const [minuteRawText, setMinuteRawText] = useState("");
  const [commitmentPreviews, setCommitmentPreviews] = useState<any[]>([]);
  const [acceptanceFormOpen, setAcceptanceFormOpen] = useState(false);
  const [acceptanceForm, setAcceptanceForm] = useState({ milestoneId: "", acceptedAt: "", evidenceFileName: "", uploadReceiptToken: "", notes: "" });
  const [requirementFormOpen, setRequirementFormOpen] = useState(false);
  const [requirementForm, setRequirementForm] = useState({ requirementCode: "", priority: "P1" as "P0" | "P1" | "P2", title: "", rationale: "", ownerName: "", dueDate: "", acceptanceCriteria: "", consequence: "" });
  const [closingRequirementId, setClosingRequirementId] = useState<number | null>(null);
  const [closureForm, setClosureForm] = useState({ evidenceUrl: "", notes: "" });
  const [waivingRequirementId, setWaivingRequirementId] = useState<number | null>(null);
  const [waiverReason, setWaiverReason] = useState("");
  const [verdictReviewNote, setVerdictReviewNote] = useState("");
  const [ganttTooltip, setGanttTooltip] = useState<string | null>(null);
  const [recoveryPlanFormOpen, setRecoveryPlanFormOpen] = useState(false);
  const [recoveryPlanForm, setRecoveryPlanForm] = useState({ version: "", dueDate: "", fileName: "", uploadReceiptToken: "", summary: "" });
  const [evidenceUploadFeedback, setEvidenceUploadFeedback] = useState(emptyEvidenceUploadFeedback);
  const dashboard = trpc.advance.getExecutiveDashboardV2.useQuery({ projectId }, { retry: false, enabled: !authLoading && Number.isFinite(projectId) });
  const latestSyncQuery = trpc.financial.latestSync.useQuery(undefined, { retry: false, enabled: !authLoading });
  const recordMinute = trpc.advance.recordExecutiveMinute.useMutation({ onSuccess: () => { setMinuteFormOpen(false); setMinuteForm({ meetingDate: "", title: "", fileName: "", uploadReceiptToken: "", commitmentTitle: "", commitmentOwner: "", commitmentDueDate: "" }); setEvidenceUploadFeedback((current) => ({ ...current, minute: { error: "", notice: "", isPending: false } })); void dashboard.refetch(); } });
  const previewCommitments = trpc.advance.previewExecutiveCommitments.useMutation({ onSuccess: (result) => setCommitmentPreviews(result.commitments) });
  const recordAcceptance = trpc.advance.recordExecutiveMilestoneAcceptance.useMutation({ onSuccess: () => { setAcceptanceFormOpen(false); setAcceptanceForm({ milestoneId: "", acceptedAt: "", evidenceFileName: "", uploadReceiptToken: "", notes: "" }); setEvidenceUploadFeedback((current) => ({ ...current, acceptance: { error: "", notice: "", isPending: false } })); void dashboard.refetch(); } });
  const createRequirement = trpc.advance.createExecutiveRequirement.useMutation({ onSuccess: () => { setRequirementFormOpen(false); setRequirementForm({ requirementCode: "", priority: "P1", title: "", rationale: "", ownerName: "", dueDate: "", acceptanceCriteria: "", consequence: "" }); void dashboard.refetch(); } });
  const closeRequirement = trpc.advance.closeExecutiveRequirement.useMutation({ onSuccess: () => { setClosingRequirementId(null); setClosureForm({ evidenceUrl: "", notes: "" }); void dashboard.refetch(); } });
  const waiveRequirement = trpc.advance.waiveExecutiveRequirement.useMutation({ onSuccess: () => { setWaivingRequirementId(null); setWaiverReason(""); void dashboard.refetch(); } });
  const reviewAgenticVerdict = trpc.advance.reviewAgenticExecutiveVerdict.useMutation({ onSuccess: () => { setVerdictReviewNote(""); void dashboard.refetch(); } });
  const recordRecoveryPlan = trpc.advance.recordExecutiveRecoveryPlan.useMutation({ onSuccess: () => { setRecoveryPlanFormOpen(false); setRecoveryPlanForm({ version: "", dueDate: "", fileName: "", uploadReceiptToken: "", summary: "" }); setEvidenceUploadFeedback((current) => ({ ...current, recovery_plan: { error: "", notice: "", isPending: false } })); void dashboard.refetch(); } });
  const approveRecoveryPlan = trpc.advance.approveExecutiveRecoveryPlan.useMutation({ onSuccess: () => void dashboard.refetch() });
  const uploadEvidence = trpc.advance.uploadExecutiveEvidence.useMutation();
  const uploadSelectedEvidence = async (documentType: ExecutiveEvidenceDocumentType, file: File | undefined, apply: (uploaded: ExecutiveEvidenceUploadResult) => void) => {
    setEvidenceUploadFeedback((current) => ({ ...current, [documentType]: { error: "", notice: "", isPending: Boolean(file) } }));
    if (!file) return;
    if (file.size > EXECUTIVE_EVIDENCE_MAX_BYTES) {
      setEvidenceUploadFeedback((current) => ({ ...current, [documentType]: { error: "El archivo supera el límite permitido de 25 MB.", notice: "", isPending: false } }));
      return;
    }
    try {
      const uploaded = await uploadEvidence.mutateAsync({
        projectId,
        documentType,
        fileName: file.name,
        mimeType: file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        contentBase64: await readEvidenceFileBase64(file),
      });
      apply(uploaded);
      setEvidenceUploadFeedback((current) => ({ ...current, [documentType]: { error: "", notice: uploaded.notice, isPending: false } }));
    } catch (error) {
      setEvidenceUploadFeedback((current) => ({ ...current, [documentType]: { error: friendlyEvidenceError(error), notice: "", isPending: false } }));
    }
  };

  if (authLoading || dashboard.isLoading) return <div className="edv2-load" data-dashboard-presentation="standalone"><Loader2 className="h-5 w-5 animate-spin" />Cargando Dashboard Ejecutivo v2…</div>;
  if (dashboard.error || !dashboard.data) return <div className="edv2-load" data-dashboard-presentation="standalone"><div><b>Dashboard Ejecutivo v2 pendiente de habilitación.</b><p>{dashboard.error?.message ?? "No existe un baseline ejecutivo aprobado para este proyecto."}</p><a href={`/projects/${projectId}`}><ArrowLeft size={15} />Volver al proyecto</a></div></div>;

  const data = dashboard.data as any;
  const { project, source, cutoff, contractual, governance, financialEvidence, commercialExposure, agenticVerdict, projectFinance } = data;
  const operationalEvidence = data.operationalEvidence ?? { availability: "unavailable", governanceRule: "secondary_penalty_only" };
  const milestones = (contractual.milestones ?? []) as any[];
  const milestoneFinanceByCode = new Map((projectFinance?.milestones ?? []).map((milestone: any) => [milestone.milestoneCode, milestone]));
  const requirements = (governance.requirements ?? []) as any[];
  const minutes = (governance.minutes ?? []) as any[];
  const commitments = (governance.commitments ?? []) as any[];
  const minutesCoverage = governance.minutesCoverage ?? {};
  const minuteWeekStates = new Map(minutes.filter((minute) => minute.isoWeek).map((minute) => [minute.isoWeek, minute.reviewStatus]));
  const coverageWeekCodes = Array.from(new Set([...(minutesCoverage.missingWeeks ?? []), ...Array.from(minuteWeekStates.keys())])).sort();
  const canManageRequirements = ["admin", "pmo"].includes(user?.role ?? "");
  const recoveryPlans = (governance.recoveryPlans ?? []) as any[];
  const activeRecoveryPlan = governance.recoveryPlan ?? null;
  const canApproveRecoveryPlan = (governance.assignments ?? []).some((assignment: any) => assignment.active && assignment.governanceRole === "delivery_manager" && Number(assignment.userId) === Number(user?.id));
  const canWaiveRequirements = canApproveRecoveryPlan;
  const analysis = agenticVerdict?.analysis ?? null;
  const analysisReview = agenticVerdict?.review ?? null;
  const analysisReviewStatus = analysisReview?.reviewStatus ?? (analysis ? "PENDING" : "NO_ANALYSIS");
  const milestonesLinkedToJira = milestones.filter((milestone) => Boolean(milestone.jiraIssueKey)).length;
  const tone = stateTone[governance.state] ?? stateTone.POR_CONFIRMAR;
  const activeTriggers = (governance.activeTriggers ?? []) as string[];
  const responseQuestions = [
    `¿Qué acto, fecha y evidencia permiten acreditar el cierre de los ${contractual.openOverdueCount ?? 0} hito(s) exigible(s) sin aceptación al corte?`,
    "¿Qué dependencia crítica se escaló formalmente, ante quién y con qué compromiso documentado?",
    `¿Cómo se regularizará la cobertura documental, hoy con ${minutes.length} minuta(s) registrada(s), y quién responderá por cada periodo faltante?`,
    "¿Qué acciones modifican el estado actual del proyecto y qué evidencia se adjuntará para verificar su cumplimiento?",
  ];
  const openRequirements = requirements.filter((requirement) => !["closed", "waived", "cumplida", "anulada"].includes(String(requirement.requirementStatus ?? requirement.status ?? "").toLowerCase()));
  const pendingContractualMilestones = milestones.filter((milestone) => ["pending", "delayed", "blocked"].includes(String(milestone.semanticStatus ?? "").toLowerCase())).length;
  const requirementsHeaderTag = getExecutiveRequirementsHeaderTag({ governanceState: governance.state, totalRequirements: requirements.length, openRequirements: openRequirements.length });
  const timelineCandidates = milestones.flatMap((milestone) => [milestone.baselineDate, milestone.committedDate, milestone.acceptedAt]);
  const timelineDates = timelineCandidates.map((value) => Date.parse(`${String(value ?? "").slice(0, 10)}T00:00:00Z`)).filter(Number.isFinite);
  const minDate = timelineDates.length ? Math.min(...timelineDates) : 0;
  const maxDate = timelineDates.length ? Math.max(...timelineDates) : 0;
  const timelineSpan = Math.max(maxDate - minDate, 24 * 60 * 60 * 1000);
  const timelinePosition = (value: unknown) => {
    const date = Date.parse(`${String(value ?? "").slice(0, 10)}T00:00:00Z`);
    return Number.isFinite(date) && minDate ? Math.min(94, Math.max(2, ((date - minDate) / timelineSpan) * 92 + 3)) : null;
  };
  const notAccepted = contractual.openOverdueCount ?? 0;
  const dictamen = contractual.acceptedCount === 0
    ? "La evidencia contractual disponible no acredita hitos aceptados al corte. El avance cardinal se mantiene en cero hasta registrar acta y fecha de aceptación."
    : `Hay ${contractual.acceptedCount} hito(s) aceptado(s) con evidencia al corte; los hitos sin acta no se incorporan al cumplimiento.`;
  const cutoffLabel = cutoff.kind === "production"
    ? `Corte productivo · ${formatDate(cutoff.date)}`
    : cutoff.kind === "requested"
      ? `Corte solicitado · ${formatDate(cutoff.date)}`
      : `Corte observado · ${formatDate(cutoff.date)}`;
  const auditBase = `Corte: ${cutoff.date}. Fuente contractual: SoW ${source.baselineVersion}; evidencia de aceptación persistida.`;

  return <main className="edv2-root" data-dashboard-presentation="standalone">
    <style>{`
      .edv2-root{--g:#0D1117;--p:#F2F4F7;--line:#DDE3EA;--t60:#5A6472;--t40:#7E8896;--teal:#00B3A4;--amber:#F5A524;--red:#E5484D;--pink:#E71F71;--green:#2FA97C;background:var(--p);color:var(--g);min-height:100vh;font-family:"DM Sans",Poppins,sans-serif}.edv2-root *{box-sizing:border-box}.edv2-wrap{max-width:1360px;margin:0 auto;padding-left:24px;padding-right:24px}.edv2-topbar{position:sticky;top:0;z-index:60;background:var(--g);color:white;border-bottom:1px solid #2A3444}.edv2-topbar .edv2-wrap{height:60px;display:flex;align-items:center;gap:18px}.edv2-brand,.edv2-mono{font-family:"JetBrains Mono",monospace}.edv2-brand{font-size:11px;color:var(--teal);letter-spacing:.16em;font-weight:700}.edv2-crumb{font-size:12px;color:#9AA5B4;display:flex;gap:8px;align-items:center;flex:1;min-width:0}.edv2-crumb b{color:#fff;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.edv2-crumb span{opacity:.45}.edv2-return{font-size:12px;color:#D9E0E8;text-decoration:none;display:inline-flex;align-items:center;gap:6px}.edv2-return:hover{color:#fff}.edv2-hero{background:var(--g);color:#fff;padding:34px 0 38px;position:relative;overflow:hidden}.edv2-hero:before{content:"";position:absolute;inset:0;background:radial-gradient(700px 300px at 88% -10%,rgba(229,72,77,.20),transparent 65%),radial-gradient(600px 260px at 8% 110%,rgba(0,179,164,.10),transparent 60%)}.edv2-hero .edv2-wrap{position:relative}.edv2-eyebrow,.edv2-kpi-label{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--teal)}.edv2-hero-grid{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:36px;margin-top:14px;align-items:start}.edv2-hero h1{font-family:"Instrument Serif",Georgia,serif;font-size:clamp(38px,5vw,54px);font-weight:400;line-height:1.02;margin:6px 0 14px;letter-spacing:-.025em}.edv2-hero h1 em{font-style:italic;color:var(--red)}.edv2-lead{font-size:15px;max-width:64ch;color:#C3CAD4}.edv2-lead b{color:#fff;font-weight:600}.edv2-sources{display:flex;gap:8px;flex-wrap:wrap;margin-top:20px}.edv2-source{font-size:11px;border:1px solid #344051;border-radius:100px;padding:6px 12px;color:#C3CAD4}.edv2-source b{color:#fff;font-weight:500}.edv2-source.primary{border-color:var(--teal);color:#fff}.edv2-stamp{border:1px solid rgba(231,31,113,.48);border-radius:10px;background:rgba(231,31,113,.07);padding:20px}.edv2-stamp-head{display:flex;justify-content:space-between;gap:12px;border-bottom:1px dashed rgba(255,255,255,.18);padding-bottom:14px}.edv2-stamp-state{font-family:"JetBrains Mono",monospace;font-size:25px;line-height:1;color:var(--pink);font-weight:700;letter-spacing:.05em}.edv2-stamp-score{text-align:right}.edv2-stamp-score b{font-family:"JetBrains Mono",monospace;font-size:30px;display:block;line-height:1}.edv2-stamp-score span{font-size:9px;letter-spacing:.14em;color:#98A4B4;text-transform:uppercase}.edv2-trigger-list{list-style:none;padding:0;margin:14px 0 0;display:grid;gap:8px}.edv2-trigger-list li{display:flex;gap:8px;font-size:12px;color:#E4E8EE}.edv2-trigger-list code{font-family:"JetBrains Mono",monospace;font-size:10px;color:var(--pink);border:1px solid rgba(231,31,113,.45);padding:1px 5px;border-radius:4px;height:max-content}.edv2-stamp-foot{font-size:10.5px;color:#96A2B2;margin-top:14px;padding-top:12px;border-top:1px dashed rgba(255,255,255,.18)}.edv2-coverage{display:grid;grid-template-columns:repeat(5,1fr);gap:1px;margin-top:26px;border:1px solid #2A3444;background:#2A3444;border-radius:10px;overflow:hidden}.edv2-coverage article{background:var(--g);padding:13px 15px}.edv2-coverage span{display:block;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#96A2B2}.edv2-coverage b{display:block;font-family:"JetBrains Mono",monospace;font-size:14px;margin-top:5px;color:#fff}.edv2-coverage b.ok{color:var(--teal)}.edv2-coverage b.warn{color:var(--amber)}.edv2-coverage b.danger{color:var(--red)}.edv2-coverage i{font-style:normal;font-size:10px;color:#738093;display:block;margin-top:3px}.edv2-sla{margin-top:18px;border:1px solid rgba(245,165,36,.42);border-left:3px solid var(--amber);border-radius:10px;padding:13px 16px;background:rgba(245,165,36,.10);display:flex;gap:16px;align-items:center;color:#E4E8EE}.edv2-sla b{color:#fff}.edv2-sla strong{font-family:"JetBrains Mono",monospace;color:var(--amber);font-size:18px;white-space:nowrap}.edv2-subnav{position:sticky;top:60px;z-index:50;background:rgba(242,244,247,.94);border-bottom:1px solid var(--line);backdrop-filter:blur(10px)}.edv2-subnav .edv2-wrap{height:50px;display:flex;gap:4px;align-items:center;overflow:auto}.edv2-subnav a{font-size:12px;text-decoration:none;padding:7px 10px;border-radius:7px;color:var(--t60);white-space:nowrap}.edv2-subnav a:hover{background:#E3E8EE;color:var(--g)}.edv2-subnav em{font-family:"JetBrains Mono",monospace;font-style:normal;font-size:9px;color:var(--t40);margin-right:5px}.edv2-section{padding:42px 0 8px}.edv2-section-header{display:flex;gap:17px;align-items:flex-end;border-bottom:1px solid var(--line);padding-bottom:14px;margin-bottom:19px}.edv2-section-header>span{font-family:"Instrument Serif",Georgia,serif;font-size:50px;line-height:.75;color:#C8D0DB}.edv2-section-header h2{font-size:20px;font-weight:600;margin:0}.edv2-section-header p{font-size:12.5px;color:var(--t60);margin:4px 0 0;max-width:70ch}.edv2-section-header b{font-family:"JetBrains Mono",monospace;font-size:9px;letter-spacing:.11em;background:var(--g);color:#fff;border-radius:100px;padding:5px 10px;margin-left:auto;white-space:nowrap}.edv2-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px}.edv2-kpi{background:#fff;border:1px solid #E3E7EC;border-top:3px solid var(--red);border-radius:10px;padding:15px 16px;box-shadow:0 8px 24px -16px rgba(13,17,23,.35)}.edv2-kpi.teal{border-top-color:var(--teal)}.edv2-kpi.ambar{border-top-color:var(--amber)}.edv2-kpi.gris{border-top-color:#9AA5B4}.edv2-kpi.magenta{border-top-color:var(--pink)}.edv2-kpi-value{font-family:"JetBrains Mono",monospace;display:block;font-size:27px;margin:8px 0 3px;line-height:1.1}.edv2-kpi p{font-size:11px;color:var(--t60);margin:0;line-height:1.35}.edv2-kpi small{display:block;border-top:1px dashed #E4E8EE;padding-top:8px;margin-top:9px;font-size:9.5px;color:var(--t40)}.edv2-card{background:#fff;border:1px solid #E3E7EC;border-radius:10px;box-shadow:0 8px 24px -16px rgba(13,17,23,.32)}.edv2-card-head{padding:14px 18px;border-bottom:1px solid #EDF0F3;display:flex;justify-content:space-between;gap:10px;align-items:center}.edv2-card-head h3{font-size:14px;margin:0}.edv2-card-head span{font-family:"JetBrains Mono",monospace;font-size:9px;color:var(--t40);letter-spacing:.1em;text-transform:uppercase}.edv2-gantt{padding:10px 18px 16px}.edv2-gantt-axis,.edv2-gantt-row{display:grid;grid-template-columns:minmax(230px,1fr) minmax(260px,1.2fr);gap:16px;align-items:center}.edv2-gantt-axis{font-family:"JetBrains Mono",monospace;font-size:9px;color:var(--t40);letter-spacing:.1em;text-transform:uppercase;border-bottom:1px solid #EDF0F3;padding-bottom:7px}.edv2-gantt-row{padding:8px 0;border-bottom:1px solid #F1F3F6}.edv2-gantt-row:last-child{border-bottom:0}.edv2-hito{font-size:12px;min-width:0;display:flex;gap:8px;align-items:center}.edv2-hito code{font-family:"JetBrains Mono",monospace;font-size:9px;background:#EEF1F4;padding:3px 5px;color:var(--t60);border-radius:4px}.edv2-hito span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.edv2-track{height:22px;border-radius:4px;position:relative;background:repeating-linear-gradient(90deg,#F1F3F6 0 calc(25% - 1px),#fff calc(25% - 1px) 25%)}.edv2-dot{position:absolute;top:5px;width:12px;height:12px;border-radius:50%;background:#A6B1BE;border:2px solid #fff;box-shadow:0 0 0 1px #A6B1BE}.edv2-dot.accepted{background:var(--green);box-shadow:0 0 0 1px var(--green)}.edv2-dot.pending{background:var(--amber);box-shadow:0 0 0 1px var(--amber)}.edv2-dot.overdue{background:var(--red);box-shadow:0 0 0 1px var(--red)}.edv2-table-wrap{overflow:auto}.edv2-table{width:100%;border-collapse:collapse;font-size:12px}.edv2-table th{text-align:left;font-family:"JetBrains Mono",monospace;color:var(--t40);font-size:9px;text-transform:uppercase;letter-spacing:.11em;padding:10px 12px;border-bottom:1px solid #E3E7EC;white-space:nowrap}.edv2-table td{padding:10px 12px;border-bottom:1px solid #F1F3F6;vertical-align:top}.edv2-table tr:last-child td{border-bottom:0}.edv2-chip{font-family:"JetBrains Mono",monospace;border-radius:999px;font-size:9.5px;padding:3px 7px;display:inline-block}.edv2-chip.ok{background:#E5F5EE;color:#1B6B4C}.edv2-chip.warn{background:#FFF2D9;color:#875B09}.edv2-chip.bad{background:#FDEBEC;color:#A8272B}.edv2-chip.muted{background:#EEF1F4;color:var(--t60)}.edv2-two-col{display:grid;grid-template-columns:1.35fr 1fr;gap:16px}.edv2-financials{padding:18px;display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.edv2-financial{border:1px solid #E3E7EC;background:#FCFDFE;border-radius:8px;padding:13px}.edv2-financial.danger{border-color:#F5C9CA;background:#FEF7F7}.edv2-financial span{font-family:"JetBrains Mono",monospace;color:var(--t40);font-size:9px;letter-spacing:.1em;text-transform:uppercase}.edv2-financial b{display:block;font-family:"JetBrains Mono",monospace;font-size:20px;margin:6px 0 3px}.edv2-financial.danger b{color:var(--red)}.edv2-financial p{font-size:10.5px;color:var(--t60);margin:0}.edv2-list{list-style:none;padding:0;margin:0}.edv2-list li{padding:12px 17px;border-bottom:1px solid #F1F3F6;display:grid;grid-template-columns:28px 1fr auto;gap:10px}.edv2-list li:last-child{border-bottom:0}.edv2-list code{font-family:"JetBrains Mono",monospace;font-size:10px;color:var(--t40)}.edv2-list h4{font-size:12.5px;margin:0 0 3px}.edv2-list p{font-size:11px;color:var(--t60);margin:0;line-height:1.4}.edv2-empty{padding:18px;color:var(--t60);font-size:12px;line-height:1.5}.edv2-empty b{color:var(--g)}.edv2-operations{padding:18px;display:grid;gap:11px}.edv2-note{border-left:3px solid #A6B1BE;background:#F6F8FA;padding:12px 13px;font-size:11.5px;color:var(--t60)}.edv2-note b{color:var(--g)}.edv2-doc-grid{display:grid;grid-template-columns:.9fr 1.4fr;gap:16px}.edv2-evidence-panel{padding:18px}.edv2-evidence-value{font-family:"JetBrains Mono",monospace;font-size:32px;margin:7px 0;color:var(--red)}.edv2-footer{padding:36px 0 28px;margin-top:36px;background:var(--g);color:#9AA5B4;font-size:10.5px}.edv2-footer .edv2-wrap{display:flex;justify-content:space-between;gap:16px}.edv2-footer b{color:#fff;font-weight:500}@media(max-width:980px){.edv2-hero-grid,.edv2-two-col,.edv2-doc-grid{grid-template-columns:1fr}.edv2-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.edv2-coverage{grid-template-columns:repeat(2,1fr)}}@media(max-width:640px){.edv2-wrap{padding-left:15px;padding-right:15px}.edv2-topbar .edv2-wrap{gap:10px}.edv2-brand{display:none}.edv2-hero{padding-top:26px}.edv2-kpis{grid-template-columns:1fr}.edv2-coverage{grid-template-columns:1fr}.edv2-gantt-axis,.edv2-gantt-row{grid-template-columns:1fr}.edv2-gantt-axis span:last-child{display:none}.edv2-financials{grid-template-columns:1fr}.edv2-section-header b{display:none}.edv2-footer .edv2-wrap{display:block}.edv2-footer span{display:block;margin-top:5px}}
    `}</style>
    <style>{`
      .edv2-body-shell{display:flex;align-items:flex-start;gap:0;background:var(--p)}
      .edv2-side-nav{position:sticky;top:60px;z-index:35;display:flex;flex:0 0 224px;min-height:calc(100vh - 60px);flex-direction:column;gap:3px;padding:28px 16px 20px;border-right:1px solid var(--line);background:#F8FAFC}
      .edv2-side-nav-title{margin:0 0 9px;padding:0 10px;font-family:"JetBrains Mono",monospace;font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--t40)}
      .edv2-side-nav a{display:flex;align-items:center;gap:9px;min-height:34px;padding:8px 10px;border-radius:7px;color:var(--t60);font-size:12px;font-weight:600;line-height:1.25;text-decoration:none;transition:background-color 160ms cubic-bezier(.23,1,.32,1),color 160ms cubic-bezier(.23,1,.32,1)}
      .edv2-side-nav a:hover,.edv2-side-nav a:focus-visible{background:#E4F5F3;color:var(--g);outline:none}
      .edv2-side-nav a:focus-visible{box-shadow:0 0 0 2px var(--teal)}
      .edv2-side-nav em{min-width:20px;font-family:"JetBrains Mono",monospace;font-size:9px;font-style:normal;color:var(--teal)}
      .edv2-side-nav-return{margin-top:auto;border-top:1px solid var(--line);border-radius:0!important;padding-top:17px!important;color:var(--g)!important}
      .edv2-main-content{min-width:0;flex:1}
      @media(max-width:980px){.edv2-body-shell{display:block}.edv2-side-nav{position:sticky;top:60px;display:flex;min-height:auto;max-height:none;flex-direction:row;align-items:center;overflow-x:auto;padding:8px 15px;border-right:0;border-bottom:1px solid var(--line);white-space:nowrap}.edv2-side-nav-title{display:none}.edv2-side-nav a{flex:0 0 auto;min-height:32px}.edv2-side-nav-return{margin:0 0 0 8px;border-top:0;border-left:1px solid var(--line);border-radius:0!important;padding:8px 0 8px 14px!important}}
      @media(prefers-reduced-motion:reduce){.edv2-side-nav a{transition:none}}
    `}</style>
    <header className="edv2-topbar"><div className="edv2-wrap"><span className="edv2-brand">PRODIGIO · CONTROL</span><div className="edv2-crumb"><a href="/projects">Proyectos</a><span>/</span><b>{project.name}</b><ProjectIdBadge projectId={projectId} tone="dark" /><span>/</span><b>Dashboard ejecutivo</b></div><a className="edv2-return" href={`/projects/${projectId}`}><ArrowLeft size={14} />Proyecto</a></div></header>

    <section className="edv2-hero"><div className="edv2-wrap">
      <p className="edv2-eyebrow">Dictamen de gobierno · nivel contractual</p>
      <div className="edv2-hero-grid"><div><h1>La evidencia define el <em>estado</em>.</h1><p className="edv2-lead"><b>{dictamen}</b> La fecha planificada de Jira es el compromiso contractual; su cierre confirma operación, pero sólo el acta del cliente acredita aceptación.</p><div className="edv2-sources"><span className="edv2-source primary">SoW <b>{source.baselineVersion}</b></span><span className="edv2-source">Jira <b>{source.jiraProjectKey}</b> · snapshot {operationalEvidence.availability}</span><span className="edv2-source">Fase Jira <b>{operationalEvidence.operationalPhase ?? "N/D"}</b></span><span className="edv2-source">Salud Jira <b>{operationalEvidence.executiveHealth ?? "N/D"}</b></span><span className="edv2-source">Deal <b>{source.dealId}</b></span><span className="edv2-source">{cutoffLabel}</span></div></div>
      <aside className="edv2-stamp"><div className="edv2-stamp-head"><span className="edv2-stamp-state">{tone.label}</span><div className="edv2-stamp-score"><b>{governance.ige == null ? "N/D" : numberOrPending(governance.ige)}</b><span>IGE / 100</span></div></div><ul className="edv2-trigger-list">{activeTriggers.length ? activeTriggers.map((trigger) => <li key={trigger}><code>{trigger}</code><span>Gatillo activo según el motor determinista.</span></li>) : <li><code>INFO</code><span>No hay gatillos absolutos activos; el estado se deriva de los insumos disponibles.</span></li>}</ul><p className="edv2-stamp-foot">Motor v2 · estado único: <b>{governance.state}</b> · datos incompletos se mantienen como N/D · snapshot {operationalEvidence.observedAt ? formatDate(operationalEvidence.observedAt) : "N/D"}.</p></aside></div>
      <div className="edv2-coverage"><article><span>Actas de aceptación</span><b className={contractual.acceptedCount ? "ok" : "danger"}>{contractual.acceptedCount}/{contractual.totalMilestones}</b><i>hitos con evidencia al corte</i></article><article><span>Hitos exigibles</span><b className={contractual.committedCount ? "warn" : "ok"}>{contractual.committedCount}/{contractual.totalMilestones}</b><i>fecha efectiva anterior al corte</i></article><article><span>Vencidos abiertos</span><b className={notAccepted ? "danger" : "ok"}>{notAccepted}</b><i>sin aceptación registrada</i></article><article><span>Minutas</span><b className={minutes.length ? "ok" : "danger"}>{minutes.length} registrada(s)</b><i>evidencia documental</i></article><article><span>Finanzas</span><b className={financialEvidence.source === "POR_CONFIRMAR" ? "danger" : "warn"}>{financialEvidence.source === "POR_CONFIRMAR" ? "N/D" : financialEvidence.source}</b><i>fuente y frescura</i></article></div>
      <ExecutiveRequirementsStatusBanner governanceState={governance.state} totalRequirements={requirements.length} openRequirements={openRequirements.length} pendingMilestones={pendingContractualMilestones} highOpenRisks={operationalEvidence.highOpenRisks ?? null} activeTriggers={activeTriggers.length} />
    </div></section>

    <div className="edv2-body-shell">
      <aside className="edv2-side-nav" aria-label="Navegación lateral del dashboard ejecutivo">
        <p className="edv2-side-nav-title">Navegación</p>
        <a href="#veredicto"><em>00</em>Observación IA</a><a href="#hitos"><em>01</em>Hitos</a><a href="#finanzas"><em>02</em>Impacto</a><a href="#exigencias"><em>03</em>Exigencias</a><a href="#operacion"><em>04</em>Operación</a><a href="#minutas"><em>05</em>Minutas</a><a href="#perspectivas"><em>06</em>Vistas derivadas</a><a href="#trazabilidad"><em>07</em>Trazabilidad</a>
        <a className="edv2-side-nav-return" href={`/projects/${projectId}`}>← Volver al proyecto</a>
      </aside>
      <div className="edv2-main-content"><div className="edv2-wrap">
      <section className="edv2-section" id="veredicto"><SectionHeader number="00" title="Observación agéntica y validación" lead="La IA puede proponer una lectura estructurada, pero sólo PMO/Admin puede validarla o rechazarla como antecedente ejecutivo." tag={analysisReviewStatus} /><article className="edv2-card"><div className="edv2-card-head"><h3>Análisis PM Senior</h3><span>{analysis ? `ID ${analysis.id}` : "SIN OBSERVACIÓN PERSISTIDA"}</span></div><div className="edv2-evidence-panel">{analysis ? <><span className={`edv2-chip ${analysisReviewStatus === "VALIDATED" ? "ok" : analysisReviewStatus === "REJECTED" ? "bad" : "warn"}`}>{analysisReviewStatus === "VALIDATED" ? "VALIDADO POR GOBIERNO" : analysisReviewStatus === "REJECTED" ? "RECHAZADO CON MOTIVO" : "OBSERVACIÓN PENDIENTE"}</span><p style={{ marginTop: 12, fontSize: 13, lineHeight: 1.55 }}>{analysis.overallVerdict || analysis.ctoInsights?.[0]?.text || "La observación agéntica no contiene una síntesis legible."}</p>{analysisReview ? <p className="edv2-note" style={{ marginTop: 14 }}><b>{analysisReview.reviewStatus === "VALIDATED" ? "Validación registrada." : analysisReview.reviewStatus === "REJECTED" ? "Rechazo registrado." : "Revisión pendiente."}</b>{analysisReview.reviewNote ? ` ${analysisReview.reviewNote}` : " No existe aún una nota de revisión."}</p> : null}{canManageRequirements && analysisReviewStatus === "PENDING" ? <form onSubmit={(event) => event.preventDefault()} style={{ marginTop: 16, display: "grid", gap: 9 }}><label htmlFor="agentic-review-note" className="edv2-mono" style={{ fontSize: 10 }}>MOTIVO DE VALIDACIÓN O RECHAZO</label><textarea id="agentic-review-note" value={verdictReviewNote} onChange={(event) => setVerdictReviewNote(event.target.value)} minLength={3} maxLength={10000} required placeholder="Registra el fundamento ejecutivo de la decisión." style={{ minHeight: 88, padding: 10, border: "1px solid #DDE3EA", borderRadius: 7, font: "inherit" }} /><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button type="button" disabled={verdictReviewNote.trim().length < 3 || reviewAgenticVerdict.isPending} onClick={() => reviewAgenticVerdict.mutate({ projectId, verdictId: analysis.id, reviewStatus: "VALIDATED", reviewNote: verdictReviewNote.trim() })}>Validar observación</button><button type="button" disabled={verdictReviewNote.trim().length < 3 || reviewAgenticVerdict.isPending} onClick={() => reviewAgenticVerdict.mutate({ projectId, verdictId: analysis.id, reviewStatus: "REJECTED", reviewNote: verdictReviewNote.trim() })}>Rechazar observación</button></div>{reviewAgenticVerdict.error ? <p role="alert" style={{ color: "#A8272B", margin: 0 }}>{reviewAgenticVerdict.error.message}</p> : null}</form> : analysisReviewStatus === "PENDING" ? <p className="edv2-note" style={{ marginTop: 14 }}><b>Acción requerida:</b> una cuenta Admin o PMO debe registrar el motivo para validar o rechazar esta observación.</p> : null}</> : <p className="edv2-empty"><b>Sin análisis agéntico persistido.</b> Cuando se genere una observación PM válida, aparecerá aquí como pendiente hasta una revisión humana formal.</p>}</div></article></section>
      <section className="edv2-section" id="hitos"><SectionHeader number="01" title="Eje primario — cumplimiento cardinal de hitos" lead="La métrica maestra cuenta solamente hitos aceptados con acta; los pesos comerciales no intervienen." tag={cutoffLabel} /><div className="edv2-kpis"><MetricTile tone="magenta" label="CHC-T · exigible" value={percentOrPending(contractual.chcT)} detail={`${contractual.acceptedCount} aceptados de ${contractual.committedCount} exigibles`} audit={`CHC-T = aceptados exigibles / comprometidos exigibles. ${auditBase}`} /><MetricTile tone="teal" label="CHC-G · global" value={percentOrPending(contractual.chcG)} detail={`${contractual.acceptedCount} aceptados de ${contractual.totalMilestones} hitos`} audit={`CHC-G = aceptados exigibles / total de hitos. ${auditBase}`} /><MetricTile tone="ambar" label="Esperado-G" value={percentOrPending(contractual.expectedG)} detail={`${contractual.committedCount} hitos comprometidos`} audit={`Esperado-G = comprometidos exigibles / total de hitos. ${auditBase}`} /><MetricTile label="Vencidos abiertos" value={numberOrPending(contractual.openOverdueCount)} detail="hitos exigibles sin aceptación" audit={`Vencidos = comprometidos con aceptación nula. ${auditBase}`} /><MetricTile tone="gris" label="DRC crítico" value={contractual.drcDays == null ? "N/D" : `${numberOrPending(contractual.drcDays)} días`} detail="demora máxima de ruta crítica" audit={`DRC = máximo atraso de un hito crítico vencido. ${auditBase}`} /></div>
      <div className="edv2-card" style={{ marginTop: 16 }}>
        <div className="edv2-card-head">
          <h3>Línea de tiempo contractual — baseline vs. real</h3>
          <span>{projectFinance?.overview?.milestoneAmountCoverage ? `${projectFinance.overview.milestoneAmountCoverage.withAmount}/${projectFinance.overview.milestoneAmountCoverage.total} hitos con monto · UF` : "Montos por hito · N/D"}</span>
        </div>
        <div className="edv2-gantt-wrap">
          {(() => {
            // Eje temporal dinámico: desde la menor fecha baseline hasta la mayor fecha comprometida/corte
            const DAY = 1000 * 60 * 60 * 24;
            const parseDay = (value: unknown): number | null => {
              const ts = Date.parse(`${String(value ?? "").slice(0, 10)}T00:00:00Z`);
              return Number.isFinite(ts) ? ts : null;
            };
            const cutoffTs = parseDay(cutoff.date) ?? Date.now();
            const allDates: number[] = [];
            milestones.forEach((milestone) => {
              [milestone.baselineDate, milestone.jiraDueDate, milestone.jiraClosedDate, milestone.acceptedAt].forEach((value) => {
                const ts = parseDay(value);
                if (ts != null) allDates.push(ts);
              });
            });
            allDates.push(cutoffTs);
            const axisStart = allDates.length ? Math.min(...allDates) : cutoffTs;
            const axisEnd = allDates.length ? Math.max(...allDates) : cutoffTs + 90 * DAY;
            const spanDays = Math.max((axisEnd - axisStart) / DAY, 30);
            const pos = (value: unknown): number | null => {
              const ts = parseDay(value);
              if (ts == null) return null;
              return Math.min(98, Math.max(1, ((ts - axisStart) / (spanDays * DAY)) * 96 + 1));
            };
            const cortePos = pos(cutoff.date) ?? 50;
            // Meses del eje: generar etiquetas entre axisStart y axisEnd
            const monthLabels: { label: string; left: number }[] = [];
            const cursor = new Date(axisStart);
            cursor.setUTCDate(1);
            while (cursor.getTime() <= axisEnd) {
              const ts = cursor.getTime();
              if (ts >= axisStart) {
                monthLabels.push({
                  label: new Intl.DateTimeFormat("es-CL", { month: "short", timeZone: "UTC" }).format(cursor).toUpperCase().replace(".", ""),
                  left: Math.min(96, Math.max(1, ((ts - axisStart) / (spanDays * DAY)) * 96 + 1)),
                });
              }
              cursor.setUTCMonth(cursor.getUTCMonth() + 1);
            }
            return (
              <>
                <div className="edv2-gantt-header">
                  <div className="edv2-gantt-label-col">Hito</div>
                  <div className="edv2-gantt-timeline">
                    <div className="edv2-gantt-months-track">
                      {monthLabels.map((month) => (
                        <span key={`${month.label}-${month.left}`} className="edv2-gantt-month" style={{ left: `${month.left}%` }}>{month.label}</span>
                      ))}
                    </div>
                  </div>
                </div>
                {milestones.map((milestone) => {
                  const milestoneFinance = milestoneFinanceByCode.get(milestone.milestoneCode) as any;
                  const timeline = milestone.timeline;
                  const status = timeline?.status ?? "COMPROMETIDO";
                  const baselineTs = parseDay(milestone.baselineDate);
                  const jiraTs = parseDay(milestone.jiraDueDate);
                  const actaTs = parseDay(milestone.acceptedAt);
                  const derivaDias = baselineTs != null && jiraTs != null ? Math.round((jiraTs - baselineTs) / DAY) : null;
                  const derivaRealDias = baselineTs != null && actaTs != null ? Math.round((actaTs - baselineTs) / DAY) : null;
                  const baselinePos = pos(milestone.baselineDate);
                  const jiraPos = pos(milestone.jiraDueDate);
                  const actaPos = pos(milestone.acceptedAt);
                  let barClass = "edv2-gantt-marker plan";
                  let statusLabel = "Planificado";
                  let statusFull = "Comprometido en Jira";
                  if (status === "ACEPTADO") { barClass = "edv2-gantt-marker ok"; statusLabel = "Aceptado"; statusFull = "Aceptado por el cliente"; }
                  else if (status === "VENCIDO_SIN_ACTA") { barClass = "edv2-gantt-marker atraso"; statusLabel = "Vencido"; statusFull = "Vencido sin acta de aceptación"; }
                  else if (status === "PENDIENTE_ACTA") { barClass = "edv2-gantt-marker hoy"; statusLabel = "Pend. acta"; statusFull = "Cerrado en Jira, pendiente de acta"; }
                  else if (status === "EN_RIESGO") { barClass = "edv2-gantt-marker riesgo"; statusLabel = "En riesgo"; statusFull = "En riesgo de incumplimiento"; }
                  const tipId = `tip-${milestone.milestoneCode}`;
                  const isTipOpen = ganttTooltip === tipId;
                  const actaLabel = milestone.acceptedAt ? `Acta registrada el ${formatDate(milestone.acceptedAt)}` : "Sin acta de aceptación";
                  return (
                    <div key={milestone.milestoneCode} className="edv2-gantt-row">
                      <div className="edv2-gantt-label-col">
                        <code className="edv2-gantt-code">{milestone.milestoneCode}</code>
                        <div className="edv2-gantt-copy">
                          <div className="edv2-gantt-name" title={milestone.title}>{milestone.title}</div>
                          <div className="edv2-gantt-weight">Peso {milestoneFinance?.weightPct ?? milestone.billingWeight ?? "N/D"}%{milestoneFinance?.weightSource === "title" ? " (título)" : ""} · <b>{formatUfOrNd(milestoneFinance?.amountUf)}</b></div>
                        </div>
                      </div>
                      <div
                        className="edv2-gantt-timeline"
                        onMouseEnter={() => setGanttTooltip(tipId)}
                        onMouseLeave={() => setGanttTooltip(null)}
                        onFocus={() => setGanttTooltip(tipId)}
                        onBlur={() => setGanttTooltip(null)}
                        tabIndex={0}
                        role="button"
                        aria-label={`${milestone.milestoneCode} ${milestone.title}. Monto contractual ${formatUfOrNd(milestoneFinance?.amountUf)}. ${statusFull}. Base contractual ${formatDate(milestone.baselineDate)}. Programada Jira ${formatDate(milestone.jiraDueDate)}.${milestone.acceptedAt ? ` Fecha real ${formatDate(milestone.acceptedAt)}.` : ""}`}
                      >
                        {baselinePos != null && (
                          <div className="edv2-gantt-baseline" style={{ left: `${baselinePos}%` }}>
                            <span className="edv2-gantt-date-tag base">{formatDate(milestone.baselineDate)}</span>
                          </div>
                        )}
                        {baselinePos != null && jiraPos != null && derivaDias != null && derivaDias !== 0 && (
                          <div
                            className={`edv2-gantt-deriva-bar ${derivaDias > 0 ? "positiva" : "negativa"}`}
                            style={{ left: `${Math.min(baselinePos, jiraPos)}%`, width: `${Math.max(Math.abs(jiraPos - baselinePos), 1.5)}%` }}
                          >
                            <span className="edv2-gantt-deriva-tag">{derivaDias > 0 ? "+" : ""}{derivaDias}d</span>
                          </div>
                        )}
                        {baselinePos != null && actaPos != null && derivaRealDias != null && derivaRealDias !== 0 && (
                          <div
                            className={`edv2-gantt-deriva-bar real ${derivaRealDias > 0 ? "positiva" : "negativa"}`}
                            style={{ left: `${Math.min(baselinePos, actaPos)}%`, width: `${Math.max(Math.abs(actaPos - baselinePos), 1.5)}%` }}
                          >
                            <span className="edv2-gantt-deriva-tag real">{derivaRealDias > 0 ? "+" : ""}{derivaRealDias}d real</span>
                          </div>
                        )}
                        {jiraPos != null && (
                          <div className={barClass} style={{ left: `${jiraPos}%` }}>
                            <span className="edv2-gantt-date-tag prog">{formatDate(milestone.jiraDueDate)}</span>
                            <span className="edv2-gantt-marker-label">{statusLabel}</span>
                          </div>
                        )}
                        {actaPos != null && (
                          <div className="edv2-gantt-acta" style={{ left: `${actaPos}%` }}>
                            <span className="edv2-gantt-date-tag acta">{formatDate(milestone.acceptedAt)}</span>
                            <span className="edv2-gantt-acta-star">★</span>
                          </div>
                        )}
                        {isTipOpen && (
                          <div className="edv2-gantt-tooltip" role="tooltip">
                            <div className="edv2-gantt-tooltip-head">
                              <b>{milestone.milestoneCode}</b>
                              <span>{milestone.title}</span>
                            </div>
                            <div className="edv2-gantt-tooltip-grid">
                              <span>Base contractual</span><b>{formatDate(milestone.baselineDate)}</b>
                              <span>Programada Jira</span><b>{formatDate(milestone.jiraDueDate)}</b>
                              {milestone.acceptedAt ? <><span>Fecha real (acta)</span><b>{formatDate(milestone.acceptedAt)}</b></> : null}
                              <span>Deriva planif.</span><b className={derivaDias != null && derivaDias > 0 ? "neg" : derivaDias != null && derivaDias < 0 ? "pos" : ""}>{derivaDias == null ? "[PENDIENTE]" : `${derivaDias > 0 ? "+" : ""}${derivaDias} días`}</b>
                              {derivaRealDias != null ? <><span>Deriva real</span><b className={derivaRealDias > 0 ? "neg" : derivaRealDias < 0 ? "pos" : ""}>{derivaRealDias > 0 ? "+" : ""}{derivaRealDias} días</b></> : null}
                              <span>Estado</span><b>{statusFull}</b>
                              <span>Peso</span><b>{milestoneFinance?.weightPct ?? milestone.billingWeight ?? "N/D"}%{milestoneFinance?.weightSource === "title" ? " · título contractual" : ""}</b>
                              <span>Monto contractual</span><b>{formatUfOrNd(milestoneFinance?.amountUf)}</b>
                              <span>Fuente monto</span><b>{milestoneFinance?.amountSource === "payment_schedule" ? "Calendario financiero" : milestoneFinance?.amountSource === "billing_milestone" ? "Hito de facturación" : milestoneFinance?.amountSource === "sale_weight" ? "Venta UF × peso" : milestoneFinance?.amountSource === "contract_weight" ? "Contrato UF × peso" : milestoneFinance?.amountSource === "currency_blocked" ? "Moneda distinta de UF" : "N/D"}</b>
                              <span>Acta</span><b>{actaLabel}</b>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                <div className="edv2-gantt-corte" style={{ left: `calc(260px + (100% - 260px - 32px) * ${cortePos} / 100 + 16px)` }}>
                  <span>Corte {formatDate(cutoff.date)}</span>
                </div>
              </>
            );
          })()}
        </div>
        <div className="edv2-gantt-legend">
          <span><i className="edv2-gantt-dot baseline" /> Línea base (carta Gantt)</span>
          <span><i className="edv2-gantt-dot ok" /> Aceptado por el cliente</span>
          <span><i className="edv2-gantt-dot atraso" /> Vencido sin acta</span>
          <span><i className="edv2-gantt-dot riesgo" /> En riesgo de incumplimiento</span>
          <span><i className="edv2-gantt-dot hoy" /> Pendiente de acta</span>
          <span><i className="edv2-gantt-dot plan" /> Comprometido Jira</span>
          <span><i className="edv2-gantt-dot acta" /> Fecha real (acta)</span>
          <span><i className="edv2-gantt-dot corte" /> Fecha de corte</span>
        </div>
        <p className="edv2-note" style={{ margin: "12px 16px 16px" }}>
          <b>Regla de gobierno:</b> el rombo grafito es la fecha base contractual (carta Gantt); el marcador de color es la fecha programada en Jira, que puede reflejar replanificaciones; la estrella teal es la fecha real de aceptación registrada en acta. La franja entre base y Jira es la deriva de planificación; la franja entre base y acta es la deriva real. Un cierre Jira inicia la ventana de cinco días para acta; no suma avance ni acredita aceptación sin documento, fecha y vínculo verificable.
        </p>
      </div>
       <div className="edv2-card" style={{ marginTop: 16 }}><div className="edv2-card-head"><h3>Hitos vencidos sin aceptación y evidencia por hito</h3><span>SoW / acta / Jira</span></div><div className="edv2-table-wrap"><table className="edv2-table"><thead><tr><th>Hito</th><th>Monto contractual</th><th>Fecha efectiva</th><th>Aceptación</th><th>Acta</th><th>Jira operativo</th><th>Acción</th></tr></thead><tbody>{milestones.map((milestone) => <tr key={milestone.id}><td><b>{milestone.milestoneCode}</b><br /><span>{milestone.title}</span></td><td><b>{formatUfOrNd((milestoneFinanceByCode.get(milestone.milestoneCode) as any)?.amountUf)}</b><br /><small>{(milestoneFinanceByCode.get(milestone.milestoneCode) as any)?.amountSource === "sale_weight" ? "Venta × peso" : (milestoneFinanceByCode.get(milestone.milestoneCode) as any)?.amountSource === "contract_weight" ? "Contrato × peso" : (milestoneFinanceByCode.get(milestone.milestoneCode) as any)?.amountSource === "payment_schedule" ? "Calendario financiero" : (milestoneFinanceByCode.get(milestone.milestoneCode) as any)?.amountSource === "billing_milestone" ? "Hito de facturación" : "N/D"}</small></td><td>{formatDate(milestone.committedDate ?? milestone.baselineDate)}</td><td><span className={`edv2-chip ${milestone.acceptanceStatus === "accepted" ? "ok" : "warn"}`}>{milestone.acceptanceStatus === "accepted" ? `ACEPTADO · ${formatDate(milestone.acceptedAt)}` : "SIN ACTA"}</span></td><td>{milestone.acceptanceEvidenceUrl ? <a href={milestone.acceptanceEvidenceUrl} target="_blank" rel="noreferrer">{milestone.acceptanceFileName ?? "Abrir evidencia"}</a> : "[PENDIENTE]"}</td><td><span className="edv2-chip muted">{milestone.jiraIssueKey || "[POR CONFIRMAR]"} · no gobierna</span></td><td>{milestone.acceptanceStatus !== "accepted" && canManageRequirements ? <button type="button" onClick={() => { setAcceptanceForm({ ...acceptanceForm, milestoneId: String(milestone.id) }); setAcceptanceFormOpen(true); }} style={{ background: "transparent", color: "#007A70", border: "1px solid #007A70", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>Registrar acta</button> : milestone.acceptanceStatus === "accepted" ? <span className="edv2-chip ok">Registrada</span> : null}</td></tr>)}</tbody></table></div>{canManageRequirements ? <details open={acceptanceFormOpen} onToggle={(event) => setAcceptanceFormOpen((event.currentTarget as HTMLDetailsElement).open)} style={{ margin: 16 }}><summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#0D1117" }}>Registrar acta real de aceptación</summary><form onSubmit={(event) => { event.preventDefault(); recordAcceptance.mutate({ projectId, milestoneId: Number(acceptanceForm.milestoneId), acceptedAt: acceptanceForm.acceptedAt, uploadReceiptToken: acceptanceForm.uploadReceiptToken, notes: acceptanceForm.notes || undefined }); }} style={{ display: "grid", gap: 8, marginTop: 12 }}><label>Hito contractual{acceptanceForm.milestoneId ? <p className="edv2-note" style={{ margin: "4px 0 0" }}><b>{milestones.find((milestone) => String(milestone.id) === acceptanceForm.milestoneId)?.milestoneCode}</b> · {milestones.find((milestone) => String(milestone.id) === acceptanceForm.milestoneId)?.title} <button type="button" onClick={() => setAcceptanceForm({ ...acceptanceForm, milestoneId: "" })} style={{ background: "none", border: 0, color: "#007A70", cursor: "pointer", fontSize: 11, textDecoration: "underline", padding: 0, marginLeft: 6 }}>cambiar</button></p> : <select required value={acceptanceForm.milestoneId} onChange={(event) => setAcceptanceForm({ ...acceptanceForm, milestoneId: event.target.value })}><option value="">Seleccionar hito sin acta</option>{milestones.filter((milestone) => milestone.acceptanceStatus !== "accepted").map((milestone) => <option key={milestone.id} value={String(milestone.id)}>{milestone.milestoneCode} · {milestone.title}</option>)}</select>}</label><label>Fecha de aceptación<input required type="date" value={acceptanceForm.acceptedAt} onChange={(event) => setAcceptanceForm({ ...acceptanceForm, acceptedAt: event.target.value })} /></label><label>Nombre del acta<input required readOnly value={acceptanceForm.evidenceFileName} placeholder="Se completa al validar el archivo" /></label><div>
  <span style={{ fontSize: 11, fontWeight: 700, color: "#0D1117", display: "block", marginBottom: 6 }}>Acta de aceptación (PDF, máx. 25 MB)</span>
  <label className="edv2-upload-btn">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
    {acceptanceForm.evidenceFileName ? "Cambiar archivo" : "Seleccionar archivo PDF"}
    <input required type="file" accept={executiveEvidenceAccept.acceptance} disabled={evidenceUploadFeedback.acceptance.isPending} onChange={(event) => { setAcceptanceForm((current) => ({ ...current, evidenceFileName: "", uploadReceiptToken: "" })); void uploadSelectedEvidence("acceptance", event.target.files?.[0], (uploaded) => setAcceptanceForm((current) => ({ ...current, evidenceFileName: uploaded.fileName, uploadReceiptToken: uploaded.uploadReceiptToken }))); }} />
  </label>
  {acceptanceForm.evidenceFileName ? <p className="edv2-upload-filename">{acceptanceForm.evidenceFileName}</p> : null}
</div>{acceptanceForm.uploadReceiptToken ? <p className="edv2-note"><b>Archivo validado:</b> {acceptanceForm.evidenceFileName}. El acta aún debe registrarse con fecha y hito.</p> : <p className="edv2-note">Selecciona el acta real. La carga por sí sola no acredita el hito.</p>}{evidenceUploadFeedback.acceptance.error ? <p role="alert" className="edv2-note" style={{ color: "#A8272B" }}>{evidenceUploadFeedback.acceptance.error}</p> : null}{evidenceUploadFeedback.acceptance.notice ? <p className="edv2-note" style={{ color: "#007A70" }}>{evidenceUploadFeedback.acceptance.notice}</p> : null}<label>Notas de recepción (opcional)<textarea value={acceptanceForm.notes} onChange={(event) => setAcceptanceForm({ ...acceptanceForm, notes: event.target.value })} placeholder="Contraparte, alcance aceptado u observaciones." /></label><button type="submit" disabled={!acceptanceForm.milestoneId || !acceptanceForm.acceptedAt || !acceptanceForm.uploadReceiptToken || evidenceUploadFeedback.acceptance.isPending || recordAcceptance.isPending} style={{ background: "#00B3A4", color: "#0D1117", border: 0, borderRadius: 6, padding: "9px 12px", cursor: "pointer", fontWeight: 800 }}>{recordAcceptance.isPending ? "Registrando…" : "Registrar acta y aceptar hito"}</button>{recordAcceptance.error ? <p role="alert" style={{ color: "#A8272B", fontSize: 11, margin: 0 }}>{friendlyEvidenceError(recordAcceptance.error)}</p> : null}</form></details> : <p className="edv2-note" style={{ margin: "12px 16px 16px" }}><b>Acción restringida:</b> sólo Admin/PMO puede registrar un acta real. Sin archivo validado y fecha de aceptación, el hito permanece fuera del avance cardinal.</p>}</div></section>

      <ExecutiveFinancialAxis projectFinance={projectFinance} financialEvidence={financialEvidence} commercialExposure={commercialExposure} latestSyncAt={latestSyncQuery.data?.createdAt ?? null} auditBase={auditBase} />

      <section className="edv2-section" id="exigencias"><SectionHeader number="03" title="Exigencias, pauta de remediación y descargos" lead="Todo estado degradado debe cerrar con responsable, fecha límite, criterio verificable y evidencia de cumplimiento." tag={requirementsHeaderTag} /><div className="edv2-two-col"><article className="edv2-card"><div className="edv2-card-head"><h3>Exigencias vigentes</h3><span>P0 / P1 / P2</span></div>{requirements.length ? <ol className="edv2-list">{requirements.map((requirement, index) => <li key={requirement.id}><code>{requirement.requirementCode ?? requirement.code ?? `E-${String(index + 1).padStart(2, "0")}`}</code><div><h4>{requirement.title ?? requirement.description ?? "[POR CONFIRMAR]"}</h4><p>Dueño: {requirement.ownerName ?? "[POR CONFIRMAR]"} · vence: {formatDate(requirement.dueDate)} · criterio: {requirement.acceptanceCriteria ?? "[POR CONFIRMAR]"}</p></div><span className={`edv2-chip ${["closed", "waived"].includes(requirement.requirementStatus) ? "ok" : "warn"}`}>{requirement.requirementStatus ?? requirement.priority ?? "P1"}</span></li>)}</ol> : <ExecutiveRequirementEmptyState governanceState={governance.state} pendingMilestones={pendingContractualMilestones} highOpenRisks={operationalEvidence.highOpenRisks ?? null} activeTriggers={activeTriggers.length} canManage={canManageRequirements} onOpenRequirementForm={() => setRequirementFormOpen(true)} />}{canManageRequirements ? <details open={requirementFormOpen} onToggle={(event) => setRequirementFormOpen((event.currentTarget as HTMLDetailsElement).open)} style={{ margin: 16 }}><summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#0D1117" }}>Registrar exigencia aprobada por comité</summary><form onSubmit={(event) => { event.preventDefault(); createRequirement.mutate({ projectId, ...requirementForm }); }} style={{ display: "grid", gap: 8, marginTop: 12 }}><label>Código<input required value={requirementForm.requirementCode} onChange={(event) => setRequirementForm({ ...requirementForm, requirementCode: event.target.value })} placeholder="Ej.: EXG-001" /></label><label>Prioridad<select value={requirementForm.priority} onChange={(event) => setRequirementForm({ ...requirementForm, priority: event.target.value as "P0" | "P1" | "P2" })}><option value="P0">P0 · crítico</option><option value="P1">P1 · alto</option><option value="P2">P2 · control</option></select></label><label>Exigencia<input required value={requirementForm.title} onChange={(event) => setRequirementForm({ ...requirementForm, title: event.target.value })} placeholder="Obligación acordada en comité" /></label><label>Fundamento<textarea required value={requirementForm.rationale} onChange={(event) => setRequirementForm({ ...requirementForm, rationale: event.target.value })} /></label><label>Responsable<input required value={requirementForm.ownerName} onChange={(event) => setRequirementForm({ ...requirementForm, ownerName: event.target.value })} /></label><label>Fecha límite<input required type="date" value={requirementForm.dueDate} onChange={(event) => setRequirementForm({ ...requirementForm, dueDate: event.target.value })} /></label><label>Criterio de aceptación<textarea required value={requirementForm.acceptanceCriteria} onChange={(event) => setRequirementForm({ ...requirementForm, acceptanceCriteria: event.target.value })} /></label><label>Consecuencia si no cumple<textarea required value={requirementForm.consequence} onChange={(event) => setRequirementForm({ ...requirementForm, consequence: event.target.value })} /></label><button type="submit" disabled={createRequirement.isPending} style={{ background: "#0D1117", color: "white", border: 0, borderRadius: 6, padding: "9px 12px", cursor: "pointer", fontWeight: 700 }}>{createRequirement.isPending ? "Registrando…" : "Registrar exigencia"}</button>{createRequirement.error ? <p role="alert" style={{ color: "#A8272B", fontSize: 11, margin: 0 }}>{createRequirement.error.message}</p> : null}</form></details> : null}</article><aside className="edv2-card"><div className="edv2-card-head"><h3>Plan de recuperación</h3><span>PRD</span></div><div className="edv2-evidence-panel"><p className="edv2-kpi-label">Estado actual</p><p className="edv2-evidence-value">{governance.recoveryPlan?.approvalStatus ?? "[PENDIENTE]"}</p><p className="edv2-note"><b>Regla de gobierno.</b> El PRD se publica sólo tras evaluación y archivo de evidencia; el dashboard no declara recuperación aprobada sin esos registros.</p>{canManageRequirements && openRequirements.length ? <details open={closingRequirementId != null} onToggle={(event) => { if (!(event.currentTarget as HTMLDetailsElement).open) setClosingRequirementId(null); }} style={{ marginTop: 16 }}><summary onClick={() => setClosingRequirementId(openRequirements[0]?.id ?? null)} style={{ cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#0D1117" }}>Cerrar exigencia con evidencia</summary>{closingRequirementId != null ? <form onSubmit={(event) => { event.preventDefault(); closeRequirement.mutate({ projectId, requirementId: closingRequirementId, closureEvidenceUrl: closureForm.evidenceUrl, closureNotes: closureForm.notes || undefined }); }} style={{ display: "grid", gap: 8, marginTop: 12 }}><label>Exigencia<select value={closingRequirementId} onChange={(event) => setClosingRequirementId(Number(event.target.value))}>{openRequirements.map((requirement) => <option key={requirement.id} value={requirement.id}>{requirement.requirementCode ?? requirement.code} · {requirement.title ?? requirement.description}</option>)}</select></label><label>URL de evidencia de cierre<input required type="url" value={closureForm.evidenceUrl} onChange={(event) => setClosureForm({ ...closureForm, evidenceUrl: event.target.value })} placeholder="https://…" /></label><label>Notas de validación (opcional)<textarea value={closureForm.notes} onChange={(event) => setClosureForm({ ...closureForm, notes: event.target.value })} /></label><button type="submit" disabled={closeRequirement.isPending} style={{ background: "#0D1117", color: "white", border: 0, borderRadius: 6, padding: "9px 12px", cursor: "pointer", fontWeight: 700 }}>{closeRequirement.isPending ? "Cerrando…" : "Registrar cierre"}</button>{closeRequirement.error ? <p role="alert" style={{ color: "#A8272B", fontSize: 11, margin: 0 }}>{closeRequirement.error.message}</p> : null}</form> : null}</details> : null}<p className="edv2-note" style={{ marginTop: 14 }}><b>Anulación restringida.</b> Sólo Ariel, como Gerente de Delivery asignado, puede anular una exigencia abierta y debe dejar un motivo explícito.</p></div></aside></div></section>

      <section className="edv2-section" id="remediacion"><SectionHeader number="03B" title="Remediación, descargos y escalamiento" lead="El dashboard no rellena obligaciones ni decisiones: presenta la pauta formal y deja el estado pendiente hasta que PMO registre responsables, evidencias y resoluciones." tag="acción requerida" /><div className="edv2-remediation-grid"><article className="edv2-card"><div className="edv2-card-head"><h3>Pauta del Plan de Recuperación y Descargo (PRD)</h3><span>rúbrica · 100 pts</span></div><ol className="edv2-rubric">{prdRubric.map(([code, title, detail, points]) => <li key={code}><code>{code}</code><div><h4>{title}</h4><p>{detail}</p></div><b>{points} pts<br /><small>[PENDIENTE]</small></b></li>)}</ol><p className="edv2-remediation-note"><b>Regla de evaluación:</b> aprueba con ≥ 75 puntos y ninguna sección en cero. El análisis puede precalificar, pero la nota final corresponde a Ariel, Gerente de Delivery. {(["NARANJO", "ROJO", "CRITICO"].includes(String(governance.state).toUpperCase()) || activeTriggers.length) ? " El PRD es exigible para este corte." : " El PRD se exigirá al activarse un estado NARANJO o peor, o cualquier gatillo."}</p></article><aside className="edv2-card"><div className="edv2-card-head"><h3>Marcador del PRD</h3><span>SLA · 72 h hábiles</span></div><div className="edv2-evidence-panel"><p className="edv2-kpi-label">Estado del plan</p><p className="edv2-evidence-value">{governance.recoveryPlan?.approvalStatus ?? "[PENDIENTE]"}</p><p className="edv2-note"><b>Puntaje sugerido:</b> [PENDIENTE] / 100.<br />No se crea una calificación automática sin plan, evidencias y evaluación registrada.</p></div></aside></div><div className="edv2-remediation-grid edv2-remediation-second"><article className="edv2-card"><div className="edv2-card-head"><h3>Descargos requeridos al PM</h3><span>Eduardo · respuesta escrita</span></div><ol className="edv2-questions">{responseQuestions.map((question, index) => <li key={question}><code>{String(index + 1).padStart(2, "0")}</code><p>{question}</p></li>)}</ol></article><article className="edv2-card"><div className="edv2-card-head"><h3>Escalamiento — decisiones que requieren al Gerente de Delivery</h3><span>Ariel · decisión registrada</span></div><div className="edv2-table-wrap"><table className="edv2-table"><thead><tr><th>Decisión</th><th>Alternativas</th><th>Impacto</th><th>Fecha</th></tr></thead><tbody><tr><td><b>D-01</b> Re-baseline formal</td><td>Aprobar con actas / mantener baseline</td><td>Fecha contractual</td><td>[POR CONFIRMAR]</td></tr><tr><td><b>D-02</b> Continuidad / stop-loss</td><td>Congelar / financiar continuidad</td><td>Carry y EAC</td><td>[POR CONFIRMAR]</td></tr><tr><td><b>D-03</b> Recuperación económica</td><td>Change request / descope / absorción</td><td>{commercialExposure.retainedUf == null ? "[POR CONFIRMAR]" : `${numberOrPending(commercialExposure.retainedUf, 2)} UF retenidas`}</td><td>[POR CONFIRMAR]</td></tr></tbody></table></div></article></div></section>

      <section className="edv2-section" id="operacion"><SectionHeader number="04" title="Señales operativas secundarias" lead="Jira, riesgos y capacidad se muestran como diagnóstico desaturado: pueden agravar una alerta, pero nunca mejorar el estado determinado por evidencia contractual." tag="no gobierna el estado" /><div className="edv2-operational-panels"><details className="edv2-card edv2-secondary-signal"><summary><span>Jira / backlog</span><b>{operationalEvidence.availability === "available" ? percentOrPending(operationalEvidence.issueProgressPct) : "[SIN SNAPSHOT]"}</b><i>diagnóstico · penalización solamente</i></summary><div className="edv2-operations">{operationalEvidence.availability === "available" ? <><div className="edv2-note"><b>Fuente:</b> Jira {source.jiraProjectKey} · observado {formatDate(operationalEvidence.observedAt)}. Issues: {numberOrPending(operationalEvidence.doneIssues)}/{numberOrPending(operationalEvidence.totalIssues)} terminadas; {numberOrPending(operationalEvidence.inProgressIssues)} en curso y {numberOrPending(operationalEvidence.pendingIssues)} pendientes.</div><div className="edv2-note"><b>Hitos/risgos/cambios:</b> {numberOrPending(operationalEvidence.closedMilestoneIssues)}/{numberOrPending(operationalEvidence.totalMilestoneIssues)} hitos Jira cerrados · {numberOrPending(operationalEvidence.highOpenRisks)} riesgo(s) alto(s) abiertos · {numberOrPending(operationalEvidence.scopeChanges)} cambio(s) de alcance detectado(s).</div><div className="edv2-note"><b>Regla de gobierno:</b> Jira puede activar una penalización o una pregunta de control, pero no acredita aceptación ni aumenta CHC, IGE o el estado ejecutivo.</div></> : <div className="edv2-note"><b>[POR CONFIRMAR] Jira no devolvió un snapshot utilizable.</b> La indisponibilidad no se interpreta como avance, retraso ni confiabilidad del backlog.</div>}<div className="edv2-note"><b>Vínculo contractual:</b> {milestonesLinkedToJira} de {milestones.length} hitos tienen issue Jira asociado. Esta relación no equivale a aceptación del entregable.</div></div></details><details className="edv2-card edv2-secondary-signal"><summary><span>Riesgos y gatillos</span><b>{activeTriggers.length} gatillo(s) activo(s)</b><i>riesgo adicional · no contractual</i></summary><div className="edv2-operations">{activeTriggers.length ? <ul className="edv2-trigger-list edv2-trigger-list-light">{activeTriggers.map((trigger) => <li key={trigger}><code>{trigger}</code><span>Gatillo activo calculado por el motor. La causa, dueño y mitigación requieren un registro de riesgo persistido.</span></li>)}</ul> : <div className="edv2-note"><b>[PENDIENTE] Sin gatillos activos al corte.</b> La ausencia de un registro de riesgo no se interpreta como ausencia de exposición.</div>}</div></details><details className="edv2-card edv2-secondary-signal"><summary><span>Capacity y stop-loss</span><b>[POR CONFIRMAR]</b><i>costo diario / dotación bloqueada</i></summary><div className="edv2-operations"><div className="edv2-note"><b>Insumos pendientes:</b> headcount bloqueado, tarifa diaria en UF y autorización de continuidad deben llegar desde la sincronización financiera o una evidencia aprobada. Sin esos campos no se proyecta carry ni se declara un stop-loss activo.</div></div></details></div><div className="edv2-table-wrap" style={{ marginTop: 16 }}><table className="edv2-table"><caption className="sr-only">Matriz de señales secundarias y sus límites de gobierno</caption><thead><tr><th>Señal</th><th>Lectura observada</th><th>Procedencia</th><th>Límite de gobierno</th></tr></thead><tbody>
<tr><td>Jira / backlog</td><td>{operationalEvidence.availability === "available" ? `${percentOrPending(operationalEvidence.issueProgressPct)} · ${numberOrPending(operationalEvidence.doneIssues)}/${numberOrPending(operationalEvidence.totalIssues)} issues cerradas` : "[SIN SNAPSHOT]"}</td><td>Jira {source.jiraProjectKey} · {formatDate(operationalEvidence.observedAt)}</td><td>Sólo penaliza; no acredita actas, CHC, IGE ni estado.</td></tr>
<tr><td>Riesgos y gatillos</td><td>{activeTriggers.length ? activeTriggers.join(", ") : "[PENDIENTE] sin gatillos activos"}</td><td>Motor cardinal v2 · corte {formatDate(cutoff.date)}</td><td>Exige análisis y dueño; no reemplaza evidencia contractual.</td></tr>
<tr><td>Capacity / stop-loss</td><td>[POR CONFIRMAR]</td><td>Sincronización financiera pendiente</td><td>No proyecta carry ni autoriza continuidad sin insumos aprobados.</td></tr>
</tbody></table></div></section>

      <section className="edv2-section" id="minutas"><SectionHeader number="05" title="Evidencia documental — minutas y compromisos" lead="La ausencia de minutas y compromisos es una brecha explícita de gobierno, no un dato neutral." tag="minutas / compromisos" /><div className="edv2-doc-grid"><article className="edv2-card"><div className="edv2-card-head"><h3>Cobertura de evidencia — minutas y compromisos</h3><span>corte {formatDate(cutoff.date)}</span></div><div className="edv2-evidence-panel"><p className="edv2-kpi-label">Documentos registrados</p><p className="edv2-evidence-value">{minutes.length}</p><p className="edv2-note">{minutes.length ? "Las minutas existentes alimentan la trazabilidad documental; su cobertura por semana requiere configurar la cadencia del proyecto." : "[PENDIENTE] No hay minutas registradas para este baseline. La falta de evidencia se mantiene visible."}</p>{["admin", "pmo"].includes(String(user?.role)) ? <details open={minuteFormOpen} onToggle={(event) => setMinuteFormOpen((event.currentTarget as HTMLDetailsElement).open)} style={{ marginTop: 16 }}><summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#0D1117" }}>Registrar minuta real y compromiso revisable</summary><form onSubmit={(event) => { event.preventDefault(); recordMinute.mutate({ projectId, meetingDate: minuteForm.meetingDate, title: minuteForm.title, uploadReceiptToken: minuteForm.uploadReceiptToken, commitments: minuteForm.commitmentTitle ? [{ title: minuteForm.commitmentTitle, ownerName: minuteForm.commitmentOwner || undefined, dueDate: minuteForm.commitmentDueDate || undefined }] : [] }); }} style={{ display: "grid", gap: 8, marginTop: 12 }}><label>Fecha de comité<input required type="date" value={minuteForm.meetingDate} onChange={(event) => setMinuteForm({ ...minuteForm, meetingDate: event.target.value })} /></label><label>Título<input required value={minuteForm.title} onChange={(event) => setMinuteForm({ ...minuteForm, title: event.target.value })} placeholder="Ej.: Comité ejecutivo Tanner" /></label><label>Archivo cargado<input required readOnly value={minuteForm.fileName} placeholder="Se completa al validar el archivo" /></label><label>Documento de minuta ({executiveEvidenceFormatLabel("minute")}, máx. 25 MB)<input required type="file" accept={executiveEvidenceAccept.minute} disabled={evidenceUploadFeedback.minute.isPending} onChange={(event) => { setMinuteForm((current) => ({ ...current, fileName: "", uploadReceiptToken: "" })); void uploadSelectedEvidence("minute", event.target.files?.[0], (uploaded) => setMinuteForm((current) => ({ ...current, fileName: uploaded.fileName, uploadReceiptToken: uploaded.uploadReceiptToken }))); }} /></label>{minuteForm.uploadReceiptToken ? <p className="edv2-note"><b>Archivo validado:</b> {minuteForm.fileName}. Revisa los datos antes de registrar la minuta.</p> : <p className="edv2-note">Carga el documento fuente; no se acredita cobertura hasta su registro y revisión.</p>}{evidenceUploadFeedback.minute.error ? <p role="alert" className="edv2-note" style={{ color: "#A8272B" }}>{evidenceUploadFeedback.minute.error}</p> : null}{evidenceUploadFeedback.minute.notice ? <p className="edv2-note" style={{ color: "#007A70" }}>{evidenceUploadFeedback.minute.notice}</p> : null}<label>Compromiso revisado (opcional)<input value={minuteForm.commitmentTitle} onChange={(event) => setMinuteForm({ ...minuteForm, commitmentTitle: event.target.value })} placeholder="No se extrae automáticamente" /></label>{minuteForm.commitmentTitle ? <><label>Dueño<input value={minuteForm.commitmentOwner} onChange={(event) => setMinuteForm({ ...minuteForm, commitmentOwner: event.target.value })} /></label><label>Fecha comprometida<input type="date" value={minuteForm.commitmentDueDate} onChange={(event) => setMinuteForm({ ...minuteForm, commitmentDueDate: event.target.value })} /></label></> : null}<button type="submit" disabled={!minuteForm.meetingDate || !minuteForm.title.trim() || !minuteForm.uploadReceiptToken || evidenceUploadFeedback.minute.isPending || recordMinute.isPending} style={{ background: "#0D1117", color: "white", border: 0, borderRadius: 6, padding: "9px 12px", cursor: "pointer", fontWeight: 700 }}>{recordMinute.isPending ? "Registrando…" : "Registrar evidencia"}</button>{recordMinute.error ? <p role="alert" style={{ color: "#A8272B", fontSize: 11, margin: 0 }}>{friendlyEvidenceError(recordMinute.error)}</p> : null}</form></details> : <p className="edv2-note" style={{ marginTop: 14 }}><b>Registro restringido.</b> PMO o Administración debe incorporar una minuta real; la vista sólo consulta evidencia aprobada.</p>}</div></article><article className="edv2-card"><div className="edv2-card-head"><h3>Compromisos extraídos de las minutas</h3><span>extracto revisable</span></div>{commitments.length ? <ol className="edv2-list">{commitments.slice(0, 5).map((commitment, index) => <li key={commitment.id}><code>C-{String(index + 1).padStart(2, "0")}</code><div><h4>{commitment.literalText ?? commitment.description ?? commitment.title ?? "[POR CONFIRMAR]"}</h4><p>Dueño: {commitment.ownerName ?? "[POR CONFIRMAR]"} · fecha: {formatDate(commitment.dueDate)}</p></div><span className="edv2-chip muted">{commitment.commitmentStatus ?? "ABIERTO"}</span></li>)}</ol> : <div className="edv2-empty"><b>[PENDIENTE] Sin compromisos extraídos.</b><br />Se habilitarán sólo después de cargar y revisar una minuta real.</div>}</article><article className="edv2-card" style={{ gridColumn: "1 / -1" }}><div className="edv2-card-head"><h3>Cobertura de evidencia — semanas desde kickoff</h3><span>baseline a corte observado</span></div><div className="edv2-evidence-panel"><p className="edv2-kpi-label">Semanas revisadas / exigibles</p><p className="edv2-evidence-value">{minutesCoverage.expectedWeeks == null ? "[POR CONFIRMAR]" : `${minutesCoverage.reviewedWeeks}/${minutesCoverage.expectedWeeks}`}</p><p className="edv2-note">{minutesCoverage.expectedWeeks == null ? "[PENDIENTE] No existe una fecha de baseline suficiente para calcular semanas exigibles." : `Cobertura revisada: ${minutesCoverage.coveragePct ?? 0}%. Las minutas recibidas sin revisión no mejoran esta métrica.`}</p><p className="edv2-note" style={{ marginTop: 10 }}><b>Brecha consecutiva:</b> {minutesCoverage.consecutiveGapWeeks == null ? "[POR CONFIRMAR]" : `${minutesCoverage.consecutiveGapWeeks} semana(s)`} · <b>recibidas sin revisión:</b> {minutesCoverage.receivedUnreviewedWeeks} · <b>semanas faltantes:</b> {minutesCoverage.missingWeeks?.length ? `${minutesCoverage.missingWeeks.slice(0, 6).join(", ")}${minutesCoverage.missingWeeks.length > 6 ? "…" : ""}` : "[NINGUNA]"}.</p></div></article></div></section>

      <section className="edv2-section" id="coherencia-narrativa"><SectionHeader number="05A" title="Coherencia narrativa" lead="El relato ejecutivo se sostiene sólo con documentos y compromisos registrados; los vacíos se declaran como evidencia pendiente." tag="contraste documental" /><article className="edv2-card"><div className="edv2-evidence-panel"><p className="edv2-kpi-label">Estado de contraste</p><p className="edv2-evidence-value">{minutes.length === 0 ? "[PENDIENTE]" : commitments.length ? "REVISABLE" : "EVIDENCIA PARCIAL"}</p><p className="edv2-note">{minutes.length === 0 ? "No existe una minuta real para contrastar hitos, compromisos, riesgos o decisiones. El dashboard no infiere una narrativa favorable ni una causa sin evidencia documental." : commitments.length ? `Hay ${minutes.length} minuta(s) y ${commitments.length} compromiso(s) registrados. La coherencia queda sujeta a la revisión de PMO contra sus fuentes vinculadas.` : `Hay ${minutes.length} minuta(s) registrada(s), pero no hay compromisos revisados. La coherencia narrativa permanece parcial hasta que PMO valide responsables, plazos y decisiones.`}</p></div></article></section>

    {canManageRequirements ? <section className="edv2-section" id="preclasificacion" aria-labelledby="preclasificacion-title"><div className="edv2-wrap"><div className="edv2-card" style={{ padding: 16, borderLeft: "3px solid #00B3A4" }}><p className="edv2-eyebrow">Revisión documental · no persistente</p><h2 id="preclasificacion-title" style={{ fontSize: 16, margin: "5px 0" }}>Preclasificar compromisos antes de registrarlos</h2><p className="edv2-note">Pegue el texto de una minuta real. El sistema sólo propone frases explícitas y no guarda el texto, evidencia ni compromiso. Revise y traslade manualmente cada candidato al registro formal.</p><textarea aria-label="Texto de minuta para preclasificar" value={minuteRawText} onChange={(event) => setMinuteRawText(event.target.value)} placeholder="Pegar extracto de minuta real (mínimo 20 caracteres)…" style={{ width: "100%", minHeight: 84, marginTop: 8 }} /><button type="button" disabled={minuteRawText.trim().length < 20 || previewCommitments.isPending} onClick={() => previewCommitments.mutate({ projectId, rawText: minuteRawText })} style={{ background: "#0D1117", color: "#fff", border: 0, borderRadius: 6, padding: "9px 12px", cursor: "pointer", fontWeight: 700, marginTop: 8 }}>{previewCommitments.isPending ? "Preclasificando…" : "Preclasificar sin guardar"}</button>{previewCommitments.error ? <p role="alert" style={{ color: "#A8272B", fontSize: 11 }}>{previewCommitments.error.message}</p> : null}{commitmentPreviews.length ? <ol className="edv2-list" style={{ marginTop: 12 }}>{commitmentPreviews.map((candidate, index) => <li key={`${candidate.title}-${index}`}><code>PROP-{String(index + 1).padStart(2, "0")}</code><div><h4>{candidate.title}</h4><p>Dueño sugerido: {candidate.ownerName ?? "[POR CONFIRMAR]"} · fecha sugerida: {candidate.dueDate ?? "[POR CONFIRMAR]"}</p></div><button type="button" onClick={() => { setMinuteForm({ ...minuteForm, commitmentTitle: candidate.title, commitmentOwner: candidate.ownerName ?? "", commitmentDueDate: candidate.dueDate ?? "" }); setMinuteFormOpen(true); }} style={{ border: "1px solid #00B3A4", background: "#fff", color: "#0D1117", borderRadius: 6, padding: "6px 8px", cursor: "pointer", fontWeight: 700 }}>Revisar en registro</button></li>)}</ol> : null}</div></div></section> : null}

      <section className="edv2-section" id="perspectivas"><SectionHeader number="06" title="Vistas derivadas" lead="Cada rol interpreta el mismo corte con un foco distinto; ninguna vista altera la evidencia contractual ni el estado ejecutivo." tag="CFO / comercial / CTO" /><div className="edv2-card edv2-derived"><div className="edv2-tablist" role="tablist" aria-label="Perspectivas ejecutivas">{([{ id: "cfo", label: "Perspectiva CFO" }, { id: "commercial", label: "Dirección Comercial" }, { id: "cto", label: "Perspectiva CTO" }] as const).map((view) => <button key={view.id} id={`tab-${view.id}`} role="tab" type="button" aria-selected={derivedView === view.id} aria-controls={`panel-${view.id}`} tabIndex={derivedView === view.id ? 0 : -1} className={derivedView === view.id ? "active" : ""} onClick={() => setDerivedView(view.id)} onKeyDown={(event) => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { const ids = ["cfo", "commercial", "cto"] as const; const next = (ids.indexOf(derivedView) + (event.key === "ArrowRight" ? 1 : ids.length - 1)) % ids.length; setDerivedView(ids[next]); } }}>{view.label}</button>)}</div>
        {<ExecutiveDerivedPerspectivePanel view={derivedView} metrics={{
          cfo: {
            cv: financialEvidence.impact.cvUf == null ? "[POR CONFIRMAR]" : `${numberOrPending(financialEvidence.impact.cvUf, 2)} UF`,
            cpiH: financialEvidence.impact.cpiH == null ? "[POR CONFIRMAR]" : numberOrPending(financialEvidence.impact.cpiH, 2),
            totalDamage: financialEvidence.impact.totalDamageUf == null ? "[POR CONFIRMAR]" : `${numberOrPending(financialEvidence.impact.totalDamageUf, 2)} UF`,
          },
          commercial: {
            acceptedBilling: formatUfOrNd(projectFinance?.overview?.acceptedUf),
            mismatch: commercialExposure.mismatchPp == null ? "[POR CONFIRMAR]" : `${numberOrPending(commercialExposure.mismatchPp, 1)} pp`,
            retainedUf: commercialExposure.retainedUf == null ? "[POR CONFIRMAR]" : `${numberOrPending(commercialExposure.retainedUf, 2)} UF`,
          },
          cto: {
            linkedMilestones: `${milestonesLinkedToJira}/${milestones.length}`,
            overdue: numberOrPending(contractual.openOverdueCount),
            reliableBacklog: "[POR CONFIRMAR]",
          },
        }} />}
      </div></section>

      <section className="edv2-section" id="trazabilidad"><SectionHeader number="07" title="Trazabilidad del corte" lead="El resultado sólo es reproducible si conserva la fuente, la versión y los vacíos de información." tag="auditable" /><div className="edv2-card"><div className="edv2-table-wrap"><table className="edv2-table"><thead><tr><th>Elemento</th><th>Fuente</th><th>Versión / estado</th><th>Corte</th></tr></thead><tbody><tr><td>Baseline contractual</td><td>SoW</td><td>{source.baselineVersion} · {source.sourceStatus}</td><td>{formatDate(cutoff.date)}</td></tr><tr><td>Hitos operativos</td><td>Jira</td><td>{source.jiraProjectKey} · sólo diagnóstico</td><td>{formatDate(cutoff.date)}</td></tr><tr><td>Finanzas</td><td>Sincronización / snapshot</td><td>{financialEvidence.source ?? "[POR CONFIRMAR]"}</td><td>{cutoff.productionSnapshotId ? "snapshot persistido" : "[PENDIENTE] snapshot productivo"}</td></tr><tr><td>Motor de gobierno</td><td>Determinista</td><td>Cardinal v2 · sin ponderación comercial</td><td>{formatDate(cutoff.date)}</td></tr></tbody></table></div></div></section>
    </div>
    <section className="edv2-section" id="prd"><div className="edv2-wrap"><SectionHeader number="03C" title="PRD versionado y aprobación" lead="Un plan de recuperación no queda vigente por su carga: requiere evidencia, fecha y aprobación explícita del Gerente de Delivery asignado." tag="control de remediación" /><div className="edv2-two-col"><article className="edv2-card"><div className="edv2-card-head"><h3>Versiones del PRD</h3><span>{recoveryPlans.length} registrada(s)</span></div>{recoveryPlans.length ? <ol className="edv2-list">{recoveryPlans.slice(0, 5).map((plan) => <li key={plan.id}><code>PRD-{plan.version}</code><div><h4>{plan.fileUrl ? <a href={plan.fileUrl} target="_blank" rel="noreferrer">{plan.fileName || "Abrir evidencia"}</a> : "[POR CONFIRMAR]"}</h4><p>Vence: {formatDate(plan.dueDate)} · registrado: {formatDate(plan.createdAt)} · {plan.summary || "[POR CONFIRMAR]"}</p></div><span className={`edv2-chip ${plan.recoveryStatus === "vigente" ? "ok" : "warn"}`}>{String(plan.recoveryStatus ?? "draft").toUpperCase()}</span></li>)}</ol> : <div className="edv2-empty"><b>[PENDIENTE] Sin PRD persistido.</b><br />No se declara una recuperación vigente sin versión, evidencia documental y aprobación formal.</div>}{canManageRequirements ? <details open={recoveryPlanFormOpen} onToggle={(event) => setRecoveryPlanFormOpen((event.currentTarget as HTMLDetailsElement).open)} style={{ margin: 16 }}><summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#0D1117" }}>Registrar versión real del PRD</summary><form onSubmit={(event) => { event.preventDefault(); recordRecoveryPlan.mutate({ projectId, version: recoveryPlanForm.version, dueDate: recoveryPlanForm.dueDate, uploadReceiptToken: recoveryPlanForm.uploadReceiptToken, summary: recoveryPlanForm.summary }); }} style={{ display: "grid", gap: 8, marginTop: 12 }}><label>Versión<input required value={recoveryPlanForm.version} onChange={(event) => setRecoveryPlanForm({ ...recoveryPlanForm, version: event.target.value })} placeholder="Ej.: v1.0" /></label><label>Fecha de compromiso<input required type="date" value={recoveryPlanForm.dueDate} onChange={(event) => setRecoveryPlanForm({ ...recoveryPlanForm, dueDate: event.target.value })} /></label><label>Archivo cargado<input required readOnly value={recoveryPlanForm.fileName} placeholder="Se completa al validar el archivo" /></label><label>Documento PRD ({executiveEvidenceFormatLabel("recovery_plan")}, máx. 25 MB)<input required type="file" accept={executiveEvidenceAccept.recovery_plan} disabled={evidenceUploadFeedback.recovery_plan.isPending} onChange={(event) => { setRecoveryPlanForm((current) => ({ ...current, fileName: "", uploadReceiptToken: "" })); void uploadSelectedEvidence("recovery_plan", event.target.files?.[0], (uploaded) => setRecoveryPlanForm((current) => ({ ...current, fileName: uploaded.fileName, uploadReceiptToken: uploaded.uploadReceiptToken }))); }} /></label>{recoveryPlanForm.uploadReceiptToken ? <p className="edv2-note"><b>Archivo validado:</b> {recoveryPlanForm.fileName}. La aprobación de Delivery sigue siendo obligatoria.</p> : <p className="edv2-note">Carga el PRD real; no se vuelve vigente sólo por almacenarlo.</p>}{evidenceUploadFeedback.recovery_plan.error ? <p role="alert" className="edv2-note" style={{ color: "#A8272B" }}>{evidenceUploadFeedback.recovery_plan.error}</p> : null}{evidenceUploadFeedback.recovery_plan.notice ? <p className="edv2-note" style={{ color: "#007A70" }}>{evidenceUploadFeedback.recovery_plan.notice}</p> : null}<label>Resumen ejecutivo<textarea required value={recoveryPlanForm.summary} onChange={(event) => setRecoveryPlanForm({ ...recoveryPlanForm, summary: event.target.value })} placeholder="Alcance, recuperación esperada, dependencias y riesgos." /></label><button type="submit" disabled={!recoveryPlanForm.version.trim() || !recoveryPlanForm.dueDate || !recoveryPlanForm.uploadReceiptToken || !recoveryPlanForm.summary.trim() || evidenceUploadFeedback.recovery_plan.isPending || recordRecoveryPlan.isPending} style={{ background: "#0D1117", color: "white", border: 0, borderRadius: 6, padding: "9px 12px", cursor: "pointer", fontWeight: 700 }}>{recordRecoveryPlan.isPending ? "Registrando…" : "Registrar borrador PRD"}</button>{recordRecoveryPlan.error ? <p role="alert" style={{ color: "#A8272B", fontSize: 11, margin: 0 }}>{friendlyEvidenceError(recordRecoveryPlan.error)}</p> : null}</form></details> : null}</article><aside className="edv2-card"><div className="edv2-card-head"><h3>Aprobación de Delivery</h3><span>Ariel · rol asignado</span></div><div className="edv2-evidence-panel"><p className="edv2-kpi-label">Plan vigente</p><p className="edv2-evidence-value">{activeRecoveryPlan ? `${activeRecoveryPlan.version} · ${String(activeRecoveryPlan.recoveryStatus).toUpperCase()}` : "[PENDIENTE]"}</p><p className="edv2-note">Sólo el Gerente de Delivery asignado puede aprobar un borrador con evidencia documental validada y fecha de compromiso. Una versión vigente anterior se reemplaza con trazabilidad.</p>{canApproveRecoveryPlan && activeRecoveryPlan?.recoveryStatus === "draft" ? <><button type="button" disabled={approveRecoveryPlan.isPending} onClick={() => approveRecoveryPlan.mutate({ projectId, planId: activeRecoveryPlan.id })} style={{ background: "#00B3A4", color: "#0D1117", border: 0, borderRadius: 6, padding: "9px 12px", cursor: "pointer", fontWeight: 800, marginTop: 12 }}>{approveRecoveryPlan.isPending ? "Aprobando…" : "Aprobar PRD vigente"}</button>{approveRecoveryPlan.error ? <p role="alert" style={{ color: "#A8272B", fontSize: 11 }}>{approveRecoveryPlan.error.message}</p> : null}</> : <p className="edv2-note" style={{ marginTop: 14 }}><b>{activeRecoveryPlan?.recoveryStatus === "vigente" ? "PRD vigente con aprobación registrada." : "Acción pendiente:"}</b> {canApproveRecoveryPlan ? " primero debe existir un borrador completo." : " la aprobación queda reservada al Gerente de Delivery asignado."}</p>}</div></aside></div></div></section>
    {canWaiveRequirements && openRequirements.length ? <section className="edv2-section" id="anulacion-exigencia"><div className="edv2-wrap"><SectionHeader number="03D" title="Anulación excepcional de exigencia" lead="Esta acción no reemplaza un cierre evidenciado. Sólo Ariel, Gerente de Delivery asignado, puede anular una exigencia abierta y debe dejar el motivo de gobierno." tag="acceso restringido" /><article className="edv2-card"><div className="edv2-evidence-panel"><p className="edv2-note"><b>Control irreversible de estado:</b> la anulación conserva la exigencia, su responsable y el motivo en la bitácora. No elimina evidencia ni declara cumplimiento.</p><form onSubmit={(event) => { event.preventDefault(); if (waivingRequirementId != null) waiveRequirement.mutate({ projectId, requirementId: waivingRequirementId, reason: waiverReason }); }} style={{ display: "grid", gap: 8, marginTop: 14, maxWidth: 720 }}><label>Exigencia abierta<select required value={waivingRequirementId ?? ""} onChange={(event) => setWaivingRequirementId(event.target.value ? Number(event.target.value) : null)}><option value="">Seleccionar exigencia</option>{openRequirements.map((requirement) => <option key={requirement.id} value={requirement.id}>{requirement.requirementCode ?? requirement.code ?? `EXG-${requirement.id}`} · {requirement.title ?? requirement.description}</option>)}</select></label><label>Motivo de anulación<textarea required minLength={3} value={waiverReason} onChange={(event) => setWaiverReason(event.target.value)} placeholder="Motivo aprobado por Delivery y referencia de la decisión de comité." /></label><button type="submit" disabled={waiveRequirement.isPending || waivingRequirementId == null || waiverReason.trim().length < 3} style={{ background: "#A8272B", color: "white", border: 0, borderRadius: 6, padding: "9px 12px", cursor: "pointer", fontWeight: 800 }}>{waiveRequirement.isPending ? "Anulando…" : "Registrar anulación con motivo"}</button>{waiveRequirement.error ? <p role="alert" style={{ color: "#A8272B", fontSize: 11, margin: 0 }}>{waiveRequirement.error.message}</p> : null}</form></div></article></div></section> : null}
    </div></div>
    <footer className="edv2-footer"><div className="edv2-wrap"><span><b>Prodigio · Dashboard Ejecutivo v2</b> · evidencia contractual primero</span><span>SoW {source.baselineVersion} · Deal {source.dealId} · Jira {source.jiraProjectKey}</span></div></footer>
  </main>;
}
