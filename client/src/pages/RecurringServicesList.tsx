import { useAuth } from "@/_core/hooks/useAuth";
import AppBreadcrumb from "@/components/AppBreadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight, Filter, Loader2, Plus, RefreshCw, Search, X,
  Activity, CheckCircle2, Pause, XCircle,
  DollarSign, Shield, TrendingUp, AlertTriangle, BarChart3,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  RECURRING_SERVICE_TYPE_LABELS,
  RECURRING_SERVICE_TYPE_OPTIONS,
} from "@shared/recurringServiceTypes";
import RecurringServicesDashboardV2 from "./recurring/RecurringServicesDashboardV2";

const C = {
  navy: "#0A1628", navy2: "#112240", navy3: "#1A3358",
  blue: "#1B4F8A", blue2: "#2563AB", accent: "#e91e8c",
  teal: "#0D7A6B", teal2: "#12A08D",
  gold: "#B8860B", gold2: "#D4A017",
  red: "#B83232", green: "#1A7A4A",
  g100: "#F4F7FB", g150: "#EBF0F7", g200: "#D8E2EF", g300: "#B0BDD0", g400: "#7A8FA8",
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; fg: string; icon: any }> = {
  activo:     { label: "Activo",     bg: "#DCFCE7", fg: "#166534", icon: Activity },
  pausado:    { label: "Pausado",    bg: "#FEF3C7", fg: "#92400E", icon: Pause },
  completado: { label: "Completado", bg: "#DBEAFE", fg: "#1E40AF", icon: CheckCircle2 },
  cancelado:  { label: "Cancelado",  bg: "#FEE2E2", fg: "#991B1B", icon: XCircle },
};

const STAGE_LABELS: Record<string, { label: string; color: string }> = {
  inicializacion: { label: "Inicialización", color: C.accent },
  plan_trabajo:   { label: "Plan de Trabajo", color: C.teal },
  jira_setup:     { label: "JSM Setup", color: C.blue2 },
  ejecucion:      { label: "Ejecución", color: C.green },
  cierre:         { label: "Cierre", color: "#8B5CF6" },
};

function fmtCurrency(val: number, currency = "USD") {
  if (val >= 1_000_000) return `${currency} ${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${currency} ${(val / 1_000).toFixed(1)}K`;
  return `${currency} ${val.toLocaleString()}`;
}

function fmtMonth(m: string) {
  const [y, mo] = m.split("-");
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${months[parseInt(mo) - 1]} ${y.slice(2)}`;
}

// Simple bar chart component
function BillingChart({ data }: { data: { month: string; pagado: number; facturado: number; pendiente: number }[] }) {
  const maxVal = Math.max(...data.map(d => d.pagado + d.facturado + d.pendiente), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120, padding: "0 4px" }}>
      {data.map((d) => {
        const total = d.pagado + d.facturado + d.pendiente;
        const h = (total / maxVal) * 100;
        const paidH = total > 0 ? (d.pagado / total) * h : 0;
        const invoicedH = total > 0 ? (d.facturado / total) * h : 0;
        const pendingH = total > 0 ? (d.pendiente / total) * h : 0;
        return (
          <div key={d.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ width: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: 100 }}>
              {pendingH > 0 && <div style={{ height: `${pendingH}%`, background: "#FCA5A5", borderRadius: "3px 3px 0 0", minHeight: 2 }} title={`Pendiente: ${d.pendiente.toLocaleString()}`} />}
              {invoicedH > 0 && <div style={{ height: `${invoicedH}%`, background: C.gold2, minHeight: 2 }} title={`Facturado: ${d.facturado.toLocaleString()}`} />}
              {paidH > 0 && <div style={{ height: `${paidH}%`, background: C.teal2, borderRadius: "0 0 3px 3px", minHeight: 2 }} title={`Pagado: ${d.pagado.toLocaleString()}`} />}
              {total === 0 && <div style={{ height: 2, background: C.g200, borderRadius: 2 }} />}
            </div>
            <span style={{ fontSize: 9, color: C.g400, fontWeight: 600 }}>{fmtMonth(d.month)}</span>
          </div>
        );
      })}
    </div>
  );
}

// Donut chart component
function DonutChart({ segments, size = 80 }: { segments: { value: number; color: string; label: string }[]; size?: number }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return <div style={{ width: size, height: size, borderRadius: "50%", background: C.g200 }} />;
  const r = size / 2;
  const strokeWidth = 12;
  const innerR = r - strokeWidth;
  let cumAngle = -90;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.filter(s => s.value > 0).map((seg, i) => {
        const angle = (seg.value / total) * 360;
        const startAngle = cumAngle;
        cumAngle += angle;
        const endAngle = cumAngle;
        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;
        const x1 = r + innerR * Math.cos(startRad);
        const y1 = r + innerR * Math.sin(startRad);
        const x2 = r + innerR * Math.cos(endRad);
        const y2 = r + innerR * Math.sin(endRad);
        const outerX1 = r + r * Math.cos(startRad);
        const outerY1 = r + r * Math.sin(startRad);
        const outerX2 = r + r * Math.cos(endRad);
        const outerY2 = r + r * Math.sin(endRad);
        const largeArc = angle > 180 ? 1 : 0;
        const d = `M ${outerX1} ${outerY1} A ${r} ${r} 0 ${largeArc} 1 ${outerX2} ${outerY2} L ${x2} ${y2} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x1} ${y1} Z`;
        return <path key={i} d={d} fill={seg.color} />;
      })}
      <circle cx={r} cy={r} r={innerR - 1} fill="white" />
      <text x={r} y={r - 4} textAnchor="middle" style={{ fontSize: 14, fontWeight: 800, fill: C.navy }}>{total}</text>
      <text x={r} y={r + 10} textAnchor="middle" style={{ fontSize: 8, fontWeight: 600, fill: C.g400 }}>TOTAL</text>
    </svg>
  );
}

// Progress bar component
function ProgressBar({ value, color, height = 6 }: { value: number; color: string; height?: number }) {
  return (
    <div style={{ background: C.g200, borderRadius: height / 2, height, width: "100%", overflow: "hidden" }}>
      <div style={{ background: color, height: "100%", width: `${Math.min(value, 100)}%`, borderRadius: height / 2, transition: "width .3s" }} />
    </div>
  );
}

export default function RecurringServicesList() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const role = (user as any)?.role;
  const canCreate = role === "admin" || role === "pmo";

  const { data: services, isLoading: loadingList } = trpc.recurringServices.list.useQuery();
  const { data: kpis, isLoading: loadingKpis } = trpc.recurringServices.dashboardKpis.useQuery();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState<"tower" | "dashboard" | "list">("tower");

  const filtered = useMemo(() => {
    if (!services) return [];
    return services.filter((s: any) => {
      const matchSearch = !search || s.clientName.toLowerCase().includes(search.toLowerCase()) || s.serviceName.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || s.status === statusFilter;
      const matchType = typeFilter === "all" || s.serviceType === typeFilter;
      return matchSearch && matchStatus && matchType;
    });
  }, [services, search, statusFilter, typeFilter]);

  const isLoading = loadingList || loadingKpis;

  return (
    <div style={{ background: C.g100, fontFamily: "'Inter', sans-serif", color: C.navy, minHeight: "100vh" }}>
      <AppBreadcrumb segments={[{ label: "Servicios Recurrentes" }]} />

      {/* Header */}
      <div style={{
        background: `linear-gradient(160deg, ${C.navy} 0%, ${C.navy2} 55%, ${C.navy3} 100%)`,
        borderBottom: `3px solid ${C.accent}`,
        borderRadius: 16, padding: "28px 36px", margin: "0 0 24px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <RefreshCw size={22} color={C.accent} />
              <span style={{
                background: "rgba(59,142,232,.15)", border: "1px solid rgba(59,142,232,.35)",
                borderRadius: 20, padding: "3px 12px", fontSize: 10, fontWeight: 700,
                color: C.accent, letterSpacing: ".1em", textTransform: "uppercase",
              }}>Gestión de Servicios</span>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "-.5px", margin: "8px 0 4px" }}>
              Servicios Recurrentes
            </h1>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,.5)" }}>
              Gestión de contratos de servicios recurrentes con pipeline de 5 etapas
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {/* View toggle */}
            <div style={{ display: "flex", background: "rgba(255,255,255,.08)", borderRadius: 8, padding: 2 }}>
              <button
                onClick={() => setView("tower")}
                style={{
                  padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer",
                  background: view === "tower" ? C.accent : "transparent",
                  color: view === "tower" ? "#fff" : "rgba(255,255,255,.5)",
                }}
              >
                <Activity size={13} style={{ marginRight: 4, verticalAlign: "middle" }} /> Torre V2
              </button>
              <button
                onClick={() => setView("dashboard")}
                style={{
                  padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer",
                  background: view === "dashboard" ? C.accent : "transparent",
                  color: view === "dashboard" ? "#fff" : "rgba(255,255,255,.5)",
                }}
              >
                <BarChart3 size={13} style={{ marginRight: 4, verticalAlign: "middle" }} /> Clásico
              </button>
              <button
                onClick={() => setView("list")}
                style={{
                  padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer",
                  background: view === "list" ? C.accent : "transparent",
                  color: view === "list" ? "#fff" : "rgba(255,255,255,.5)",
                }}
              >
                Lista
              </button>
            </div>
            {canCreate && (
              <Button
                onClick={() => navigate("/recurring-services/new")}
                style={{ background: C.accent, color: "#fff", fontWeight: 700, fontSize: 13 }}
              >
                <Plus size={16} className="mr-1" /> Nuevo Servicio
              </Button>
            )}
          </div>
        </div>

        {/* Top KPI strip */}
        {view !== "tower" && kpis && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginTop: 20 }}>
            {[
              { label: "Total Servicios", value: kpis.statusCounts.total, color: "#fff", icon: RefreshCw },
              { label: "Activos", value: kpis.statusCounts.activo, color: "#4ADE80", icon: Activity },
              { label: "Facturación Mes", value: fmtCurrency(kpis.billing.currentMonth.total, kpis.totalContractCurrency), color: C.gold2, icon: DollarSign },
              { label: "Cobrado Mes", value: fmtCurrency(kpis.billing.currentMonth.paid, kpis.totalContractCurrency), color: C.teal2, icon: TrendingUp },
              { label: "SLA Compliance", value: `${kpis.sla.complianceRate}%`, color: kpis.sla.complianceRate >= 80 ? "#4ADE80" : kpis.sla.complianceRate >= 50 ? "#FBBF24" : "#F87171", icon: Shield },
              { label: "Multas Activas", value: kpis.penalties.total, color: kpis.penalties.total > 0 ? "#F87171" : "#4ADE80", icon: AlertTriangle },
            ].map((kpi) => {
              const Icon = kpi.icon;
              return (
                <div key={kpi.label} style={{
                  background: "rgba(255,255,255,.06)", borderRadius: 10, padding: "12px 14px",
                  border: "1px solid rgba(255,255,255,.08)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <Icon size={11} color="rgba(255,255,255,.35)" />
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".09em", color: "rgba(255,255,255,.4)" }}>
                      {kpi.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: kpi.color, letterSpacing: "-.5px" }}>
                    {kpi.value}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Loading */}
      {view !== "tower" && isLoading && (
        <div style={{ textAlign: "center", padding: 60 }}>
          <Loader2 size={32} className="animate-spin mx-auto" color={C.accent} />
          <p style={{ marginTop: 12, color: C.g400, fontSize: 13 }}>Cargando servicios...</p>
        </div>
      )}

      {view === "tower" && <RecurringServicesDashboardV2 />}

      {/* Dashboard View */}
      {!isLoading && view === "dashboard" && kpis && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
          {/* Billing Chart - spans 2 cols */}
          <div style={{
            gridColumn: "1 / 3", background: "#fff", borderRadius: 12, border: `1px solid ${C.g200}`,
            padding: "20px 24px", boxShadow: "0 1px 4px rgba(10,22,40,.04)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>Facturación Mensual</h3>
                <p style={{ fontSize: 11, color: C.g400, marginTop: 2 }}>Últimos 6 meses</p>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                {[
                  { label: "Pagado", color: C.teal2 },
                  { label: "Facturado", color: C.gold2 },
                  { label: "Pendiente", color: "#FCA5A5" },
                ].map(l => (
                  <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
                    <span style={{ fontSize: 10, color: C.g400, fontWeight: 600 }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <BillingChart data={kpis.billing.monthly} />
            {/* Billing summary row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.g200}` }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: C.g400, letterSpacing: ".08em" }}>Total Contratado</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.navy }}>{fmtCurrency(kpis.totalContractValue, kpis.totalContractCurrency)}</div>
              </div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: C.g400, letterSpacing: ".08em" }}>Total Cobrado</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.teal }}>{fmtCurrency(kpis.billing.overall.paid, kpis.totalContractCurrency)}</div>
              </div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: C.g400, letterSpacing: ".08em" }}>Pendiente Cobro</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.red }}>{fmtCurrency(kpis.billing.overall.pending, kpis.totalContractCurrency)}</div>
              </div>
            </div>
          </div>

          {/* Status Distribution */}
          <div style={{
            background: "#fff", borderRadius: 12, border: `1px solid ${C.g200}`,
            padding: "20px 24px", boxShadow: "0 1px 4px rgba(10,22,40,.04)",
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 16 }}>Distribución por Estado</h3>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <DonutChart segments={[
                { value: kpis.statusCounts.activo, color: "#4ADE80", label: "Activos" },
                { value: kpis.statusCounts.pausado, color: "#FBBF24", label: "Pausados" },
                { value: kpis.statusCounts.completado, color: "#60A5FA", label: "Completados" },
                { value: kpis.statusCounts.cancelado, color: "#F87171", label: "Cancelados" },
              ]} size={90} />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {[
                { label: "Activos", value: kpis.statusCounts.activo, color: "#4ADE80" },
                { label: "Pausados", value: kpis.statusCounts.pausado, color: "#FBBF24" },
                { label: "Completados", value: kpis.statusCounts.completado, color: "#60A5FA" },
                { label: "Cancelados", value: kpis.statusCounts.cancelado, color: "#F87171" },
              ].map(item => (
                <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color }} />
                    <span style={{ fontSize: 11, color: C.g400, fontWeight: 600 }}>{item.label}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: C.navy }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* SLA Compliance Card */}
          <div style={{
            background: "#fff", borderRadius: 12, border: `1px solid ${C.g200}`,
            padding: "20px 24px", boxShadow: "0 1px 4px rgba(10,22,40,.04)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Shield size={16} color={C.accent} />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>SLA Compliance</h3>
            </div>
            <div style={{ textAlign: "center", marginBottom: 12 }}>
              <div style={{
                fontSize: 36, fontWeight: 800, letterSpacing: "-1px",
                color: kpis.sla.complianceRate >= 80 ? C.green : kpis.sla.complianceRate >= 50 ? C.gold : C.red,
              }}>
                {kpis.sla.complianceRate}%
              </div>
              <div style={{ fontSize: 10, color: C.g400, fontWeight: 600 }}>
                {kpis.sla.activeWithSla} de {kpis.sla.activeTotal} servicios activos con SLA configurado
              </div>
            </div>
            <ProgressBar
              value={kpis.sla.complianceRate}
              color={kpis.sla.complianceRate >= 80 ? C.green : kpis.sla.complianceRate >= 50 ? C.gold : C.red}
              height={8}
            />
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${C.g200}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: C.g400, marginBottom: 8 }}>Reglas SLA por Prioridad</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {[
                  { key: "critical", label: "Crítica", color: C.red },
                  { key: "high", label: "Alta", color: "#F97316" },
                  { key: "medium", label: "Media", color: C.gold2 },
                  { key: "low", label: "Baja", color: C.teal2 },
                ].map(p => (
                  <div key={p.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 10, color: p.color, fontWeight: 700 }}>{p.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: C.navy }}>{kpis.sla.byPriority[p.key] || 0}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Stage Distribution */}
          <div style={{
            background: "#fff", borderRadius: 12, border: `1px solid ${C.g200}`,
            padding: "20px 24px", boxShadow: "0 1px 4px rgba(10,22,40,.04)",
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 16 }}>Distribución por Etapa</h3>
            <div style={{ display: "grid", gap: 8 }}>
              {(["inicializacion", "plan_trabajo", "jira_setup", "ejecucion", "cierre"] as const).map(stage => {
                const info = STAGE_LABELS[stage];
                const count = kpis.stageCounts[stage] || 0;
                const pct = kpis.statusCounts.total > 0 ? Math.round((count / kpis.statusCounts.total) * 100) : 0;
                return (
                  <div key={stage}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: C.g400 }}>{info.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: C.navy }}>{count} <span style={{ fontSize: 9, color: C.g400 }}>({pct}%)</span></span>
                    </div>
                    <ProgressBar value={pct} color={info.color} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Penalties Card */}
          <div style={{
            background: "#fff", borderRadius: 12, border: `1px solid ${C.g200}`,
            padding: "20px 24px", boxShadow: "0 1px 4px rgba(10,22,40,.04)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <AlertTriangle size={16} color={kpis.penalties.total > 0 ? C.red : C.g400} />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>Multas</h3>
            </div>
            {kpis.penalties.total === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <CheckCircle2 size={32} color={C.green} style={{ margin: "0 auto 8px" }} />
                <div style={{ fontSize: 12, fontWeight: 600, color: C.green }}>Sin multas registradas</div>
              </div>
            ) : (
              <>
                <div style={{ textAlign: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: C.red }}>{kpis.penalties.total}</div>
                  <div style={{ fontSize: 10, color: C.g400 }}>multas por {fmtCurrency(kpis.penalties.amount, kpis.totalContractCurrency)}</div>
                </div>
                <div style={{ display: "grid", gap: 4 }}>
                  {[
                    { key: "identificada", label: "Identificadas", color: "#FBBF24" },
                    { key: "aplicada", label: "Aplicadas", color: C.red },
                    { key: "disputada", label: "Disputadas", color: "#F97316" },
                    { key: "resuelta", label: "Resueltas", color: C.green },
                  ].map(ps => (
                    <div key={ps.key} style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 10, color: ps.color, fontWeight: 700 }}>{ps.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: C.navy }}>{kpis.penalties.byStatus[ps.key] || 0}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Type Distribution */}
          <div style={{
            background: "#fff", borderRadius: 12, border: `1px solid ${C.g200}`,
            padding: "20px 24px", boxShadow: "0 1px 4px rgba(10,22,40,.04)",
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 16 }}>Distribución por Tipo</h3>
            <div style={{ display: "grid", gap: 8 }}>
              {RECURRING_SERVICE_TYPE_OPTIONS.map(t => {
                const count = kpis.typeCounts[t.value] || 0;
                const pct = kpis.statusCounts.total > 0 ? Math.round((count / kpis.statusCounts.total) * 100) : 0;
                return (
                  <div key={t.value}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: C.g400 }}>{t.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: C.navy }}>{count}</span>
                    </div>
                    <ProgressBar value={pct} color={t.color} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Services Table (Dashboard view - per-service summary) */}
      {!isLoading && view === "dashboard" && kpis && kpis.servicesSummary.length > 0 && (
        <div style={{
          background: "#fff", borderRadius: 12, border: `1px solid ${C.g200}`,
          padding: "20px 24px", boxShadow: "0 1px 4px rgba(10,22,40,.04)", marginBottom: 24,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 16 }}>Resumen por Servicio</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${C.g200}` }}>
                  {["Servicio", "Cliente", "Estado", "Etapa", "Facturado", "Cobrado", "Avance Cobro", "SLA", "Multas"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontSize: 10, fontWeight: 700, color: C.g400, textTransform: "uppercase", letterSpacing: ".06em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {kpis.servicesSummary.map((svc: any) => {
                  const st = STATUS_CONFIG[svc.status] ?? STATUS_CONFIG.activo;
                  const StIcon = st.icon;
                  const stageInfo = STAGE_LABELS[svc.currentStage] ?? { label: svc.currentStage, color: C.g400 };
                  return (
                    <tr
                      key={svc.id}
                      onClick={() => navigate(`/recurring-services/${svc.id}`)}
                      style={{ borderBottom: `1px solid ${C.g150}`, cursor: "pointer", transition: "background .15s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = C.g100)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "10px 10px", fontWeight: 700, color: C.navy }}>{svc.serviceName}</td>
                      <td style={{ padding: "10px 10px", color: C.g400 }}>{svc.clientName}</td>
                      <td style={{ padding: "10px 10px" }}>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: st.bg, color: st.fg, display: "inline-flex", alignItems: "center", gap: 3 }}>
                          <StIcon size={9} /> {st.label}
                        </span>
                      </td>
                      <td style={{ padding: "10px 10px" }}>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: `${stageInfo.color}15`, color: stageInfo.color }}>
                          {stageInfo.label}
                        </span>
                      </td>
                      <td style={{ padding: "10px 10px", fontWeight: 700, color: C.navy }}>{fmtCurrency(svc.billingTotal, svc.currency)}</td>
                      <td style={{ padding: "10px 10px", fontWeight: 700, color: C.teal }}>{fmtCurrency(svc.billingPaid, svc.currency)}</td>
                      <td style={{ padding: "10px 10px", width: 120 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <ProgressBar value={svc.billingProgress} color={svc.billingProgress >= 80 ? C.green : svc.billingProgress >= 50 ? C.gold2 : C.red} />
                          <span style={{ fontSize: 10, fontWeight: 700, color: C.navy, minWidth: 28 }}>{svc.billingProgress}%</span>
                        </div>
                      </td>
                      <td style={{ padding: "10px 10px" }}>
                        {svc.hasSla ? (
                          <Shield size={14} color={C.green} />
                        ) : (
                          <span style={{ fontSize: 9, color: C.g400 }}>Sin SLA</span>
                        )}
                      </td>
                      <td style={{ padding: "10px 10px" }}>
                        {svc.penaltiesCount > 0 ? (
                          <span style={{ fontSize: 10, fontWeight: 700, color: C.red }}>{svc.penaltiesCount} ({fmtCurrency(svc.penaltiesAmount, svc.currency)})</span>
                        ) : (
                          <span style={{ fontSize: 10, color: C.g400 }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* List View */}
      {!isLoading && view === "list" && (
        <>
          {/* Search & Filters */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.g400 }} />
              <Input
                placeholder="Buscar por cliente o servicio..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 36, background: "#fff", border: `1px solid ${C.g200}` }}
              />
              {search && (
                <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer" }}>
                  <X size={14} color={C.g400} />
                </button>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} style={{ gap: 6 }}>
              <Filter size={14} /> Filtros
            </Button>
          </div>

          {showFilters && (
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger style={{ width: 180, background: "#fff" }}><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="pausado">Pausado</SelectItem>
                  <SelectItem value="completado">Completado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger style={{ width: 200, background: "#fff" }}><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {RECURRING_SERVICE_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Empty state */}
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: 60, background: "#fff", borderRadius: 12, border: `1px solid ${C.g200}` }}>
              <RefreshCw size={48} color={C.g300} style={{ margin: "0 auto 16px" }} />
              <h3 style={{ fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 8 }}>
                {services?.length === 0 ? "Sin servicios recurrentes" : "Sin resultados"}
              </h3>
              <p style={{ fontSize: 13, color: C.g400, marginBottom: 20 }}>
                {services?.length === 0
                  ? "Crea tu primer servicio recurrente para comenzar"
                  : "Ajusta los filtros de búsqueda"}
              </p>
              {services?.length === 0 && canCreate && (
                <Button onClick={() => navigate("/recurring-services/new")} style={{ background: C.accent, color: "#fff" }}>
                  <Plus size={16} className="mr-1" /> Crear Servicio
                </Button>
              )}
            </div>
          )}

          {/* Service cards */}
          {filtered.length > 0 && (
            <div style={{ display: "grid", gap: 12 }}>
              {filtered.map((svc: any) => {
                const st = STATUS_CONFIG[svc.status] ?? STATUS_CONFIG.activo;
                const StIcon = st.icon;
                const stageInfo = STAGE_LABELS[svc.currentStage] ?? { label: svc.currentStage, color: C.g400 };
                return (
                  <div
                    key={svc.id}
                    onClick={() => navigate(`/recurring-services/${svc.id}`)}
                    style={{
                      background: "#fff", borderRadius: 12, border: `1px solid ${C.g200}`,
                      padding: "20px 24px", cursor: "pointer", transition: "all .15s",
                      boxShadow: "0 1px 4px rgba(10,22,40,.04)",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = C.accent; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 2px 12px rgba(59,142,232,.12)`; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = C.g200; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 4px rgba(10,22,40,.04)"; }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                            background: st.bg, color: st.fg, display: "inline-flex", alignItems: "center", gap: 4,
                          }}>
                            <StIcon size={10} /> {st.label}
                          </span>
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                            background: `${stageInfo.color}15`, color: stageInfo.color,
                          }}>
                            {stageInfo.label}
                          </span>
                          <span style={{
                            fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
                            background: C.g150, color: C.g400,
                          }}>
                            {RECURRING_SERVICE_TYPE_LABELS[svc.serviceType as keyof typeof RECURRING_SERVICE_TYPE_LABELS] ?? svc.serviceType}
                          </span>
                        </div>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: C.navy, marginBottom: 2 }}>
                          {svc.serviceName}
                        </h3>
                        <p style={{ fontSize: 12, color: C.g400 }}>
                          {svc.clientName} &middot; {svc.durationMonths} meses &middot; {svc.currency} {svc.fixedMonthlyAmount ? `${parseFloat(svc.fixedMonthlyAmount).toLocaleString()}/mes` : "Cuotas variables"}
                        </p>
                      </div>
                      <ArrowRight size={18} color={C.g300} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
