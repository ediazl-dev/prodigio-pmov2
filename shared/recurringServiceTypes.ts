import { z } from "zod";

export const RECURRING_SERVICE_TYPE_VALUES = [
  "soporte_incidentes",
  "requerimientos",
  "evolutivos",
  "mixto",
  "staffing",
] as const;

export const recurringServiceTypeSchema = z.enum(RECURRING_SERVICE_TYPE_VALUES);

export type RecurringServiceType = z.infer<typeof recurringServiceTypeSchema>;

export const RECURRING_SERVICE_TYPE_OPTIONS: ReadonlyArray<{
  value: RecurringServiceType;
  label: string;
  color: string;
}> = [
  { value: "soporte_incidentes", label: "Soporte e Incidentes", color: "#E91E8C" },
  { value: "requerimientos", label: "Requerimientos", color: "#0D9488" },
  { value: "evolutivos", label: "Evolutivos", color: "#8B5CF6" },
  { value: "mixto", label: "Mixto", color: "#D4A017" },
  { value: "staffing", label: "Staffing", color: "#2563EB" },
];

export const RECURRING_SERVICE_TYPE_LABELS: Record<RecurringServiceType, string> =
  Object.fromEntries(
    RECURRING_SERVICE_TYPE_OPTIONS.map(({ value, label }) => [value, label])
  ) as Record<RecurringServiceType, string>;
