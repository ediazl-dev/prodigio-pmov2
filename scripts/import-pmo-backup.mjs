import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import mysql from "mysql2/promise";

const mode = process.argv[2];
const batchesDirectory = process.argv[3];

if (!["--dry-run", "--apply"].includes(mode) || !batchesDirectory) {
  throw new Error("Uso: node scripts/import-pmo-backup.mjs --dry-run|--apply <directorio-lotes>");
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL no está disponible en el entorno de ejecución.");
}

const files = [
  "01_identidades_y_proyectos.sql",
  "02_documentos_y_flujo.sql",
  "03_riesgos_planificacion_y_reportes.sql",
  "04_cierres.sql",
];

const allowedTables = new Set([
  "users",
  "projects",
  "project_stages",
  "stage_openings",
  "jira_spaces",
  "uploaded_files",
  "sow_documents",
  "sow_versions",
  "stage_approvals",
  "gantt_uploads",
  "risks",
  "risk_versions",
  "wbs_tasks",
  "billing_milestones",
  "financial_data",
  "executive_verdicts",
  "linked_project_documents",
  "stage_deadline_extensions",
  "stage_closures",
  "design_documents",
  "lessons_learned",
]);

function splitStatements(source) {
  const statements = [];
  let buffer = "";
  let inQuote = false;
  let escaped = false;

  for (const char of source) {
    buffer += char;
    if (inQuote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === "'") inQuote = false;
      continue;
    }
    if (char === "'") inQuote = true;
    else if (char === ";") {
      const statement = buffer
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim();
      if (statement) statements.push(statement);
      buffer = "";
    }
  }

  if (buffer.trim()) throw new Error("El lote contiene una sentencia sin terminador.");
  return statements;
}

function parseInsert(statement) {
  const match = statement.match(/^INSERT INTO `([^`]+)` \(([^)]+)\)(?:\s+SELECT|\s+VALUES)/s);
  if (!match) {
    throw new Error(`El lote contiene una sentencia distinta de INSERT autorizado: ${statement.slice(0, 180)}`);
  }
  const [, table, columnsRaw] = match;
  if (!allowedTables.has(table)) throw new Error(`Tabla no permitida en la migración: ${table}`);
  const columns = columnsRaw.split(",").map((column) => column.trim().replace(/^`|`$/g, ""));
  return { table, columns };
}

async function loadStatements() {
  const batches = [];
  for (const file of files) {
    const content = await readFile(resolve(batchesDirectory, file), "utf8");
    const statements = splitStatements(content).map((statement) => ({
      sql: statement,
      ...parseInsert(statement),
    }));
    batches.push({ file, statements });
  }
  return batches;
}

function summarizeByTable(batches) {
  return batches.flatMap((batch) => batch.statements).reduce((summary, statement) => {
    summary[statement.table] = (summary[statement.table] ?? 0) + 1;
    return summary;
  }, {});
}

async function validateSchema(connection, batches) {
  const requirements = new Map();
  for (const statement of batches.flatMap((batch) => batch.statements)) {
    if (!requirements.has(statement.table)) requirements.set(statement.table, new Set());
    for (const column of statement.columns) requirements.get(statement.table).add(column);
  }

  for (const [table, columns] of requirements) {
    const [rows] = await connection.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [table],
    );
    const available = new Set(rows.map((row) => row.COLUMN_NAME));
    const missing = [...columns].filter((column) => !available.has(column));
    if (missing.length > 0) {
      throw new Error(`Columnas ausentes en ${table}: ${missing.join(", ")}`);
    }
  }
}

async function validateDestinationIsReady(connection) {
  const cleanTables = [
    "projects",
    "project_stages",
    "stage_openings",
    "jira_spaces",
    "uploaded_files",
    "sow_documents",
    "sow_versions",
    "stage_approvals",
    "gantt_uploads",
    "risks",
    "risk_versions",
    "wbs_tasks",
    "billing_milestones",
    "financial_data",
    "executive_verdicts",
    "linked_project_documents",
    "stage_deadline_extensions",
    "stage_closures",
    "design_documents",
    "lessons_learned",
  ];

  for (const table of cleanTables) {
    const [rows] = await connection.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
    if (Number(rows[0].count) !== 0) {
      throw new Error(`El destino no está vacío para la tabla ${table}; la migración se detuvo para evitar duplicados.`);
    }
  }
}

const batches = await loadStatements();
const connection = await mysql.createConnection(process.env.DATABASE_URL);

try {
  await validateSchema(connection, batches);
  await validateDestinationIsReady(connection);

  const summary = summarizeByTable(batches);
  console.log(JSON.stringify({ mode, batches: files, statementsByTable: summary }, null, 2));

  if (mode === "--dry-run") {
    console.log("Prevalidación completada sin cambios en la base de datos.");
    process.exitCode = 0;
  } else {
    await connection.beginTransaction();
    try {
      let inserted = 0;
      for (const batch of batches) {
        for (const statement of batch.statements) {
          const [result] = await connection.query(statement.sql);
          inserted += Number(result.affectedRows ?? 0);
        }
      }
      await connection.commit();
      console.log(JSON.stringify({ committed: true, affectedRows: inserted }, null, 2));
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  }
} finally {
  connection.destroy();
}
