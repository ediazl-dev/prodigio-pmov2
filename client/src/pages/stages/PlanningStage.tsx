import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { summarizeMonetaryItems } from "@shared/monetaryTotals";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  DollarSign,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Landmark,
  Loader2,
  Lock,
  Mail,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  User,
  AlertTriangle,
} from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import StageClosurePanel from "@/components/StageClosurePanel";
import AppBreadcrumb from "@/components/AppBreadcrumb";
import StageLayout from "@/components/StageLayout";
import StageTimeIndicator from "@/components/StageTimeIndicator";
import { BacklogProgressPanel, MilestoneProgressPanel } from "@/components/JiraProgressPanel";

// ─── Constants ────────────────────────────────────────────────────────────────
const GANTT_TEMPLATE_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663043443217/bXMkzYF2PmF6AbhicJnZQ6/gantt_template_prodigio_079b5546.xlsx";

const PHASE_COLORS: Record<string, string> = {
  preparacion: "bg-gray-100 text-gray-700",
  inicio: "bg-blue-100 text-blue-700",
  planificacion: "bg-violet-100 text-violet-700",
  analisis: "bg-cyan-100 text-cyan-700",
  construccion: "bg-emerald-100 text-emerald-700",
  cierre: "bg-amber-100 text-amber-700",
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PlanningStage() {
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id);
  const { user } = useAuth();
  const canEdit = ["admin", "pmo"].includes(user?.role || "");
  const [, setLocation] = useLocation();

  const [activeSection, setActiveSection] = useState<"planning" | "billing">("planning");

  // ── Section 1 state ──────────────────────────────────────────────────────────
  const [ganttRows, setGanttRows] = useState<any[]>([]);
  const [ganttSummary, setGanttSummary] = useState<any>(null);
  const [ganttFileName, setGanttFileName] = useState<string | null>(null);
  const [uploadingGantt, setUploadingGantt] = useState(false);
  const [generatingBacklog, setGeneratingBacklog] = useState(false);
  const [backlogItems, setBacklogItems] = useState<any[]>([]);
  const [backlogInitialized, setBacklogInitialized] = useState(false);
  const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set());
  const [expandedStories, setExpandedStories] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [closingSection1, setClosingSection1] = useState(false);
  const [section1Closed, setSection1Closed] = useState(false);
  const [section1Result, setSection1Result] = useState<any>(null);
  const [section1Notes, setSection1Notes] = useState("");
  const [section1Confirmed, setSection1Confirmed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Generation overlay state ────────────────────────────────────────────────
  const [backlogGenStep, setBacklogGenStep] = useState(0);
  const [backlogGenElapsed, setBacklogGenElapsed] = useState(0);
  const [backlogGenResult, setBacklogGenResult] = useState<any>(null);
  const [milestoneGenStep, setMilestoneGenStep] = useState(0);
  const [milestoneGenElapsed, setMilestoneGenElapsed] = useState(0);
  const [milestoneGenResult, setMilestoneGenResult] = useState<any>(null);

  // ── Section 2 state ──────────────────────────────────────────────────────────
  const [billing, setBilling] = useState<any[]>([]);
  const [billingInitialized, setBillingInitialized] = useState(false);
  const [generatingMilestones, setGeneratingMilestones] = useState(false);
  const [closingSection2, setClosingSection2] = useState(false);
  const [section2Closed, setSection2Closed] = useState(false);
  const [section2Result, setSection2Result] = useState<any>(null);
  const [section2Notes, setSection2Notes] = useState("");
  const [section2Confirmed, setSection2Confirmed] = useState(false);

  // ── tRPC queries ──────────────────────────────────────────────────────────────
  const { data: project } = trpc.projects.get.useQuery({ id: projectId });
  const { data: existingTasks, refetch } = trpc.wbs.get.useQuery({ projectId });
  const { data: existingBilling, refetch: refetchBilling } = trpc.wbs.getBilling.useQuery({ projectId });
  const { data: ganttUpload } = trpc.wbs.getGanttUpload.useQuery({ projectId });
  const { data: stageClosure } = trpc.stages.getClosure.useQuery({ projectId, stageId: "planning" });

  // Sync existing data on first load
  if (existingTasks && !backlogInitialized) {
    setBacklogItems(existingTasks);
    setBacklogInitialized(true);
    const ids = new Set<number>(existingTasks.filter((i: any) => !i.jiraIssueKey && i.issueLevel).map((i: any) => i.id));
    setSelectedIds(ids);
    const hasJiraItems = existingTasks.some((i: any) => i.jiraIssueKey && i.issueLevel);
    if (hasJiraItems && !section1Closed) {
      setSection1Closed(true);
    }
  }
  if (existingBilling && !billingInitialized && existingBilling.length > 0) {
    setBilling(existingBilling);
    setBillingInitialized(true);
    const hasJiraMilestones = existingBilling.some((m: any) => m.jiraIssueKey);
    if (hasJiraMilestones && !section2Closed) {
      setSection2Closed(true);
    }
  }

  // ── Generation progress animations ──────────────────────────────────────────
  useEffect(() => {
    if (!generatingBacklog) { setBacklogGenStep(0); setBacklogGenElapsed(0); return; }
    const stepTimer = setInterval(() => setBacklogGenStep(s => s < 4 ? s + 1 : s), 7000);
    const elapsedTimer = setInterval(() => setBacklogGenElapsed(s => s + 1), 1000);
    return () => { clearInterval(stepTimer); clearInterval(elapsedTimer); };
  }, [generatingBacklog]);

  useEffect(() => {
    if (!generatingMilestones) { setMilestoneGenStep(0); setMilestoneGenElapsed(0); return; }
    const stepTimer = setInterval(() => setMilestoneGenStep(s => s < 4 ? s + 1 : s), 5000);
    const elapsedTimer = setInterval(() => setMilestoneGenElapsed(s => s + 1), 1000);
    return () => { clearInterval(stepTimer); clearInterval(elapsedTimer); };
  }, [generatingMilestones]);

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const uploadGanttMut = trpc.wbs.uploadGantt.useMutation();
  const generateBacklogMut = trpc.wbs.generateBacklogFromGantt.useMutation();
  const downloadBacklogMut = trpc.wbs.downloadBacklogExcel.useMutation();
  const closeSection1Mut = trpc.wbs.closeSection1.useMutation();
  const generateMilestonesMut = trpc.wbs.generateMilestones.useMutation();
  const saveBillingMut = trpc.wbs.saveBilling.useMutation();
  const closeSection2Mut = trpc.wbs.closeSection2.useMutation();
  const retrySection2Mut = trpc.wbs.retrySection2.useMutation();

  // ── Derived backlog data ──────────────────────────────────────────────────────
  const items = backlogItems.length > 0 ? backlogItems : (existingTasks || []);
  const epics = items.filter((t: any) => t.issueLevel === "epic");
  const stories = items.filter((t: any) => t.issueLevel === "story");
  const taskItems = items.filter((t: any) => t.issueLevel === "task");
  const milestoneItems = items.filter((t: any) => t.issueLevel === "milestone");
  const unpushedItems = items.filter((t: any) => t.issueLevel && !t.jiraIssueKey);

  // ── Cascade selection helpers ─────────────────────────────────────────────────
  const getChildStories = (epicCode: string) => stories.filter((s: any) => s.epicCode === epicCode);
  const getChildTasks = (storyCode: string) => taskItems.filter((t: any) => t.storyCode === storyCode);

  const getEpicCheckState = (epic: any): "checked" | "unchecked" | "indeterminate" => {
    const childStories = getChildStories(epic.epicCode || epic.taskCode);
    const childTasks = childStories.flatMap((s: any) => getChildTasks(s.storyCode || s.taskCode));
    const all = [epic, ...childStories, ...childTasks].filter((i) => !i.jiraIssueKey);
    if (all.length === 0) return "checked";
    const sel = all.filter((i) => selectedIds.has(i.id)).length;
    if (sel === 0) return "unchecked";
    if (sel === all.length) return "checked";
    return "indeterminate";
  };

  const getStoryCheckState = (story: any): "checked" | "unchecked" | "indeterminate" => {
    const childTasks = getChildTasks(story.storyCode || story.taskCode);
    const all = [story, ...childTasks].filter((i) => !i.jiraIssueKey);
    if (all.length === 0) return "checked";
    const sel = all.filter((i) => selectedIds.has(i.id)).length;
    if (sel === 0) return "unchecked";
    if (sel === all.length) return "checked";
    return "indeterminate";
  };

  const toggleEpicSel = (epic: any) => {
    const childStories = getChildStories(epic.epicCode || epic.taskCode);
    const childTasks = childStories.flatMap((s: any) => getChildTasks(s.storyCode || s.taskCode));
    const all = [epic, ...childStories, ...childTasks].filter((i) => !i.jiraIssueKey);
    const state = getEpicCheckState(epic);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (state === "checked") all.forEach((i) => next.delete(i.id));
      else all.forEach((i) => next.add(i.id));
      return next;
    });
  };

  const toggleStorySel = (story: any) => {
    const childTasks = getChildTasks(story.storyCode || story.taskCode);
    const all = [story, ...childTasks].filter((i) => !i.jiraIssueKey);
    const state = getStoryCheckState(story);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (state === "checked") all.forEach((i) => next.delete(i.id));
      else all.forEach((i) => next.add(i.id));
      return next;
    });
  };

  const toggleItemSel = (item: any) => {
    if (item.jiraIssueKey) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(unpushedItems.map((i: any) => i.id)));
  const clearAll = () => setSelectedIds(new Set());

  // ── Gantt Upload ──────────────────────────────────────────────────────────────
  const handleGanttUpload = async (file: File) => {
    setUploadingGantt(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      const result = await uploadGanttMut.mutateAsync({ projectId, fileName: file.name, fileBase64: base64 });
      setGanttRows(result.rows);
      setGanttSummary(result.summary);
      setGanttFileName(file.name);
      toast.success(`Gantt cargado: ${result.summary.totalRows} filas — ${result.summary.phases} fases, ${result.summary.tasks} tareas, ${result.summary.hitos} hitos`);
    } catch (e: any) {
      toast.error(`Error al cargar Gantt: ${e.message}`);
    } finally {
      setUploadingGantt(false);
    }
  };

  // ── Generate Backlog ──────────────────────────────────────────────────────────
  const handleGenerateBacklog = async () => {
    if (ganttRows.length === 0 && !ganttUpload) {
      toast.error("Carga el Gantt primero");
      return;
    }
    setGeneratingBacklog(true);
    setBacklogGenResult(null);
    setBacklogGenStep(0);
    setBacklogGenElapsed(0);
    try {
      const result = await generateBacklogMut.mutateAsync({ projectId, ganttRows: ganttRows.length > 0 ? ganttRows : undefined });
      const savedItems = result.items as any[];
      setBacklogItems(savedItems);
      setBacklogInitialized(true);
      const ids = new Set<number>(savedItems.filter((i: any) => !i.jiraIssueKey && i.issueLevel && i.id).map((i: any) => i.id));
      setSelectedIds(ids);
      setExpandedEpics(new Set(savedItems.filter((i: any) => i.issueLevel === "epic").map((i: any) => i.epicCode || i.taskCode)));
      await refetch();
      const epicCount = savedItems.filter((i: any) => i.issueLevel === "epic").length;
      const storyCount = savedItems.filter((i: any) => i.issueLevel === "story").length;
      const taskCount = savedItems.filter((i: any) => i.issueLevel === "task").length;
      setBacklogGenResult({ success: true, epics: epicCount, stories: storyCount, tasks: taskCount, total: savedItems.length, elapsedMs: result.elapsedMs });
      toast.success(`Backlog generado: ${epicCount} épicas, ${storyCount} historias, ${taskCount} tareas`);
    } catch (e: any) {
      setBacklogGenResult({ success: false, error: e.message });
      toast.error(`Error: ${e.message}`);
    } finally {
      setGeneratingBacklog(false);
    }
  };

  // ── Download Backlog Excel ────────────────────────────────────────────────────
  const handleDownloadBacklog = async () => {
    try {
      const result = await downloadBacklogMut.mutateAsync({ projectId });
      const link = document.createElement("a");
      link.href = result.url;
      link.download = result.fileName;
      link.target = "_blank";
      link.click();
      toast.success("Planilla descargada");
    } catch (e: any) {
      toast.error(`Error: ${e.message}`);
    }
  };

  // ── Close Section 1 ──────────────────────────────────────────────────────────
  const handleCloseSection1 = async () => {
    setClosingSection1(true);
    try {
      const result = await closeSection1Mut.mutateAsync({
        projectId,
        confirmationText: `Confirmo el cierre de la sección de planificación con ${selectedIds.size} items seleccionados`,
        notes: section1Notes,
        selectedIds: Array.from(selectedIds),
      });
      setSection1Result(result);
      setSection1Closed(true);
      await refetch();
      toast.success(`Sección cerrada: ${result.created} issues creados en JIRA`);
    } catch (e: any) {
      toast.error(`Error: ${e.message}`);
    } finally {
      setClosingSection1(false);
    }
  };

  // ── Billing helpers ──────────────────────────────────────────────────────────
  const billingItems = billing.length > 0 ? billing : (existingBilling || []);
  const defaultCurrency = billingItems[0]?.currency || "USD";
  const monetarySummary = summarizeMonetaryItems(billingItems);
  const currencyEntries = monetarySummary.entries;
  const billingTotalLabel = monetarySummary.isSingleCurrency
    ? `${currencyEntries[0][0]} ${currencyEntries[0][1].toLocaleString("es-CL", { minimumFractionDigits: 0 })}`
    : monetarySummary.isMultiCurrency
      ? "Multimoneda — no se suma"
      : "N/D";
  const isStageClosed = !!stageClosure;

  // ── Validation: responsable + email required for closure ────────────────────
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const incompleteMilestones = billingItems.filter((m: any) => !m.responsableName?.trim() || !m.responsableEmail?.trim());
  const invalidEmailMilestones = billingItems.filter((m: any) => m.responsableEmail?.trim() && !emailRegex.test(m.responsableEmail.trim()));
  const canCloseSection2 = incompleteMilestones.length === 0 && invalidEmailMilestones.length === 0 && billingItems.length > 0;

  const updateMilestone = (idx: number, field: string, value: any) => {
    const updated = [...billingItems];
    updated[idx] = { ...updated[idx], [field]: value };
    setBilling(updated);
  };
  const addMilestone = () => {
    setBilling([...billingItems, {
      id: Date.now(),
      projectId,
      milestoneNumber: billingItems.length + 1,
      description: "",
      currency: defaultCurrency,
      amount: "",
      percentage: "",
      dueDate: "",
      responsableName: "",
      responsableEmail: "",
    }]);
  };
  const removeMilestone = (idx: number) => {
    const updated = billingItems.filter((_: any, i: number) => i !== idx).map((m: any, i: number) => ({ ...m, milestoneNumber: i + 1 }));
    setBilling(updated);
  };
  const saveMilestones = async () => {
    try {
      await saveBillingMut.mutateAsync({ projectId, milestones: billingItems });
      await refetchBilling();
      toast.success("Hitos guardados");
    } catch (e: any) {
      toast.error(`Error: ${e.message}`);
    }
  };

  // ── Generate Milestones ──────────────────────────────────────────────────────
  const handleGenerateMilestones = async () => {
    setGeneratingMilestones(true);
    setMilestoneGenResult(null);
    setMilestoneGenStep(0);
    setMilestoneGenElapsed(0);
    try {
      const result = await generateMilestonesMut.mutateAsync({ projectId });
      setBilling(result.milestones as any[]);
      setBillingInitialized(true);
      setMilestoneGenResult({
        success: true,
        count: result.milestones.length,
        sources: result.sources,
        totalAmount: result.totalAmount,
        currency: result.currency,
        elapsedMs: result.elapsedMs,
      });
      toast.success(`${result.milestones.length} hitos propuestos`);
    } catch (e: any) {
      setMilestoneGenResult({ success: false, error: e.message });
      toast.error(`Error: ${e.message}`);
    } finally {
      setGeneratingMilestones(false);
    }
  };

  // ── Close Section 2 ──────────────────────────────────────────────────────────
  const handleCloseSection2 = async () => {
    setClosingSection2(true);
    try {
      await saveBillingMut.mutateAsync({ projectId, milestones: billingItems });
      const result = await closeSection2Mut.mutateAsync({ projectId, confirmationText: `Confirmo el cierre de la sección de hitos de pago con ${billingItems.length} hitos`, notes: section2Notes });
      setSection2Result(result);
      setSection2Closed(true);
      await refetchBilling();
      // Rich toast notification with JIRA details
      if (result.errors === 0) {
        toast.success(`${result.created} hitos creados exitosamente en JIRA`, {
          description: `Proyecto: ${result.projectKey} · ${result.jiraKeys?.join(", ") || ""} · ${(result.elapsedMs / 1000).toFixed(1)}s`,
          duration: 8000,
          action: result.projectKey ? {
            label: "Ver en JIRA",
            onClick: () => window.open(`https://prodigio-tech.atlassian.net/jira/core/projects/${result.projectKey}/board`, "_blank"),
          } : undefined,
        });
      } else if (result.created > 0) {
        toast.warning(`${result.created} hitos creados, ${result.errors} con error`, {
          description: `Proyecto: ${result.projectKey} · Usa "Reintentar Hitos Pendientes" para los fallidos`,
          duration: 10000,
        });
      } else {
        toast.error(`No se pudieron crear los hitos en JIRA (${result.errors} errores)`, {
          description: `Proyecto: ${result.projectKey} · Revisa la conexión JIRA e intenta de nuevo`,
          duration: 10000,
        });
      }
    } catch (e: any) {
      toast.error(`Error: ${e.message}`);
    } finally {
      setClosingSection2(false);
    }
  };

  // ── Section status helpers ────────────────────────────────────────────────────
  const section1HasContent = items.filter((i: any) => i.issueLevel).length > 0;
  const section2HasContent = billingItems.length > 0;

  return (
    <StageLayout
      projectName={project?.projectName ?? "Proyecto"}
      projectId={projectId}
      stageKey="planning"
      subtitle={project?.projectName}
      icon={<ClipboardList size={22} />}
      headerRight={
        isStageClosed ? (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1">
            <Lock className="h-3 w-3" /> Etapa Cerrada
          </span>
        ) : undefined
      }
    >

      {/* Time Indicator */}
      <StageTimeIndicator projectId={projectId} stageId="planning" />

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION TABS                                                             */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <div className="flex gap-3">
        {/* Tab 1: Planificación */}
        <button
          onClick={() => setActiveSection("planning")}
          className={`
            group relative flex-1 rounded-xl border-2 p-4 text-left transition-all duration-200
            ${activeSection === "planning"
              ? "border-violet-500 bg-violet-50/50 dark:bg-violet-950/20 shadow-sm"
              : "border-border hover:border-violet-300 hover:bg-violet-50/20 dark:hover:bg-violet-950/10"
            }
          `}
        >
          <div className="flex items-start gap-3">
            <div className={`
              h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0
              ${section1Closed
                ? "bg-emerald-100 dark:bg-emerald-900/30"
                : activeSection === "planning"
                  ? "bg-violet-100 dark:bg-violet-900/30"
                  : "bg-muted"
              }
            `}>
              {section1Closed ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <FileSpreadsheet className={`h-5 w-5 ${activeSection === "planning" ? "text-violet-600 dark:text-violet-400" : "text-muted-foreground"}`} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sección 1</span>
                {section1Closed && (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 text-[10px] px-1.5 py-0">
                    Cerrada
                  </Badge>
                )}
              </div>
              <p className={`text-sm font-semibold mt-0.5 ${activeSection === "planning" ? "text-violet-900 dark:text-violet-100" : ""}`}>
                Planificación
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Gantt, Backlog Ágil e integración JIRA
              </p>
            </div>
          </div>
          {/* Active indicator bar */}
          {activeSection === "planning" && (
            <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-violet-500 rounded-full" />
          )}
        </button>

        {/* Tab 2: Hitos de Pago */}
        <button
          onClick={() => setActiveSection("billing")}
          className={`
            group relative flex-1 rounded-xl border-2 p-4 text-left transition-all duration-200
            ${activeSection === "billing"
              ? "border-violet-500 bg-violet-50/50 dark:bg-violet-950/20 shadow-sm"
              : "border-border hover:border-violet-300 hover:bg-violet-50/20 dark:hover:bg-violet-950/10"
            }
          `}
        >
          <div className="flex items-start gap-3">
            <div className={`
              h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0
              ${section2Closed
                ? "bg-emerald-100 dark:bg-emerald-900/30"
                : activeSection === "billing"
                  ? "bg-violet-100 dark:bg-violet-900/30"
                  : "bg-muted"
              }
            `}>
              {section2Closed ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Landmark className={`h-5 w-5 ${activeSection === "billing" ? "text-violet-600 dark:text-violet-400" : "text-muted-foreground"}`} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sección 2</span>
                {section2Closed && (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 text-[10px] px-1.5 py-0">
                    Cerrada
                  </Badge>
                )}
              </div>
              <p className={`text-sm font-semibold mt-0.5 ${activeSection === "billing" ? "text-violet-900 dark:text-violet-100" : ""}`}>
                Hitos de Pago
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Facturación, responsables e integración JIRA
              </p>
            </div>
          </div>
          {activeSection === "billing" && (
            <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-violet-500 rounded-full" />
          )}
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1 CLOSED BANNER                                                  */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeSection === "planning" && section1Closed && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
          <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Sección de Planificación cerrada</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-500">
              {items.filter((i: any) => i.jiraIssueKey).length} issues registrados en JIRA
              ({epics.filter((e: any) => e.jiraIssueKey).length} épicas, {stories.filter((s: any) => s.jiraIssueKey).length} historias, {taskItems.filter((t: any) => t.jiraIssueKey).length} tareas)
            </p>
          </div>
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
            <Lock className="h-3 w-3" /> Solo lectura
          </Badge>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 2 CLOSED BANNER                                                  */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeSection === "billing" && section2Closed && (
        <div className="space-y-3">
          <div className={`flex items-center gap-3 p-4 rounded-lg border ${
            billingItems.some((m: any) => !m.jiraIssueKey)
              ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
              : "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
          }`}>
            <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              billingItems.some((m: any) => !m.jiraIssueKey)
                ? "bg-amber-100 dark:bg-amber-900/40"
                : "bg-emerald-100 dark:bg-emerald-900/40"
            }`}>
              {billingItems.some((m: any) => !m.jiraIssueKey) ? (
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              )}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-semibold ${
                billingItems.some((m: any) => !m.jiraIssueKey)
                  ? "text-amber-800 dark:text-amber-300"
                  : "text-emerald-800 dark:text-emerald-300"
              }`}>
                {billingItems.some((m: any) => !m.jiraIssueKey)
                  ? "Sección cerrada — hitos pendientes en JIRA"
                  : "Sección de Hitos de Pago cerrada"
                }
              </p>
              <p className={`text-xs ${
                billingItems.some((m: any) => !m.jiraIssueKey)
                  ? "text-amber-600 dark:text-amber-500"
                  : "text-emerald-600 dark:text-emerald-500"
              }`}>
                {billingItems.filter((m: any) => m.jiraIssueKey).length} de {billingItems.length} hitos registrados en JIRA (Hito PMO board)
                {billingItems.some((m: any) => !m.jiraIssueKey) && (
                  <span className="font-semibold"> — {billingItems.filter((m: any) => !m.jiraIssueKey).length} pendiente(s)</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {billingItems.some((m: any) => !m.jiraIssueKey) && canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    setClosingSection2(true);
                    try {
                      const result = await retrySection2Mut.mutateAsync({ projectId });
                      setSection2Result(result);
                      if (result.created > 0) {
                        refetchBilling();
                      }
                      if (result.errors === 0) {
                        toast.success(`${result.created} hito(s) creados exitosamente en JIRA`, {
                          description: `Proyecto: ${result.projectKey} · ${result.jiraKeys?.join(", ") || ""} · ${(result.elapsedMs / 1000).toFixed(1)}s`,
                          duration: 8000,
                          action: result.projectKey ? {
                            label: "Ver en JIRA",
                            onClick: () => window.open(`https://prodigio-tech.atlassian.net/jira/core/projects/${result.projectKey}/board`, "_blank"),
                          } : undefined,
                        });
                      } else if (result.created > 0) {
                        toast.warning(`${result.created} hito(s) creados, ${result.errors} con error`, {
                          description: `Proyecto: ${result.projectKey} · Intenta de nuevo para los pendientes`,
                          duration: 10000,
                        });
                      } else {
                        toast.error(`No se pudieron crear los hitos (${result.errors} errores)`, {
                          description: `Proyecto: ${result.projectKey} · Verifica la conexión JIRA`,
                          duration: 10000,
                        });
                      }
                    } catch (e: any) {
                      toast.error(e.message);
                    } finally {
                      setClosingSection2(false);
                    }
                  }}
                  disabled={closingSection2}
                  className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/30"
                >
                  {closingSection2 ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Reintentar Pendientes
                </Button>
              )}
              <Badge className={`flex items-center gap-1 ${
                billingItems.some((m: any) => !m.jiraIssueKey)
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300 dark:border-amber-700"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700"
              }`}>
                <Lock className="h-3 w-3" /> Solo lectura
              </Badge>
            </div>
          </div>
          {/* Progress Panel for retry results */}
          {(closingSection2 || section2Result) && (
            <MilestoneProgressPanel
              isLoading={closingSection2}
              result={section2Result}
              estimatedItems={billingItems.filter((m: any) => !m.jiraIssueKey).length || billingItems.length}
            />
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1: PLANIFICACIÓN                                                 */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeSection === "planning" && (
        <div className="space-y-5">

          {/* Step 1: Download Template */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <StepBadge n={1} done={!!ganttUpload || ganttRows.length > 0} />
                Descargar Template Gantt Corporativo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <p className="text-sm text-muted-foreground flex-1">
                  Descarga el formato corporativo Prodigio, complétalo con las actividades del proyecto y cárgalo en el paso siguiente.
                </p>
                <Button variant="outline" asChild className="gap-2 flex-shrink-0">
                  <a href={GANTT_TEMPLATE_URL} download>
                    <Download className="h-4 w-4" /> Template Gantt (.xlsx)
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Step 2: Upload Gantt */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <StepBadge n={2} done={!!ganttUpload || ganttRows.length > 0} />
                Cargar Gantt del Proyecto
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Already uploaded info */}
              {(ganttUpload || ganttFileName) && (
                <div className="flex items-center gap-3 p-3 mb-3 bg-violet-50 dark:bg-violet-950/20 rounded-lg border border-violet-200 dark:border-violet-800">
                  <FileSpreadsheet className="h-5 w-5 text-violet-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ganttFileName || ganttUpload?.fileName}</p>
                    {ganttSummary && (
                      <p className="text-xs text-muted-foreground">
                        {ganttSummary.totalRows} filas — {ganttSummary.phases} fases, {ganttSummary.tasks} tareas, {ganttSummary.hitos} hitos
                      </p>
                    )}
                    {!ganttSummary && ganttUpload?.parsedRows && (
                      <p className="text-xs text-muted-foreground">
                        {ganttUpload.parsedRows} filas parseadas
                      </p>
                    )}
                  </div>
                  {canEdit && !section1Closed && (
                    <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1 text-xs">
                      <RefreshCw className="h-3.5 w-3.5" /> Recargar
                    </Button>
                  )}
                </div>
              )}

              {/* Upload area */}
              {!ganttUpload && !ganttFileName && canEdit && !section1Closed && (
                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-violet-400 hover:bg-violet-50/30 dark:hover:bg-violet-950/10 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer.files[0]; if (f) handleGanttUpload(f); }}
                >
                  {uploadingGantt ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                      <p className="text-sm text-muted-foreground">Procesando archivo...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm font-medium">Arrastra el archivo Gantt aquí o haz clic para seleccionar</p>
                      <p className="text-xs text-muted-foreground">Formato: .xlsx (exportado desde MS Project o template corporativo)</p>
                    </div>
                  )}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleGanttUpload(f); }}
              />
            </CardContent>
          </Card>

          {/* Step 3: Generate Backlog */}
          {generatingBacklog ? (
            <Card className="border-violet-300 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/20 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-10 w-10 rounded-xl bg-violet-600 flex items-center justify-center animate-pulse">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-violet-900 dark:text-violet-100">Generación Agéntica del Backlog</p>
                    <p className="text-xs text-violet-700 dark:text-violet-300">Analizando el Gantt y el SoW para generar el backlog ágil...</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-2xl font-mono font-bold text-violet-700 dark:text-violet-300">{backlogGenElapsed}s</p>
                    <p className="text-[10px] text-violet-600 dark:text-violet-400">Tiempo transcurrido</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Leyendo estructura WBS del Gantt cargado", icon: "📄" },
                    { label: "Analizando fases, entregables y dependencias", icon: "🔍" },
                    { label: "Mapeando a épicas, historias de usuario y tareas", icon: "🧩" },
                    { label: "Estimando story points y criterios de aceptación", icon: "🎯" },
                    { label: "Generando backlog ágil completo con jerarquía", icon: "🚀" },
                  ].map((step, i) => (
                    <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg transition-all duration-500 ${
                      i < backlogGenStep ? "bg-emerald-100/80 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" :
                      i === backlogGenStep ? "bg-white dark:bg-violet-900/40 shadow-sm border border-violet-200 dark:border-violet-700 text-violet-900 dark:text-violet-100" :
                      "text-violet-400 dark:text-violet-600"
                    }`}>
                      <span className="text-base w-6 text-center">
                        {i < backlogGenStep ? "✓" : step.icon}
                      </span>
                      <span className={`text-sm ${i === backlogGenStep ? "font-semibold" : ""}`}>{step.label}</span>
                      {i === backlogGenStep && <Loader2 className="h-3.5 w-3.5 animate-spin ml-auto text-violet-600" />}
                    </div>
                  ))}
                </div>
                <div className="mt-4 bg-violet-200/50 dark:bg-violet-800/30 rounded-full h-2 overflow-hidden">
                  <div className="bg-violet-600 h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.min((backlogGenStep / 5) * 100 + (backlogGenElapsed % 7) * 2.5, 95)}%` }} />
                </div>
                <p className="text-[11px] text-violet-600 dark:text-violet-400 mt-2 text-center">Este proceso puede tomar entre 25 y 50 segundos. No cierres esta página.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <StepBadge n={3} done={section1HasContent} />
                  Generar Backlog Ágil desde Gantt
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Generation result summary */}
                {backlogGenResult && (
                  <div className={`p-4 rounded-lg border ${
                    backlogGenResult.success
                      ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                      : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                  }`}>
                    {backlogGenResult.success ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Backlog generado exitosamente</p>
                          {backlogGenResult.elapsedMs && (
                            <span className="ml-auto text-xs text-emerald-600 font-mono">{(backlogGenResult.elapsedMs / 1000).toFixed(1)}s</span>
                          )}
                        </div>
                        <div className="flex gap-3 flex-wrap">
                          <Badge className="bg-purple-100 text-purple-700 border-purple-200 gap-1">
                            <span className="w-2 h-2 rounded-full bg-purple-600 inline-block" />
                            {backlogGenResult.epics} épicas
                          </Badge>
                          <Badge className="bg-blue-100 text-blue-700 border-blue-200 gap-1">
                            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                            {backlogGenResult.stories} historias
                          </Badge>
                          <Badge className="bg-gray-100 text-gray-700 border-gray-200 gap-1">
                            <span className="w-2 h-2 rounded-full bg-gray-500 inline-block" />
                            {backlogGenResult.tasks} tareas
                          </Badge>
                          <Badge variant="outline" className="gap-1 font-mono">
                            {backlogGenResult.total} items totales
                          </Badge>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                        <p className="text-sm font-semibold text-red-800 dark:text-red-300">Error en la generación</p>
                        <p className="text-xs text-red-600 ml-2">{backlogGenResult.error}</p>
                      </div>
                    )}
                  </div>
                )}

                {canEdit && !section1Closed && (
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      onClick={handleGenerateBacklog}
                      disabled={generatingBacklog || (!ganttRows.length && !ganttUpload)}
                      className="gap-2 bg-[#e91e8c] hover:bg-[#c2185b] text-white"
                    >
                      <Sparkles className="h-4 w-4" />
                      {section1HasContent ? "Regenerar Backlog Agéntico" : "Generar Backlog Agéntico"}
                    </Button>
                    {section1HasContent && (
                      <Button variant="outline" onClick={handleDownloadBacklog} disabled={downloadBacklogMut.isPending} className="gap-2">
                        {downloadBacklogMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        Descargar Planilla Excel
                      </Button>
                    )}
                  </div>
                )}

              {/* Backlog Tree */}
              {section1HasContent && (
                <div className="space-y-3">
                  {/* Stats */}
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline" className="gap-1 text-xs">
                      <span className="w-2 h-2 rounded-full bg-purple-600 inline-block" />
                      {epics.length} épicas
                    </Badge>
                    <Badge variant="outline" className="gap-1 text-xs">
                      <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                      {stories.length} historias
                    </Badge>
                    <Badge variant="outline" className="gap-1 text-xs">
                      <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
                      {taskItems.length} tareas
                    </Badge>
                    {items.filter((i: any) => i.jiraIssueKey).length > 0 && (
                      <Badge className="gap-1 text-xs bg-green-100 text-green-800 border-green-200">
                        {items.filter((i: any) => i.jiraIssueKey).length} en JIRA
                      </Badge>
                    )}
                  </div>

                  {/* Selection bar */}
                  {canEdit && !section1Closed && unpushedItems.length > 0 && (
                    <div className="flex items-center gap-3 p-2 bg-muted/50 rounded-md text-sm">
                      <span className="text-muted-foreground text-xs">{selectedIds.size} / {unpushedItems.length} seleccionados</span>
                      <Button variant="ghost" size="sm" onClick={selectAll} className="h-6 text-xs px-2">Seleccionar todo</Button>
                      <Button variant="ghost" size="sm" onClick={clearAll} className="h-6 text-xs px-2">Limpiar</Button>
                    </div>
                  )}

                  {/* Tree */}
                  <div className="border rounded-md overflow-hidden text-sm">
                    {epics.map((epic: any) => {
                      const epicCode = epic.epicCode || epic.taskCode;
                      const epicStories = getChildStories(epicCode);
                      const isExpanded = expandedEpics.has(epicCode);
                      const checkState = getEpicCheckState(epic);
                      const inJira = !!epic.jiraIssueKey;

                      return (
                        <div key={epic.id} className="border-b last:border-b-0">
                          {/* Epic row */}
                          <div className="flex items-center gap-2 px-3 py-2.5 bg-purple-700 text-white">
                            {canEdit && !section1Closed && (
                              <div onClick={(e) => { e.stopPropagation(); if (!inJira) toggleEpicSel(epic); }}>
                                <Checkbox
                                  checked={checkState === "checked"}
                                  ref={(el) => { if (el) (el as any).indeterminate = checkState === "indeterminate"; }}
                                  disabled={inJira}
                                  className="border-white/50 data-[state=checked]:bg-white data-[state=checked]:text-purple-700"
                                />
                              </div>
                            )}
                            <button
                              onClick={() => setExpandedEpics((prev) => { const s = new Set(prev); s.has(epicCode) ? s.delete(epicCode) : s.add(epicCode); return s; })}
                              className="flex-1 flex items-center gap-2 text-left"
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
                              <span className="text-xs font-mono bg-white/20 px-1.5 py-0.5 rounded">{epic.taskCode}</span>
                              <span className="font-medium">{epic.taskName}</span>
                              {epic.phase && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ml-1 ${PHASE_COLORS[epic.phase] ?? "bg-gray-100 text-gray-700"}`}>
                                  {epic.phase}
                                </span>
                              )}
                              <span className="text-xs text-white/60 ml-auto">{epicStories.length} historias</span>
                            </button>
                            {inJira && (
                              <span className="text-xs text-white/80 font-mono flex items-center gap-1">
                                <ExternalLink className="h-3 w-3" />{epic.jiraIssueKey}
                              </span>
                            )}
                          </div>

                          {/* Stories */}
                          {isExpanded && epicStories.map((story: any) => {
                            const storyCode = story.storyCode || story.taskCode;
                            const storyTasks = getChildTasks(storyCode);
                            const storyExpanded = expandedStories.has(storyCode);
                            const storyCheck = getStoryCheckState(story);
                            const storyInJira = !!story.jiraIssueKey;

                            return (
                              <div key={story.id} className="border-b last:border-b-0">
                                <div className="flex items-center gap-2 px-3 py-2 pl-8 bg-purple-50 dark:bg-purple-950/20">
                                  {canEdit && !section1Closed && (
                                    <div onClick={(e) => { e.stopPropagation(); if (!storyInJira) toggleStorySel(story); }}>
                                      <Checkbox
                                        checked={storyCheck === "checked"}
                                        ref={(el) => { if (el) (el as any).indeterminate = storyCheck === "indeterminate"; }}
                                        disabled={storyInJira}
                                      />
                                    </div>
                                  )}
                                  <button
                                    onClick={() => setExpandedStories((prev) => { const s = new Set(prev); s.has(storyCode) ? s.delete(storyCode) : s.add(storyCode); return s; })}
                                    className="flex-1 flex items-center gap-2 text-left"
                                  >
                                    {storyExpanded ? <ChevronDown className="h-3.5 w-3.5 text-purple-600 flex-shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-purple-600 flex-shrink-0" />}
                                    <span className="text-xs font-mono bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200 px-1.5 py-0.5 rounded">{story.taskCode}</span>
                                    <span className="text-purple-900 dark:text-purple-100">{story.taskName}</span>
                                    {story.storyPoints && (
                                      <Badge variant="outline" className="text-xs ml-1 border-purple-300 text-purple-700">{story.storyPoints} SP</Badge>
                                    )}
                                    <span className="text-xs text-muted-foreground ml-auto">{storyTasks.length} tareas</span>
                                  </button>
                                  {storyInJira && (
                                    <span className="text-xs text-green-700 font-mono flex items-center gap-1">
                                      <ExternalLink className="h-3 w-3" />{story.jiraIssueKey}
                                    </span>
                                  )}
                                </div>

                                {/* Tasks */}
                                {storyExpanded && storyTasks.map((task: any) => {
                                  const taskInJira = !!task.jiraIssueKey;
                                  return (
                                    <div key={task.id} className={`flex items-center gap-2 px-3 py-1.5 pl-14 border-b last:border-b-0 hover:bg-muted/20 ${task.isCritical ? "bg-red-50/30 dark:bg-red-950/10" : "bg-white dark:bg-background"}`}>
                                      {canEdit && !section1Closed && (
                                        <div onClick={(e) => { e.stopPropagation(); toggleItemSel(task); }}>
                                          <Checkbox
                                            checked={taskInJira || selectedIds.has(task.id)}
                                            disabled={taskInJira}
                                            className={taskInJira ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
                                          />
                                        </div>
                                      )}
                                      <span className="text-xs font-mono text-muted-foreground">{task.taskCode}</span>
                                      <span className="text-xs flex-1">{task.taskName}</span>
                                      {task.isCritical && <Badge variant="destructive" className="text-[10px] py-0 px-1">RC</Badge>}
                                      {task.expected && <span className="text-xs text-muted-foreground">{parseFloat(task.expected).toFixed(1)}d</span>}
                                      {task.assignee && <span className="text-xs text-muted-foreground">{task.assignee}</span>}
                                      {taskInJira && (
                                        <span className="text-xs text-green-700 font-mono flex items-center gap-1">
                                          <ExternalLink className="h-3 w-3" />{task.jiraIssueKey}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}

                    {/* Milestones */}
                    {milestoneItems.length > 0 && (
                      <div>
                        <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/20 border-t">
                          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Hitos del Gantt</p>
                        </div>
                        {milestoneItems.map((ms: any) => (
                          <div key={ms.id} className="flex items-center gap-2 px-3 py-1.5 pl-6 border-t bg-amber-50/40 dark:bg-amber-950/10">
                            {canEdit && !section1Closed && (
                              <div onClick={(e) => { e.stopPropagation(); toggleItemSel(ms); }}>
                                <Checkbox
                                  checked={!!ms.jiraIssueKey || selectedIds.has(ms.id)}
                                  disabled={!!ms.jiraIssueKey}
                                  className={ms.jiraIssueKey ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
                                />
                              </div>
                            )}
                            <span className="text-orange-500">&#9670;</span>
                            <span className="text-xs font-mono text-muted-foreground">{ms.taskCode}</span>
                            <span className="text-xs font-medium text-orange-800 dark:text-orange-300 flex-1">{ms.taskName}</span>
                            {ms.jiraIssueKey && (
                              <span className="text-xs text-green-700 font-mono flex items-center gap-1">
                                <ExternalLink className="h-3 w-3" />{ms.jiraIssueKey}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* Step 4: Close Section 1 */}
          {section1HasContent && (
            <Card className={section1Closed ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50/30 dark:bg-emerald-950/10" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <StepBadge n={4} done={section1Closed} />
                  Cerrar Sección de Planificación
                  {section1Closed && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Progress Panel */}
                {(closingSection1 || section1Result) && (
                  <div className="mb-4">
                    <BacklogProgressPanel
                      isLoading={closingSection1}
                      result={section1Result}
                      estimatedItems={selectedIds.size}
                    />
                  </div>
                )}

                {/* Form */}
                {!section1Closed && !closingSection1 && (
                  <div className="space-y-4">
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-md border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-400">
                      <strong>Atención:</strong> Al cerrar, los {selectedIds.size} items seleccionados se crearán en el tablero <strong>"Epic, Story, Task board"</strong> de JIRA en estado <em>"Por hacer"</em>.
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="s1-notes" className="text-xs">Observaciones (opcional)</Label>
                      <Textarea id="s1-notes" placeholder="Observaciones sobre el backlog acordado..." value={section1Notes} onChange={(e) => setSection1Notes(e.target.value)} rows={2} className="text-sm" />
                    </div>
                    <div className="flex items-start gap-2">
                      <Checkbox id="s1-confirm" checked={section1Confirmed} onCheckedChange={(v) => setSection1Confirmed(!!v)} />
                      <Label htmlFor="s1-confirm" className="text-sm leading-relaxed cursor-pointer">
                        Confirmo que el backlog ágil ({selectedIds.size} items) representa la planificación acordada con el cliente y está listo para JIRA.
                      </Label>
                    </div>
                    <Button
                      onClick={handleCloseSection1}
                      disabled={!section1Confirmed || selectedIds.size === 0 || closingSection1 || !canEdit}
                      className="gap-2 bg-[#e91e8c] hover:bg-[#c2185b] text-white"
                    >
                      <ClipboardCheck className="h-4 w-4" />
                      Cerrar y Cargar {selectedIds.size} Items en JIRA
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 2: HITOS DE PAGO                                                 */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeSection === "billing" && (
        <div className="space-y-5">

          {/* Step 1: Generate Milestones */}
          {generatingMilestones ? (
            <Card className="border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-10 w-10 rounded-xl bg-emerald-600 flex items-center justify-center animate-pulse">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-emerald-900 dark:text-emerald-100">Generación Agéntica de Hitos de Pago</p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">Analizando Gantt, SoW y propuesta económica...</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-2xl font-mono font-bold text-emerald-700 dark:text-emerald-300">{milestoneGenElapsed}s</p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400">Tiempo transcurrido</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Leyendo hitos del Gantt cargado", icon: "📅" },
                    { label: "Analizando propuesta económica del SoW", icon: "💰" },
                    { label: "Cruzando entregables con esquema de facturación", icon: "🔗" },
                    { label: "Calculando montos y fechas de pago", icon: "📊" },
                    { label: "Generando propuesta de hitos de pago", icon: "✅" },
                  ].map((step, i) => (
                    <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg transition-all duration-500 ${
                      i < milestoneGenStep ? "bg-emerald-100/80 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" :
                      i === milestoneGenStep ? "bg-white dark:bg-emerald-900/40 shadow-sm border border-emerald-200 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100" :
                      "text-emerald-400 dark:text-emerald-600"
                    }`}>
                      <span className="text-base w-6 text-center">
                        {i < milestoneGenStep ? "✓" : step.icon}
                      </span>
                      <span className={`text-sm ${i === milestoneGenStep ? "font-semibold" : ""}`}>{step.label}</span>
                      {i === milestoneGenStep && <Loader2 className="h-3.5 w-3.5 animate-spin ml-auto text-emerald-600" />}
                    </div>
                  ))}
                </div>
                <div className="mt-4 bg-emerald-200/50 dark:bg-emerald-800/30 rounded-full h-2 overflow-hidden">
                  <div className="bg-emerald-600 h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.min((milestoneGenStep / 5) * 100 + (milestoneGenElapsed % 5) * 3, 95)}%` }} />
                </div>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-2 text-center">Este proceso puede tomar entre 15 y 35 segundos. No cierres esta página.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <StepBadge n={1} done={section2HasContent} />
                  Propuesta Agéntica de Hitos de Pago
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  El agente analizará la propuesta técnico-económica (SoW) y el Gantt cargado para proponer los hitos de pago del proyecto.
                  Prioridad de fuentes: <strong>Gantt</strong> → <strong>SoW</strong> → <strong>Propuesta Económica</strong>.
                </p>

                {/* Generation result summary */}
                {milestoneGenResult && (
                  <div className={`p-4 rounded-lg border ${
                    milestoneGenResult.success
                      ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                      : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                  }`}>
                    {milestoneGenResult.success ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Hitos generados exitosamente</p>
                          {milestoneGenResult.elapsedMs && (
                            <span className="ml-auto text-xs text-emerald-600 font-mono">{(milestoneGenResult.elapsedMs / 1000).toFixed(1)}s</span>
                          )}
                        </div>
                        <div className="flex gap-3 flex-wrap">
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
                            {milestoneGenResult.count} hitos de pago
                          </Badge>
                          {milestoneGenResult.totalAmount && (
                            <Badge variant="outline" className="gap-1 font-mono">
                              {milestoneGenResult.currency || "CLP"} {Number(milestoneGenResult.totalAmount).toLocaleString("es-CL")}
                            </Badge>
                          )}
                          {milestoneGenResult.sources && (
                            <Badge variant="outline" className="gap-1 text-xs">
                              Fuentes: {milestoneGenResult.sources.ganttHitos > 0 ? `Gantt (${milestoneGenResult.sources.ganttHitos})` : ""}
                              {milestoneGenResult.sources.ganttHitos > 0 && (milestoneGenResult.sources.sowBilling > 0 || milestoneGenResult.sources.sowMilestones > 0) ? " + " : ""}
                              {milestoneGenResult.sources.sowBilling > 0 ? `SoW (${milestoneGenResult.sources.sowBilling})` : ""}
                              {milestoneGenResult.sources.sowMilestones > 0 ? ` Propuesta (${milestoneGenResult.sources.sowMilestones})` : ""}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                        <p className="text-sm font-semibold text-red-800 dark:text-red-300">Error en la generación</p>
                        <p className="text-xs text-red-600 ml-2">{milestoneGenResult.error}</p>
                      </div>
                    )}
                  </div>
                )}

                {canEdit && !section2Closed && (
                  <Button
                    onClick={handleGenerateMilestones}
                    disabled={generatingMilestones}
                    className="gap-2 bg-[#e91e8c] hover:bg-[#c2185b] text-white"
                  >
                    <Sparkles className="h-4 w-4" />
                    {section2HasContent ? "Regenerar Hitos de Pago" : "Generar Hitos de Pago Agénticamente"}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 2: Milestones Table */}
          {section2HasContent && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <StepBadge n={2} done={section2HasContent} />
                  Hitos de Pago
                  <Badge variant="outline" className="ml-auto font-mono text-xs">
                    Total: {billingTotalLabel}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {billingItems.map((ms: any, idx: number) => (
                  <div key={ms.id} className={`border rounded-lg p-4 space-y-3 ${ms.jiraIssueKey ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/20 dark:bg-emerald-950/10" : ""}`}>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#e91e8c]/10 text-[#e91e8c] text-xs font-bold flex-shrink-0">
                        {ms.milestoneNumber}
                      </span>
                      <div className="flex-1 min-w-0">
                        {section2Closed || !canEdit ? (
                          <p className="text-sm font-medium">{ms.description}</p>
                        ) : (
                          <Input value={ms.description} onChange={(e) => updateMilestone(idx, "description", e.target.value)} className="h-8 text-sm" placeholder="Descripción del hito..." />
                        )}
                      </div>
                      {ms.jiraIssueKey && (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" />{ms.jiraIssueKey}
                        </Badge>
                      )}
                      {canEdit && !section2Closed && (
                        <Button variant="ghost" size="sm" onClick={() => removeMilestone(idx)} className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" />Moneda</Label>
                        {section2Closed || !canEdit ? (
                          <p className="text-sm">{ms.currency}</p>
                        ) : (
                          <select value={ms.currency || "USD"} onChange={(e) => updateMilestone(idx, "currency", e.target.value)} className="w-full h-8 text-sm border border-input rounded-md px-2 bg-background">
                            <option value="USD">USD</option>
                            <option value="CLP">CLP</option>
                            <option value="EUR">EUR</option>
                            <option value="UF">UF</option>
                          </select>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Monto</Label>
                        {section2Closed || !canEdit ? (
                          <p className="text-sm font-mono">{ms.amount ? parseFloat(ms.amount).toLocaleString("es-CL") : "-"}</p>
                        ) : (
                          <Input value={ms.amount || ""} onChange={(e) => updateMilestone(idx, "amount", e.target.value)} className="h-8 text-sm font-mono" placeholder="0" type="number" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">% del Total</Label>
                        {section2Closed || !canEdit ? (
                          <p className="text-sm">{ms.percentage ? `${ms.percentage}%` : "-"}</p>
                        ) : (
                          <Input value={ms.percentage || ""} onChange={(e) => updateMilestone(idx, "percentage", e.target.value)} className="h-8 text-sm" placeholder="30" type="number" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />Fecha Objetivo
                          </Label>
                          {(ms as any).dateSource && (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-none ${
                              (ms as any).dateSource === "gantt" ? "bg-blue-100 text-blue-700" :
                              (ms as any).dateSource === "sow" ? "bg-violet-100 text-violet-700" :
                              (ms as any).dateSource === "ai" ? "bg-amber-100 text-amber-700" :
                              "bg-gray-100 text-gray-600"
                            }`}>
                              {(ms as any).dateSource === "gantt" ? "📊 Gantt" :
                               (ms as any).dateSource === "sow" ? "📄 SoW" :
                               (ms as any).dateSource === "ai" ? "🤖 IA" : "✏️ Manual"}
                            </span>
                          )}
                        </div>
                        {section2Closed || !canEdit ? (
                          <p className="text-sm">{(() => { const raw = ms.dueDate; if (!raw) return "-"; if (raw instanceof Date) { return isNaN(raw.getTime()) ? "-" : raw.toISOString().split("T")[0]; } const s = String(raw); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; try { const d = new Date(s); return isNaN(d.getTime()) ? "-" : d.toISOString().split("T")[0]; } catch { return "-"; } })()}</p>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <Input value={(() => { const raw = ms.dueDate; if (!raw) return ""; if (raw instanceof Date) { return isNaN(raw.getTime()) ? "" : raw.toISOString().split("T")[0]; } const s = String(raw); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; try { const d = new Date(s); return isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0]; } catch { return ""; } })()} onChange={(e) => { updateMilestone(idx, "dueDate", e.target.value); }} className="h-8 text-sm" type="date" />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" />Responsable *</Label>
                        {section2Closed || !canEdit ? (
                          <p className="text-sm">{ms.responsableName || "-"}</p>
                        ) : (
                          <Input
                            value={ms.responsableName || ""}
                            onChange={(e) => updateMilestone(idx, "responsableName", e.target.value)}
                            className={`h-8 text-sm ${!ms.responsableName?.trim() ? "border-red-400 focus-visible:ring-red-400 bg-red-50 dark:bg-red-950/10" : "border-emerald-300"}`}
                            placeholder="Nombre del responsable"
                          />
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />Email Responsable *</Label>
                        {section2Closed || !canEdit ? (
                          <p className="text-sm">{ms.responsableEmail || "-"}</p>
                        ) : (
                          <Input
                            value={ms.responsableEmail || ""}
                            onChange={(e) => updateMilestone(idx, "responsableEmail", e.target.value)}
                            className={`h-8 text-sm ${!ms.responsableEmail?.trim() ? "border-red-400 focus-visible:ring-red-400 bg-red-50 dark:bg-red-950/10" : ms.responsableEmail?.trim() && !emailRegex.test(ms.responsableEmail.trim()) ? "border-amber-400 focus-visible:ring-amber-400 bg-amber-50 dark:bg-amber-950/10" : "border-emerald-300"}`}
                            placeholder="email@empresa.com"
                            type="email"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Total */}
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md border">
                  <span className="text-sm font-medium">Total del Proyecto</span>
                  <div className="text-right">
                    <span className="text-lg font-bold font-mono">{billingTotalLabel}</span>
                    {currencyEntries.length > 1 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {currencyEntries.map(([code, amount]) => `${code} ${amount.toLocaleString("es-CL")}`).join(" · ")}
                      </p>
                    )}
                  </div>
                </div>

                {canEdit && !section2Closed && (
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={addMilestone} className="gap-2 text-sm">
                      <Plus className="h-4 w-4" />Agregar Hito
                    </Button>
                    <Button variant="outline" onClick={saveMilestones} disabled={saveBillingMut.isPending} className="gap-2 text-sm">
                      {saveBillingMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      Guardar Cambios
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 3: Close Section 2 */}
          {section2HasContent && (
            <Card className={section2Closed ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50/30 dark:bg-emerald-950/10" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <StepBadge n={3} done={section2Closed} />
                  Cerrar Sección de Hitos de Pago
                  {section2Closed && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Progress Panel */}
                {(closingSection2 || section2Result) && (
                  <div className="mb-4">
                    <MilestoneProgressPanel
                      isLoading={closingSection2}
                      result={section2Result}
                      estimatedItems={billingItems.length}
                    />
                  </div>
                )}

                {/* Form */}
                {!section2Closed && !closingSection2 && (
                  <div className="space-y-4">
                    {/* Validation banner */}
                    {!canCloseSection2 && billingItems.length > 0 && (
                      <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-md border border-red-300 dark:border-red-800 text-sm text-red-800 dark:text-red-400 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <strong>Campos obligatorios incompletos:</strong>
                          {incompleteMilestones.length > 0 && (
                            <span className="block mt-1">
                              {incompleteMilestones.length} hito(s) sin responsable o email: {incompleteMilestones.map((m: any) => {
                                const missing: string[] = [];
                                if (!m.responsableName?.trim()) missing.push("responsable");
                                if (!m.responsableEmail?.trim()) missing.push("email");
                                return `Hito ${m.milestoneNumber} (falta ${missing.join(" y ")})`;
                              }).join(", ")}
                            </span>
                          )}
                          {invalidEmailMilestones.length > 0 && (
                            <span className="block mt-1">
                              {invalidEmailMilestones.length} hito(s) con email inválido: {invalidEmailMilestones.map((m: any) => `Hito ${m.milestoneNumber} (${m.responsableEmail})`).join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {canCloseSection2 && (
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-md border border-emerald-300 dark:border-emerald-800 text-sm text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                        <span>Todos los hitos tienen responsable y email completos. Listo para cerrar.</span>
                      </div>
                    )}
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-md border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-400">
                      <strong>Atención:</strong> Al cerrar, los {billingItems.length} hitos se crearán en el tablero <strong>"Hito PMO board"</strong> de JIRA en estado <em>"Pendiente"</em>.
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="s2-notes" className="text-xs">Observaciones (opcional)</Label>
                      <Textarea id="s2-notes" placeholder="Observaciones sobre los hitos acordados..." value={section2Notes} onChange={(e) => setSection2Notes(e.target.value)} rows={2} className="text-sm" />
                    </div>
                    <div className="flex items-start gap-2">
                      <Checkbox id="s2-confirm" checked={section2Confirmed} onCheckedChange={(v) => setSection2Confirmed(!!v)} />
                      <Label htmlFor="s2-confirm" className="text-sm leading-relaxed cursor-pointer">
                        Confirmo que los hitos de pago representan el esquema de facturación acordado con el cliente y están listos para JIRA.
                      </Label>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleCloseSection2}
                        disabled={!section2Confirmed || closingSection2 || !canEdit || !canCloseSection2}
                        className="gap-2 bg-[#e91e8c] hover:bg-[#c2185b] text-white"
                        title={!canCloseSection2 ? `Completa responsable y email en ${incompleteMilestones.length} hito(s) antes de cerrar` : undefined}
                      >
                        <ClipboardCheck className="h-4 w-4" />
                        {!canCloseSection2 ? `Completa ${incompleteMilestones.length} hito(s) para cerrar` : "Cerrar y Registrar Hitos en JIRA"}
                      </Button>
                      {billingItems.some((m: any) => !m.jiraIssueKey) && billingItems.length > 0 && (
                        <Button
                          variant="outline"
                          onClick={async () => {
                            setClosingSection2(true);
                            try {
                              const result = await retrySection2Mut.mutateAsync({ projectId });
                              setSection2Result(result);
                              if (result.created > 0) {
                                setSection2Closed(true);
                                refetchBilling();
                              }
                              // Rich toast for retry results
                              if (result.errors === 0) {
                                toast.success(`${result.created} hitos creados exitosamente en JIRA`, {
                                  description: `Proyecto: ${result.projectKey} · ${result.jiraKeys?.join(", ") || ""} · ${(result.elapsedMs / 1000).toFixed(1)}s`,
                                  duration: 8000,
                                  action: result.projectKey ? {
                                    label: "Ver en JIRA",
                                    onClick: () => window.open(`https://prodigio-tech.atlassian.net/jira/core/projects/${result.projectKey}/board`, "_blank"),
                                  } : undefined,
                                });
                              } else if (result.created > 0) {
                                toast.warning(`${result.created} hitos creados, ${result.errors} con error`, {
                                  description: `Proyecto: ${result.projectKey} · Intenta de nuevo para los pendientes`,
                                  duration: 10000,
                                });
                              } else {
                                toast.error(`No se pudieron crear los hitos (${result.errors} errores)`, {
                                  description: `Proyecto: ${result.projectKey} · Verifica la conexión JIRA`,
                                  duration: 10000,
                                });
                              }
                            } catch (e: any) {
                              toast.error(e.message);
                            } finally {
                              setClosingSection2(false);
                            }
                          }}
                          disabled={closingSection2 || !canEdit}
                          className="gap-2"
                        >
                          <RefreshCw className="h-4 w-4" />
                          Reintentar Hitos Pendientes
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Stage Closure Panel — only after both sections are closed */}
          {section1Closed && section2Closed && !isStageClosed && (
            <StageClosurePanel projectId={projectId} stageId="planning" stageName="Planificación" stageStatus="open" />
          )}
          {isStageClosed && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
              <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                <Lock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Etapa de Planificación cerrada formalmente</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-500">Ambas secciones completadas e integradas con JIRA.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </StageLayout>
  );
}

// ─── Helper: Step Badge ───────────────────────────────────────────────────────
function StepBadge({ n, done }: { n: number; done?: boolean }) {
  if (done) {
    return (
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex-shrink-0">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
      </span>
    );
  }
  return (
    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#e91e8c] text-white text-xs font-bold flex-shrink-0">
      {n}
    </span>
  );
}
