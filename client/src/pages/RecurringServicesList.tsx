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
import { ClassicManagementDashboard } from "./recurring/ClassicManagementDashboard";

const C = {
  navy: "#0A1628", navy2: "#112240", navy3: "#1A3358",
  blue: "#1B4F8A", blue2: "#2563AB", accent: "#e91e8c",
  teal: "#0D7A6B", teal2: "#12A08D",
  gold2: "#D4A017",
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
  return `${currency} ${val.toLocaleString("es-CL")}`;
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
  const [view, setView] = useState<"tower" | "dashboard" | "list">(() => {
    if (typeof window === "undefined") return "tower";
    const requested = new URLSearchParams(window.location.search).get("view");
    if (requested === "classic") return "dashboard";
    if (requested === "list") return "list";
    return "tower";
  });
  const classicInput = useMemo(() => ({ cutOffDate: new Date().toISOString().slice(0, 10) }), []);
  const {
    data: classicData,
    isLoading: loadingClassic,
    error: classicError,
  } = trpc.recurringServices.dashboardV2.useQuery(classicInput, { enabled: view === "dashboard", staleTime: 30_000 });

  const filtered = useMemo(() => {
    if (!services) return [];
    return services.filter((s: any) => {
      const matchSearch = !search || s.clientName.toLowerCase().includes(search.toLowerCase()) || s.serviceName.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || s.status === statusFilter;
      const matchType = typeFilter === "all" || s.serviceType === typeFilter;
      return matchSearch && matchStatus && matchType;
    });
  }, [services, search, statusFilter, typeFilter]);

  const isLoading = loadingList || loadingKpis || (view === "dashboard" && loadingClassic);

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
        {view === "list" && kpis && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginTop: 20 }}>
            {[
              { label: "Total Servicios", value: kpis.statusCounts.total, color: "#fff", icon: RefreshCw },
              { label: "Activos", value: kpis.statusCounts.activo, color: "#4ADE80", icon: Activity },
              { label: "Programado Mes", value: fmtCurrency(kpis.billing.currentMonth.total, kpis.totalContractCurrency), color: C.gold2, icon: DollarSign },
              { label: "Facturado Mes", value: fmtCurrency(kpis.billing.currentMonth.invoiced, kpis.totalContractCurrency), color: C.teal2, icon: TrendingUp },
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
      {!isLoading && view === "dashboard" && classicData && kpis && (
        <ClassicManagementDashboard
          data={classicData}
          legacy={kpis}
          onOpenService={(serviceId) => navigate(`/recurring-services/${serviceId}`)}
        />
      )}

      {!isLoading && view === "dashboard" && classicError && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
          <div className="flex items-center gap-2 font-black">
            <XCircle size={18} /> No fue posible construir la vista gerencial clásica
          </div>
          <p className="mt-2 text-sm">{classicError.message}</p>
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
