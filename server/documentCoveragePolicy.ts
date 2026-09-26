import type { RecurringServiceType } from "../shared/recurringServiceTypes";

export type DocumentEntityType = "project" | "recurring_service";
export type DocumentLifecycle = "open" | "historical" | "unconfirmed";
export type DocumentLifecycleDetail = "active" | "paused" | "completed" | "cancelled" | "missing_open_record";
export type RequirementApplicability = "required" | "conditional" | "optional" | "not_applicable" | "unconfirmed";
export type DocumentRequirementKind =
  | "contract_sow"
  | "gantt_baseline"
  | "milestone_acceptance"
  | "executive_minutes"
  | "recovery_plan"
  | "closure_document"
  | "service_contract"
  | "service_sow"
  | "service_proposal"
  | "service_work_plan"
  | "service_periodic_report";

export type RequirementPolicy = {
  kind: DocumentRequirementKind;
  label: string;
  applicability: RequirementApplicability;
  rationale: string;
};

type OperationalStatus = "activo" | "pausado" | "completado" | "cancelado" | null | undefined;

export function resolveDocumentLifecycle(status: OperationalStatus): {
  lifecycle: DocumentLifecycle;
  detail: DocumentLifecycleDetail;
  label: string;
  reason: string;
} {
  if (status === "activo") {
    return { lifecycle: "open", detail: "active", label: "Abierto", reason: "Registro operativo activo en PMO." };
  }
  if (status === "pausado") {
    return { lifecycle: "open", detail: "paused", label: "Abierto pausado", reason: "Registro operativo pausado; continúa dentro de la cartera abierta." };
  }
  if (status === "completado") {
    return { lifecycle: "historical", detail: "completed", label: "Histórico completado", reason: "Registro operativo completado en PMO." };
  }
  if (status === "cancelado") {
    return { lifecycle: "historical", detail: "cancelled", label: "Histórico cancelado", reason: "Registro operativo cancelado en PMO." };
  }
  return {
    lifecycle: "unconfirmed",
    detail: "missing_open_record",
    label: "Clasificación por confirmar",
    reason: "No existe un estado operativo vigente que permita clasificar la entidad.",
  };
}

function cadenceApplicability(meetingFrequency?: string | null): RequirementPolicy {
  const normalized = String(meetingFrequency ?? "").trim().toLowerCase();
  if (/seman/.test(normalized)) {
    return {
      kind: "executive_minutes",
      label: "Minutas ejecutivas semanales",
      applicability: "required",
      rationale: "El SoW declara una cadencia semanal; sólo las minutas revisadas acreditan cobertura.",
    };
  }
  if (normalized) {
    return {
      kind: "executive_minutes",
      label: "Minutas ejecutivas",
      applicability: "unconfirmed",
      rationale: `La cadencia declarada (${meetingFrequency}) requiere una regla temporal explícita antes de medir cumplimiento.`,
    };
  }
  return {
    kind: "executive_minutes",
    label: "Minutas ejecutivas",
    applicability: "unconfirmed",
    rationale: "No existe una cadencia documental configurada; no se inventa una obligación periódica.",
  };
}

export function projectDocumentPolicy(input: {
  lifecycle: DocumentLifecycle;
  currentStage?: string | null;
  meetingFrequency?: string | null;
  hasApprovedBaseline: boolean;
  recoveryPlanRequired: boolean | null;
}): RequirementPolicy[] {
  const needsGantt = input.hasApprovedBaseline || input.lifecycle === "historical" || ["planning", "design", "closure"].includes(String(input.currentStage ?? ""));
  const needsClosure = input.lifecycle === "historical" || input.currentStage === "closure";
  return [
    {
      kind: "contract_sow",
      label: "SoW contractual",
      applicability: "required",
      rationale: "Todo proyecto debe conservar la fuente contractual que define alcance y compromisos.",
    },
    {
      kind: "gantt_baseline",
      label: "Gantt o baseline contractual",
      applicability: needsGantt ? "required" : "conditional",
      rationale: needsGantt
        ? "El proyecto alcanzó planificación/ejecución, tiene baseline aprobado o ya es histórico."
        : "Será exigible al formalizar la línea base contractual.",
    },
    {
      kind: "milestone_acceptance",
      label: "Actas de aceptación por hito",
      applicability: "conditional",
      rationale: "Cada hito cerrado en Jira o aceptado debe conservar un acta válida vinculada al hito correcto.",
    },
    cadenceApplicability(input.meetingFrequency),
    {
      kind: "recovery_plan",
      label: "Plan de recuperación",
      applicability: input.recoveryPlanRequired === true ? "required" : input.recoveryPlanRequired === false ? "not_applicable" : "unconfirmed",
      rationale: input.recoveryPlanRequired === true
        ? "Existe un gatillo de gobierno que exige plan de recuperación."
        : input.recoveryPlanRequired === false
          ? "No existe un gatillo de gobierno activo que exija este documento."
          : "La fuente actual no determina si existe un gatillo de recuperación.",
    },
    {
      kind: "closure_document",
      label: "Evidencia de cierre administrativo",
      applicability: needsClosure ? "required" : "not_applicable",
      rationale: needsClosure
        ? "La entidad está en cierre o ya es histórica y debe conservar evidencia final."
        : "La evidencia final será exigible al iniciar el cierre administrativo.",
    },
  ];
}

export function recurringServiceDocumentPolicy(input: {
  lifecycle: DocumentLifecycle;
  serviceType: RecurringServiceType;
  hasReportSchedule: boolean;
}): RequirementPolicy[] {
  return [
    {
      kind: "service_contract",
      label: "Contrato del servicio",
      applicability: "required",
      rationale: "Todo servicio recurrente debe conservar el contrato que acredita su vigencia y condiciones.",
    },
    {
      kind: "service_sow",
      label: "SoW del servicio",
      applicability: "required",
      rationale: "El SoW define alcance y obligaciones del servicio recurrente.",
    },
    {
      kind: "service_proposal",
      label: "Propuesta técnica",
      applicability: "optional",
      rationale: "Se informa cuando existe, pero no se presume obligatoria sin una política contractual explícita.",
    },
    {
      kind: "service_work_plan",
      label: "Plan de trabajo",
      applicability: input.serviceType === "staffing" ? "conditional" : "required",
      rationale: input.serviceType === "staffing"
        ? "En Staffing su exigibilidad depende del acuerdo operativo; se mantiene visible sin inventar obligación."
        : "Los servicios de soporte, evolutivos, requerimientos o mixtos requieren un plan operacional verificable.",
    },
    {
      kind: "service_periodic_report",
      label: "Reportes periódicos",
      applicability: input.hasReportSchedule ? "required" : "unconfirmed",
      rationale: input.hasReportSchedule
        ? "Existe un calendario persistido de reportes exigibles."
        : "No existe calendario persistido; no se generan períodos ni vencimientos artificiales.",
    },
  ];
}
