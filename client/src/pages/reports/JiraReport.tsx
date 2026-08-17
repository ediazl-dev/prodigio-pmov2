import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Search, Loader2, ArrowUpRight, Target, BarChart3, Users, ShieldAlert, Milestone, Filter, X, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/* ─── Palette (aligned with LinkedProjectDashboard) ─── */
const C = {
  navy: "#0A1628", navy2: "#112240", navy3: "#1A3358",
  blue: "#1B4F8A", blue2: "#2563AB", accent: "#3B8EE8",
  teal: "#0D7A6B", teal2: "#12A08D",
  gold: "#B8860B", gold2: "#D4A017",
  red: "#B83232", green: "#1A7A4A",
  g100: "#F4F7FB", g150: "#EBF0F7", g200: "#D8E2EF", g300: "#B0BDD0", g400: "#7A8FA8",
};

/* ─── helpers ─── */
const semColor = (p: number) => p >= 80 ? C.teal : p >= 50 ? C.gold : C.red;
const semLabel = (p: number) => p >= 80 ? "VERDE" : p >= 50 ? "AMARILLO" : "ROJO";
const semBg = (p: number) => p >= 80 ? "#E8F5E9" : p >= 50 ? "#FFF8E1" : "#FFEBEE";

type FilterType = "all" | "jira" | "pmo-only";

export default function JiraReport() {
  const { data, isLoading, error } = trpc.jira.enrichedConsolidatedReport.useQuery();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");

  const filteredProjects = useMemo(() => {
    if (!data) return [];
    let projects = [...data.projects];
    if (filterType === "jira") projects = projects.filter((p: any) => p.projectKey);
    else if (filterType === "pmo-only") projects = projects.filter((p: any) => !p.projectKey);
    if (search.trim()) {
      const q = search.toLowerCase();
      projects = projects.filter((p: any) =>
        (p.projectName ?? "").toLowerCase().includes(q) ||
        (p.clientName ?? "").toLowerCase().includes(q) ||
        (p.projectKey ?? "").toLowerCase().includes(q) ||
        (p.dealNumber ?? "").toLowerCase().includes(q) ||
        (p.pmoProjectName ?? "").toLowerCase().includes(q)
      );
    }
    return projects.sort((a: any, b: any) => {
      if (a.projectKey && !b.projectKey) return -1;
      if (!a.projectKey && b.projectKey) return 1;
      return (b.percentComplete ?? 0) - (a.percentComplete ?? 0);
    });
  }, [data, search, filterType]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.g100 }}>
        <Loader2 className="animate-spin mr-2" style={{ color: C.accent }} size={24} />
        <span style={{ color: C.g400, fontSize: 14 }}>Cargando datos de proyectos...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.g100 }}>
        <div className="text-center">
          <AlertTriangle size={40} style={{ color: C.red }} className="mx-auto mb-4" />
          <p style={{ color: C.navy, fontSize: 16, fontWeight: 700 }}>Error al cargar reportes</p>
          <p style={{ color: C.g400, fontSize: 13, marginTop: 8 }}>{error.message}</p>
        </div>
      </div>
    );
  }

  const jiraCount = data?.projects.filter((p: any) => p.projectKey).length ?? 0;
  const pmoOnlyCount = data?.projects.filter((p: any) => !p.projectKey).length ?? 0;

  return (
    <div className="min-h-screen" style={{ background: C.g100, fontFamily: "'Inter', sans-serif", color: C.navy }}>
      {/* ═══ HEADER ═══ */}
      <div style={{
        background: `linear-gradient(160deg, ${C.navy} 0%, ${C.navy2} 55%, ${C.navy3} 100%)`,
        borderBottom: `3px solid ${C.accent}`,
      }}>
        <div style={{ padding: "22px 36px 18px" }}>
          <div className="flex items-center gap-2.5" style={{ marginBottom: 8 }}>
            <span style={{
              background: "rgba(59,142,232,.15)", border: "1px solid rgba(59,142,232,.35)",
              borderRadius: 20, padding: "3px 12px", fontSize: 10, fontWeight: 700,
              color: C.accent, letterSpacing: ".1em", textTransform: "uppercase",
            }}>Reportes</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,.45)", fontWeight: 500 }}>
              · {new Date().toLocaleDateString("es-CL", { month: "long", year: "numeric" })}
            </span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-.5px", lineHeight: 1.15 }}>
            Reporte de Avance JIRA
          </h1>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginTop: 4 }}>
            Vista consolidada de proyectos con integración JIRA y PMO
          </p>

          {/* ─── KPI Summary (inside header, navy style) ─── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14, marginTop: 18 }}>
            {[
              { label: "Total Proyectos", value: data?.totalProjects ?? 0, icon: BarChart3, color: C.accent },
              { label: "Spaces JIRA", value: data?.totalJiraSpaces ?? 0, icon: Target, color: C.teal2 },
              { label: "Issues Totales", value: data?.totalIssues ?? 0, icon: Milestone, color: C.gold2 },
              { label: "Avance Promedio", value: `${data?.avgProgress ?? 0}%`, icon: CheckCircle2, color: semColor(data?.avgProgress ?? 0) },
            ].map((kpi, i) => (
              <div key={i} style={{
                background: "rgba(255,255,255,.06)", borderRadius: 10, padding: "14px 16px",
                border: "1px solid rgba(255,255,255,.08)",
              }}>
                <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                  <kpi.icon size={13} style={{ color: kpi.color }} />
                  <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".09em", color: "rgba(255,255,255,.45)" }}>{kpi.label}</span>
                </div>
                <p style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-.5px" }}>{kpi.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ SEARCH & FILTERS ═══ */}
      <div style={{ padding: "20px 28px 0" }}>
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
          <div className="relative flex-1 w-full">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.g400 }} />
            <Input
              placeholder="Buscar por nombre, cliente, key JIRA o deal..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-sm"
              style={{ background: "#fff", color: C.navy, borderRadius: 10, border: `1px solid ${C.g200}`, boxShadow: "0 1px 4px rgba(10,22,40,.06)" }}
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-80">
                <X size={14} style={{ color: C.g400 }} />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {([
              { key: "all" as FilterType, label: "Todos", count: (data?.totalProjects ?? 0) },
              { key: "jira" as FilterType, label: "Con JIRA", count: jiraCount },
              { key: "pmo-only" as FilterType, label: "Solo PMO", count: pmoOnlyCount },
            ]).map((f) => (
              <Button
                key={f.key}
                variant="outline"
                size="sm"
                onClick={() => setFilterType(f.key)}
                className="text-xs font-medium"
                style={{
                  background: filterType === f.key ? `${C.accent}15` : "#fff",
                  color: filterType === f.key ? C.accent : C.g400,
                  border: filterType === f.key ? `1.5px solid ${C.accent}55` : `1px solid ${C.g200}`,
                  borderRadius: 8,
                  boxShadow: filterType === f.key ? "none" : "0 1px 3px rgba(10,22,40,.04)",
                }}
              >
                <Filter size={12} className="mr-1" /> {f.label} ({f.count})
              </Button>
            ))}
          </div>
        </div>

        {/* ─── RESULTS COUNT ─── */}
        <p style={{ fontSize: 11, color: C.g400, marginTop: 12, marginBottom: 16 }}>
          {filteredProjects.length} proyecto{filteredProjects.length !== 1 ? "s" : ""} encontrado{filteredProjects.length !== 1 ? "s" : ""}
          {search && ` para "${search}"`}
        </p>

        {/* ═══ PROJECT GRID ═══ */}
        {filteredProjects.length === 0 ? (
          <div className="text-center" style={{ padding: "60px 0" }}>
            <Search size={40} style={{ color: C.g300 }} className="mx-auto mb-4 opacity-40" />
            <p style={{ color: C.g400, fontSize: 13 }}>No se encontraron proyectos con los filtros seleccionados.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProjects.map((p: any, i: number) => {
              const hasJira = !!p.projectKey;
              const pctColor = semColor(p.percentComplete ?? 0);
              const pctBg = semBg(p.percentComplete ?? 0);
              return (
                <div key={i} className="transition-all hover:scale-[1.01]" style={{
                  background: "#fff", borderRadius: 12, overflow: "hidden",
                  boxShadow: "0 2px 16px rgba(10,22,40,.08)",
                  borderTop: `3px solid ${hasJira ? pctColor : C.g300}`,
                }}>
                  {/* Card Header */}
                  <div style={{ padding: "16px 20px 12px", borderBottom: `1px solid ${C.g150}` }}>
                    <div className="flex items-start justify-between" style={{ marginBottom: 6 }}>
                      <div className="flex items-center gap-2">
                        {hasJira && (
                          <span style={{
                            fontSize: 9.5, fontWeight: 700, padding: "2px 10px", borderRadius: 20,
                            background: `${C.accent}15`, color: C.accent, border: `1px solid ${C.accent}35`,
                          }}>{p.projectKey}</span>
                        )}
                        {!hasJira && (
                          <span style={{
                            fontSize: 9.5, fontWeight: 700, padding: "2px 10px", borderRadius: 20,
                            background: C.g150, color: C.g400,
                          }}>PMO</span>
                        )}
                        {hasJira && (
                          <span style={{
                            fontSize: 9.5, fontWeight: 700, padding: "2px 10px", borderRadius: 20,
                            background: pctBg, color: pctColor, letterSpacing: ".05em",
                          }}>{semLabel(p.percentComplete)}</span>
                        )}
                      </div>
                      {hasJira && (
                        <Link href={`/reports/jira/${p.projectKey}`}>
                          <button className="flex items-center gap-1 hover:opacity-80 transition-opacity" style={{ fontSize: 10, fontWeight: 600, color: C.accent }}>
                            Ver Dashboard <ArrowUpRight size={12} />
                          </button>
                        </Link>
                      )}
                    </div>
                    {hasJira ? (
                      <Link href={`/reports/jira/${p.projectKey}`}>
                        <h3 className="hover:underline cursor-pointer truncate" style={{ fontSize: 14, fontWeight: 700, color: C.navy }} title={p.projectName}>
                          {p.projectName}
                        </h3>
                      </Link>
                    ) : (
                      <h3 className="truncate" style={{ fontSize: 14, fontWeight: 700, color: C.navy }} title={p.projectName}>
                        {p.projectName}
                      </h3>
                    )}
                    {p.clientName && (
                      <p className="truncate" style={{ fontSize: 11, color: C.g400, marginTop: 2 }}>{p.clientName}</p>
                    )}
                  </div>

                  {/* Card Body */}
                  {hasJira ? (
                    <div style={{ padding: "14px 20px 16px" }}>
                      {/* Progress bar */}
                      <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
                        <div style={{ flex: 1, height: 7, background: C.g200, borderRadius: 10, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.min(p.percentComplete, 100)}%`, background: pctColor, borderRadius: 10, transition: "width .3s" }} />
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 800, color: pctColor, minWidth: 40, textAlign: "right" }}>{p.percentComplete}%</span>
                      </div>

                      {/* Mini KPIs */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                        {[
                          { label: "Issues", value: `${p.done}/${p.total}`, icon: Target, color: pctColor },
                          { label: "Hitos", value: `${p.milestonesDone ?? 0}/${p.milestonesCount ?? 0}`, icon: Milestone, color: (p.milestonesDone === p.milestonesCount && (p.milestonesCount ?? 0) > 0) ? C.teal : C.gold },
                          { label: "Riesgos", value: `${p.risksOpen ?? 0}`, icon: ShieldAlert, color: (p.risksOpen ?? 0) > 0 ? C.red : C.teal },
                        ].map((kpi, j) => (
                          <div key={j} style={{ textAlign: "center", padding: "8px 6px", background: C.g100, borderRadius: 8 }}>
                            <kpi.icon size={12} style={{ color: kpi.color }} className="mx-auto" />
                            <p style={{ fontSize: 13, fontWeight: 800, color: C.navy, marginTop: 2 }}>{kpi.value}</p>
                            <p style={{ fontSize: 9.5, color: C.g400, fontWeight: 500 }}>{kpi.label}</p>
                          </div>
                        ))}
                      </div>

                      {/* Bottom row */}
                      <div className="flex items-center justify-between" style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.g150}` }}>
                        <div className="flex items-center gap-1">
                          <BarChart3 size={11} style={{ color: C.g400 }} />
                          <span style={{ fontSize: 10, color: C.g400 }}>{p.epicsCount ?? 0} epicas</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users size={11} style={{ color: C.g400 }} />
                          <span style={{ fontSize: 10, color: C.g400 }}>{p.teamSize ?? 0} miembros</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock size={11} style={{ color: C.g400 }} />
                          <span style={{ fontSize: 10, color: C.g400 }}>{p.inProgress ?? 0} activos</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: "14px 20px 16px" }}>
                      <div className="flex items-center gap-2" style={{ padding: "10px 14px", background: "#FFF8E1", borderRadius: 9, borderLeft: `3px solid ${C.gold}` }}>
                        <AlertTriangle size={14} style={{ color: C.gold }} />
                        <p style={{ fontSize: 11, color: C.g400, lineHeight: 1.5 }}>
                          Sin espacio JIRA vinculado. Crea un Space JIRA desde la plataforma PMO para habilitar el seguimiento.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ FOOTER ═══ */}
      <div style={{
        background: C.navy2, padding: "12px 36px", marginTop: 32,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderTop: "1px solid rgba(255,255,255,.06)",
      }}>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,.3)" }}>Prodigio Tech · Reporte de Avance JIRA · Confidencial</span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,.3)" }}>
          Actualizado: {data?.lastUpdated ? new Date(data.lastUpdated).toLocaleString("es-CL") : "N/A"}
        </span>
      </div>
    </div>
  );
}
