import { formatPmoProjectId } from "@shared/projectIdentity";
import React from "react";

type ProjectIdBadgeProps = {
  projectId: number | string;
  tone?: "light" | "dark" | "muted";
  className?: string;
};

const TONES = {
  light: { background: "#EEF2F7", color: "#334155", borderColor: "#D8E2EF" },
  dark: {
    background: "rgba(255,255,255,.10)",
    color: "#E2E8F0",
    borderColor: "rgba(255,255,255,.20)",
  },
  muted: {
    background: "transparent",
    color: "#7A8FA8",
    borderColor: "#D8E2EF",
  },
} as const;

export function ProjectIdBadge({
  projectId,
  tone = "light",
  className,
}: ProjectIdBadgeProps) {
  const code = formatPmoProjectId(projectId);
  const palette = TONES[tone];

  return (
    <span
      className={className}
      title={`Identificador interno del proyecto: ${code}`}
      aria-label={`Identificador interno ${code}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        width: "max-content",
        border: `1px solid ${palette.borderColor}`,
        borderRadius: 999,
        background: palette.background,
        color: palette.color,
        padding: "2px 7px",
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: ".04em",
        lineHeight: 1.25,
        whiteSpace: "nowrap",
      }}
    >
      {code}
    </span>
  );
}
