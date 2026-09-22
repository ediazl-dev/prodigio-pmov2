import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, RefreshCw, Sparkles, AlertTriangle, ChevronDown, ChevronUp,
  History, Clock, ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";
import AppBreadcrumb from "@/components/AppBreadcrumb";
import { ProjectIdBadge } from "@/components/ProjectIdBadge";
import { useParams } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, Legend,
} from "recharts";

/* ─── Palette ─── */
const C = {
  navy: "#0A1628", navy2: "#112240", navy3: "#1A3358",
  blue: "#1B4F8A", blue2: "#2563AB", accent: "#3B8EE8",
  teal: "#0D7A6B", teal2: "#12A08D",
  gold: "#B8860B", gold2: "#D4A017",
  red: "#B83232", green: "#1A7A4A",
  g100: "#F4F7FB", g150: "#EBF0F7", g200: "#D8E2EF", g300: "#B0BDD0", g400: "#7A8FA8",
};

/* ─── Helpers ─── */
function fmtUF(v: number | null | undefined): string {
  if (v == null) return "N/D";
  return `${v.toLocaleString("es-CL", { maximumFractionDigits: 0 })} UF`;
}
function fmtPct(v: number | null | undefined, decimals = 1): string {
  if (v == null) return "N/D";
  return `${v.toFixed(decimals)}%`;
}
function pctOf(v: number | null | undefined): number {
  if (v == null) return 0;
  // Values from DB are stored as ratios: 0.95 = 95%, 1.506 = 150.6%
  // Always multiply by 100 to get percentage
  return v * 100;
}

/* ─── Sub-components ─── */

function HealthSemaphore({ healthLabel, availability }: {
  healthLabel: string | null;
  availability: string;
}) {
  const normalized = healthLabel?.toLowerCase() ?? "";
  const health = normalized.includes("rojo") || normalized.includes("crít")
    ? { cls: "rojo", label: healthLabel ?? "Rojo", color: "#E53935", bgLight: "#FFEBEE" }
    : normalized.includes("amarillo") || normalized.includes("naranjo") || normalized.includes("riesgo")
      ? { cls: "amarillo", label: healthLabel ?? "En riesgo", color: "#F39C12", bgLight: "#FFF8E1" }
      : normalized.includes("verde") || normalized.includes("estable")
        ? { cls: "verde", label: healthLabel ?? "Estable", color: "#27AE60", bgLight: "#E8F5E9" }
        : { cls: "ninguno", label: "N/D", color: C.g400, bgLight: C.g150 };

  return (
    <div className="flex flex-col gap-3" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".09em", color: C.g400 }}>
          Salud del Proyecto
        </span>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "2px 10px", borderRadius: 20,
          background: health.bgLight, color: health.color, letterSpacing: ".05em",
        }}>
          {health.label}
        </span>
      </div>
      <div className="flex items-center gap-4">
        {/* Semáforo */}
        <div style={{
          background: "#111827", borderRadius: 10, padding: "8px 9px",
          display: "flex", flexDirection: "column", gap: 6, alignItems: "center",
          border: "1.5px solid #1F2937", boxShadow: "0 2px 8px rgba(0,0,0,.3)",
        }}>
          {["rojo", "amarillo", "verde"].map(c => (
            <div key={c} style={{
              width: 22, height: 22, borderRadius: "50%",
              background: health.cls === c
                ? (c === "verde" ? "#27AE60" : c === "amarillo" ? "#F39C12" : "#E53935")
                : "#1F2937",
              boxShadow: health.cls === c
                ? `0 0 10px ${c === "verde" ? "rgba(39,174,96,.7)" : c === "amarillo" ? "rgba(243,156,18,.7)" : "rgba(229,57,53,.7)"}`
                : "none",
              transition: "all .4s",
            }} />
          ))}
        </div>
        <div className="flex-1 flex flex-col gap-2">
          <div style={{ fontSize: 14, fontWeight: 800, color: health.color }}>{health.label}</div>
          <p style={{ fontSize: 10, color: C.g400 }}>Fuente: snapshot Jira · {availability}</p>
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, sub, borderColor, valueColor }: {
  label: string; value: string; sub?: string; borderColor: string; valueColor: string;
}) {
  return (
    <div style={{
      background: "#fff", borderRadius: 12, padding: "18px 20px 16px",
      boxShadow: "0 2px 16px rgba(10,22,40,.08)", borderTop: `3px solid ${borderColor}`,
      display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 100,
    }}>
      <div>
        <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".09em", color: C.g400, marginBottom: 6 }}>
          {label}
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.5px", lineHeight: 1, color: valueColor }}>
          {value}
        </div>
      </div>
      {sub && <div style={{ fontSize: 10.5, color: C.g400, marginTop: 7 }}>{sub}</div>}
    </div>
  );
}

function InsightBox({ type, icon, children }: { type: "ok" | "warn" | "info" | "danger"; icon: string; children: React.ReactNode }) {
  const cfg = {
    ok: { bg: "#E8F5E9", border: C.teal },
    warn: { bg: "#FFF8E1", border: C.gold },
    info: { bg: "#EBF5FB", border: C.accent },
    danger: { bg: "#FFEBEE", border: C.red },
  };
  const c = cfg[type];
  return (
    <div style={{ borderRadius: 9, padding: "11px 14px", display: "flex", gap: 10, alignItems: "flex-start", background: c.bg, borderLeft: `3px solid ${c.border}`, marginTop: 12 }}>
      <span style={{ fontSize: 15, flexShrink: 0 }}>{icon}</span>
      <div style={{ fontSize: 11, color: C.g400, lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

function CapacityBar({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div className="flex justify-between items-center" style={{ marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: C.navy }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>{value}</span>
      </div>
      <div style={{ height: 7, background: C.g200, borderRadius: 10, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 10 }} />
      </div>
    </div>
  );
}

function RankItem({ pos, deal, client, pct, isHighlighted }: {
  pos: number; deal: string; client: string; pct: number; isHighlighted: boolean;
}) {
  const numBg = isHighlighted ? "rgba(13,122,107,.15)" : pos <= 3 ? "#FFF8E1" : C.g150;
  const numColor = isHighlighted ? C.teal : pos <= 3 ? C.gold : C.g400;
  const barColor = isHighlighted ? C.teal : C.g300;
  const pctColor = isHighlighted ? C.teal : C.g400;
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "26px 1fr 90px 44px", gap: 8, alignItems: "center",
      padding: "8px 0", borderBottom: `1px solid ${C.g150}`,
      ...(isHighlighted ? { background: "rgba(13,122,107,.05)", borderRadius: 8, padding: "8px 8px", border: "1.5px solid rgba(13,122,107,.18)" } : {}),
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, fontWeight: 800, background: numBg, color: numColor,
      }}>{pos}</div>
      <div style={{ fontSize: 11, fontWeight: isHighlighted ? 700 : 600, color: isHighlighted ? C.teal : C.navy }}>{deal} · {client}</div>
      <div style={{ height: 6, background: C.g200, borderRadius: 10, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(Math.abs(pct), 100)}%`, background: barColor, borderRadius: 10 }} />
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, textAlign: "right", color: pctColor }}>{pct.toFixed(1)}%</div>
    </div>
  );
}

/* ─── Main Component ─── */

export default function LinkedProjectDashboard() {
  const params = useParams<{ id: string }>();
  const projectId = Number(params.id);

  const dashQ = trpc.advance.getLinkedDashboard.useQuery({ projectId }, { retry: 1, staleTime: 60000 });
  const [verdict, setVerdict] = useState<any>(null);
  const [agenticAnalysis, setAgenticAnalysis] = useState<any>(null);
  const [generatingVerdict, setGeneratingVerdict] = useState(false);
  const [generatingAgenticAnalysis, setGeneratingAgenticAnalysis] = useState(false);
  const [showVerdict, setShowVerdict] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null);

  const verdictMut = trpc.advance.generateLinkedVerdict.useMutation();
  const agenticAnalysisMut = trpc.advance.generatePMAnalysis.useMutation();

  // Auto-load latest saved verdict from DB
  const latestVerdictQ = trpc.advance.getLatestVerdict.useQuery({ projectId }, { staleTime: 60000 });
  const latestAgenticAnalysisQ = trpc.advance.getLatestAgenticAnalysis.useQuery({ projectId }, { staleTime: 60000 });
  const agenticAnalysisHistoryQ = trpc.advance.getAgenticAnalysisHistory.useQuery({ projectId, limit: 10 }, { staleTime: 60000 });
  const verdictHistoryQ = trpc.advance.getVerdictHistory.useQuery({ projectId, limit: 20 }, { staleTime: 60000, enabled: showHistory });
  const verdictDetailQ = trpc.advance.getVerdictDetail.useQuery(
    { verdictId: selectedHistoryId! },
    { enabled: !!selectedHistoryId, staleTime: 60000 }
  );

  // Auto-populate verdict from DB on first load (if no fresh verdict generated)
  useEffect(() => {
    if (!verdict && latestVerdictQ.data?.data) {
      setVerdict(latestVerdictQ.data.data);
    }
  }, [latestVerdictQ.data]);

  useEffect(() => {
    if (latestAgenticAnalysisQ.data?.found) {
      setAgenticAnalysis(latestAgenticAnalysisQ.data.analysis);
    }
  }, [latestAgenticAnalysisQ.data]);

  // When a historical verdict is selected, populate it
  useEffect(() => {
    if (verdictDetailQ.data?.data) {
      setVerdict(verdictDetailQ.data.data);
      setShowVerdict(true);
    }
  }, [verdictDetailQ.data]);

  // All useMemo hooks MUST be before any conditional returns (React rules of hooks)
  const portfolioRanking = useMemo(() => {
    const p = dashQ.data?.financial?.portfolioContext;
    if (!p || !p.totalActiveProjects) return [];
    return [];
  }, [dashQ.data?.financial?.portfolioContext]);

  // Compute verdict metadata for display
  const verdictMeta = useMemo(() => {
    if (selectedHistoryId && verdictDetailQ.data) {
      return {
        id: verdictDetailQ.data.id,
        createdAt: verdictDetailQ.data.createdAt,
        generatedByName: verdictDetailQ.data.generatedByName,
        semaphore: verdictDetailQ.data.semaphore,
        metricsSnapshot: verdictDetailQ.data.metricsSnapshot as any,
        isHistorical: true,
      };
    }
    if (latestVerdictQ.data) {
      return {
        id: latestVerdictQ.data.id,
        createdAt: latestVerdictQ.data.createdAt,
        generatedByName: latestVerdictQ.data.generatedByName,
        semaphore: latestVerdictQ.data.semaphore,
        metricsSnapshot: latestVerdictQ.data.metricsSnapshot as any,
        isHistorical: false,
      };
    }
    return null;
  }, [latestVerdictQ.data, verdictDetailQ.data, selectedHistoryId]);

  async function handleGenerateVerdict() {
    setGeneratingVerdict(true);
    try {
      const result = await verdictMut.mutateAsync({ projectId });
      setVerdict(result.data);
      setShowVerdict(true);
      setSelectedHistoryId(null);
      // Refetch latest and history after generation
      latestVerdictQ.refetch();
      verdictHistoryQ.refetch();
      toast.success("Veredicto ejecutivo generado y guardado");
    } catch (e: any) {
      toast.error(e.message || "Error al generar veredicto");
    } finally {
      setGeneratingVerdict(false);
    }
  }

  async function handleGenerateAgenticAnalysis() {
    setGeneratingAgenticAnalysis(true);
    try {
      const result = await agenticAnalysisMut.mutateAsync({ projectId });
      setAgenticAnalysis(result.analysis);
      await latestAgenticAnalysisQ.refetch();
      await agenticAnalysisHistoryQ.refetch();
      toast.success("Análisis PM agéntico generado y guardado");
    } catch (e: any) {
      toast.error(e.message || "Error al generar análisis PM agéntico");
    } finally {
      setGeneratingAgenticAnalysis(false);
    }
  }

  const breadcrumbs = [
    { label: "PMO Proyectos", href: "/projects" },
    { label: dashQ.data?.project?.name || "...", href: `/projects/${projectId}` },
    { label: "Dashboard Ejecutivo" },
  ];

  if (dashQ.isLoading) {
    return (
      <div className="p-6 space-y-4">
        <AppBreadcrumb segments={breadcrumbs} />
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-10 w-10 animate-spin" style={{ color: C.accent }} />
          <p style={{ color: C.g400, fontSize: 14 }}>Cargando dashboard ejecutivo...</p>
          <p style={{ color: C.g300, fontSize: 12 }}>Consultando JIRA y datos financieros</p>
        </div>
      </div>
    );
  }

  if (dashQ.isError) {
    return (
      <div className="p-6 space-y-4">
        <AppBreadcrumb segments={breadcrumbs} />
        <div style={{ background: "#FFF8E1", border: "1px solid #FFE082", borderRadius: 12, padding: 24 }}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 mt-0.5" style={{ color: C.gold }} />
            <div>
              <p style={{ fontWeight: 600, color: C.navy }}>No se pudo cargar el dashboard</p>
              <p style={{ fontSize: 13, color: C.g400, marginTop: 4 }}>{dashQ.error?.message}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => dashQ.refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" /> Reintentar
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const data = dashQ.data!;
  const { jira, financial, project, hasJira, platformStageData, portfolioEvidence: evidence, jiraFetchStatus } = data as any;
  const fin = financial?.projectFinancial;
  const alerts = (financial?.alerts || []) as Array<{ type: string; category: string; title: string; description: string; value?: string }>;
  const portfolio = financial?.portfolioContext;

  // Derived KPIs
  const budgetPct = fin?.utilizadoUFPorc ? pctOf(fin.utilizadoUFPorc) : 0;
  const marginPct = fin?.margenProyectadoPorc ? pctOf(fin.margenProyectadoPorc) : 0;
  const targetPct = fin?.margenTargetPorc ? pctOf(fin.margenTargetPorc) : 0;
  const avancePct = fin?.porcentajeAvanceProyecto ? pctOf(fin.porcentajeAvanceProyecto) : 0;
  const brechaMargen = marginPct - targetPct;
  const marginCapacityPct = fin?.margenProyectadoSegunCapacity ? pctOf(fin.margenProyectadoSegunCapacity) : null;
  const brechaCapacity = marginCapacityPct !== null ? marginCapacityPct - targetPct : null;
  const criticalAlerts = alerts.filter(a => a.type === "critical");
  const estado = evidence?.status ?? "N/D";
  const isClosed = estado === "completado";

  // Milestones
  const milestonesPct = jira.milestones.length > 0
    ? Math.round((jira.milestonesCumplidos / jira.milestones.length) * 100) : 0;
  const hasClientMilestones = hasJira && jira.milestones.length > 0;
  const clientMilestonePct = jira.milestoneCompletionPct ?? milestonesPct;
  const primaryProgressPct = evidence?.operationalProgressPct ?? null;
  const primaryProgressLabel = "Avance Operativo JIRA";

  // Financial chart data
  const finChartData = fin ? [
    { name: "Valor\nVenta", value: fin.valorVentaUF || 0, fill: C.navy },
    { name: "Presupuesto\nAsignado", value: fin.presupuestoUF || 0, fill: C.blue },
    { name: "Costo\nEjecutado", value: fin.utilizadoUF || 0, fill: C.gold },
    { name: "Margen\nNota Venta", value: fin.margenBrutoNotaVentaUF || 0, fill: C.blue2 },
    { name: "Margen\nProyectado", value: fin.margenProyectadoUF || 0, fill: C.teal },
  ] : [];

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: C.g100, minHeight: "100vh", fontSize: 13, lineHeight: 1.5, color: C.navy }}>
      <div className="p-4">
        <AppBreadcrumb segments={breadcrumbs} />
      </div>

      {/* ═══ HEADER ═══ */}
      <div style={{
        background: `linear-gradient(160deg, ${C.navy} 0%, ${C.navy2} 55%, ${C.navy3} 100%)`,
        borderBottom: `3px solid ${C.accent}`,
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 0, padding: "22px 36px 18px", alignItems: "center" }}>
          <div>
            <div className="flex items-center gap-2.5" style={{ marginBottom: 8 }}>
              <span style={{
                background: "rgba(59,142,232,.15)", border: "1px solid rgba(59,142,232,.35)",
                borderRadius: 20, padding: "3px 12px", fontSize: 10, fontWeight: 700,
                color: C.accent, letterSpacing: ".1em", textTransform: "uppercase",
              }}>Comité Ejecutivo</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,.45)", fontWeight: 500 }}>
                · {new Date().toLocaleDateString("es-CL", { month: "long", year: "numeric" })} · Reporte de {isClosed ? "Cierre" : "Avance"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-.5px", lineHeight: 1.15 }}>
                {project.name}
              </h1>
              <ProjectIdBadge projectId={projectId} tone="dark" />
            </div>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginTop: 4 }}>
              {project.dealId || "Deal N/D"} · PM: {evidence?.pmName ?? "N/D"} · Cliente: {project.client || fin?.clientName || "N/D"} · Pipeline PMO: {evidence?.stageLabel ?? "N/D"}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-4">
              <span style={{ fontSize: 11, color: "rgba(255,255,255,.45)" }}>
                <strong style={{ color: "rgba(255,255,255,.8)", fontWeight: 600 }}>Avance Jira:</strong> {primaryProgressPct != null ? `${primaryProgressPct}%` : "N/D"}
              </span>
              {project.jiraProjectKey && (
                <span style={{ fontSize: 11, color: "rgba(255,255,255,.45)" }}>
                  <strong style={{ color: "rgba(255,255,255,.8)", fontWeight: 600 }}>JIRA:</strong> {project.jiraProjectKey}
                </span>
              )}
            </div>
            <div style={{
              background: isClosed ? C.g400 : C.teal, color: "#fff", borderRadius: 20,
              padding: "6px 18px", fontSize: 11, fontWeight: 700, letterSpacing: ".07em",
              textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6,
              boxShadow: `0 0 0 3px ${isClosed ? "rgba(122,143,168,.25)" : "rgba(13,122,107,.25)"}`,
            }}>
              {isClosed ? "✓" : "●"} {estado}
            </div>
            <div className="flex gap-2 mt-1">
              <Button variant="ghost" size="sm" onClick={() => dashQ.refetch()} disabled={dashQ.isFetching}
                style={{ color: "rgba(255,255,255,.6)", fontSize: 11 }}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${dashQ.isFetching ? "animate-spin" : ""}`} /> Actualizar
              </Button>
              <Button size="sm" onClick={handleGenerateVerdict} disabled={generatingVerdict}
                style={{ background: C.accent, color: "#fff", fontSize: 11 }}>
                {generatingVerdict ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                {verdict ? "Regenerar Veredicto Ejecutivo" : "Veredicto Ejecutivo"}
              </Button>
              {latestVerdictQ.data && (
                <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)}
                  style={{ color: "rgba(255,255,255,.6)", fontSize: 11 }}>
                  <History className="h-3.5 w-3.5 mr-1.5" /> Historial
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Verdict role insights - shown below header */}
        {verdict && (verdict.ctoInsights || verdict.cfoInsights || verdict.commercialInsights) && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderTop: "1px solid rgba(255,255,255,.07)" }}>
            {[
              { role: "CTO", color: "#64B5F6", dotColor: "#64B5F6", insights: verdict.ctoInsights },
              { role: "CFO", color: "#81C784", dotColor: "#81C784", insights: verdict.cfoInsights },
              { role: "Dir. Comercial", color: "#FFB74D", dotColor: "#FFB74D", insights: verdict.commercialInsights },
            ].map((v, i) => (
              <div key={i} style={{ padding: "16px 24px 18px", borderRight: i < 2 ? "1px solid rgba(255,255,255,.07)" : "none" }}>
                <div className="flex items-center gap-1.5" style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", color: v.color, marginBottom: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: v.dotColor, flexShrink: 0 }} />
                  Para el {v.role}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 8, lineHeight: 1.3 }}>
                  {v.insights?.title || `Perspectiva ${v.role}`}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {v.insights?.bullets?.map((bullet: string, bi: number) => {
                    const tagMatch = bullet.match(/^\[([^\]]+)\]\s*(.*)/);
                    const tag = tagMatch?.[1] || "";
                    const text = tagMatch?.[2] || bullet;
                    const tagColors: Record<string, { bg: string; color: string }> = {
                      "Fortaleza": { bg: "rgba(39,174,96,.2)", color: "#81C784" },
                      "Oportunidad": { bg: "rgba(59,142,232,.2)", color: "#64B5F6" },
                      "Riesgo": { bg: "rgba(229,57,53,.2)", color: "#EF9A9A" },
                      "Acci\u00f3n": { bg: "rgba(243,156,18,.2)", color: "#FFB74D" },
                      "Dato Clave": { bg: "rgba(59,142,232,.2)", color: "#90CAF9" },
                      "Modelo Replicable": { bg: "rgba(13,122,107,.2)", color: "#80CBC4" },
                      "Alerta": { bg: "rgba(229,57,53,.2)", color: "#EF9A9A" },
                    };
                    const tc = tagColors[tag] || { bg: "rgba(255,255,255,.1)", color: "rgba(255,255,255,.6)" };
                    return (
                      <div key={bi} className="flex items-start gap-2" style={{ fontSize: 10.5, color: "rgba(255,255,255,.6)", lineHeight: 1.45 }}>
                        <span style={{ flexShrink: 0, marginTop: 1 }}>•</span>
                        <div>
                          {tag && (
                            <span style={{
                              display: "inline-block", fontSize: 8.5, fontWeight: 700, padding: "1px 7px",
                              borderRadius: 8, background: tc.bg, color: tc.color,
                              marginRight: 5, letterSpacing: ".03em", verticalAlign: "middle",
                            }}>{tag}</span>
                          )}
                          <span>{text}</span>
                        </div>
                      </div>
                    );
                  }) || (
                    <p style={{ fontSize: 10.5, color: "rgba(255,255,255,.45)", lineHeight: 1.45 }}>
                      {verdict[v.role === "CTO" ? "ceoInsight" : v.role === "CFO" ? "cfoInsight" : "commercialInsight"] || "Genere el veredicto IA para ver insights"}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {/* Legacy fallback: simple text verdicts (old format) */}
        {verdict && !verdict.ctoInsights && (verdict.ceoInsight || verdict.cfoInsight || verdict.commercialInsight) && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderTop: "1px solid rgba(255,255,255,.07)" }}>
            {[
              { role: "CTO", color: "#64B5F6", key: "ceoInsight" },
              { role: "CFO", color: "#81C784", key: "cfoInsight" },
              { role: "Comercial", color: "#FFB74D", key: "commercialInsight" },
            ].map((v, i) => (
              <div key={i} style={{ padding: "14px 24px 16px", borderRight: i < 2 ? "1px solid rgba(255,255,255,.07)" : "none" }}>
                <div className="flex items-center gap-1.5" style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", color: v.color, marginBottom: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: v.color, flexShrink: 0 }} />
                  Para el {v.role}
                </div>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,.55)", lineHeight: 1.45 }}>
                  {verdict[v.key] || ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div style={{ padding: "20px 28px 32px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* PM Agentic Analysis — SoW + Gantt + JIRA */}
        <section style={{ background: "#fff", border: `1px solid ${C.g200}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 10px rgba(10,22,40,.05)" }}>
          <div style={{ padding: "14px 18px", background: C.navy, color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div className="flex items-center gap-2" style={{ fontSize: 14, fontWeight: 800 }}>
                <Sparkles className="h-4 w-4" style={{ color: "#80CBC4" }} /> Análisis PM Agéntico
              </div>
              <p style={{ margin: "3px 0 0", fontSize: 10.5, color: "rgba(255,255,255,.65)" }}>Cruza SoW, Gantt, avance JIRA y datos financieros para orientar al PM.</p>
            </div>
            <Button size="sm" onClick={handleGenerateAgenticAnalysis} disabled={generatingAgenticAnalysis}
              style={{ background: C.teal2, color: "#fff", fontSize: 11, flexShrink: 0 }}>
              {generatingAgenticAnalysis ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
              {agenticAnalysis ? "Regenerar Análisis PM" : "Generar Análisis PM"}
            </Button>
          </div>
          {agenticAnalysis ? (
            <div style={{ padding: 18 }}>
              <div className="flex flex-wrap items-center justify-between gap-2" style={{ marginBottom: 12 }}>
                <div className="flex items-center gap-2">
                  <Badge style={{ background: agenticAnalysis.overallHealth === "ROJO" ? "#FDECEC" : agenticAnalysis.overallHealth === "AMARILLO" ? "#FFF5D6" : "#E8F5EE", color: agenticAnalysis.overallHealth === "ROJO" ? C.red : agenticAnalysis.overallHealth === "AMARILLO" ? C.gold : C.green, border: "none" }}>
                    {agenticAnalysis.overallHealth}
                  </Badge>
                  <span style={{ fontSize: 11, color: C.g400 }}>Cumplimiento SoW: <strong style={{ color: C.navy }}>{agenticAnalysis.sowComplianceScore}%</strong></span>
                  {latestAgenticAnalysisQ.data?.found && <span style={{ fontSize: 11, color: latestAgenticAnalysisQ.data.isStale ? C.gold : C.g400 }}>{latestAgenticAnalysisQ.data.isStale ? "Análisis con más de 5 días" : `Actualizado hace ${latestAgenticAnalysisQ.data.daysSince} día(s)`}</span>}
                </div>
                <span style={{ fontSize: 10.5, color: C.g400 }}>Historial: {agenticAnalysisHistoryQ.data?.length ?? 0} análisis válidos</span>
              </div>
              <p style={{ margin: "0 0 10px", color: C.navy, fontSize: 13, lineHeight: 1.55 }}>{agenticAnalysis.executiveSummary}</p>
              <p style={{ margin: "0 0 16px", color: C.g400, fontSize: 11.5, lineHeight: 1.45 }}>{agenticAnalysis.healthJustification}</p>
              <div style={{ background: agenticAnalysis.clientMilestoneCompletion.status === "CUMPLIDO" ? "#E8F5EE" : agenticAnalysis.clientMilestoneCompletion.status === "EN_RIESGO" ? "#FFF5D6" : "#FDECEC", borderLeft: `4px solid ${agenticAnalysis.clientMilestoneCompletion.status === "CUMPLIDO" ? C.green : agenticAnalysis.clientMilestoneCompletion.status === "EN_RIESGO" ? C.gold : C.red}`, borderRadius: 8, padding: "11px 13px", marginBottom: 14 }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong style={{ color: C.navy, fontSize: 11 }}>MÉTRICA PRINCIPAL · CUMPLIMIENTO DE HITOS CLIENTE</strong>
                  <span style={{ color: C.navy, fontSize: 13, fontWeight: 800 }}>{agenticAnalysis.clientMilestoneCompletion.closed}/{agenticAnalysis.clientMilestoneCompletion.total} · {agenticAnalysis.clientMilestoneCompletion.percentage}%</span>
                </div>
                <p style={{ margin: "5px 0 0", color: C.navy, fontSize: 11, lineHeight: 1.45 }}>{agenticAnalysis.clientMilestoneCompletion.assessment}</p>
                <p style={{ margin: "4px 0 0", color: C.g400, fontSize: 10.5, lineHeight: 1.4 }}><strong>Brecha operativa:</strong> {agenticAnalysis.clientMilestoneCompletion.operationalGap}</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div style={{ background: C.g100, borderRadius: 9, padding: 12 }}>
                  <strong style={{ display: "block", color: C.blue2, fontSize: 11, marginBottom: 6 }}>CUMPLIMIENTO DEL SOW</strong>
                  <p style={{ margin: 0, fontSize: 11, color: C.navy, lineHeight: 1.45 }}>{agenticAnalysis.sowCompliance.summary}</p>
                </div>
                <div style={{ background: C.g100, borderRadius: 9, padding: 12 }}>
                  <strong style={{ display: "block", color: C.teal, fontSize: 11, marginBottom: 6 }}>VALOR PARA EL CLIENTE</strong>
                  <p style={{ margin: 0, fontSize: 11, color: C.navy, lineHeight: 1.45 }}>{agenticAnalysis.valueDelivery.summary}</p>
                </div>
                <div style={{ background: C.g100, borderRadius: 9, padding: 12 }}>
                  <strong style={{ display: "block", color: C.gold, fontSize: 11, marginBottom: 6 }}>EJECUCIÓN OPERATIVA</strong>
                  <p style={{ margin: 0, fontSize: 11, color: C.navy, lineHeight: 1.45 }}>{agenticAnalysis.operationalAnalysis.paceDetail}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
                <div style={{ borderLeft: `3px solid ${C.red}`, paddingLeft: 10 }}>
                  <strong style={{ display: "block", color: C.red, fontSize: 11, marginBottom: 5 }}>RIESGOS Y ALERTAS</strong>
                  {agenticAnalysis.risksAndAlerts.slice(0, 3).map((risk: any, index: number) => <p key={index} style={{ margin: "0 0 4px", color: C.navy, fontSize: 11, lineHeight: 1.4 }}><strong>{risk.title}:</strong> {risk.recommendation}</p>)}
                </div>
                <div style={{ borderLeft: `3px solid ${C.teal}`, paddingLeft: 10 }}>
                  <strong style={{ display: "block", color: C.teal, fontSize: 11, marginBottom: 5 }}>ACCIONES DE ESTA SEMANA</strong>
                  {agenticAnalysis.weeklyActions.slice(0, 3).map((action: any, index: number) => <p key={index} style={{ margin: "0 0 4px", color: C.navy, fontSize: 11, lineHeight: 1.4 }}><strong>{action.priority}:</strong> {action.action}</p>)}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: "22px 18px", color: C.g400, fontSize: 12 }}>
              Aún no existe un análisis PM agéntico válido. Genera uno para cruzar el SoW, Gantt, avance JIRA y datos financieros.
            </div>
          )}
        </section>

        {/* Critical Alerts */}
        {criticalAlerts.length > 0 && (
          <div style={{ background: "#FFEBEE", border: "1px solid #FFCDD2", borderRadius: 12, padding: "12px 16px" }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.red }}>Alertas Críticas ({criticalAlerts.length})</span>
            </div>
            {criticalAlerts.map((a, i) => (
              <div key={i} style={{ fontSize: 12, color: "#B71C1C", marginLeft: 8, marginBottom: 4 }}>
                <strong>{a.title}:</strong> {a.description}
                {a.value && <Badge variant="outline" className="ml-2 text-xs" style={{ color: C.red, borderColor: "#EF9A9A" }}>{a.value}</Badge>}
              </div>
            ))}
          </div>
        )}

        {/* ═══ KPI ROW ═══ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr 260px", gap: 12, alignItems: "stretch" }}>
          <KPICard
            label="Fase Jira"
            value={evidence?.operationalPhase ?? "N/D"}
            sub={primaryProgressPct != null ? `Avance Jira ${primaryProgressPct}%` : `Evidencia ${evidence?.jiraEvidenceAvailability ?? "missing"}`}
            borderColor={C.teal}
            valueColor={C.teal}
          />
          <KPICard
            label="Hitos Jira"
            value={evidence?.milestonesFulfilled != null && evidence?.milestonesTotal != null ? `${evidence.milestonesFulfilled}/${evidence.milestonesTotal}` : "N/D"}
            sub={`Fuente: ${evidence?.milestoneSource ?? "missing"} · detalle ${jiraFetchStatus}`}
            borderColor={C.accent}
            valueColor={C.accent}
          />
          <KPICard
            label="Pipeline PMO"
            value={evidence?.stageLabel ?? "N/D"}
            sub={evidence ? `${evidence.stagesClosed}/${evidence.totalStages} etapas completadas` : "Sin evidencia PMO"}
            borderColor={C.blue2}
            valueColor={C.blue2}
          />
          <KPICard
            label="Project Manager"
            value={evidence?.pmName ?? "N/D"}
            sub={`Fuente: ${evidence?.pmSource ?? "missing"}`}
            borderColor={C.gold}
            valueColor={C.navy}
          />
          <KPICard
            label="Riesgos"
            value={evidence?.openRisks != null ? `${evidence.openRisks} abiertos` : "N/D"}
            sub={evidence?.highRisksOpen != null ? `${evidence.highRisksOpen} altos · ${evidence.riskSource}` : `Fuente: ${evidence?.riskSource ?? "missing"}`}
            borderColor={evidence?.highRisksOpen > 0 ? C.red : C.teal}
            valueColor={evidence?.highRisksOpen > 0 ? C.red : C.navy}
          />
          <KPICard
            label="Contratado"
            value={evidence?.amount != null && evidence?.currency ? `${evidence.currency} ${Number(evidence.amount).toLocaleString("es-CL")}` : "N/D"}
            sub={`Fuente: ${evidence?.amountSource ?? "missing"}`}
            borderColor={C.blue2}
            valueColor={C.blue2}
          />
          {/* Health Semaphore */}
          <div style={{
            background: "#fff", borderRadius: 12, padding: "14px 18px",
            boxShadow: "0 2px 16px rgba(10,22,40,.08)", borderTop: `3px solid ${C.green}`,
          }}>
            <HealthSemaphore
              healthLabel={evidence?.executiveHealth ?? null}
              availability={evidence?.jiraEvidenceAvailability ?? "missing"}
            />
          </div>
        </div>

        {/* ═══ SECTION: Análisis Financiero y JIRA ═══ */}
        <div className="flex items-center gap-2.5" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", color: C.g300 }}>
          {hasJira ? "Cumplimiento de Hitos Cliente, Finanzas y Control Operativo" : "Análisis Financiero y Avance del Proyecto"}
          <div style={{ flex: 1, height: 1, background: C.g200 }} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 16 }}>
          {/* Financial Structure Chart */}
          <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px", boxShadow: "0 2px 16px rgba(10,22,40,.08)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 2 }}>Estructura Financiera del Proyecto</div>
            <div style={{ fontSize: 10.5, color: C.g400, marginBottom: 14 }}>Valor de venta, presupuesto, costo ejecutado y márgenes (UF)</div>
            {fin ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={finChartData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.g200} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: C.g400 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: C.g400 }} axisLine={false} tickLine={false}
                      tickFormatter={(v: number) => v.toLocaleString("es-CL")} />
                    <Tooltip formatter={(v: number) => [`${v.toLocaleString("es-CL")} UF`, ""]}
                      contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={50}
                      label={{ position: "top", fontSize: 9, fontWeight: 700, fill: C.navy, formatter: (v: number) => `${v.toLocaleString("es-CL")} UF` }}>
                      {finChartData.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <InsightBox type={budgetPct <= 100 ? "ok" : "danger"} icon={budgetPct <= 100 ? "✅" : "⚠️"}>
                  El costo ejecutado (<strong>{fmtUF(fin.utilizadoUF)}</strong>) {budgetPct <= 100 ? "está dentro" : "excede"} del presupuesto (<strong>{fmtUF(fin.presupuestoUF)}</strong>),
                  representando un <strong>{fmtPct(budgetPct)}</strong> de utilización.
                  Margen proyectado: <strong>{fmtUF(fin.margenProyectadoUF)} ({fmtPct(marginPct)})</strong>.
                </InsightBox>
              </>
            ) : (
              <div style={{ padding: "40px 0", textAlign: "center", color: C.g400, fontSize: 12 }}>
                Sin datos financieros disponibles para este proyecto.
              </div>
            )}
          </div>

          {/* JIRA Progress & Milestones (or Platform data) */}
          <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px", boxShadow: "0 2px 16px rgba(10,22,40,.08)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 2 }}>{hasJira ? "Cumplimiento de Hitos Cliente y Control Operativo" : "Avance del Proyecto"}</div>
            <div style={{ fontSize: 10.5, color: C.g400, marginBottom: 14 }}>
              {hasJira ? `${jira.milestonesCumplidos}/${jira.milestones.length} hitos comprometidos (${clientMilestonePct}%) · ${jira.doneCount}/${jira.totalIssues} tareas internas (${jira.percentComplete}%)` : (platformStageData ? `${platformStageData.stages.filter((s: any) => s.status === 'completed').length}/${platformStageData.stages.length} etapas · ${platformStageData.wbsTaskCount} tareas WBS` : "Sin datos de avance")}
            </div>

            {hasJira ? (
              <>
                {/* Issues by status */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.g400, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>
                    Distribución por Estado
                  </div>
                  {jira.byStatus?.slice(0, 6).map((s: any, i: number) => {
                    const isDone = s.status.toLowerCase().includes("final") || s.status.toLowerCase().includes("done") || s.status.toLowerCase().includes("cerr") || s.status.toLowerCase().includes("cumplido");
                    const isWIP = s.status.toLowerCase().includes("progress") || s.status.toLowerCase().includes("activo") || s.status.toLowerCase().includes("curso");
                    const barColor = isDone ? C.teal : isWIP ? C.accent : C.g300;
                    return (
                      <div key={i} className="flex items-center gap-2 group/bar" style={{ marginBottom: 4, position: "relative" }}>
                        <span title={s.status} style={{ width: 90, fontSize: 10, color: C.g400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "default" }}>
                          {s.status}
                        </span>
                        <div title={`${s.status}: ${s.count} tareas (${s.percentage}%)`}
                          style={{ flex: 1, height: 5, background: C.g200, borderRadius: 10, overflow: "hidden", cursor: "default" }}>
                          <div style={{ height: "100%", width: `${s.percentage}%`, background: barColor, borderRadius: 10, transition: "width 0.3s ease" }} />
                        </div>
                        <span style={{ width: 50, textAlign: "right", fontSize: 10, fontWeight: 600 }}>{s.count} ({s.percentage}%)</span>
                      </div>
                    );
                  })}
                </div>

                {/* Milestones Timeline */}
                <div style={{ fontSize: 10, fontWeight: 700, color: C.g400, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>
                  Hitos PMO
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {jira.milestones.map((m: any, i: number) => {
                    const isDone = m.statusCategory === "Done";
                    return (
                      <div key={m.key} style={{ display: "grid", gridTemplateColumns: "28px 1fr", gap: 0, position: "relative" }}>
                        {i < jira.milestones.length - 1 && (
                          <div style={{ position: "absolute", left: 13, top: 28, bottom: 0, width: 2, background: C.g200 }} />
                        )}
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, fontWeight: 800, color: "#fff", flexShrink: 0, zIndex: 1, marginTop: 2,
                          background: isDone ? C.teal : C.g300,
                        }}>
                          {isDone ? "✓" : (i + 1)}
                        </div>
                        <div style={{ padding: "0 0 12px 12px" }}>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: C.navy }}>{m.summary}</div>
                          <div className="flex gap-2 mt-1 flex-wrap">
                            <span style={{
                              fontSize: 10, fontWeight: 600, padding: "2px 9px", borderRadius: 10,
                              background: isDone ? "#E8F5E9" : "#FFF8E1",
                              color: isDone ? C.teal : C.gold,
                            }}>
                              {m.status}
                            </span>
                            {m.percentage && (
                              <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 9px", borderRadius: 10, background: "#EBF5FB", color: C.blue2 }}>
                                {m.percentage}%
                              </span>
                            )}
                            {m.duedate ? (
                              <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 9px", borderRadius: 10, background: "#F3E8FF", color: "#7C3AED", display: "flex", alignItems: "center", gap: 3 }}>
                                <span>📅</span>
                                {new Date(m.duedate + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                            ) : (
                              <span style={{ fontSize: 10, fontWeight: 500, padding: "2px 9px", borderRadius: 10, background: "#F1F5F9", color: C.g400 }}>
                                Sin fecha
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {jira.milestones.length === 0 && (
                    <div style={{ padding: "16px 0", textAlign: "center", color: C.g400, fontSize: 11 }}>
                      No se encontraron hitos PMO en JIRA.
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Platform project: show stage progress and SoW summary */
              <>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.g400, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>
                    Progreso por Etapas
                  </div>
                  {platformStageData?.stages?.length > 0 ? platformStageData.stages.map((s: any, i: number) => {
                    const isCompleted = s.status === "completed";
                    const isActive = s.status === "active" || s.status === "in_progress";
                    const barColor = isCompleted ? C.teal : isActive ? C.accent : C.g300;
                    const pct = isCompleted ? 100 : isActive ? 50 : 0;
                    return (
                      <div key={i} className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                        <span style={{ width: 100, fontSize: 10, color: C.g400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {s.stageName || `Etapa ${i + 1}`}
                        </span>
                        <div style={{ flex: 1, height: 5, background: C.g200, borderRadius: 10, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 10, transition: "width 0.3s ease" }} />
                        </div>
                        <span style={{ width: 70, textAlign: "right", fontSize: 10, fontWeight: 600, color: isCompleted ? C.teal : isActive ? C.accent : C.g400 }}>
                          {isCompleted ? "Completada" : isActive ? "En curso" : "Pendiente"}
                        </span>
                      </div>
                    );
                  }) : (
                    <div style={{ padding: "16px 0", textAlign: "center", color: C.g400, fontSize: 11 }}>
                      Sin etapas registradas.
                    </div>
                  )}
                </div>

                {platformStageData?.sowSummary ? (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.g400, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>
                      Resumen SoW
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div style={{ background: C.g100, borderRadius: 8, padding: "10px 14px" }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: C.navy }}>{platformStageData.sowSummary.deliverables}</div>
                        <div style={{ fontSize: 10, color: C.g400 }}>Entregables</div>
                      </div>
                      <div style={{ background: C.g100, borderRadius: 8, padding: "10px 14px" }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: C.navy }}>{platformStageData.sowSummary.milestones}</div>
                        <div style={{ fontSize: 10, color: C.g400 }}>Hitos de Pago</div>
                      </div>
                      <div style={{ background: C.g100, borderRadius: 8, padding: "10px 14px" }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: C.teal }}>{platformStageData.sowSummary.totalAmount.toLocaleString("es-CL")} {platformStageData.sowSummary.currency}</div>
                        <div style={{ fontSize: 10, color: C.g400 }}>Monto Total SoW</div>
                      </div>
                      <div style={{ background: C.g100, borderRadius: 8, padding: "10px 14px" }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: C.accent }}>{platformStageData.wbsTaskCount}</div>
                        <div style={{ fontSize: 10, color: C.g400 }}>Tareas WBS</div>
                      </div>
                    </div>
                    {platformStageData.sowSummary.generalObjective && (
                      <div style={{ marginTop: 10, fontSize: 11, color: C.g400, fontStyle: "italic", lineHeight: 1.5 }}>
                        <strong style={{ color: C.navy }}>Objetivo:</strong> {platformStageData.sowSummary.generalObjective}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ padding: "20px 0", textAlign: "center", color: C.g400, fontSize: 11 }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>📋</div>
                    <p style={{ fontWeight: 600, color: C.navy, marginBottom: 4 }}>Sin JIRA vinculado</p>
                    <p>Complete la etapa de Creación JIRA para ver datos de avance detallados.</p>
                    <p style={{ marginTop: 4 }}>El Veredicto IA aún puede generarse usando los datos de SoW y planificación.</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ═══ SECTION: Márgenes, Capacity y Portafolio ═══ */}
        <div className="flex items-center gap-2.5" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", color: C.g300 }}>
          Márgenes, Capacity y Equipo
          <div style={{ flex: 1, height: 1, background: C.g200 }} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          {/* Margins Analysis */}
          <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px", boxShadow: "0 2px 16px rgba(10,22,40,.08)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 2 }}>Análisis de Márgenes</div>
            <div style={{ fontSize: 10.5, color: C.g400, marginBottom: 14 }}>Nota de venta vs. resultado proyectado</div>
            {fin ? (
              <>
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <span style={{ fontSize: 11, color: C.g400 }}>Margen Bruto NV</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.blue2 }}>{fmtUF(fin.margenBrutoNotaVentaUF)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span style={{ fontSize: 11, color: C.g400 }}>Margen Target</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{fmtPct(targetPct)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span style={{ fontSize: 11, color: C.g400 }}>Margen Proyectado</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: marginPct >= targetPct ? C.teal : C.red }}>{fmtPct(marginPct)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span style={{ fontSize: 11, color: C.g400 }}>Margen Proyectado (UF)</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: (fin.margenProyectadoUF ?? 0) >= 0 ? C.teal : C.red }}>{fmtUF(fin.margenProyectadoUF)}</span>
                  </div>
                </div>
                <div style={{ background: C.g100, borderRadius: 9, padding: "10px 14px", textAlign: "center", marginTop: 14 }}>
                  <div style={{ fontSize: 9.5, color: C.g400 }}>Brecha vs Target</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: brechaMargen >= 0 ? C.teal : C.red, marginTop: 2 }}>
                    {brechaMargen >= 0 ? "+" : ""}{brechaMargen.toFixed(1)} pp
                  </div>
                </div>
              </>
            ) : (
              <div style={{ padding: "40px 0", textAlign: "center", color: C.g400, fontSize: 12 }}>Sin datos financieros.</div>
            )}
          </div>

          {/* Capacity Analysis */}
          <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px", boxShadow: "0 2px 16px rgba(10,22,40,.08)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 2 }}>Análisis de Capacity</div>
            <div style={{ fontSize: 10.5, color: C.g400, marginBottom: 14 }}>Presupuesto asignado vs. capacity ejecutado (UF)</div>
            {fin ? (
              <>
                <CapacityBar label="Presupuesto Asignado" value={fmtUF(fin.presupuestoUF)} pct={100} color={C.blue2} />
                <CapacityBar label="Capacity Utilizado" value={fmtUF(fin.capacityU)}
                  pct={fin.presupuestoUF ? ((fin.capacityU || 0) / fin.presupuestoUF) * 100 : 0} color={C.teal} />
                <CapacityBar label="Capacity Planificado" value={fmtUF(fin.planificadoUF)}
                  pct={fin.presupuestoUF ? ((fin.planificadoUF || 0) / fin.presupuestoUF) * 100 : 0} color={C.gold} />
                <CapacityBar label="Capacity Proyectado Total" value={fmtUF(fin.proyectadoUF)}
                  pct={fin.presupuestoUF ? ((fin.proyectadoUF || 0) / fin.presupuestoUF) * 100 : 0} color={C.navy} />
                <InsightBox type="info" icon="📌">
                  <strong>Capacity proyectado total: {fmtUF(fin.proyectadoUF)}.</strong>{" "}
                  Utilización: {budgetPct.toFixed(1)}% del presupuesto asignado.
                  {fin.margenProyectadoSegunCapacity != null && (
                    <> Margen según capacity: <strong>{fmtPct(pctOf(fin.margenProyectadoSegunCapacity))}</strong>.</>
                  )}
                </InsightBox>
              </>
            ) : (
              <div style={{ padding: "40px 0", textAlign: "center", color: C.g400, fontSize: 12 }}>Sin datos de capacity.</div>
            )}
          </div>

          {/* Portfolio Ranking / Team Summary */}
          <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px", boxShadow: "0 2px 16px rgba(10,22,40,.08)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 2 }}>Equipo y Épicas</div>
            <div style={{ fontSize: 10.5, color: C.g400, marginBottom: 14 }}>
              {jira.team.length} miembros · {jira.epics.length} épicas
            </div>

            {/* Epics summary */}
            <div style={{ fontSize: 10, fontWeight: 700, color: C.g400, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>
              Épicas
            </div>
            <div className="flex flex-col gap-1.5" style={{ marginBottom: 14 }}>
              {jira.epics.slice(0, 6).map((e: any) => {
                const epicPct = e.totalSubtasks > 0 ? Math.round((e.doneSubtasks / e.totalSubtasks) * 100) : 0;
                const isDone = e.statusCategory === "Done";
                return (
                  <div key={e.key} className="flex items-center gap-2">
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                      background: isDone ? C.teal : epicPct > 50 ? C.accent : C.g300,
                    }} />
                    <span style={{ flex: 1, fontSize: 10.5, fontWeight: 600, color: C.navy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {e.summary}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: isDone ? C.teal : C.g400 }}>
                      {e.doneSubtasks}/{e.totalSubtasks}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Top team members */}
            <div style={{ fontSize: 10, fontWeight: 700, color: C.g400, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>
              Equipo Principal
            </div>
            <div className="flex flex-col gap-1.5">
              {jira.team.slice(0, 5).map((t: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, fontWeight: 700, color: "#fff",
                    background: `linear-gradient(135deg, ${C.accent}, ${C.teal})`,
                  }}>
                    {t.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: C.navy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: C.teal }}>{t.done}</span>
                  <span style={{ fontSize: 9, color: C.g400 }}>/{t.total}</span>
                </div>
              ))}
            </div>

            {/* Portfolio context */}
            {portfolio && portfolio.totalActiveProjects > 0 && (
              <div style={{ marginTop: 14, padding: "10px 12px", background: C.g100, borderRadius: 9 }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: C.g400, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>
                  Posición en Portafolio
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <span style={{ fontSize: 18, fontWeight: 800, color: C.navy }}>{portfolio.projectRank || "—"}</span>
                    <span style={{ fontSize: 11, color: C.g400 }}> de {portfolio.totalActiveProjects}</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 9.5, color: C.g400 }}>Margen Prom. Portafolio</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>{fmtPct(portfolio.avgMargenProyectadoPorc * 100)}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ SECTION: JIRA Detail (collapsible) ═══ */}
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setShowVerdict(!showVerdict)}
          style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", color: C.g300 }}>
          Detalle JIRA — Issues por Tipo y Riesgos
          <div style={{ flex: 1, height: 1, background: C.g200 }} />
          {showVerdict ? <ChevronUp className="h-4 w-4" style={{ color: C.g300 }} /> : <ChevronDown className="h-4 w-4" style={{ color: C.g300 }} />}
        </div>

        {showVerdict && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Issues by Type */}
            {jira.byType?.length > 0 && (
              <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px", boxShadow: "0 2px 16px rgba(10,22,40,.08)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 14 }}>Issues por Tipo</div>
                {jira.byType.map((t: any, i: number) => (
                  <div key={i} className="flex items-center gap-2" style={{ marginBottom: 6 }}>
                    <span style={{ width: 100, fontSize: 10.5, color: C.g400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.type}</span>
                    <div style={{ flex: 1, height: 6, background: C.g200, borderRadius: 10, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(t.count / jira.totalIssues) * 100}%`, background: C.accent, borderRadius: 10 }} />
                    </div>
                    <span style={{ width: 30, textAlign: "right", fontSize: 10.5, fontWeight: 700 }}>{t.count}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Risks */}
            <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px", boxShadow: "0 2px 16px rgba(10,22,40,.08)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 14 }}>
                Riesgos ({jira.risks.length})
              </div>
              {jira.risks.length > 0 ? jira.risks.map((r: any) => (
                <div key={r.key} className="flex items-center gap-2" style={{ marginBottom: 6, padding: "6px 0", borderBottom: `1px solid ${C.g150}` }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                    background: r.priority === "Highest" || r.priority === "High" ? "#FFEBEE" : r.priority === "Medium" ? "#FFF8E1" : C.g150,
                    color: r.priority === "Highest" || r.priority === "High" ? C.red : r.priority === "Medium" ? C.gold : C.g400,
                  }}>{r.priority}</span>
                  <span style={{ flex: 1, fontSize: 10.5, color: C.navy }}>{r.summary}</span>
                  <span style={{
                    fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
                    background: r.statusCategory === "Done" ? "#E8F5E9" : "#EBF5FB",
                    color: r.statusCategory === "Done" ? C.teal : C.accent,
                  }}>{r.status}</span>
                </div>
              )) : (
                <div style={{ padding: "20px 0", textAlign: "center", color: C.g400, fontSize: 11 }}>
                  No se registran riesgos en JIRA.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ VERDICT HISTORY PANEL ═══ */}
        {showHistory && (
          <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px", boxShadow: "0 2px 16px rgba(10,22,40,.08)", border: `1.5px solid ${C.accent}20` }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
              <div className="flex items-center gap-2">
                <History className="h-4 w-4" style={{ color: C.accent }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>Historial de Veredictos</span>
                {verdictHistoryQ.data && (
                  <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: "#EBF5FB", color: C.accent }}>
                    {verdictHistoryQ.data.length} registros
                  </span>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)} style={{ fontSize: 10, color: C.g400 }}>Cerrar</Button>
            </div>
            {verdictHistoryQ.isLoading ? (
              <div className="flex items-center justify-center" style={{ padding: 24 }}>
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: C.accent }} />
              </div>
            ) : verdictHistoryQ.data && verdictHistoryQ.data.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {verdictHistoryQ.data.map((h: any, idx: number) => {
                  const isSelected = selectedHistoryId === h.id || (!selectedHistoryId && idx === 0 && latestVerdictQ.data?.id === h.id);
                  const metrics = h.metricsSnapshot as any;
                  const prevMetrics = idx < verdictHistoryQ.data!.length - 1 ? (verdictHistoryQ.data![idx + 1].metricsSnapshot as any) : null;
                  const advanceDelta = prevMetrics ? (metrics?.jiraAdvance ?? 0) - (prevMetrics?.jiraAdvance ?? 0) : null;
                  return (
                    <div key={h.id}
                      onClick={() => { setSelectedHistoryId(h.id); }}
                      className="flex items-center gap-3 cursor-pointer"
                      style={{
                        padding: "10px 14px", borderRadius: 10,
                        background: isSelected ? `${C.accent}10` : C.g100,
                        border: isSelected ? `1.5px solid ${C.accent}40` : "1.5px solid transparent",
                        transition: "all .15s",
                      }}>
                      {/* Semaphore dot */}
                      <div style={{
                        width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                        background: h.semaphore === "VERDE" ? "#27AE60" : h.semaphore === "AMARILLO" ? "#F39C12" : "#E53935",
                        boxShadow: `0 0 6px ${h.semaphore === "VERDE" ? "rgba(39,174,96,.4)" : h.semaphore === "AMARILLO" ? "rgba(243,156,18,.4)" : "rgba(229,57,53,.4)"}`,
                      }} />
                      {/* Date + who */}
                      <div style={{ flex: 1 }}>
                        <div className="flex items-center gap-2">
                          <span style={{ fontSize: 11, fontWeight: 700, color: C.navy }}>
                            {new Date(h.createdAt).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                          <span style={{ fontSize: 9, color: C.g400 }}>
                            {new Date(h.createdAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {idx === 0 && <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 6px", borderRadius: 8, background: C.accent, color: "#fff" }}>ÚLTIMO</span>}
                        </div>
                        <div className="flex items-center gap-3" style={{ marginTop: 2 }}>
                          <span style={{ fontSize: 9.5, color: C.g400 }}>por {h.generatedByName}</span>
                          {metrics && (
                            <span style={{ fontSize: 9.5, color: C.g400 }}>
                              JIRA: {metrics.jiraAdvance}% · Presup: {metrics.utilizadoUFPorc ? fmtPct(metrics.utilizadoUFPorc * 100, 0) : "N/D"}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Trend indicator */}
                      {advanceDelta !== null && (
                        <div className="flex items-center gap-1" style={{
                          fontSize: 10, fontWeight: 700,
                          color: advanceDelta > 0 ? C.teal : advanceDelta < 0 ? C.red : C.g400,
                        }}>
                          {advanceDelta > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : advanceDelta < 0 ? <ArrowDownRight className="h-3.5 w-3.5" /> : <Minus className="h-3 w-3" />}
                          {advanceDelta > 0 ? "+" : ""}{advanceDelta}pp
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: "20px 0", textAlign: "center", color: C.g400, fontSize: 11 }}>
                No hay veredictos anteriores. Genera el primero con el botón "Veredicto IA".
              </div>
            )}
          </div>
        )}

        {/* ═══ AI VERDICT (if generated or loaded from DB) ═══ */}
        {verdict && (
          <>
            <div className="flex items-center gap-2.5" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", color: C.g300 }}>
              <Sparkles className="h-3.5 w-3.5" style={{ color: C.accent }} />
              Veredicto Ejecutivo IA
              {/* Source badges: SoW & Gantt */}
              {verdictMeta?.metricsSnapshot && (
                <div className="flex items-center gap-1.5" style={{ textTransform: "none", letterSpacing: "0" }}>
                  <span style={{
                    fontSize: 8, fontWeight: 700, padding: "2px 8px", borderRadius: 8,
                    background: verdictMeta.metricsSnapshot.hasSoW ? "rgba(13,122,107,.15)" : "rgba(122,143,168,.1)",
                    color: verdictMeta.metricsSnapshot.hasSoW ? C.teal : C.g400,
                    border: `1px solid ${verdictMeta.metricsSnapshot.hasSoW ? "rgba(13,122,107,.3)" : "rgba(122,143,168,.2)"}`,
                  }}>{verdictMeta.metricsSnapshot.hasSoW ? "\u2713" : "\u2717"} SoW</span>
                  <span style={{
                    fontSize: 8, fontWeight: 700, padding: "2px 8px", borderRadius: 8,
                    background: verdictMeta.metricsSnapshot.hasGantt ? "rgba(13,122,107,.15)" : "rgba(122,143,168,.1)",
                    color: verdictMeta.metricsSnapshot.hasGantt ? C.teal : C.g400,
                    border: `1px solid ${verdictMeta.metricsSnapshot.hasGantt ? "rgba(13,122,107,.3)" : "rgba(122,143,168,.2)"}`,
                  }}>{verdictMeta.metricsSnapshot.hasGantt ? "\u2713" : "\u2717"} Gantt</span>
                </div>
              )}
              <div style={{ flex: 1, height: 1, background: C.g200 }} />
              {verdictMeta && (
                <div className="flex items-center gap-2" style={{ fontSize: 9, fontWeight: 500, color: C.g400, textTransform: "none", letterSpacing: "0" }}>
                  <Clock className="h-3 w-3" />
                  {new Date(verdictMeta.createdAt).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  {verdictMeta.generatedByName && <span>· {verdictMeta.generatedByName}</span>}
                  {verdictMeta.isHistorical && (
                    <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 6px", borderRadius: 8, background: C.gold, color: "#fff" }}>HISTÓRICO</span>
                  )}
                </div>
              )}
            </div>

            {/* Overall Verdict + Semaphore */}
            <div style={{
              background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navy2} 100%)`,
              borderRadius: 12, padding: "22px 26px", boxShadow: "0 4px 20px rgba(10,22,40,.15)",
              border: `1.5px solid ${C.accent}30`,
            }}>
              <div className="flex items-start gap-4">
                {/* Semaphore indicator */}
                {verdict.semaphore && (
                  <div style={{
                    flexShrink: 0, width: 52, height: 52, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: verdict.semaphore === "VERDE" ? "rgba(39,174,96,.15)"
                      : verdict.semaphore === "AMARILLO" ? "rgba(243,156,18,.15)" : "rgba(229,57,53,.15)",
                    border: `2px solid ${verdict.semaphore === "VERDE" ? "#27AE60"
                      : verdict.semaphore === "AMARILLO" ? "#F39C12" : "#E53935"}`,
                  }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: "50%",
                      background: verdict.semaphore === "VERDE" ? "#27AE60"
                        : verdict.semaphore === "AMARILLO" ? "#F39C12" : "#E53935",
                      boxShadow: `0 0 12px ${verdict.semaphore === "VERDE" ? "rgba(39,174,96,.6)"
                        : verdict.semaphore === "AMARILLO" ? "rgba(243,156,18,.6)" : "rgba(229,57,53,.6)"}`,
                    }} />
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div className="flex items-center gap-3" style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Síntesis Ejecutiva</span>
                    {verdict.semaphore && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: "2px 10px", borderRadius: 10,
                        letterSpacing: ".05em",
                        background: verdict.semaphore === "VERDE" ? "rgba(39,174,96,.2)"
                          : verdict.semaphore === "AMARILLO" ? "rgba(243,156,18,.2)" : "rgba(229,57,53,.2)",
                        color: verdict.semaphore === "VERDE" ? "#81C784"
                          : verdict.semaphore === "AMARILLO" ? "#FFB74D" : "#EF9A9A",
                      }}>{verdict.semaphore}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.65, color: "rgba(255,255,255,.7)" }}>
                    {verdict.overallVerdict}
                  </div>
                  {verdict.semaphoreJustification && (
                    <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.4)", marginTop: 8, fontStyle: "italic" }}>
                      {verdict.semaphoreJustification}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Risks + Recommendations side by side */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Key Risks */}
              <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px", boxShadow: "0 2px 16px rgba(10,22,40,.08)" }}>
                <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
                  <AlertTriangle className="h-4 w-4" style={{ color: C.red }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>Riesgos Clave</span>
                  {verdict.keyRisks?.length > 0 && (
                    <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: "#FFEBEE", color: C.red }}>
                      {verdict.keyRisks.length}
                    </span>
                  )}
                </div>
                {verdict.keyRisks?.length > 0 ? verdict.keyRisks.map((r: any, i: number) => (
                  <div key={i} className="flex items-start gap-2" style={{ marginBottom: 8, padding: "10px 12px", background: C.g100, borderRadius: 10, borderLeft: `3px solid ${r.impact === "ALTO" ? C.red : r.impact === "MEDIO" ? C.gold : C.g300}` }}>
                    <span style={{
                      fontSize: 8.5, fontWeight: 700, padding: "2px 8px", borderRadius: 10, flexShrink: 0, marginTop: 1,
                      background: r.impact === "ALTO" ? "#FFEBEE" : r.impact === "MEDIO" ? "#FFF8E1" : C.g150,
                      color: r.impact === "ALTO" ? C.red : r.impact === "MEDIO" ? C.gold : C.g400,
                    }}>{r.impact}</span>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.navy, lineHeight: 1.35 }}>{r.risk}</div>
                      <div style={{ fontSize: 10, color: C.g400, marginTop: 3, lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 600, color: C.teal }}>Mitigación:</span> {r.mitigation}
                      </div>
                    </div>
                  </div>
                )) : (
                  <div style={{ padding: "16px 0", textAlign: "center", color: C.g400, fontSize: 11 }}>
                    No se identificaron riesgos críticos.
                  </div>
                )}
              </div>

              {/* Recommendations */}
              <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px", boxShadow: "0 2px 16px rgba(10,22,40,.08)" }}>
                <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
                  <Sparkles className="h-4 w-4" style={{ color: C.accent }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>Recomendaciones</span>
                  {verdict.recommendations?.length > 0 && (
                    <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: "#EBF5FB", color: C.accent }}>
                      {verdict.recommendations.length}
                    </span>
                  )}
                </div>
                {verdict.recommendations?.length > 0 ? verdict.recommendations.map((r: any, i: number) => (
                  <div key={i} className="flex items-start gap-2" style={{ marginBottom: 8, padding: "10px 12px", background: C.g100, borderRadius: 10, borderLeft: `3px solid ${r.priority === "URGENTE" ? C.red : r.priority === "ALTA" ? C.gold : C.accent}` }}>
                    <span style={{
                      fontSize: 8.5, fontWeight: 700, padding: "2px 8px", borderRadius: 10, flexShrink: 0, color: "#fff", marginTop: 1,
                      background: r.priority === "URGENTE" ? C.red : r.priority === "ALTA" ? C.gold : C.accent,
                    }}>{r.priority}</span>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.navy, lineHeight: 1.35 }}>{r.title}</div>
                      <div style={{ fontSize: 10, color: C.g400, marginTop: 3, lineHeight: 1.4 }}>{r.description}</div>
                    </div>
                  </div>
                )) : (
                  <div style={{ padding: "16px 0", textAlign: "center", color: C.g400, fontSize: 11 }}>
                    No se generaron recomendaciones.
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ═══ FOOTER ═══ */}
      <div style={{
        background: C.navy2, padding: "12px 36px", display: "flex", justifyContent: "space-between",
        alignItems: "center", borderTop: "1px solid rgba(255,255,255,.06)",
      }}>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,.3)" }}>Prodigio Tech · Dashboard Ejecutivo PMO · Confidencial</span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,.3)" }}>
          Datos al {new Date().toLocaleDateString("es-CL")} · {project.dealId} · {project.name}
        </span>
      </div>
    </div>
  );
}
