import { calculateExecutiveMinutesCoverage } from "./executiveMinutesCoverage";
import {
  projectDocumentPolicy,
  recurringServiceDocumentPolicy,
  resolveDocumentLifecycle,
  type DocumentEntityType,
  type DocumentLifecycle,
  type DocumentLifecycleDetail,
  type DocumentRequirementKind,
  type RequirementApplicability,
} from "./documentCoveragePolicy";
import type { RecurringServiceType } from "../shared/recurringServiceTypes";

export type DocumentCoverageStatus =
  | "compliant"
  | "pending_validation"
  | "missing"
  | "overdue"
  | "not_applicable"
  | "unconfirmed"
  | "historical_gap";

export type DocumentEvidence = {
  id: string;
  label: string;
  source: string;
  observedAt: string | null;
  fileName?: string | null;
  validation?: string | null;
};

export type DocumentRequirement = {
  id: string;
  kind: DocumentRequirementKind;
  label: string;
  applicability: RequirementApplicability;
  status: DocumentCoverageStatus;
  rationale: string;
  detail: string;
  dueDate: string | null;
  evidence: DocumentEvidence[];
  severity: "critical" | "warning" | "info";
};

export type EvidenceAction = {
  id: string;
  requirementId: string;
  label: string;
  explanation: string;
  impact: string;
  recommendedAction: string;
  href: string;
  severity: "critical" | "warning" | "info";
};

export type EvidenceObservation = {
  id: string;
  requirementId: string;
  label: string;
  explanation: string;
};

export type DocumentCoverageEntity = {
  entityType: DocumentEntityType;
  entityId: number;
  entityName: string;
  clientName: string;
  dealId: string | null;
  ownerName: string | null;
  lifecycle: DocumentLifecycle;
  lifecycleDetail: DocumentLifecycleDetail;
  lifecycleLabel: string;
  lifecycleReason: string;
  cutoffAt: string;
  coverage: {
    required: number;
    compliant: number;
    pendingValidation: number;
    missing: number;
    overdue: number;
    historicalGaps: number;
    notApplicable: number;
    unconfirmed: number;
    percentage: number | null;
  };
  requirements: DocumentRequirement[];
  activeActions: EvidenceAction[];
  historicalObservations: EvidenceObservation[];
  latestEvidenceAt: string | null;
  counters: {
    closedMilestonesWithoutAcceptance: number;
    overdueServiceReports: number;
  };
};

export type ProjectCoverageInput = {
  entityType: "project";
  id: number;
  name: string;
  clientName: string;
  dealId?: string | null;
  ownerName?: string | null;
  status: "activo" | "pausado" | "completado" | "cancelado";
  currentStage?: string | null;
  cutoffAt: string;
  sowDocuments: Array<{ id: number; status: string; fileName?: string | null; fileUrl?: string | null; finalDocUrl?: string | null; meetingFrequency?: string | null; createdAt?: Date | string | null }>;
  linkedDocuments: Array<{ id: number; docType: "sow" | "gantt"; fileName: string; fileUrl?: string | null; createdAt?: Date | string | null }>;
  ganttUploads: Array<{ id: number; fileName: string; fileUrl?: string | null; createdAt?: Date | string | null }>;
  baselines: Array<{ id: number; sourceStatus: string; contractFileName: string; contractFileUrl?: string | null; approvedAt?: Date | string | null; createdAt?: Date | string | null }>;
  milestones: Array<{ id: number; code: string; title: string; jiraClosedDate?: string | null }>;
  acceptances: Array<{ id: number; milestoneId: number; acceptanceStatus: string; acceptedAt: string; evidenceFileName: string; evidenceUrl?: string | null; createdAt?: Date | string | null }>;
  minutes: Array<{ id: number; isoWeek: string; reviewStatus: "received" | "reviewed" | "incomplete"; title: string; fileName: string; meetingDate: string; createdAt?: Date | string | null }>;
  recoveryPlans: Array<{ id: number; recoveryStatus: string; dueDate?: string | null; approvedAt?: Date | string | null; fileName?: string | null; fileUrl?: string | null; createdAt?: Date | string | null }>;
  closureEvidence: Array<{ id: number; label: string; fileName?: string | null; reference?: string | null; observedAt?: Date | string | null }>;
  baselineApprovedAt?: Date | string | null;
  recoveryPlanRequired: boolean | null;
};

export type ServiceCoverageInput = {
  entityType: "recurring_service";
  id: number;
  name: string;
  clientName: string;
  dealId?: string | null;
  ownerName?: string | null;
  status: "activo" | "pausado" | "completado" | "cancelado";
  serviceType: RecurringServiceType;
  cutoffAt: string;
  documents: Array<{ id: number; docType: "propuesta_tecnica" | "pl" | "sow" | "contrato" | "otro"; fileName: string; fileUrl?: string | null; uploadedAt?: Date | string | null }>;
  controls: Array<{ documentId: number; validationStatus: "pending" | "valid" | "expired" | "rejected"; validUntil?: string | null; validatedAt?: Date | string | null }>;
  reports: Array<{ id: number; periodStart: string; periodEnd: string; dueDate: string; status: "pending" | "delivered" | "accepted" | "rejected" | "waived"; deliveredAt?: Date | string | null; acceptedAt?: Date | string | null; evidenceDocumentId?: number | null; updatedAt?: Date | string | null }>;
};

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function dateOnly(value: Date | string | null | undefined): string | null {
  return iso(value)?.slice(0, 10) ?? null;
}

function latestDate(values: Array<Date | string | null | undefined>): string | null {
  const dates = values.map(iso).filter((value): value is string => Boolean(value)).sort();
  return dates.at(-1) ?? null;
}

function plusDays(date: string, days: number) {
  const parsed = new Date(`${date.slice(0, 10)}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime())) return null;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function past(date: string | null | undefined, cutoffAt: string) {
  if (!date) return false;
  return Date.parse(`${date.slice(0, 10)}T00:00:00Z`) < Date.parse(`${cutoffAt.slice(0, 10)}T00:00:00Z`);
}

function requirement(input: Omit<DocumentRequirement, "severity"> & { severity?: DocumentRequirement["severity"] }): DocumentRequirement {
  return { ...input, severity: input.severity ?? (input.status === "overdue" || input.status === "historical_gap" ? "critical" : input.status === "missing" || input.status === "pending_validation" ? "warning" : "info") };
}

function historicalStatus(lifecycle: DocumentLifecycle, status: DocumentCoverageStatus): DocumentCoverageStatus {
  return lifecycle === "historical" && ["missing", "overdue", "pending_validation"].includes(status) ? "historical_gap" : status;
}

function summarize(base: Omit<DocumentCoverageEntity, "coverage" | "requirements" | "activeActions" | "historicalObservations" | "latestEvidenceAt" | "counters">, requirements: DocumentRequirement[]): DocumentCoverageEntity {
  const counted = requirements.filter(item => item.applicability === "required");
  const compliant = counted.filter(item => item.status === "compliant").length;
  const coverage = {
    required: counted.length,
    compliant,
    pendingValidation: counted.filter(item => item.status === "pending_validation").length,
    missing: counted.filter(item => item.status === "missing").length,
    overdue: counted.filter(item => item.status === "overdue").length,
    historicalGaps: counted.filter(item => item.status === "historical_gap").length,
    notApplicable: requirements.filter(item => item.status === "not_applicable").length,
    unconfirmed: requirements.filter(item => item.status === "unconfirmed").length,
    percentage: counted.length ? Math.round((compliant / counted.length) * 100) : null,
  };
  const actionable = requirements.filter(item => item.applicability === "required" && ["missing", "overdue", "pending_validation"].includes(item.status));
  const activeActions: EvidenceAction[] = base.lifecycle === "open" ? actionable.map(item => ({
    id: `action:${item.id}`,
    requirementId: item.id,
    label: item.label,
    explanation: item.detail,
    impact: item.status === "overdue" ? "La evidencia exigible está vencida y afecta la trazabilidad del control." : item.status === "pending_validation" ? "Existe evidencia, pero todavía no acredita cumplimiento." : "La obligación documental no tiene evidencia vinculada.",
    recommendedAction: base.entityType === "project" ? "Revisar o cargar la evidencia desde el detalle del proyecto." : "Revisar documentos o reportes desde el detalle del servicio.",
    href: base.entityType === "project" ? `/projects/${base.entityId}` : `/recurring-services/${base.entityId}`,
    severity: item.severity,
  })) : [];
  const historicalObservations: EvidenceObservation[] = base.lifecycle === "historical"
    ? requirements.filter(item => item.status === "historical_gap").map(item => ({
      id: `observation:${item.id}`,
      requirementId: item.id,
      label: item.label,
      explanation: `${item.detail} Se conserva como antecedente del expediente y no genera una acción operativa automática.`,
    }))
    : [];
  return {
    ...base,
    coverage,
    requirements,
    activeActions,
    historicalObservations,
    latestEvidenceAt: latestDate(requirements.flatMap(item => item.evidence.map(evidence => evidence.observedAt))),
    counters: {
      closedMilestonesWithoutAcceptance: requirements.filter(item => item.kind === "milestone_acceptance" && ["missing", "overdue", "historical_gap"].includes(item.status)).length,
      overdueServiceReports: requirements.filter(item => item.kind === "service_periodic_report" && ["overdue", "historical_gap"].includes(item.status)).length,
    },
  };
}

function evidence(id: string, label: string, source: string, observedAt?: Date | string | null, fileName?: string | null, validation?: string | null): DocumentEvidence {
  return { id, label, source, observedAt: iso(observedAt), fileName, validation };
}

export function buildProjectDocumentCoverage(input: ProjectCoverageInput): DocumentCoverageEntity {
  const lifecycle = resolveDocumentLifecycle(input.status);
  const approvedBaseline = input.baselines.find(item => item.sourceStatus === "approved");
  const meetingFrequency = input.sowDocuments.find(item => item.status === "approved")?.meetingFrequency ?? input.sowDocuments.find(item => item.meetingFrequency)?.meetingFrequency ?? null;
  const policy = projectDocumentPolicy({
    lifecycle: lifecycle.lifecycle,
    currentStage: input.currentStage,
    meetingFrequency,
    hasApprovedBaseline: Boolean(approvedBaseline),
    recoveryPlanRequired: input.recoveryPlanRequired,
  });
  const requirements: DocumentRequirement[] = [];
  for (const rule of policy) {
    if (rule.kind === "contract_sow") {
      const approvedSow = input.sowDocuments.find(item => item.status === "approved" && (item.fileUrl || item.finalDocUrl));
      const linkedSow = input.linkedDocuments.find(item => item.docType === "sow" && item.fileUrl);
      const baselineContract = approvedBaseline?.contractFileUrl ? approvedBaseline : null;
      const candidates = [
        ...(approvedSow ? [evidence(`sow:${approvedSow.id}`, approvedSow.fileName ?? "SoW aprobado", "sow_documents", approvedSow.createdAt, approvedSow.fileName)] : []),
        ...(linkedSow ? [evidence(`linked:${linkedSow.id}`, "SoW vinculado", "linked_project_documents", linkedSow.createdAt, linkedSow.fileName)] : []),
        ...(baselineContract ? [evidence(`baseline:${baselineContract.id}`, "Fuente contractual aprobada", "executive_project_sources", baselineContract.approvedAt ?? baselineContract.createdAt, baselineContract.contractFileName)] : []),
      ];
      const pending = input.sowDocuments.some(item => item.status !== "approved" || (!item.fileUrl && !item.finalDocUrl));
      const baseStatus: DocumentCoverageStatus = candidates.length ? "compliant" : pending ? "pending_validation" : "missing";
      requirements.push(requirement({ id: `project:${input.id}:sow`, kind: rule.kind, label: rule.label, applicability: rule.applicability, status: historicalStatus(lifecycle.lifecycle, baseStatus), rationale: rule.rationale, detail: candidates.length ? `${candidates.length} fuente(s) contractual(es) verificable(s).` : pending ? "Existe un registro de SoW, pero no una versión aprobada con archivo verificable." : "No existe SoW o fuente contractual verificable.", dueDate: null, evidence: candidates }));
      continue;
    }
    if (rule.kind === "gantt_baseline") {
      const sources = [
        ...input.linkedDocuments.filter(item => item.docType === "gantt" && item.fileUrl).map(item => evidence(`linked:${item.id}`, "Gantt vinculado", "linked_project_documents", item.createdAt, item.fileName)),
        ...input.ganttUploads.filter(item => item.fileUrl).map(item => evidence(`gantt:${item.id}`, "Gantt cargado", "gantt_uploads", item.createdAt, item.fileName)),
      ];
      const baseStatus: DocumentCoverageStatus = rule.applicability === "required" ? (sources.length ? "compliant" : "missing") : sources.length ? "compliant" : "not_applicable";
      requirements.push(requirement({ id: `project:${input.id}:gantt`, kind: rule.kind, label: rule.label, applicability: rule.applicability, status: historicalStatus(lifecycle.lifecycle, baseStatus), rationale: rule.rationale, detail: sources.length ? `${sources.length} archivo(s) de línea base disponible(s).` : rule.applicability === "required" ? "No existe una Gantt contractual verificable." : "La Gantt aún no es exigible según la etapa disponible.", dueDate: null, evidence: sources }));
      continue;
    }
    if (rule.kind === "milestone_acceptance") {
      if (!input.milestones.length) {
        requirements.push(requirement({ id: `project:${input.id}:milestones`, kind: rule.kind, label: rule.label, applicability: "unconfirmed", status: "unconfirmed", rationale: rule.rationale, detail: "No existe un baseline de hitos suficiente para medir actas.", dueDate: null, evidence: [] }));
      }
      for (const milestone of input.milestones) {
        const acceptance = input.acceptances.find(item => item.milestoneId === milestone.id && item.acceptanceStatus === "accepted" && item.evidenceUrl);
        const isExigible = Boolean(milestone.jiraClosedDate || acceptance);
        const dueDate = milestone.jiraClosedDate ? plusDays(milestone.jiraClosedDate, 5) : null;
        const baseStatus: DocumentCoverageStatus = acceptance ? "compliant" : !isExigible ? "not_applicable" : past(dueDate, input.cutoffAt) ? "overdue" : "missing";
        requirements.push(requirement({
          id: `project:${input.id}:milestone:${milestone.id}`,
          kind: rule.kind,
          label: `Acta ${milestone.code} · ${milestone.title}`,
          applicability: isExigible ? "required" : "not_applicable",
          status: historicalStatus(lifecycle.lifecycle, baseStatus),
          rationale: rule.rationale,
          detail: acceptance ? `Aceptación registrada el ${acceptance.acceptedAt}.` : milestone.jiraClosedDate ? `Cierre Jira observado el ${milestone.jiraClosedDate}; falta acta vinculada.` : "El hito no tiene cierre Jira ni aceptación documental al corte.",
          dueDate,
          evidence: acceptance ? [evidence(`acceptance:${acceptance.id}`, "Acta aceptada", "executive_milestone_acceptances", acceptance.acceptedAt, acceptance.evidenceFileName, acceptance.acceptanceStatus)] : [],
        }));
      }
      continue;
    }
    if (rule.kind === "executive_minutes") {
      if (rule.applicability !== "required") {
        requirements.push(requirement({ id: `project:${input.id}:minutes`, kind: rule.kind, label: rule.label, applicability: rule.applicability, status: "unconfirmed", rationale: rule.rationale, detail: "La plataforma no calcula cumplimiento periódico sin una cadencia semanal explícita.", dueDate: null, evidence: input.minutes.map(item => evidence(`minute:${item.id}`, item.title, "executive_meeting_minutes", item.meetingDate, item.fileName, item.reviewStatus)) }));
      } else {
        const coverage = calculateExecutiveMinutesCoverage({ baselineApprovedAt: input.baselineApprovedAt ?? approvedBaseline?.approvedAt, cutoffDate: input.cutoffAt, minutes: input.minutes });
        const status: DocumentCoverageStatus = coverage.coveragePct == null ? "unconfirmed" : coverage.coveragePct === 100 ? "compliant" : coverage.receivedUnreviewedWeeks > 0 ? "pending_validation" : "missing";
        requirements.push(requirement({ id: `project:${input.id}:minutes`, kind: rule.kind, label: rule.label, applicability: coverage.coveragePct == null ? "unconfirmed" : "required", status: historicalStatus(lifecycle.lifecycle, status), rationale: rule.rationale, detail: coverage.coveragePct == null ? "No existe una fecha de baseline suficiente para calcular semanas exigibles." : `${coverage.reviewedWeeks}/${coverage.expectedWeeks} semana(s) revisada(s); ${coverage.receivedUnreviewedWeeks} recibida(s) sin revisión.`, dueDate: null, evidence: input.minutes.map(item => evidence(`minute:${item.id}`, item.title, "executive_meeting_minutes", item.meetingDate, item.fileName, item.reviewStatus)) }));
      }
      continue;
    }
    if (rule.kind === "recovery_plan") {
      const current = input.recoveryPlans.find(item => item.recoveryStatus === "vigente" && item.approvedAt && item.fileUrl);
      const draft = input.recoveryPlans.find(item => item.recoveryStatus === "draft");
      let baseStatus: DocumentCoverageStatus = "not_applicable";
      if (rule.applicability === "required") baseStatus = current ? (current.dueDate && past(current.dueDate, input.cutoffAt) ? "overdue" : "compliant") : draft ? "pending_validation" : "missing";
      else if (rule.applicability === "unconfirmed") baseStatus = draft ? "pending_validation" : "unconfirmed";
      requirements.push(requirement({ id: `project:${input.id}:recovery`, kind: rule.kind, label: rule.label, applicability: rule.applicability, status: historicalStatus(lifecycle.lifecycle, baseStatus), rationale: rule.rationale, detail: current ? "Existe un plan vigente y aprobado." : draft ? "Existe un borrador que todavía no acredita un plan vigente." : rule.applicability === "required" ? "No existe un plan vigente para el gatillo activo." : "No existe un plan vigente ni un gatillo exigible confirmado.", dueDate: current?.dueDate ?? draft?.dueDate ?? null, evidence: [...(current ? [evidence(`recovery:${current.id}`, "Plan vigente", "executive_recovery_plans", current.approvedAt ?? current.createdAt, current.fileName, current.recoveryStatus)] : []), ...(draft ? [evidence(`recovery:${draft.id}`, "Plan borrador", "executive_recovery_plans", draft.createdAt, draft.fileName, draft.recoveryStatus)] : [])] }));
      continue;
    }
    if (rule.kind === "closure_document") {
      const sources = input.closureEvidence.filter(item => item.reference || item.fileName).map(item => evidence(`closure:${item.id}`, item.label, "stage_closure", item.observedAt, item.fileName));
      const baseStatus: DocumentCoverageStatus = rule.applicability === "required" ? (sources.length ? "compliant" : "missing") : "not_applicable";
      requirements.push(requirement({ id: `project:${input.id}:closure`, kind: rule.kind, label: rule.label, applicability: rule.applicability, status: historicalStatus(lifecycle.lifecycle, baseStatus), rationale: rule.rationale, detail: sources.length ? "Existe evidencia final vinculada al cierre." : rule.applicability === "required" ? "El cierre no conserva un documento o referencia verificable." : "El proyecto aún no exige evidencia final de cierre.", dueDate: null, evidence: sources }));
    }
  }
  return summarize({ entityType: "project", entityId: input.id, entityName: input.name, clientName: input.clientName, dealId: input.dealId ?? null, ownerName: input.ownerName ?? null, lifecycle: lifecycle.lifecycle, lifecycleDetail: lifecycle.detail, lifecycleLabel: lifecycle.label, lifecycleReason: lifecycle.reason, cutoffAt: input.cutoffAt }, requirements);
}

function serviceDocumentRequirement(input: ServiceCoverageInput, kind: DocumentRequirementKind, label: string, applicability: RequirementApplicability, docType: ServiceCoverageInput["documents"][number]["docType"], rationale: string, lifecycle: DocumentLifecycle): DocumentRequirement {
  const docs = input.documents.filter(item => item.docType === docType);
  const evidenceRows = docs.map(document => {
    const control = input.controls.find(item => item.documentId === document.id);
    return evidence(`service-document:${document.id}`, label, "recurring_service_documents", control?.validatedAt ?? document.uploadedAt, document.fileName, control?.validationStatus ?? "sin_control");
  });
  const statuses = docs.map(document => input.controls.find(item => item.documentId === document.id)?.validationStatus ?? "pending");
  let status: DocumentCoverageStatus;
  if (statuses.includes("valid")) status = "compliant";
  else if (statuses.includes("expired") || statuses.includes("rejected")) status = "overdue";
  else if (docs.length) status = "pending_validation";
  else if (applicability === "required") status = "missing";
  else if (applicability === "unconfirmed") status = "unconfirmed";
  else status = "not_applicable";
  return requirement({ id: `service:${input.id}:${kind}`, kind, label, applicability, status: historicalStatus(lifecycle, status), rationale, detail: docs.length ? statuses.includes("valid") ? "Existe al menos un documento validado." : "Existe archivo, pero no una validación vigente que acredite cumplimiento." : applicability === "required" ? "No existe documento cargado." : "No existe documento y su exigibilidad no está confirmada.", dueDate: null, evidence: evidenceRows });
}

export function buildServiceDocumentCoverage(input: ServiceCoverageInput): DocumentCoverageEntity {
  const lifecycle = resolveDocumentLifecycle(input.status);
  const policy = recurringServiceDocumentPolicy({ lifecycle: lifecycle.lifecycle, serviceType: input.serviceType, hasReportSchedule: input.reports.length > 0 });
  const documentTypes: Partial<Record<DocumentRequirementKind, ServiceCoverageInput["documents"][number]["docType"]>> = {
    service_contract: "contrato",
    service_sow: "sow",
    service_proposal: "propuesta_tecnica",
    service_work_plan: "pl",
  };
  const requirements: DocumentRequirement[] = policy.filter(rule => rule.kind !== "service_periodic_report").map(rule => serviceDocumentRequirement(input, rule.kind, rule.label, rule.applicability, documentTypes[rule.kind]!, rule.rationale, lifecycle.lifecycle));
  const reportRule = policy.find(rule => rule.kind === "service_periodic_report")!;
  if (!input.reports.length) {
    requirements.push(requirement({ id: `service:${input.id}:reports`, kind: reportRule.kind, label: reportRule.label, applicability: reportRule.applicability, status: "unconfirmed", rationale: reportRule.rationale, detail: "No existe un calendario persistido; no se inventan períodos, entregas ni vencimientos.", dueDate: null, evidence: [] }));
  } else {
    for (const report of input.reports) {
      const isCompliant = report.status === "accepted" || report.status === "waived";
      const baseStatus: DocumentCoverageStatus = isCompliant ? "compliant" : report.status === "delivered" ? "pending_validation" : past(report.dueDate, input.cutoffAt) ? "overdue" : "missing";
      requirements.push(requirement({ id: `service:${input.id}:report:${report.id}`, kind: reportRule.kind, label: `Reporte ${report.periodStart} a ${report.periodEnd}`, applicability: "required", status: historicalStatus(lifecycle.lifecycle, baseStatus), rationale: reportRule.rationale, detail: report.status === "waived" ? "Período eximido mediante registro explícito." : report.status === "accepted" ? "Reporte aceptado." : report.status === "delivered" ? "Reporte entregado y pendiente de aceptación." : report.status === "rejected" ? "Reporte rechazado; requiere corrección." : "Reporte aún no entregado.", dueDate: report.dueDate, evidence: report.evidenceDocumentId ? [evidence(`service-report:${report.id}`, "Evidencia de reporte", "recurring_service_report_evidence", report.acceptedAt ?? report.deliveredAt ?? report.updatedAt, null, report.status)] : [] }));
    }
  }
  return summarize({ entityType: "recurring_service", entityId: input.id, entityName: input.name, clientName: input.clientName, dealId: input.dealId ?? null, ownerName: input.ownerName ?? null, lifecycle: lifecycle.lifecycle, lifecycleDetail: lifecycle.detail, lifecycleLabel: lifecycle.label, lifecycleReason: lifecycle.reason, cutoffAt: input.cutoffAt }, requirements);
}

export function buildDocumentCoverageSummary(entities: DocumentCoverageEntity[]) {
  const percentages = entities.map(entity => entity.coverage.percentage).filter((value): value is number => value != null);
  return {
    entities: entities.length,
    open: entities.filter(entity => entity.lifecycle === "open").length,
    historical: entities.filter(entity => entity.lifecycle === "historical").length,
    unconfirmed: entities.filter(entity => entity.lifecycle === "unconfirmed").length,
    averageCoveragePct: percentages.length ? Math.round(percentages.reduce((sum, value) => sum + value, 0) / percentages.length) : null,
    entitiesWithActiveGaps: entities.filter(entity => entity.activeActions.length > 0).length,
    historicalFilesWithGaps: entities.filter(entity => entity.historicalObservations.length > 0).length,
    pendingValidation: entities.reduce((sum, entity) => sum + entity.coverage.pendingValidation, 0),
    closedMilestonesWithoutAcceptance: entities.reduce((sum, entity) => sum + entity.counters.closedMilestonesWithoutAcceptance, 0),
    overdueServiceReports: entities.reduce((sum, entity) => sum + entity.counters.overdueServiceReports, 0),
  };
}
