import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Building2, ExternalLink, RefreshCw, Search, CheckCircle2, Clock,
  LayoutGrid, Tag, Workflow, ChevronDown, ChevronUp, ArrowRight, FolderKanban,
  AlertCircle, Zap, Link2, Plus, Loader2, Globe, Unlink, Trash2
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { C, headerGradient, cardStyle, headerKpiCard, headerKpiLabel, headerKpiValue, footerStyle, footerText } from "./adminStyles";
import { buildJiraMappingSubmission, resolveJiraWizardStep, type JiraWizardStep } from "./jiraOnboardingWizard";

const PROJECT_TYPES = [
  { value: "apigee", label: "Apigee / API Gateway" },
  { value: "desarrollo", label: "Desarrollo de Software" },
  { value: "integracion", label: "Integración" },
  { value: "data", label: "Data / Analytics" },
  { value: "otro", label: "Otro" },
];

function WorkflowStatusBadge({ category }: { category: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    "To Do": { bg: `${C.g200}`, color: C.g400 },
    "In Progress": { bg: `${C.accent}18`, color: C.accent },
    "Done": { bg: `${C.green}18`, color: C.green },
  };
  const c = colors[category] ?? { bg: C.g200, color: C.g400 };
  return <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: c.bg, color: c.color }}>{category}</span>;
}

function OriginBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string; Icon: any }> = {
    linked: { bg: `rgba(139,92,246,.12)`, color: "#7C3AED", label: "Vinculado", Icon: Link2 },
    created: { bg: `${C.green}18`, color: C.green, label: "Creado en JIRA", Icon: CheckCircle2 },
  };
  const cfg = map[status] ?? { bg: `${C.gold}18`, color: C.gold, label: "Pendiente permisos", Icon: Clock };
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 10, background: cfg.bg, color: cfg.color, display: "inline-flex", alignItems: "center", gap: 4 }}>
      <cfg.Icon className="h-3 w-3" /> {cfg.label}
    </span>
  );
}

// ==================== SPACE CARD ====================
function SpaceCard({ space, onRetried }: { space: any; onRetried: () => void }) {
  const [, setLocation] = useLocation();
  const [expandedWorkflow, setExpandedWorkflow] = useState<string | null>(null);
  const [showStructure, setShowStructure] = useState(false);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);

  const unlinkMutation = trpc.jira.unlinkProject.useMutation({
    onSuccess: (data) => { toast.success(data.message); setShowUnlinkConfirm(false); onRetried(); },
    onError: (err) => toast.error(`Error: ${err.message}`),
  });
  const retryMutation = trpc.jira.retryCreateSpace.useMutation({
    onSuccess: (data) => { data.success ? toast.success(data.message) : toast.error(data.message); onRetried(); },
    onError: (err) => toast.error(`Error: ${err.message}`),
  });

  const boards = Array.isArray(space.boards) ? space.boards : [];
  const issueTypes = Array.isArray(space.issueTypes) ? space.issueTypes : [];
  const workflows = Array.isArray(space.workflows) ? space.workflows : [];
  const isLinked = space.status === "linked";

  const borderColor = isLinked ? "rgba(139,92,246,.3)" : space.status === "created" ? `${C.green}40` : `${C.gold}40`;

  return (
    <>
      <div style={{ ...cardStyle, borderLeft: `4px solid ${borderColor}`, padding: "18px 20px" }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: isLinked ? "rgba(139,92,246,.1)" : space.status === "created" ? `${C.green}12` : `${C.gold}12`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {isLinked ? <Link2 className="h-5 w-5" style={{ color: "#7C3AED" }} /> : space.status === "created" ? <CheckCircle2 className="h-5 w-5" style={{ color: C.green }} /> : <Clock className="h-5 w-5" style={{ color: C.gold }} />}
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>{space.spaceName}</p>
              <p style={{ fontSize: 11, color: C.g400, marginTop: 2 }}>Proyecto PMO: <span style={{ fontWeight: 600, color: C.navy }}>{space.projectName ?? `#${space.projectId}`}</span></p>
            </div>
          </div>
          <OriginBadge status={space.status} />
        </div>

        {/* Meta grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, marginBottom: 14 }}>
          {space.jiraProjectKey && (
            <div style={{ background: C.g100, borderRadius: 8, padding: "8px 10px" }}>
              <p style={{ fontSize: 10, color: C.g400 }}>Key JIRA</p>
              <code style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>{space.jiraProjectKey}</code>
            </div>
          )}
          {space.jiraProjectName && (
            <div style={{ background: C.g100, borderRadius: 8, padding: "8px 10px" }}>
              <p style={{ fontSize: 10, color: C.g400 }}>Nombre en JIRA</p>
              <p style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{space.jiraProjectName}</p>
            </div>
          )}
          {space.templateKey && (
            <div style={{ background: C.g100, borderRadius: 8, padding: "8px 10px" }}>
              <p style={{ fontSize: 10, color: C.g400 }}>Plantilla</p>
              <p style={{ fontSize: 12, fontWeight: 600 }}>{space.templateKey}</p>
            </div>
          )}
          {!space.templateKey && isLinked && (
            <div style={{ background: C.g100, borderRadius: 8, padding: "8px 10px" }}>
              <p style={{ fontSize: 10, color: C.g400 }}>Origen</p>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#7C3AED" }}>Externo</p>
            </div>
          )}
          {space.createdAt && (
            <div style={{ background: C.g100, borderRadius: 8, padding: "8px 10px" }}>
              <p style={{ fontSize: 10, color: C.g400 }}>{isLinked ? "Vinculado" : "Creado"}</p>
              <p style={{ fontSize: 12, fontWeight: 600 }}>{new Date(space.createdAt).toLocaleDateString()}</p>
            </div>
          )}
          {space.createdByName && (
            <div style={{ background: C.g100, borderRadius: 8, padding: "8px 10px" }}>
              <p style={{ fontSize: 10, color: C.g400 }}>{isLinked ? "Vinculado por" : "Creado por"}</p>
              <p style={{ fontSize: 12, fontWeight: 600 }}>{space.createdByName}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {space.jiraProjectUrl && (
            <a href={space.jiraProjectUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              <button style={{ fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 6, border: `1px solid ${C.g200}`, background: "#fff", color: C.navy, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <ExternalLink className="h-3 w-3" /> Abrir en JIRA
              </button>
            </a>
          )}
          {space.status === "pending_permissions" && (
            <button disabled={retryMutation.isPending} onClick={() => retryMutation.mutate({ spaceId: space.id })}
              style={{ fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 6, border: "none", background: C.gold, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              {retryMutation.isPending ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
              {retryMutation.isPending ? "Creando..." : "Crear en JIRA"}
            </button>
          )}
          {isLinked ? (
            <>
              <button onClick={() => setLocation(`/projects/${space.projectId}/design`)}
                style={{ fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(139,92,246,.3)", background: "rgba(139,92,246,.06)", color: "#7C3AED", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <FolderKanban className="h-3 w-3" /> Ver Avance
              </button>
              <button onClick={() => setShowUnlinkConfirm(true)}
                style={{ fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 6, border: `1px solid ${C.red}40`, background: `${C.red}08`, color: C.red, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <Unlink className="h-3 w-3" /> Desvincular
              </button>
            </>
          ) : (
            <button onClick={() => setLocation(`/projects/${space.projectId}/stages/jira`)}
              style={{ fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 6, border: `1px solid ${C.g200}`, background: "#fff", color: C.navy, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <FolderKanban className="h-3 w-3" /> Ver en Proyecto
            </button>
          )}
          {(boards.length > 0 || issueTypes.length > 0 || workflows.length > 0) && (
            <button onClick={() => setShowStructure(!showStructure)} style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 6, border: "none", background: "none", color: C.g400, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              {showStructure ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showStructure ? "Ocultar" : "Ver"} Estructura
            </button>
          )}
        </div>

        {/* Expandable structure */}
        {showStructure && (
          <div style={{ borderTop: `1px solid ${C.g200}`, paddingTop: 14, marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            {boards.length > 0 && (
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: C.g400, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
                  <LayoutGrid className="h-3 w-3" style={{ color: "#7C3AED" }} /> TABLEROS ({boards.length})
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {boards.map((b: any, i: number) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", background: C.g100, borderRadius: 6, fontSize: 12 }}>
                      <span>{String(b.name)}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 6, border: `1px solid ${C.g200}`, textTransform: "capitalize" }}>{String(b.type)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {issueTypes.length > 0 && (
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: C.g400, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
                  <Tag className="h-3 w-3" style={{ color: C.accent }} /> TIPOS DE ISSUE
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {issueTypes.filter((it: any) => !it.subtask).map((it: any, i: number) => (
                    <span key={i} style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 8, background: `${C.accent}12`, color: C.accent }}>{String(it.name)}</span>
                  ))}
                  {issueTypes.filter((it: any) => it.subtask).map((it: any, i: number) => (
                    <span key={i} style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 8, background: C.g100, color: C.g400 }}>{String(it.name)} (sub)</span>
                  ))}
                </div>
              </div>
            )}
            {workflows.length > 0 && (
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: C.g400, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
                  <Workflow className="h-3 w-3" style={{ color: C.green }} /> FLUJOS DE TRABAJO ({workflows.length})
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {workflows.map((wf: any, i: number) => {
                    const isExp = expandedWorkflow === wf.issueType;
                    return (
                      <div key={i} style={{ border: `1px solid ${C.g200}`, borderRadius: 8, overflow: "hidden" }}>
                        <button onClick={() => setExpandedWorkflow(isExp ? null : wf.issueType)}
                          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: "none", border: "none", cursor: "pointer", fontSize: 12 }}>
                          <span style={{ fontWeight: 600, color: C.navy }}>{String(wf.issueType)}</span>
                          <span style={{ display: "flex", alignItems: "center", gap: 6, color: C.g400, fontSize: 11 }}>
                            {wf.statuses?.length ?? 0} estados
                            {isExp ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </span>
                        </button>
                        {isExp && wf.statuses && (
                          <div style={{ padding: "8px 10px", borderTop: `1px solid ${C.g200}`, background: C.g100, display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {wf.statuses.map((s: any, j: number) => (
                              <div key={j} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <WorkflowStatusBadge category={String(s.category)} />
                                <span style={{ fontSize: 11, color: C.g400 }}>{String(s.name)}</span>
                                {j < wf.statuses.length - 1 && <ArrowRight className="h-3 w-3" style={{ color: C.g300 }} />}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Unlink dialog */}
      <Dialog open={showUnlinkConfirm} onOpenChange={setShowUnlinkConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600"><Unlink className="h-5 w-5" />Desvincular Proyecto</DialogTitle>
            <DialogDescription>
              Esta acción eliminará el proyecto <strong>{space.projectName || space.spaceName}</strong> de la plataforma PMO. El proyecto seguirá existiendo en JIRA.
            </DialogDescription>
          </DialogHeader>
          <div style={{ borderRadius: 10, padding: 12, background: `${C.red}08`, border: `1px solid ${C.red}30`, display: "flex", alignItems: "flex-start", gap: 8 }}>
            <AlertCircle className="h-4 w-4" style={{ color: C.red, marginTop: 2, flexShrink: 0 }} />
            <div style={{ fontSize: 12 }}>
              <p style={{ fontWeight: 700, color: C.red }}>Esta acción no se puede deshacer.</p>
              <p style={{ fontSize: 11, color: C.g400, marginTop: 4 }}>Se eliminarán los registros del proyecto, etapas y espacio JIRA asociado en la plataforma.</p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowUnlinkConfirm(false)} disabled={unlinkMutation.isPending}>Cancelar</Button>
            <Button variant="destructive" disabled={unlinkMutation.isPending} onClick={() => unlinkMutation.mutate({ projectId: space.projectId })}>
              {unlinkMutation.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Desvinculando...</> : <><Trash2 className="w-3.5 h-3.5 mr-1" /> Desvincular</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ==================== LINK PROJECT DIALOG ====================
function LinkProjectDialog({ open, onOpenChange, onLinked }: { open: boolean; onOpenChange: (v: boolean) => void; onLinked: () => void }) {
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [preflightResult, setPreflightResult] = useState<any>(null);
  const [step, setStep] = useState<JiraWizardStep>("search");
  const [identity, setIdentity] = useState({ projectName: "", clientName: "", projectType: "otro", pmUserId: "", deliveryUserId: "", dealId: "" });
  const [mappingDecisions, setMappingDecisions] = useState<Record<string, string>>({});
  const [materializationResult, setMaterializationResult] = useState<any>(null);

  const { data: availableProjects, isLoading: isSearching } = trpc.jira.searchAvailableProjects.useQuery({ query: searchQuery }, { enabled: open });
  const { data: users } = trpc.users.list.useQuery(undefined, { enabled: open && (step === "identity" || step === "mapping") });
  const { data: deals } = trpc.financial.list.useQuery(undefined, { enabled: open && step === "identity" });
  const onboardingQuery = trpc.jira.getExistingProjectOnboarding.useQuery(
    { jiraProjectKey: selectedProject?.key ?? "" },
    { enabled: open && Boolean(selectedProject?.key) },
  );

  const activeManagers = (users ?? []).filter((user: any) => user.status === "activo" && user.role !== "consulta");
  const candidates = onboardingQuery.data?.candidates ?? [];

  const preflightMutation = trpc.jira.preflightExistingProject.useMutation({
    onSuccess: async (data) => {
      setPreflightResult(data);
      await utils.jira.getExistingProjectOnboarding.invalidate({ jiraProjectKey: data.project.key });
      const nextStep = resolveJiraWizardStep(data.readyForMapping, data.onboarding.status);
      setStep(nextStep);
      if (!data.readyForMapping) {
        toast.error("El diagnóstico detectó bloqueos que deben resolverse antes del mapeo.");
        return;
      }
      toast.success("Diagnóstico Jira completado sin escrituras.");
    },
    onError: (err) => toast.error(err.message),
  });

  const identityMutation = trpc.jira.saveExistingProjectIdentity.useMutation({
    onSuccess: async () => {
      await utils.jira.getExistingProjectOnboarding.invalidate({ jiraProjectKey: selectedProject.key });
      setStep("mapping");
      toast.success("Identidad y responsables guardados. Ahora revisa cada issue Jira.");
    },
    onError: (err) => toast.error(err.message),
  });

  const mappingMutation = trpc.jira.saveExistingProjectMappings.useMutation({
    onSuccess: async () => {
      await utils.jira.getExistingProjectOnboarding.invalidate({ jiraProjectKey: selectedProject.key });
      setStep("ready");
      toast.success("Mapeo versionado aprobado. El proyecto está listo para conciliación H4.");
    },
    onError: (err) => toast.error(err.message),
  });

  const materializationMutation = trpc.jira.linkExistingProject.useMutation({
    onSuccess: async (data) => {
      setMaterializationResult(data);
      await Promise.all([
        utils.jira.getExistingProjectOnboarding.invalidate({ jiraProjectKey: selectedProject.key }),
        utils.jira.searchAvailableProjects.invalidate(),
        utils.jira.listAllSpaces.invalidate(),
      ]);
      onLinked();
      toast.success(data.reused ? "Materialización recuperada sin duplicar el proyecto." : "Proyecto materializado con seis etapas canónicas.");
    },
    onError: (err) => toast.error(err.message),
  });

  const resetState = () => {
    setSearchQuery(""); setSelectedProject(null); setPreflightResult(null); setStep("search");
    setIdentity({ projectName: "", clientName: "", projectType: "otro", pmUserId: "", deliveryUserId: "", dealId: "" });
    setMappingDecisions({});
    setMaterializationResult(null);
  };

  const handleSelect = (project: any) => {
    setSelectedProject(project);
    setIdentity(current => ({ ...current, projectName: project.name ?? "" }));
    setPreflightResult(null);
    setStep("preflight");
    preflightMutation.mutate({ jiraProjectKey: project.key });
  };

  const goToIdentity = () => {
    const saved = onboardingQuery.data?.identity as any;
    if (saved) {
      setIdentity({
        projectName: saved.projectName ?? selectedProject?.name ?? "",
        clientName: saved.clientName ?? "",
        projectType: saved.projectType ?? "otro",
        pmUserId: saved.pmUserId ? String(saved.pmUserId) : "",
        deliveryUserId: saved.deliveryUserId ? String(saved.deliveryUserId) : "",
        dealId: saved.dealId ?? "",
      });
    }
    setStep("identity");
  };

  const submitIdentity = () => identityMutation.mutate({
    jiraProjectKey: selectedProject.key,
    projectName: identity.projectName,
    clientName: identity.clientName,
    projectType: identity.projectType as any,
    pmUserId: Number(identity.pmUserId),
    deliveryUserId: Number(identity.deliveryUserId),
    dealId: identity.dealId,
  });

  const decisionFor = (candidate: any) => mappingDecisions[candidate.sourceKey]
    ?? onboardingQuery.data?.mappings?.find((mapping: any) => mapping.sourceKey === candidate.sourceKey)?.targetEntityType
    ?? candidate.proposedTargetEntityType;

  const submitMappings = () => mappingMutation.mutate({
    jiraProjectKey: selectedProject.key,
    mappings: buildJiraMappingSubmission(candidates as any, mappingDecisions, onboardingQuery.data?.mappings as any) as any,
  });

  const stepNumber = step === "search" ? 1 : step === "preflight" ? 2 : step === "identity" ? 3 : 4;

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) resetState(); onOpenChange(value); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col bg-slate-50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Link2 className="w-5 h-5 text-violet-600" />Homologar proyecto JIRA existente</DialogTitle>
          <DialogDescription>Asistente auditable de 7 pasos. Diagnostica, confirma identidad, mapea cada issue y materializa el pipeline PMO sin autocierres.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-2">
          {["Proyecto", "Preflight", "Identidad", "Mapeo"].map((label, index) => (
            <div key={label} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${stepNumber >= index + 1 ? "border-violet-300 bg-violet-50 text-violet-800" : "border-slate-200 bg-white text-slate-400"}`}>
              <span className="mr-2">{index + 1}</span>{label}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          {step === "search" && (
            <div className="space-y-3">
              <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Buscar por nombre o key del proyecto..." className="pl-8 bg-white" autoFocus /></div>
              <div className="space-y-2 min-h-[240px] max-h-[430px] overflow-y-auto">
                {isSearching ? <div className="flex justify-center py-10 text-slate-500"><Loader2 className="w-5 h-5 animate-spin mr-2" />Consultando JIRA...</div> : !availableProjects?.length ? <div className="flex flex-col items-center py-10 text-slate-500"><Globe className="w-8 h-8 mb-2 opacity-40" /><p className="text-sm font-medium">No hay proyectos disponibles</p></div> : availableProjects.map((project: any) => (
                  <button key={project.id} onClick={() => handleSelect(project)} className="w-full flex items-center gap-3 p-3 rounded-lg border bg-white hover:bg-violet-50 hover:border-violet-300 text-left group">
                    <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center text-xs font-bold text-violet-700">{project.key?.charAt(0)}</div>
                    <div className="flex-1 min-w-0"><div className="flex gap-2"><code className="text-xs font-bold text-violet-600">{project.key}</code><span className="text-sm font-medium truncate">{project.name}</span></div><p className="text-xs text-slate-500 mt-1">{project.lead ? `Lead: ${project.lead}` : "Lead [POR CONFIRMAR]"}</p></div>
                    <Plus className="w-4 h-4 text-violet-500 opacity-0 group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {step !== "search" && (
            <div className="rounded-xl border border-violet-200 bg-white p-3 mb-4 flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center font-bold text-violet-700">{selectedProject?.key?.charAt(0)}</div><div className="flex-1"><code className="text-xs font-bold text-violet-600">{selectedProject?.key}</code><p className="text-sm font-semibold text-slate-900">{selectedProject?.name}</p></div><Badge variant="outline">{materializationResult ? "Materializado" : "Sin materializar"}</Badge></div>
          )}

          {step === "preflight" && (
            <div className="space-y-4">
              {preflightMutation.isPending && <div className="flex justify-center py-12 text-slate-500"><Loader2 className="w-5 h-5 animate-spin mr-2" />Leyendo proyecto, issues, estados y tableros...</div>}
              {!preflightMutation.isPending && preflightResult && <><div className="grid grid-cols-2 md:grid-cols-4 gap-2">{[["Issues", preflightResult.inventory.totalIssues], ["Hitos", preflightResult.inventory.milestones], ["Riesgos", preflightResult.inventory.risks], ["Épicas", preflightResult.inventory.epics]].map(([label, value]) => <div key={String(label)} className="rounded-lg border bg-white p-3"><p className="text-[11px] text-slate-500">{label}</p><p className="text-xl font-bold text-slate-900">{value}</p></div>)}</div><div className="grid md:grid-cols-2 gap-3"><div className="rounded-lg border bg-white p-3"><div className="flex justify-between"><p className="text-sm font-semibold">Alineamiento PPDC</p><Badge variant="outline">{preflightResult.corporateAlignment.scorePct}%</Badge></div><p className="text-xs text-slate-500 mt-2">{preflightResult.corporateAlignment.classification === "corporate" ? "Configuración corporativa reconocida." : "Configuración externa aceptable; no será reconfigurada automáticamente."}</p></div><div className="rounded-lg border bg-white p-3"><div className="flex justify-between"><p className="text-sm font-semibold">Fechas de hitos</p><Badge variant="outline">{preflightResult.dateQuality.dueDateCompletenessPct}%</Badge></div><p className="text-xs text-slate-500 mt-2">{preflightResult.dateQuality.milestoneDueDatePresent} con fecha · {preflightResult.dateQuality.milestoneDueDateMissing + preflightResult.dateQuality.milestoneDueDateInvalid} pendientes.</p></div></div>{preflightResult.blockers.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800"><p className="font-semibold flex gap-2"><AlertCircle className="w-4 h-4" />Bloqueos</p>{preflightResult.blockers.map((item: string) => <p key={item} className="mt-1">• {item}</p>)}</div>}{preflightResult.warnings.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><p className="font-semibold">Brechas a conciliar</p>{preflightResult.warnings.map((item: string) => <p key={item} className="mt-1">• {item}</p>)}</div>}<div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-xs text-violet-900"><strong>Dry-run:</strong> no se creó un proyecto PMO ni se modificó JIRA.</div></>}
            </div>
          )}

          {step === "identity" && (
            <div className="space-y-4"><div className="rounded-lg border bg-white p-4"><h3 className="font-semibold text-slate-900">Identidad canónica PMO</h3><p className="text-xs text-slate-500 mt-1">Todos los campos son confirmados por una persona; no se infieren desde JIRA.</p><div className="grid md:grid-cols-2 gap-4 mt-4"><div><Label>Nombre del proyecto</Label><Input className="mt-1" value={identity.projectName} onChange={event => setIdentity({ ...identity, projectName: event.target.value })} /></div><div><Label>Cliente</Label><Input className="mt-1" value={identity.clientName} onChange={event => setIdentity({ ...identity, clientName: event.target.value })} placeholder="[POR CONFIRMAR]" /></div><div><Label>Tipo de proyecto</Label><Select value={identity.projectType} onValueChange={value => setIdentity({ ...identity, projectType: value })}><SelectTrigger className="mt-1 bg-white"><SelectValue /></SelectTrigger><SelectContent>{PROJECT_TYPES.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div><div><Label>Deal financiero</Label><Select value={identity.dealId} onValueChange={value => setIdentity({ ...identity, dealId: value })}><SelectTrigger className="mt-1 bg-white"><SelectValue placeholder="Seleccionar Deal sincronizado" /></SelectTrigger><SelectContent>{(deals ?? []).map((deal: any) => <SelectItem key={deal.dealId} value={deal.dealId}>{deal.dealId} · {deal.clientName ?? "[POR CONFIRMAR]"} · {deal.projectName ?? "[POR CONFIRMAR]"}</SelectItem>)}</SelectContent></Select></div><div><Label>Project Manager</Label><Select value={identity.pmUserId} onValueChange={value => setIdentity({ ...identity, pmUserId: value })}><SelectTrigger className="mt-1 bg-white"><SelectValue placeholder="Seleccionar PM" /></SelectTrigger><SelectContent>{activeManagers.map((user: any) => <SelectItem key={user.id} value={String(user.id)}>{user.name ?? user.email} · {user.role}</SelectItem>)}</SelectContent></Select></div><div><Label>Delivery</Label><Select value={identity.deliveryUserId} onValueChange={value => setIdentity({ ...identity, deliveryUserId: value })}><SelectTrigger className="mt-1 bg-white"><SelectValue placeholder="Seleccionar Delivery" /></SelectTrigger><SelectContent>{activeManagers.map((user: any) => <SelectItem key={user.id} value={String(user.id)}>{user.name ?? user.email} · {user.role}</SelectItem>)}</SelectContent></Select></div></div></div></div>
          )}

          {step === "mapping" && (
            <div className="space-y-3"><div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900"><strong>Regla:</strong> cada issue debe quedar homologado o excluido explícitamente. JIRA → PMO será observacional; PMO → JIRA solo mediante una acción futura y explícita.</div><div className="rounded-lg border bg-white overflow-hidden"><div className="grid grid-cols-[120px_130px_1fr_190px] gap-3 px-3 py-2 bg-slate-100 text-[11px] font-semibold text-slate-600"><span>Issue</span><span>Tipo JIRA</span><span>Resumen</span><span>Destino PMO</span></div><div className="max-h-[360px] overflow-y-auto divide-y">{onboardingQuery.isLoading ? <div className="flex justify-center p-8"><Loader2 className="w-5 h-5 animate-spin" /></div> : candidates.map((candidate: any) => <div key={candidate.sourceKey} className="grid grid-cols-[120px_130px_1fr_190px] gap-3 px-3 py-2 items-center text-xs"><code className="font-bold text-violet-700">{candidate.sourceKey}</code><span className="text-slate-600">{candidate.jiraIssueType}</span><div className="min-w-0"><p className="truncate font-medium text-slate-800">{candidate.summary}</p><p className="text-[10px] text-slate-500">{candidate.assigneeName ?? "Responsable [POR CONFIRMAR]"} · {candidate.dueDate ?? "Fecha [PENDIENTE]"}</p></div><Select value={decisionFor(candidate)} onValueChange={value => setMappingDecisions(current => ({ ...current, [candidate.sourceKey]: value }))}><SelectTrigger className="h-8 bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="milestone">Hito contractual</SelectItem><SelectItem value="risk">Riesgo</SelectItem><SelectItem value="epic">Épica</SelectItem><SelectItem value="task">Tarea / historia</SelectItem><SelectItem value="document">Documento</SelectItem><SelectItem value="stage_evidence">Evidencia de etapa</SelectItem><SelectItem value="ignored">Excluir justificadamente</SelectItem></SelectContent></Select></div>)}</div></div><p className="text-xs text-slate-500">Versión de mapeo: v{onboardingQuery.data?.onboarding.mappingVersion ?? 1} · {candidates.length} decisiones requeridas.</p></div>
          )}

          {step === "ready" && !materializationResult && <div className="space-y-4"><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5"><CheckCircle2 className="w-9 h-9 text-emerald-600" /><h3 className="font-semibold text-emerald-900 mt-3">Identidad y mapeo aprobados</h3><p className="text-sm text-emerald-800 mt-2">La activación creará un proyecto PMO canónico. No cerrará ninguna etapa ni convertirá un estado Jira en evidencia.</p></div><div className="rounded-xl border bg-white p-4"><p className="text-sm font-semibold text-slate-900">Pipeline que será materializado</p><div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">{["1. SoW", "2. Jira", "3. Riesgos", "4. Planificación", "5. Avance", "6. Cierre"].map((label, index) => <div key={label} className={`rounded-lg border px-3 py-2 text-xs ${index === 0 ? "border-violet-300 bg-violet-50 text-violet-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}><p className="font-semibold">{label}</p><p className="mt-1">{index === 0 ? "En progreso · evidencia [PENDIENTE]" : "Bloqueada hasta cierre formal anterior"}</p></div>)}</div></div></div>}
          {step === "ready" && materializationResult && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center"><CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" /><h3 className="font-semibold text-emerald-900 mt-3">Proyecto PMO materializado</h3><p className="text-sm text-emerald-800 mt-2">Se crearon exactamente seis etapas. SoW permanece en progreso y las demás están bloqueadas. Cada avance exigirá evidencia y confirmación humana.</p><p className="text-xs text-emerald-700 mt-3">Proyecto #{materializationResult.projectId} · Jira {materializationResult.jiraProjectKey} · {materializationResult.reused ? "reintento idempotente" : "nueva materialización"}</p></div>}
        </div>

        <DialogFooter className="gap-2">
          {step !== "search" && step !== "ready" && <Button variant="outline" onClick={() => setStep(step === "mapping" ? "identity" : step === "identity" ? "preflight" : "search")} disabled={preflightMutation.isPending || identityMutation.isPending || mappingMutation.isPending}>Volver</Button>}
          {step === "preflight" && preflightMutation.isError && <Button onClick={() => preflightMutation.mutate({ jiraProjectKey: selectedProject.key })}>Reintentar</Button>}
          {step === "preflight" && preflightResult?.readyForMapping && <Button onClick={goToIdentity} className="bg-violet-600 hover:bg-violet-700">Continuar a identidad</Button>}
          {step === "identity" && <Button onClick={submitIdentity} disabled={identityMutation.isPending || !identity.projectName.trim() || !identity.clientName.trim() || !identity.pmUserId || !identity.deliveryUserId || !identity.dealId} className="bg-violet-600 hover:bg-violet-700">{identityMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Guardando...</> : "Guardar identidad y continuar"}</Button>}
          {step === "mapping" && <Button onClick={submitMappings} disabled={mappingMutation.isPending || onboardingQuery.isLoading} className="bg-violet-600 hover:bg-violet-700">{mappingMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Aprobando...</> : `Aprobar ${candidates.length} decisiones`}</Button>}
          {step === "ready" && !materializationResult && <Button onClick={() => materializationMutation.mutate({ jiraProjectKey: selectedProject.key })} disabled={materializationMutation.isPending} className="bg-violet-600 hover:bg-violet-700">{materializationMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Materializando...</> : "Materializar seis etapas"}</Button>}
          {step === "ready" && materializationResult && <Button onClick={() => setLocation(`/projects/${materializationResult.projectId}/sow`)} className="bg-violet-600 hover:bg-violet-700">Abrir SoW y registrar evidencia</Button>}
          {step === "ready" && materializationResult && <Button variant="outline" onClick={() => { onOpenChange(false); resetState(); }}>Cerrar</Button>}
          {step !== "search" && step !== "ready" && <Button variant="ghost" onClick={() => onOpenChange(false)}>Salir y continuar después</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== MAIN PAGE ====================
export default function JiraSpacesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "created" | "pending_permissions" | "linked">("all");
  const [linkDialogOpen, setLinkDialogOpen] = useState(() => new URLSearchParams(window.location.search).get("openLink") === "1");

  const { data: spaces, isLoading, refetch } = trpc.jira.listAllSpaces.useQuery();

  const filtered = useMemo(() => (spaces ?? []).filter((s) => {
    const matchSearch = !search || s.spaceName.toLowerCase().includes(search.toLowerCase()) || (s.jiraProjectKey ?? "").toLowerCase().includes(search.toLowerCase()) || (s.jiraProjectName ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    return matchSearch && matchStatus;
  }), [spaces, search, statusFilter]);

  const totalCreated = (spaces ?? []).filter((s) => s.status === "created").length;
  const totalPending = (spaces ?? []).filter((s) => s.status === "pending_permissions").length;
  const totalLinked = (spaces ?? []).filter((s) => s.status === "linked").length;

  const filterButtons = [
    { id: "all" as const, label: "Todos" },
    { id: "created" as const, label: "Creados" },
    { id: "linked" as const, label: "Vinculados" },
    { id: "pending_permissions" as const, label: "Pendientes" },
  ];

  return (
    <div style={{ background: C.g100, fontFamily: "'Inter', sans-serif", color: C.navy, minHeight: "100vh" }}>
      {/* ── HEADER ── */}
      <div style={{ ...headerGradient, padding: "32px 36px 28px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <span style={{ background: "rgba(59,142,232,.15)", border: "1px solid rgba(59,142,232,.35)", borderRadius: 20, padding: "3px 12px", fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: ".1em", textTransform: "uppercase" }}>ADMINISTRACIÓN</span>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-.5px", marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
              <Building2 className="h-6 w-6" style={{ color: C.accent }} /> Spaces JIRA
            </h1>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginTop: 4 }}>Gestión de todos los Spaces JIRA vinculados a proyectos PMO</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button onClick={() => setLinkDialogOpen(true)} style={{ background: "#7C3AED", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 12, padding: "8px 18px", display: "flex", alignItems: "center", gap: 6 }}>
              <Link2 className="h-4 w-4" /> Vincular Proyecto
            </Button>
            <Button onClick={() => refetch()} variant="outline" style={{ background: "rgba(255,255,255,.1)", color: "#fff", border: "1px solid rgba(255,255,255,.15)", borderRadius: 8, fontWeight: 700, fontSize: 12, padding: "8px 14px", display: "flex", alignItems: "center", gap: 6 }}>
              <RefreshCw className="h-4 w-4" /> Actualizar
            </Button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
          {[
            { label: "Total Spaces", value: spaces?.length ?? 0 },
            { label: "Creados", value: totalCreated },
            { label: "Vinculados", value: totalLinked },
            { label: "Pendientes", value: totalPending },
          ].map((k) => (
            <div key={k.label} style={headerKpiCard}>
              <div style={headerKpiLabel}>{k.label}</div>
              <div style={headerKpiValue}>{k.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ padding: "28px 36px", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Filters */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
            <Search className="h-4 w-4" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.g400 }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, key JIRA..."
              style={{ width: "100%", padding: "10px 10px 10px 36px", borderRadius: 8, border: `1px solid ${C.g200}`, fontSize: 12, fontFamily: "'Inter', sans-serif", background: "#fff", color: C.navy, outline: "none" }} />
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {filterButtons.map((f) => (
              <button key={f.id} onClick={() => setStatusFilter(f.id)}
                style={{ fontSize: 11, fontWeight: 700, padding: "7px 14px", borderRadius: 8, border: statusFilter === f.id ? "none" : `1px solid ${C.g200}`, background: statusFilter === f.id ? C.accent : "#fff", color: statusFilter === f.id ? "#fff" : C.g400, cursor: "pointer" }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: C.g400 }}>
            <RefreshCw className="h-6 w-6 animate-spin" style={{ margin: "0 auto 8px" }} />
            <p style={{ fontSize: 13 }}>Cargando Spaces JIRA...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: "center", padding: "48px 0" }}>
            <AlertCircle className="h-8 w-8" style={{ margin: "0 auto 8px", color: C.g300 }} />
            <p style={{ fontSize: 14, fontWeight: 700, color: C.g400 }}>No hay Spaces JIRA</p>
            <p style={{ fontSize: 12, color: C.g300, marginTop: 4 }}>
              {search || statusFilter !== "all" ? "No hay resultados para los filtros aplicados." : "Los Spaces se crean desde la etapa JIRA de cada proyecto, o puedes vincular un proyecto existente."}
            </p>
            {!search && statusFilter === "all" && (
              <button onClick={() => setLinkDialogOpen(true)} style={{ marginTop: 12, fontSize: 12, fontWeight: 600, color: "#7C3AED", background: "none", border: "1px solid rgba(139,92,246,.3)", borderRadius: 8, padding: "6px 16px", cursor: "pointer" }}>
                <Link2 className="h-3.5 w-3.5" style={{ display: "inline", marginRight: 4 }} /> Vincular Proyecto JIRA
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {filtered.map((space) => <SpaceCard key={space.id} space={space} onRetried={() => refetch()} />)}
          </div>
        )}
      </div>

      {/* ── FOOTER ── */}
      <div style={footerStyle}>
        <span style={footerText}>Prodigio PMO — Spaces JIRA</span>
        <span style={footerText}>{new Date().getFullYear()}</span>
      </div>

      <LinkProjectDialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen} onLinked={() => refetch()} />
    </div>
  );
}
