export type RecurringHealthKey = "critical" | "attention" | "stable" | "no_data";

export const RECURRING_HEALTH_UI: Record<
  RecurringHealthKey,
  { label: string; shortLabel: string; tone: string; surface: string; border: string }
> = {
  critical: {
    label: "Crítico",
    shortLabel: "Críticos",
    tone: "#B42318",
    surface: "#FEF3F2",
    border: "#FDA29B",
  },
  attention: {
    label: "Atención",
    shortLabel: "En atención",
    tone: "#B54708",
    surface: "#FFFAEB",
    border: "#FEDF89",
  },
  stable: {
    label: "Estable",
    shortLabel: "Estables",
    tone: "#067647",
    surface: "#ECFDF3",
    border: "#ABEFC6",
  },
  no_data: {
    label: "Sin datos",
    shortLabel: "Sin datos",
    tone: "#475467",
    surface: "#F2F4F7",
    border: "#D0D5DD",
  },
};

export function formatRecurringMoney(value: number, currency: string): string {
  const formatted = new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: currency === "CLP" ? 0 : 1,
    notation: Math.abs(value) >= 1_000_000 ? "compact" : "standard",
  }).format(value);
  return `${currency} ${formatted}`;
}

export function formatRecurringPercent(value: number | null): string {
  return value === null ? "N/D" : `${value.toLocaleString("es-CL", { maximumFractionDigits: 1 })}%`;
}

export function formatCutOffDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatRecurringMonth(value: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return "Sin fecha";
  const date = new Date(`${value}-01T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CL", { month: "short", year: "2-digit", timeZone: "UTC" }).format(date);
}

export function countActiveFilters(filters: Record<string, string>): number {
  return Object.entries(filters).filter(([key, value]) => key !== "cutOffDate" && value !== "all" && value.trim() !== "").length;
}

export function currencyRows<T extends { currency: string }>(values: Record<string, T>): T[] {
  return Object.values(values).sort((a, b) => a.currency.localeCompare(b.currency, "es"));
}
