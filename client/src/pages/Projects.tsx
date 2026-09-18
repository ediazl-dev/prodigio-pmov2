import { useAuth } from "@/_core/hooks/useAuth";
import { ProjectIdBadge } from "@/components/ProjectIdBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { formatPmoProjectId, normalizeProjectName } from "@shared/projectIdentity";
import {
  ArrowRight,
  FolderKanban,
  Link2,
  Plus,
  Search,
  Sparkles,
  Activity,
  CheckCircle2,
  Loader2,
  Filter,
  X,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

/* ─── Palette (aligned with Dashboard Principal, JIRA Report, Executive Dashboard) ─── */
const C = {
  navy: "#0A1628", navy2: "#112240", navy3: "#1A3358",
  blue: "#1B4F8A", blue2: "#2563AB", accent: "#e91e8c",
  teal: "#0D7A6B", teal2: "#12A08D",
  gold: "#B8860B", gold2: "#D4A017",
  red: "#B83232", green: "#1A7A4A",
  g100: "#F4F7FB", g150: "#EBF0F7", g200: "#D8E2EF", g300: "#B0BDD0", g400: "#7A8FA8",
};

const STAGE_LABELS: Record<string, { label: string; color: string }> = {
  sow: { label: "SoW", color: C.accent },
  jira: { label: "Jira", color: C.blue2 },
  risks: { label: "Riesgos", color: C.gold2 },
  planning: { label: "Planificación", color: C.teal },
  design: { label: "Avance", color: C.teal2 },
  closure: { label: "Cierre", color: C.blue },
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  activo: { label: "Activo", bg: "#E8F5E9", color: C.teal },
  pausado: { label: "Pausado", bg: "#FFF8E1", color: C.gold },
  completado: { label: "Completado", bg: "#E3F2FD", color: C.accent },
  cancelado: { label: "Cancelado", bg: "#FFEBEE", color: C.red },
};

const PROJECT_TYPES = [
  { value: "apigee", label: "Apigee / API Gateway" },
  { value: "desarrollo", label: "Desarrollo de Software" },
  { value: "integracion", label: "Integración" },
  { value: "data", label: "Data / Analytics" },
  { value: "otro", label: "Otro" },
];

const STAGE_ORDER = ["sow", "jira", "risks", "planning", "design", "closure"];

export default function Projects() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    projectName: "",
    clientName: "",
    clientEmail: "",
    projectType: "desarrollo",
    totalAmount: "",
    currency: "USD",
  });

  const role = (user as any)?.role ?? "consulta";
  const canCreate = ["admin", "pmo"].includes(role);
  const isAdmin = role === "admin";

  // Delete project state
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string; stage: string } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const deleteMutation = trpc.jira.deleteProject.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setDeleteTarget(null);
      setDeleteConfirmText("");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const BLOCKED_STAGES_FOR_DELETE = ["design", "closure"];
  const canDeleteProject = (stage: string) => !BLOCKED_STAGES_FOR_DELETE.includes(stage);

  const { data: projects, isLoading, refetch } = trpc.projects.list.useQuery();
  const createMutation = trpc.projects.create.useMutation({
    onSuccess: (data) => {
      toast.success("Proyecto creado exitosamente");
      setOpen(false);
      setForm({ projectName: "", clientName: "", clientEmail: "", projectType: "desarrollo", totalAmount: "", currency: "USD" });
      refetch();
      setLocation(`/projects/${data.id}/sow`);
    },
    onError: (e) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    return (projects ?? []).filter((p: any) => {
      const matchSearch =
        !search ||
        p.projectName?.toLowerCase().includes(search.toLowerCase()) ||
        p.clientName?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [projects, search, statusFilter]);

  const handleCreate = () => {
    if (!form.projectName || !form.clientName) {
      toast.error("Nombre del proyecto y cliente son requeridos");
      return;
    }
    const projectName = normalizeProjectName(form.projectName);
    const duplicate = (projects ?? []).find((project: any) => normalizeProjectName(project.projectName) === projectName);
    if (duplicate) {
      toast.error(`Ya existe ${formatPmoProjectId(duplicate.id)} con ese nombre. Abre ese proyecto en vez de crear otro.`);
      return;
    }
    createMutation.mutate({ ...form, projectName } as any);
  };

  const totalCount = projects?.length ?? 0;
  const activeCount = projects?.filter((p: any) => p.status === "activo").length ?? 0;
  const completedCount = projects?.filter((p: any) => p.status === "completado").length ?? 0;

  return (
    <div className="prodigio-projects min-h-screen" style={{ background: C.g100, fontFamily: "'Poppins', sans-serif", color: C.navy }}>
      {/* ═══ HERO HEADER ═══ */}
      <div style={{
        background: `linear-gradient(160deg, ${C.navy} 0%, ${C.navy2} 55%, ${C.navy3} 100%)`,
        borderBottom: `3px solid ${C.accent}`,
      }}>
        <div className="prodigio-projects-hero" style={{ padding: "22px 36px 18px" }}>
          <div className="flex items-center gap-2.5" style={{ marginBottom: 8 }}>
            <span style={{
              background: "rgba(233,30,140,.15)", border: "1px solid rgba(233,30,140,.35)",
              borderRadius: 20, padding: "3px 12px", fontSize: 10, fontWeight: 700,
              color: C.accent, letterSpacing: ".1em", textTransform: "uppercase",
            }}>PMO Proyectos</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,.45)", fontWeight: 500 }}>
              · {totalCount} proyecto{totalCount !== 1 ? "s" : ""} registrado{totalCount !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-start justify-between">
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-.5px", lineHeight: 1.15 }}>
                Portafolio de Proyectos
              </h1>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginTop: 4 }}>
                Prodigio Tech · Gestión integral de proyectos PMO
              </p>
            </div>
            {canCreate && (
              <Button onClick={() => setOpen(true)} size="sm"
                style={{ background: C.accent, color: "#fff", fontSize: 11, fontWeight: 700 }}>
                <Plus size={14} className="mr-1.5" />
                Nuevo Proyecto
              </Button>
            )}
          </div>

          {/* ─── KPI Strip ─── */}
          <div className="prodigio-projects-kpis" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 16 }}>
            {[
              { icon: FolderKanban, label: "Total Proyectos", value: totalCount, color: C.accent },
              { icon: Activity, label: "Activos", value: activeCount, color: C.teal2 },
              { icon: CheckCircle2, label: "Completados", value: completedCount, color: C.gold2 },
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
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ FILTERS BAR ═══ */}
      <div className="prodigio-projects-filters" style={{
        background: "#fff", borderBottom: `1px solid ${C.g200}`,
        boxShadow: "0 1px 4px rgba(10,22,40,.04)", padding: "12px 28px",
      }}>
        <div className="flex items-center gap-3">
          <div style={{ position: "relative", flex: 1, maxWidth: 400 }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.g400 }} />
            <input
              placeholder="Buscar por nombre o cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%", padding: "8px 12px 8px 34px", borderRadius: 8,
                border: `1px solid ${C.g200}`, fontSize: 12, color: C.navy,
                background: C.g100, outline: "none",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = C.accent)}
              onBlur={(e) => (e.currentTarget.style.borderColor = C.g200)}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", color: C.g400,
              }}>
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Filter size={13} style={{ color: C.g400 }} />
            {["all", "activo", "pausado", "completado", "cancelado"].map((s) => {
              const isActive = statusFilter === s;
              const label = s === "all" ? "Todos" : STATUS_CONFIG[s]?.label ?? s;
              return (
                <button key={s} onClick={() => setStatusFilter(s)} style={{
                  padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: isActive ? 700 : 500,
                  background: isActive ? `${C.accent}12` : "transparent",
                  color: isActive ? C.accent : C.g400,
                  border: isActive ? `1px solid ${C.accent}30` : `1px solid transparent`,
                  cursor: "pointer", transition: "all .15s",
                }}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ PROJECT LIST ═══ */}
      <div style={{ padding: "20px 28px 32px" }}>
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ height: 80, background: "#fff", borderRadius: 12, border: `1px solid ${C.g200}`, animation: "pulse 1.5s infinite" }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <FolderKanban size={48} style={{ color: C.g300, margin: "0 auto 12px" }} />
            <p style={{ fontSize: 15, fontWeight: 700, color: C.navy }}>No se encontraron proyectos</p>
            <p style={{ fontSize: 12, color: C.g400, marginTop: 6 }}>
              {search ? "Intenta con otro término de búsqueda" : "Crea tu primer proyecto para comenzar"}
            </p>
            {canCreate && !search && (
              <button onClick={() => setOpen(true)} style={{
                marginTop: 16, background: `${C.accent}10`, border: `1px solid ${C.accent}30`,
                borderRadius: 8, padding: "8px 18px", fontSize: 12, fontWeight: 600, color: C.accent, cursor: "pointer",
              }}>
                <Plus size={14} className="inline mr-1" /> Crear primer proyecto
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((p: any) => {
              const stage = STAGE_LABELS[p.currentStage] ?? { label: p.currentStage, color: C.g400 };
              const status = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.activo;
              const stageIdx = STAGE_ORDER.indexOf(p.currentStage);
              const progress = Math.round(((stageIdx + 1) / STAGE_ORDER.length) * 100);

              return (
                <div
                  key={p.id}
                  onClick={() => setLocation(`/projects/${p.id}`)}
                  className="group"
                  style={{
                    background: "#fff", borderRadius: 12, padding: "16px 20px",
                    border: `1px solid ${C.g200}`, boxShadow: "0 1px 4px rgba(10,22,40,.04)",
                    cursor: "pointer", transition: "all .15s", display: "flex", alignItems: "center", gap: 16,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = "0 4px 16px rgba(10,22,40,.08)";
                    e.currentTarget.style.borderColor = `${C.accent}40`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "0 1px 4px rgba(10,22,40,.04)";
                    e.currentTarget.style.borderColor = C.g200;
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: `${stage.color}15`, border: `1px solid ${stage.color}30`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 15, fontWeight: 800, color: stage.color,
                  }}>
                    {p.projectName?.charAt(0)?.toUpperCase() ?? "P"}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p style={{ fontSize: 13, fontWeight: 700, color: C.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {p.projectName}
                      </p>
                      <ProjectIdBadge projectId={p.id} />
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                        background: status.bg, color: status.color,
                      }}>{status.label}</span>
                      {p.origin === "linked" && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                          background: "#EDE7F6", color: "#7C4DFF",
                          display: "flex", alignItems: "center", gap: 3,
                        }}>
                          <Link2 size={9} /> Vinculado
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 11, color: C.g400, marginTop: 2 }}>{p.clientName}</p>
                    {/* Mini pipeline */}
                    <div style={{ display: "flex", gap: 3, marginTop: 8, maxWidth: 200 }}>
                      {STAGE_ORDER.map((s, i) => (
                        <div
                          key={s}
                          style={{
                            height: 3, flex: 1, borderRadius: 2,
                            background: i < stageIdx ? C.teal : i === stageIdx ? stage.color : C.g200,
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Stage + Amount + Arrow + Delete */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                    <div style={{ textAlign: "right" }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 10,
                        background: `${stage.color}15`, color: stage.color,
                      }}>{stage.label}</span>
                      {p.totalAmount && (
                        <p style={{ fontSize: 10, color: C.g400, marginTop: 4 }}>
                          {p.currency} {Number(p.totalAmount).toLocaleString()}
                        </p>
                      )}
                    </div>
                    {/* Admin delete button - only for deletable stages */}
                    {isAdmin && canDeleteProject(p.currentStage) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget({ id: p.id, name: p.projectName, stage: p.currentStage });
                          setDeleteConfirmText("");
                        }}
                        title="Eliminar proyecto"
                        style={{
                          background: "transparent", border: `1px solid ${C.g200}`, borderRadius: 8,
                          padding: "5px 8px", cursor: "pointer", color: C.g400,
                          display: "flex", alignItems: "center", transition: "all .15s",
                          opacity: 0,
                        }}
                        className="group-hover:opacity-100 hover:!bg-red-50 hover:!border-red-300 hover:!text-red-600"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                    <ArrowRight size={14} style={{ color: C.g300, opacity: 0, transition: "opacity .15s" }}
                      className="group-hover:opacity-100" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ FOOTER ═══ */}
      <div className="prodigio-projects-footer" style={{
        background: C.navy2, padding: "12px 36px", display: "flex", justifyContent: "space-between",
        alignItems: "center", borderTop: `1px solid ${C.navy3}`,
      }}>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,.3)" }}>Prodigio Tech · Prodigio · Confidencial</span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,.3)" }}>
          {filtered.length} de {totalCount} proyectos · {new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" })}
        </span>
      </div>

      {/* ═══ CREATE PROJECT DIALOG ═══ */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" style={{ fontFamily: "'Inter', sans-serif" }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" style={{ color: C.navy, fontSize: 16, fontWeight: 700 }}>
              <Sparkles size={18} style={{ color: C.accent }} />
              Crear Nuevo Proyecto
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label style={{ fontSize: 12, fontWeight: 600, color: C.navy }}>Nombre del Proyecto *</Label>
              <Input
                placeholder="ej. Implementación Apigee - Banco XYZ"
                value={form.projectName}
                onChange={(e) => setForm({ ...form, projectName: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                style={{ fontSize: 12 }}
              />
            </div>
            <div className="space-y-1.5">
              <Label style={{ fontSize: 12, fontWeight: 600, color: C.navy }}>Cliente *</Label>
              <Input
                placeholder="Nombre de la empresa cliente"
                value={form.clientName}
                onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                style={{ fontSize: 12 }}
              />
            </div>
            <div className="space-y-1.5">
              <Label style={{ fontSize: 12, fontWeight: 600, color: C.navy }}>Email del Cliente</Label>
              <Input
                type="email"
                placeholder="contacto@cliente.com"
                value={form.clientEmail}
                onChange={(e) => setForm({ ...form, clientEmail: e.target.value })}
                style={{ fontSize: 12 }}
              />
            </div>
            <div className="space-y-1.5">
              <Label style={{ fontSize: 12, fontWeight: 600, color: C.navy }}>Tipo de Proyecto</Label>
              <Select value={form.projectType} onValueChange={(v) => setForm({ ...form, projectType: v })}>
                <SelectTrigger style={{ fontSize: 12 }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label style={{ fontSize: 12, fontWeight: 600, color: C.navy }}>Monto Total</Label>
                <Input
                  placeholder="0.00"
                  value={form.totalAmount}
                  onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
                  style={{ fontSize: 12 }}
                />
              </div>
              <div className="space-y-1.5">
                <Label style={{ fontSize: 12, fontWeight: 600, color: C.navy }}>Moneda</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger style={{ fontSize: 12 }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="UF">UF</SelectItem>
                    <SelectItem value="UYU">UYU</SelectItem>
                    <SelectItem value="ARS">ARS</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div style={{
              borderRadius: 10, padding: "10px 14px",
              background: `${C.accent}08`, border: `1px solid ${C.accent}15`,
              display: "flex", alignItems: "flex-start", gap: 8,
            }}>
              <Sparkles size={14} style={{ color: C.accent, marginTop: 1, flexShrink: 0 }} />
              <p style={{ fontSize: 11, color: C.g400, lineHeight: 1.5 }}>
                Al crear el proyecto, serás redirigido al módulo SoW donde podrás cargar la propuesta en PDF para que la IA complete el Statement of Work automáticamente.
              </p>
            </div>
            <Button
              className="w-full"
              onClick={handleCreate}
              disabled={createMutation.isPending}
              style={{ background: C.accent, color: "#fff", fontWeight: 700, fontSize: 12 }}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-2" />
                  Creando...
                </>
              ) : (
                <>
                  <Plus size={14} className="mr-2" />
                  Crear Proyecto e Ir al SoW
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ DELETE PROJECT CONFIRMATION DIALOG ═══ */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteConfirmText(""); } }}>
        <DialogContent className="max-w-md" style={{ fontFamily: "'Inter', sans-serif" }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" style={{ color: C.red, fontSize: 16, fontWeight: 700 }}>
              <AlertTriangle size={18} style={{ color: C.red }} />
              Eliminar Proyecto PMO
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Warning box */}
            <div style={{
              background: "#FFF5F5", border: `1px solid ${C.red}30`, borderRadius: 8,
              padding: "12px 14px",
            }}>
              <p style={{ fontSize: 12, color: C.red, fontWeight: 600, marginBottom: 4 }}>
                Esta acción es irreversible
              </p>
              <p style={{ fontSize: 12, color: "#555", lineHeight: 1.5 }}>
                Se eliminarán permanentemente el proyecto <strong>{deleteTarget?.name}</strong> y todos sus datos asociados:
                SoW, riesgos, planificación, hitos de facturación, documentos y registros de auditoría.
              </p>
            </div>

            {/* Stage info */}
            <div style={{
              background: C.g100, borderRadius: 8, padding: "10px 14px",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 11, color: C.g400 }}>Etapa actual:</span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 8,
                background: `${STAGE_LABELS[deleteTarget?.stage ?? "sow"]?.color ?? C.accent}15`,
                color: STAGE_LABELS[deleteTarget?.stage ?? "sow"]?.color ?? C.accent,
              }}>
                {STAGE_LABELS[deleteTarget?.stage ?? "sow"]?.label ?? deleteTarget?.stage}
              </span>
            </div>

            {/* Confirmation input */}
            <div className="space-y-1.5">
              <Label style={{ fontSize: 12, fontWeight: 600, color: C.navy }}>
                Escribe <strong style={{ color: C.red }}>ELIMINAR</strong> para confirmar
              </Label>
              <Input
                placeholder="ELIMINAR"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                style={{ fontSize: 12, borderColor: deleteConfirmText === "ELIMINAR" ? C.red : undefined }}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setDeleteTarget(null); setDeleteConfirmText(""); }}
                style={{ fontSize: 12 }}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={() => deleteTarget && deleteMutation.mutate({ projectId: deleteTarget.id })}
                disabled={deleteConfirmText !== "ELIMINAR" || deleteMutation.isPending}
                style={{
                  background: deleteConfirmText === "ELIMINAR" ? C.red : C.g300,
                  color: "#fff", fontWeight: 700, fontSize: 12,
                  cursor: deleteConfirmText !== "ELIMINAR" ? "not-allowed" : "pointer",
                }}
              >
                {deleteMutation.isPending ? (
                  <><Loader2 size={14} className="animate-spin mr-2" /> Eliminando...</>
                ) : (
                  <><Trash2 size={14} className="mr-2" /> Eliminar Proyecto</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
