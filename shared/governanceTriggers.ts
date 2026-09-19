export const GOVERNANCE_TRIGGER_CATALOG = {
  "G-01": {
    shortLabel: "Eficiencia crítica",
    cause: "CPI-H inferior a 0,60",
    recommendation: "Revisar eficiencia de ejecución y capacidad",
  },
  "G-02": {
    shortLabel: "Sobrecosto contractual",
    cause: "Costo ejecutado sobre presupuesto con cumplimiento contractual bajo",
    recommendation: "Revisar sobrecosto y plan de contención",
  },
  "G-03": {
    shortLabel: "Retraso contractual",
    cause: "Desviación de ruta contractual superior a 15 días",
    recommendation: "Revisar cronograma contractual y recuperación",
  },
  "G-04": {
    shortLabel: "Sin minutas",
    cause: "Tres o más semanas consecutivas sin minuta validada",
    recommendation: "Regularizar evidencia de gobierno",
  },
  "G-05": {
    shortLabel: "Plan de recuperación vencido",
    cause: "Plan de recuperación requerido y fuera de plazo",
    recommendation: "Evaluar y actualizar el plan de recuperación",
  },
  "G-06": {
    shortLabel: "Rojo consecutivo",
    cause: "Dos o más veredictos ejecutivos rojos consecutivos",
    recommendation: "Resolver continuidad y medidas ejecutivas",
  },
  "G-07": {
    shortLabel: "Desalineación Jira/contrato",
    cause: "Brecha operacional mayor a 20 puntos con cumplimiento contractual bajo",
    recommendation: "Conciliar avance Jira con evidencia contractual",
  },
} as const;

export type GovernanceTriggerCode = keyof typeof GOVERNANCE_TRIGGER_CATALOG;

export function isGovernanceTriggerCode(value: string): value is GovernanceTriggerCode {
  return value in GOVERNANCE_TRIGGER_CATALOG;
}
