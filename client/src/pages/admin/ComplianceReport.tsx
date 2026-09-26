import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { AlertTriangle, Bell, CheckCircle2, Clock, Loader2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { C, headerGradient, cardStyle, headerKpiCard, headerKpiLabel, headerKpiValue, thStyle, tdStyle, footerStyle, footerText } from "./adminStyles";

const STAGE_LABELS: Record<string, string> = { sow: "SoW", jira: "Jira", risks: "Riesgos", planning: "Planificación", design: "Avance", closure: "Cierre" };
const STATUS_COLORS: Record<string, string> = { on_time: C.green, late: C.red, in_progress: C.accent, not_started: C.g300 };
const STATUS_LABELS: Record<string, string> = { on_time: "A tiempo", late: "Con retraso", in_progress: "En progreso", not_started: "No iniciada" };

export default function ComplianceReport() {
  const { user } = useAuth();
  const role = (user as any)?.role ?? "consulta";
  const isAdminOrPmo = ["admin", "pmo"].includes(role);

  const { data: metrics, isLoading } = trpc.compliance.metrics.useQuery();
  const checkNotify = trpc.deadlineNotifications.checkAndNotify.useMutation({
    onSuccess: (data) => { data.notificationsSent > 0 ? toast.success(`${data.notificationsSent} notificación(es) enviada(s)`) : toast.info("No hay alertas pendientes"); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return (
    <div style={{ background: C.g100, minHeight: "100vh", padding: "36px" }}>
      <div style={{ height: 32, width: 200, background: C.g200, borderRadius: 8, marginBottom: 16 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {[1,2,3,4].map(i => <div key={i} style={{ height: 100, background: C.g200, borderRadius: 12 }} />)}
      </div>
    </div>
  );

  const onTime = metrics?.onTime ?? 0;
  const late = metrics?.late ?? 0;
  const inProgress = metrics?.inProgress ?? 0;
  const total = onTime + late + inProgress;
  const complianceRate = total > 0 ? Math.round((onTime / (onTime + late || 1)) * 100) : 100;

  const pieData = [
    { name: "A tiempo", value: onTime, color: STATUS_COLORS.on_time },
    { name: "Con retraso", value: late, color: STATUS_COLORS.late },
    { name: "En progreso", value: inProgress, color: STATUS_COLORS.in_progress },
  ].filter((d) => d.value > 0);

  const stageIds = ["sow", "jira", "risks", "planning", "design", "closure"];
  const barData = stageIds.map((sid) => {
    const sd = metrics?.details?.filter((d: any) => d.stageId === sid) ?? [];
    return { name: STAGE_LABELS[sid], "A tiempo": sd.filter((d: any) => d.status === "on_time").length, "Con retraso": sd.filter((d: any) => d.status === "late").length, "En progreso": sd.filter((d: any) => d.status === "in_progress").length };
  });

  const details = metrics?.details?.filter((d: any) => d.status !== "not_started") ?? [];

  return (
    <div style={{ background: C.g100, fontFamily: "'Inter', sans-serif", color: C.navy, minHeight: "100vh" }}>
      {/* ── HEADER ── */}
      <div style={{ ...headerGradient, padding: "32px 36px 28px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <span style={{ background: "rgba(59,142,232,.15)", border: "1px solid rgba(59,142,232,.35)", borderRadius: 20, padding: "3px 12px", fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: ".1em", textTransform: "uppercase" }}>REPORTES</span>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-.5px", marginTop: 8 }}>Reporte de Cumplimiento de Plazos</h1>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginTop: 4 }}>Análisis de cumplimiento de plazos por etapa de proyecto</p>
          </div>
          {isAdminOrPmo && (
            <Button onClick={() => checkNotify.mutate()} disabled={checkNotify.isPending} style={{ background: "rgba(255,255,255,.1)", color: "#fff", border: "1px solid rgba(255,255,255,.15)", borderRadius: 8, fontWeight: 700, fontSize: 12, padding: "8px 18px", display: "flex", alignItems: "center", gap: 6 }}>
              {checkNotify.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />} Verificar y Notificar
            </Button>
          )}
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
          {[
            { label: "A Tiempo", value: onTime, icon: <CheckCircle2 className="h-3.5 w-3.5" style={{ color: C.green }} /> },
            { label: "Con Retraso", value: late, icon: <AlertTriangle className="h-3.5 w-3.5" style={{ color: C.red }} /> },
            { label: "En Progreso", value: inProgress, icon: <Clock className="h-3.5 w-3.5" style={{ color: C.accent }} /> },
            { label: "Cumplimiento", value: `${complianceRate}%`, icon: <TrendingUp className="h-3.5 w-3.5" style={{ color: C.teal }} /> },
          ].map((k) => (
            <div key={k.label} style={headerKpiCard}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>{k.icon}<span style={headerKpiLabel}>{k.label}</span></div>
              <div style={headerKpiValue}>{k.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ padding: "28px 36px", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Charts */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={{ ...cardStyle, padding: "20px 24px" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 16 }}>Distribución General</h3>
            {pieData.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 220, fontSize: 13, color: C.g400 }}>No hay datos suficientes</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => [v, "Etapas"]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div style={{ ...cardStyle, padding: "20px 24px" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 16 }}>Cumplimiento por Etapa</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.g400 }} />
                <YAxis tick={{ fontSize: 10, fill: C.g400 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.g200}` }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="A tiempo" fill={C.green} radius={[2, 2, 0, 0]} stackId="a" />
                <Bar dataKey="Con retraso" fill={C.red} radius={[2, 2, 0, 0]} stackId="a" />
                <Bar dataKey="En progreso" fill={C.accent} radius={[2, 2, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Details Table */}
        <div style={{ ...cardStyle, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.g200}` }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>Detalle por Proyecto y Etapa</h3>
          </div>
          {details.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0", fontSize: 13, color: C.g400 }}>No hay etapas con datos de cumplimiento aún.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Proyecto</th>
                    <th style={thStyle}>Etapa</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>Días Usados</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>Plazo</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>% Usado</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {details.map((d: any, i: number) => {
                    const pct = d.totalAllowed > 0 ? Math.round((d.daysUsed / d.totalAllowed) * 100) : 0;
                    const sc = STATUS_COLORS[d.status] ?? C.g300;
                    return (
                      <tr key={i} style={{ transition: "background .15s" }} onMouseEnter={(e) => (e.currentTarget.style.background = C.g100)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{d.projectName}</td>
                        <td style={tdStyle}>{STAGE_LABELS[d.stageId] ?? d.stageId}</td>
                        <td style={{ ...tdStyle, textAlign: "center", fontFamily: "monospace" }}>{d.daysUsed}</td>
                        <td style={{ ...tdStyle, textAlign: "center", fontFamily: "monospace" }}>{d.totalAllowed}d</td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                            <div style={{ width: 60, height: 6, background: C.g200, borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", borderRadius: 3, background: sc }} />
                            </div>
                            <span style={{ fontSize: 11, fontFamily: "monospace", color: sc }}>{pct}%</span>
                          </div>
                        </td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: `${sc}18`, color: sc, display: "inline-block" }}>
                            {STATUS_LABELS[d.status] ?? d.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div style={footerStyle}>
        <span style={footerText}>Prodigio PMO — Cumplimiento de Plazos</span>
        <span style={footerText}>{new Date().getFullYear()}</span>
      </div>
    </div>
  );
}
