import { z } from "zod";

const deliverableStatusSchema = z.object({
  deliverable: z.string().trim().min(3),
  status: z.enum(["CUMPLIDO", "EN_PROGRESO", "ATRASADO", "NO_INICIADO"]),
  detail: z.string().trim().min(8),
}).strict();

const actionSchema = z.object({
  priority: z.enum(["URGENTE", "ALTA", "MEDIA"]),
  action: z.string().trim().min(8),
  rationale: z.string().trim().min(8),
}).strict();

export const pmAnalysisSchema = z.object({
  executiveSummary: z.string().trim().min(80),
  overallHealth: z.enum(["VERDE", "AMARILLO", "ROJO"]),
  healthJustification: z.string().trim().min(30),
  clientMilestoneCompletion: z.object({
    total: z.number().int().min(0),
    closed: z.number().int().min(0),
    percentage: z.number().int().min(0).max(100),
    status: z.enum(["CUMPLIDO", "EN_RIESGO", "ATRASADO", "SIN_HITOS"]),
    assessment: z.string().trim().min(30),
    operationalGap: z.string().trim().min(20),
  }).strict(),
  sowComplianceScore: z.number().int().min(0).max(100),
  sowCompliance: z.object({
    summary: z.string().trim().min(30),
    deliverablesStatus: z.array(deliverableStatusSchema).min(1),
    milestonesAlignment: z.string().trim().min(20),
    scopeDeviations: z.string().trim().min(10),
  }).strict(),
  valueDelivery: z.object({
    summary: z.string().trim().min(30),
    positiveSignals: z.array(z.string().trim().min(5)).min(1),
    warningSignals: z.array(z.string().trim().min(5)).min(1),
    clientRiskFactors: z.array(z.string().trim().min(5)).min(1),
  }).strict(),
  operationalAnalysis: z.object({
    executionPace: z.enum(["ADECUADO", "LENTO", "ACELERADO"]),
    paceDetail: z.string().trim().min(20),
    bottlenecks: z.array(z.string().trim().min(5)).min(1),
    teamAssessment: z.string().trim().min(20),
    epicProgress: z.array(z.object({
      epic: z.string().trim().min(3),
      progress: z.number().int().min(0).max(100),
      assessment: z.string().trim().min(8),
    }).strict()).min(1),
  }).strict(),
  risksAndAlerts: z.array(z.object({
    type: z.enum(["CRITICO", "ALTO", "MEDIO", "BAJO"]),
    title: z.string().trim().min(5),
    description: z.string().trim().min(10),
    recommendation: z.string().trim().min(8),
  }).strict()).min(1),
  weeklyActions: z.array(actionSchema).min(1),
  monthlyActions: z.array(z.object({
    priority: z.enum(["ALTA", "MEDIA"]),
    action: z.string().trim().min(8),
    rationale: z.string().trim().min(8),
  }).strict()).min(1),
  documentGaps: z.array(z.string().trim().min(5)),
}).strict();

export type PMAnalysis = z.infer<typeof pmAnalysisSchema>;

export const pmAnalysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "executiveSummary", "overallHealth", "healthJustification", "clientMilestoneCompletion", "sowComplianceScore",
    "sowCompliance", "valueDelivery", "operationalAnalysis", "risksAndAlerts",
    "weeklyActions", "monthlyActions", "documentGaps",
  ],
  properties: {
    executiveSummary: { type: "string", minLength: 80 },
    overallHealth: { type: "string", enum: ["VERDE", "AMARILLO", "ROJO"] },
    healthJustification: { type: "string", minLength: 30 },
    clientMilestoneCompletion: {
      type: "object", additionalProperties: false,
      required: ["total", "closed", "percentage", "status", "assessment", "operationalGap"],
      properties: {
        total: { type: "integer", minimum: 0 },
        closed: { type: "integer", minimum: 0 },
        percentage: { type: "integer", minimum: 0, maximum: 100 },
        status: { type: "string", enum: ["CUMPLIDO", "EN_RIESGO", "ATRASADO", "SIN_HITOS"] },
        assessment: { type: "string", minLength: 30 },
        operationalGap: { type: "string", minLength: 20 },
      },
    },
    sowComplianceScore: { type: "integer", minimum: 0, maximum: 100 },
    sowCompliance: {
      type: "object", additionalProperties: false,
      required: ["summary", "deliverablesStatus", "milestonesAlignment", "scopeDeviations"],
      properties: {
        summary: { type: "string", minLength: 30 },
        deliverablesStatus: {
          type: "array", minItems: 1,
          items: {
            type: "object", additionalProperties: false,
            required: ["deliverable", "status", "detail"],
            properties: {
              deliverable: { type: "string", minLength: 3 },
              status: { type: "string", enum: ["CUMPLIDO", "EN_PROGRESO", "ATRASADO", "NO_INICIADO"] },
              detail: { type: "string", minLength: 8 },
            },
          },
        },
        milestonesAlignment: { type: "string", minLength: 20 },
        scopeDeviations: { type: "string", minLength: 10 },
      },
    },
    valueDelivery: {
      type: "object", additionalProperties: false,
      required: ["summary", "positiveSignals", "warningSignals", "clientRiskFactors"],
      properties: {
        summary: { type: "string", minLength: 30 },
        positiveSignals: { type: "array", minItems: 1, items: { type: "string", minLength: 5 } },
        warningSignals: { type: "array", minItems: 1, items: { type: "string", minLength: 5 } },
        clientRiskFactors: { type: "array", minItems: 1, items: { type: "string", minLength: 5 } },
      },
    },
    operationalAnalysis: {
      type: "object", additionalProperties: false,
      required: ["executionPace", "paceDetail", "bottlenecks", "teamAssessment", "epicProgress"],
      properties: {
        executionPace: { type: "string", enum: ["ADECUADO", "LENTO", "ACELERADO"] },
        paceDetail: { type: "string", minLength: 20 },
        bottlenecks: { type: "array", minItems: 1, items: { type: "string", minLength: 5 } },
        teamAssessment: { type: "string", minLength: 20 },
        epicProgress: {
          type: "array", minItems: 1,
          items: {
            type: "object", additionalProperties: false,
            required: ["epic", "progress", "assessment"],
            properties: {
              epic: { type: "string", minLength: 3 },
              progress: { type: "integer", minimum: 0, maximum: 100 },
              assessment: { type: "string", minLength: 8 },
            },
          },
        },
      },
    },
    risksAndAlerts: {
      type: "array", minItems: 1,
      items: {
        type: "object", additionalProperties: false,
        required: ["type", "title", "description", "recommendation"],
        properties: {
          type: { type: "string", enum: ["CRITICO", "ALTO", "MEDIO", "BAJO"] },
          title: { type: "string", minLength: 5 },
          description: { type: "string", minLength: 10 },
          recommendation: { type: "string", minLength: 8 },
        },
      },
    },
    weeklyActions: {
      type: "array", minItems: 1,
      items: {
        type: "object", additionalProperties: false,
        required: ["priority", "action", "rationale"],
        properties: {
          priority: { type: "string", enum: ["URGENTE", "ALTA", "MEDIA"] },
          action: { type: "string", minLength: 8 },
          rationale: { type: "string", minLength: 8 },
        },
      },
    },
    monthlyActions: {
      type: "array", minItems: 1,
      items: {
        type: "object", additionalProperties: false,
        required: ["priority", "action", "rationale"],
        properties: {
          priority: { type: "string", enum: ["ALTA", "MEDIA"] },
          action: { type: "string", minLength: 8 },
          rationale: { type: "string", minLength: 8 },
        },
      },
    },
    documentGaps: { type: "array", items: { type: "string", minLength: 5 } },
  },
} as const;

export function validatePMAnalysisOutput(rawContent: unknown) {
  const rawText = typeof rawContent === "string" ? rawContent.trim() : "";
  const normalized = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    const value = typeof rawContent === "object" && rawContent !== null
      ? rawContent
      : JSON.parse(normalized);
    return pmAnalysisSchema.safeParse(value);
  } catch {
    return pmAnalysisSchema.safeParse(null);
  }
}
