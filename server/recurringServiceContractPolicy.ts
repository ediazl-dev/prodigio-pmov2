import type { RecurringServiceType } from "../shared/recurringServiceTypes";

export type GeneratedWorkPlanItem = {
  itemType: string;
  title: string;
  description?: string | null;
  frequency?: string | null;
  monthNumber?: number | null;
  dueDate?: string | null;
};

export type GeneratedSlaItem = {
  priority: string;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  coverageType: string;
};

export type RecurringServiceContractPolicy = {
  serviceType: RecurringServiceType;
  incidentSlaApplicable: boolean;
  drApplicable: boolean;
  coverage247Applicable: boolean;
  jsmWorkPlanSyncDefault: boolean;
  jsmBillingSyncDefault: boolean;
  explanation: string;
};

const STAFFING_EXCLUDED_TERMS = [
  /\b24\s*[x×]\s*7\b/i,
  /\bdisaster recovery\b/i,
  /\bprueba(?:s)?\s+dr\b/i,
  /\bparche(?:s|o|os)?\b/i,
  /\bon[- ]?call\b/i,
  /\btiempo\s+de\s+(?:respuesta|resoluci[oó]n)\b/i,
  /\bincidente(?:s)?\s+(?:cr[ií]tico|cr[ií]ticos|alta|media|baja)\b/i,
];

export function getRecurringServiceContractPolicy(
  serviceType: RecurringServiceType,
): RecurringServiceContractPolicy {
  if (serviceType === "staffing") {
    return {
      serviceType,
      incidentSlaApplicable: false,
      drApplicable: false,
      coverage247Applicable: false,
      jsmWorkPlanSyncDefault: false,
      jsmBillingSyncDefault: false,
      explanation:
        "Staffing administra capacidad y entregables del profesional en el backlog del cliente; no presupone mesa de ayuda, SLA de incidentes, DR ni cobertura 24x7.",
    };
  }

  return {
    serviceType,
    incidentSlaApplicable: true,
    drApplicable: true,
    coverage247Applicable: true,
    jsmWorkPlanSyncDefault: true,
    jsmBillingSyncDefault: true,
    explanation:
      "La aplicabilidad final depende de la evidencia contractual; estos controles pueden configurarse cuando el contrato los exige.",
  };
}

export function sanitizeGeneratedRecurringPlan(input: {
  serviceType: RecurringServiceType;
  items: GeneratedWorkPlanItem[];
  sla: GeneratedSlaItem[];
  hasSeparateBillingSchedule: boolean;
}) {
  const policy = getRecurringServiceContractPolicy(input.serviceType);
  const excluded: Array<{ title: string; reason: string }> = [];

  const items = input.items.filter(item => {
    if (input.hasSeparateBillingSchedule && item.itemType === "facturacion") {
      excluded.push({
        title: item.title,
        reason: "La facturación ya existe en el plan contractual de cuotas y no debe duplicarse como actividad.",
      });
      return false;
    }
    if (input.serviceType !== "staffing") return true;
    if (item.itemType === "sla_definition" || item.itemType === "coverage_definition") {
      excluded.push({
        title: item.title,
        reason: "Staffing no tiene SLA de incidentes ni cobertura operativa por defecto.",
      });
      return false;
    }
    const text = `${item.title} ${item.description ?? ""}`;
    if (STAFFING_EXCLUDED_TERMS.some(pattern => pattern.test(text))) {
      excluded.push({
        title: item.title,
        reason: "La actividad presupone soporte, DR, parcheo, on-call o 24x7 no aplicable a Staffing.",
      });
      return false;
    }
    return true;
  });

  const sla = policy.incidentSlaApplicable ? input.sla : [];
  if (!policy.incidentSlaApplicable) {
    for (const item of input.sla) {
      excluded.push({
        title: `SLA ${item.priority}`,
        reason: "Staffing no tiene SLA contractual de respuesta o resolución de incidentes.",
      });
    }
  }

  return { policy, items, sla, excluded };
}

export function parseStaffingContractTerms(text: string) {
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const fragments = normalized.split(/[\n.;]+/).map(value => value.trim()).filter(Boolean);
  const numberWords: Record<string, number> = { uno: 1, un: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };
  const businessDays = (fragment: string) => {
    const match = fragment.match(/(?:primeros?\s+)?(\d+|uno|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+dias?\s+habiles?/);
    if (!match) return null;
    return /^\d+$/.test(match[1]) ? Number(match[1]) : numberWords[match[1]] ?? null;
  };
  const reportFragment = fragments.find(fragment => fragment.includes("reporte mensual") && businessDays(fragment) !== null);
  const approvalFragment = fragments.find(fragment =>
    (fragment.includes("observacion") || fragment.includes("aprobacion") || fragment.includes("revision")) &&
    businessDays(fragment) !== null,
  );
  if (!reportFragment || !approvalFragment) return null;
  return {
    reportDeliveryBusinessDays: businessDays(reportFragment)!,
    approvalWindowBusinessDays: businessDays(approvalFragment)!,
  };
}

export function buildStaffingContractPlan(input: {
  durationMonths: number;
  reportDueDates: Array<string | null>;
  approvalDueDates: Array<string | null>;
  reportDeliveryBusinessDays: number;
  approvalWindowBusinessDays: number;
}) {
  const items: GeneratedWorkPlanItem[] = [];
  for (let month = 1; month <= input.durationMonths; month += 1) {
    const reportDueDate = input.reportDueDates[month - 1] ?? null;
    const approvalDueDate = input.approvalDueDates[month - 1] ?? null;
    items.push(
      {
        itemType: "tarea_programada",
        title: `Consolidar horas y capacidad · Mes ${month}`,
        description:
          "Consolidar las actividades asignadas por el cliente y las horas consumidas por el profesional durante el período.",
        frequency: "mensual",
        monthNumber: month,
        dueDate: reportDueDate,
      },
      {
        itemType: "informe_mensual",
        title: `Reporte Mensual de Servicio · Mes ${month}`,
        description:
          `Entregar al cliente el reporte mensual de actividades y horas consumidas dentro de los primeros ${input.reportDeliveryBusinessDays} días hábiles del período siguiente.`,
        frequency: "mensual",
        monthNumber: month,
        dueDate: reportDueDate,
      },
      {
        itemType: "tarea_programada",
        title: `Revisión y aprobación del reporte · Mes ${month}`,
        description:
          `Registrar observaciones o aprobación del cliente dentro de la ventana contractual de ${input.approvalWindowBusinessDays} días hábiles posteriores a la entrega.`,
        frequency: "mensual",
        monthNumber: month,
        dueDate: approvalDueDate,
      },
      {
        itemType: "tarea_programada",
        title: `Feedback de servicio · Mes ${month}`,
        description:
          "Registrar feedback o NPS como control de calidad de la gestión; no corresponde a un SLA contractual de incidentes.",
        frequency: "mensual",
        monthNumber: month,
        dueDate: approvalDueDate,
      },
    );
  }
  return items;
}
