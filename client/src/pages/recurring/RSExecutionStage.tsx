import AppBreadcrumb from "@/components/AppBreadcrumb";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft, CheckCircle2, Loader2, Sparkles, Wrench, ExternalLink,
  AlertTriangle, Clock, TrendingUp, BarChart3, RefreshCw, ShieldAlert, Info,
  FileText, DollarSign, Activity, ChevronRight, CalendarClock, Shield,
  Package, Receipt,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";

const C = {
  navy: "#0A1628", navy2: "#112240", navy3: "#1A3358",
  accent: "#3B8EE8", green: "#1A7A4A", red: "#B83232", gold: "#B8860B",
  bg: "#F4F7FB", border: "#D8E2EF", textPrimary: "#1E293B", textSecondary: "#64748B", textMuted: "#94A3B8",
};

const semaphoreColors: Record<string, { bg: string; fg: string; dot: string; label: string; glow: string }> = {
  VERDE: { bg: "#DCFCE7", fg: "#166534", dot: "#22C55E", label: "Saludable", glow: "rgba(34,197,94,.25)" },
  AMARILLO: { bg: "#FEF3C7", fg: "#92400E", dot: "#F59E0B", label: "En Riesgo", glow: "rgba(245,158,11,.25)" },
  ROJO: { bg: "#FEF2F2", fg: "#991B1B", dot: "#EF4444", label: "Crítico", glow: "rgba(239,68,68,.25)" },
};

const jiraStatusColors: Record<string, { bg: string; fg: string }> = {
  done: { bg: "#DCFCE7", fg: "#166534" },
  indeterminate: { bg: "#DBEAFE", fg: "#1E40AF" },
  new: { bg: "#F1F5F9", fg: "#64748B" },
};

type MainTab = "analisis" | "plan_trabajo" | "facturacion";

function DimensionCard({ label, icon, status, score, detail }: {
  label: string; icon: React.ReactNode; status?: string; score?: number; detail?: string;
}) {
  const sem = semaphoreColors[status ?? ""] ?? { bg: "#F1F5F9", fg: "#64748B", dot: "#94A3B8", glow: "transparent" };
  return (
    <div style={{
      flex: 1, background: "#fff", borderRadius: 12, border: `1px solid ${C.border}`,
      padding: "16px 18px", position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: sem.dot,
      }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
          background: sem.bg, color: sem.fg,
        }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: C.textMuted }}>{label}</div>
          {status && (
            <span style={{
              fontSize: 9, fontWeight: 800, padding: "1px 6px", borderRadius: 4,
              background: sem.bg, color: sem.fg,
            }}>
              {status}
            </span>
          )}
        </div>
      </div>
      {score !== undefined && score !== null && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: C.textPrimary }}>{score}%</span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: "#E2E8F0" }}>
            <div style={{
              height: "100%", borderRadius: 3, background: sem.dot,
              width: `${Math.min(100, score)}%`, transition: "width .5s ease",
            }} />
          </div>
        </div>
      )}
      {detail && <p style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.5, margin: 0 }}>{detail}</p>}
    </div>
  );
}

export default function RSExecutionStage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const { data: svcData } = trpc.recurringServices.getById.useQuery({ id });
  const { data: stagesData } = trpc.recurringServices.getStages.useQuery({ serviceId: id });
  const { data: dashboard, isLoading } = trpc.recurringServices.getExecutionDashboard.useQuery({ serviceId: id });
  const { data: jiraData, isLoading: jiraLoading, refetch: refetchJira } = trpc.recurringServices.getWorkPlanFromJira.useQuery(
    { serviceId: id },
    { enabled: !!svcData?.service?.jsmProjectKey }
  );

  const stage = stagesData?.find((s: any) => s.stageId === "ejecucion");
  const isActive = stage?.status === "in_progress";
  const isCompleted = stage?.status === "completed";
  const svc = svcData?.service;

  const [aiResult, setAiResult] = useState<any>(null);
  const [resyncResult, setResyncResult] = useState<any>(null);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const [mainTab, setMainTab] = useState<MainTab>("analisis");
  const [workSubTab, setWorkSubTab] = useState<"actividades" | "facturacion_jira">("actividades");

  // Load persisted AI analysis from dashboard
  useEffect(() => {
    if (dashboard?.aiAnalysis?.data && !aiResult) {
      setAiResult({
        ...dashboard.aiAnalysis.data,
        fromCache: true,
        daysOld: dashboard.aiAnalysis.daysOld,
        dimensions: dashboard.aiAnalysis.dimensions ?? dashboard.aiAnalysis.data?.dimensions,
      });
    }
  }, [dashboard?.aiAnalysis]);

  const aiMutation = trpc.recurringServices.getOrRefreshAiAnalysis.useMutation({
    onSuccess: (data) => {
      toast.success("Análisis ejecutivo generado y persistido");
      setAiResult(data);
      utils.recurringServices.getExecutionDashboard.invalidate({ serviceId: id });
    },
    onError: (e) => toast.error(e.message),
  });

  const resyncMutation = trpc.recurringServices.resyncJsmTasks.useMutation({
    onSuccess: (results) => {
      const created = results.filter((r: any) => r.status === "created").length;
      const alreadySynced = results.filter((r: any) => r.status === "already_synced").length;
      const errors = results.filter((r: any) => r.status === "error").length;
      setResyncResult({ created, alreadySynced, errors, total: results.length });
      if (created > 0) {
        toast.success(`Re-sincronización: ${created} nuevos issues creados`);
      } else {
        toast.info(`Todos los issues ya están sincronizados (${alreadySynced})`);
      }
      utils.recurringServices.getExecutionDashboard.invalidate({ serviceId: id });
      refetchJira();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!svc) return <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Loader2 size={32} className="animate-spin" color={C.accent} /></div>;

  const db = dashboard;
  const metrics = db?.metrics;
  const ai = dashboard?.aiAnalysis;
  const semaphore = aiResult?.semaphore ?? ai?.healthStatus;
  const semColor = semaphoreColors[semaphore ?? ""] ?? semaphoreColors.VERDE;
  const aiExpired = ai?.expired ?? false;
  const aiDaysOld = aiResult?.daysOld ?? ai?.daysOld ?? null;
  const analysisDate = ai?.analysisDate ? new Date(ai.analysisDate) : null;
  const jiraBase = svc.jsmProjectKey ? `https://apiservice2.atlassian.net/browse/` : "";

  // Dimensions from AI or calculated
  const dims = aiResult?.dimensions ?? ai?.dimensions;

  const tabs: { id: MainTab; label: string; icon: React.ReactNode }[] = [
    { id: "analisis", label: "Análisis Agéntico", icon: <Sparkles size={14} /> },
    { id: "plan_trabajo", label: "Plan de Trabajo", icon: <Clock size={14} /> },
    { id: "facturacion", label: "Detalle Facturación", icon: <DollarSign size={14} /> },
  ];

  return (
    <div style={{ background: C.bg, fontFamily: "'Inter', sans-serif", color: C.textPrimary, minHeight: "100vh" }}>
      <AppBreadcrumb segments={[
        { label: "Servicios Recurrentes", href: "/recurring-services" },
        { label: svc.serviceName, href: `/recurring-services/${id}` },
        { label: "Ejecución" },
      ]} />

      {/* ═══ HEADER ═══ */}
      <div style={{
        background: `linear-gradient(160deg, ${C.navy} 0%, ${C.navy2} 55%, ${C.navy3} 100%)`,
        borderBottom: `3px solid ${semaphore ? semColor.dot : C.accent}`,
        borderRadius: 16, padding: "24px 32px", marginBottom: 24,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => navigate(`/recurring-services/${id}`)} style={{ background: "rgba(255,255,255,.08)", border: "none", borderRadius: 8, padding: 6, cursor: "pointer" }}>
              <ArrowLeft size={16} color="#fff" />
            </button>
            <Wrench size={20} color={semaphore ? semColor.dot : "#10B981"} />
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: "#fff", margin: 0 }}>Dashboard de Ejecución</h1>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,.5)", margin: 0 }}>{svc.serviceName} &middot; {svc.clientName}</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {svc.jsmPortalUrl && (
              <a href={svc.jsmPortalUrl} target="_blank" rel="noopener noreferrer"
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "rgba(16,185,129,.15)", border: "1px solid rgba(16,185,129,.4)",
                  color: "#6EE7B7", borderRadius: 8, padding: "6px 14px",
                  fontSize: 12, fontWeight: 600, textDecoration: "none",
                }}>
                <ExternalLink size={13} />
                Portal Cliente JSM
              </a>
            )}
            {isActive && svc.jsmProjectKey && (
              <Button size="sm" variant="outline" onClick={() => resyncMutation.mutate({ serviceId: id })} disabled={resyncMutation.isPending}
                style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.2)", color: "#fff" }}>
                {resyncMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : <RefreshCw size={14} className="mr-1" />}
                Re-sincronizar JIRA
              </Button>
            )}
            <Button size="sm" variant="outline"
              onClick={() => aiMutation.mutate({ serviceId: id, forceRefresh: true })}
              disabled={aiMutation.isPending}
              style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.2)", color: "#fff" }}>
              {aiMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : <Sparkles size={14} className="mr-1" />}
              {aiExpired ? "Actualizar Análisis (vencido)" : aiResult ? "Regenerar Análisis" : "Generar Análisis IA"}
            </Button>
            {isCompleted && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: "4px 12px", borderRadius: 10, background: "#DCFCE7", color: "#166534" }}>
                COMPLETADA
              </span>
            )}
          </div>
        </div>

        {/* Semaphore + Abstract banner */}
        {semaphore && (
          <div style={{
            marginTop: 16, padding: "14px 20px", borderRadius: 12,
            background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)",
            display: "flex", alignItems: "flex-start", gap: 14,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
              background: semColor.dot, display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 0 20px ${semColor.glow}`,
            }}>
              {semaphore === "VERDE" ? <CheckCircle2 size={22} color="#fff" /> :
               semaphore === "AMARILLO" ? <AlertTriangle size={22} color="#fff" /> :
               <ShieldAlert size={22} color="#fff" />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                <span style={{
                  fontSize: 11, fontWeight: 800, padding: "2px 10px", borderRadius: 8,
                  background: semColor.bg, color: semColor.fg, textTransform: "uppercase", letterSpacing: ".05em",
                }}>
                  {semColor.label}
                </span>
                {analysisDate && (
                  <span style={{
                    fontSize: 9, fontWeight: 600, display: "flex", alignItems: "center", gap: 4,
                    color: aiExpired ? "#FCA5A5" : "rgba(255,255,255,.4)",
                  }}>
                    <CalendarClock size={10} />
                    {analysisDate.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })}
                    {" "}{analysisDate.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                    {aiExpired && ` — Vencido (${aiDaysOld} días)`}
                  </span>
                )}
                {aiExpired && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: "1px 8px", borderRadius: 6,
                    background: "rgba(239,68,68,.2)", color: "#FCA5A5", display: "flex", alignItems: "center", gap: 3,
                  }}>
                    <AlertTriangle size={9} /> Requiere actualización
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,.8)", lineHeight: 1.6, margin: 0 }}>
                {aiResult?.executiveAbstract ?? ai?.abstract ?? aiResult?.semaphoreJustification ?? ai?.healthJustification}
              </p>
            </div>
          </div>
        )}

        {/* KPI strip with SLA compliance */}
        {db && (() => {
          const slaColor = (metrics?.slaCompliancePct ?? 100) >= 80 ? "#4ADE80" : (metrics?.slaCompliancePct ?? 100) >= 50 ? "#FBBF24" : "#F87171";
          const sf = metrics?.slaFactors as { hasSlaConfig: boolean; totalWorkItems: number; completedWorkItems: number; overdueWorkItems: number; jiraTotalIssues: number; jiraCompletedIssues: number; jiraOverdueIssues: number; activePenalties: number; monthsElapsed: number; reason: string } | undefined;
          const reasonLabels: Record<string, string> = {
            no_tickets: "Sin tickets ni tareas registradas",
            overdue_items: "Existen items vencidos sin completar",
            zero_progress: "0% de avance con servicio activo",
            sla_penalty_calc: "Basado en configuración SLA y penalidades",
            progress_based: "Basado en avance de tareas",
          };
          const otherKpis = [
            { label: "Avance Temporal", value: `${metrics?.contractProgress ?? 0}%`, color: "#fff", icon: <TrendingUp size={12} />, sub: `${metrics?.monthsElapsed ?? 0}/${svc.durationMonths} meses` },
            { label: "Avance Tareas", value: `${metrics?.completionRate ?? 0}%`, color: "#4ADE80", icon: <Package size={12} />, sub: `${metrics?.completedItems ?? 0}/${metrics?.totalItems ?? 0}` },
            { label: "Facturado", value: `${svc.currency} ${metrics?.totalBilled?.toLocaleString() ?? "0"}`, color: "#60A5FA", icon: <Receipt size={12} /> },
            { label: "Pendiente Cobro", value: `${svc.currency} ${metrics?.totalPending?.toLocaleString() ?? "0"}`, color: "#FBBF24", icon: <DollarSign size={12} />, sub: metrics?.overdueMonths ? `${metrics.overdueMonths} vencidas` : undefined },
            { label: "Multas", value: `${svc.currency} ${metrics?.totalPenalties?.toLocaleString() ?? "0"}`, color: (metrics?.totalPenalties ?? 0) > 0 ? "#F87171" : "#4ADE80", icon: <AlertTriangle size={12} /> },
          ];
          return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginTop: 16 }}>
            {/* SLA KPI with Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <div style={{
                  background: "rgba(255,255,255,.06)", borderRadius: 10, padding: "10px 12px",
                  border: `1px solid ${slaColor}22`, cursor: "pointer", position: "relative",
                  transition: "all .2s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${slaColor}55`; e.currentTarget.style.background = "rgba(255,255,255,.1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${slaColor}22`; e.currentTarget.style.background = "rgba(255,255,255,.06)"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                    <span style={{ color: "rgba(255,255,255,.3)" }}><Shield size={12} /></span>
                    <span style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".09em", color: "rgba(255,255,255,.4)" }}>
                      Cumplimiento SLA
                    </span>
                    <Info size={9} style={{ color: "rgba(255,255,255,.25)", marginLeft: "auto" }} />
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: slaColor, letterSpacing: "-.3px" }}>
                    {metrics?.slaCompliancePct != null ? `${metrics.slaCompliancePct}%` : "N/A"}
                  </div>
                  <div style={{ fontSize: 7, color: "rgba(255,255,255,.3)", marginTop: 2 }}>Click para ver detalle</div>
                </div>
              </PopoverTrigger>
              <PopoverContent
                side="bottom"
                sideOffset={8}
                className="!bg-[#0F1D32] !text-white !border !border-white/10 !rounded-xl !p-0 !w-[320px] !max-w-[340px]"
              >
                <div style={{ padding: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <Shield size={14} style={{ color: slaColor }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>Factores del Cálculo SLA</span>
                  </div>
                  {/* Reason badge */}
                  <div style={{
                    background: `${slaColor}15`, border: `1px solid ${slaColor}30`, borderRadius: 6,
                    padding: "6px 10px", marginBottom: 10, fontSize: 11, color: slaColor, fontWeight: 600,
                  }}>
                    {sf ? reasonLabels[sf.reason] || sf.reason : "Calculando..."}
                  </div>
                  {/* Factors table */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[
                      { label: "Config. SLA", value: sf?.hasSlaConfig ? "S\u00ed" : "No", ok: sf?.hasSlaConfig },
                      { label: "Tareas Plan de Trabajo", value: `${sf?.completedWorkItems ?? 0} / ${sf?.totalWorkItems ?? 0} completadas`, ok: (sf?.completedWorkItems ?? 0) > 0 },
                      { label: "Tareas Vencidas (Plan)", value: `${sf?.overdueWorkItems ?? 0}`, ok: (sf?.overdueWorkItems ?? 0) === 0 },
                      { label: "Issues JIRA Total", value: `${sf?.jiraTotalIssues ?? 0}`, ok: (sf?.jiraTotalIssues ?? 0) > 0 },
                      { label: "Issues JIRA Completados", value: `${sf?.jiraCompletedIssues ?? 0}`, ok: (sf?.jiraCompletedIssues ?? 0) > 0 },
                      { label: "Issues JIRA Vencidos", value: `${sf?.jiraOverdueIssues ?? 0}`, ok: (sf?.jiraOverdueIssues ?? 0) === 0 },
                      { label: "Penalidades Activas", value: `${sf?.activePenalties ?? 0}`, ok: (sf?.activePenalties ?? 0) === 0 },
                      { label: "Meses Activo", value: `${sf?.monthsElapsed ?? 0}`, ok: true },
                    ].map((f) => (
                      <div key={f.label} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "4px 8px", borderRadius: 6,
                        background: f.ok ? "rgba(74,222,128,.06)" : "rgba(248,113,113,.06)",
                      }}>
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,.6)" }}>{f.label}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          color: f.ok ? "#4ADE80" : "#F87171",
                        }}>{f.value}</span>
                      </div>
                    ))}
                  </div>
                  {/* Reglas */}
                  <div style={{ marginTop: 10, padding: "8px 10px", background: "rgba(255,255,255,.03)", borderRadius: 6, border: "1px solid rgba(255,255,255,.06)" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,.3)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>Reglas de cálculo</div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,.45)", lineHeight: 1.5 }}>
                      • Sin tickets/tareas → 0%<br/>
                      • Items vencidos (Plan o JIRA) → 0%<br/>
                      • 0% avance con servicio activo → 0%<br/>
                      • Con SLA: 100% - (penalidades × 15%)<br/>
                      • Sin SLA: basado en % de avance
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            {/* Other KPIs */}
            {otherKpis.map((kpi) => (
              <div key={kpi.label} style={{
                background: "rgba(255,255,255,.06)", borderRadius: 10, padding: "10px 12px",
                border: "1px solid rgba(255,255,255,.08)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                  <span style={{ color: "rgba(255,255,255,.3)" }}>{kpi.icon}</span>
                  <span style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".09em", color: "rgba(255,255,255,.4)" }}>
                    {kpi.label}
                  </span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: kpi.color, letterSpacing: "-.3px" }}>
                  {kpi.value}
                </div>
                {kpi.sub && <div style={{ fontSize: 9, color: "rgba(255,255,255,.5)" }}>{kpi.sub}</div>}
              </div>
            ))}
          </div>
          );
        })()}

        {/* JIRA stats strip */}
        {jiraData && !jiraData.jiraUnavailable && jiraData.jiraStats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 10 }}>
            {[
              { label: "Issues JIRA", value: jiraData.jiraStats.total, color: "#fff" },
              { label: "Completados", value: jiraData.jiraStats.done, color: "#4ADE80" },
              { label: "En Progreso", value: jiraData.jiraStats.inProgress, color: "#60A5FA" },
              { label: "Pendientes", value: jiraData.jiraStats.todo, color: "#FBBF24" },
            ].map((kpi) => (
              <div key={kpi.label} style={{
                background: "rgba(255,255,255,.04)", borderRadius: 8, padding: "8px 10px",
                border: "1px solid rgba(255,255,255,.06)",
              }}>
                <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".09em", color: "rgba(255,255,255,.3)" }}>
                  {kpi.label}
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Re-sync result */}
      {resyncResult && (
        <div style={{
          background: "#fff", borderRadius: 12, border: `1px solid ${C.border}`,
          padding: "16px 24px", marginBottom: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <RefreshCw size={16} color={C.accent} />
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, margin: 0 }}>Resultado Re-sincronización</h3>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <div style={{ padding: "10px 14px", borderRadius: 8, background: "#DCFCE7", border: "1px solid #BBF7D0" }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "#166534" }}>Nuevos Creados</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#14532D" }}>{resyncResult.created}</div>
            </div>
            <div style={{ padding: "10px 14px", borderRadius: 8, background: "#DBEAFE", border: "1px solid #BFDBFE" }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "#1E40AF" }}>Ya Sincronizados</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#1E3A8A" }}>{resyncResult.alreadySynced}</div>
            </div>
            {resyncResult.errors > 0 && (
              <div style={{ padding: "10px 14px", borderRadius: 8, background: "#FEF2F2", border: "1px solid #FECACA" }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "#991B1B" }}>Errores</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#7F1D1D" }}>{resyncResult.errors}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: "center", padding: 60 }}><Loader2 size={32} className="animate-spin" color={C.accent} /></div>
      ) : !db ? (
        <div style={{ textAlign: "center", padding: 60, background: "#fff", borderRadius: 12, border: `1px solid ${C.border}` }}>
          <p style={{ color: C.textMuted }}>No hay datos de ejecución disponibles</p>
        </div>
      ) : (
        <>
          {/* ═══ BILLING PROGRESS SUMMARY (compact) ═══ */}
          <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${C.border}`, padding: "16px 24px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                <BarChart3 size={16} />
                Progreso de Facturación
              </h3>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {db.billing?.map((m: any) => {
                  const colors: Record<string, { bg: string; fg: string }> = {
                    pendiente: { bg: "#FEF3C7", fg: "#92400E" },
                    facturado: { bg: "#DBEAFE", fg: "#1E40AF" },
                    pagado: { bg: "#DCFCE7", fg: "#166534" },
                  };
                  const c = colors[m.status] ?? colors.pendiente;
                  return (
                    <div key={m.id} style={{
                      width: 28, height: 28, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 9, fontWeight: 700, background: c.bg, color: c.fg, border: `1px solid ${C.border}`,
                    }} title={`Mes ${m.monthNumber}: ${m.status} - ${m.currency} ${parseFloat(m.amount).toLocaleString()}`}>
                      {m.monthNumber}
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              <div style={{ padding: "10px 14px", borderRadius: 8, background: "#FEF3C7", border: "1px solid #FDE68A" }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "#92400E" }}>Pendiente</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#78350F" }}>{svc.currency} {metrics?.totalPending?.toLocaleString() ?? "0"}</div>
              </div>
              <div style={{ padding: "10px 14px", borderRadius: 8, background: "#DBEAFE", border: "1px solid #BFDBFE" }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "#1E40AF" }}>Facturado</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#1E3A8A" }}>{svc.currency} {metrics?.totalBilled?.toLocaleString() ?? "0"}</div>
              </div>
              <div style={{ padding: "10px 14px", borderRadius: 8, background: "#DCFCE7", border: "1px solid #BBF7D0" }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "#166534" }}>Pagado</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#14532D" }}>{svc.currency} {metrics?.totalPaid?.toLocaleString() ?? "0"}</div>
              </div>
            </div>
          </div>

          {/* ═══ HORIZONTAL TAB MENU ═══ */}
          <div style={{
            display: "flex", gap: 0, marginBottom: 0,
            background: "#fff", borderRadius: "12px 12px 0 0", border: `1px solid ${C.border}`, borderBottom: "none",
            padding: "0 8px",
          }}>
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => setMainTab(tab.id)} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "14px 20px",
                border: "none", borderBottom: mainTab === tab.id ? `3px solid ${C.accent}` : "3px solid transparent",
                cursor: "pointer", fontSize: 13, fontWeight: mainTab === tab.id ? 700 : 500,
                color: mainTab === tab.id ? C.accent : C.textSecondary,
                background: "transparent", transition: "all .2s",
              }}>
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* ═══ TAB CONTENT ═══ */}
          <div style={{
            background: "#fff", borderRadius: "0 0 12px 12px", border: `1px solid ${C.border}`,
            padding: "24px", marginBottom: 16, minHeight: 200,
          }}>

            {/* ── TAB: Análisis Agéntico ── */}
            {mainTab === "analisis" && (
              <>
                {/* Dimension cards */}
                {dims && (
                  <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                    <DimensionCard
                      label="Cumplimiento SLA"
                      icon={<Shield size={16} />}
                      status={dims.sla?.status}
                      score={dims.sla?.score}
                      detail={dims.sla?.detail}
                    />
                    <DimensionCard
                      label="Entregables"
                      icon={<Package size={16} />}
                      status={dims.deliverables?.status}
                      score={dims.deliverables?.score}
                      detail={dims.deliverables?.detail}
                    />
                    <DimensionCard
                      label="Facturación al Día"
                      icon={<Receipt size={16} />}
                      status={dims.billing?.status}
                      score={dims.billing?.score}
                      detail={dims.billing?.detail}
                    />
                  </div>
                )}

                {!aiResult && !ai?.data ? (
                  <div style={{ textAlign: "center", padding: "40px 20px" }}>
                    <Sparkles size={40} color={C.textMuted} style={{ marginBottom: 12, opacity: .4 }} />
                    <p style={{ fontSize: 14, fontWeight: 600, color: C.textSecondary, marginBottom: 4 }}>Sin análisis agéntico disponible</p>
                    <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 16 }}>Genera un análisis con IA para evaluar la salud del servicio</p>
                    <Button size="sm" onClick={() => aiMutation.mutate({ serviceId: id, forceRefresh: true })} disabled={aiMutation.isPending}>
                      {aiMutation.isPending ? <Loader2 size={14} className="animate-spin mr-2" /> : <Sparkles size={14} className="mr-2" />}
                      Generar Análisis
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Analysis date and history */}
                    {ai?.history && ai.history.length > 0 && (
                      <div style={{
                        display: "flex", alignItems: "center", gap: 8, marginBottom: 16,
                        padding: "8px 14px", borderRadius: 8, background: "#F8FAFC", border: `1px solid ${C.border}`,
                      }}>
                        <CalendarClock size={14} color={C.textMuted} />
                        <span style={{ fontSize: 11, color: C.textSecondary }}>
                          Historial: {ai.history.length} análisis generados
                        </span>
                        <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
                          {ai.history.map((h: any) => {
                            const hSem = semaphoreColors[h.semaphore ?? ""] ?? semaphoreColors.VERDE;
                            return (
                              <div key={h.id} title={`${new Date(h.createdAt).toLocaleDateString("es-CL")} — ${h.semaphore}`}
                                style={{
                                  width: 10, height: 10, borderRadius: "50%", background: hSem.dot,
                                  border: "2px solid #fff", boxShadow: "0 0 0 1px #E2E8F0",
                                }} />
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Executive Summary */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <h4 style={{ fontSize: 13, fontWeight: 700, color: C.navy, margin: 0 }}>Resumen Ejecutivo</h4>
                        <button onClick={() => setShowFullAnalysis(!showFullAnalysis)} style={{
                          padding: "4px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                          fontSize: 11, fontWeight: 600, background: "#F1F5F9", color: C.textSecondary,
                        }}>
                          {showFullAnalysis ? "Colapsar" : "Ver completo"}
                        </button>
                      </div>
                      <div style={{ fontSize: 12, color: C.textPrimary, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                        {showFullAnalysis
                          ? (aiResult?.executiveSummary ?? "")
                          : (aiResult?.executiveAbstract ?? ai?.abstract ?? "")}
                      </div>
                    </div>

                    {/* Risks & Recommendations (shown when expanded) */}
                    {showFullAnalysis && (
                      <>
                        {aiResult?.risks?.length > 0 && (
                          <div style={{ marginBottom: 16 }}>
                            <h4 style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 8 }}>Riesgos Identificados</h4>
                            {aiResult.risks.map((r: any, i: number) => (
                              <div key={i} style={{ padding: "8px 12px", borderRadius: 6, background: "#FFF7ED", border: "1px solid #FED7AA", marginBottom: 4 }}>
                                <span style={{
                                  fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                                  color: r.level === "alto" ? C.red : r.level === "medio" ? C.gold : C.green,
                                }}>{r.level}</span>
                                <p style={{ fontSize: 11, color: C.textPrimary, marginTop: 2, marginBottom: 0 }}>{r.description}</p>
                                {r.mitigation && <p style={{ fontSize: 10, color: C.textSecondary, marginTop: 2, marginBottom: 0 }}>Mitigación: {r.mitigation}</p>}
                              </div>
                            ))}
                          </div>
                        )}

                        {aiResult?.recommendations?.length > 0 && (
                          <div>
                            <h4 style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 8 }}>Recomendaciones</h4>
                            {aiResult.recommendations.map((r: any, i: number) => (
                              <div key={i} style={{ padding: "8px 12px", borderRadius: 6, background: "#F0F9FF", border: "1px solid #BAE6FD", marginBottom: 4 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>#{r.priority} {r.title}</span>
                                <p style={{ fontSize: 11, color: C.textSecondary, marginTop: 2, marginBottom: 0 }}>{r.description}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </>
            )}

            {/* ── TAB: Plan de Trabajo ── */}
            {mainTab === "plan_trabajo" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                    <Clock size={16} />
                    Plan de Trabajo {svc.jsmProjectKey ? "(desde JIRA)" : ""}
                  </h3>
                  <div style={{ display: "flex", gap: 4 }}>
                    {svc.jsmProjectKey && (
                      <button onClick={() => refetchJira()} style={{
                        padding: "4px 8px", borderRadius: 8, border: "none", cursor: "pointer",
                        background: "#F1F5F9", color: C.textSecondary, fontSize: 11,
                      }} title="Refrescar desde JIRA">
                        <RefreshCw size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {jiraLoading ? (
                  <div style={{ textAlign: "center", padding: 30 }}><Loader2 size={24} className="animate-spin" color={C.accent} /></div>
                ) : jiraData && !jiraData.jiraUnavailable ? (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                          <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" }}>Issue JIRA</th>
                          <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" }}>Tarea</th>
                          <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" }}>Tipo</th>
                          <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" }}>Fecha Límite</th>
                          <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" }}>Estado JIRA</th>
                          <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" }}>Asignado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jiraData.workItems.map((item: any) => {
                          const statusCat = item.jiraStatusCategory ?? "new";
                          const sc = jiraStatusColors[statusCat] ?? jiraStatusColors.new;
                          const isOverdue = item.jiraDueDate && new Date(item.jiraDueDate) < new Date() && statusCat !== "done";
                          return (
                            <tr key={item.id} style={{ borderBottom: `1px solid ${C.border}`, background: isOverdue ? "#FEF2F2" : "transparent" }}>
                              <td style={{ padding: "8px 10px" }}>
                                {item.jiraIssueKey ? (
                                  <a href={`${jiraBase}${item.jiraIssueKey}`} target="_blank" rel="noopener noreferrer"
                                    style={{ fontSize: 11, fontWeight: 700, color: C.accent, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                                    {item.jiraIssueKey} <ExternalLink size={10} />
                                  </a>
                                ) : (
                                  <span style={{ fontSize: 10, color: C.textMuted }}>Sin sync</span>
                                )}
                              </td>
                              <td style={{ padding: "8px 10px" }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: C.textPrimary }}>{item.jiraSummary ?? item.title}</span>
                              </td>
                              <td style={{ padding: "8px 10px" }}>
                                <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4, background: "#F1F5F9", color: C.textSecondary }}>
                                  {item.itemType}
                                </span>
                              </td>
                              <td style={{ padding: "8px 10px" }}>
                                <span style={{ fontSize: 11, color: isOverdue ? "#DC2626" : C.textSecondary, fontWeight: isOverdue ? 700 : 400 }}>
                                  {item.jiraDueDate ? new Date(item.jiraDueDate).toLocaleDateString("es-CL") : item.dueDate ? new Date(item.dueDate).toLocaleDateString("es-CL") : "—"}
                                  {isOverdue && " ⚠"}
                                </span>
                              </td>
                              <td style={{ padding: "8px 10px" }}>
                                <span style={{
                                  fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                                  background: sc.bg, color: sc.fg,
                                }}>
                                  {item.jiraStatus ?? item.status}
                                </span>
                              </td>
                              <td style={{ padding: "8px 10px" }}>
                                <span style={{ fontSize: 11, color: C.textSecondary }}>{item.jiraAssignee ?? "—"}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {jiraData.workItems.length === 0 && (
                      <p style={{ fontSize: 12, color: C.textMuted, textAlign: "center", padding: 20 }}>Sin actividades en el plan de trabajo</p>
                    )}
                  </div>
                ) : (
                  /* Fallback: local work items */
                  <div style={{ display: "grid", gap: 6 }}>
                    {jiraData?.jiraUnavailable && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: "#FEF3C7", border: "1px solid #FDE68A", marginBottom: 8 }}>
                        <Info size={14} color="#92400E" />
                        <span style={{ fontSize: 11, color: "#92400E" }}>
                          {jiraData.error ? `JIRA no disponible: ${jiraData.error}` : "Sin proyecto JSM vinculado. Mostrando datos locales."}
                        </span>
                      </div>
                    )}
                    {db.workItems?.map((item: any) => (
                      <div key={item.id} style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "10px 14px", borderRadius: 8, background: "#F8FAFC", border: `1px solid ${C.border}`,
                      }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: C.textPrimary }}>{item.title}</span>
                          {item.frequency && <span style={{ fontSize: 10, color: C.textMuted, marginLeft: 8 }}>{item.frequency}</span>}
                        </div>
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                          background: item.status === "completado" ? "#DCFCE7" : item.status === "en_progreso" ? "#DBEAFE" : "#F1F5F9",
                          color: item.status === "completado" ? "#166534" : item.status === "en_progreso" ? "#1E40AF" : C.textMuted,
                        }}>
                          {item.status?.toUpperCase() ?? "PENDIENTE"}
                        </span>
                      </div>
                    ))}
                    {(!db.workItems || db.workItems.length === 0) && (
                      <p style={{ fontSize: 12, color: C.textMuted, textAlign: "center", padding: 20 }}>Sin ítems en el plan de trabajo</p>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ── TAB: Detalle Facturación ── */}
            {mainTab === "facturacion" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                    <DollarSign size={16} />
                    Detalle de Facturación
                  </h3>
                </div>

                {/* Billing table */}
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                        {svc.jsmProjectKey && <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" }}>Issue JIRA</th>}
                        <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" }}>Mes</th>
                        <th style={{ textAlign: "right", padding: "8px 10px", fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" }}>Monto</th>
                        <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" }}>Fecha Vencimiento</th>
                        <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" }}>Estado</th>
                        <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" }}>N° Factura</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(jiraData && !jiraData.jiraUnavailable ? jiraData.billingItems : db.billing)?.map((m: any) => {
                        const billingColors: Record<string, { bg: string; fg: string }> = {
                          pendiente: { bg: "#FEF3C7", fg: "#92400E" },
                          facturado: { bg: "#DBEAFE", fg: "#1E40AF" },
                          pagado: { bg: "#DCFCE7", fg: "#166534" },
                        };
                        const bc = billingColors[m.status] ?? billingColors.pendiente;
                        const isOverdue = m.status === "pendiente" && m.dueDate && new Date(m.dueDate) < new Date();
                        return (
                          <tr key={m.id} style={{ borderBottom: `1px solid ${C.border}`, background: isOverdue ? "#FEF2F2" : "transparent" }}>
                            {svc.jsmProjectKey && (
                              <td style={{ padding: "8px 10px" }}>
                                {m.jiraIssueKey ? (
                                  <a href={`${jiraBase}${m.jiraIssueKey}`} target="_blank" rel="noopener noreferrer"
                                    style={{ fontSize: 11, fontWeight: 700, color: C.accent, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                                    {m.jiraIssueKey} <ExternalLink size={10} />
                                  </a>
                                ) : (
                                  <span style={{ fontSize: 10, color: C.textMuted }}>—</span>
                                )}
                              </td>
                            )}
                            <td style={{ padding: "8px 10px", fontWeight: 600 }}>Mes {m.monthNumber}</td>
                            <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700 }}>{m.currency ?? svc.currency} {parseFloat(m.amount).toLocaleString()}</td>
                            <td style={{ padding: "8px 10px" }}>
                              <span style={{ fontSize: 11, color: isOverdue ? "#DC2626" : C.textSecondary, fontWeight: isOverdue ? 700 : 400 }}>
                                {m.dueDate ? new Date(m.dueDate).toLocaleDateString("es-CL") : "—"}
                                {isOverdue && " ⚠ Vencida"}
                              </span>
                            </td>
                            <td style={{ padding: "8px 10px" }}>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: bc.bg, color: bc.fg }}>
                                {m.status.toUpperCase()}
                              </span>
                            </td>
                            <td style={{ padding: "8px 10px", fontSize: 11, color: C.textSecondary }}>
                              {m.invoiceNumber ?? "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {(!db.billing || db.billing.length === 0) && (
                    <p style={{ fontSize: 12, color: C.textMuted, textAlign: "center", padding: 20 }}>Sin hitos de facturación</p>
                  )}
                </div>

                {/* Penalties section */}
                {(db.penalties?.length ?? 0) > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                      <AlertTriangle size={14} color={C.red} />
                      Multas ({db.penalties.length})
                    </h4>
                    <div style={{ display: "grid", gap: 6 }}>
                      {db.penalties.map((p: any) => (
                        <div key={p.id} style={{
                          padding: "10px 14px", borderRadius: 8, background: "#FEF2F2", border: "1px solid #FECACA",
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "#991B1B" }}>{p.description}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: C.red }}>{p.currency ?? svc.currency} {parseFloat(String(p.amount ?? 0)).toLocaleString()}</span>
                          </div>
                          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                            <span style={{ fontSize: 10, color: "#B91C1C" }}>{p.penaltyDate ? new Date(p.penaltyDate).toLocaleDateString("es-CL") : "—"}</span>
                            <span style={{
                              fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                              background: p.status === "resuelta" ? "#DCFCE7" : p.status === "disputada" ? "#FEF3C7" : "#FEF2F2",
                              color: p.status === "resuelta" ? "#166534" : p.status === "disputada" ? "#92400E" : "#991B1B",
                            }}>
                              {p.status?.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
