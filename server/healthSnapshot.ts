import { getDb } from "./db";
import { projectHealthSnapshots } from "../drizzle/schema";
import { calculateExecutiveGovernance } from "./executiveGovernanceEngine";
import { getAllProjects } from "./db";
import { getExecutiveProjectSource } from "./db";
import { getExecutiveContractMilestones } from "./db";
import { getExecutiveMilestoneAcceptances } from "./db";
import { getExecutiveMeetingMinutes } from "./db";
import { getExecutiveCommitments } from "./db";
import { getExecutiveRequirements } from "./db";
import { getExecutiveRecoveryPlans } from "./db";
import { getExecutiveGovernanceAssignments } from "./db";
import { getFinancialDataByDealId } from "./db";
import { getJiraAdvanceReport } from "./jiraClient";
import type { ExecutiveGovernanceInput, CardinalMilestone } from "./executiveGovernanceEngine";

export type HealthSnapshotOutcome = {
  projects: number;
  snapshots: number;
  errors: string[];
};

/**
 * Captura el snapshot diario de salud por proyecto para la Consola de Gobierno PMO.
 * Para cada proyecto activo, calcula el IGE y estado usando el motor de gobernanza,
 * y persiste el resultado en project_health_snapshot para calcular el deterioro
 * (ΔIGE) entre cortes consecutivos.
 */
export async function captureHealthSnapshot(): Promise<HealthSnapshotOutcome> {
  const outcome: HealthSnapshotOutcome = {
    projects: 0,
    snapshots: 0,
    errors: [],
  };

  const db = await getDb();
  if (!db) {
    outcome.errors.push("No se pudo conectar a la base de datos");
    return outcome;
  }

  const cutoffDate = new Date();
  const allProjects = await getAllProjects();
  const activeProjects = allProjects.filter((p) => p.status === "activo");

  for (const project of activeProjects) {
    try {
      // Obtener datos del proyecto
      const source = await getExecutiveProjectSource(project.id);
      const milestones = await getExecutiveContractMilestones(project.id, source?.id);
      const acceptances = source ? await getExecutiveMilestoneAcceptances(project.id, source.id) : [];
      const minutes = await getExecutiveMeetingMinutes(project.id);
      const commitments = await getExecutiveCommitments(project.id);
      const requirements = await getExecutiveRequirements(project.id, source?.id);
      const recoveryPlans = await getExecutiveRecoveryPlans(project.id, source?.id);
      const assignments = await getExecutiveGovernanceAssignments(project.id);

      // Obtener datos financieros desde la fuente ejecutiva (dealId está en executive_project_sources)
      let financialData = null;
      if (source?.dealId) {
        financialData = await getFinancialDataByDealId(source.dealId);
      }

      // Obtener evidencia externa (Jira)
      let externalEvidence = null;
      if (project.jiraProjectKey) {
        try {
          const jiraReport = await getJiraAdvanceReport(project.jiraProjectKey);
          externalEvidence = jiraReport;
        } catch (error) {
          // Tolerante a fallos: si Jira no responde, continuar sin evidencia externa
          console.warn(`[HealthSnapshot] Jira no disponible para proyecto ${project.id}:`, error);
        }
      }

      // Construir hitos cardinales para el motor
      const cardinalMilestones: CardinalMilestone[] = milestones.map((m) => {
        const acceptance = acceptances.find((a) => a.milestoneId === m.id);
        return {
          code: m.milestoneCode,
          baselineDate: m.baselineDate,
          committedDate: m.jiraDueDate,
          jiraClosedDate: m.jiraClosedDate,
          acceptedAt: acceptance?.acceptedAt || null,
          acceptanceEvidenceUrl: acceptance?.evidenceUrl || null,
          isCritical: m.isCritical,
          billingWeight: m.billingWeight,
          valueUf: null, // Se calcula en el motor desde billingWeight × saleValueUf
        };
      });

      // Construir input del motor de gobernanza
      const governanceInput: ExecutiveGovernanceInput = {
        cutoffDate: cutoffDate.toISOString().slice(0, 10),
        milestones: cardinalMilestones,
        financial: financialData ? {
          budgetCostUf: financialData.presupuestoUF ? Number(financialData.presupuestoUF) : null,
          executedCostUf: financialData.utilizadoUF ? Number(financialData.utilizadoUF) : null,
          saleValueUf: financialData.valorVentaUF ? Number(financialData.valorVentaUF) : null,
        } : null,
        governance: {
          minutesCoveragePct: minutes.length > 0 ? (minutes.filter((m) => m.reviewStatus === "reviewed").length / minutes.length) * 100 : null,
          commitmentCompliancePct: commitments.length > 0 ? (commitments.filter((c) => c.commitmentStatus === "fulfilled").length / commitments.length) * 100 : null,
          overdueP0Requirements: requirements.filter((r) => r.priority === "P0" && r.requirementStatus === "open").length,
          recoveryPlanOverdue: recoveryPlans.some((r) => r.recoveryStatus === "vigente" && r.dueDate && new Date(r.dueDate) < cutoffDate),
        },
        operational: externalEvidence ? {
          jiraProgressPct: externalEvidence.percentComplete || null,
          backlogConfidencePct: externalEvidence.milestoneCompletionPct || null,
        } : null,
      };

      // Calcular gobernanza ejecutiva
      const governance = calculateExecutiveGovernance(governanceInput);

      // Persistir snapshot
      await db.insert(projectHealthSnapshots).values({
        projectId: project.id,
        cutoffDate,
        ige: governance.governance.ige,
        estado: governance.governance.state,
        gatillos: JSON.stringify(governance.governance.activeTriggers || []),
        ufEnRiesgo: governance.exposure.retainedUf,
        hitosVencidos: governance.contractual.openOverdueCount,
        hitosExigibles: governance.contractual.totalMilestones,
        p0Vencidas: requirements.filter((r) => r.priority === "P0" && r.requirementStatus === "open").length,
        planesRecuperacionVencidos: recoveryPlans.filter((r) => r.recoveryStatus === "vigente" && r.dueDate && new Date(r.dueDate) < cutoffDate).length,
      });

      outcome.projects += 1;
      outcome.snapshots += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      outcome.errors.push(`Proyecto ${project.id}: ${message}`);
      console.error(`[HealthSnapshot] Error en proyecto ${project.id}:`, error);
    }
  }

  return outcome;
}
