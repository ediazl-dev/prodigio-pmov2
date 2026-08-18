import { describe, expect, it } from "vitest";
import { parseRiskGenerationResponse, riskResponseFormat, runRiskGenerationAttempts } from "./riskGeneration";

const validRisk = {
  riskCode: "R001",
  description: "La integración con el sistema legado podría retrasar la entrega del MVP.",
  category: "tecnico",
  type: "riesgo",
  probability: "alta",
  impact: "alto",
  mitigation: "Validar contratos de integración y ejecutar una prueba temprana.",
  owner: "Arquitecto de Soluciones",
};

describe("riskGeneration", () => {
  it("define un JSON Schema estricto para una matriz de riesgos", () => {
    expect(riskResponseFormat.type).toBe("json_schema");
    expect(riskResponseFormat.json_schema.strict).toBe(true);
    expect(riskResponseFormat.json_schema.schema.required).toEqual(["risks"]);
  });

  it("acepta una respuesta JSON estructurada válida", () => {
    const result = parseRiskGenerationResponse({
      choices: [{
        index: 0,
        message: { role: "assistant", content: JSON.stringify({ risks: [validRisk] }) },
        finish_reason: "stop",
      }],
    });

    expect(result.failure).toBeUndefined();
    expect(result.finishReason).toBe("stop");
    expect(result.risks).toEqual([validRisk]);
  });

  it("detecta una respuesta HTTP exitosa sin choices para habilitar el fallback", () => {
    const result = parseRiskGenerationResponse({ id: "incomplete", created: 0, model: "gpt-5-mini", choices: [] });

    expect(result.risks).toEqual([]);
    expect(result.failure).toBe("missing_choice");
    expect(result.contentLength).toBe(0);
  });

  it("acepta la respuesta de recuperación encerrada en un bloque JSON", () => {
    const result = parseRiskGenerationResponse({
      choices: [{
        index: 0,
        message: { role: "assistant", content: `\`\`\`json\n${JSON.stringify({ risks: [validRisk] })}\n\`\`\`` },
        finish_reason: "stop",
      }],
    });

    expect(result.failure).toBeUndefined();
    expect(result.risks).toHaveLength(1);
    expect(result.risks[0].riskCode).toBe("R001");
  });

  it("reporta JSON inválido sin exponer el contenido de la respuesta", () => {
    const result = parseRiskGenerationResponse({
      choices: [{
        index: 0,
        message: { role: "assistant", content: "{riesgos: incompleto" },
        finish_reason: "stop",
      }],
    });

    expect(result.risks).toEqual([]);
    expect(result.failure).toBe("invalid_json");
    expect(result.contentLength).toBeGreaterThan(0);
  });

  it("recupera en el segundo intento después de una respuesta estructurada incompleta", async () => {
    const calls: string[] = [];
    const responses = [
      { choices: [] },
      { choices: [{ index: 0, message: { role: "assistant", content: '{"risks":[]}' }, finish_reason: "stop" }] },
      { choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify({ risks: [validRisk] }) }, finish_reason: "stop" }] },
    ];
    const result = await runRiskGenerationAttempts(
      [
        { attempt: "attempt-1", messages: [{ role: "user", content: "SoW con PDF" }] },
        { attempt: "attempt-2-text", messages: [{ role: "user", content: "SoW sin PDF" }] },
        { attempt: "attempt-3-simplified", messages: [{ role: "user", content: "SoW resumido" }] },
      ],
      async ({ response_format }) => {
        calls.push(response_format ? "schema" : "fallback");
        return responses.shift()! as any;
      },
    );

    expect(calls).toEqual(["schema", "fallback", "schema"]);
    expect(result.result.risks).toEqual([validRisk]);
    expect(result.diagnostics.map(item => `${item.attempt}:${item.mode}`)).toEqual([
      "attempt-1:schema",
      "attempt-1:fallback",
      "attempt-2-text:schema",
    ]);
  });

  it("agota los tres intentos sin devolver una matriz parcial", async () => {
    const result = await runRiskGenerationAttempts(
      [
        { attempt: "attempt-1", messages: [] },
        { attempt: "attempt-2-text", messages: [] },
        { attempt: "attempt-3-simplified", messages: [] },
      ],
      async () => ({ choices: [] }),
    );

    expect(result.result.risks).toEqual([]);
    expect(result.result.failure).toBe("missing_choice");
    expect(result.diagnostics).toHaveLength(6);
    expect(new Set(result.diagnostics.map(item => item.attempt))).toEqual(new Set([
      "attempt-1",
      "attempt-2-text",
      "attempt-3-simplified",
    ]));
  });
});
