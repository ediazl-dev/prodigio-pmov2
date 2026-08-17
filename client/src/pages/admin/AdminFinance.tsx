import { trpc } from "@/lib/trpc";
import { BarChart3, DollarSign, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { C, headerGradient, cardStyle, headerKpiCard, headerKpiLabel, headerKpiValue, thStyle, tdStyle, footerStyle, footerText } from "./adminStyles";

export default function AdminFinance() {
  const { data: projects } = trpc.projects.list.useQuery();

  const projectsWithAmount = (projects ?? []).filter((p: any) => p.totalAmount && parseFloat(p.totalAmount) > 0);
  const totalRevenue = projectsWithAmount.reduce((sum: number, p: any) => sum + parseFloat(p.totalAmount || "0"), 0);
  const activeRevenue = projectsWithAmount.filter((p: any) => p.status === "activo").reduce((sum: number, p: any) => sum + parseFloat(p.totalAmount || "0"), 0);
  const completedRevenue = projectsWithAmount.filter((p: any) => p.status === "completado").reduce((sum: number, p: any) => sum + parseFloat(p.totalAmount || "0"), 0);

  const chartData = projectsWithAmount.slice(0, 8).map((p: any) => ({
    name: p.projectName?.substring(0, 15) + (p.projectName?.length > 15 ? "..." : ""),
    amount: parseFloat(p.totalAmount || "0"),
    currency: p.currency,
  }));

  const COLORS = [C.accent, C.teal, C.gold, C.blue, C.teal2, C.blue2, C.gold2, C.green];

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; color: string }> = {
      activo: { bg: `${C.green}18`, color: C.green },
      completado: { bg: `${C.accent}18`, color: C.accent },
      pausado: { bg: `${C.gold}18`, color: C.gold },
    };
    const s = map[status] ?? { bg: `${C.red}18`, color: C.red };
    return { fontSize: 10, fontWeight: 700 as const, padding: "2px 8px", borderRadius: 10, background: s.bg, color: s.color, display: "inline-block" };
  };

  return (
    <div style={{ background: C.g100, fontFamily: "'Inter', sans-serif", color: C.navy, minHeight: "100vh" }}>
      {/* ── HEADER ── */}
      <div style={{ ...headerGradient, padding: "32px 36px 28px" }}>
        <span style={{ background: "rgba(59,142,232,.15)", border: "1px solid rgba(59,142,232,.35)", borderRadius: 20, padding: "3px 12px", fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: ".1em", textTransform: "uppercase" }}>
          ADMINISTRACIÓN
        </span>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-.5px", marginTop: 8 }}>
          Dashboard Financiero
        </h1>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginTop: 4 }}>Resumen de facturación por proyecto</p>

        <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
          {[
            { label: "Cartera Total", value: `$${totalRevenue.toLocaleString()}`, icon: <DollarSign className="h-4 w-4" style={{ color: "rgba(255,255,255,.4)" }} /> },
            { label: "Activos", value: `$${activeRevenue.toLocaleString()}`, icon: <TrendingUp className="h-4 w-4" style={{ color: "rgba(255,255,255,.4)" }} /> },
            { label: "Completados", value: `$${completedRevenue.toLocaleString()}`, icon: <BarChart3 className="h-4 w-4" style={{ color: "rgba(255,255,255,.4)" }} /> },
            { label: "Proyectos", value: projectsWithAmount.length },
          ].map((k) => (
            <div key={k.label} style={headerKpiCard}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={headerKpiLabel}>{k.label}</div>
              </div>
              <div style={headerKpiValue}>{k.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ padding: "28px 36px", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Chart */}
        {chartData.length > 0 && (
          <div style={{ ...cardStyle, padding: "20px 24px" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 16 }}>Facturación por Proyecto</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 40 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.g400 }} angle={-30} textAnchor="end" />
                <YAxis tick={{ fontSize: 10, fill: C.g400 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.g200}` }} formatter={(v: any, _: any, props: any) => [`${props.payload.currency} ${Number(v).toLocaleString()}`, "Monto"]} />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                  {chartData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Table */}
        <div style={{ ...cardStyle, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.g200}` }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>Detalle por Proyecto</h3>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Proyecto</th>
                  <th style={thStyle}>Cliente</th>
                  <th style={thStyle}>Estado</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {(projects ?? []).map((p: any) => (
                  <tr key={p.id} style={{ transition: "background .15s" }} onMouseEnter={(e) => (e.currentTarget.style.background = C.g100)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{p.projectName}</td>
                    <td style={{ ...tdStyle, color: C.g400, fontSize: 11 }}>{p.clientName}</td>
                    <td style={tdStyle}><span style={statusBadge(p.status)}>{p.status}</span></td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>
                      {p.totalAmount ? `${p.currency} ${Number(p.totalAmount).toLocaleString()}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div style={footerStyle}>
        <span style={footerText}>Prodigio PMO — Dashboard Financiero</span>
        <span style={footerText}>{new Date().getFullYear()}</span>
      </div>
    </div>
  );
}
