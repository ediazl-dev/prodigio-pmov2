import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  User, Shield, FolderKanban, RefreshCw, Activity, Clock, Calendar,
  CheckCircle2, Eye, FileText, Settings, AlertTriangle, FolderOpen,
  Mail, Briefcase, UserCheck, ChevronRight,
} from "lucide-react";
import { C, headerGradient, cardStyle, headerKpiCard, headerKpiLabel, headerKpiValue, footerStyle, footerText } from "./admin/adminStyles";

/* ── Role permissions matrix ── */
const PERMISSIONS = [
  { label: "Ver Dashboard principal", admin: true, pmo: true, pm: true, consulta: true },
  { label: "Ver PMO Proyectos", admin: true, pmo: true, pm: true, consulta: true },
  { label: "Crear / editar proyectos", admin: true, pmo: true, pm: false, consulta: false },
  { label: "Gestionar etapas (SoW, Riesgos, WBS, etc.)", admin: true, pmo: true, pm: true, consulta: false },
  { label: "Cerrar etapas de proyecto", admin: true, pmo: true, pm: true, consulta: false },
  { label: "Generar documentos (DOCX, PPTX, Excel)", admin: true, pmo: true, pm: true, consulta: false },
  { label: "Análisis agéntico con IA", admin: true, pmo: true, pm: true, consulta: false },
  { label: "Ver Servicios Recurrentes", admin: true, pmo: true, pm: true, consulta: true },
  { label: "Crear / editar servicios recurrentes", admin: true, pmo: true, pm: false, consulta: false },
  { label: "Sincronizar Pipedrive / JIRA", admin: true, pmo: true, pm: true, consulta: false },
  { label: "Ver Avance JIRA", admin: true, pmo: true, pm: true, consulta: true },
  { label: "Dashboard Ejecutivo", admin: true, pmo: true, pm: true, consulta: true },
  { label: "Panel de Usuarios", admin: true, pmo: false, pm: false, consulta: false },
  { label: "Cambiar roles de usuario", admin: true, pmo: false, pm: false, consulta: false },
  { label: "Invitar usuarios", admin: true, pmo: true, pm: false, consulta: false },
  { label: "Gestión financiera", admin: true, pmo: false, pm: false, consulta: false },
  { label: "Plazos por etapa", admin: true, pmo: false, pm: false, consulta: false },
  { label: "Registro de auditoría", admin: true, pmo: false, pm: false, consulta: false },
  { label: "Spaces JIRA", admin: true, pmo: false, pm: false, consulta: false },
  { label: "Plantillas", admin: true, pmo: false, pm: false, consulta: false },
  { label: "Configuración del sistema", admin: true, pmo: false, pm: false, consulta: false },
];

const ROLE_LABELS: Record<string, { label: string; description: string; color: string; bg: string }> = {
  admin: { label: "Administrador", description: "Acceso completo a todas las funcionalidades del sistema, incluyendo gestión de usuarios, configuración y auditoría.", color: "#E91E7B", bg: "rgba(233,30,123,.12)" },
  pmo: { label: "PMO", description: "Gestión de proyectos y servicios recurrentes. Puede crear, editar y cerrar etapas. Acceso a reportes e invitaciones.", color: "#3B8EE8", bg: "rgba(59,142,232,.12)" },
  pm: { label: "Project Manager", description: "Gestiona las etapas, entregables y seguimiento de los proyectos asignados, sin acceso a administración global.", color: "#0E7490", bg: "rgba(14,116,144,.12)" },
  consulta: { label: "Consulta", description: "Acceso de solo lectura. Puede visualizar dashboards, proyectos y reportes sin realizar modificaciones.", color: "#7A8FA8", bg: "rgba(122,143,168,.12)" },
};

const ACTION_LABELS: Record<string, string> = {
  invite_user: "Invitar usuario", update_user_role: "Cambiar rol", update_user_status: "Cambiar estado",
  delete_user: "Eliminar usuario", create_project: "Crear proyecto", update_project: "Actualizar proyecto",
  assign_pm: "Asignar PM", complete_stage: "Completar etapa", update_progress: "Actualizar progreso",
  save: "Guardar", approve: "Aprobar", extract_from_pdf: "Extraer de PDF", download_docx: "Descargar DOCX",
  upload_approval: "Subir aprobación", delete_approval: "Eliminar aprobación", close_stage: "Cerrar etapa",
  upload_pdf: "Subir PDF", generate: "Generar con IA", save_risks: "Guardar riesgos", complete: "Completar",
  save_billing: "Guardar facturación", save_design: "Guardar diseño", save_closure: "Guardar cierre",
  setup_jira: "Configurar Jira", update_deadline: "Actualizar plazo", bulk_update_deadlines: "Actualizar plazos masivo",
  pause_stage: "Pausar etapa", resume_stage: "Reanudar etapa", extend_deadline: "Extender plazo",
  update_role: "Cambiar rol", update_status: "Cambiar estado", delete: "Eliminar",
  invite: "Invitar", resend_invite: "Reenviar invitación", create: "Crear", update: "Actualizar",
  formal_close_stage: "Cierre formal", complete_project: "Completar proyecto",
  extract_pdf: "Extraer PDF", auto_create_jira_issues: "Crear issues JIRA",
  sync_financial_data: "Sincronizar datos financieros",
};

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  user: <User className="h-3.5 w-3.5" />, project: <FolderOpen className="h-3.5 w-3.5" />,
  stage: <Activity className="h-3.5 w-3.5" />, sow: <FileText className="h-3.5 w-3.5" />,
  risks: <AlertTriangle className="h-3.5 w-3.5" />, wbs: <Settings className="h-3.5 w-3.5" />,
  design: <Settings className="h-3.5 w-3.5" />, closure: <Settings className="h-3.5 w-3.5" />,
  jira: <Settings className="h-3.5 w-3.5" />, deadline: <Clock className="h-3.5 w-3.5" />,
};

const ENTITY_LABELS: Record<string, string> = {
  user: "Usuario", project: "Proyecto", stage: "Etapa", sow: "SoW", risks: "Riesgos",
  wbs: "WBS", design: "Avance", closure: "Cierre", jira: "Jira", deadline: "Plazo",
};

function getActionBadge(action: string): { bg: string; color: string } {
  if (action.includes("delete") || action.includes("eliminar")) return { bg: `${C.red}18`, color: C.red };
  if (action.includes("create") || action.includes("invite") || action.includes("generate")) return { bg: `${C.green}18`, color: C.green };
  if (action.includes("update") || action.includes("save") || action.includes("edit")) return { bg: `${C.accent}18`, color: C.accent };
  if (action.includes("approve") || action.includes("complete") || action.includes("close")) return { bg: `${C.teal}18`, color: C.teal };
  if (action.includes("pause") || action.includes("extend")) return { bg: `${C.gold}18`, color: C.gold };
  if (action.includes("download") || action.includes("upload") || action.includes("extract")) return { bg: `${C.blue}18`, color: C.blue };
  return { bg: `${C.g200}`, color: C.g400 };
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatRelative(date: string | Date): string {
  const now = Date.now();
  const d = new Date(date).getTime();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Hace ${days}d`;
  return formatDate(date);
}

export default function MyProfile() {
  const { user: authUser } = useAuth();
  const { data: profile, isLoading } = trpc.profile.me.useQuery(undefined, {
    enabled: !!authUser,
  });

  if (isLoading || !profile) {
    return (
      <div style={{ background: C.g100, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 40, height: 40, border: `3px solid ${C.g200}`, borderTopColor: C.accent, borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ fontSize: 13, color: C.g400 }}>Cargando perfil...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  const { user, stats, recentActivity } = profile;
  const role = user.role as string;
  const roleInfo = ROLE_LABELS[role] ?? ROLE_LABELS.consulta;
  const userPermissions = PERMISSIONS.filter(p => p[role as keyof typeof p] === true);
  const initials = (user.name || "U").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="prodigio-profile" style={{ background: C.g100, fontFamily: "'Poppins', system-ui, sans-serif", color: C.navy, minHeight: "100vh", width: "100%", minWidth: 0 }}>
      {/* ── HEADER ── */}
      <div className="prodigio-profile-hero" style={{ ...headerGradient, padding: "32px 36px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          {/* Avatar */}
          <div style={{
            width: 72, height: 72, borderRadius: 20,
            background: `linear-gradient(135deg, ${roleInfo.color}40, ${roleInfo.color}20)`,
            border: `2px solid ${roleInfo.color}60`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, fontWeight: 800, color: roleInfo.color, flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ background: "rgba(233,30,140,.15)", border: "1px solid rgba(233,30,140,.35)", borderRadius: 20, padding: "3px 12px", fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: ".1em", textTransform: "uppercase" }}>MI PERFIL</span>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-.5px", marginTop: 8 }}>
              {user.name || "Usuario"}
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 6, flexWrap: "wrap" }}>
              {user.email && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "rgba(255,255,255,.5)" }}>
                  <Mail className="h-3.5 w-3.5" /> {user.email}
                </span>
              )}
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 10,
                background: roleInfo.bg, color: roleInfo.color, border: `1px solid ${roleInfo.color}30`,
              }}>
                {roleInfo.label}
              </span>
            </div>
          </div>
        </div>
        {/* KPI Strip */}
        <div className="prodigio-profile-kpis" style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
          <div style={headerKpiCard}>
            <div style={headerKpiLabel}>Proyectos como PM</div>
            <div style={headerKpiValue}>{stats.pmProjectCount}</div>
          </div>
          <div style={headerKpiCard}>
            <div style={headerKpiLabel}>Proyectos Activos</div>
            <div style={headerKpiValue}>{stats.activeProjectCount}</div>
          </div>
          <div style={headerKpiCard}>
            <div style={headerKpiLabel}>Servicios Recurrentes</div>
            <div style={headerKpiValue}>{stats.recurringServiceCount}</div>
          </div>
          <div style={headerKpiCard}>
            <div style={headerKpiLabel}>Acciones Registradas</div>
            <div style={headerKpiValue}>{stats.totalActivity}</div>
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="prodigio-profile-body" style={{ padding: "28px 36px", display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
        {/* Two-column layout */}
        <div className="prodigio-profile-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20, minWidth: 0 }}>
          {/* Left: User Info + Role Description */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* User Information Card */}
            <div style={{ ...cardStyle, padding: "20px 24px" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <User className="h-4 w-4" style={{ color: C.accent }} /> Información Personal
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { icon: <User className="h-4 w-4" />, label: "Nombre", value: user.name || "No definido" },
                  { icon: <Mail className="h-4 w-4" />, label: "Email", value: user.email || "No definido" },
                  { icon: <Shield className="h-4 w-4" />, label: "Rol", value: roleInfo.label },
                  { icon: <UserCheck className="h-4 w-4" />, label: "Estado", value: user.status === "activo" ? "Activo" : user.status === "invitado" ? "Invitado" : "Desactivado" },
                  { icon: <Calendar className="h-4 w-4" />, label: "Miembro desde", value: formatDate(user.createdAt) },
                  { icon: <Clock className="h-4 w-4" />, label: "Último acceso", value: formatDate(user.lastSignedIn) },
                  { icon: <Briefcase className="h-4 w-4" />, label: "Método de login", value: user.loginMethod || "OAuth" },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: i < 6 ? `1px solid ${C.g100}` : "none" }}>
                    <span style={{ color: C.g400, flexShrink: 0 }}>{item.icon}</span>
                    <span style={{ fontSize: 11, color: C.g400, width: 110, flexShrink: 0 }}>{item.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Role Description Card */}
            <div style={{ ...cardStyle, padding: "20px 24px" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <Shield className="h-4 w-4" style={{ color: roleInfo.color }} /> Tu Rol: {roleInfo.label}
              </h3>
              <div style={{
                background: roleInfo.bg, borderRadius: 10, padding: "14px 16px",
                border: `1px solid ${roleInfo.color}20`, marginBottom: 16,
              }}>
                <p style={{ fontSize: 13, color: C.navy, lineHeight: 1.6, margin: 0 }}>{roleInfo.description}</p>
              </div>
              <div style={{ fontSize: 11, color: C.g400 }}>
                <p style={{ margin: 0 }}>Tienes acceso a <strong style={{ color: C.navy }}>{userPermissions.length}</strong> de {PERMISSIONS.length} funcionalidades del sistema.</p>
              </div>
            </div>
          </div>

          {/* Right: Permissions Matrix */}
          <div style={{ ...cardStyle, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.g200}` }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
                <CheckCircle2 className="h-4 w-4" style={{ color: C.green }} /> Matriz de Permisos por Rol
              </h3>
              <p style={{ fontSize: 11, color: C.g400, marginTop: 4 }}>Tu rol actual está resaltado</p>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: C.g400, padding: "10px 14px", borderBottom: `1px solid ${C.g200}`, textAlign: "left" }}>Funcionalidad</th>
                    {Object.entries(ROLE_LABELS).map(([key, info]) => (
                      <th key={key} style={{
                        fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em",
                        padding: "10px 14px", borderBottom: `1px solid ${C.g200}`, textAlign: "center",
                        color: key === role ? info.color : C.g400,
                        background: key === role ? `${info.color}08` : "transparent",
                      }}>{info.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSIONS.map((perm, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: 12, color: C.navy, padding: "8px 14px", borderBottom: `1px solid ${C.g100}` }}>{perm.label}</td>
                      {["admin", "pmo", "pm", "consulta"].map(r => {
                        const hasAccess = perm[r as keyof typeof perm] as boolean;
                        const isCurrentRole = r === role;
                        return (
                          <td key={r} style={{
                            textAlign: "center", padding: "8px 14px", borderBottom: `1px solid ${C.g100}`,
                            background: isCurrentRole ? `${ROLE_LABELS[r].color}06` : "transparent",
                          }}>
                            {hasAccess ? (
                              <CheckCircle2 className="h-4 w-4" style={{ color: isCurrentRole ? ROLE_LABELS[r].color : C.green, margin: "0 auto" }} />
                            ) : (
                              <span style={{ display: "inline-block", width: 16, height: 16, borderRadius: "50%", border: `1.5px solid ${C.g200}`, margin: "0 auto" }} />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div style={{ ...cardStyle, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.g200}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
              <Activity className="h-4 w-4" style={{ color: C.accent }} /> Actividad Reciente
            </h3>
            <span style={{ fontSize: 10, color: C.g400 }}>Últimas 20 acciones</span>
          </div>
          {recentActivity.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center" }}>
              <Activity className="h-8 w-8" style={{ color: C.g200, margin: "0 auto 12px" }} />
              <p style={{ fontSize: 13, color: C.g400 }}>No hay actividad registrada aún</p>
            </div>
          ) : (
            <div style={{ maxHeight: 400, overflowY: "auto" }}>
              {recentActivity.map((log: any, i: number) => {
                const ab = getActionBadge(log.action);
                return (
                  <div key={log.id} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 20px",
                    borderBottom: i < recentActivity.length - 1 ? `1px solid ${C.g100}` : "none",
                    transition: "background .15s",
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.g100)}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <span style={{ color: C.g400, flexShrink: 0 }}>
                      {ENTITY_ICONS[log.entity] || <Activity className="h-3.5 w-3.5" />}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: ab.bg, color: ab.color }}>
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                        <span style={{ fontSize: 12, color: C.navy }}>
                          {ENTITY_LABELS[log.entity] || log.entity}
                          {log.entityName && <span style={{ color: C.g400 }}> — {log.entityName}</span>}
                        </span>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: C.g400, flexShrink: 0, fontFamily: "monospace" }}>
                      {formatRelative(log.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div className="prodigio-profile-footer" style={footerStyle}>
        <span style={footerText}>Prodigio PMO — Mi Perfil</span>
        <span style={footerText}>{new Date().getFullYear()}</span>
      </div>
    </div>
  );
}
