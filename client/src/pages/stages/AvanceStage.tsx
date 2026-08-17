import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, RefreshCw, FileDown, Sparkles, CheckCircle2, Clock, AlertTriangle, XCircle, Users, Target, Shield, ArrowUpDown, TrendingUp } from "lucide-react";
import AppBreadcrumb from "@/components/AppBreadcrumb";
import StageLayout from "@/components/StageLayout";
import { CalendarDays, Timer, BarChart3 } from "lucide-react";
import StageClosurePanel from "@/components/StageClosurePanel";
import { toast } from "sonner";

// Semaphore colors
const SEMAPHORE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  VERDE: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300" },
  AMARILLO: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-300" },
  ROJO: { bg: "bg-red-50", text: "text-red-700", border: "border-red-300" },
};

// Status category colors
function statusCatColor(cat: string) {
  if (cat === "Done") return "bg-emerald-100 text-emerald-800";
  if (cat === "In Progress") return "bg-blue-100 text-blue-800";
  return "bg-slate-100 text-slate-700";
}

function priorityColor(p: string) {
  if (p === "URGENTE") return "bg-red-600 text-white";
  if (p === "ALTA") return "bg-amber-500 text-white";
  return "bg-cyan-600 text-white";
}

/** Custom progress panel for Avance Proyecto - shows Gantt time consumption vs real progress */
function ProjectProgressPanel({ projectId, percentComplete, startDate, endDate }: {
  projectId: number;
  percentComplete: number;
  startDate?: string | null;
  endDate?: string | null;
}) {
  const { data: timeData } = trpc.stageOpenings.timeRemaining.useQuery({ projectId });
  const timeInfo = timeData?.find((t: any) => t.stageId === "design");

  // Calculate Gantt dates
  const ganttStart = startDate ? new Date(startDate) : null;
  const ganttEnd = endDate ? new Date(endDate) : null;
  const today = new Date();

  // Total Gantt days (from timeInfo which already calculates from Gantt)
  const totalGanttDays = timeInfo?.totalBusinessDays ?? timeInfo?.maxBusinessDays ?? 0;
  const usedDays = timeInfo?.usedBusinessDays ?? 0;
  const remainingDays = timeInfo?.remainingBusinessDays ?? (totalGanttDays - usedDays);
  const timeConsumedPct = totalGanttDays > 0 ? Math.min(Math.round((usedDays / totalGanttDays) * 100), 100) : 0;

  // Determine health: compare time consumed vs real progress
  const gap = timeConsumedPct - percentComplete; // positive = behind schedule
  let healthStatus: "on_track" | "caution" | "warning" | "critical";
  let healthLabel: string;
  let healthColor: string;
  let healthBg: string;
  let healthBorder: string;

  if (gap <= 5) {
    healthStatus = "on_track";
    healthLabel = "En tiempo";
    healthColor = "text-emerald-700";
    healthBg = "bg-emerald-50 dark:bg-emerald-950/20";
    healthBorder = "border-emerald-200 dark:border-emerald-800";
  } else if (gap <= 15) {
    healthStatus = "caution";
    healthLabel = "Precaución";
    healthColor = "text-amber-700";
    healthBg = "bg-amber-50 dark:bg-amber-950/20";
    healthBorder = "border-amber-200 dark:border-amber-800";
  } else if (gap <= 30) {
    healthStatus = "warning";
    healthLabel = "Alerta";
    healthColor = "text-orange-700";
    healthBg = "bg-orange-50 dark:bg-orange-950/20";
    healthBorder = "border-orange-200 dark:border-orange-800";
  } else {
    healthStatus = "critical";
    healthLabel = "Crítico";
    healthColor = "text-red-700";
    healthBg = "bg-red-50 dark:bg-red-950/20";
    healthBorder = "border-red-200 dark:border-red-800";
  }

  const timeBarColor = healthStatus === "on_track" ? "#10b981" : healthStatus === "caution" ? "#eab308" : healthStatus === "warning" ? "#f97316" : "#ef4444";
  const progressBarColor = "#0891b2";

  const formatDate = (d: Date) => d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });

  if (!ganttStart && !ganttEnd && totalGanttDays === 0) {
    return (
      <Card className="border-slate-200 bg-slate-50 dark:bg-slate-950/20">
        <CardContent className="py-4 px-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            <span className="text-sm">No hay carta Gantt cargada para calcular el plazo del proyecto.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border ${healthBorder} ${healthBg}`}>
      <CardContent className="py-5 px-6 space-y-5">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" style={{ color: timeBarColor }} />
            <span className={`text-sm font-bold ${healthColor}`}>{healthLabel}</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {ganttStart && (
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" /> Inicio: {formatDate(ganttStart)}
              </span>
            )}
            {ganttEnd && (
              <span className="flex items-center gap-1">
                <Timer className="h-3.5 w-3.5" /> Fin: {formatDate(ganttEnd)}
              </span>
            )}
          </div>
        </div>

        {/* Two-column layout: Time Consumption vs Real Progress */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Time Consumption (Gantt) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-slate-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Consumo de Tiempo</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center bg-white/60 dark:bg-gray-800/40 rounded-lg py-2">
                <p className="text-[10px] text-muted-foreground uppercase">Plazo Total</p>
                <p className="text-lg font-bold text-foreground">{totalGanttDays}d</p>
                <p className="text-[10px] text-muted-foreground">hábiles</p>
              </div>
              <div className="text-center bg-white/60 dark:bg-gray-800/40 rounded-lg py-2">
                <p className="text-[10px] text-muted-foreground uppercase">Transcurrido</p>
                <p className="text-lg font-bold" style={{ color: timeBarColor }}>{usedDays}d</p>
                <p className="text-[10px] text-muted-foreground">hábiles</p>
              </div>
              <div className="text-center bg-white/60 dark:bg-gray-800/40 rounded-lg py-2">
                <p className="text-[10px] text-muted-foreground uppercase">Restante</p>
                <p className="text-lg font-bold" style={{ color: remainingDays <= 0 ? "#ef4444" : "#059669" }}>
                  {remainingDays <= 0 ? `${Math.abs(remainingDays)}d` : `${remainingDays}d`}
                </p>
                <p className="text-[10px] text-muted-foreground">{remainingDays <= 0 ? "vencido" : "hábiles"}</p>
              </div>
            </div>
            <div>
              <div className="h-3 bg-white/60 dark:bg-gray-800/60 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(timeConsumedPct, 100)}%`, backgroundColor: timeBarColor }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 text-right">{timeConsumedPct}% del tiempo consumido</p>
            </div>
          </div>

          {/* Right: Real Progress (JIRA) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4 text-cyan-600" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Avance Real del Proyecto</span>
            </div>
            <div className="flex items-center justify-center">
              <div className="relative w-28 h-28">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-white/60 dark:text-gray-800/60" />
                  <circle
                    cx="50" cy="50" r="42" fill="none"
                    stroke={progressBarColor}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${percentComplete * 2.64} ${264 - percentComplete * 2.64}`}
                    className="transition-all duration-700"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold" style={{ color: progressBarColor }}>{percentComplete}%</span>
                  <span className="text-[9px] text-muted-foreground">completado</span>
                </div>
              </div>
            </div>
            <div>
              <div className="h-3 bg-white/60 dark:bg-gray-800/60 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${percentComplete}%`, backgroundColor: progressBarColor }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 text-right">{percentComplete}% de avance real (JIRA)</p>
            </div>
          </div>
        </div>

        {/* Comparison indicator */}
        <div className="flex items-center justify-center gap-3 pt-2 border-t" style={{ borderColor: timeBarColor + "30" }}>
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: timeBarColor }} />
            <span className="text-muted-foreground">Tiempo: {timeConsumedPct}%</span>
          </div>
          <span className="text-muted-foreground text-xs">vs</span>
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: progressBarColor }} />
            <span className="text-muted-foreground">Avance: {percentComplete}%</span>
          </div>
          <span className={`text-xs font-bold ml-2 px-2 py-0.5 rounded-full ${
            gap <= 5 ? "bg-emerald-100 text-emerald-700" :
            gap <= 15 ? "bg-amber-100 text-amber-700" :
            gap <= 30 ? "bg-orange-100 text-orange-700" :
            "bg-red-100 text-red-700"
          }`}>
            {gap <= 0 ? `Adelantado ${Math.abs(gap)}%` : `Atraso ${gap}%`}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AvanceStage() {
  const params = useParams<{ id: string }>();
  const projectId = Number(params.id);

  const projectQ = trpc.projects.get.useQuery({ id: projectId });
  const reportQ = trpc.advance.getReport.useQuery({ projectId }, { retry: 1 });
  const stageQ = trpc.stages.getAll.useQuery({ projectId });

  const [summary, setSummary] = useState<any>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [generatingPptx, setGeneratingPptx] = useState(false);
  const [generatingDocx, setGeneratingDocx] = useState(false);

  const generateSummaryMut = trpc.advance.generateSummary.useMutation();
  const generatePptxMut = trpc.advance.generatePptx.useMutation();
  const generateDocxMut = trpc.advance.generateDocx.useMutation();

  const project = projectQ.data;
  const report = reportQ.data;
  const stage = stageQ.data?.find((s: any) => s.stageId === "design");

  const breadcrumbSegments = [
    { label: "PMO Proyectos", href: "/projects" },
    { label: project?.projectName || "...", href: `/projects/${projectId}` },
    { label: "Avance Proyecto" },
  ];

  async function handleGenerateSummary() {
    setGeneratingSummary(true);
    try {
      const result = await generateSummaryMut.mutateAsync({ projectId });
      setSummary(result.data);
      toast.success("Resumen ejecutivo generado con IA");
    } catch (e: any) {
      toast.error(e.message || "Error al generar resumen");
    } finally {
      setGeneratingSummary(false);
    }
  }

  async function handleGeneratePptx() {
    setGeneratingPptx(true);
    try {
      const result = await generatePptxMut.mutateAsync({ projectId, summary: summary || undefined });
      toast.success(`Reporte generado: ${result.fileName}`);
      // Download
      const a = document.createElement("a");
      a.href = result.url;
      a.download = result.fileName;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e: any) {
      toast.error(e.message || "Error al generar PPTX");
    } finally {
      setGeneratingPptx(false);
    }
  }

  async function handleGenerateDocx() {
    setGeneratingDocx(true);
    try {
      const result = await generateDocxMut.mutateAsync({ projectId, summary: summary || undefined });
      toast.success(`Reporte generado: ${result.fileName}`);
      const a = document.createElement("a");
      a.href = result.url;
      a.download = result.fileName;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e: any) {
      toast.error(e.message || "Error al generar DOCX");
    } finally {
      setGeneratingDocx(false);
    }
  }

  if (reportQ.isLoading || projectQ.isLoading) {
    return (
      <div className="p-6 space-y-4">
        <AppBreadcrumb segments={breadcrumbSegments} />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Consultando datos de JIRA...</span>
        </div>
      </div>
    );
  }

  if (reportQ.isError) {
    return (
      <div className="p-6 space-y-4">
        <AppBreadcrumb segments={breadcrumbSegments} />
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">No se pudo obtener el reporte de avance</p>
                <p className="text-sm text-amber-700 mt-1">{reportQ.error?.message || "Verifique que el proyecto tenga un Space JIRA vinculado."}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => reportQ.refetch()}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Reintentar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!report) return null;

  const pctColor = report.percentComplete >= 70 ? "text-emerald-600" : report.percentComplete >= 40 ? "text-amber-600" : "text-red-600";
  const pctBg = report.percentComplete >= 70 ? "bg-emerald-500" : report.percentComplete >= 40 ? "bg-amber-500" : "bg-red-500";

  return (
    <StageLayout
      projectName={project?.projectName ?? "Proyecto"}
      projectId={projectId}
      stageKey="advance"
      subtitle={`Datos de JIRA \u00b7 ${report.projectKey} \u00b7 Actualizado: ${new Date(report.lastUpdated).toLocaleString("es-CL")}`}
      icon={<TrendingUp size={22} />}
      headerRight={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => reportQ.refetch()} disabled={reportQ.isFetching} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
            <RefreshCw className={`h-4 w-4 mr-2 ${reportQ.isFetching ? "animate-spin" : ""}`} /> Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={handleGenerateSummary} disabled={generatingSummary} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
            {generatingSummary ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Generar Resumen IA
          </Button>
          <Button size="sm" onClick={handleGeneratePptx} disabled={generatingPptx} className="bg-cyan-600 hover:bg-cyan-700 text-white">
            {generatingPptx ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
            Descargar PPTX
          </Button>
          <Button size="sm" onClick={handleGenerateDocx} disabled={generatingDocx} className="bg-[#e91e8c] hover:bg-[#c81775] text-white">
            {generatingDocx ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
            Descargar DOCX
          </Button>
        </div>
      }
    >

      {/* Project Progress Panel - Gantt Time + Real Progress */}
      <ProjectProgressPanel
        projectId={projectId}
        percentComplete={report.percentComplete}
        startDate={project?.startDate}
        endDate={project?.endDate}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard label="Total Issues" value={report.totalIssues} icon={<Target className="h-5 w-5 text-slate-500" />} />
        <KpiCard label="Finalizados" value={report.doneCount} icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />} accent="emerald" />
        <KpiCard label="En Progreso" value={report.inProgressCount} icon={<Clock className="h-5 w-5 text-blue-500" />} accent="blue" />
        <KpiCard label="Pendientes" value={report.toDoCount} icon={<AlertTriangle className="h-5 w-5 text-amber-500" />} accent="amber" />
        <div className="bg-card border rounded-lg p-4 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${pctColor}`}>{report.percentComplete}%</span>
          <span className="text-xs text-muted-foreground mt-1">Avance General</span>
          <div className="w-full h-2 bg-muted rounded-full mt-2 overflow-hidden">
            <div className={`h-full ${pctBg} rounded-full transition-all`} style={{ width: `${report.percentComplete}%` }} />
          </div>
        </div>
      </div>

      {/* AI Summary */}
      {summary && (
        <Card className={`${SEMAPHORE_COLORS[summary.semaphore]?.bg || "bg-slate-50"} ${SEMAPHORE_COLORS[summary.semaphore]?.border || "border-slate-300"} border`}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full ${summary.semaphore === "VERDE" ? "bg-emerald-500" : summary.semaphore === "AMARILLO" ? "bg-amber-500" : "bg-red-500"}`} />
              <CardTitle className={`text-lg ${SEMAPHORE_COLORS[summary.semaphore]?.text || "text-slate-700"}`}>
                Resumen Ejecutivo &mdash; Semáforo: {summary.semaphore}
              </CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">{summary.semaphoreDescription}</p>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{summary.summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Tabs for detailed sections */}
      <Tabs defaultValue="distribution" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="distribution">Distribución</TabsTrigger>
          <TabsTrigger value="epics">Épicas</TabsTrigger>
          <TabsTrigger value="milestones">Hitos y Riesgos</TabsTrigger>
          <TabsTrigger value="team">Equipo</TabsTrigger>
          {summary?.nextSteps && <TabsTrigger value="nextsteps">Próximos Pasos</TabsTrigger>}
          <TabsTrigger value="closure">Cierre</TabsTrigger>
        </TabsList>

        {/* Distribution Tab */}
        <TabsContent value="distribution">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* By Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por Estado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {report.byStatus.map((s) => (
                    <div key={s.status} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="text-sm flex-1 truncate">{s.status}</span>
                      <span className="text-sm font-medium tabular-nums">{s.count}</span>
                      <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${s.percentage}%`, backgroundColor: s.color }} />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">{s.percentage}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* By Type */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por Tipo de Issue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {report.byType.map((t, i) => {
                    const colors = ["#0891b2", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
                    const color = colors[i % colors.length];
                    const pct = report.totalIssues > 0 ? Math.round((t.count / report.totalIssues) * 100) : 0;
                    return (
                      <div key={t.type} className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-sm flex-1 truncate">{t.type}</span>
                        <span className="text-sm font-medium tabular-nums">{t.count}</span>
                        <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Epics Tab */}
        <TabsContent value="epics">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-5 w-5 text-cyan-600" />
                Mapa de Épicas ({report.epics.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {report.epics.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No se encontraron épicas en el proyecto JIRA.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left py-2 px-3 font-medium">Key</th>
                        <th className="text-left py-2 px-3 font-medium">Épica</th>
                        <th className="text-center py-2 px-3 font-medium">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.epics.map((e) => (
                        <tr key={e.key} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="py-2 px-3 font-mono text-cyan-600 font-medium">{e.key}</td>
                          <td className="py-2 px-3">{e.summary}</td>
                          <td className="py-2 px-3 text-center">
                            <Badge variant="secondary" className={statusCatColor(e.statusCategory)}>{e.status}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Milestones & Risks Tab */}
        <TabsContent value="milestones">
          <div className="grid grid-cols-1 gap-6">
            {/* Milestones */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Hitos del Proyecto
                  <Badge variant="outline" className="ml-2">{report.milestonesCumplidos} cumplidos / {report.milestonesPendientes} pendientes</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {report.milestones.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No se encontraron hitos en el proyecto JIRA.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left py-2 px-3 font-medium">Key</th>
                          <th className="text-left py-2 px-3 font-medium">Hito</th>
                          <th className="text-center py-2 px-3 font-medium">%</th>
                          <th className="text-center py-2 px-3 font-medium">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.milestones.map((m) => (
                          <tr key={m.key} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="py-2 px-3 font-mono text-cyan-600 font-medium">{m.key}</td>
                            <td className="py-2 px-3">{m.summary}</td>
                            <td className="py-2 px-3 text-center font-medium">{m.percentage ? `${m.percentage}%` : "-"}</td>
                            <td className="py-2 px-3 text-center">
                              <Badge variant="secondary" className={statusCatColor(m.statusCategory)}>{m.status}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Risks */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-5 w-5 text-amber-600" />
                  Riesgos
                  <Badge variant="outline" className="ml-2">
                    {report.risks.filter(r => r.statusCategory === "Done").length} cerrados / {report.risks.filter(r => r.statusCategory !== "Done").length} abiertos
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {report.risks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No se encontraron riesgos en el proyecto JIRA.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left py-2 px-3 font-medium">Key</th>
                          <th className="text-left py-2 px-3 font-medium">Riesgo</th>
                          <th className="text-center py-2 px-3 font-medium">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.risks.map((r) => (
                          <tr key={r.key} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="py-2 px-3 font-mono text-cyan-600 font-medium">{r.key}</td>
                            <td className="py-2 px-3">{r.summary}</td>
                            <td className="py-2 px-3 text-center">
                              <Badge variant="secondary" className={statusCatColor(r.statusCategory)}>{r.status}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Scope Changes */}
            {report.scopeChanges.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ArrowUpDown className="h-5 w-5 text-purple-600" />
                    Cambios de Alcance ({report.scopeChanges.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left py-2 px-3 font-medium">Key</th>
                          <th className="text-left py-2 px-3 font-medium">Cambio</th>
                          <th className="text-center py-2 px-3 font-medium">Prioridad</th>
                          <th className="text-center py-2 px-3 font-medium">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.scopeChanges.map((sc) => (
                          <tr key={sc.key} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="py-2 px-3 font-mono text-cyan-600 font-medium">{sc.key}</td>
                            <td className="py-2 px-3">{sc.summary}</td>
                            <td className="py-2 px-3 text-center"><Badge variant="outline">{sc.priority}</Badge></td>
                            <td className="py-2 px-3 text-center">
                              <Badge variant="secondary" className={statusCatColor(sc.statusCategory)}>{sc.status}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Equipo y Contribuciones ({report.team.length} miembros)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {report.team.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No se encontraron asignaciones de equipo.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left py-2 px-3 font-medium">Recurso</th>
                        <th className="text-left py-2 px-3 font-medium">Contribución</th>
                        <th className="text-center py-2 px-3 font-medium">Issues</th>
                        <th className="text-center py-2 px-3 font-medium">Completados</th>
                        <th className="text-center py-2 px-3 font-medium">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.team.map((t) => (
                        <tr key={t.name} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              {t.avatar ? (
                                <img src={t.avatar} alt={t.name} className="w-7 h-7 rounded-full" />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                                  {t.name.charAt(0)}
                                </div>
                              )}
                              <span className="font-medium">{t.name}</span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-muted-foreground">{t.contribution}</td>
                          <td className="py-2 px-3 text-center font-medium">{t.total}</td>
                          <td className="py-2 px-3 text-center font-medium text-emerald-600">{t.done}</td>
                          <td className="py-2 px-3 text-center">
                            <Badge variant="secondary" className={
                              t.status === "Completado" ? "bg-emerald-100 text-emerald-800" :
                              t.status === "Trabajo activo" ? "bg-blue-100 text-blue-800" :
                              "bg-slate-100 text-slate-700"
                            }>
                              {t.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Next Steps Tab */}
        {summary?.nextSteps && (
          <TabsContent value="nextsteps">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Próximos Pasos para Cierre</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {summary.nextSteps.map((step: any, i: number) => {
                    const borderColor = step.priority === "URGENTE" ? "border-l-red-500" : step.priority === "ALTA" ? "border-l-amber-500" : "border-l-cyan-500";
                    return (
                      <div key={i} className={`border-l-4 ${borderColor} bg-muted/30 rounded-r-lg p-4`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{step.title}</span>
                          <Badge className={priorityColor(step.priority)}>{step.priority}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Closure Tab */}
        <TabsContent value="closure">
          <StageClosurePanel projectId={projectId} stageId="design" stageName="Avance Proyecto" stageStatus={stage?.status || "not_started"} />
        </TabsContent>
      </Tabs>
    </StageLayout>
  );
}

function KpiCard({ label, value, icon, accent }: { label: string; value: number; icon: React.ReactNode; accent?: string }) {
  return (
    <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${accent ? `bg-${accent}-50` : "bg-muted"}`}>
        {icon}
      </div>
      <div>
        <span className="text-2xl font-bold">{value}</span>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
