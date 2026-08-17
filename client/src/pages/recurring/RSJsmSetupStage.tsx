import AppBreadcrumb from "@/components/AppBreadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft, CheckCircle2, ExternalLink, Loader2, Settings, Upload,
  ListChecks, AlertCircle, RefreshCw, FileText, DollarSign,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";

const C = {
  navy: "#0B1A2E", navy2: "#132B4A", accent: "#3B8EE8",
  green: "#059669", red: "#DC2626", gold: "#F59E0B",
  bg: "#F4F7FB", border: "#E2E8F0", textPrimary: "#1E293B", textSecondary: "#64748B", textMuted: "#94A3B8",
};

export default function RSJsmSetupStage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const { data: svcData } = trpc.recurringServices.getById.useQuery({ id });
  const { data: stagesData } = trpc.recurringServices.getStages.useQuery({ serviceId: id });
  const { data: issuesSummary, isLoading: issuesLoading } = trpc.recurringServices.getJiraIssuesSummary.useQuery(
    { serviceId: id },
    { enabled: !!svcData?.service?.jsmProjectKey }
  );

  const stage = stagesData?.find((s: any) => s.stageId === "jira_setup");
  const isActive = stage?.status === "in_progress";
  const isCompleted = stage?.status === "completed";
  const svc = svcData?.service;

  const [platform, setPlatform] = useState<"prodigio" | "cliente">("prodigio");
  const [clientUrl, setClientUrl] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [spaceName, setSpaceName] = useState("");
  const [spaceKey, setSpaceKey] = useState("");
  const [issueTab, setIssueTab] = useState<"actividades" | "facturacion">("actividades");

  const setPlatformMutation = trpc.recurringServices.setPlatformChoice.useMutation({
    onSuccess: () => { toast.success("Plataforma configurada"); utils.recurringServices.getById.invalidate({ id }); },
    onError: (e) => toast.error(e.message),
  });

  const createJsmMutation = trpc.recurringServices.createJsmProject.useMutation({
    onSuccess: (r) => {
      if (r.success && r.created) {
        toast.success(`Proyecto JSM creado: ${r.jiraProjectKey}`);
        setShowCreateDialog(false);
      } else {
        toast.error(r.error ?? "Error al crear proyecto");
      }
      utils.recurringServices.getById.invalidate({ id });
    },
    onError: (e) => toast.error(e.message),
  });

  const syncTasksMutation = trpc.recurringServices.syncJsmTasks.useMutation({
    onSuccess: (results) => {
      const created = results.filter((r: any) => r.status === "created").length;
      const skipped = results.filter((r: any) => r.status === "skipped").length;
      const errors = results.filter((r: any) => r.status === "error").length;
      toast.success(`Sincronización completada: ${created} creados, ${skipped} ya existentes, ${errors} errores`);
      utils.recurringServices.getJiraIssuesSummary.invalidate({ serviceId: id });
    },
    onError: (e) => toast.error(e.message),
  });

  const closeMutation = trpc.recurringServices.closeJiraSetupStage.useMutation({
    onSuccess: () => {
      toast.success("Etapa cerrada");
      utils.recurringServices.getById.invalidate({ id });
      utils.recurringServices.getStages.invalidate({ serviceId: id });
    },
    onError: (e) => toast.error(e.message),
  });

  if (!svc) return <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Loader2 size={32} className="animate-spin" color={C.accent} /></div>;

  const hasSyncedIssues = (issuesSummary?.totalSynced ?? 0) > 0;
  const hasUnsyncedIssues = (issuesSummary?.totalUnsynced ?? 0) > 0;
  const canClose = hasSyncedIssues && !hasUnsyncedIssues;
  const jiraBaseUrl = svc.jsmPortalUrl?.replace(/\/servicedesk.*/, "") || "https://apiservice2.atlassian.net";

  return (
    <div style={{ background: C.bg, fontFamily: "'Inter', sans-serif", color: C.textPrimary, minHeight: "100vh" }}>
      <AppBreadcrumb segments={[
        { label: "Servicios Recurrentes", href: "/recurring-services" },
        { label: svc.serviceName, href: `/recurring-services/${id}` },
        { label: "JSM Setup" },
      ]} />

      {/* Header */}
      <div style={{
        background: `linear-gradient(160deg, ${C.navy} 0%, ${C.navy2} 100%)`,
        borderBottom: "3px solid #F59E0B",
        borderRadius: 16, padding: "24px 32px", marginBottom: 24,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate(`/recurring-services/${id}`)} style={{ background: "rgba(255,255,255,.08)", border: "none", borderRadius: 8, padding: 6, cursor: "pointer" }}>
            <ArrowLeft size={16} color="#fff" />
          </button>
          <Settings size={20} color="#F59E0B" />
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>JSM Setup</h1>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,.5)" }}>{svc.serviceName} &middot; {svc.clientName}</p>
          </div>
          {isCompleted && (
            <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, padding: "4px 12px", borderRadius: 10, background: "#DCFCE7", color: "#166534" }}>
              COMPLETADA
            </span>
          )}
        </div>

        {/* Sync KPI strip */}
        {issuesSummary && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 20 }}>
            {[
              { label: "Total Issues", value: issuesSummary.totalSynced + issuesSummary.totalUnsynced, color: "#fff" },
              { label: "Sincronizados", value: issuesSummary.totalSynced, color: "#4ADE80" },
              { label: "Pendientes Sync", value: issuesSummary.totalUnsynced, color: issuesSummary.totalUnsynced > 0 ? "#FBBF24" : "#4ADE80" },
              { label: "Actividades / Facturación", value: `${issuesSummary.totalWorkItems} / ${issuesSummary.totalBilling}`, color: "#60A5FA" },
            ].map((kpi) => (
              <div key={kpi.label} style={{
                background: "rgba(255,255,255,.06)", borderRadius: 10, padding: "10px 14px",
                border: "1px solid rgba(255,255,255,.08)",
              }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".09em", color: "rgba(255,255,255,.4)" }}>
                  {kpi.label}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: kpi.color, letterSpacing: "-.3px" }}>
                  {kpi.value}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Platform choice */}
      <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${C.border}`, padding: "20px 24px", marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 12 }}>Plataforma de Gestión</h3>
        <p style={{ fontSize: 12, color: C.textSecondary, marginBottom: 16 }}>
          Selecciona si el servicio se gestionará en la plataforma JSM de Prodigio o en la del cliente.
        </p>

        {svc.jsmPlatform ? (
          <div style={{ padding: "16px 20px", borderRadius: 10, background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={18} color={C.green} />
              <span style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>
                {svc.jsmPlatform === "prodigio" ? "Plataforma Prodigio (JSM)" : "Plataforma del Cliente"}
              </span>
            </div>
            {svc.jsmProjectKey && (
              <p style={{ fontSize: 12, color: C.textSecondary, marginTop: 6 }}>
                Proyecto: <strong>{svc.jsmProjectKey}</strong>
                {svc.jsmPortalUrl && (
                  <a href={svc.jsmPortalUrl} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 8, color: C.accent }}>
                    <ExternalLink size={12} style={{ display: "inline", verticalAlign: "middle" }} /> Abrir
                  </a>
                )}
              </p>
            )}
            {svc.jsmClientPlatformUrl && (
              <p style={{ fontSize: 12, color: C.textSecondary, marginTop: 6 }}>
                URL: <a href={svc.jsmClientPlatformUrl} target="_blank" rel="noopener noreferrer" style={{ color: C.accent }}>{svc.jsmClientPlatformUrl}</a>
              </p>
            )}
          </div>
        ) : isActive ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div
              onClick={() => setPlatform("prodigio")}
              style={{
                padding: "20px", borderRadius: 10, cursor: "pointer",
                border: `2px solid ${platform === "prodigio" ? C.accent : C.border}`,
                background: platform === "prodigio" ? C.accent + "08" : "#fff",
              }}
            >
              <h4 style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, marginBottom: 4 }}>Prodigio JSM</h4>
              <p style={{ fontSize: 11, color: C.textSecondary }}>Crear proyecto en Jira Service Management de Prodigio</p>
            </div>
            <div
              onClick={() => setPlatform("cliente")}
              style={{
                padding: "20px", borderRadius: 10, cursor: "pointer",
                border: `2px solid ${platform === "cliente" ? C.accent : C.border}`,
                background: platform === "cliente" ? C.accent + "08" : "#fff",
              }}
            >
              <h4 style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, marginBottom: 4 }}>Plataforma del Cliente</h4>
              <p style={{ fontSize: 11, color: C.textSecondary }}>El cliente provee su propia plataforma de tickets</p>
            </div>
          </div>
        ) : null}

        {isActive && !svc.jsmPlatform && (
          <div style={{ marginTop: 16 }}>
            {platform === "cliente" && (
              <div style={{ marginBottom: 12 }}>
                <Label>URL de la plataforma del cliente</Label>
                <Input value={clientUrl} onChange={(e) => setClientUrl(e.target.value)} placeholder="https://..." style={{ marginTop: 4 }} />
              </div>
            )}
            <Button
              onClick={() => setPlatformMutation.mutate({ serviceId: id, platform, clientPlatformUrl: platform === "cliente" ? clientUrl : undefined })}
              disabled={setPlatformMutation.isPending}
              style={{ background: C.accent, color: "#fff" }}
            >
              {setPlatformMutation.isPending ? <Loader2 size={16} className="animate-spin mr-1" /> : null}
              Confirmar Plataforma
            </Button>
          </div>
        )}
      </div>

      {/* Create JSM Project */}
      {svc.jsmPlatform === "prodigio" && !svc.jsmProjectKey && isActive && (
        <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${C.border}`, padding: "20px 24px", marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 12 }}>Crear Proyecto JSM</h3>
          <Button size="sm" onClick={() => setShowCreateDialog(true)} style={{ background: C.accent, color: "#fff" }}>
            <Settings size={14} className="mr-1" /> Crear Proyecto en JIRA
          </Button>
        </div>
      )}

      {/* Sync tasks */}
      {svc.jsmProjectKey && (isActive || isCompleted) && (
        <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${C.border}`, padding: "20px 24px", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>
                <Upload size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
                Sincronizar Tareas a JIRA
              </h3>
              <p style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>
                Crear issues en JIRA para los ítems del plan de trabajo y hitos de facturación
              </p>
            </div>
            {isActive && (
              <Button
                size="sm"
                onClick={() => syncTasksMutation.mutate({ serviceId: id })}
                disabled={syncTasksMutation.isPending}
                style={{ background: C.accent, color: "#fff" }}
              >
                {syncTasksMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : <Upload size={14} className="mr-1" />}
                {hasSyncedIssues ? "Re-sincronizar" : "Sincronizar"}
              </Button>
            )}
          </div>

          {/* Sync status indicator */}
          {issuesLoading ? (
            <div style={{ textAlign: "center", padding: 20 }}><Loader2 size={20} className="animate-spin" color={C.accent} /></div>
          ) : issuesSummary && hasSyncedIssues ? (
            <>
              {/* Status banner */}
              <div style={{
                padding: "12px 16px", borderRadius: 10, marginBottom: 16,
                background: hasUnsyncedIssues ? "#FEF3C7" : "#F0FDF4",
                border: `1px solid ${hasUnsyncedIssues ? "#FDE68A" : "#BBF7D0"}`,
                display: "flex", alignItems: "center", gap: 10,
              }}>
                {hasUnsyncedIssues ? (
                  <AlertCircle size={18} color="#D97706" />
                ) : (
                  <CheckCircle2 size={18} color={C.green} />
                )}
                <div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: hasUnsyncedIssues ? "#92400E" : "#166534" }}>
                    {hasUnsyncedIssues
                      ? `${issuesSummary.totalUnsynced} issues pendientes de sincronizar`
                      : `Todos los issues sincronizados (${issuesSummary.totalSynced})`
                    }
                  </span>
                  <span style={{ fontSize: 11, color: C.textSecondary, marginLeft: 8 }}>
                    {issuesSummary.syncedWorkItems.length} actividades + {issuesSummary.syncedBilling.length} facturación
                  </span>
                </div>
              </div>

              {/* Tab selector */}
              <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                <button
                  onClick={() => setIssueTab("actividades")}
                  style={{
                    padding: "6px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                    background: issueTab === "actividades" ? C.accent : "#F1F5F9",
                    color: issueTab === "actividades" ? "#fff" : C.textSecondary,
                  }}
                >
                  <FileText size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                  Actividades ({issuesSummary.syncedWorkItems.length})
                </button>
                <button
                  onClick={() => setIssueTab("facturacion")}
                  style={{
                    padding: "6px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                    background: issueTab === "facturacion" ? C.accent : "#F1F5F9",
                    color: issueTab === "facturacion" ? "#fff" : C.textSecondary,
                  }}
                >
                  <DollarSign size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                  Facturación ({issuesSummary.syncedBilling.length})
                </button>
              </div>

              {/* Issues table */}
              <div style={{ borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#F8FAFC" }}>
                      <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: C.navy, borderBottom: `1px solid ${C.border}` }}>
                        JIRA Key
                      </th>
                      <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: C.navy, borderBottom: `1px solid ${C.border}` }}>
                        Título
                      </th>
                      {issueTab === "actividades" ? (
                        <>
                          <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: C.navy, borderBottom: `1px solid ${C.border}` }}>
                            Tipo
                          </th>
                          <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: C.navy, borderBottom: `1px solid ${C.border}` }}>
                            Frecuencia
                          </th>
                        </>
                      ) : (
                        <>
                          <th style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: C.navy, borderBottom: `1px solid ${C.border}` }}>
                            Monto
                          </th>
                          <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: C.navy, borderBottom: `1px solid ${C.border}` }}>
                            Mes
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {issueTab === "actividades" ? (
                      issuesSummary.syncedWorkItems.map((item: any) => (
                        <tr key={item.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                          <td style={{ padding: "8px 14px" }}>
                            <a
                              href={`${jiraBaseUrl}/browse/${item.jiraKey}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: C.accent, fontWeight: 600, textDecoration: "none" }}
                            >
                              {item.jiraKey}
                              <ExternalLink size={10} style={{ display: "inline", verticalAlign: "middle", marginLeft: 4 }} />
                            </a>
                          </td>
                          <td style={{ padding: "8px 14px", color: C.textPrimary }}>{item.title}</td>
                          <td style={{ padding: "8px 14px" }}>
                            <span style={{
                              fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 8,
                              background: item.type === "entregable" ? "#DBEAFE" : item.type === "reunion" ? "#FEF3C7" : "#F0FDF4",
                              color: item.type === "entregable" ? "#1E40AF" : item.type === "reunion" ? "#92400E" : "#166534",
                            }}>
                              {item.type}
                            </span>
                          </td>
                          <td style={{ padding: "8px 14px", color: C.textSecondary, fontSize: 11 }}>{item.frequency || "—"}</td>
                        </tr>
                      ))
                    ) : (
                      issuesSummary.syncedBilling.map((item: any) => (
                        <tr key={item.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                          <td style={{ padding: "8px 14px" }}>
                            <a
                              href={`${jiraBaseUrl}/browse/${item.jiraKey}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: C.accent, fontWeight: 600, textDecoration: "none" }}
                            >
                              {item.jiraKey}
                              <ExternalLink size={10} style={{ display: "inline", verticalAlign: "middle", marginLeft: 4 }} />
                            </a>
                          </td>
                          <td style={{ padding: "8px 14px", color: C.textPrimary }}>{item.title}</td>
                          <td style={{ padding: "8px 14px", textAlign: "right", fontWeight: 600, color: C.textPrimary }}>
                            {item.currency} {parseFloat(item.amount).toLocaleString()}
                          </td>
                          <td style={{ padding: "8px 14px", textAlign: "center" }}>
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: "2px 10px", borderRadius: 10,
                              background: "#F0F9FF", color: C.accent,
                            }}>
                              Mes {item.monthNumber}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Unsynced items warning */}
              {hasUnsyncedIssues && (
                <div style={{
                  marginTop: 12, padding: "12px 16px", borderRadius: 10,
                  background: "#FEF3C7", border: "1px solid #FDE68A",
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#92400E", marginBottom: 6 }}>
                    <AlertCircle size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
                    Items pendientes de sincronizar ({issuesSummary.totalUnsynced})
                  </div>
                  <div style={{ display: "grid", gap: 4 }}>
                    {issuesSummary.unsyncedWorkItems.map((item: any) => (
                      <div key={`uw-${item.id}`} style={{ fontSize: 11, color: "#78350F", padding: "4px 8px", background: "rgba(255,255,255,.5)", borderRadius: 6 }}>
                        <FileText size={10} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                        {item.title} <span style={{ color: "#A16207" }}>({item.type})</span>
                      </div>
                    ))}
                    {issuesSummary.unsyncedBilling.map((item: any) => (
                      <div key={`ub-${item.id}`} style={{ fontSize: 11, color: "#78350F", padding: "4px 8px", background: "rgba(255,255,255,.5)", borderRadius: 6 }}>
                        <DollarSign size={10} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                        {item.title} — {item.currency} {parseFloat(item.amount).toLocaleString()}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{
              textAlign: "center", padding: "24px 16px", borderRadius: 10,
              background: "#FFF7ED", border: "1px solid #FED7AA",
            }}>
              <ListChecks size={32} color="#D97706" style={{ margin: "0 auto 8px" }} />
              <p style={{ fontSize: 13, fontWeight: 600, color: "#92400E" }}>No hay issues sincronizados</p>
              <p style={{ fontSize: 11, color: "#B45309", marginTop: 4 }}>
                Presiona "Sincronizar" para crear los issues del plan de trabajo y facturación en JIRA
              </p>
            </div>
          )}
        </div>
      )}

      {/* Close stage - only enabled when all issues are synced */}
      {isActive && svc.jsmProjectKey && (
        <div style={{
          background: "#fff", borderRadius: 12, border: `1px solid ${C.border}`,
          padding: "20px 24px", marginBottom: 16,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>Cerrar Etapa</h3>
              <p style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>
                {canClose
                  ? "Todos los issues están sincronizados. Puede cerrar la etapa."
                  : hasSyncedIssues
                    ? "Hay issues pendientes de sincronizar. Ejecute la sincronización antes de cerrar."
                    : "Debe sincronizar las tareas al proyecto JIRA antes de cerrar esta etapa."
                }
              </p>
            </div>
            <Button
              onClick={() => closeMutation.mutate({ serviceId: id })}
              disabled={closeMutation.isPending || !canClose}
              style={{
                background: canClose ? C.green : "#CBD5E1",
                color: "#fff", fontWeight: 700,
                cursor: canClose ? "pointer" : "not-allowed",
              }}
            >
              {closeMutation.isPending ? <Loader2 size={16} className="animate-spin mr-1" /> : <CheckCircle2 size={16} className="mr-1" />}
              Cerrar Etapa JSM Setup
            </Button>
          </div>
        </div>
      )}

      {/* Close stage for client platform (no sync needed) */}
      {isActive && svc.jsmPlatform === "cliente" && !svc.jsmProjectKey && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
          <Button
            onClick={() => closeMutation.mutate({ serviceId: id })}
            disabled={closeMutation.isPending}
            style={{ background: C.green, color: "#fff", fontWeight: 700 }}
          >
            {closeMutation.isPending ? <Loader2 size={16} className="animate-spin mr-1" /> : <CheckCircle2 size={16} className="mr-1" />}
            Cerrar Etapa JSM Setup
          </Button>
        </div>
      )}

      {/* Create JSM Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Crear Proyecto JSM</DialogTitle></DialogHeader>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <Label>Nombre del Proyecto</Label>
              <Input value={spaceName} onChange={(e) => setSpaceName(e.target.value)} placeholder="Ej: Soporte Nivel 2 - ClienteXYZ" style={{ marginTop: 4 }} />
            </div>
            <div>
              <Label>Clave del Proyecto (Key)</Label>
              <Input value={spaceKey} onChange={(e) => setSpaceKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="Ej: SNCXYZ" maxLength={10} style={{ marginTop: 4 }} />
              <p style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>Solo letras mayúsculas y números, máx 10 caracteres</p>
            </div>
            <Button
              onClick={() => createJsmMutation.mutate({ serviceId: id, spaceName, spaceKey })}
              disabled={createJsmMutation.isPending || !spaceName || !spaceKey}
              style={{ background: C.accent, color: "#fff" }}
            >
              {createJsmMutation.isPending ? <Loader2 size={16} className="animate-spin mr-1" /> : <Settings size={16} className="mr-1" />}
              Crear Proyecto
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
