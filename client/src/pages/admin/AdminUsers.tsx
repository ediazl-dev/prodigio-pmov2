import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle, CheckCircle2, Clock, Copy, Mail, MoreVertical, Plus, RefreshCw,
  Search, Shield, Trash2, UserCheck, UserMinus, Users, XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { C, headerGradient, cardStyle, headerKpiCard, headerKpiLabel, headerKpiValue, footerStyle, footerText } from "./adminStyles";

const ROLE_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  admin: { label: "Admin", bg: "rgba(184,50,50,.12)", color: C.red },
  pmo: { label: "PMO", bg: "rgba(59,142,232,.12)", color: C.accent },
  pm: { label: "PM", bg: "rgba(14,116,144,.12)", color: "#0E7490" },
  consulta: { label: "Consulta", bg: `${C.g200}88`, color: C.g400 },
};

const STATUS_CFG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  activo: { label: "Activo", icon: CheckCircle2, color: C.green },
  invitado: { label: "Invitado", icon: Clock, color: C.gold },
  desactivado: { label: "Desactivado", icon: XCircle, color: C.red },
};

export default function AdminUsers() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", role: "pmo" as "pmo" | "pm" | "consulta" });
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"users" | "invitations">("users");

  const { data: users, refetch: refetchUsers } = trpc.users.list.useQuery();
  const { data: pendingInvitations, refetch: refetchInvitations } = trpc.users.listInvitations.useQuery();

  const updateRoleMutation = trpc.users.updateRole.useMutation({
    onSuccess: () => { toast.success("Rol actualizado correctamente"); refetchUsers(); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateStatusMutation = trpc.users.updateStatus.useMutation({
    onSuccess: () => { toast.success("Estado actualizado"); refetchUsers(); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMutation = trpc.users.delete.useMutation({
    onSuccess: () => { toast.success("Usuario eliminado"); setDeleteConfirm(null); refetchUsers(); },
    onError: (e: any) => toast.error(e.message),
  });
  const inviteMutation = trpc.users.invite.useMutation({
    onSuccess: (data) => {
      toast.success("Invitación enviada");
      setLastInviteUrl(data.inviteUrl);
      setInviteForm({ name: "", email: "", role: "pmo" });
      refetchUsers(); refetchInvitations();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const resendInviteMutation = trpc.users.resendInvitation.useMutation({
    onSuccess: (data) => { toast.success("Nueva invitación enviada"); setLastInviteUrl(data.inviteUrl); refetchInvitations(); },
    onError: (e: any) => toast.error(e.message),
  });

  const handleInvite = () => {
    if (!inviteForm.name.trim() || !inviteForm.email.trim()) { toast.error("Nombre y correo son requeridos"); return; }
    inviteMutation.mutate({ ...inviteForm, origin: window.location.origin });
  };

  const filtered = (users ?? []).filter((u: any) =>
    !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
  );
  const activeCount = (users ?? []).filter((u: any) => u.status === "activo").length;
  const invitedCount = (users ?? []).filter((u: any) => u.status === "invitado").length;

  return (
    <div style={{ background: C.g100, fontFamily: "'Inter', sans-serif", color: C.navy, minHeight: "100vh" }}>
      {/* ── HEADER ── */}
      <div style={{ ...headerGradient, padding: "32px 36px 28px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <span style={{ background: "rgba(59,142,232,.15)", border: "1px solid rgba(59,142,232,.35)", borderRadius: 20, padding: "3px 12px", fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: ".1em", textTransform: "uppercase" }}>
              ADMINISTRACIÓN
            </span>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-.5px", marginTop: 8 }}>
              Gestión de Usuarios
            </h1>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginTop: 4 }}>
              Control de acceso y roles de la plataforma PMO
            </p>
          </div>
          <Button onClick={() => setInviteOpen(true)} style={{ background: C.accent, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 12, padding: "8px 18px", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus className="h-4 w-4" /> Invitar Usuario
          </Button>
        </div>

        {/* KPI strip */}
        <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
          {[
            { label: "Total", value: users?.length ?? 0 },
            { label: "Activos", value: activeCount },
            { label: "Invitados", value: invitedCount },
            { label: "Pendientes", value: pendingInvitations?.length ?? 0 },
          ].map((k) => (
            <div key={k.label} style={headerKpiCard}>
              <div style={headerKpiLabel}>{k.label}</div>
              <div style={headerKpiValue}>{k.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ padding: "28px 36px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: `2px solid ${C.g200}`, marginBottom: 20 }}>
          {[
            { id: "users" as const, label: `Usuarios (${users?.length ?? 0})`, icon: <Users className="h-4 w-4" /> },
            { id: "invitations" as const, label: `Invitaciones (${pendingInvitations?.length ?? 0})`, icon: <Mail className="h-4 w-4" /> },
          ].map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding: "10px 20px", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6,
              background: "none", border: "none", cursor: "pointer",
              borderBottom: activeTab === t.id ? `3px solid ${C.accent}` : "3px solid transparent",
              color: activeTab === t.id ? C.accent : C.g400,
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {activeTab === "users" && (
          <>
            {/* Search */}
            <div style={{ position: "relative", marginBottom: 16 }}>
              <Search className="h-4 w-4" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.g400 }} />
              <input
                placeholder="Buscar por nombre o correo..."
                value={search} onChange={(e) => setSearch(e.target.value)}
                style={{ width: "100%", padding: "10px 10px 10px 36px", borderRadius: 8, border: `1px solid ${C.g200}`, fontSize: 12, fontFamily: "'Inter', sans-serif", background: "#fff", color: C.navy, outline: "none" }}
              />
            </div>

            {/* User list */}
            <div style={{ ...cardStyle, overflow: "hidden" }}>
              {filtered.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 0", color: C.g400 }}>
                  <Users className="h-8 w-8" style={{ margin: "0 auto 8px", opacity: .3 }} />
                  <p style={{ fontSize: 13 }}>No se encontraron usuarios</p>
                </div>
              ) : filtered.map((u: any, i: number) => {
                const rc = ROLE_LABELS[u.role] ?? ROLE_LABELS.consulta;
                const sc = STATUS_CFG[u.status] ?? STATUS_CFG.activo;
                const StatusIcon = sc.icon;
                const isMe = u.id === (user as any)?.id;
                return (
                  <div key={u.id} style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
                    borderBottom: i < filtered.length - 1 ? `1px solid ${C.g100}` : "none",
                    transition: "background .15s",
                  }} onMouseEnter={(e) => (e.currentTarget.style.background = C.g100)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    {/* Avatar */}
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: `${C.accent}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: C.accent }}>{u.name?.charAt(0)?.toUpperCase() ?? "U"}</span>
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{u.name ?? "Sin nombre"}</span>
                        {isMe && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 10, background: `${C.accent}18`, color: C.accent }}>Tú</span>}
                      </div>
                      <p style={{ fontSize: 11, color: C.g400, marginTop: 1 }}>{u.email ?? "Sin email"}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
                        <StatusIcon className="h-3 w-3" style={{ color: sc.color }} />
                        <span style={{ fontSize: 10, fontWeight: 600, color: sc.color }}>{sc.label}</span>
                      </div>
                    </div>
                    {/* Role badge */}
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 10, background: rc.bg, color: rc.color, flexShrink: 0 }}>
                      {rc.label}
                    </span>
                    {/* Actions */}
                    {!isMe && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <div className="px-2 py-1.5"><p className="text-xs font-semibold text-muted-foreground">Cambiar Rol</p></div>
                          {(["admin", "pmo", "pm", "consulta"] as const).map((r) => (
                            <DropdownMenuItem key={r} onClick={() => updateRoleMutation.mutate({ userId: u.id, role: r })} className={u.role === r ? "bg-accent" : ""}>
                              <Shield className="mr-2 h-3.5 w-3.5" />{ROLE_LABELS[r]?.label ?? r}{u.role === r && " ✓"}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <div className="px-2 py-1.5"><p className="text-xs font-semibold text-muted-foreground">Estado</p></div>
                          {u.status !== "activo" && (
                            <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ userId: u.id, status: "activo" })}>
                              <UserCheck className="mr-2 h-3.5 w-3.5 text-emerald-600" />Activar Usuario
                            </DropdownMenuItem>
                          )}
                          {u.status !== "desactivado" && (
                            <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ userId: u.id, status: "desactivado" })} className="text-amber-600 focus:text-amber-600">
                              <UserMinus className="mr-2 h-3.5 w-3.5" />Desactivar Usuario
                            </DropdownMenuItem>
                          )}
                          {u.status !== "activo" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => resendInviteMutation.mutate({ userId: u.id, origin: window.location.origin })} disabled={resendInviteMutation.isPending} className="text-primary focus:text-primary">
                                <RefreshCw className="mr-2 h-3.5 w-3.5" />Reenviar Invitación
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setDeleteConfirm({ id: u.id, name: u.name ?? "este usuario" })} className="text-destructive focus:text-destructive">
                            <Trash2 className="mr-2 h-3.5 w-3.5" />Eliminar Usuario
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {activeTab === "invitations" && (
          <div style={{ ...cardStyle, overflow: "hidden" }}>
            {(pendingInvitations ?? []).length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: C.g400 }}>
                <Mail className="h-8 w-8" style={{ margin: "0 auto 8px", opacity: .3 }} />
                <p style={{ fontSize: 13 }}>No hay invitaciones pendientes</p>
                <button onClick={() => setInviteOpen(true)} style={{ marginTop: 12, fontSize: 12, fontWeight: 600, color: C.accent, background: "none", border: `1px solid ${C.accent}`, borderRadius: 8, padding: "6px 16px", cursor: "pointer" }}>
                  Enviar primera invitación
                </button>
              </div>
            ) : (pendingInvitations ?? []).map((inv: any, i: number) => {
              const rc = ROLE_LABELS[inv.role] ?? ROLE_LABELS.consulta;
              const expiresAt = new Date(inv.expiresAt);
              const isExpired = expiresAt < new Date();
              const hoursLeft = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 3600000));
              const inviteUrl = `${window.location.origin}/invite/${inv.token}`;
              return (
                <div key={inv.id} style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
                  borderBottom: i < (pendingInvitations ?? []).length - 1 ? `1px solid ${C.g100}` : "none",
                }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: `${C.gold}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Mail className="h-4 w-4" style={{ color: C.gold }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{inv.name}</p>
                    <p style={{ fontSize: 11, color: C.g400 }}>{inv.email}</p>
                    <p style={{ fontSize: 10, marginTop: 2, color: isExpired ? C.red : C.gold }}>{isExpired ? "Expirada" : `Expira en ${hoursLeft}h`}</p>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 10, background: rc.bg, color: rc.color, flexShrink: 0 }}>{rc.label}</span>
                  <button onClick={() => { navigator.clipboard.writeText(inviteUrl); toast.success("Enlace copiado"); }}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }} title="Copiar enlace">
                    <Copy className="h-3.5 w-3.5" style={{ color: C.g400 }} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── FOOTER ── */}
      <div style={footerStyle}>
        <span style={footerText}>Prodigio PMO — Gestión de Usuarios</span>
        <span style={footerText}>{new Date().getFullYear()}</span>
      </div>

      {/* ── INVITE DIALOG ── */}
      <Dialog open={inviteOpen} onOpenChange={(o) => { setInviteOpen(o); if (!o) setLastInviteUrl(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Mail className="h-5 w-5" style={{ color: C.accent }} />Invitar Nuevo Usuario</DialogTitle>
          </DialogHeader>
          {lastInviteUrl ? (
            <div className="space-y-4 mt-2">
              <div style={{ borderRadius: 10, padding: 14, background: `${C.green}12`, border: `1px solid ${C.green}30`, display: "flex", alignItems: "flex-start", gap: 10 }}>
                <CheckCircle2 className="h-5 w-5" style={{ color: C.green, flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: C.green }}>¡Invitación enviada!</p>
                  <p style={{ fontSize: 11, color: C.g400, marginTop: 4 }}>Se envió un correo con el enlace de acceso. También puedes compartir el enlace directamente:</p>
                </div>
              </div>
              <div style={{ ...cardStyle, padding: 12 }}>
                <p style={{ fontSize: 10, color: C.g400, fontWeight: 600, marginBottom: 6 }}>Enlace de invitación:</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <code style={{ fontSize: 11, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", background: C.g100, borderRadius: 6, padding: "6px 10px", border: `1px solid ${C.g200}` }}>{lastInviteUrl}</code>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(lastInviteUrl); toast.success("Enlace copiado"); }}><Copy className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="outline" className="flex-1" onClick={() => setLastInviteUrl(null)}><RefreshCw className="h-4 w-4 mr-2" />Invitar otro</Button>
                <Button className="flex-1" onClick={() => { setInviteOpen(false); setLastInviteUrl(null); }}>Cerrar</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 mt-2">
              <div className="space-y-1.5"><Label>Nombre completo *</Label><Input placeholder="ej. María González" value={inviteForm.name} onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Correo electrónico *</Label><Input type="email" placeholder="usuario@prodigio.tech" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} onKeyDown={(e) => e.key === "Enter" && handleInvite()} /></div>
              <div className="space-y-1.5">
                <Label>Rol en la plataforma</Label>
                <Select value={inviteForm.role} onValueChange={(v) => setInviteForm({ ...inviteForm, role: v as "pmo" | "pm" | "consulta" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pmo">PMO — Gestión de portafolio y proyectos</SelectItem>
                    <SelectItem value="pm">PM — Gestión de proyectos asignados</SelectItem>
                    <SelectItem value="consulta">Consulta — Solo lectura</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div style={{ borderRadius: 10, padding: 12, background: C.g100, border: `1px solid ${C.g200}` }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: C.navy, marginBottom: 8 }}>Permisos por rol:</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: C.g400 }}>
                  <div><span style={{ fontWeight: 700, color: C.red }}>Admin</span> — Acceso total: configuración, usuarios, proyectos y reportes</div>
                  <div><span style={{ fontWeight: 700, color: C.accent }}>PMO</span> — Crear, gestionar y avanzar proyectos. Sin acceso a configuración</div>
                  <div><span style={{ fontWeight: 700, color: "#0E7490" }}>PM</span> — Gestionar las etapas y entregables de proyectos asignados</div>
                  <div><span style={{ fontWeight: 700, color: C.g400 }}>Consulta</span> — Dashboard y vista de proyectos en modo lectura</div>
                </div>
              </div>
              <div style={{ borderRadius: 10, padding: 12, background: C.g100, border: `1px solid ${C.g200}`, display: "flex", alignItems: "flex-start", gap: 8 }}>
                <Mail className="h-4 w-4" style={{ color: C.accent, marginTop: 2, flexShrink: 0 }} />
                <p style={{ fontSize: 11, color: C.g400 }}>Se enviará un correo con un enlace de invitación válido por <strong>48 horas</strong>. El usuario deberá hacer clic en el enlace para activar su cuenta.</p>
              </div>
              <Button className="w-full" onClick={handleInvite} disabled={inviteMutation.isPending} style={{ background: C.accent, color: "#fff" }}>
                {inviteMutation.isPending ? <><span className="animate-spin mr-2">⟳</span>Enviando invitación...</> : <><Mail className="h-4 w-4 mr-2" />Enviar Invitación</>}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── DELETE DIALOG ── */}
      <Dialog open={!!deleteConfirm} onOpenChange={(o) => { if (!o) setDeleteConfirm(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />Eliminar Usuario</DialogTitle>
            <DialogDescription>¿Estás seguro de que deseas eliminar a <strong>{deleteConfirm?.name}</strong>? Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && deleteMutation.mutate({ userId: deleteConfirm.id })} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? <><span className="animate-spin mr-2">⟳</span>Eliminando...</> : <><Trash2 className="h-4 w-4 mr-2" />Eliminar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
