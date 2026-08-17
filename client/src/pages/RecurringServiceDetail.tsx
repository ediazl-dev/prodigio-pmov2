import AppBreadcrumb from "@/components/AppBreadcrumb";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  ArrowLeft, ArrowRight, CheckCircle2, ChevronRight, Clock, FileText, Loader2, Lock,
  MousePointerClick, RefreshCw, Settings, Shield, Wrench, XCircle,
} from "lucide-react";
import { useMemo } from "react";
import { useLocation, useParams } from "wouter";

const C = {
  navy: "#0B1A2E", navy2: "#132B4A", navy3: "#1A3358",
  blue: "#1E6091", blue2: "#2980B9", accent: "#e91e8c",
  teal: "#0D9488", gold: "#D4A017", red: "#DC2626", green: "#059669",
  bg: "#F4F7FB", cardBg: "#FFFFFF",
  textPrimary: "#1E293B", textSecondary: "#64748B", textMuted: "#94A3B8",
  border: "#E2E8F0", g100: "#F4F7FB", g200: "#D8E2EF", g300: "#B0BDD0", g400: "#7A8FA8",
};

const STAGES = [
  { id: "inicializacion", label: "Inicialización", sublabel: "Contrato y Documentos", icon: FileText, color: "#E91E8C", path: "init" },
  { id: "plan_trabajo", label: "Plan de Trabajo", sublabel: "SLAs y Actividades", icon: Clock, color: "#3B82F6", path: "work-plan" },
  { id: "jira_setup", label: "JSM Setup", sublabel: "Plataforma de Gestión", icon: Settings, color: "#F59E0B", path: "jsm-setup" },
  { id: "ejecucion", label: "Ejecución", sublabel: "Dashboard Operativo", icon: Wrench, color: "#10B981", path: "execution" },
  { id: "cierre", label: "Cierre", sublabel: "Cierre del Contrato", icon: CheckCircle2, color: "#8B5CF6", path: "closure" },
];

const STATUS_CONFIG: Record<string, { label: string; bg: string; fg: string }> = {
  activo:     { label: "Activo",     bg: "#DCFCE7", fg: "#166534" },
  pausado:    { label: "Pausado",    bg: "#FEF3C7", fg: "#92400E" },
  completado: { label: "Completado", bg: "#DBEAFE", fg: "#1E40AF" },
  cancelado:  { label: "Cancelado",  bg: "#FEE2E2", fg: "#991B1B" },
};

const TYPE_LABELS: Record<string, string> = {
  soporte_incidentes: "Soporte e Incidentes",
  requerimientos: "Requerimientos",
  evolutivos: "Evolutivos",
  mixto: "Mixto",
};

export default function RecurringServiceDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const role = (user as any)?.role;

  const { data, isLoading } = trpc.recurringServices.getById.useQuery({ id }, { enabled: !!id });

  const stageMap = useMemo(() => {
    if (!data?.stages) return {} as Record<string, any>;
    const m: Record<string, any> = {};
    data.stages.forEach((s: any) => { m[s.stageId] = s; });
    return m;
  }, [data?.stages]);

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh" }}>
        <Loader2 size={32} className="animate-spin" color={C.accent} />
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ textAlign: "center", padding: 60 }}>
        <XCircle size={48} color={C.red} style={{ margin: "0 auto 16px" }} />
        <h3 style={{ fontSize: 16, fontWeight: 700, color: C.navy }}>Servicio no encontrado</h3>
        <Button variant="outline" onClick={() => navigate("/recurring-services")} className="mt-4">
          <ArrowLeft size={16} className="mr-1" /> Volver
        </Button>
      </div>
    );
  }

  const svc = data.service;
  const st = STATUS_CONFIG[svc.status] ?? STATUS_CONFIG.activo;

  // Find active stage index
  const activeStageIdx = STAGES.findIndex(s => {
    const sd = stageMap[s.id];
    return sd?.status === "in_progress";
  });

  return (
    <div style={{ background: C.bg, fontFamily: "'Inter', sans-serif", color: C.textPrimary, minHeight: "100vh" }}>
      <AppBreadcrumb segments={[
        { label: "Servicios Recurrentes", href: "/recurring-services" },
        { label: svc.serviceName },
      ]} />

      {/* Header */}
      <div style={{
        background: `linear-gradient(160deg, ${C.navy} 0%, ${C.navy2} 55%, ${C.navy3} 100%)`,
        borderBottom: `3px solid ${C.accent}`,
        borderRadius: 16, padding: "28px 36px", margin: "0 0 24px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <button onClick={() => navigate("/recurring-services")} style={{ background: "rgba(255,255,255,.08)", border: "none", borderRadius: 8, padding: 6, cursor: "pointer" }}>
                <ArrowLeft size={16} color="#fff" />
              </button>
              <RefreshCw size={18} color={C.accent} />
              <span style={{
                fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                background: st.bg, color: st.fg,
              }}>{st.label}</span>
              <span style={{
                fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
                background: "rgba(255,255,255,.1)", color: "rgba(255,255,255,.6)",
              }}>{TYPE_LABELS[svc.serviceType] ?? svc.serviceType}</span>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-.5px", margin: "4px 0 2px" }}>
              {svc.serviceName}
            </h1>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,.5)" }}>
              {svc.clientName} &middot; {svc.durationMonths} meses &middot; {svc.currency} {svc.totalContractAmount ? parseFloat(svc.totalContractAmount).toLocaleString() : "—"}
            </p>
          </div>
        </div>

        {/* KPI strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginTop: 20 }}>
          {[
            { label: "Duración", value: `${svc.durationMonths} meses` },
            { label: "Inicio Formal", value: svc.formalStartDate ? new Date(svc.formalStartDate).toLocaleDateString("es-CL") : "Pendiente" },
            { label: "Fin Estimado", value: svc.endDate ? new Date(svc.endDate).toLocaleDateString("es-CL") : "Pendiente" },
            { label: "Facturación", value: svc.billingType === "cuota_fija" ? `${svc.currency} ${svc.fixedMonthlyAmount ? parseFloat(svc.fixedMonthlyAmount).toLocaleString() : "0"}/mes` : "Variable" },
          ].map((kpi) => (
            <div key={kpi.label} style={{
              background: "rgba(255,255,255,.06)", borderRadius: 10, padding: "12px 14px",
              border: "1px solid rgba(255,255,255,.08)",
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".09em", color: "rgba(255,255,255,.4)" }}>
                {kpi.label}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", letterSpacing: "-.3px" }}>
                {kpi.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── PIPELINE DE ETAPAS ── */}
      <div style={{
        background: "#fff", borderRadius: 16, border: `1px solid ${C.border}`,
        padding: "28px 32px", marginBottom: 24,
        boxShadow: "0 2px 12px rgba(10,22,40,.05)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: C.navy, letterSpacing: "-.3px" }}>
              Pipeline de Etapas
            </h2>
            <p style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
              {activeStageIdx >= 0
                ? `Etapa ${activeStageIdx + 1} de ${STAGES.length} en curso`
                : "Todas las etapas completadas"}
            </p>
          </div>
          {/* Progress bar mini */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {STAGES.map((stage, idx) => {
              const sd = stageMap[stage.id];
              const status = sd?.status ?? "locked";
              const isCompleted = status === "completed";
              const isActive = status === "in_progress";
              return (
                <div key={stage.id} style={{
                  width: isActive ? 28 : 16, height: 4, borderRadius: 2,
                  background: isCompleted ? C.green : isActive ? stage.color : C.g200,
                  transition: "all .3s",
                }} />
              );
            })}
          </div>
        </div>

        {/* ── Completed stages row ── */}
        {STAGES.some(s => stageMap[s.id]?.status === "completed") && (
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {STAGES.filter(s => stageMap[s.id]?.status === "completed").map((stage, idx) => {
              const stageData = stageMap[stage.id];
              return (
                <div
                  key={stage.id}
                  onClick={() => navigate(`/recurring-services/${id}/${stage.path}`)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 16px", borderRadius: 10, flex: "1 1 0",
                    minWidth: 160,
                    background: "#F8FAF9",
                    border: `1px solid #E0E7E4`,
                    cursor: "pointer",
                    transition: "all .2s",
                    position: "relative",
                    overflow: "hidden",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#F0F7F4";
                    e.currentTarget.style.borderColor = "#B8D4C8";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#F8FAF9";
                    e.currentTarget.style.borderColor = "#E0E7E4";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  {/* Top accent line */}
                  <div style={{
                    position: "absolute", top: 0, left: 0, right: 0, height: 2,
                    background: C.green,
                  }} />
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "#DCFCE7", flexShrink: 0,
                  }}>
                    <CheckCircle2 size={15} color="#16A34A" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {stage.label}
                    </div>
                    <div style={{ fontSize: 9, color: C.textMuted }}>
                      {stageData?.completedAt
                        ? `Cerrada ${new Date(stageData.completedAt).toLocaleDateString("es-CL")}`
                        : "Completada"}
                    </div>
                  </div>
                  <ChevronRight size={14} color={C.textMuted} style={{ flexShrink: 0 }} />
                </div>
              );
            })}
          </div>
        )}

        {/* ── Active stage (HERO CARD) ── */}
        {activeStageIdx >= 0 && (() => {
          const stage = STAGES[activeStageIdx];
          const stageData = stageMap[stage.id];
          const Icon = stage.icon;
          return (
            <div
              onClick={() => navigate(`/recurring-services/${id}/${stage.path}`)}
              style={{
                position: "relative",
                borderRadius: 16,
                overflow: "hidden",
                cursor: "pointer",
                marginBottom: 16,
                transition: "all .25s",
                boxShadow: `0 4px 24px ${stage.color}20, 0 1px 4px rgba(0,0,0,.06)`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = `0 8px 32px ${stage.color}30, 0 2px 8px rgba(0,0,0,.08)`;
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = `0 4px 24px ${stage.color}20, 0 1px 4px rgba(0,0,0,.06)`;
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              {/* Background gradient */}
              <div style={{
                background: `linear-gradient(135deg, ${stage.color}08 0%, ${stage.color}04 50%, transparent 100%)`,
                border: `1.5px solid ${stage.color}30`,
                borderRadius: 16,
                padding: "28px 32px",
              }}>
                {/* Left accent bar */}
                <div style={{
                  position: "absolute", left: 0, top: 0, bottom: 0, width: 4,
                  background: `linear-gradient(180deg, ${stage.color} 0%, ${stage.color}80 100%)`,
                  borderRadius: "16px 0 0 16px",
                }} />

                {/* Pulse dot */}
                <div style={{
                  position: "absolute", top: 20, right: 24,
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: stage.color,
                    boxShadow: `0 0 0 3px ${stage.color}20`,
                    animation: "pulse 2s ease-in-out infinite",
                  }} />
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: ".08em",
                    color: stage.color, textTransform: "uppercase",
                  }}>En Progreso</span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  {/* Large icon */}
                  <div style={{
                    width: 64, height: 64, borderRadius: 16,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: `linear-gradient(135deg, ${stage.color}18 0%, ${stage.color}08 100%)`,
                    border: `1px solid ${stage.color}25`,
                    flexShrink: 0,
                  }}>
                    <Icon size={28} color={stage.color} strokeWidth={2} />
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 4 }}>
                      Etapa {activeStageIdx + 1} de {STAGES.length}
                    </div>
                    <h3 style={{ fontSize: 20, fontWeight: 800, color: C.navy, letterSpacing: "-.4px", margin: "0 0 4px" }}>
                      {stage.label}
                    </h3>
                    <p style={{ fontSize: 12, color: C.textSecondary, margin: 0 }}>
                      {stage.sublabel}
                    </p>
                  </div>

                  {/* CTA button */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "10px 20px", borderRadius: 10,
                    background: stage.color, color: "#fff",
                    fontSize: 12, fontWeight: 700,
                    boxShadow: `0 2px 8px ${stage.color}40`,
                    flexShrink: 0,
                    transition: "all .2s",
                  }}>
                    <MousePointerClick size={15} />
                    Ver Detalle
                    <ArrowRight size={14} />
                  </div>
                </div>

                {/* Stage number watermark */}
                <div style={{
                  position: "absolute", bottom: -8, right: 120,
                  fontSize: 80, fontWeight: 900, color: stage.color,
                  opacity: 0.04, lineHeight: 1, pointerEvents: "none",
                  fontFamily: "'Inter', sans-serif",
                }}>
                  {String(activeStageIdx + 1).padStart(2, "0")}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Locked stages ── */}
        {STAGES.some(s => (stageMap[s.id]?.status ?? "locked") === "locked") && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {STAGES.filter(s => (stageMap[s.id]?.status ?? "locked") === "locked").map((stage) => (
              <div
                key={stage.id}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 16px", borderRadius: 10, flex: "1 1 0",
                  minWidth: 160,
                  background: "#FAFBFC",
                  border: `1px dashed ${C.g200}`,
                  opacity: 0.55,
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "#F1F5F9", flexShrink: 0,
                }}>
                  <Lock size={13} color={C.textMuted} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {stage.label}
                  </div>
                  <div style={{ fontSize: 9, color: C.g300 }}>
                    {stage.sublabel}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Documents & Billing summary */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Documents */}
        <div style={{
          background: "#fff", borderRadius: 12, border: `1px solid ${C.border}`,
          padding: "20px 24px", boxShadow: "0 1px 4px rgba(10,22,40,.04)",
        }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 12 }}>
            Documentos ({data.documents.length})
          </h3>
          {data.documents.length === 0 ? (
            <p style={{ fontSize: 12, color: C.textMuted }}>Sin documentos adjuntos</p>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {data.documents.map((doc: any) => (
                <a
                  key={doc.id}
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    fontSize: 12, color: C.accent, textDecoration: "none",
                    padding: "6px 8px", borderRadius: 6, background: "#F8FAFC",
                  }}
                >
                  <FileText size={14} />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {doc.fileName}
                  </span>
                  <span style={{ fontSize: 9, color: C.textMuted, textTransform: "uppercase" }}>
                    {doc.docType.replace("_", " ")}
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Billing summary */}
        <div style={{
          background: "#fff", borderRadius: 12, border: `1px solid ${C.border}`,
          padding: "20px 24px", boxShadow: "0 1px 4px rgba(10,22,40,.04)",
        }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 12 }}>
            Plan de Cobro ({data.billingMonths.length} cuotas)
          </h3>
          {data.billingMonths.length === 0 ? (
            <p style={{ fontSize: 12, color: C.textMuted }}>Plan de cobro no configurado</p>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: C.textSecondary }}>Total contrato:</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>
                  {svc.currency} {svc.totalContractAmount ? parseFloat(svc.totalContractAmount).toLocaleString() : "—"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {data.billingMonths.map((m: any) => {
                  const colors: Record<string, string> = { pendiente: "#FEF3C7", facturado: "#DBEAFE", pagado: "#DCFCE7" };
                  return (
                    <div key={m.id} style={{
                      width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 9, fontWeight: 700, background: colors[m.status] ?? "#F1F5F9",
                      color: C.textSecondary, border: `1px solid ${C.border}`,
                    }} title={`Mes ${m.monthNumber}: ${m.status} - ${m.currency} ${parseFloat(m.amount).toLocaleString()}`}>
                      {m.monthNumber}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                {[
                  { label: "Pendiente", color: "#FEF3C7" },
                  { label: "Facturado", color: "#DBEAFE" },
                  { label: "Pagado", color: "#DCFCE7" },
                ].map(l => (
                  <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: C.textMuted }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color, border: `1px solid ${C.border}` }} />
                    {l.label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 currentColor; opacity: 1; }
          50% { box-shadow: 0 0 0 6px transparent; opacity: .7; }
        }
      `}</style>
    </div>
  );
}
