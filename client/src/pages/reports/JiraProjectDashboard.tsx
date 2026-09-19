import { useState, useMemo, useCallback, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft, Download, Loader2, AlertTriangle, CheckCircle2, Clock, Target,
  Users, Flag, BarChart3, Milestone, ShieldAlert, Brain,
  FileCheck, FileWarning, ChevronDown,
  ChevronUp, RefreshCw, Sparkles, ClipboardCheck, AlertCircle, ArrowRight,
  Calendar, Activity, Zap, History, Timer
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CoveragePanel,
  EpicProgressPanel,
  MilestoneBackbone,
  SchedulePanel,
  StalledPanel,
  WorkloadPanel,
} from "./JiraDetailPanels";

/* ─── Palette (aligned with LinkedProjectDashboard) ─── */
const C = {
  navy: "#0A1628", navy2: "#112240", navy3: "#1A3358",
  blue: "#1B4F8A", blue2: "#2563AB", accent: "#3B8EE8",
  teal: "#0D7A6B", teal2: "#12A08D",
  gold: "#B8860B", gold2: "#D4A017",
  red: "#B83232", green: "#1A7A4A",
  g100: "#F4F7FB", g150: "#EBF0F7", g200: "#D8E2EF", g300: "#B0BDD0", g400: "#7A8FA8",
};

const pct = (n: number, d: number) => d > 0 ? Math.round((n / d) * 100) : 0;
const semaphoreColor = (s: string) => s === "VERDE" ? C.teal : s === "ROJO" ? C.red : C.gold;
const semaphoreBg = (s: string) => s === "VERDE" ? "#E8F5E9" : s === "ROJO" ? "#FFEBEE" : "#FFF8E1";
const semaphoreFromPct = (p: number) => p >= 80 ? "VERDE" : p >= 50 ? "AMARILLO" : "ROJO";
const formatDate = (d: any) => {
  if (!d) return "";
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

type TabId = "overview" | "analysis" | "epics" | "risks" | "team";

export default function JiraProjectDashboard() {
  const [, params] = useRoute("/reports/jira/:projectKey");
  const projectKey = params?.projectKey ?? "";

  const { data: consolidated, isLoading: loadingConsolidated } = trpc.jira.enrichedConsolidatedReport.useQuery();
  const portfolioQuery = trpc.projects.executive.useQuery(undefined, { staleTime: 60000 });
  const report = trpc.jira.advanceReport.useQuery({ projectKey }, { enabled: !!projectKey });
  const generateReport = trpc.jira.generateStatusReport.useMutation();
  const generatePMAnalysis = trpc.advance.generatePMAnalysis.useMutation();

  const [downloading, setDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [pmAnalysis, setPmAnalysis] = useState<any>(null);
  const [pmSources, setPmSources] = useState<any>(null);
  const [generatingAnalysis, setGeneratingAnalysis] = useState(false);
  const [analysisExpanded, setAnalysisExpanded] = useState<Record<string, boolean>>({
    sow: true, value: true, ops: true, risks: true, actions: true
  });

  const toggleSection = useCallback((key: string) => {
    setAnalysisExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const projectInfo = useMemo(() => {
    if (!consolidated) return null;
    return consolidated.projects.find((p: any) => p.projectKey === projectKey);
  }, [consolidated, projectKey]);

  const liveReportData = report.data;
  const progressInsights = liveReportData?.insights ?? null;

  const portfolioByKey = useMemo(() => (
    portfolioQuery.data?.portfolio?.find((row: any) => row.jiraProjectKey === projectKey) ?? null
  ), [portfolioQuery.data, projectKey]);

  const pmoProjectId = useMemo(() => {
    if (projectInfo?.pmoProjectId) return projectInfo.pmoProjectId as number;
    return portfolioByKey?.projectId ?? null;
  }, [projectInfo, portfolioByKey]);

  const portfolioEvidence = useMemo(() => {
    if (portfolioByKey) return portfolioByKey;
    if (!pmoProjectId) return null;
    return portfolioQuery.data?.portfolio?.find((row: any) => row.projectId === pmoProjectId) ?? null;
  }, [portfolioQuery.data, pmoProjectId, portfolioByKey]);

  const data = liveReportData ?? (portfolioEvidence ? {
    projectName: projectInfo?.projectName ?? portfolioEvidence.projectName ?? projectKey,
    totalIssues: 0,
    doneCount: 0,
    inProgressCount: 0,
    toDoCount: 0,
    percentComplete: portfolioEvidence.operationalProgressPct ?? 0,
    totalOriginalEstimateHours: 0,
    totalTimeSpentHours: 0,
    epics: [],
    milestones: [],
    milestonesCumplidos: portfolioEvidence.milestonesFulfilled ?? 0,
    milestonesPendientes: portfolioEvidence.milestonesTotal != null && portfolioEvidence.milestonesFulfilled != null
      ? Math.max(0, portfolioEvidence.milestonesTotal - portfolioEvidence.milestonesFulfilled)
      : 0,
    risks: [],
    scopeChanges: [],
    team: [],
    byStatus: [],
    byType: [],
    snapshotOnly: true,
  } : null);

  const financialKPIs = trpc.jira.getProjectFinancialKPIs.useQuery(
    { projectKey, pmoProjectId: pmoProjectId ?? undefined },
    { enabled: !!projectKey, staleTime: 120000 }
  );

  const docsQ = trpc.advance.resolveProjectDocuments.useQuery(
    { projectId: pmoProjectId! },
    { enabled: !!pmoProjectId, staleTime: 120000 }
  );

  const latestAnalysisQ = trpc.advance.getLatestAgenticAnalysis.useQuery(
    { projectId: pmoProjectId! },
    { enabled: !!pmoProjectId, staleTime: 60000 }
  );

  const analysisHistoryQ = trpc.advance.getAgenticAnalysisHistory.useQuery(
    { projectId: pmoProjectId! },
    { enabled: !!pmoProjectId, staleTime: 60000 }
  );

  useEffect(() => {
    if (latestAnalysisQ.data?.found && !pmAnalysis && !generatingAnalysis) {
      setPmAnalysis(latestAnalysisQ.data.analysis);
      setPmSources(latestAnalysisQ.data.sources);
    }
  }, [latestAnalysisQ.data, pmAnalysis, generatingAnalysis]);

  const handleGeneratePMAnalysis = async () => {
    if (!pmoProjectId) return;
    setGeneratingAnalysis(true);
    setActiveTab("analysis");
    try {
      const result = await generatePMAnalysis.mutateAsync({ projectId: pmoProjectId });
      setPmAnalysis(result.analysis);
      setPmSources(result.sources);
      latestAnalysisQ.refetch();
      analysisHistoryQ.refetch();
    } catch (e) {
      console.error("Error generating agentic analysis:", e);
    } finally {
      setGeneratingAnalysis(false);
    }
  };

  const handleDownloadReport = async () => {
    if (!data) return;
    setDownloading(true);
    try {
      const result = await generateReport.mutateAsync({
        projectKey,
        projectName: projectInfo?.projectName ?? data.projectName,
        clientName: projectInfo?.clientName ?? data.projectName,
        dealNumber: projectInfo?.dealNumber ?? projectKey,
      });
      const link = document.createElement("a");
      link.href = result.url;
      link.download = result.filename;
      link.click();
    } catch (e) {
      console.error("Error generating report:", e);
    } finally {
      setDownloading(false);
    }
  };

  if (!projectKey) {
    return (<div className="min-h-screen flex items-center justify-center" style={{ background: C.g100 }}><p style={{ color: C.g400, fontSize: 14 }}>No se especificó un proyecto.</p></div>);
  }
  if (!data && (report.isLoading || loadingConsolidated || portfolioQuery.isLoading)) {
    return (<div className="min-h-screen flex items-center justify-center" style={{ background: C.g100 }}><Loader2 className="animate-spin mr-2" style={{ color: C.accent }} size={24} /><span style={{ color: C.g400, fontSize: 14 }}>Cargando datos del proyecto...</span></div>);
  }
  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.g100 }}>
        <div className="text-center">
          <AlertTriangle size={40} style={{ color: C.red }} className="mx-auto mb-4" />
          <p style={{ color: C.navy, fontSize: 16, fontWeight: 700 }}>Error al cargar datos JIRA</p>
          <p style={{ color: C.g400, fontSize: 13, marginTop: 8 }}>{report.error?.message || "No se pudieron obtener los datos."}</p>
          <Link href="/reports/jira"><Button className="mt-4" style={{ background: C.accent, color: "#fff" }}>Volver a Reportes</Button></Link>
        </div>
      </div>
    );
  }

  const percentComplete = portfolioEvidence
    ? portfolioEvidence.operationalProgressPct
    : data.percentComplete;
  const isSnapshotOnly = Boolean((data as any).snapshotOnly);
  const jiraSemaphore = percentComplete === null ? "N/D" : semaphoreFromPct(percentComplete);
  const evidenceHealth = String(portfolioEvidence?.executiveHealth ?? "").toLowerCase();
  const evidenceSemaphore = evidenceHealth.includes("rojo") || evidenceHealth.includes("crít")
    ? "ROJO"
    : evidenceHealth.includes("amarillo") || evidenceHealth.includes("naranjo") || evidenceHealth.includes("riesgo")
      ? "AMARILLO"
      : evidenceHealth.includes("verde") || evidenceHealth.includes("estable")
        ? "VERDE"
        : null;
  const effectiveSemaphore = evidenceSemaphore ?? jiraSemaphore;
  const semColor = semaphoreColor(effectiveSemaphore);
  const semBg = semaphoreBg(effectiveSemaphore);

  const milestonesDone = portfolioEvidence?.milestonesFulfilled ?? data.milestonesCumplidos;
  const milestonesTotal = portfolioEvidence?.milestonesTotal ?? (data.milestonesCumplidos + data.milestonesPendientes);
  const milestoneProgressPct = milestonesTotal > 0
    ? pct(milestonesDone, milestonesTotal)
    : null;
  const taskProgressPct = progressInsights?.progress.issuePct ?? null;
  const tasksDone = progressInsights?.progress.issuesDone ?? 0;
  const tasksTotal = progressInsights?.progress.issuesTotal ?? 0;
  const tasksInProgress = progressInsights?.workload.reduce((sum, row) => sum + row.inProgress, 0) ?? 0;
  const tasksToDo = progressInsights?.workload.reduce((sum, row) => sum + row.toDo, 0) ?? 0;
  const milestoneProgressColor = milestoneProgressPct === null
    ? C.g300
    : semaphoreColor(semaphoreFromPct(milestoneProgressPct));
  const taskProgressColor = taskProgressPct === null
    ? C.g300
    : semaphoreColor(semaphoreFromPct(taskProgressPct));

  const analysisDate = latestAnalysisQ.data?.found ? latestAnalysisQ.data.createdAt : null;
  const daysSinceAnalysis = latestAnalysisQ.data?.found ? latestAnalysisQ.data.daysSince : null;
  const isStale = latestAnalysisQ.data?.found ? latestAnalysisQ.data.isStale : false;

  const tabs: { id: TabId; label: string; icon: any; badge?: string }[] = [
    { id: "overview", label: "Resumen", icon: Activity },
    { id: "analysis", label: "Análisis Agéntico", icon: Brain, badge: isStale ? "!" : undefined },
    { id: "epics", label: "Épicas e Hitos", icon: Flag },
    { id: "risks", label: "Riesgos", icon: ShieldAlert, badge: data.risks.filter((r: any) => r.statusCategory !== "Done").length > 0 ? `${data.risks.filter((r: any) => r.statusCategory !== "Done").length}` : undefined },
    { id: "team", label: "Equipo", icon: Users },
  ];

  return (
    <div className="min-h-screen" style={{ background: C.g100, fontFamily: "'Inter', sans-serif", color: C.navy }}>
      {/* ═══ HERO HEADER ═══ */}
      <div style={{
        background: `linear-gradient(160deg, ${C.navy} 0%, ${C.navy2} 55%, ${C.navy3} 100%)`,
        borderBottom: `3px solid ${C.accent}`,
      }}>
        <div className="px-4 pb-[18px] pt-[22px] sm:px-9">
          <div className="flex items-center gap-3" style={{ marginBottom: 12 }}>
            <Link href="/reports/jira"><button className="flex items-center gap-1 hover:opacity-80 transition-opacity" style={{ fontSize: 11, color: C.accent, fontWeight: 600 }}><ArrowLeft size={14} /> Volver a Reportes</button></Link>
          </div>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex items-center gap-2.5" style={{ marginBottom: 8 }}>
                <span style={{
                  background: "rgba(59,142,232,.15)", border: "1px solid rgba(59,142,232,.35)",
                  borderRadius: 20, padding: "3px 12px", fontSize: 10, fontWeight: 700,
                  color: C.accent, letterSpacing: ".1em", textTransform: "uppercase",
                }}>{projectKey}</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 10px", borderRadius: 20,
                  background: semBg, color: semColor, letterSpacing: ".05em",
                }}>{effectiveSemaphore}</span>
                {pmAnalysis?.sowComplianceScore != null && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 10px", borderRadius: 20,
                    background: "#FFF8E1", color: C.gold, letterSpacing: ".05em",
                  }}>SoW: {pmAnalysis.sowComplianceScore}%</span>
                )}
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-.5px", lineHeight: 1.15 }}>
                {projectInfo?.projectName ?? data.projectName}
              </h1>
              {projectInfo?.clientName && <p style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginTop: 4 }}>{projectInfo.clientName}</p>}
              {portfolioEvidence && <p style={{ fontSize: 10.5, color: "rgba(255,255,255,.45)", marginTop: 4 }}>Ciclo de vida: {portfolioEvidence.status} · Fase Jira: {portfolioEvidence.operationalPhase ?? "N/D"} · PM: {portfolioEvidence.pmName ?? "N/D"} · evidencia {portfolioEvidence.jiraEvidenceAvailability}</p>}
              {(data as any).snapshotOnly && <p style={{ fontSize: 10.5, color: C.gold2, marginTop: 4 }}>Vista resumida desde snapshot local; épicas, equipo y detalle de issues live están N/D.</p>}
            </div>
            <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
              {pmoProjectId && (
                <Button onClick={handleGeneratePMAnalysis} disabled={generatingAnalysis} size="sm"
                  style={{ background: C.gold2, color: "#fff", fontSize: 11, fontWeight: 700 }}>
                  {generatingAnalysis ? <Loader2 className="animate-spin mr-1.5" size={14} /> : <Brain size={14} className="mr-1.5" />}
                  {generatingAnalysis ? "Analizando..." : pmAnalysis ? "Regenerar Análisis" : "Análisis Agéntico"}
                </Button>
              )}
              <Button onClick={handleDownloadReport} disabled={downloading} size="sm"
                style={{ background: C.accent, color: "#fff", fontSize: 11, fontWeight: 700 }}>
                {downloading ? <Loader2 className="animate-spin mr-1.5" size={14} /> : <Download size={14} className="mr-1.5" />}
                {downloading ? "Generando..." : "Reporte PPTX"}
              </Button>
            </div>
          </div>

          {/* INSIGHT STRIP */}
          {pmAnalysis && (
            <div style={{
              marginTop: 16, borderRadius: 10, padding: "12px 16px",
              background: `${semColor}10`, border: `1px solid ${semColor}25`,
            }}>
              <div className="flex items-start gap-3">
                <div style={{
                  width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: `${semColor}22`,
                }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: semColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                    <Sparkles size={12} style={{ color: C.gold2 }} />
                    <span style={{ fontSize: 9, fontWeight: 700, color: C.gold2, textTransform: "uppercase", letterSpacing: ".08em" }}>Insight Agéntico</span>
                    {analysisDate && <span style={{ fontSize: 9, color: "rgba(255,255,255,.4)" }}><Timer size={9} className="inline mr-0.5" />{formatDate(analysisDate)}</span>}
                    {isStale && (
                      <span className="animate-pulse" style={{ fontSize: 9, padding: "1px 8px", borderRadius: 10, background: `${C.red}22`, color: "#EF9A9A", border: `1px solid ${C.red}33` }}>
                        <AlertCircle size={9} className="inline mr-0.5" /> Desactualizado ({daysSinceAnalysis}d)
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 11.5, lineHeight: 1.55, color: "rgba(255,255,255,.7)" }}>{pmAnalysis.executiveSummary}</p>
                </div>
              </div>
            </div>
          )}

          {/* Staleness alerts */}
          {!pmAnalysis && pmoProjectId && latestAnalysisQ.data?.found === false && (
            <div className="flex items-center gap-3" style={{ marginTop: 12, borderRadius: 10, padding: "10px 14px", background: `${C.gold}10`, border: `1px solid ${C.gold}25` }}>
              <Brain size={16} style={{ color: C.gold2 }} />
              <p style={{ fontSize: 11, color: "rgba(255,255,255,.6)" }}>No hay análisis agéntico generado. Haz clic en <strong style={{ color: C.gold2 }}>Análisis Agéntico</strong> para generar una evaluación integral.</p>
            </div>
          )}
          {isStale && !generatingAnalysis && (
            <div className="flex items-center justify-between" style={{ marginTop: 8, borderRadius: 10, padding: "10px 14px", background: `${C.red}10`, border: `1px solid ${C.red}25` }}>
              <div className="flex items-center gap-3">
                <AlertCircle size={16} style={{ color: "#EF9A9A" }} />
                <p style={{ fontSize: 11, color: "rgba(255,255,255,.6)" }}>El análisis tiene <strong style={{ color: "#EF9A9A" }}>{daysSinceAnalysis} días</strong> de antigüedad. Se recomienda actualizarlo.</p>
              </div>
              <Button onClick={handleGeneratePMAnalysis} size="sm" style={{ background: C.gold2, color: "#fff", fontSize: 10 }}><RefreshCw size={11} className="mr-1" /> Actualizar</Button>
            </div>
          )}

          {/* KPI STRIP */}
          <div className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
            {[
              { icon: Activity, label: "Avance Jira", value: percentComplete === null ? "N/D" : `${percentComplete}%`, sub: "Mismo snapshot del Portafolio", color: percentComplete === null ? C.g300 : semColor },
              { icon: Milestone, label: "Hitos", value: milestoneProgressPct === null ? "N/D" : `${milestoneProgressPct}%`, sub: milestonesTotal > 0 ? `${milestonesDone}/${milestonesTotal} cerrados` : "sin hitos medibles", color: milestoneProgressColor },
              { icon: Target, label: "Tareas live", value: taskProgressPct === null ? "N/D" : `${taskProgressPct}%`, sub: progressInsights ? `${tasksDone}/${tasksTotal} cerradas` : "detalle live no disponible", color: taskProgressColor },
              { icon: ClipboardCheck, label: "PM", value: portfolioEvidence?.pmName ?? "N/D", sub: portfolioEvidence?.pmSource ?? "sin evidencia", color: C.blue2 },
              { icon: ShieldAlert, label: "Riesgos", value: `${portfolioEvidence?.openRisks ?? data.risks.length}`, sub: portfolioEvidence?.highRisksOpen != null ? `${portfolioEvidence.highRisksOpen} altos · ${portfolioEvidence.riskSource}` : `${data.risks.filter((r: any) => r.statusCategory !== "Done").length} abiertos`, color: (portfolioEvidence?.highRisksOpen ?? data.risks.filter((r: any) => r.statusCategory !== "Done").length) > 0 ? C.red : C.teal },
              { icon: Users, label: "Equipo", value: progressInsights ? `${progressInsights.workload.length}` : "N/D", sub: progressInsights ? "responsables con tareas" : "detalle live no disponible", color: C.teal2 },
            ].map((kpi, i) => (
              <div key={i} style={{
                background: "rgba(255,255,255,.06)", borderRadius: 10, padding: "12px 14px",
                border: "1px solid rgba(255,255,255,.08)",
              }}>
                <div className="flex items-center gap-1.5" style={{ marginBottom: 3 }}>
                  <kpi.icon size={12} style={{ color: kpi.color }} />
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".09em", color: "rgba(255,255,255,.4)" }}>{kpi.label}</span>
                </div>
                <p style={{ fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-.5px" }}>{kpi.value}</p>
                <p style={{ fontSize: 9.5, color: "rgba(255,255,255,.35)" }}>{kpi.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ TABS NAVIGATION ═══ */}
      <div style={{ background: "#fff", borderBottom: `1px solid ${C.g200}`, boxShadow: "0 1px 4px rgba(10,22,40,.04)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 28px" }}>
          <div className="flex items-center gap-1 overflow-x-auto">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="flex items-center gap-2 whitespace-nowrap transition-all" style={{
                padding: "12px 16px", fontSize: 12, fontWeight: activeTab === tab.id ? 700 : 500,
                color: activeTab === tab.id ? C.accent : C.g400,
                borderBottom: activeTab === tab.id ? `2.5px solid ${C.accent}` : "2.5px solid transparent",
              }}>
                <tab.icon size={15} />{tab.label}
                {tab.badge && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 10, background: "#FFEBEE", color: C.red, fontWeight: 700, minWidth: 18, textAlign: "center" }}>{tab.badge}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ TAB CONTENT ═══ */}
      <div className="flex flex-col gap-4 px-3 pb-8 pt-5 sm:px-7">

        {/* TAB: OVERVIEW */}
        {activeTab === "overview" && (() => {
          const finKPIs = financialKPIs.data;
          const hhConsumed = data.totalTimeSpentHours ?? 0;
          const hhBudgeted = finKPIs?.presupuestoHH ?? data.totalOriginalEstimateHours ?? 0;
          const hhPct = hhBudgeted > 0 ? Math.round((hhConsumed / hhBudgeted) * 100) : 0;
          const milestonesPctClosed = milestoneProgressPct ?? 0;

          return (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {progressInsights ? (
              <MilestoneBackbone insights={progressInsights} />
            ) : (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
                El detalle de hitos y tareas está N/D hasta que la lectura Jira live esté disponible.
              </section>
            )}

            {/* INFOGRAPHIC KPIs - 5 circular cards */}
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-5">
              {[
                { label: "Avance por hitos", icon: Milestone, value: milestonesPctClosed, text: milestoneProgressPct === null ? "N/D · sin hitos definidos" : `${milestonesDone} de ${milestonesTotal}`, color: milestoneProgressColor, centerText: milestoneProgressPct === null ? "N/D" : undefined },
                { label: "HH Consumidas", icon: Clock, value: hhPct, text: hhConsumed > 0 ? `${hhPct}% del presupuesto` : "Sin registro", color: hhPct > 100 ? C.red : hhPct > 85 ? C.gold : C.blue2, centerText: hhConsumed > 0 ? hhConsumed.toLocaleString("es-CL") : "--" },
                { label: "HH Presupuesto", icon: Timer, value: 100, text: finKPIs?.found ? "Desde planilla" : data.totalOriginalEstimateHours > 0 ? "Estimado JIRA" : "No disponible", color: C.teal, centerText: hhBudgeted > 0 ? hhBudgeted.toLocaleString("es-CL") : "--", isStatic: true },
                { label: "Tareas", icon: CheckCircle2, value: taskProgressPct ?? 0, text: taskProgressPct === null ? "N/D · sin detalle live" : `${tasksDone} de ${tasksTotal}`, color: taskProgressColor, centerText: taskProgressPct === null ? "N/D" : undefined },
                { label: "Hitos cerrados", icon: FileCheck, value: milestonesPctClosed, text: "Evidencia Jira; no equivale a facturación", color: milestonesPctClosed >= 80 ? C.teal : milestonesPctClosed >= 40 ? C.gold : C.red },
              ].map((kpi, i) => (
                <div key={i} style={{
                  background: "#fff", borderRadius: 12, padding: "18px 16px", textAlign: "center",
                  boxShadow: "0 2px 16px rgba(10,22,40,.08)", borderTop: `3px solid ${kpi.color}`,
                }}>
                  <div style={{ position: "relative", width: 72, height: 72, margin: "0 auto 10px" }}>
                    <svg viewBox="0 0 36 36" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
                      <circle cx="18" cy="18" r="15.5" fill="none" stroke={C.g200} strokeWidth="3" />
                      {!kpi.isStatic && <circle cx="18" cy="18" r="15.5" fill="none" stroke={kpi.color} strokeWidth="3" strokeDasharray={`${Math.min(kpi.value, 100)} ${100 - Math.min(kpi.value, 100)}`} strokeLinecap="round" />}
                      {kpi.isStatic && <circle cx="18" cy="18" r="15.5" fill="none" stroke={`${kpi.color}44`} strokeWidth="3" strokeDasharray="100 0" />}
                    </svg>
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>{kpi.centerText ?? `${Math.round(kpi.value)}%`}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-1.5" style={{ marginBottom: 2 }}>
                    <kpi.icon size={12} style={{ color: kpi.color }} />
                    <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".09em", color: C.g400 }}>{kpi.label}</span>
                  </div>
                  <p style={{ fontSize: 10, color: C.g400 }}>{kpi.text}</p>
                </div>
              ))}
            </div>

            {/* TASK FLOW - secondary operational reading */}
            <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px", boxShadow: "0 2px 16px rgba(10,22,40,.08)" }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
                <Activity size={15} style={{ color: C.accent }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>Avance operacional de tareas</span>
              </div>
              {progressInsights ? (
                <>
                  <div style={{ width: "100%", borderRadius: 10, height: 22, display: "flex", overflow: "hidden", background: C.g200 }}>
                    {tasksDone > 0 && <div style={{ height: 22, width: `${pct(tasksDone, tasksTotal)}%`, background: C.teal, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff" }}>{tasksDone > 3 ? `${tasksDone} listas` : ""}</div>}
                    {tasksInProgress > 0 && <div style={{ height: 22, width: `${pct(tasksInProgress, tasksTotal)}%`, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff" }}>{tasksInProgress > 3 ? `${tasksInProgress}` : ""}</div>}
                    {tasksToDo > 0 && <div style={{ height: 22, width: `${pct(tasksToDo, tasksTotal)}%`, background: `${C.g300}66`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: C.g400 }}>{tasksToDo > 3 ? `${tasksToDo}` : ""}</div>}
                  </div>
                  <div className="flex items-center gap-5" style={{ marginTop: 10 }}>
                    <div className="flex items-center gap-1.5"><div style={{ width: 10, height: 10, borderRadius: 3, background: C.teal }} /><span style={{ fontSize: 10, color: C.g400 }}>Completadas ({tasksDone})</span></div>
                    <div className="flex items-center gap-1.5"><div style={{ width: 10, height: 10, borderRadius: 3, background: C.accent }} /><span style={{ fontSize: 10, color: C.g400 }}>En progreso ({tasksInProgress})</span></div>
                    <div className="flex items-center gap-1.5"><div style={{ width: 10, height: 10, borderRadius: 3, background: `${C.g300}66` }} /><span style={{ fontSize: 10, color: C.g400 }}>Por hacer ({tasksToDo})</span></div>
                  </div>
                </>
              ) : (
                <p style={{ fontSize: 11, color: C.g400 }}>N/D: el detalle live de tareas no está disponible.</p>
              )}
            </div>

            {progressInsights && (
              <>
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <SchedulePanel insights={progressInsights} />
                  <CoveragePanel insights={progressInsights} />
                </div>
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <StalledPanel insights={progressInsights} />
                  <WorkloadPanel insights={progressInsights} />
                </div>
              </>
            )}

            {/* HH Comparison */}
            {(hhConsumed > 0 || hhBudgeted > 0) && (
              <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px", boxShadow: "0 2px 16px rgba(10,22,40,.08)" }}>
                <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
                  <Timer size={15} style={{ color: C.blue2 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>Horas-Hombre: Consumido vs Presupuesto</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: C.g400 }}>HH Consumidas</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: hhPct > 100 ? C.red : C.blue2 }}>{hhConsumed.toLocaleString("es-CL")} hrs</span>
                    </div>
                    <div style={{ width: "100%", height: 8, background: C.g200, borderRadius: 10, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(hhPct, 100)}%`, background: hhPct > 100 ? C.red : hhPct > 85 ? C.gold : C.blue2, borderRadius: 10 }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: C.g400 }}>HH Presupuestadas</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.teal }}>{hhBudgeted > 0 ? hhBudgeted.toLocaleString("es-CL") + " hrs" : "No disponible"}</span>
                    </div>
                    <div style={{ width: "100%", height: 8, background: C.g200, borderRadius: 10, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: "100%", background: `${C.teal}44`, borderRadius: 10 }} />
                    </div>
                  </div>
                  {hhBudgeted > 0 && (
                    <div className="flex items-center gap-2" style={{ padding: "8px 12px", borderRadius: 9, background: hhPct > 100 ? "#FFEBEE" : hhPct > 85 ? "#FFF8E1" : "#E8F5E9", borderLeft: `3px solid ${hhPct > 100 ? C.red : hhPct > 85 ? C.gold : C.teal}` }}>
                      {hhPct > 100 ? <AlertTriangle size={13} style={{ color: C.red }} /> : hhPct > 85 ? <AlertTriangle size={13} style={{ color: C.gold }} /> : <CheckCircle2 size={13} style={{ color: C.teal }} />}
                      <span style={{ fontSize: 11, color: hhPct > 100 ? C.red : hhPct > 85 ? C.gold : C.teal, fontWeight: 600 }}>
                        {hhPct > 100 ? `Sobrecosto: ${hhPct}% del presupuesto utilizado` : hhPct > 85 ? `Alerta: ${hhPct}% del presupuesto consumido` : `Controlado: ${hhPct}% del presupuesto utilizado`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {data.scopeChanges && data.scopeChanges.length > 0 && (
              <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px", boxShadow: "0 2px 16px rgba(10,22,40,.08)" }}>
                <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
                  <AlertTriangle size={15} style={{ color: C.gold }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>Cambios de Alcance ({data.scopeChanges.length})</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {data.scopeChanges.map((sc: any, i: number) => (
                    <div key={i} className="flex items-start gap-3" style={{ padding: "10px 14px", borderRadius: 9, background: "#FFF8E1", borderLeft: `3px solid ${C.gold}` }}>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: `${C.gold}22`, color: C.gold, flexShrink: 0 }}>{sc.status}</span>
                      <p style={{ fontSize: 11.5, color: C.navy }}>{sc.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          );
        })()}

        {/* TAB: ANÁLISIS AGÉNTICO */}
        {activeTab === "analysis" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 16px rgba(10,22,40,.08)", border: `1.5px solid ${C.gold}30` }}>
              <div className="flex items-center justify-between" style={{
                padding: "16px 22px",
                background: `linear-gradient(135deg, ${C.g100} 0%, ${C.g150} 100%)`,
                borderBottom: `1px solid ${C.gold}25`,
              }}>
                <div className="flex items-center gap-3">
                  <div style={{ width: 38, height: 38, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: `${C.gold}15` }}>
                    <Brain size={18} style={{ color: C.gold }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>Análisis Agéntico</h3>
                    <p style={{ fontSize: 10.5, color: C.g400 }}>Evaluación integral: SoW + Gantt + JIRA + Financiero</p>
                  </div>
                </div>
                {!generatingAnalysis && pmAnalysis && (
                  <div className="flex items-center gap-3">
                    {analysisDate && (
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: 9.5, color: C.g400 }}><Calendar size={9} className="inline mr-0.5" /> {formatDate(analysisDate)}</p>
                        {daysSinceAnalysis != null && <p style={{ fontSize: 9.5, color: isStale ? C.red : C.teal }}>{daysSinceAnalysis === 0 ? "Hoy" : `hace ${daysSinceAnalysis} día${daysSinceAnalysis > 1 ? "s" : ""}`}</p>}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      {pmSources?.sow?.available ? <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 10, background: "#E8F5E9", color: C.teal, fontWeight: 700, border: `1px solid ${C.teal}25` }}><FileCheck size={9} className="inline mr-0.5" /> SoW</span> : <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 10, background: "#FFEBEE", color: C.red, fontWeight: 700, border: `1px solid ${C.red}25` }}><FileWarning size={9} className="inline mr-0.5" /> Sin SoW</span>}
                      {pmSources?.gantt?.available ? <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 10, background: "#E8F5E9", color: C.teal, fontWeight: 700, border: `1px solid ${C.teal}25` }}><FileCheck size={9} className="inline mr-0.5" /> Gantt</span> : <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 10, background: "#FFEBEE", color: C.red, fontWeight: 700, border: `1px solid ${C.red}25` }}><FileWarning size={9} className="inline mr-0.5" /> Sin Gantt</span>}
                    </div>
                    <Button onClick={handleGeneratePMAnalysis} disabled={generatingAnalysis} size="sm" style={{ background: `${C.gold}15`, color: C.gold, border: `1px solid ${C.gold}30`, fontSize: 10 }}><RefreshCw size={11} className="mr-1" /> Regenerar</Button>
                  </div>
                )}
              </div>

              {generatingAnalysis ? (
                <div className="flex flex-col items-center justify-center gap-4" style={{ padding: "60px 0", background: C.g100 }}>
                  <div style={{ position: "relative" }}><Loader2 className="animate-spin" size={44} style={{ color: C.gold }} /><Sparkles size={16} style={{ color: C.gold }} className="absolute -top-1 -right-1 animate-pulse" /></div>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>Generando Análisis Agéntico...</p>
                    <p style={{ fontSize: 11, color: C.g400, marginTop: 4 }}>Extrayendo SoW y Gantt, cruzando con datos JIRA y financieros</p>
                    <p style={{ fontSize: 11, color: C.g400, marginTop: 4 }}>Este proceso puede tomar 30-60 segundos</p>
                  </div>
                </div>
              ) : pmAnalysis ? (
                <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Executive Summary + Health */}
                  <div className="flex gap-4">
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 12, lineHeight: 1.65, color: C.g400 }}>{pmAnalysis.executiveSummary}</p>
                      {pmAnalysis.healthJustification && (
                        <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 9, background: semBg, borderLeft: `3px solid ${semColor}` }}>
                          <p style={{ fontSize: 11, color: C.g400 }}>{pmAnalysis.healthJustification}</p>
                        </div>
                      )}
                    </div>
                    <div style={{
                      flexShrink: 0, width: 130, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
                      padding: "16px 14px", borderRadius: 12, background: C.g100, border: `1.5px solid ${semColor}30`,
                    }}>
                      <div style={{ width: 48, height: 48, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: `${semColor}15`, border: `2px solid ${semColor}` }}>
                        <div style={{ width: 20, height: 20, borderRadius: "50%", background: semColor, boxShadow: `0 0 10px ${semColor}60` }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: semColor }}>{pmAnalysis.overallHealth}</span>
                      {pmAnalysis.sowComplianceScore != null && (
                        <div style={{ textAlign: "center" }}><span style={{ fontSize: 18, fontWeight: 800, color: C.navy }}>{pmAnalysis.sowComplianceScore}%</span><p style={{ fontSize: 9.5, color: C.g400 }}>Cumplimiento SoW</p></div>
                      )}
                    </div>
                  </div>

                  {/* SoW Compliance */}
                  {pmAnalysis.sowCompliance && (
                    <CollapsibleSection title="Cumplimiento del SoW" icon={<ClipboardCheck size={15} style={{ color: C.teal }} />} expanded={analysisExpanded.sow} onToggle={() => toggleSection("sow")}>
                      <p style={{ fontSize: 11, lineHeight: 1.55, color: C.g400, marginBottom: 10 }}>{pmAnalysis.sowCompliance.summary}</p>
                      {pmAnalysis.sowCompliance.deliverablesStatus?.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                          <p style={{ fontSize: 10, fontWeight: 700, color: C.g400, textTransform: "uppercase", letterSpacing: ".08em" }}>Entregables:</p>
                          {pmAnalysis.sowCompliance.deliverablesStatus.map((d: any, i: number) => {
                            const sc = d.status === "CUMPLIDO" ? C.teal : d.status === "EN_PROGRESO" ? C.accent : d.status === "ATRASADO" ? C.red : C.g400;
                            const bg = d.status === "CUMPLIDO" ? "#E8F5E9" : d.status === "ATRASADO" ? "#FFEBEE" : "#EBF5FB";
                            const SI = d.status === "CUMPLIDO" ? CheckCircle2 : d.status === "ATRASADO" ? AlertTriangle : Clock;
                            return (
                              <div key={i} className="flex items-start gap-2" style={{ padding: "8px 12px", borderRadius: 9, background: bg, borderLeft: `3px solid ${sc}` }}>
                                <SI size={13} style={{ color: sc }} className="flex-shrink-0 mt-0.5" />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div className="flex items-center gap-2"><span style={{ fontSize: 11, fontWeight: 600, color: C.navy }}>{d.deliverable}</span><span style={{ fontSize: 9, fontWeight: 700, padding: "1px 8px", borderRadius: 10, background: `${sc}15`, color: sc }}>{d.status?.replace("_", " ")}</span></div>
                                  <p style={{ fontSize: 10, color: C.g400, marginTop: 2 }}>{d.detail}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {pmAnalysis.sowCompliance.milestonesAlignment && <div style={{ padding: "8px 12px", borderRadius: 9, marginBottom: 6, background: "#EBF5FB", borderLeft: `3px solid ${C.accent}` }}><p style={{ fontSize: 10, fontWeight: 700, color: C.accent, marginBottom: 2 }}>Alineamiento de Hitos</p><p style={{ fontSize: 10.5, color: C.g400 }}>{pmAnalysis.sowCompliance.milestonesAlignment}</p></div>}
                      {pmAnalysis.sowCompliance.scopeDeviations && <div style={{ padding: "8px 12px", borderRadius: 9, background: "#FFF8E1", borderLeft: `3px solid ${C.gold}` }}><p style={{ fontSize: 10, fontWeight: 700, color: C.gold, marginBottom: 2 }}>Desviaciones de Alcance</p><p style={{ fontSize: 10.5, color: C.g400 }}>{pmAnalysis.sowCompliance.scopeDeviations}</p></div>}
                    </CollapsibleSection>
                  )}

                  {/* Value Delivery */}
                  {pmAnalysis.valueDelivery && (
                    <CollapsibleSection title="Creación de Valor al Cliente" icon={<ArrowUpRight size={15} style={{ color: C.gold }} />} expanded={analysisExpanded.value} onToggle={() => toggleSection("value")}>
                      <p style={{ fontSize: 11, lineHeight: 1.55, color: C.g400, marginBottom: 10 }}>{pmAnalysis.valueDelivery.summary}</p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                        <SignalCard title="Señales Positivas" icon={<CheckCircle2 size={11} />} color={C.teal} bg="#E8F5E9" items={pmAnalysis.valueDelivery.positiveSignals} emptyText="Sin señales" />
                        <SignalCard title="Señales de Alerta" icon={<AlertTriangle size={11} />} color={C.gold} bg="#FFF8E1" items={pmAnalysis.valueDelivery.warningSignals} emptyText="Sin alertas" />
                        <SignalCard title="Factores de Riesgo" icon={<ShieldAlert size={11} />} color={C.red} bg="#FFEBEE" items={pmAnalysis.valueDelivery.clientRiskFactors} emptyText="Sin factores" />
                      </div>
                    </CollapsibleSection>
                  )}

                  {/* Operational Analysis */}
                  {pmAnalysis.operationalAnalysis && (
                    <CollapsibleSection title="Análisis Operativo" icon={<BarChart3 size={15} style={{ color: C.accent }} />} expanded={analysisExpanded.ops} onToggle={() => toggleSection("ops")} badge={pmAnalysis.operationalAnalysis.executionPace ? { text: `Ritmo: ${pmAnalysis.operationalAnalysis.executionPace}`, color: pmAnalysis.operationalAnalysis.executionPace === "ADECUADO" ? C.teal : pmAnalysis.operationalAnalysis.executionPace === "LENTO" ? C.red : C.gold } : undefined}>
                      {pmAnalysis.operationalAnalysis.paceDetail && <p style={{ fontSize: 11, lineHeight: 1.55, color: C.g400, marginBottom: 10 }}>{pmAnalysis.operationalAnalysis.paceDetail}</p>}
                      {pmAnalysis.operationalAnalysis.bottlenecks?.length > 0 && (
                        <div style={{ padding: "10px 14px", borderRadius: 9, marginBottom: 10, background: "#FFEBEE", borderLeft: `3px solid ${C.red}` }}>
                          <p style={{ fontSize: 10, fontWeight: 700, color: C.red, marginBottom: 6 }}>Cuellos de Botella</p>
                          {pmAnalysis.operationalAnalysis.bottlenecks.map((b: string, i: number) => <p key={i} className="flex items-start gap-1" style={{ fontSize: 10.5, color: C.g400, marginBottom: 3 }}><AlertCircle size={10} style={{ color: C.red }} className="flex-shrink-0 mt-0.5" /> {b}</p>)}
                        </div>
                      )}
                      {pmAnalysis.operationalAnalysis.teamAssessment && <div style={{ padding: "10px 14px", borderRadius: 9, marginBottom: 10, background: "#EBF5FB", borderLeft: `3px solid ${C.accent}` }}><p style={{ fontSize: 10, fontWeight: 700, color: C.accent, marginBottom: 2 }}><Users size={11} className="inline mr-1" />Evaluación del Equipo</p><p style={{ fontSize: 10.5, color: C.g400 }}>{pmAnalysis.operationalAnalysis.teamAssessment}</p></div>}
                      {pmAnalysis.operationalAnalysis.epicProgress?.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <p style={{ fontSize: 10, fontWeight: 700, color: C.g400, textTransform: "uppercase", letterSpacing: ".08em" }}>Avance por Épica:</p>
                          {pmAnalysis.operationalAnalysis.epicProgress.map((ep: any, i: number) => (
                            <div key={i} className="flex items-center gap-3" style={{ padding: "8px 12px", borderRadius: 9, background: C.g100 }}>
                              <div style={{ flexShrink: 0, width: 36, textAlign: "center" }}><span style={{ fontSize: 13, fontWeight: 800, color: ep.progress >= 80 ? C.teal : ep.progress >= 50 ? C.gold : C.red }}>{ep.progress}%</span></div>
                              <div style={{ flex: 1, minWidth: 0 }}><p style={{ fontSize: 10.5, fontWeight: 600, color: C.navy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ep.epic}</p><p style={{ fontSize: 9.5, color: C.g400 }}>{ep.assessment}</p></div>
                              <div style={{ width: 60, height: 5, background: C.g200, borderRadius: 10, overflow: "hidden" }}><div style={{ height: "100%", width: `${ep.progress}%`, background: ep.progress >= 80 ? C.teal : ep.progress >= 50 ? C.gold : C.red, borderRadius: 10 }} /></div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CollapsibleSection>
                  )}

                  {/* Risks & Alerts */}
                  {pmAnalysis.risksAndAlerts?.length > 0 && (
                    <CollapsibleSection title={`Riesgos y Alertas (${pmAnalysis.risksAndAlerts.length})`} icon={<ShieldAlert size={15} style={{ color: C.red }} />} expanded={analysisExpanded.risks} onToggle={() => toggleSection("risks")}>
                      {pmAnalysis.risksAndAlerts.map((r: any, i: number) => {
                        const rc = r.type === "CRITICO" || r.type === "ALTO" ? C.red : r.type === "MEDIO" ? C.gold : C.accent;
                        const bg = r.type === "CRITICO" || r.type === "ALTO" ? "#FFEBEE" : r.type === "MEDIO" ? "#FFF8E1" : "#EBF5FB";
                        return (
                          <div key={i} style={{ padding: "10px 14px", borderRadius: 9, marginBottom: 6, background: bg, borderLeft: `3px solid ${rc}` }}>
                            <div className="flex items-center gap-2" style={{ marginBottom: 4 }}><span style={{ fontSize: 9, fontWeight: 700, padding: "1px 8px", borderRadius: 10, background: `${rc}15`, color: rc }}>{r.type}</span><span style={{ fontSize: 11, fontWeight: 700, color: C.navy }}>{r.title}</span></div>
                            <p style={{ fontSize: 10.5, color: C.g400, marginBottom: 4 }}>{r.description}</p>
                            <div className="flex items-start gap-1"><ArrowRight size={10} style={{ color: C.teal }} className="flex-shrink-0 mt-0.5" /><p style={{ fontSize: 10.5, fontWeight: 600, color: C.teal }}>{r.recommendation}</p></div>
                          </div>
                        );
                      })}
                    </CollapsibleSection>
                  )}

                  {/* Actions */}
                  {(pmAnalysis.weeklyActions?.length > 0 || pmAnalysis.monthlyActions?.length > 0) && (
                    <CollapsibleSection title="Plan de Acción" icon={<Target size={15} style={{ color: C.teal }} />} expanded={analysisExpanded.actions} onToggle={() => toggleSection("actions")}>
                      {pmAnalysis.weeklyActions?.length > 0 && (
                        <div style={{ marginBottom: 14 }}>
                          <p className="flex items-center gap-1" style={{ fontSize: 10, fontWeight: 700, color: C.gold, marginBottom: 8 }}><Zap size={11} /> Acciones Esta Semana</p>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {pmAnalysis.weeklyActions.map((a: any, i: number) => {
                              const pc = a.priority === "URGENTE" ? C.red : a.priority === "ALTA" ? C.gold : C.accent;
                              const bg = a.priority === "URGENTE" ? "#FFEBEE" : a.priority === "ALTA" ? "#FFF8E1" : "#EBF5FB";
                              return (<div key={i} className="flex items-start gap-3" style={{ padding: "8px 12px", borderRadius: 9, background: bg, borderLeft: `3px solid ${pc}` }}><span style={{ fontSize: 9, fontWeight: 700, padding: "1px 8px", borderRadius: 10, background: `${pc}15`, color: pc, flexShrink: 0, marginTop: 1 }}>{a.priority}</span><div style={{ flex: 1 }}><p style={{ fontSize: 11, fontWeight: 600, color: C.navy }}>{a.action}</p><p style={{ fontSize: 10, color: C.g400, marginTop: 2 }}>{a.rationale}</p></div></div>);
                            })}
                          </div>
                        </div>
                      )}
                      {pmAnalysis.monthlyActions?.length > 0 && (
                        <div>
                          <p className="flex items-center gap-1" style={{ fontSize: 10, fontWeight: 700, color: C.accent, marginBottom: 8 }}><Calendar size={11} /> Acciones Este Mes</p>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {pmAnalysis.monthlyActions.map((a: any, i: number) => (<div key={i} className="flex items-start gap-3" style={{ padding: "8px 12px", borderRadius: 9, background: "#EBF5FB", borderLeft: `3px solid ${C.accent}` }}><span style={{ fontSize: 9, fontWeight: 700, padding: "1px 8px", borderRadius: 10, background: `${C.accent}15`, color: C.accent, flexShrink: 0, marginTop: 1 }}>{a.priority}</span><div style={{ flex: 1 }}><p style={{ fontSize: 11, fontWeight: 600, color: C.navy }}>{a.action}</p><p style={{ fontSize: 10, color: C.g400, marginTop: 2 }}>{a.rationale}</p></div></div>))}
                          </div>
                        </div>
                      )}
                    </CollapsibleSection>
                  )}

                  {/* Document Gaps */}
                  {pmAnalysis.documentGaps?.length > 0 && (
                    <div style={{ padding: "14px 18px", borderRadius: 12, background: "#FFF8E1", border: `1px solid ${C.gold}25` }}>
                      <p className="flex items-center gap-1" style={{ fontSize: 11, fontWeight: 700, color: C.gold, marginBottom: 8 }}><FileWarning size={13} /> Documentos Faltantes o Desactualizados</p>
                      {pmAnalysis.documentGaps.map((g: string, i: number) => <p key={i} className="flex items-start gap-1" style={{ fontSize: 10.5, color: C.g400, marginBottom: 3 }}><span style={{ color: C.gold, flexShrink: 0 }}>•</span> {g}</p>)}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-4" style={{ padding: "60px 0", background: C.g100 }}>
                  <Brain size={44} style={{ color: `${C.gold}55` }} />
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>Sin Análisis Agéntico</p>
                    <p style={{ fontSize: 11, color: C.g400, marginTop: 4, maxWidth: 400 }}>Genera un análisis integral que cruza el SoW, Gantt, datos JIRA y financieros para obtener una evaluación de gerente de proyectos senior.</p>
                    {pmoProjectId && <Button onClick={handleGeneratePMAnalysis} className="mt-4 flex items-center gap-2 mx-auto" style={{ background: C.gold2, color: "#fff", fontSize: 12, fontWeight: 700 }}><Brain size={15} /> Generar Análisis Agéntico</Button>}
                  </div>
                </div>
              )}
            </div>

            {/* Analysis History */}
            {analysisHistoryQ.data && analysisHistoryQ.data.length > 1 && (
              <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px", boxShadow: "0 2px 16px rgba(10,22,40,.08)" }}>
                <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
                  <History size={15} style={{ color: C.g400 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>Historial de Análisis</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {analysisHistoryQ.data.map((h: any, i: number) => (
                    <div key={h.id} className="flex items-center gap-3" style={{
                      padding: "10px 14px", borderRadius: 10,
                      background: i === 0 ? `${C.teal}08` : C.g100,
                      border: i === 0 ? `1.5px solid ${C.teal}25` : `1px solid ${C.g200}`,
                    }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0, background: semaphoreColor(h.semaphore), boxShadow: `0 0 6px ${semaphoreColor(h.semaphore)}50` }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: C.navy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.overallVerdict ? (h.overallVerdict as string).substring(0, 100) + "..." : "Análisis Agéntico"}</p>
                        <div className="flex items-center gap-2" style={{ marginTop: 2 }}>
                          <span style={{ fontSize: 9.5, color: C.g400 }}>{formatDate(h.createdAt)}</span>
                          <span style={{ fontSize: 9.5, color: C.g400 }}>por {h.generatedByName}</span>
                          {(h.metricsSnapshot as any)?.sowComplianceScore != null && <span style={{ fontSize: 9, padding: "1px 8px", borderRadius: 10, background: "#FFF8E1", color: C.gold }}>SoW: {(h.metricsSnapshot as any).sowComplianceScore}%</span>}
                        </div>
                      </div>
                      {i === 0 && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 10, background: "#E8F5E9", color: C.teal, fontWeight: 700 }}>Actual</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: ÉPICAS E HITOS */}
        {activeTab === "epics" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {progressInsights ? (
              <EpicProgressPanel insights={progressInsights} />
            ) : (
              <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px", boxShadow: "0 2px 16px rgba(10,22,40,.08)" }}>
                <p style={{ fontSize: 12, color: C.g400 }}>Detalle de épicas N/D hasta que la lectura Jira live esté disponible.</p>
              </div>
            )}
            <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px", boxShadow: "0 2px 16px rgba(10,22,40,.08)" }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
                <Milestone size={15} style={{ color: C.teal }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>Hitos del Proyecto ({milestonesDone}/{milestonesTotal})</span>
              </div>
              {data.milestones.length === 0 ? <p style={{ fontSize: 12, color: C.g400 }}>No se encontraron hitos.</p> : (
                <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-2">
                  {data.milestones.map((m: any, i: number) => {
                    const isDone = m.statusCategory === "Done";
                    return (
                      <div key={i} className="flex items-start gap-3" style={{
                        padding: "12px 14px", borderRadius: 10,
                        background: isDone ? "#E8F5E9" : C.g100,
                        border: `1px solid ${isDone ? C.teal : C.g200}25`,
                      }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, fontWeight: 800, color: "#fff", flexShrink: 0,
                          background: isDone ? C.teal : C.g300,
                        }}>{isDone ? "✓" : `H${i + 1}`}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: C.navy }}>{m.summary}</p>
                          <div className="flex items-center gap-2" style={{ marginTop: 4 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: isDone ? "#E8F5E9" : "#FFF8E1", color: isDone ? C.teal : C.gold }}>{isDone ? "Cumplido" : m.status}</span>
                            {m.percentage && <span style={{ fontSize: 9.5, color: C.g400 }}>{m.percentage}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: RISKS */}
        {activeTab === "risks" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px", boxShadow: "0 2px 16px rgba(10,22,40,.08)" }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
                <ShieldAlert size={15} style={{ color: C.red }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>Riesgos del Proyecto ({isSnapshotOnly ? portfolioEvidence?.openRisks ?? "N/D" : data.risks.length})</span>
              </div>
              {data.risks.length === 0 ? <p style={{ fontSize: 12, color: C.g400 }}>{isSnapshotOnly ? "El snapshot conserva conteos; el detalle de cada riesgo está N/D." : "No se encontraron riesgos registrados."}</p> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {data.risks.map((r: any, i: number) => {
                    const isOpen = r.statusCategory !== "Done";
                    const rc = isOpen ? C.red : C.teal;
                    const bg = isOpen ? "#FFEBEE" : "#E8F5E9";
                    return (
                      <div key={i} className="flex items-start gap-3" style={{ padding: "14px 16px", borderRadius: 10, background: bg, borderLeft: `3px solid ${rc}` }}>
                        <AlertTriangle size={16} style={{ color: rc }} className="flex-shrink-0 mt-0.5" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: C.navy }}>{r.summary}</p>
                          <div className="flex items-center gap-2" style={{ marginTop: 6 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: `${rc}15`, color: rc }}>{isOpen ? "Abierto" : "Cerrado"}</span>
                            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: "#FFF8E1", color: C.gold }}>{r.priority}</span>
                            {r.assignee && <span style={{ fontSize: 9.5, color: C.g400 }}>Asignado: {r.assignee}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: TEAM */}
        {activeTab === "team" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px", boxShadow: "0 2px 16px rgba(10,22,40,.08)" }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
                <Users size={15} style={{ color: C.accent }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>Equipo del Proyecto ({isSnapshotOnly ? "N/D" : `${data.team.length} miembros`})</span>
              </div>
              {data.team.length === 0 ? <p style={{ fontSize: 12, color: C.g400 }}>{isSnapshotOnly ? "Detalle del equipo N/D en el snapshot local." : "No se encontraron miembros del equipo."}</p> : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  {data.team.map((member: any, i: number) => {
                    const memberPct = member.total > 0 ? Math.round((member.done / member.total) * 100) : 0;
                    return (
                      <div key={i} className="flex items-center gap-3" style={{ padding: "14px 16px", borderRadius: 10, background: C.g100, border: `1px solid ${C.g200}` }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 13, fontWeight: 700, color: "#fff",
                          background: `linear-gradient(135deg, ${C.accent}, ${C.teal})`,
                        }}>{member.name?.charAt(0) ?? "?"}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 11.5, fontWeight: 600, color: C.navy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{member.name}</p>
                          <div className="flex items-center gap-3" style={{ marginTop: 2 }}>
                            <span style={{ fontSize: 9.5, color: C.g400 }}>{member.total} issues</span>
                            <span style={{ fontSize: 9.5, color: C.teal }}>{member.done} done</span>
                            <span style={{ fontSize: 9.5, color: C.accent }}>{member.inProgress} prog</span>
                          </div>
                          <div style={{ width: "100%", height: 4, background: C.g200, borderRadius: 10, marginTop: 6, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${memberPct}%`, background: memberPct >= 80 ? C.teal : memberPct >= 50 ? C.gold : C.accent, borderRadius: 10 }} />
                          </div>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 800, color: memberPct >= 80 ? C.teal : memberPct >= 50 ? C.gold : C.g400 }}>{memberPct}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══ FOOTER ═══ */}
      <div style={{
        background: C.navy2, padding: "12px 36px", display: "flex", justifyContent: "space-between",
        alignItems: "center", borderTop: "1px solid rgba(255,255,255,.06)",
      }}>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,.3)" }}>Prodigio Tech · Reporte de Avance JIRA · Confidencial</span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,.3)" }}>
          Datos al {new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" })}
        </span>
      </div>
    </div>
  );
}

/* ═══ REUSABLE COMPONENTS ═══ */
function CollapsibleSection({ title, icon, expanded, onToggle, badge, children }: { title: string; icon: React.ReactNode; expanded: boolean; onToggle: () => void; badge?: { text: string; color: string }; children: React.ReactNode }) {
  return (
    <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${C.g200}` }}>
      <button onClick={onToggle} className="w-full flex items-center justify-between hover:opacity-90 transition-opacity" style={{ padding: "12px 16px", background: C.g100 }}>
        <div className="flex items-center gap-2">{icon}<span style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>{title}</span>{badge && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 10, background: `${badge.color}15`, color: badge.color, fontWeight: 700 }}>{badge.text}</span>}</div>
        {expanded ? <ChevronUp size={15} style={{ color: C.g400 }} /> : <ChevronDown size={15} style={{ color: C.g400 }} />}
      </button>
      {expanded && <div style={{ padding: "14px 16px", background: "#fff" }}>{children}</div>}
    </div>
  );
}

function SignalCard({ title, icon, color, bg, items, emptyText }: { title: string; icon: React.ReactNode; color: string; bg: string; items?: string[]; emptyText: string }) {
  return (
    <div style={{ padding: "12px 14px", borderRadius: 10, background: bg, borderLeft: `3px solid ${color}` }}>
      <p className="flex items-center gap-1" style={{ fontSize: 10, fontWeight: 700, color, marginBottom: 6 }}>{icon} {title}</p>
      {items && items.length > 0 ? items.map((s, i) => <p key={i} className="flex items-start gap-1" style={{ fontSize: 10.5, color: C.g400, marginBottom: 3 }}><span style={{ color, flexShrink: 0 }}>•</span> {s}</p>) : <p style={{ fontSize: 10.5, color: C.g400 }}>{emptyText}</p>}
    </div>
  );
}

function ArrowUpRight(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" />
    </svg>
  );
}
