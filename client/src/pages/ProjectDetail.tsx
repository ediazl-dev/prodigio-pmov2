import AppBreadcrumb from "@/components/AppBreadcrumb";
import { BaselineExecutiveCard } from "@/components/BaselineExecutiveCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  AlertCircle,
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  History,
  Loader2,
  Lock,
  Pause,
  Play,
  Shield,
  Sparkles,
  Timer,
  Trash2,
  Unlink,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";

/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS — unified navy/light palette
   ═══════════════════════════════════════════════════════════════ */
const C = {
  navy: "#0B1A2E",
  navy2: "#132B4A",
  blue: "#1E6091",
  blue2: "#2980B9",
  teal: "#0D9488",
  gold: "#D4A017",
  red: "#DC2626",
  green: "#059669",
  accent: "#e91e8c",
  bg: "#F4F7FB",
  cardBg: "#FFFFFF",
  textPrimary: "#1E293B",
  textSecondary: "#64748B",
  textMuted: "#94A3B8",
  border: "#E2E8F0",
};

const STAGES = [
  { id: "sow", label: "Elaboración SoW", sublabel: "Statement of Work", icon: FileText, color: "#e91e8c", path: "sow" },
  { id: "jira", label: "Creación Jira", sublabel: "Configuración del Proyecto", icon: FolderKanban, color: "#3b82f6", path: "jira" },
  { id: "risks", label: "Riesgos y Acta", sublabel: "Matriz de Riesgos", icon: Shield, color: "#f59e0b", path: "risks" },
  { id: "planning", label: "Planificación", sublabel: "WBS y Hitos", icon: Clock, color: "#10b981", path: "planning" },
  { id: "design", label: "Avance Proyecto", sublabel: "Dashboard Ejecutivo", icon: Wrench, color: "#06b6d4", path: "linked-dashboard" },
  { id: "closure", label: "Cierre", sublabel: "Lecciones Aprendidas", icon: CheckCircle2, color: "#8b5cf6", path: "closure" },
];

const STATUS_CONFIG: Record<string, { label: string; bg: string; fg: string }> = {
  activo: { label: "Activo", bg: "#DCFCE7", fg: "#166534" },
  pausado: { label: "Pausado", bg: "#FEF3C7", fg: "#92400E" },
  completado: { label: "Completado", bg: "#DBEAFE", fg: "#1E40AF" },
  cancelado: { label: "Cancelado", bg: "#FEE2E2", fg: "#991B1B" },
};

type ModalType = "pause" | "resume" | "extend" | "history" | null;

/* ─── Health Indicator (Semáforo) ─── */
function HealthIndicator({ completedCount, totalStages, timeData }: {
  completedCount: number; totalStages: number; timeData: any[] | undefined;
}) {
  const health = useMemo(() => {
    let score = 0;
    // Progress: completed stages ratio
    const progressPct = totalStages > 0 ? (completedCount / totalStages) * 100 : 0;
    if (progressPct >= 60) score += 2; else if (progressPct >= 30) score += 1;
    // Time: check if any stage is overdue
    const overdueCount = (timeData ?? []).filter((t: any) => t.status === "overdue").length;
    const warningCount = (timeData ?? []).filter((t: any) => t.status === "warning" || t.status === "caution").length;
    if (overdueCount === 0 && warningCount === 0) score += 2;
    else if (overdueCount === 0) score += 1;
    // Active stages health
    const inProgressCount = (timeData ?? []).filter((t: any) => t.status === "on_track" || t.status === "completed").length;
    const totalActive = (timeData ?? []).filter((t: any) => t.status !== "not_started").length;
    if (totalActive > 0 && inProgressCount / totalActive >= 0.7) score += 2;
    else if (totalActive > 0 && inProgressCount / totalActive >= 0.4) score += 1;

    if (score >= 5) return { cls: "verde", label: "SALUDABLE", color: "#27AE60", bgLight: "#E8F5E9" };
    if (score >= 3) return { cls: "amarillo", label: "EN RIESGO", color: "#F39C12", bgLight: "#FFF8E1" };
    return { cls: "rojo", label: "ATRASADO", color: "#E53935", bgLight: "#FFEBEE" };
  }, [completedCount, totalStages, timeData]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
      {/* Mini semáforo */}
      <div style={{
        background: "#111827", borderRadius: 8, padding: "5px 6px",
        display: "flex", gap: 4, alignItems: "center",
        border: "1px solid #1F2937", boxShadow: "0 1px 4px rgba(0,0,0,.3)",
      }}>
        {["rojo", "amarillo", "verde"].map(c => (
          <div key={c} style={{
            width: 14, height: 14, borderRadius: "50%",
            background: health.cls === c
              ? (c === "verde" ? "#27AE60" : c === "amarillo" ? "#F39C12" : "#E53935")
              : "#1F2937",
            boxShadow: health.cls === c
              ? `0 0 8px ${c === "verde" ? "rgba(39,174,96,.7)" : c === "amarillo" ? "rgba(243,156,18,.7)" : "rgba(229,57,53,.7)"}`
              : "none",
            transition: "all .4s",
          }} />
        ))}
      </div>
      <span style={{
        fontSize: 10, fontWeight: 700, padding: "2px 10px", borderRadius: 20,
        background: health.bgLight, color: health.color, letterSpacing: ".05em",
      }}>
        {health.label}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function ProjectDetail() {
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const role = (user as any)?.role ?? "consulta";
  const canManage = ["admin", "pmo"].includes(role);
  const canManageBaseline = ["admin", "pmo", "pm"].includes(role);

  const { data, isLoading } = trpc.projects.get.useQuery({ id: projectId });
  const { data: timeData, refetch: refetchTime } = trpc.stageOpenings.timeRemaining.useQuery({ projectId });
  const recordOpening = trpc.stageOpenings.recordOpening.useMutation();

  const [modalType, setModalType] = useState<ModalType>(null);
  const [selectedStage, setSelectedStage] = useState<string>("");
  const [reason, setReason] = useState("");
  const [extraDays, setExtraDays] = useState(5);

  const { data: historyData, refetch: refetchHistory } = trpc.extensions.history.useQuery(
    { projectId, stageId: selectedStage as any },
    { enabled: modalType === "history" && !!selectedStage }
  );

  const pauseMutation = trpc.extensions.pause.useMutation({
    onSuccess: () => { toast.success("Etapa pausada correctamente"); setModalType(null); setReason(""); refetchTime(); },
    onError: (e) => toast.error(e.message),
  });
  const resumeMutation = trpc.extensions.resume.useMutation({
    onSuccess: () => { toast.success("Etapa reanudada correctamente"); setModalType(null); setReason(""); refetchTime(); },
    onError: (e) => toast.error(e.message),
  });
  const extendMutation = trpc.extensions.extend.useMutation({
    onSuccess: () => { toast.success("Plazo extendido correctamente"); setModalType(null); setReason(""); setExtraDays(5); refetchTime(); },
    onError: (e) => toast.error(e.message),
  });

  const openModal = (type: ModalType, stageId: string) => {
    setSelectedStage(stageId);
    setModalType(type);
    setReason("");
    setExtraDays(5);
    if (type === "history") refetchHistory();
  };

  const handlePause = () => { if (!reason.trim()) { toast.error("Ingresa un motivo"); return; } pauseMutation.mutate({ projectId, stageId: selectedStage as any, reason }); };
  const handleResume = () => { if (!reason.trim()) { toast.error("Ingresa un motivo"); return; } resumeMutation.mutate({ projectId, stageId: selectedStage as any, reason }); };
  const handleExtend = () => { if (!reason.trim()) { toast.error("Ingresa un motivo"); return; } if (extraDays < 1) { toast.error("Los días extra deben ser al menos 1"); return; } extendMutation.mutate({ projectId, stageId: selectedStage as any, extraDays, reason }); };

  /* ── Loading skeleton ── */
  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Inter', sans-serif" }}>
        <div style={{ background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navy2} 100%)`, padding: "32px 0 28px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
            <div style={{ height: 20, width: 200, background: "rgba(255,255,255,.12)", borderRadius: 6 }} />
            <div style={{ height: 32, width: 400, background: "rgba(255,255,255,.12)", borderRadius: 8, marginTop: 12 }} />
          </div>
        </div>
        <div style={{ maxWidth: 1100, margin: "-20px auto 0", padding: "0 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
            {[1,2,3,4,5,6].map(i => <div key={i} style={{ height: 80, background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,.06)" }} />)}
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ color: C.textSecondary, fontSize: 14 }}>Proyecto no encontrado</p>
          <Button variant="outline" className="mt-4" onClick={() => setLocation("/projects")}>Volver a Proyectos</Button>
        </div>
      </div>
    );
  }

  const isLinked = (data as any).origin === "linked";
  const stagesMap = Object.fromEntries((data.stages ?? []).map((s: any) => [s.stageId, s]));
  const status = STATUS_CONFIG[data.status] ?? STATUS_CONFIG.activo;
  const activeStage = STAGES.find((s) => stagesMap[s.id]?.status === "in_progress") ?? STAGES[0];
  const completedCount = STAGES.filter((s) => stagesMap[s.id]?.status === "completed").length;
  const overallProgress = Math.round((completedCount / STAGES.length) * 100);
  const selectedStageLabel = STAGES.find((s) => s.id === selectedStage)?.label ?? selectedStage;

  /* ═══════════════════════════════════════════════════════════════
     LINKED PROJECT VIEW
     ═══════════════════════════════════════════════════════════════ */
  if (isLinked) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Inter', sans-serif" }}>
        {/* Navy Header */}
        <div style={{ background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navy2} 100%)`, padding: "28px 0 32px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
            <AppBreadcrumb segments={[
              { label: "PMO Proyectos", href: "/projects" },
              { label: data.projectName },
            ]} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 14, flexWrap: "wrap", gap: 16 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", fontFamily: "'Poppins', 'Inter', sans-serif", lineHeight: 1.2 }}>
                    {data.projectName}
                  </h1>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: status.bg, color: status.fg }}>
                    {status.label}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "rgba(139,92,246,.2)", color: "#c4b5fd" }}>
                    Vinculado
                  </span>
                </div>
                <p style={{ color: "rgba(255,255,255,.6)", fontSize: 13, marginTop: 4 }}>{data.clientName}</p>
                {data.clientEmail && <p style={{ color: "rgba(255,255,255,.4)", fontSize: 11, marginTop: 2 }}>{data.clientEmail}</p>}
              </div>
              <div style={{ textAlign: "right" }}>
                {data.totalAmount && (
                  <p style={{ fontSize: 26, fontWeight: 800, color: C.teal, fontFamily: "'Poppins', 'Inter', sans-serif" }}>
                    {data.currency} {Number(data.totalAmount).toLocaleString()}
                  </p>
                )}
                {data.projectType && <span style={{ fontSize: 11, color: "rgba(255,255,255,.5)", textTransform: "capitalize" }}>{data.projectType}</span>}
              </div>
            </div>
            {/* JIRA link */}
            {data.jiraProjectUrl && (
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <FolderKanban style={{ width: 14, height: 14, color: "#60a5fa" }} />
                <a href={data.jiraProjectUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#60a5fa", textDecoration: "none" }}>
                  {data.jiraProjectKey} — Ver en Jira
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div style={{ maxWidth: 1100, margin: "-16px auto 0", padding: "0 24px 40px" }}>
          {/* Dashboard Ejecutivo CTA */}
          <div style={{
            background: C.cardBg, borderRadius: 14, padding: "18px 24px", display: "flex", alignItems: "center", gap: 14,
            boxShadow: "0 2px 16px rgba(10,22,40,.08)", border: `1px solid ${C.border}`, marginBottom: 20,
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #7c3aed, #06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <FolderKanban style={{ width: 18, height: 18, color: "#fff" }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>Proyecto Vinculado — Dashboard Ejecutivo</p>
              <p style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>
                Este proyecto fue vinculado desde JIRA. Accede al dashboard ejecutivo que integra datos JIRA y financieros en tiempo real.
              </p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
              {projectId === 180002 && <Button size="sm" onClick={() => setLocation(`/projects/${projectId}/executive-dashboard-v2`)}
                style={{ background: "#e91e8c", color: "#fff", border: "none", fontWeight: 700, fontSize: 12, padding: "8px 18px", borderRadius: 8 }}>
                Dashboard Ejecutivo v2
              </Button>}
              <Button size="sm" variant="outline" onClick={() => setLocation(`/projects/${projectId}/linked-dashboard`)}
                style={{ color: "#4b5563", borderColor: C.border, fontWeight: 600, fontSize: 12, padding: "8px 14px", borderRadius: 8 }}>
                Dashboard heredado
              </Button>
            </div>
          </div>

          {/* Baseline Ejecutivo */}
          <BaselineExecutiveCard projectId={projectId} canManage={canManageBaseline} />
          {/* Documents */}
          <LinkedProjectDocuments projectId={projectId} canManage={canManage} />

          {/* Unlink */}
          {canManage && <div style={{ marginTop: 20 }}><UnlinkSection projectId={projectId} projectName={data.projectName} /></div>}
        </div>

        {/* Footer */}
        <div style={{ background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navy2} 100%)`, padding: "16px 24px", textAlign: "center" }}>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,.3)", letterSpacing: 1 }}>PRODIGIO TECH · PMO PLATFORM</p>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     NORMAL PROJECT VIEW (6-stage pipeline)
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Inter', sans-serif" }}>
      {/* ── Navy Header ── */}
      <div style={{ background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navy2} 100%)`, padding: "28px 0 40px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
          <AppBreadcrumb segments={[
            { label: "PMO Proyectos", href: "/projects" },
            { label: data.projectName },
          ]} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 14, flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", fontFamily: "'Poppins', 'Inter', sans-serif", lineHeight: 1.2 }}>
                  {data.projectName}
                </h1>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: status.bg, color: status.fg }}>
                  {status.label}
                </span>
              </div>
              <p style={{ color: "rgba(255,255,255,.6)", fontSize: 13, marginTop: 4 }}>{data.clientName}</p>
              {data.clientEmail && <p style={{ color: "rgba(255,255,255,.4)", fontSize: 11, marginTop: 2 }}>{data.clientEmail}</p>}
            </div>
            <div style={{ textAlign: "right" }}>
              {data.totalAmount && (
                <p style={{ fontSize: 26, fontWeight: 800, color: C.teal, fontFamily: "'Poppins', 'Inter', sans-serif" }}>
                  {data.currency} {Number(data.totalAmount).toLocaleString()}
                </p>
              )}
              {data.projectType && <span style={{ fontSize: 11, color: "rgba(255,255,255,.5)", textTransform: "capitalize" }}>{data.projectType}</span>}
            </div>
          </div>

          {/* Progress bar in header */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,.5)", fontWeight: 600, letterSpacing: 0.5 }}>PROGRESO GENERAL</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.teal }}>{overallProgress}%</span>
            </div>
            <div style={{ height: 6, background: "rgba(255,255,255,.1)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 4, transition: "width 0.7s", width: `${overallProgress}%`, background: `linear-gradient(90deg, ${C.accent}, ${C.blue2})` }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,.4)" }}>{completedCount} de {STAGES.length} etapas completadas</span>
              {data.jiraProjectUrl && (
                <a href={data.jiraProjectUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: "#60a5fa", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                  <FolderKanban style={{ width: 12, height: 12 }} /> {data.jiraProjectKey} — Ver en Jira
                </a>
              )}
            </div>
            {/* Health Indicator */}
            <HealthIndicator completedCount={completedCount} totalStages={STAGES.length} timeData={timeData} />
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ maxWidth: 1100, margin: "-20px auto 0", padding: "0 24px 40px" }}>

        {/* ── Pipeline Bar ── */}
        <div style={{
          background: C.cardBg, borderRadius: 14, padding: 14, boxShadow: "0 2px 16px rgba(10,22,40,.08)",
          display: "flex", gap: 6, overflowX: "auto", marginBottom: 24,
        }}>
          {STAGES.map((stage, idx) => {
            const stageData = stagesMap[stage.id];
            const stageStatus = stageData?.status ?? "locked";
            const isLocked = stageStatus === "locked";
            const isCompleted = stageStatus === "completed";
            const isActive = activeStage.id === stage.id;
            const timeInfo = timeData?.find((t: any) => t.stageId === stage.id);

            return (
              <button
                key={stage.id}
                onClick={() => {
                  if (!isLocked) {
                    recordOpening.mutate({ projectId, stageId: stage.id as any });
                    setLocation(`/projects/${projectId}/${stage.path}`);
                  }
                }}
                disabled={isLocked}
                style={{
                  flex: 1, minWidth: 100, borderRadius: 10, padding: "10px 8px", textAlign: "center",
                  border: isActive ? `2px solid ${stage.color}` : `1px solid ${isCompleted ? "#d1fae5" : C.border}`,
                  background: isCompleted ? "#f0fdf4" : isActive ? `${stage.color}08` : isLocked ? "#f8fafc" : C.cardBg,
                  opacity: isLocked ? 0.45 : 1,
                  cursor: isLocked ? "not-allowed" : "pointer",
                  transition: "all 0.2s",
                }}
              >
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
                  {isLocked ? <Lock style={{ width: 16, height: 16, color: C.textMuted }} />
                    : isCompleted ? <CheckCircle2 style={{ width: 16, height: 16, color: C.green }} />
                    : <stage.icon style={{ width: 16, height: 16, color: stage.color }} />}
                </div>
                <p style={{
                  fontSize: 10, fontWeight: 700, lineHeight: 1.2,
                  color: isCompleted ? C.green : isLocked ? C.textMuted : isActive ? stage.color : C.textPrimary,
                }}>
                  {stage.label}
                </p>
                {(() => {
                  if (!timeInfo || timeInfo.status === "not_started" || timeInfo.status === "completed") {
                    return <p style={{ fontSize: 9, color: C.textMuted, marginTop: 4 }}>{idx + 1}/6</p>;
                  }
                  if (timeInfo.isPaused) {
                    return <p style={{ fontSize: 9, fontWeight: 700, marginTop: 4, color: "#d97706" }}>Pausado</p>;
                  }
                  const remaining = timeInfo.remainingBusinessDays ?? 0;
                  const statusColor = timeInfo.status === "overdue" ? C.red : timeInfo.status === "warning" ? "#f97316" : timeInfo.status === "caution" ? "#eab308" : C.green;
                  return <p style={{ fontSize: 9, fontWeight: 700, marginTop: 4, color: statusColor }}>{remaining <= 0 ? `${Math.abs(remaining)}d vencido` : `${remaining}d rest.`}</p>;
                })()}
              </button>
            );
          })}
        </div>

        {/* ── Section Title ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <div style={{ width: 3, height: 18, borderRadius: 2, background: C.blue2 }} />
          <h2 style={{ fontSize: 12, fontWeight: 700, color: C.blue, letterSpacing: 1.2, textTransform: "uppercase" }}>Detalle de Etapas</h2>
        </div>

        {/* ── Stage Cards Grid ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {STAGES.map((stage) => {
            const stageData = stagesMap[stage.id];
            const stageStatus = stageData?.status ?? "locked";
            const progress = stageData?.progress ?? 0;
            const isLocked = stageStatus === "locked";
            const isCompleted = stageStatus === "completed";
            const isInProgress = stageStatus === "in_progress";
            const timeInfo = timeData?.find((t: any) => t.stageId === stage.id);

            return (
              <div
                key={stage.id}
                style={{
                  position: "relative", background: C.cardBg, borderRadius: 14, padding: 18,
                  boxShadow: "0 2px 12px rgba(10,22,40,.06)",
                  border: isInProgress ? `2px solid ${stage.color}40` : `1px solid ${C.border}`,
                  opacity: isLocked ? 0.5 : 1,
                  cursor: isLocked ? "not-allowed" : "default",
                  transition: "all 0.2s",
                }}
              >
                {/* Stage icon + status badge */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div
                    style={{
                      width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                      background: isLocked ? C.textMuted : stage.color, cursor: isLocked ? "not-allowed" : "pointer",
                      boxShadow: `0 2px 8px ${isLocked ? "rgba(0,0,0,.1)" : stage.color + "40"}`,
                    }}
                    onClick={() => {
                      if (!isLocked) {
                        recordOpening.mutate({ projectId, stageId: stage.id as any });
                        setLocation(`/projects/${projectId}/${stage.path}`);
                      }
                    }}
                  >
                    {isLocked ? <Lock style={{ width: 16, height: 16, color: "#fff" }} />
                      : isCompleted ? <CheckCircle2 style={{ width: 16, height: 16, color: "#fff" }} />
                      : <stage.icon style={{ width: 16, height: 16, color: "#fff" }} />}
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {isCompleted && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: "#DCFCE7", color: "#166534" }}>Completado</span>
                    )}
                    {isInProgress && timeInfo?.isPaused && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: "#FEF3C7", color: "#92400E" }}>Pausado</span>
                    )}
                    {isInProgress && !timeInfo?.isPaused && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: `${stage.color}18`, color: stage.color }}>En Progreso</span>
                    )}
                    {isLocked && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: "#F1F5F9", color: C.textMuted }}>Bloqueado</span>
                    )}
                  </div>
                </div>

                {/* Stage name */}
                <h3
                  style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary, cursor: isLocked ? "not-allowed" : "pointer" }}
                  onClick={() => {
                    if (!isLocked) {
                      recordOpening.mutate({ projectId, stageId: stage.id as any });
                      setLocation(`/projects/${projectId}/${stage.path}`);
                    }
                  }}
                >
                  {stage.label}
                </h3>
                <p style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>{stage.sublabel}</p>

                {/* Progress bar */}
                {!isLocked && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: C.textSecondary }}>Progreso</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: stage.color }}>{progress}%</span>
                    </div>
                    <div style={{ height: 5, background: "#F1F5F9", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 4, transition: "width 0.5s", width: `${progress}%`, background: stage.color }} />
                    </div>
                  </div>
                )}

                {/* Time remaining */}
                {(() => {
                  if (!timeInfo || timeInfo.status === "not_started") return null;
                  if (timeInfo.status === "completed") {
                    return (
                      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 4, color: C.green }}>
                        <CheckCircle2 style={{ width: 12, height: 12 }} />
                        <span style={{ fontSize: 10, fontWeight: 600 }}>Etapa cerrada</span>
                      </div>
                    );
                  }
                  if (timeInfo.isPaused) {
                    return (
                      <div style={{ marginTop: 10, borderRadius: 8, border: "1px solid #FDE68A", background: "#FFFBEB", padding: "6px 10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <Pause style={{ width: 12, height: 12, color: "#D97706" }} />
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#D97706" }}>Etapa Pausada</span>
                        </div>
                        <p style={{ fontSize: 9, color: "#92400E", marginTop: 2 }}>
                          {timeInfo.pausedDays > 0 ? `${timeInfo.pausedDays} días hábiles en pausa` : "Recién pausada"}
                          {timeInfo.extraDays > 0 ? ` · +${timeInfo.extraDays}d extendidos` : ""}
                        </p>
                      </div>
                    );
                  }
                  const remaining = timeInfo.remainingBusinessDays ?? 0;
                  const total = timeInfo.totalBusinessDays;
                  const percentUsed = total > 0 ? Math.round(((total - remaining) / total) * 100) : 100;
                  const statusColor = timeInfo.status === "overdue" ? C.red : timeInfo.status === "warning" ? "#f97316" : timeInfo.status === "caution" ? "#eab308" : C.green;
                  const statusBg = timeInfo.status === "overdue" ? "#FEF2F2" : timeInfo.status === "warning" ? "#FFF7ED" : timeInfo.status === "caution" ? "#FEFCE8" : "#F0FDF4";
                  const statusBorder = timeInfo.status === "overdue" ? "#FECACA" : timeInfo.status === "warning" ? "#FED7AA" : timeInfo.status === "caution" ? "#FDE68A" : "#BBF7D0";
                  const StatusIcon = timeInfo.status === "overdue" || timeInfo.status === "warning" ? AlertTriangle : Timer;
                  const deadlineStr = timeInfo.deadlineDate ? new Date(timeInfo.deadlineDate).toLocaleDateString("es-CL", { day: "2-digit", month: "short" }) : "";

                  return (
                    <div style={{ marginTop: 10, borderRadius: 8, border: `1px solid ${statusBorder}`, background: statusBg, padding: "6px 10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <StatusIcon style={{ width: 12, height: 12, color: statusColor }} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: statusColor }}>
                          {remaining <= 0 ? `Vencido (${Math.abs(remaining)}d)` : `${remaining} días hábiles`}
                        </span>
                      </div>
                      <div style={{ marginTop: 4, height: 3, background: "rgba(255,255,255,.6)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 2, width: `${Math.min(percentUsed, 100)}%`, background: statusColor, transition: "width 0.3s" }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                        <span style={{ fontSize: 9, color: C.textSecondary }}>
                          Plazo: {total}d háb.{timeInfo.extraDays > 0 ? ` (+${timeInfo.extraDays}d ext.)` : ""}{timeInfo.pausedDays > 0 ? ` (+${timeInfo.pausedDays}d pausa)` : ""}
                        </span>
                        {deadlineStr && <span style={{ fontSize: 9, color: C.textSecondary }}>Vence: {deadlineStr}</span>}
                      </div>
                    </div>
                  );
                })()}

                {/* Action buttons */}
                {isInProgress && canManage && stage.id !== "design" && (
                  <div style={{ marginTop: 10, display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {timeInfo?.isPaused ? (
                      <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                        onClick={(e) => { e.stopPropagation(); openModal("resume", stage.id); }}>
                        <Play className="h-3 w-3" /> Reanudar
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 text-amber-700 border-amber-300 hover:bg-amber-50"
                        onClick={(e) => { e.stopPropagation(); openModal("pause", stage.id); }}>
                        <Pause className="h-3 w-3" /> Pausar
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 text-blue-700 border-blue-300 hover:bg-blue-50"
                      onClick={(e) => { e.stopPropagation(); openModal("extend", stage.id); }}>
                      <CalendarPlus className="h-3 w-3" /> Extender
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 text-muted-foreground"
                      onClick={(e) => { e.stopPropagation(); openModal("history", stage.id); }}>
                      <History className="h-3 w-3" /> Historial
                    </Button>
                  </div>
                )}

                {/* Arrow */}
                {!isLocked && (
                  <ChevronRight
                    style={{ position: "absolute", right: 12, bottom: 16, width: 16, height: 16, color: C.textMuted, cursor: "pointer" }}
                    onClick={() => {
                      recordOpening.mutate({ projectId, stageId: stage.id as any });
                      setLocation(`/projects/${projectId}/${stage.path}`);
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* AI hint for new projects */}
        {data.currentStage === "sow" && !data.sow && (
          <div style={{
            marginTop: 24, background: C.cardBg, borderRadius: 14, padding: "16px 20px",
            display: "flex", alignItems: "center", gap: 14, boxShadow: "0 2px 12px rgba(10,22,40,.06)",
            border: `1px solid ${C.blue2}30`,
          }}>
            <Sparkles style={{ width: 20, height: 20, color: C.blue2, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>Comienza con el SoW Agéntico</p>
              <p style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>
                Carga la propuesta comercial en PDF y la IA completará automáticamente el Statement of Work.
              </p>
            </div>
            <Button size="sm" onClick={() => setLocation(`/projects/${projectId}/sow`)}
              style={{ background: C.blue2, color: "#fff", border: "none", fontWeight: 600, fontSize: 12, padding: "8px 16px", borderRadius: 8 }}>
              Ir al SoW
            </Button>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{ background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navy2} 100%)`, padding: "16px 24px", textAlign: "center" }}>
        <p style={{ fontSize: 10, color: "rgba(255,255,255,.3)", letterSpacing: 1 }}>PRODIGIO TECH · PMO PLATFORM</p>
      </div>

      {/* ═══ MODALS ═══ */}
      {/* Pause */}
      <Dialog open={modalType === "pause"} onOpenChange={(o) => !o && setModalType(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <Pause className="h-5 w-5" /> Pausar Etapa: {selectedStageLabel}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-sm text-muted-foreground">Al pausar la etapa, los días hábiles de pausa no se contabilizarán en el plazo.</p>
            <div className="space-y-1.5">
              <Label>Motivo de la pausa *</Label>
              <Textarea placeholder="ej. Vacaciones del equipo, esperando respuesta del cliente..." value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            </div>
            <Button className="w-full bg-amber-600 hover:bg-amber-700" onClick={handlePause} disabled={pauseMutation.isPending}>
              {pauseMutation.isPending ? "Pausando..." : "Confirmar Pausa"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resume */}
      <Dialog open={modalType === "resume"} onOpenChange={(o) => !o && setModalType(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700">
              <Play className="h-5 w-5" /> Reanudar Etapa: {selectedStageLabel}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-sm text-muted-foreground">Al reanudar, el conteo de días hábiles continuará desde donde se pausó.</p>
            <div className="space-y-1.5">
              <Label>Motivo de la reanudación *</Label>
              <Textarea placeholder="ej. Equipo disponible nuevamente, respuesta del cliente recibida..." value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            </div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleResume} disabled={resumeMutation.isPending}>
              {resumeMutation.isPending ? "Reanudando..." : "Confirmar Reanudación"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Extend */}
      <Dialog open={modalType === "extend"} onOpenChange={(o) => !o && setModalType(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-700">
              <CalendarPlus className="h-5 w-5" /> Extender Plazo: {selectedStageLabel}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-sm text-muted-foreground">Agrega días hábiles adicionales al plazo de esta etapa.</p>
            <div className="space-y-1.5">
              <Label>Días hábiles adicionales *</Label>
              <Input type="number" min={1} max={365} value={extraDays} onChange={(e) => setExtraDays(parseInt(e.target.value) || 1)} />
            </div>
            <div className="space-y-1.5">
              <Label>Motivo de la extensión *</Label>
              <Textarea placeholder="ej. Cambio de alcance, complejidad adicional descubierta..." value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            </div>
            <Button className="w-full" onClick={handleExtend} disabled={extendMutation.isPending}>
              {extendMutation.isPending ? "Extendiendo..." : `Extender +${extraDays} días hábiles`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* History */}
      <Dialog open={modalType === "history"} onOpenChange={(o) => !o && setModalType(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-muted-foreground" /> Historial: {selectedStageLabel}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 max-h-[400px] overflow-y-auto">
            {!historyData || historyData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No hay registros de pausas o extensiones para esta etapa.</p>
            ) : (
              <div className="space-y-2">
                {historyData.map((item: any) => {
                  const typeMap: Record<string, { label: string; icon: typeof Clock; color: string; bg: string }> = {
                    pause: { label: "Pausa", icon: Pause, color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
                    resume: { label: "Reanudación", icon: Play, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
                    extend: { label: `Extensión +${item.extraDays}d`, icon: CalendarPlus, color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
                  };
                  const typeConfig = typeMap[item.type as string] ?? { label: item.type, icon: Clock, color: "text-gray-700", bg: "bg-gray-50 border-gray-200" };
                  return (
                    <div key={item.id} className={`rounded-lg border p-3 ${typeConfig.bg}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <typeConfig.icon className={`h-3.5 w-3.5 ${typeConfig.color}`} />
                          <span className={`text-xs font-semibold ${typeConfig.color}`}>{typeConfig.label}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(item.createdAt).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{item.reason}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LINKED PROJECT DOCUMENTS (SoW & Gantt)
   ═══════════════════════════════════════════════════════════════ */
function LinkedProjectDocuments({ projectId, canManage }: { projectId: number; canManage: boolean }) {
  const [uploadingType, setUploadingType] = useState<"sow" | "gantt" | null>(null);
  const [notes, setNotes] = useState("");
  const [dragOver, setDragOver] = useState<"sow" | "gantt" | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const docsQ = trpc.advance.listDocuments.useQuery({ projectId });
  const uploadMut = trpc.advance.uploadDocument.useMutation({
    onSuccess: (data) => { toast.success(`Documento "${data.fileName}" subido correctamente`); docsQ.refetch(); setUploadingType(null); setNotes(""); },
    onError: (err) => toast.error(`Error al subir: ${err.message}`),
  });
  const deleteMut = trpc.advance.deleteDocument.useMutation({
    onSuccess: () => { toast.success("Documento eliminado"); docsQ.refetch(); setDeleteId(null); },
    onError: (err) => toast.error(`Error: ${err.message}`),
  });

  const sowDocs = (docsQ.data ?? []).filter((d: any) => d.docType === "sow");
  const ganttDocs = (docsQ.data ?? []).filter((d: any) => d.docType === "gantt");

  async function handleFileUpload(file: File, docType: "sow" | "gantt") {
    if (file.size > 25 * 1024 * 1024) { toast.error("El archivo excede 25MB"); return; }
    const validTypes = [
      "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel",
      "application/msword", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-project", "image/png", "image/jpeg",
    ];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(pdf|docx?|xlsx?|pptx?|mpp|png|jpe?g|csv)$/i)) {
      toast.error("Tipo de archivo no soportado."); return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadMut.mutate({ projectId, docType, fileName: file.name, fileBase64: base64, mimeType: file.type || undefined, notes: notes.trim() || undefined });
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent, docType: "sow" | "gantt") { e.preventDefault(); setDragOver(null); const file = e.dataTransfer.files[0]; if (file) handleFileUpload(file, docType); }
  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>, docType: "sow" | "gantt") { const file = e.target.files?.[0]; if (file) handleFileUpload(file, docType); e.target.value = ""; }
  function fmtSize(bytes: number | null) { if (!bytes) return ""; if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`; return `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }

  function DocCard({ docType, label, icon, docs, accentColor }: {
    docType: "sow" | "gantt"; label: string; icon: React.ReactNode; docs: any[]; accentColor: string;
  }) {
    const isOver = dragOver === docType;
    const isUploading = uploadMut.isPending && uploadingType === docType;

    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          {icon}
          <h3 style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{label}</h3>
          <span style={{ fontSize: 11, color: C.textSecondary }}>({docs.length} archivo{docs.length !== 1 ? "s" : ""})</span>
        </div>

        {canManage && (
          <div
            style={{
              border: `2px dashed ${isOver ? accentColor : C.border}`, borderRadius: 12, padding: 16, textAlign: "center",
              cursor: "pointer", marginBottom: 12, background: isOver ? `${accentColor}08` : "#FAFBFC",
              transition: "all 0.2s",
            }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(docType); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => handleDrop(e, docType)}
            onClick={() => { setUploadingType(docType); document.getElementById(`file-input-${docType}`)?.click(); }}
          >
            <input id={`file-input-${docType}`} type="file" className="hidden" accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.mpp,.png,.jpg,.jpeg,.csv" onChange={(e) => handleFileInput(e, docType)} />
            {isUploading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "8px 0" }}>
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: accentColor }} />
                <span style={{ fontSize: 12, color: accentColor, fontWeight: 600 }}>Subiendo documento...</span>
              </div>
            ) : (
              <>
                <Upload style={{ width: 22, height: 22, color: C.textMuted, margin: "0 auto 4px" }} />
                <p style={{ fontSize: 11, color: C.textSecondary }}>
                  Arrastra un archivo aquí o <span style={{ color: accentColor, fontWeight: 600 }}>haz clic para seleccionar</span>
                </p>
                <p style={{ fontSize: 9, color: C.textMuted, marginTop: 4 }}>PDF, DOCX, XLSX, PPTX, MPP, PNG, JPG (máx 25MB)</p>
              </>
            )}
          </div>
        )}

        {docs.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {docs.map((doc: any) => (
              <div key={doc.id} style={{
                display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 10,
                border: `1px solid ${C.border}`, background: C.cardBg, transition: "all 0.2s",
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: `${accentColor}12`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {doc.fileName.match(/\.xlsx?$/i) ? <FileSpreadsheet style={{ width: 16, height: 16, color: accentColor }} /> : <FileText style={{ width: 16, height: 16, color: accentColor }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: C.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.fileName}</p>
                  <div style={{ display: "flex", gap: 8, fontSize: 10, color: C.textSecondary, marginTop: 2 }}>
                    {doc.fileSize && <span>{fmtSize(doc.fileSize)}</span>}
                    <span>{new Date(doc.createdAt).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })}</span>
                    {doc.uploadedByName && <span>por {doc.uploadedByName}</span>}
                  </div>
                  {doc.notes && <p style={{ fontSize: 10, color: C.textMuted, marginTop: 2, fontStyle: "italic" }}>{doc.notes}</p>}
                </div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                    style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, background: "#F1F5F9" }}
                    title="Descargar">
                    <Download style={{ width: 14, height: 14, color: C.textSecondary }} />
                  </a>
                  {canManage && (
                    <button
                      style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, background: "#FEF2F2", border: "none", cursor: "pointer" }}
                      title="Eliminar"
                      onClick={() => setDeleteId(doc.id)}
                      disabled={deleteMut.isPending}
                    >
                      {deleteMut.isPending && deleteId === doc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: C.red }} /> : <X style={{ width: 14, height: 14, color: C.red }} />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "24px 0", fontSize: 11, color: C.textMuted }}>
            No hay documentos {label.toLowerCase()} cargados
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{
      background: C.cardBg, borderRadius: 14, padding: 24, boxShadow: "0 2px 16px rgba(10,22,40,.08)",
      border: `1px solid ${C.border}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${C.teal}, #06b6d4)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <FileText style={{ width: 16, height: 16, color: "#fff" }} />
        </div>
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>Documentos del Proyecto</h2>
          <p style={{ fontSize: 10, color: C.textSecondary }}>SoW y Gantt de planificación para análisis ejecutivo y reportes de avance</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <DocCard docType="sow" label="Statement of Work (SoW)" icon={<FileText style={{ width: 16, height: 16, color: "#7c3aed" }} />} docs={sowDocs} accentColor="#7c3aed" />
        <DocCard docType="gantt" label="Gantt de Planificación" icon={<FileSpreadsheet style={{ width: 16, height: 16, color: C.green }} />} docs={ganttDocs} accentColor={C.green} />
      </div>

      {/* Delete confirmation */}
      <Dialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" /> Eliminar Documento
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">¿Estás seguro de eliminar este documento? Esta acción no se puede deshacer.</p>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMut.mutate({ documentId: deleteId })} disabled={deleteMut.isPending}>
              {deleteMut.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   UNLINK SECTION
   ═══════════════════════════════════════════════════════════════ */
function UnlinkSection({ projectId, projectName }: { projectId: number; projectName: string }) {
  const [, setLocation] = useLocation();
  const [showConfirm, setShowConfirm] = useState(false);

  const unlinkMutation = trpc.jira.unlinkProject.useMutation({
    onSuccess: (data) => { toast.success(data.message); setLocation("/projects"); },
    onError: (err) => toast.error(`Error: ${err.message}`),
  });

  return (
    <>
      <div style={{
        borderRadius: 14, padding: "14px 20px", display: "flex", alignItems: "center", gap: 14,
        border: "1px solid #FECACA", background: "#FEF2F2",
      }}>
        <Unlink style={{ width: 20, height: 20, color: C.red, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#991B1B" }}>Desvincular Proyecto</p>
          <p style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>
            Elimina este proyecto de la plataforma PMO. El proyecto seguirá existiendo en JIRA.
          </p>
        </div>
        <Button size="sm" variant="outline" className="shrink-0 text-red-600 border-red-300 hover:bg-red-50 gap-1" onClick={() => setShowConfirm(true)}>
          <Unlink className="w-3.5 h-3.5" /> Desvincular
        </Button>
      </div>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Unlink className="h-5 w-5" /> Desvincular Proyecto
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta acción eliminará <strong className="text-foreground">{projectName}</strong> de la plataforma PMO.
            El proyecto seguirá existiendo en JIRA, pero ya no se gestionará desde aquí.
          </p>
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Esta acción no se puede deshacer.</p>
                <p className="mt-1 text-xs">Se eliminarán los registros del proyecto, etapas y espacio JIRA asociado en la plataforma.</p>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={unlinkMutation.isPending}>Cancelar</Button>
            <Button variant="destructive" className="gap-1" disabled={unlinkMutation.isPending} onClick={() => unlinkMutation.mutate({ projectId })}>
              {unlinkMutation.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Desvinculando...</> : <><Trash2 className="w-3.5 h-3.5" /> Desvincular</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
