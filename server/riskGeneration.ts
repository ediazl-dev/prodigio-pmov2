import type { InvokeResult } from "./_core/llm";

const validCategories = ["tecnico", "organizacional", "externo", "oculto"] as const;
const validTypes = ["riesgo", "riesgo_oculto", "supuesto_no_validado", "dependencia_externa"] as const;
const validProbabilities = ["alta", "media", "baja"] as const;
const validImpacts = ["alto", "medio", "bajo"] as const;

export type GeneratedRisk = {
  riskCode: string;
  description: string;
  category: (typeof validCategories)[number];
  type: (typeof validTypes)[number];
  probability: (typeof validProbabilities)[number];
  impact: (typeof validImpacts)[number];
  mitigation: string;
  owner: string;
};

export type RiskGenerationFailure =
  | "missing_choice"
  | "missing_content"
  | "invalid_json"
  | "empty_risks";

export type RiskGenerationParseResult = {
  risks: GeneratedRisk[];
  failure?: RiskGenerationFailure;
  finishReason: string | null;
  contentLength: number;
};

export type RiskGenerationAttempt = {
  attempt: string;
  messages: unknown[];
};

export type RiskAttemptDiagnostic = {
  attempt: string;
  mode: "schema" | "fallback";
  failure?: RiskGenerationFailure;
  finishReason: string | null;
  contentLength: number;
  risks: number;
  durationMs: number;
};

/**
 * Esquema estricto para el proxy LLM. Se evita `json_object` porque el proveedor
 * puede responder HTTP 200 sin choices ni contenido cuando se solicita ese modo.
 */
export const riskResponseFormat = {
  type: "json_schema" as const,
  json_schema: {
    name: "risk_matrix",
    strict: true,
    schema: {
      type: "object",
      properties: {
        risks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              riskCode: { type: "string" },
              description: { type: "string" },
              category: { type: "string", enum: validCategories },
              type: { type: "string", enum: validTypes },
              probability: { type: "string", enum: validProbabilities },
              impact: { type: "string", enum: validImpacts },
              mitigation: { type: "string" },
              owner: { type: "string" },
            },
            required: [
              "riskCode",
              "description",
              "category",
              "type",
              "probability",
              "impact",
              "mitigation",
              "owner",
            ],
            additionalProperties: false,
          },
        },
      },
      required: ["risks"],
      additionalProperties: false,
    },
  },
};

const isOneOf = <T extends readonly string[]>(values: T, value: unknown): value is T[number] =>
  typeof value === "string" && values.includes(value);

const responseContentToString = (content: unknown): string | null => {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return null;

  const text = content
    .filter((part): part is { type: "text"; text: string } =>
      typeof part === "object" && part !== null && (part as { type?: unknown }).type === "text" && typeof (part as { text?: unknown }).text === "string"
    )
    .map(part => part.text)
    .join("\n");
  return text || null;
};

const removeJsonCodeFence = (content: string) =>
  content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

/**
 * Normaliza las respuestas del LLM sin registrar contenido de proyecto. La ruta
 * sin schema puede incluir un bloque Markdown, por lo que se retira el fence antes
 * de hacer JSON.parse.
 */
export function parseRiskGenerationResponse(response: Partial<InvokeResult> | undefined | null): RiskGenerationParseResult {
  const choice = response?.choices?.[0];
  if (!choice) {
    return { risks: [], failure: "missing_choice", finishReason: null, contentLength: 0 };
  }

  const rawContent = responseContentToString(choice.message?.content);
  if (!rawContent) {
    return {
      risks: [],
      failure: "missing_content",
      finishReason: choice.finish_reason ?? null,
      contentLength: 0,
    };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(removeJsonCodeFence(rawContent));
  } catch {
    return {
      risks: [],
      failure: "invalid_json",
      finishReason: choice.finish_reason ?? null,
      contentLength: rawContent.length,
    };
  }

  const candidates = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { risks?: unknown }).risks)
      ? (payload as { risks: unknown[] }).risks
      : [];

  const risks = candidates
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .filter(item => typeof item.description === "string" && item.description.trim().length > 0)
    .map((item, index): GeneratedRisk => ({
      riskCode: typeof item.riskCode === "string" && item.riskCode.trim() ? item.riskCode : `R${String(index + 1).padStart(3, "0")}`,
      description: item.description as string,
      category: isOneOf(validCategories, item.category) ? item.category : "tecnico",
      type: isOneOf(validTypes, item.type) ? item.type : "riesgo",
      probability: isOneOf(validProbabilities, item.probability) ? item.probability : "media",
      impact: isOneOf(validImpacts, item.impact) ? item.impact : "medio",
      mitigation: typeof item.mitigation === "string" && item.mitigation.trim() ? item.mitigation : "Pendiente de definir plan de mitigación.",
      owner: typeof item.owner === "string" && item.owner.trim() ? item.owner : "Project Manager",
    }));

  return {
    risks,
    ...(risks.length === 0 ? { failure: "empty_risks" as const } : {}),
    finishReason: choice.finish_reason ?? null,
    contentLength: rawContent.length,
  };
}

/**
 * Ejecuta las rutas de reintento del generador. Cada intento primero solicita JSON
 * Schema y, sólo ante una matriz vacía, reutiliza el mismo prompt sin formato
 * estructurado. La persistencia queda deliberadamente fuera de esta utilidad.
 */
export async function runRiskGenerationAttempts(
  attempts: RiskGenerationAttempt[],
  invoke: (input: { messages: unknown[]; response_format?: typeof riskResponseFormat }) => Promise<Partial<InvokeResult>>,
): Promise<{ result: RiskGenerationParseResult; diagnostics: RiskAttemptDiagnostic[] }> {
  const diagnostics: RiskAttemptDiagnostic[] = [];
  let lastResult: RiskGenerationParseResult = {
    risks: [],
    failure: "empty_risks",
    finishReason: null,
    contentLength: 0,
  };

  for (const currentAttempt of attempts) {
    const schemaStartedAt = Date.now();
    const structuredResponse = await invoke({
      messages: currentAttempt.messages,
      response_format: riskResponseFormat,
    });
    lastResult = parseRiskGenerationResponse(structuredResponse);
    diagnostics.push({
      attempt: currentAttempt.attempt,
      mode: "schema",
      failure: lastResult.failure,
      finishReason: lastResult.finishReason,
      contentLength: lastResult.contentLength,
      risks: lastResult.risks.length,
      durationMs: Date.now() - schemaStartedAt,
    });

    if (lastResult.risks.length > 0) return { result: lastResult, diagnostics };

    const fallbackStartedAt = Date.now();
    const fallbackResponse = await invoke({ messages: currentAttempt.messages });
    lastResult = parseRiskGenerationResponse(fallbackResponse);
    diagnostics.push({
      attempt: currentAttempt.attempt,
      mode: "fallback",
      failure: lastResult.failure,
      finishReason: lastResult.finishReason,
      contentLength: lastResult.contentLength,
      risks: lastResult.risks.length,
      durationMs: Date.now() - fallbackStartedAt,
    });

    if (lastResult.risks.length > 0) return { result: lastResult, diagnostics };
  }

  return { result: lastResult, diagnostics };
}
