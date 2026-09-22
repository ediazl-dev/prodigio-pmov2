import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Shield, Search, ChevronLeft, ChevronRight, Calendar, User, Activity,
  FileText, Settings, FolderOpen, AlertTriangle, Clock, Filter, X, Eye, Download,
} from "lucide-react";
import { C, headerGradient, cardStyle, headerKpiCard, headerKpiLabel, headerKpiValue, thStyle, tdStyle, footerStyle, footerText } from "./adminStyles";

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
  executive_evidence_discarded: "Descartar evidencia", executive_evidence_restored: "Restaurar evidencia",
};
const ENTITY_LABELS: Record<string, string> = {
  user: "Usuario", project: "Proyecto", stage: "Etapa", sow: "SoW", risks: "Riesgos",
  wbs: "WBS", design: "Avance", closure: "Cierre", jira: "Jira", deadline: "Plazo", extension: "Extensión",
  executive_evidence_upload: "Evidencia documental",
};
const ENTITY_ICONS: Record<string, React.ReactNode> = {
  user: <User className="h-3.5 w-3.5" />, project: <FolderOpen className="h-3.5 w-3.5" />,
  stage: <Activity className="h-3.5 w-3.5" />, sow: <FileText className="h-3.5 w-3.5" />,
  risks: <AlertTriangle className="h-3.5 w-3.5" />, wbs: <Settings className="h-3.5 w-3.5" />,
  design: <Settings className="h-3.5 w-3.5" />, closure: <Settings className="h-3.5 w-3.5" />,
  jira: <Settings className="h-3.5 w-3.5" />, deadline: <Clock className="h-3.5 w-3.5" />,
  extension: <Clock className="h-3.5 w-3.5" />,
  executive_evidence_upload: <FileText className="h-3.5 w-3.5" />,
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
  return new Date(date).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function formatDetails(details: any): string {
  if (!details) return "-";
  if (typeof details === "string") { try { details = JSON.parse(details); } catch { return details; } }
  const entries = Object.entries(details);
  if (entries.length === 0) return "-";
  return entries.map(([key, value]) => {
    if (value === null || value === undefined) return null;
    const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
    return `${label}: ${typeof value === "object" ? JSON.stringify(value) : value}`;
  }).filter(Boolean).join(" | ");
}

export default function AdminAuditLog() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [isExporting, setIsExporting] = useState(false);

  const queryInput = useMemo(() => ({
    page, pageSize,
    ...(actionFilter ? { action: actionFilter } : {}),
    ...(entityFilter ? { entity: entityFilter } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
  }), [page, pageSize, actionFilter, entityFilter, dateFrom, dateTo]);

  const { data, isLoading } = trpc.audit.list.useQuery(queryInput);
  const { data: stats } = trpc.audit.stats.useQuery();

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  const filteredLogs = useMemo(() => {
    if (!searchText) return logs;
    const lower = searchText.toLowerCase();
    return logs.filter((log: any) =>
      (log.userName || "").toLowerCase().includes(lower) || (log.action || "").toLowerCase().includes(lower) ||
      (log.entity || "").toLowerCase().includes(lower) || (formatDetails(log.details) || "").toLowerCase().includes(lower)
    );
  }, [logs, searchText]);

  const hasFilters = actionFilter || entityFilter || dateFrom || dateTo || searchText;
  const clearFilters = () => { setActionFilter(""); setEntityFilter(""); setSearchText(""); setDateFrom(""); setDateTo(""); setPage(1); };

  const uniqueActions = stats ? Object.keys(stats.actionCounts).sort() : [];
  const uniqueEntities = stats ? Object.keys(stats.entityCounts).sort() : [];

  const exportQuery = trpc.audit.exportCsv.useQuery(
    { action: actionFilter || undefined, entity: entityFilter || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined },
    { enabled: isExporting }
  );

  useEffect(() => {
    if (isExporting && exportQuery.data) {
      const blob = new Blob([exportQuery.data.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setIsExporting(false);
    }
  }, [isExporting, exportQuery.data]);

  const handleExportCsv = () => {
    setIsExporting(true);
  };

  return (
    <div style={{ background: C.g100, fontFamily: "'Inter', sans-serif", color: C.navy, minHeight: "100vh" }}>
      {/* ── HEADER ── */}
      <div style={{ ...headerGradient, padding: "32px 36px 28px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <span style={{ background: "rgba(59,142,232,.15)", border: "1px solid rgba(59,142,232,.35)", borderRadius: 20, padding: "3px 12px", fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: ".1em", textTransform: "uppercase" }}>ADMINISTRACIÓN</span>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-.5px", marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
              <Shield className="h-6 w-6" style={{ color: C.accent }} /> Registro de Auditoría
            </h1>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginTop: 4 }}>Historial completo de todas las acciones realizadas en el sistema</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "4px 12px", borderRadius: 10, background: "rgba(255,255,255,.1)", color: "rgba(255,255,255,.6)", border: "1px solid rgba(255,255,255,.15)" }}>{total} registros</span>
            <button onClick={handleExportCsv} disabled={isExporting}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", transition: "background .15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.12)")}>
              <Download className="h-3.5 w-3.5" /> {isExporting ? "Exportando..." : "Exportar CSV"}
            </button>
          </div>
        </div>
        {stats && (
          <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
            {Object.entries(stats.actionCounts).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 4).map(([action, count]) => (
              <div key={action} style={headerKpiCard}>
                <div style={headerKpiLabel}>{ACTION_LABELS[action] || action}</div>
                <div style={headerKpiValue}>{count as number}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── BODY ── */}
      <div style={{ padding: "28px 36px", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Stats cards */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {[
              { title: "Acciones más frecuentes", data: stats.actionCounts, labelMap: ACTION_LABELS },
              { title: "Por entidad", data: stats.entityCounts, labelMap: ENTITY_LABELS },
              { title: "Usuarios más activos", data: stats.userCounts, labelMap: {} as Record<string, string> },
            ].map((section) => (
              <div key={section.title} style={{ ...cardStyle, padding: "16px 20px" }}>
                <h4 style={{ fontSize: 11, fontWeight: 700, color: C.g400, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 12 }}>{section.title}</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {Object.entries(section.data).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 5).map(([key, count]) => (
                    <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ color: C.navy }}>{section.labelMap[key] || key}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 8px", borderRadius: 8, background: C.g100, color: C.g400 }}>{count as number}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div style={{ ...cardStyle, padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: C.navy, display: "flex", alignItems: "center", gap: 6 }}><Filter className="h-4 w-4" /> Filtros</h4>
            {hasFilters && (
              <button onClick={clearFilters} style={{ fontSize: 11, color: C.g400, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <X className="h-3.5 w-3.5" /> Limpiar filtros
              </button>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 10 }}>
            <div style={{ position: "relative" }}>
              <Search className="h-4 w-4" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.g400 }} />
              <input placeholder="Buscar..." value={searchText} onChange={(e) => setSearchText(e.target.value)}
                style={{ width: "100%", padding: "8px 8px 8px 32px", borderRadius: 6, border: `1px solid ${C.g200}`, fontSize: 12, fontFamily: "'Inter', sans-serif", background: "#fff", color: C.navy, outline: "none" }} />
            </div>
            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Acción" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las acciones</SelectItem>
                {uniqueActions.map((a) => <SelectItem key={a} value={a}>{ACTION_LABELS[a] || a}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Entidad" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las entidades</SelectItem>
                {uniqueEntities.map((e) => <SelectItem key={e} value={e}>{ENTITY_LABELS[e] || e}</SelectItem>)}
              </SelectContent>
            </Select>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Calendar className="h-4 w-4" style={{ color: C.g400, flexShrink: 0 }} />
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="text-xs" />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Calendar className="h-4 w-4" style={{ color: C.g400, flexShrink: 0 }} />
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="text-xs" />
            </div>
          </div>
        </div>

        {/* Table */}
        <div style={{ ...cardStyle, overflow: "hidden" }}>
          <div style={{ padding: "12px 20px", borderBottom: `1px solid ${C.g200}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: C.g400 }}>Mostrando {filteredLogs.length} de {total} registros{hasFilters && " (filtrado)"}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <span style={{ fontSize: 12, color: C.g400 }}>Página {page} de {totalPages || 1}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 150 }}>Fecha y Hora</th>
                  <th style={{ ...thStyle, width: 130 }}>Usuario</th>
                  <th style={{ ...thStyle, width: 70 }}>Rol</th>
                  <th style={{ ...thStyle, width: 150 }}>Acción</th>
                  <th style={{ ...thStyle, width: 90 }}>Entidad</th>
                  <th style={{ ...thStyle, width: 50 }}>ID</th>
                  <th style={thStyle}>Detalles</th>
                  <th style={{ ...thStyle, width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={8} style={{ ...tdStyle, textAlign: "center", padding: "32px 0", color: C.g400 }}>Cargando registros de auditoría...</td></tr>
                ) : filteredLogs.length === 0 ? (
                  <tr><td colSpan={8} style={{ ...tdStyle, textAlign: "center", padding: "32px 0", color: C.g400 }}>No se encontraron registros</td></tr>
                ) : filteredLogs.map((log: any) => {
                  const ab = getActionBadge(log.action);
                  return (
                    <tr key={log.id} style={{ transition: "background .15s" }} onMouseEnter={(e) => (e.currentTarget.style.background = C.g100)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                      <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11, color: C.g400 }}>{formatDate(log.createdAt)}</td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <User className="h-3.5 w-3.5" style={{ color: C.g400 }} />
                          <span style={{ fontSize: 12, fontWeight: 600, maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.userName || "Sistema"}</span>
                        </div>
                      </td>
                      <td style={tdStyle}><span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 6, border: `1px solid ${C.g200}`, textTransform: "capitalize" }}>{log.userRole || "-"}</span></td>
                      <td style={tdStyle}><span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: ab.bg, color: ab.color, display: "inline-block" }}>{ACTION_LABELS[log.action] || log.action}</span></td>
                      <td style={tdStyle}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                          {ENTITY_ICONS[log.entity] || <Activity className="h-3.5 w-3.5" />}
                          {ENTITY_LABELS[log.entity] || log.entity}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11, color: C.g400 }}>{log.entityId || "-"}</td>
                      <td style={{ ...tdStyle, maxWidth: 280 }}>
                        <span style={{ fontSize: 11, color: C.g400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{formatDetails(log.details)}</span>
                      </td>
                      <td style={tdStyle}>
                        <button onClick={() => setSelectedLog(log)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                          <Eye className="h-3.5 w-3.5" style={{ color: C.g400 }} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Pagination */}
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(1)}>Primera</Button>
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const startPage = Math.max(1, Math.min(page - 2, totalPages - 4));
              const p = startPage + i;
              if (p > totalPages) return null;
              return (
                <Button key={p} variant={p === page ? "default" : "outline"} size="sm" onClick={() => setPage(p)}
                  style={p === page ? { background: C.accent, color: "#fff" } : {}}>
                  {p}
                </Button>
              );
            })}
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>Última</Button>
          </div>
        )}
      </div>

      {/* ── FOOTER ── */}
      <div style={footerStyle}>
        <span style={footerText}>Prodigio PMO — Registro de Auditoría</span>
        <span style={footerText}>{new Date().getFullYear()}</span>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Shield className="h-5 w-5" style={{ color: C.accent }} />Detalle de Auditoría</DialogTitle>
            <DialogDescription>Registro #{selectedLog?.id}</DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <Separator />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 13 }}>
                <div><p style={{ fontSize: 10, color: C.g400, marginBottom: 4 }}>Fecha y Hora</p><p style={{ fontWeight: 600 }}>{formatDate(selectedLog.createdAt)}</p></div>
                <div><p style={{ fontSize: 10, color: C.g400, marginBottom: 4 }}>Usuario</p><p style={{ fontWeight: 600 }}>{selectedLog.userName || "Sistema"}</p></div>
                <div><p style={{ fontSize: 10, color: C.g400, marginBottom: 4 }}>Rol</p><Badge variant="outline" className="capitalize">{selectedLog.userRole || "-"}</Badge></div>
                <div>
                  <p style={{ fontSize: 10, color: C.g400, marginBottom: 4 }}>Acción</p>
                  {(() => { const ab = getActionBadge(selectedLog.action); return <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: ab.bg, color: ab.color }}>{ACTION_LABELS[selectedLog.action] || selectedLog.action}</span>; })()}
                </div>
                <div>
                  <p style={{ fontSize: 10, color: C.g400, marginBottom: 4 }}>Entidad</p>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>{ENTITY_ICONS[selectedLog.entity] || <Activity className="h-4 w-4" />}{ENTITY_LABELS[selectedLog.entity] || selectedLog.entity}</span>
                </div>
                <div><p style={{ fontSize: 10, color: C.g400, marginBottom: 4 }}>ID Entidad</p><p style={{ fontFamily: "monospace" }}>{selectedLog.entityId || "-"}</p></div>
              </div>
              <Separator />
              <div>
                <p style={{ fontSize: 10, color: C.g400, marginBottom: 8 }}>Detalles completos</p>
                <div style={{ background: C.g100, borderRadius: 8, padding: 12, fontSize: 12, fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 200, overflowY: "auto" }}>
                  {selectedLog.details ? JSON.stringify(typeof selectedLog.details === "string" ? JSON.parse(selectedLog.details) : selectedLog.details, null, 2) : "Sin detalles adicionales"}
                </div>
              </div>
              {selectedLog.ipAddress && (
                <div><p style={{ fontSize: 10, color: C.g400, marginBottom: 4 }}>Dirección IP</p><p style={{ fontFamily: "monospace", fontSize: 12 }}>{selectedLog.ipAddress}</p></div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
