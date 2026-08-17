import { describe, expect, it } from "vitest";
import { validatePMAnalysisOutput } from "./pmAnalysisSchema";

const validAnalysis = {
  executiveSummary: "El proyecto mantiene avance operativo, pero requiere corregir desviaciones de presupuesto y asegurar los entregables comprometidos con el cliente durante las próximas semanas.",
  overallHealth: "AMARILLO",
  healthJustification: "El avance JIRA es consistente, aunque existen riesgos financieros y de cumplimiento que requieren seguimiento semanal del PM.",
  clientMilestoneCompletion: {
    total: 10,
    closed: 2,
    percentage: 20,
    status: "ATRASADO",
    assessment: "Solo dos de diez hitos comprometidos con el cliente se encuentran cerrados, por lo que el avance ejecutivo es insuficiente.",
    operationalGap: "El avance de tareas internas no compensa el bajo cierre de compromisos verificables por el cliente.",
  },
  sowComplianceScore: 72,
  sowCompliance: {
    summary: "La ejecución cubre los entregables principales, con dependencias de validación pendientes en dos hitos relevantes.",
    deliverablesStatus: [{ deliverable: "Integración validada", status: "EN_PROGRESO", detail: "La validación técnica continúa pendiente de aceptación del cliente." }],
    milestonesAlignment: "Los hitos JIRA se alinean parcialmente con el plan comprometido en el SoW.",
    scopeDeviations: "Sin desviaciones relevantes detectadas; se debe confirmar el alcance pendiente.",
  },
  valueDelivery: {
    summary: "El proyecto entrega valor incremental, pero necesita asegurar la adopción de los componentes comprometidos.",
    positiveSignals: ["Se completaron tareas de integración prioritarias."],
    warningSignals: ["El consumo presupuestario requiere control semanal."],
    clientRiskFactors: ["Las validaciones del cliente podrían afectar las fechas comprometidas."],
  },
  operationalAnalysis: {
    executionPace: "LENTO",
    paceDetail: "El ritmo actual requiere acelerar el cierre de dependencias y pruebas para proteger los próximos hitos.",
    bottlenecks: ["Aprobaciones de validación pendientes."],
    teamAssessment: "El equipo está operativo, aunque necesita una gestión más estrecha de impedimentos y dependencias.",
    epicProgress: [{ epic: "Integración SFA", progress: 56, assessment: "Avanza, pero mantiene actividades críticas pendientes." }],
  },
  risksAndAlerts: [{ type: "ALTO", title: "Sobrecosto presupuestario", description: "El presupuesto consumido supera el nivel esperado para el avance actual.", recommendation: "Definir plan de contención y revisar estimación al término." }],
  weeklyActions: [{ priority: "URGENTE", action: "Revisar presupuesto y tareas críticas con el equipo.", rationale: "Reduce el riesgo de ampliación de la desviación actual." }],
  monthlyActions: [{ priority: "ALTA", action: "Revalidar el plan de entregas con el cliente.", rationale: "Asegura que el alcance y las fechas sigan alineados." }],
  documentGaps: [],
};

describe("validatePMAnalysisOutput", () => {
  it("acepta un análisis PM completo y estructurado", () => {
    const result = validatePMAnalysisOutput(JSON.stringify(validAnalysis));
    expect(result.success).toBe(true);
  });

  it("rechaza un objeto vacío para evitar persistir análisis sin contenido", () => {
    const result = validatePMAnalysisOutput("{}");
    expect(result.success).toBe(false);
  });

  it("tolera fences Markdown como fallback, pero mantiene la validación estricta", () => {
    const result = validatePMAnalysisOutput(`\`\`\`json\n${JSON.stringify(validAnalysis)}\n\`\`\``);
    expect(result.success).toBe(true);
  });
});
