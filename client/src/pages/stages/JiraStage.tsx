import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import StageClosurePanel from "@/components/StageClosurePanel";
import AppBreadcrumb from "@/components/AppBreadcrumb";
import StageLayout from "@/components/StageLayout";
import StageTimeIndicator from "@/components/StageTimeIndicator";
import { JiraSetupProgressPanel } from "@/components/JiraProgressPanel";
import {
  ExternalLink, Plus, RefreshCw, CheckCircle2, AlertCircle, Clock,
  Layers, GitBranch, Workflow, ArrowRight, ArrowLeft, Rocket, Building2,
  LayoutGrid, Tag, ListChecks, ChevronDown, ChevronUp, Filter,
  FolderKanban, CircleDot, Loader2, CheckCircle, Unlink, Link2, ListTodo, BarChart3, Settings,
  ShieldCheck, AlertTriangle, FileCheck, Lock, Info, Image, XCircle, Search
} from "lucide-react";

// ==================== STEP INDICATOR ====================
function StepIndicator({ step, total }: { step: number; total: number }) {
  const steps = ["Nombre del Space", "Plantilla", "Confirmación", "Resumen"];
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.slice(0, total).map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${
            i + 1 < step ? "bg-green-600 text-white" :
            i + 1 === step ? "bg-purple-600 text-white" :
            "bg-muted text-muted-foreground"
          }`}>
            {i + 1 < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
          </div>
          <span className={`text-xs hidden sm:block ${i + 1 === step ? "text-foreground font-medium" : "text-muted-foreground"}`}>{label}</span>
          {i < total - 1 && <div className={`h-px w-8 ${i + 1 < step ? "bg-green-600" : "bg-border"}`} />}
        </div>
      ))}
    </div>
  );
}

// ==================== STATUS BADGE ====================
function StatusBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    "To Do": "bg-slate-100 text-slate-700 border-slate-200",
    "In Progress": "bg-blue-100 text-blue-700 border-blue-200",
    "Done": "bg-green-100 text-green-700 border-green-200",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${colors[category] ?? "bg-muted text-muted-foreground border-border"}`}>
      {category}
    </span>
  );
}

// ==================== CDN IMAGES ====================
const JIRA_BOARD_MENU_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663043443217/bXMkzYF2PmF6AbhicJnZQ6/jira-board-menu_d9ce752c.webp";
const JIRA_SAVE_BOARDS_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663043443217/bXMkzYF2PmF6AbhicJnZQ6/jira-save-boards_315c9d98.png";

// ==================== BOARD VALIDATION & CLOSURE ====================
interface BoardValidationResult {
  key: string;
  label: string;
  found: boolean;
  boardName: string | null;
  boardId: number | null;
  boardType: string | null;
}

function JiraBoardValidationAndClosure({
  projectId,
  projectKey,
  jiraProjectUrl,
  stageStatus,
  onClosed,
}: {
  projectId: number;
  projectKey: string;
  jiraProjectUrl: string | null;
  stageStatus: string;
  onClosed?: () => void;
}) {
  const { user } = useAuth();
  const canManage = user && ["admin", "pmo"].includes((user as any)?.role ?? "");
  const [boardResults, setBoardResults] = useState<BoardValidationResult[] | null>(null);
  const [allBoardsValid, setAllBoardsValid] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showImages, setShowImages] = useState(true);

  const validateBoardsMut = trpc.jira.validateBoards.useMutation({
    onSuccess: (data) => {
      setBoardResults(data.boards);
      setAllBoardsValid(data.allValid);
      setValidationError(null);
      if (data.allValid) {
        toast.success(`${data.totalFound}/${data.totalRequired} tableros validados correctamente`);
      } else {
        toast.warning(`${data.totalFound}/${data.totalRequired} tableros encontrados. Faltan ${data.totalRequired - data.totalFound} tableros.`);
      }
    },
    onError: (err) => {
      setValidationError(err.message);
      toast.error("Error al validar tableros: " + err.message);
    },
  });

  // Board URL builder
  const jiraBaseUrl = jiraProjectUrl?.replace(/\/jira\/software\/projects\/.*/, "") ?? "";
  const boardUrl = jiraProjectUrl ? `${jiraProjectUrl}/board` : "";

  return (
    <div className="space-y-4">
      {/* ── Section 1: Instructions for PM ── */}
      <Card className="border-blue-200 bg-blue-50/30 dark:bg-blue-950/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-blue-700 dark:text-blue-400">
            <Info className="h-4 w-4" /> Instrucciones para el Gerente de Proyecto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-foreground leading-relaxed">
            Antes de cerrar esta etapa, es necesario <strong>activar las vistas de tablero (Board Views)</strong> en el proyecto JIRA.
            Esta acción debe realizarse manualmente desde la interfaz de JIRA ya que no existe una API pública para automatizarla.
          </p>

          {/* Link to JIRA project */}
          {jiraProjectUrl && (
            <a
              href={boardUrl || jiraProjectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir Proyecto en JIRA
            </a>
          )}

          {/* Steps */}
          <div className="bg-white dark:bg-background/60 border rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pasos a seguir:</p>
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-bold shrink-0 mt-0.5">1</div>
                <p className="text-sm">Ingrese al proyecto en JIRA y haga clic en la pestaña <strong>"Board"</strong>.</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-bold shrink-0 mt-0.5">2</div>
                <p className="text-sm">Haga clic en el botón <strong>"..."</strong> (tres puntos) en la esquina superior derecha del tablero.</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-bold shrink-0 mt-0.5">3</div>
                <p className="text-sm">Seleccione <strong>"Restore workflow views"</strong> (marcado como TEMPORARY).</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-bold shrink-0 mt-0.5">4</div>
                <p className="text-sm">En el diálogo que aparece, <strong>seleccione todos los workflows</strong> (5 tableros) y haga clic en <strong>"Save as boards"</strong>.</p>
              </div>
            </div>
          </div>

          {/* Toggle images */}
          <button
            onClick={() => setShowImages(!showImages)}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
          >
            <Image className="h-3.5 w-3.5" />
            {showImages ? "Ocultar imágenes de referencia" : "Ver imágenes de referencia"}
            {showImages ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          {/* Reference images */}
          {showImages && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Paso 2-3: Menú del Board → Restore workflow views</p>
                <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                  <img
                    src={JIRA_BOARD_MENU_IMG}
                    alt="Menú del Board en JIRA mostrando la opción Restore workflow views"
                    className="w-full h-auto"
                    loading="lazy"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Paso 4: Seleccionar workflows y guardar como boards</p>
                <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                  <img
                    src={JIRA_SAVE_BOARDS_IMG}
                    alt="Diálogo para seleccionar workflows y guardar como boards"
                    className="w-full h-auto"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 2: Board Validation ── */}
      <Card className={`border ${
        allBoardsValid ? "border-emerald-300 bg-emerald-50/30 dark:bg-emerald-950/10" :
        boardResults ? "border-amber-300 bg-amber-50/30 dark:bg-amber-950/10" :
        "border-border"
      }`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Search className="h-4 w-4 text-purple-500" /> Validación de Tableros PPDC
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Se requieren <strong>5 tableros Kanban</strong> configurados en el proyecto JIRA para cumplir con el estándar PPDC corporativo.
            Haga clic en "Validar" para verificar que todos los tableros estén creados.
          </p>

          {/* Board checklist */}
          <div className="space-y-2">
            {[
              { key: "riesgos_pmo", label: "Riesgos PMO board", icon: "🛡️" },
              { key: "epic_story_task", label: "Epic, Story, Task board", icon: "📋" },
              { key: "cambio_alcance", label: "Cambio de Alcance board", icon: "🔄" },
              { key: "proyecto_avance", label: "Proyecto PMO - Avance board", icon: "📊" },
              { key: "hito_pmo", label: "Hito PMO board", icon: "🎯" },
            ].map((board) => {
              const result = boardResults?.find(r => r.key === board.key);
              return (
                <div
                  key={board.key}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    !result ? "bg-muted/30 border-border" :
                    result.found ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800" :
                    "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base">{board.icon}</span>
                    <div>
                      <p className="text-sm font-medium">{board.label}</p>
                      {result?.found && result.boardName && (
                        <p className="text-xs text-muted-foreground">JIRA: {result.boardName}</p>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {!result ? (
                      <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
                    ) : result.found ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Validation error */}
          {validationError && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 dark:bg-red-950/20 p-2 rounded-md">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Validation result summary */}
          {boardResults && (
            <div className={`flex items-center gap-2 text-xs p-2 rounded-md ${
              allBoardsValid
                ? "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                : "bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400"
            }`}>
              {allBoardsValid
                ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              }
              <span>
                {allBoardsValid
                  ? "Todos los tableros PPDC están correctamente configurados en JIRA."
                  : `Faltan ${boardResults.filter(r => !r.found).length} tablero(s). Active las vistas de tablero siguiendo las instrucciones anteriores y vuelva a validar.`
                }
              </span>
            </div>
          )}

          {/* Validate button */}
          <Button
            onClick={() => validateBoardsMut.mutate({ projectKey })}
            disabled={validateBoardsMut.isPending || !projectKey}
            variant={allBoardsValid ? "outline" : "default"}
            className={`w-full gap-2 ${
              allBoardsValid ? "" : "bg-purple-600 hover:bg-purple-700 text-white"
            }`}
            size="sm"
          >
            {validateBoardsMut.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Validando tableros en JIRA...</>
            ) : allBoardsValid ? (
              <><RefreshCw className="h-4 w-4" /> Re-validar Tableros</>
            ) : (
              <><Search className="h-4 w-4" /> Validar Tableros en JIRA</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* ── Section 3: Stage Closure ── */}
      <StageClosurePanel
        projectId={projectId}
        stageId="jira"
        stageName="JIRA"
        stageStatus={stageStatus}
        additionalRequirement={{
          met: allBoardsValid,
          label: "Tableros PPDC",
          description: allBoardsValid
            ? "Los 5 tableros Kanban PPDC han sido validados en JIRA"
            : "Debe validar que los 5 tableros Kanban PPDC estén creados en JIRA antes de cerrar esta etapa",
        }}
        onClosed={onClosed}
      />
    </div>
  );
}

// ==================== MAIN COMPONENT ====================
export default function JiraStage() {
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const role = (user as any)?.role ?? "consulta";
  const canManage = ["admin", "pmo"].includes(role);

  // Project data
  const { data: project, refetch: refetchProject } = trpc.projects.get.useQuery({ id: projectId });
  const { data: stages } = trpc.stages.getAll.useQuery({ projectId });
  const jiraStage = stages?.find((s: any) => s.stageId === "jira");

  // Space data
  const { data: existingSpace, refetch: refetchSpace } = trpc.jira.getSpace.useQuery({ projectId });
  const { data: jiraHealth } = trpc.jira.health.useQuery(undefined, { staleTime: 60000 });

  // ==================== CREATION FLOW STATE ====================
  const [creationStep, setCreationStep] = useState(1);
  const [spaceName, setSpaceName] = useState("");
  const [spaceKey, setSpaceKey] = useState("");
  const [spaceDescription, setSpaceDescription] = useState("");
  const [creationResult, setCreationResult] = useState<any>(null);
  const [expandedWorkflows, setExpandedWorkflows] = useState<string[]>([]);

  // ==================== ISSUES STATE ====================
  const [activeTab, setActiveTab] = useState("structure");
  const [issueFilter, setIssueFilter] = useState("all");
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [pageTokenHistory, setPageTokenHistory] = useState<string[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newIssue, setNewIssue] = useState({ summary: "", description: "", issueTypeName: "Task", assigneeAccountId: "" });

  // Template data (only loaded on step 2)
  const { data: template, isLoading: loadingTemplate } = trpc.jira.getTemplate.useQuery(undefined, {
    enabled: creationStep === 2,
  });

  // Linked key: prefer space record, fallback to project field
  const linkedKey = existingSpace?.jiraProjectKey ?? project?.jiraProjectKey ?? null;
  const linkedUrl = existingSpace?.jiraProjectUrl ?? project?.jiraProjectUrl ?? null;

  const { data: issuesData, isLoading: loadingIssues, refetch: refetchIssues } = trpc.jira.issues.useQuery(
    {
      projectKey: linkedKey ?? "",
      maxResults: 20,
      nextPageToken,
      statusCategory: issueFilter !== "all" ? issueFilter : undefined,
    },
    { enabled: !!linkedKey && activeTab === "issues" }
  );

  const { data: statsData } = trpc.jira.stats.useQuery(
    { projectKey: linkedKey ?? "" },
    { enabled: !!linkedKey && activeTab === "stats" }
  );

  const { data: jiraDetail } = trpc.jira.projectDetail.useQuery(
    { projectKey: linkedKey ?? "" },
    { enabled: !!linkedKey }
  );

  const { data: assignableUsers } = trpc.jira.assignableUsers.useQuery(
    { projectKey: linkedKey ?? "" },
    { enabled: !!linkedKey && showCreateDialog }
  );

  // ==================== AUTO-GENERATE KEY ====================
  useEffect(() => {
    if (spaceName) {
      const generated = spaceName
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, "")
        .split(/\s+/)
        .map(w => w.slice(0, 3))
        .join("")
        .slice(0, 10);
      setSpaceKey(generated || "PMO");
    }
  }, [spaceName]);

  // ==================== MUTATIONS ====================
  const [setupError, setSetupError] = useState<string | null>(null);

  const createSpaceMut = trpc.jira.createSpace.useMutation({
    onSuccess: (data) => {
      setCreationResult(data);
      setSetupError(null);
      setCreationStep(4);
      refetchSpace();
      refetchProject();
    },
    onError: (err) => {
      setSetupError(err.message);
      toast.error(err.message);
    },
  });

  const retryMut = trpc.jira.retryCreateSpace.useMutation({
    onSuccess: (data) => {
      refetchSpace();
      refetchProject();
      if (data.success) toast.success(data.message);
      else toast.error(data.message);
    },
  });

  const unlinkMut = trpc.jira.unlink.useMutation({
    onSuccess: () => { refetchSpace(); refetchProject(); toast.success("Space desvinculado"); },
  });

  const createIssueMut = trpc.jira.createIssue.useMutation({
    onSuccess: (data) => {
      toast.success(`Issue ${data.key} creado`);
      setShowCreateDialog(false);
      setNewIssue({ summary: "", description: "", issueTypeName: "Task", assigneeAccountId: "" });
      refetchIssues();
    },
    onError: (e) => toast.error(e.message),
  });

  // ==================== CREATION FLOW ====================
  const renderCreationFlow = () => {
    if (creationStep === 1) {
      return (
        <div className="space-y-6">
          <StepIndicator step={1} total={4} />
          <div>
            <h3 className="text-lg font-semibold mb-1">Nombre del Space JIRA</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Define el nombre del proyecto que se creará en JIRA con la plantilla estándar de Prodigio Tech.
            </p>
          </div>
          <div className="grid gap-4">
            <div>
              <Label htmlFor="spaceName">Nombre del Space <span className="text-red-500">*</span></Label>
              <Input
                id="spaceName"
                value={spaceName}
                onChange={e => setSpaceName(e.target.value)}
                placeholder="Ej: [PMO Cliente] - Implementación Sistema X"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Formato recomendado: [PMO Cliente] - Descripción del proyecto</p>
            </div>
            <div>
              <Label htmlFor="spaceKey">Key del Space <span className="text-red-500">*</span></Label>
              <Input
                id="spaceKey"
                value={spaceKey}
                onChange={e => setSpaceKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))}
                placeholder="Ej: PMOCLI"
                className="mt-1 font-mono"
                maxLength={10}
              />
              <p className="text-xs text-muted-foreground mt-1">Identificador único en JIRA (letras mayúsculas y números, máx. 10 caracteres)</p>
            </div>
            <div>
              <Label htmlFor="spaceDesc">Descripción (opcional)</Label>
              <Input
                id="spaceDesc"
                value={spaceDescription}
                onChange={e => setSpaceDescription(e.target.value)}
                placeholder="Descripción del proyecto..."
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setCreationStep(2)} disabled={spaceName.length < 3 || spaceKey.length < 2} className="gap-2">
              Ver Plantilla <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      );
    }

    if (creationStep === 2) {
      return (
        <div className="space-y-6">
          <StepIndicator step={2} total={4} />
          <div>
            <h3 className="text-lg font-semibold mb-1">Plantilla del Space</h3>
            <p className="text-sm text-muted-foreground mb-4">
              El Space se creará con la siguiente estructura basada en la plantilla estándar de Prodigio Tech.
            </p>
          </div>
          {loadingTemplate ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <RefreshCw className="w-4 h-4 animate-spin" /> Cargando plantilla...
            </div>
          ) : template ? (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-purple-500" /> Tableros
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {template.boards.map((b, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-muted/40 rounded-lg mb-1.5">
                      <span className="text-sm font-medium">{b.name}</span>
                      <Badge variant="outline" className="text-xs capitalize">{String(b.type)}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Tag className="w-4 h-4 text-blue-500" /> Tipos de Issue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {template.issueTypes.filter(it => !it.subtask).map((it, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{it.name}</Badge>
                    ))}
                    {template.issueTypes.filter(it => it.subtask).map((it, i) => (
                      <Badge key={i} variant="outline" className="text-xs text-muted-foreground">{it.name} (subtarea)</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Workflow className="w-4 h-4 text-green-500" /> Flujos de Trabajo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {template.workflows.map((wf, i) => {
                    const isExp = expandedWorkflows.includes(wf.issueType);
                    return (
                      <div key={i} className="border rounded-lg overflow-hidden">
                        <button
                          className="w-full flex items-center justify-between p-2.5 text-left hover:bg-muted/40 transition-colors"
                          onClick={() => setExpandedWorkflows(prev => isExp ? prev.filter(x => x !== wf.issueType) : [...prev, wf.issueType])}
                        >
                          <span className="text-sm font-medium">{wf.issueType}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{wf.statuses.length} estados</span>
                            {isExp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </div>
                        </button>
                        {isExp && (
                          <div className="px-3 pb-3 pt-1 flex flex-wrap gap-1.5 border-t bg-muted/20">
                            {wf.statuses.map((s, j) => (
                              <div key={j} className="flex items-center gap-1">
                                <StatusBadge category={s.category} />
                                <span className="text-xs text-muted-foreground">{s.name}</span>
                                {j < wf.statuses.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          ) : null}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setCreationStep(1)} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Atrás
            </Button>
            <Button onClick={() => setCreationStep(3)} className="gap-2">
              Confirmar <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      );
    }

    if (creationStep === 3) {
      return (
        <div className="space-y-6">
          <StepIndicator step={3} total={4} />

          {/* Show progress panel when creating */}
          {(createSpaceMut.isPending || setupError) ? (
            <JiraSetupProgressPanel
              isLoading={createSpaceMut.isPending}
              result={null}
              error={setupError}
            />
          ) : (
            <>
              <div>
                <h3 className="text-lg font-semibold mb-1">Confirmar Creación</h3>
                <p className="text-sm text-muted-foreground mb-4">Revisa los datos antes de crear el Space en JIRA.</p>
              </div>
              <Card className="border-purple-200 bg-purple-50/30 dark:bg-purple-950/10">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Nombre del Space</span>
                    <span className="text-sm font-semibold">{spaceName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Key JIRA</span>
                    <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{spaceKey}</code>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Plantilla</span>
                    <span className="text-sm">Prodigio Tech (PBTISD1)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">URL esperada</span>
                    <span className="text-xs text-blue-600 font-mono break-all">apiservice2.atlassian.net/.../projects/{spaceKey}/board</span>
                  </div>
                </CardContent>
              </Card>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-300">
                <strong>Nota:</strong> Si la cuenta no tiene permisos de administrador de sitio JIRA, el Space quedará registrado en la PMO y se creará automáticamente cuando se habiliten los permisos.
              </div>
            </>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => { setCreationStep(2); setSetupError(null); }} disabled={createSpaceMut.isPending} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Atrás
            </Button>
            <Button
              onClick={() => { setSetupError(null); createSpaceMut.mutate({ projectId, spaceName, spaceKey, description: spaceDescription }); }}
              disabled={createSpaceMut.isPending}
              className="gap-2 bg-purple-600 hover:bg-purple-700"
            >
              {createSpaceMut.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
              {setupError ? "Reintentar" : "Crear Space en JIRA"}
            </Button>
          </div>
        </div>
      );
    }

    if (creationStep === 4 && creationResult) {
      const { created, spaceName: sName, spaceKey: sKey, jiraProjectUrl, template: tpl, message } = creationResult;
      return (
        <div className="space-y-6">
          <StepIndicator step={4} total={4} />
          <div className={`flex items-center gap-3 p-4 rounded-xl border ${created ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800" : "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"}`}>
            {created
              ? <CheckCircle2 className="w-8 h-8 text-green-600 shrink-0" />
              : <Clock className="w-8 h-8 text-amber-600 shrink-0" />
            }
            <div>
              <p className={`font-semibold ${created ? "text-green-800 dark:text-green-300" : "text-amber-800 dark:text-amber-300"}`}>
                {created ? "Space creado exitosamente en JIRA" : "Space registrado — pendiente de permisos"}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">{message}</p>
            </div>
          </div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-purple-500" /> Información del Space
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nombre</span>
                <span className="font-medium">{sName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Key</span>
                <code className="font-mono bg-muted px-2 py-0.5 rounded text-xs">{sKey}</code>
              </div>
              {jiraProjectUrl && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">URL del Space</span>
                  <a href={jiraProjectUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline text-xs">
                    Abrir en JIRA <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
          {/* Corporate Configuration Summary */}
          {created && (
            <Card className="border-purple-200 bg-purple-50/30 dark:bg-purple-950/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Settings className="w-4 h-4 text-purple-500" /> Configuración Corporativa PPDC Aplicada
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                <div className="flex justify-between col-span-2">
                  <span className="text-muted-foreground">Categoría</span>
                  <span className="font-medium text-purple-700 dark:text-purple-300">PPDC HIBRIDO</span>
                </div>
                <div className="flex justify-between col-span-2">
                  <span className="text-muted-foreground">Owner</span>
                  <span className="font-medium">Yanahí Takiana Villegas García</span>
                </div>
                <div className="flex justify-between col-span-2">
                  <span className="text-muted-foreground">Issue Type Scheme</span>
                  <span className="font-medium">PPDC: Project Management Issue Type Scheme</span>
                </div>
                <div className="flex justify-between col-span-2">
                  <span className="text-muted-foreground">Workflow Scheme</span>
                  <span className="font-medium">PPDC: Project Management Workflow Scheme</span>
                </div>
                <div className="flex justify-between col-span-2">
                  <span className="text-muted-foreground">Screen Scheme</span>
                  <span className="font-medium">PPDC: Project Management Issue Type Screen Scheme</span>
                </div>
                <div className="flex justify-between col-span-2">
                  <span className="text-muted-foreground">Notification Scheme</span>
                  <span className="font-medium">Default Notification Scheme</span>
                </div>
              </CardContent>
            </Card>
          )}
          {tpl && (
            <div className="grid grid-cols-3 gap-3">
              <Card className="text-center p-4">
                <LayoutGrid className="w-6 h-6 text-purple-500 mx-auto mb-1" />
                <p className="text-2xl font-bold">{tpl.boards.length}</p>
                <p className="text-xs text-muted-foreground">Tablero{tpl.boards.length !== 1 ? "s" : ""}</p>
                <div className="mt-2 space-y-1">
                  {tpl.boards.map((b: any, i: number) => (
                    <p key={i} className="text-xs text-muted-foreground truncate">{b.name}</p>
                  ))}
                </div>
              </Card>
              <Card className="text-center p-4">
                <Tag className="w-6 h-6 text-blue-500 mx-auto mb-1" />
                <p className="text-2xl font-bold">{tpl.issueTypes.filter((it: any) => !it.subtask).length}</p>
                <p className="text-xs text-muted-foreground">Tipos de Issue</p>
                <div className="mt-2 space-y-1">
                  {tpl.issueTypes.filter((it: any) => !it.subtask).map((it: any, i: number) => (
                    <p key={i} className="text-xs text-muted-foreground">{it.name}</p>
                  ))}
                </div>
              </Card>
              <Card className="text-center p-4">
                <Workflow className="w-6 h-6 text-green-500 mx-auto mb-1" />
                <p className="text-2xl font-bold">{tpl.workflows.length}</p>
                <p className="text-xs text-muted-foreground">Flujos</p>
                <div className="mt-2 space-y-1">
                  {tpl.workflows.slice(0, 3).map((wf: any, i: number) => (
                    <p key={i} className="text-xs text-muted-foreground truncate">{wf.issueType}</p>
                  ))}
                  {tpl.workflows.length > 3 && <p className="text-xs text-muted-foreground">+{tpl.workflows.length - 3} más</p>}
                </div>
              </Card>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  // ==================== LINKED VIEW ====================
  const renderLinkedView = () => {
    const space = existingSpace;
    return (
      <div className="space-y-4">
        {/* Space header */}
        <Card className={`border-2 ${space?.status === "created" ? "border-green-200 bg-green-50/30 dark:bg-green-950/10" : "border-amber-200 bg-amber-50/30 dark:bg-amber-950/10"}`}>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${space?.status === "created" ? "bg-green-100 dark:bg-green-900" : "bg-amber-100 dark:bg-amber-900"}`}>
                  {space?.status === "created"
                    ? <CheckCircle2 className="w-5 h-5 text-green-600" />
                    : <Clock className="w-5 h-5 text-amber-600" />
                  }
                </div>
                <div>
                  <p className="font-semibold text-sm">{space?.spaceName ?? linkedKey}</p>
                  {jiraDetail && <p className="text-xs text-muted-foreground">{jiraDetail.name}</p>}
                  <p className="text-xs text-muted-foreground">
                    {space?.status === "created" ? "Activo en JIRA" : space ? "Pendiente de permisos" : "Vinculado"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {linkedUrl && (
                  <a href={linkedUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="gap-1 text-xs">
                      <ExternalLink className="w-3 h-3" /> Abrir JIRA
                    </Button>
                  </a>
                )}
                {space?.status === "pending_permissions" && canManage && (
                  <Button size="sm" variant="outline" onClick={() => retryMut.mutate({ spaceId: space.id })} disabled={retryMut.isPending} className="gap-1 text-xs">
                    <RefreshCw className={`w-3 h-3 ${retryMut.isPending ? "animate-spin" : ""}`} /> Reintentar
                  </Button>
                )}
                {canManage && (
                  <Button size="sm" variant="ghost" onClick={() => unlinkMut.mutate({ projectId })} className="text-xs text-red-600 hover:text-red-700">
                    Desvincular
                  </Button>
                )}
              </div>
            </div>
            {/* Space meta */}
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {space?.jiraProjectKey && (
                <div className="bg-background/60 rounded p-2">
                  <p className="text-muted-foreground">Key</p>
                  <code className="font-mono font-bold">{space.jiraProjectKey}</code>
                </div>
              )}
              {space?.createdByName && (
                <div className="bg-background/60 rounded p-2">
                  <p className="text-muted-foreground">Creado por</p>
                  <p className="font-medium">{space.createdByName}</p>
                </div>
              )}
              {space?.createdAt && (
                <div className="bg-background/60 rounded p-2">
                  <p className="text-muted-foreground">Fecha</p>
                  <p className="font-medium">{new Date(space.createdAt).toLocaleDateString()}</p>
                </div>
              )}
              {space?.templateKey && (
                <div className="bg-background/60 rounded p-2">
                  <p className="text-muted-foreground">Plantilla</p>
                  <p className="font-medium">{space.templateKey}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="structure">Estructura</TabsTrigger>
            <TabsTrigger value="issues" disabled={!linkedKey}>Issues</TabsTrigger>
            <TabsTrigger value="stats" disabled={!linkedKey}>Estadísticas</TabsTrigger>
            <TabsTrigger value="close">Cierre</TabsTrigger>
          </TabsList>

          {/* Estructura */}
          <TabsContent value="structure" className="space-y-3 mt-3">
            {Array.isArray(space?.boards) && (space.boards as any[]).length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-purple-500" /> Tableros
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(space.boards as any[]).map((b, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-muted/40 rounded mb-1">
                      <span className="text-sm">{b.name}</span>
                      <Badge variant="outline" className="text-xs capitalize">{String(b.type)}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
            {Array.isArray(space?.issueTypes) && (space.issueTypes as any[]).length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Tag className="w-4 h-4 text-blue-500" /> Tipos de Issue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {(space.issueTypes as any[]).filter(it => !it.subtask).map((it, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{String(it.name)}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {Array.isArray(space?.workflows) && (space.workflows as any[]).length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Workflow className="w-4 h-4 text-green-500" /> Flujos de Trabajo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(space.workflows as any[]).map((wf, i) => {
                    const isExp = expandedWorkflows.includes(wf.issueType);
                    return (
                      <div key={i} className="border rounded-lg overflow-hidden">
                        <button
                          className="w-full flex items-center justify-between p-2.5 text-left hover:bg-muted/40 transition-colors"
                          onClick={() => setExpandedWorkflows(prev => isExp ? prev.filter(x => x !== wf.issueType) : [...prev, wf.issueType])}
                        >
                          <span className="text-sm font-medium">{wf.issueType}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{wf.statuses.length} estados</span>
                            {isExp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </div>
                        </button>
                        {isExp && (
                          <div className="px-3 pb-3 pt-1 flex flex-wrap gap-1.5 border-t bg-muted/20">
                            {wf.statuses.map((s: any, j: number) => (
                              <div key={j} className="flex items-center gap-1">
                                <StatusBadge category={s.category} />
                                <span className="text-xs text-muted-foreground">{s.name}</span>
                                {j < wf.statuses.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
            {!space?.boards && !space?.issueTypes && (
              <div className="py-8 text-center text-muted-foreground text-sm">
                <AlertCircle className="w-6 h-6 mx-auto mb-2" />
                No hay información de estructura disponible para este Space.
              </div>
            )}
          </TabsContent>

          {/* Issues */}
          <TabsContent value="issues" className="mt-3">
            <div className="flex items-center justify-between mb-3">
              <Select value={issueFilter} onValueChange={(v) => { setIssueFilter(v); setNextPageToken(undefined); setPageTokenHistory([]); }}>
                <SelectTrigger className="w-44 h-8 text-xs">
                  <Filter className="w-3 h-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los issues</SelectItem>
                  <SelectItem value="To Do">Por Hacer</SelectItem>
                  <SelectItem value="In Progress">En Curso</SelectItem>
                  <SelectItem value="Done">Finalizados</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                {canManage && (
                  <Button size="sm" variant="outline" onClick={() => setShowCreateDialog(true)} className="h-8 text-xs gap-1">
                    <Plus className="w-3 h-3" /> Crear Issue
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => refetchIssues()} className="h-8 text-xs gap-1">
                  <RefreshCw className="w-3 h-3" /> Actualizar
                </Button>
              </div>
            </div>
            {loadingIssues ? (
              <div className="py-8 text-center text-muted-foreground text-sm">Cargando issues...</div>
            ) : (
              <div className="space-y-1.5">
                {issuesData?.issues.map((issue) => (
                  <div key={issue.id} className="flex items-center justify-between p-2.5 border rounded-lg hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <code className="text-xs text-muted-foreground shrink-0">{issue.key}</code>
                      <span className="text-sm truncate">{issue.summary}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <Badge variant="outline" className="text-xs hidden sm:flex">{issue.issueType}</Badge>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        issue.statusCategory === "done" ? "bg-green-100 text-green-700" :
                        issue.statusCategory === "indeterminate" ? "bg-blue-100 text-blue-700" :
                        "bg-slate-100 text-slate-700"
                      }`}>{issue.status}</span>
                    </div>
                  </div>
                ))}
                {(!issuesData?.issues || issuesData.issues.length === 0) && (
                  <div className="py-8 text-center text-muted-foreground text-sm">No hay issues en esta categoría</div>
                )}
              </div>
            )}
            <div className="flex justify-between mt-3">
              <Button size="sm" variant="outline" disabled={pageTokenHistory.length === 0}
                onClick={() => {
                  const prev = [...pageTokenHistory];
                  const token = prev.pop();
                  setPageTokenHistory(prev);
                  setNextPageToken(token);
                }}
                className="text-xs gap-1"
              >
                <ArrowLeft className="w-3 h-3" /> Anterior
              </Button>
              <Button size="sm" variant="outline" disabled={!issuesData?.nextPageToken || !!issuesData?.isLast}
                onClick={() => {
                  setPageTokenHistory(prev => [...prev, nextPageToken ?? ""]);
                  setNextPageToken(issuesData?.nextPageToken ?? undefined);
                }}
                className="text-xs gap-1"
              >
                Siguiente <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
          </TabsContent>

          {/* Stats */}
          <TabsContent value="stats" className="mt-3">
            {statsData ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Por Hacer", value: statsData.todo, color: "text-slate-600", bg: "bg-slate-50 dark:bg-slate-900" },
                  { label: "En Curso", value: statsData.inProgress, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/20" },
                  { label: "Finalizados", value: statsData.done, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/20" },
                  { label: "Total", value: statsData.total, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/20" },
                ].map((s, i) => (
                  <Card key={i} className={`${s.bg} border-0`}>
                    <CardContent className="pt-4 text-center">
                      <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground text-sm">Cargando estadísticas...</div>
            )}
          </TabsContent>

          {/* Cierre */}
          <TabsContent value="close" className="mt-3">
            <JiraBoardValidationAndClosure
              projectId={projectId}
              projectKey={linkedKey ?? ""}
              jiraProjectUrl={linkedUrl}
              stageStatus={jiraStage?.status ?? "in_progress"}
              onClosed={() => { refetchProject(); }}
            />
          </TabsContent>
        </Tabs>

        {/* Create Issue Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Issue en JIRA</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Resumen <span className="text-red-500">*</span></Label>
                <Input value={newIssue.summary} onChange={e => setNewIssue(p => ({ ...p, summary: e.target.value }))} placeholder="Descripción breve del issue" className="mt-1" />
              </div>
              <div>
                <Label>Tipo de Issue</Label>
                <Select value={newIssue.issueTypeName} onValueChange={v => setNewIssue(p => ({ ...p, issueTypeName: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {jiraDetail?.issueTypes?.filter((it: any) => !it.subtask).map((it: any) => (
                      <SelectItem key={it.id} value={it.name}>{it.name}</SelectItem>
                    )) ?? <SelectItem value="Task">Task</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Descripción</Label>
                <Textarea value={newIssue.description} onChange={e => setNewIssue(p => ({ ...p, description: e.target.value }))} placeholder="Descripción detallada..." className="mt-1" rows={3} />
              </div>
              {assignableUsers && assignableUsers.length > 0 && (
                <div>
                  <Label>Asignar a</Label>
                  <Select value={newIssue.assigneeAccountId} onValueChange={v => setNewIssue(p => ({ ...p, assigneeAccountId: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                    <SelectContent>
                      {assignableUsers.map(u => (
                        <SelectItem key={u.accountId} value={u.accountId}>{u.displayName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
                <Button onClick={() => createIssueMut.mutate({ projectKey: linkedKey!, summary: newIssue.summary, issueTypeName: newIssue.issueTypeName, description: newIssue.description || undefined, assigneeAccountId: newIssue.assigneeAccountId || undefined })} disabled={createIssueMut.isPending || !newIssue.summary.trim()}>
                  {createIssueMut.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : null}
                  Crear Issue
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  };

  // ==================== MAIN ====================
  const hasSpace = !!existingSpace || !!project?.jiraProjectKey;

  return (
    <StageLayout
      projectName={project?.projectName ?? "Proyecto"}
      projectId={projectId}
      stageKey="jira"
      subtitle={project?.projectName}
      icon={<FolderKanban size={22} />}
      headerRight={
        <div className="flex items-center gap-2">
          {jiraHealth?.ok ? (
            <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50/20 gap-1">
              <CircleDot className="h-3 w-3" /> JIRA Conectado
            </Badge>
          ) : (
            <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50/20 gap-1">
              <AlertCircle className="h-3 w-3" /> Sin conexión
            </Badge>
          )}
        </div>
      }
    >

      {/* Time Indicator */}
      <StageTimeIndicator projectId={projectId} stageId="jira" />

      {/* Content */}
      {hasSpace ? renderLinkedView() : (
        canManage ? (
          <Card>
            <CardContent className="pt-6">
              {renderCreationFlow()}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No hay un Space JIRA vinculado a este proyecto.</p>
              <p className="text-xs text-muted-foreground mt-1">Contacta al PMO o Administrador para crear el Space.</p>
            </CardContent>
          </Card>
        )
      )}
    </StageLayout>
  );
}
