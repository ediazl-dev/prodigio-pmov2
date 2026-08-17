import { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import AppBreadcrumb from "@/components/AppBreadcrumb";

/* ── Shared palette (same as LinkedProjectDashboard / admin pages) ── */
const C = {
  navy:    "#0B1A2E",
  navy2:   "#132B4A",
  blue:    "#1E6BB8",
  teal:    "#10B981",
  gold:    "#F59E0B",
  rose:    "#E91E8C",
  g100:    "#F4F7FB",
  g200:    "#E8EDF5",
  g300:    "#CBD5E1",
  white:   "#FFFFFF",
  textPrimary:   "#0F172A",
  textSecondary: "#64748B",
};

/* ── Stage icon colors per stage key ── */
const stageColors: Record<string, { bg: string; fg: string; label: string }> = {
  sow:          { bg: "#FDE8F5", fg: "#E91E8C", label: "Elaboración SoW" },
  jira:         { bg: "#E0F2FE", fg: "#0284C7", label: "Creación Jira" },
  risks:        { bg: "#FFF7ED", fg: "#EA580C", label: "Riesgos y Acta" },
  planning:     { bg: "#ECFDF5", fg: "#059669", label: "Planificación" },
  advance:      { bg: "#F0F9FF", fg: "#0EA5E9", label: "Avance Proyecto" },
  closure:      { bg: "#F5F3FF", fg: "#7C3AED", label: "Cierre" },
};

interface StageLayoutProps {
  /** Project name shown in header */
  projectName: string;
  /** Project ID for navigation */
  projectId: number;
  /** Stage key: sow | jira | risks | planning | advance | closure */
  stageKey: string;
  /** Optional subtitle under stage name */
  subtitle?: string;
  /** Stage icon (lucide component) */
  icon: ReactNode;
  /** Optional right-side header content (buttons, badges) */
  headerRight?: ReactNode;
  /** Optional additional breadcrumb segments before the stage */
  breadcrumbExtra?: { label: string; href: string }[];
  /** Main content */
  children: ReactNode;
}

export default function StageLayout({
  projectName,
  projectId,
  stageKey,
  subtitle,
  icon,
  headerRight,
  breadcrumbExtra = [],
  children,
}: StageLayoutProps) {
  const [, setLocation] = useLocation();
  const sc = stageColors[stageKey] || stageColors.sow;

  const breadcrumbSegments = [
    { label: "PMO Proyectos", href: "/projects" },
    { label: projectName || "Proyecto", href: `/projects/${projectId}` },
    ...breadcrumbExtra,
    { label: sc.label },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.g100, fontFamily: "'Inter', sans-serif" }}>
      {/* ── NAVY HEADER ── */}
      <div
        style={{
          background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navy2} 100%)`,
          padding: "24px 32px 28px",
          color: "#fff",
        }}
      >
        {/* Breadcrumb */}
        <div style={{ marginBottom: 12, opacity: 0.7 }}>
          <AppBreadcrumb segments={breadcrumbSegments} />
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Back button */}
            <button
              onClick={() => setLocation(`/projects/${projectId}`)}
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 10,
                padding: "8px 10px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                color: "#fff",
              }}
              title="Volver al proyecto"
            >
              <ArrowLeft size={18} />
            </button>

            {/* Stage icon */}
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: sc.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: sc.fg,
              }}
            >
              {icon}
            </div>

            {/* Title */}
            <div>
              <h1
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  margin: 0,
                  letterSpacing: "-0.02em",
                }}
              >
                {sc.label}
              </h1>
              {subtitle && (
                <p style={{ fontSize: 13, opacity: 0.7, margin: "2px 0 0" }}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Right side */}
          {headerRight && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {headerRight}
            </div>
          )}
        </div>
      </div>

      {/* ── BODY ── */}
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "28px 32px 40px",
        }}
      >
        {children}
      </div>

      {/* ── FOOTER ── */}
      <div
        style={{
          background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navy2} 100%)`,
          padding: "16px 32px",
          textAlign: "center",
          color: "rgba(255,255,255,0.4)",
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.08em",
        }}
      >
        PRODIGIO TECH &middot; PMO PLATFORM
      </div>
    </div>
  );
}

export { C, stageColors };
