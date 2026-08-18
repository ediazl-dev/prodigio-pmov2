import { createConnection } from "mysql2/promise";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const projectId = 600001;
const databaseUrl = process.env.DATABASE_URL;
const forgeApiUrl = process.env.BUILT_IN_FORGE_API_URL;
const forgeApiKey = process.env.BUILT_IN_FORGE_API_KEY;

if (!databaseUrl || !forgeApiUrl || !forgeApiKey) {
  throw new Error("Faltan variables de entorno necesarias para validar la generación de riesgos.");
}

const riskSchema = {
  type: "object",
  additionalProperties: false,
  required: ["risks"],
  properties: {
    risks: {
      type: "array",
      minItems: 1,
      maxItems: 24,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["riskCode", "description", "category", "type", "probability", "impact", "mitigation", "owner"],
        properties: {
          riskCode: { type: "string", minLength: 1 },
          description: { type: "string", minLength: 1 },
          category: { type: "string", enum: ["tecnico", "organizacional", "externo", "oculto"] },
          type: { type: "string", enum: ["riesgo", "riesgo_oculto", "supuesto_no_validado", "dependencia_externa"] },
          probability: { type: "string", enum: ["alta", "media", "baja"] },
          impact: { type: "string", enum: ["alto", "medio", "bajo"] },
          mitigation: { type: "string", minLength: 1 },
          owner: { type: "string", minLength: 1 },
        },
      },
    },
  },
};

const asText = (value) => {
  if (value === null || value === undefined) return "No informado";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
};

const connection = await createConnection(databaseUrl);

try {
  const [rows] = await connection.execute(
    `SELECT p.projectName, p.clientName, s.status AS sowStatus, s.generalObjective, s.specificObjectives,
      s.activitiesIncluded, s.deliverables, s.limitations, s.assumptions,
      s.clientDependencies, s.prerequisites, s.prodigioTeam, s.clientTeam
     FROM projects p
     INNER JOIN sow_documents s ON s.projectId = p.id
     WHERE p.id = ?
     ORDER BY s.version DESC
     LIMIT 1`,
    [projectId],
  );

  const sow = rows[0];
  if (!sow) throw new Error("No se encontró un SoW para la validación de CCLA.");

  const sowContext = [
    `Objetivo general: ${asText(sow.generalObjective)}`,
    `Objetivos específicos: ${asText(sow.specificObjectives)}`,
    `Actividades: ${asText(sow.activitiesIncluded)}`,
    `Entregables: ${asText(sow.deliverables)}`,
    `Limitaciones: ${asText(sow.limitations)}`,
    `Supuestos: ${asText(sow.assumptions)}`,
    `Dependencias del cliente: ${asText(sow.clientDependencies)}`,
    `Prerrequisitos: ${asText(sow.prerequisites)}`,
    `Equipo Prodigio: ${asText(sow.prodigioTeam)}`,
    `Equipo cliente: ${asText(sow.clientTeam)}`,
  ].join("\n");

  const response = await fetch(`${forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${forgeApiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-5-mini",
      max_completion_tokens: 8192,
      response_format: {
        type: "json_schema",
        json_schema: { name: "risk_matrix", strict: true, schema: riskSchema },
      },
      messages: [
        {
          role: "system",
          content: "Eres un Gerente de Proyectos Senior. Responde exclusivamente con una matriz de riesgos JSON que cumpla el esquema indicado.",
        },
        {
          role: "user",
          content: `Proyecto: ${sow.projectName}\nCliente: ${sow.clientName ?? "N/A"}\n\nSoW aprobado:\n${sowContext}\n\nGenera entre 16 y 20 riesgos específicos, incluyendo al menos uno de cada tipo permitido.`,
        },
      ],
    }),
  });

  const responseBody = await response.json();
  const content = responseBody?.choices?.[0]?.message?.content;
  const finishReason = responseBody?.choices?.[0]?.finish_reason ?? null;
  let risks = [];
  let parseFailure = null;

  try {
    risks = JSON.parse(content).risks;
  } catch {
    parseFailure = "El proveedor no entregó choices[0].message.content con JSON válido.";
  }

  const requiredTypes = ["riesgo", "riesgo_oculto", "supuesto_no_validado", "dependencia_externa"];
  const includedTypes = [...new Set(Array.isArray(risks) ? risks.map(risk => risk.type) : [])];
  const validation = {
    createdAt: new Date().toISOString(),
    projectId,
    sowStatus: sow.sowStatus,
    mode: "read_only_no_persistence",
    httpStatus: response.status,
    finishReason,
    contentLength: typeof content === "string" ? content.length : 0,
    riskCount: Array.isArray(risks) ? risks.length : 0,
    includedTypes,
    containsAllRequiredTypes: requiredTypes.every(type => includedTypes.includes(type)),
    valid: response.ok && !parseFailure && Array.isArray(risks) && risks.length >= 16 && risks.length <= 20 && requiredTypes.every(type => includedTypes.includes(type)),
    parseFailure,
  };

  const outputDir = "/home/ubuntu/pmo-risk-validation";
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `ccla-risk-validation-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await writeFile(outputPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ outputPath, ...validation }));

  if (!validation.valid) process.exitCode = 1;
} finally {
  await connection.end();
}
