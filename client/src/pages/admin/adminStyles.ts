/* ─── Shared palette & helpers for all Admin views ─── */
/* Aligned with Dashboard Principal, JIRA Report, Executive Dashboard, PMO Proyectos */

export const C = {
  navy: "#0A1628", navy2: "#112240", navy3: "#1A3358",
  blue: "#1B4F8A", blue2: "#2563AB", accent: "#e91e8c",
  teal: "#0D7A6B", teal2: "#12A08D",
  gold: "#B8860B", gold2: "#D4A017",
  red: "#B83232", green: "#1A7A4A",
  g100: "#F4F7FB", g150: "#EBF0F7", g200: "#D8E2EF", g300: "#B0BDD0", g400: "#7A8FA8",
} as const;

/** Standard header gradient style */
export const headerGradient = {
  background: `linear-gradient(160deg, ${C.navy} 0%, ${C.navy2} 55%, ${C.navy3} 100%)`,
  borderBottom: `3px solid ${C.accent}`,
} as const;

/** Standard page background */
export const pageBackground = {
  background: C.g100,
  fontFamily: "'Poppins', system-ui, sans-serif",
  color: C.navy,
  minHeight: "100vh",
} as const;

/** Standard card style */
export const cardStyle = {
  background: "#fff",
  borderRadius: 12,
  border: `1px solid ${C.g200}`,
  boxShadow: "0 1px 4px rgba(10,22,40,.04)",
} as const;

/** Badge pill style */
export function badgeStyle(bg: string, color: string) {
  return {
    fontSize: 9, fontWeight: 700 as const, padding: "2px 8px", borderRadius: 10,
    background: bg, color, display: "inline-block",
  };
}

/** Section title style */
export const sectionTitle = {
  fontSize: 14, fontWeight: 700 as const, color: C.navy, letterSpacing: "-.2px",
} as const;

/** Footer style */
export const footerStyle = {
  background: C.navy2,
  padding: "12px 36px",
  display: "flex" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
  borderTop: `1px solid ${C.navy3}`,
} as const;

/** Footer text style */
export const footerText = {
  fontSize: 10, color: "rgba(255,255,255,.3)",
} as const;

/** KPI card in header */
export const headerKpiCard = {
  background: "rgba(255,255,255,.06)",
  borderRadius: 10,
  padding: "12px 14px",
  border: "1px solid rgba(255,255,255,.08)",
} as const;

/** KPI label in header */
export const headerKpiLabel = {
  fontSize: 9, fontWeight: 700 as const, textTransform: "uppercase" as const,
  letterSpacing: ".09em", color: "rgba(255,255,255,.4)",
} as const;

/** KPI value in header */
export const headerKpiValue = {
  fontSize: 20, fontWeight: 800 as const, color: "#fff", letterSpacing: "-.5px",
} as const;

/** Header badge style */
export function headerBadge(text: string) {
  return {
    background: "rgba(59,142,232,.15)",
    border: "1px solid rgba(59,142,232,.35)",
    borderRadius: 20,
    padding: "3px 12px",
    fontSize: 10,
    fontWeight: 700 as const,
    color: C.accent,
    letterSpacing: ".1em",
    textTransform: "uppercase" as const,
  };
}

/** Header subtitle style */
export const headerSubtitle = {
  fontSize: 12, color: "rgba(255,255,255,.5)", marginTop: 4,
} as const;

/** Table header cell style */
export const thStyle = {
  fontSize: 9, fontWeight: 700 as const, textTransform: "uppercase" as const,
  letterSpacing: ".08em", color: C.g400, padding: "10px 14px",
  borderBottom: `1px solid ${C.g200}`, textAlign: "left" as const,
} as const;

/** Table body cell style */
export const tdStyle = {
  fontSize: 12, color: C.navy, padding: "12px 14px",
  borderBottom: `1px solid ${C.g100}`,
} as const;

/** Empty state style */
export const emptyState = {
  textAlign: "center" as const, padding: "60px 0",
} as const;
