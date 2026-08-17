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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [clientName, setClientName] = useState("");
  const [projectType, setProjectType] = useState("otro");
  const [step, setStep] = useState<"search" | "confirm">("search");

  const { data: availableProjects, isLoading: isSearching } = trpc.jira.searchAvailableProjects.useQuery({ query: searchQuery }, { enabled: open });
  const linkMutation = trpc.jira.linkExistingProject.useMutation({
    onSuccess: (data) => { toast.success(data.message); onOpenChange(false); resetState(); onLinked(); },
    onError: (err) => toast.error(err.message),
  });

  const resetState = () => { setSearchQuery(""); setSelectedProject(null); setClientName(""); setProjectType("otro"); setStep("search"); };
  const handleSelect = (project: any) => { setSelectedProject(project); setStep("confirm"); };
  const handleLink = () => {
    if (!selectedProject || !clientName.trim()) { toast.error("Ingresa el nombre del cliente"); return; }
    linkMutation.mutate({ jiraProjectKey: selectedProject.key, jiraProjectName: selectedProject.name, clientName: clientName.trim(), projectType: projectType as any });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetState(); onOpenChange(v); }}>
      <DialogContent className="max-w-xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Link2 className="w-5 h-5" style={{ color: "#7C3AED" }} />{step === "search" ? "Vincular Proyecto JIRA Existente" : "Confirmar Vinculación"}</DialogTitle>
          <DialogDescription>{step === "search" ? "Busca y selecciona un proyecto JIRA para vincularlo a la plataforma PMO." : `Completa la información para vincular "${selectedProject?.name}".`}</DialogDescription>
        </DialogHeader>
        {step === "search" ? (
          <div className="flex-1 overflow-hidden flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar por nombre o key del proyecto..." className="pl-8" autoFocus />
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5 min-h-[200px] max-h-[400px]">
              {isSearching ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" />Buscando proyectos en JIRA...</div>
              ) : !availableProjects || availableProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Globe className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-sm font-medium">No hay proyectos disponibles</p>
                  <p className="text-xs mt-1">{searchQuery ? "Intenta con otro término de búsqueda" : "Todos los proyectos JIRA ya están gestionados"}</p>
                </div>
              ) : availableProjects.map((p: any) => (
                <button key={p.id} onClick={() => handleSelect(p)} className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-violet-50 hover:border-violet-300 transition-all text-left group">
                  {p.avatarUrl ? <img src={p.avatarUrl} alt="" className="w-8 h-8 rounded" /> : <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">{p.key?.charAt(0)}</div>}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><code className="text-xs font-mono font-bold text-violet-600">{p.key}</code><span className="text-sm font-medium truncate">{p.name}</span></div>
                    <div className="flex items-center gap-2 mt-0.5">{p.lead && <span className="text-xs text-muted-foreground">Lead: {p.lead}</span>}{p.projectTypeKey && <Badge variant="outline" className="text-[10px] capitalize">{p.projectTypeKey}</Badge>}</div>
                  </div>
                  <Plus className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center">{availableProjects?.length ?? 0} proyectos disponibles para vincular</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 10, background: "rgba(139,92,246,.06)", border: "1px solid rgba(139,92,246,.2)" }}>
              {selectedProject?.avatarUrl ? <img src={selectedProject.avatarUrl} alt="" className="w-10 h-10 rounded" /> : <div style={{ width: 40, height: 40, borderRadius: 8, background: "rgba(139,92,246,.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#7C3AED" }}>{selectedProject?.key?.charAt(0)}</div>}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}><code style={{ fontSize: 13, fontWeight: 700, color: "#7C3AED" }}>{selectedProject?.key}</code><span style={{ fontWeight: 600 }}>{selectedProject?.name}</span></div>
                {selectedProject?.lead && <p style={{ fontSize: 11, color: C.g400, marginTop: 2 }}>Lead: {selectedProject.lead}</p>}
              </div>
            </div>
            <div className="space-y-3">
              <div><Label className="text-sm font-medium">Nombre del Cliente *</Label><Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Ej: Banco Estado, Falabella..." className="mt-1" autoFocus /></div>
              <div>
                <Label className="text-sm font-medium">Tipo de Proyecto</Label>
                <Select value={projectType} onValueChange={setProjectType}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{PROJECT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select>
              </div>
            </div>
            <div style={{ borderRadius: 10, padding: 12, background: "rgba(139,92,246,.06)", border: "1px solid rgba(139,92,246,.2)", fontSize: 12, color: "#7C3AED" }}>
              <strong>Nota:</strong> Los proyectos vinculados se abren directamente en la vista de <strong>Avance Proyecto</strong> con el dashboard JIRA en tiempo real.
            </div>
          </div>
        )}
        <DialogFooter className="gap-2">
          {step === "confirm" && <Button variant="outline" onClick={() => { setSelectedProject(null); setStep("search"); }} disabled={linkMutation.isPending}>Volver</Button>}
          {step === "confirm" && (
            <Button onClick={handleLink} disabled={linkMutation.isPending || !clientName.trim()} style={{ background: "#7C3AED", color: "#fff" }}>
              {linkMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Vinculando...</> : <><Link2 className="w-4 h-4 mr-1" /> Vincular Proyecto</>}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== MAIN PAGE ====================
export default function JiraSpacesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "created" | "pending_permissions" | "linked">("all");
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);

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
