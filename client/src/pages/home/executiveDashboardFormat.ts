/**
 * Formato y tono del panel ejecutivo. El cálculo vive en el servidor
 * (`server/executivePortfolio.ts`); aquí solo se decide cómo se lee.
 *
 * Regla que este archivo hace cumplir: `null` se escribe "N/D", nunca "0".
 * Un promedio de cero etapas no es cero días, y una tasa sin denominador no
 * es 0%.
 */

import type { RouterOutputs } from "@/lib/trpc";

export type ExecutivePortfolio = RouterOutputs["projects"]["executive"];
export type AttentionRow = ExecutivePortfolio["attention"][number];
export type CurrencyFigure = ExecutivePortfolio["money"][number];
export type BottleneckRow = ExecutivePortfolio["bottlenecks"][number];

export type Tone = "alert" | "warn" | "calm" | "good";

export const TONE: Record<
  Tone,
  { text: string; surface: string; border: string }
> = {
  alert: { text: "#B42318", surface: "#FEF3F2", border: "#FDA29B" },
  warn: { text: "#B54708", surface: "#FFFAEB", border: "#FEDF89" },
  good: { text: "#067647", surface: "#ECFDF3", border: "#ABEFC6" },
  calm: { text: "#475569", surface: "#F1F5F9", border: "#CBD5E1" },
};

export const ATTENTION_STATE: Record<
  AttentionRow["state"],
  { label: string; tone: Tone }
> = {
  overdue: { label: "Vencida", tone: "alert" },
  at_risk: { label: "En riesgo", tone: "warn" },
  on_track: { label: "Al día", tone: "good" },
  no_deadline: { label: "Sin medir", tone: "calm" },
};

export function money(value: number, currency: string): string {
  return `${currency} ${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(value)}`;
}

/** Varias monedas se listan, nunca se suman. */
export function moneyList(
  figures: Array<{ currency: string; value: number }>
): string {
  const withValue = figures.filter(figure => figure.value > 0);
  if (withValue.length === 0) return "Sin monto";
  return withValue
    .map(figure => money(figure.value, figure.currency))
    .join(" + ");
}

export function percent(value: number | null): string {
  return value === null
    ? "N/D"
    : `${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 }).format(value)}%`;
}

export function days(value: number | null): string {
  return value === null
    ? "N/D"
    : `${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 }).format(value)} d`;
}

export function signedDays(value: number | null): string {
  if (value === null) return "N/D";
  const formatted = new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 1,
  }).format(Math.abs(value));
  return value > 0
    ? `+${formatted} d`
    : value < 0
      ? `−${formatted} d`
      : "En el límite";
}

export function longDate(value: string): string {
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("es-CL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Las cuatro cifras de primer orden                                          */
/* ────────────────────────────────────────────────────────────────────────── */

export interface HeadlineCard {
  key: "plazo" | "dinero" | "cumplimiento" | "riesgos";
  eyebrow: string;
  value: string;
  suffix: string | null;
  detail: string;
  tone: Tone;
}

export function buildHeadlineCards(
  portfolio: ExecutivePortfolio
): HeadlineCard[] {
  const { headline, money: figures, compliance, risks } = portfolio;

  const contractedActive = moneyList(
    figures.map(figure => ({
      currency: figure.currency,
      value: figure.contractedActive,
    }))
  );
  const overdueMoney = figures.filter(figure => figure.overdue > 0);
  const invoicedRate = invoicedRatio(figures);

  return [
    {
      key: "plazo",
      eyebrow: "Etapas fuera de plazo",
      value: String(headline.stagesOverdue),
      suffix: `de ${headline.stagesInProgress} en curso`,
      detail:
        headline.worstOverDays !== null
          ? `La más atrasada lleva ${headline.worstOverDays} día${headline.worstOverDays === 1 ? "" : "s"} hábil${headline.worstOverDays === 1 ? "" : "es"} de exceso`
          : headline.stagesUnmeasured > 0
            ? `${headline.stagesUnmeasured} etapa${headline.stagesUnmeasured === 1 ? "" : "s"} sin plazo medible`
            : "Ninguna etapa en curso pasada de plazo",
      tone: headline.stagesOverdue > 0 ? "alert" : "good",
    },
    {
      key: "dinero",
      eyebrow: "Contratado en ejecución",
      value: contractedActive,
      suffix: null,
      detail:
        overdueMoney.length > 0
          ? `${invoicedRate} facturado · ${moneyList(overdueMoney.map(figure => ({ currency: figure.currency, value: figure.overdue })))} vencidos`
          : `${invoicedRate} facturado · sin hitos vencidos`,
      tone: overdueMoney.length > 0 ? "alert" : "calm",
    },
    {
      key: "cumplimiento",
      eyebrow: "Cumplimiento de plazo",
      value: percent(compliance.ratePercent),
      suffix:
        compliance.total > 0
          ? `${compliance.onTime} de ${compliance.total} etapas`
          : "sin etapas cerradas",
      detail:
        compliance.total > 0
          ? `${compliance.late} etapa${compliance.late === 1 ? "" : "s"} se pasó del plazo asignado`
          : "Todavía no hay etapas cerradas que medir",
      tone:
        compliance.ratePercent === null
          ? "calm"
          : compliance.ratePercent >= 85
            ? "good"
            : compliance.ratePercent >= 70
              ? "warn"
              : "alert",
    },
    {
      key: "riesgos",
      eyebrow: "Riesgos altos abiertos",
      value: String(risks.highOpen),
      suffix:
        risks.highOpen > 0
          ? `en ${risks.projectsWithHighOpen} proyecto${risks.projectsWithHighOpen === 1 ? "" : "s"}`
          : null,
      detail:
        risks.withoutMitigation > 0
          ? `${risks.withoutMitigation} sin mitigación registrada`
          : risks.highOpen > 0
            ? "Todos con mitigación registrada"
            : "Ningún riesgo de impacto alto abierto",
      tone:
        risks.highOpen === 0
          ? "good"
          : risks.withoutMitigation > 0
            ? "alert"
            : "warn",
    },
  ];
}

function invoicedRatio(figures: CurrencyFigure[]): string {
  const contracted = figures.reduce(
    (sum, figure) => sum + figure.contractedActive + figure.contractedClosed,
    0
  );
  const invoiced = figures.reduce((sum, figure) => sum + figure.invoiced, 0);
  // Solo tiene sentido como proporción si hay una única moneda en juego.
  if (figures.length !== 1 || contracted <= 0) return "Facturación";
  return `${Math.round((invoiced / contracted) * 100)}%`;
}

/** Tono de una fila de cuello de botella según cuánto del plazo consume. */
export function bottleneckTone(row: BottleneckRow): Tone {
  if (
    row.avgUsedDays === null ||
    row.avgEffectiveAllowedDays === null ||
    row.avgEffectiveAllowedDays <= 0
  )
    return "calm";
  const ratio = row.avgUsedDays / row.avgEffectiveAllowedDays;
  if (ratio > 1) return "alert";
  if (ratio > 0.9) return "warn";
  return "good";
}

/** La etapa que más se pasa de plazo, para la conclusión al pie. */
export function worstBottleneck(rows: BottleneckRow[]): BottleneckRow | null {
  const measurable = rows.filter(
    row =>
      row.avgUsedDays !== null &&
      row.avgEffectiveAllowedDays !== null &&
      row.avgEffectiveAllowedDays > 0 &&
      row.closedCount > 0
  );
  if (measurable.length === 0) return null;
  return measurable.reduce((worst, row) =>
    (row.avgUsedDays as number) / (row.avgEffectiveAllowedDays as number) >
    (worst.avgUsedDays as number) / (worst.avgEffectiveAllowedDays as number)
      ? row
      : worst
  );
}
