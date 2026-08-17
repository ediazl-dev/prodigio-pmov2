import { useAuth } from "@/_core/hooks/useAuth";
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
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  FileText,
  FolderKanban,
  Plus,
  Sparkles,
  Users,
  Target,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

/* ─── Palette (aligned with LinkedProjectDashboard & JiraReport) ─── */
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

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: stats } = trpc.projects.stats.useQuery();
  const { data: projects, isLoading, refetch } = trpc.projects.list.useQuery();

  const role = (user as any)?.role ?? "consulta";
  const canCreate = ["admin", "pmo"].includes(role);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    projectName: "",
    clientName: "",
    clientEmail: "",
    projectType: "desarrollo",
    totalAmount: "",
    currency: "USD",
  });

  const createMutation = trpc.projects.create.useMutation({
    onSuccess: (data) => {
      toast.success("Proyecto creado. Iniciando SoW...");
      setOpen(false);
      setForm({ projectName: "", clientName: "", clientEmail: "", projectType: "desarrollo", totalAmount: "", currency: "USD" });
      refetch();
      setLocation(`/projects/${data.id}/sow`);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleCreate = () => {
    if (!form.projectName || !form.clientName) {
      toast.error("Nombre del proyecto y cliente son requeridos");
      return;
    }
    createMutation.mutate(form as any);
  };

  const recentProjects = projects?.slice(0, 8) ?? [];

  const stageData = Object.entries(STAGE_LABELS).map(([key, val]) => ({
    name: val.label,
    count: projects?.filter((p: any) => p.currentStage === key).length ?? 0,
    color: val.color,
  }));

  const activeCount = stats?.active ?? 0;
  const totalCount = stats?.total ?? 0;

  return (
    <div className="prodigio-dashboard min-h-screen" style={{ background: C.g100, fontFamily: "'Poppins', sans-serif", color: C.navy }}>
      {/* ═══ HERO HEADER ═══ */}
      <div style={{
        background: `linear-gradient(160deg, ${C.navy} 0%, ${C.navy2} 55%, ${C.navy3} 100%)`,
        borderBottom: `3px solid ${C.accent}`,
      }}>
        <div className="prodigio-hero-content" style={{ padding: "22px 36px 18px" }}>
          <div className="flex items-center gap-2.5" style={{ marginBottom: 8 }}>
            <span style={{
              background: "rgba(233,30,140,.15)", border: "1px solid rgba(233,30,140,.35)",
              borderRadius: 20, padding: "3px 12px", fontSize: 10, fontWeight: 700,
              color: C.accent, letterSpacing: ".1em", textTransform: "uppercase",
            }}>Panel de Control</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,.45)", fontWeight: 500 }}>
              · {new Date().toLocaleDateString("es-CL", { month: "long", year: "numeric" })} · Prodigio
            </span>
          </div>
          <div className="flex items-start justify-between">
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-.5px", lineHeight: 1.15 }}>
                Bienvenido, {user?.name?.split(" ")[0] ?? "Usuario"}
              </h1>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginTop: 4 }}>
                Prodigio Tech · Plataforma PMO Agéntica
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

          {/* ─── KPI Strip (inside header, navy style) ─── */}
          <div className="prodigio-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 16 }}>
            {[
              { icon: FolderKanban, label: "Total Proyectos", value: totalCount, color: C.accent },
              { icon: Activity, label: "Proyectos Activos", value: activeCount, color: C.teal2 },
              { icon: CheckCircle2, label: "Completados", value: stats?.completed ?? 0, color: C.gold2 },
              { icon: Users, label: "Usuarios", value: stats?.users ?? 0, color: C.blue2 },
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

      {/* ═══ BODY CONTENT ═══ */}
      <div className="prodigio-dashboard-body" style={{ padding: "20px 28px 32px" }}>

        {/* ─── AI Banner ─── */}
        <div className="prodigio-ai-banner" style={{
          borderRadius: 12, padding: "16px 20px", marginBottom: 20,
          background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navy2} 100%)`,
          border: `1px solid ${C.accent}20`,
          display: "flex", alignItems: "center", gap: 16,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: `${C.accent}22`, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Sparkles size={22} style={{ color: C.accent }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Plataforma PMO Agéntica</p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,.55)", marginTop: 2, lineHeight: 1.5 }}>
              Carga una propuesta en PDF y la IA genera el SoW, identifica riesgos y planifica el proyecto automáticamente.
            </p>
          </div>
          {canCreate && (
            <button onClick={() => setOpen(true)} style={{
              background: `${C.accent}15`, border: `1px solid ${C.accent}35`, borderRadius: 8,
              padding: "8px 16px", fontSize: 11, fontWeight: 700, color: C.accent,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
            }}>
              <FileText size={14} /> Nuevo Proyecto
            </button>
          )}
        </div>

        {/* ─── Charts + Recent Projects Grid ─── */}
        <div className="prodigio-dashboard-grid" style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>

          {/* Stage distribution chart */}
          <div style={{
            background: "#fff", borderRadius: 12, padding: "20px",
            border: `1px solid ${C.g200}`, boxShadow: "0 1px 4px rgba(10,22,40,.04)",
          }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
              <BarChart3 size={15} style={{ color: C.accent }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>Proyectos por Etapa</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stageData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.g400 }} axisLine={{ stroke: C.g200 }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: C.g400 }} axisLine={{ stroke: C.g200 }} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${C.g200}`, boxShadow: "0 4px 12px rgba(10,22,40,.08)" }}
                  formatter={(v: any) => [v, "Proyectos"]}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {stageData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Recent projects */}
          <div style={{
            background: "#fff", borderRadius: 12, padding: "20px",
            border: `1px solid ${C.g200}`, boxShadow: "0 1px 4px rgba(10,22,40,.04)",
          }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
              <div className="flex items-center gap-2">
                <Clock size={15} style={{ color: C.accent }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>Proyectos Recientes</span>
              </div>
              <button onClick={() => setLocation("/projects")} style={{
                fontSize: 11, fontWeight: 600, color: C.accent, cursor: "pointer",
                background: "none", border: "none", display: "flex", alignItems: "center", gap: 4,
              }}>
                Ver todos <ArrowRight size={12} />
              </button>
            </div>

            {isLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{ height: 56, background: C.g150, borderRadius: 10, animation: "pulse 1.5s infinite" }} />
                ))}
              </div>
            ) : recentProjects.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <Sparkles size={32} style={{ color: C.g300, margin: "0 auto 8px" }} />
                <p style={{ fontSize: 13, color: C.g400 }}>No hay proyectos aún</p>
                {canCreate && (
                  <button onClick={() => setOpen(true)} style={{
                    marginTop: 12, background: `${C.accent}10`, border: `1px solid ${C.accent}30`,
                    borderRadius: 8, padding: "6px 14px", fontSize: 11, fontWeight: 600, color: C.accent, cursor: "pointer",
                  }}>
                    Crear primer proyecto
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {recentProjects.map((p: any) => {
                  const stage = STAGE_LABELS[p.currentStage] ?? { label: p.currentStage, color: C.g400 };
                  const status = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.activo;
                  const stageIdx = STAGE_ORDER.indexOf(p.currentStage);
                  return (
                    <div
                      key={p.id}
                      onClick={() => setLocation(`/projects/${p.id}`)}
                      className="group"
                      style={{
                        display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                        borderRadius: 10, cursor: "pointer", transition: "background .15s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = C.g100)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Avatar */}
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                        background: `${stage.color}15`, border: `1px solid ${stage.color}30`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 800, color: stage.color,
                      }}>
                        {p.projectName?.charAt(0)?.toUpperCase() ?? "P"}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: C.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {p.projectName}
                        </p>
                        <p style={{ fontSize: 10, color: C.g400, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {p.clientName}
                        </p>
                        {/* Mini pipeline */}
                        <div style={{ display: "flex", gap: 2, marginTop: 5 }}>
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

                      {/* Badges */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                          background: `${stage.color}15`, color: stage.color,
                        }}>{stage.label}</span>
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                          background: status.bg, color: status.color,
                        }}>{status.label}</span>
                        <ArrowRight size={12} style={{ color: C.g300, opacity: 0, transition: "opacity .15s" }}
                          className="group-hover:opacity-100" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ FOOTER ═══ */}
      <div className="prodigio-dashboard-footer" style={{
        background: C.navy2, padding: "12px 36px", display: "flex", justifyContent: "space-between",
        alignItems: "center", borderTop: `1px solid ${C.navy3}`,
      }}>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,.3)" }}>Prodigio Tech · Prodigio · Confidencial</span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,.3)" }}>
          Datos al {new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" })}
        </span>
      </div>

      {/* ═══ CREATE PROJECT DIALOG ═══ */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" style={{ fontFamily: "'Poppins', sans-serif" }}>
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
    </div>
  );
}
