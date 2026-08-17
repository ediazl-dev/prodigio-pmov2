/**
 * Re-sincroniza los issues del plan de trabajo y billing months de los 3 servicios
 * desde los Spaces PPDC antiguos (TIEX, SPP, MDS2937) hacia los nuevos Spaces JSM
 * (MDSTIEX, MDSCEN, MDSCLA).
 * 
 * Estrategia:
 * 1. Limpiar jiraIssueKey en work_plan y billing_months (los keys viejos son de proyectos business)
 * 2. Crear nuevos issues en los Spaces JSM correspondientes
 * 3. Actualizar jiraIssueKey con los nuevos keys
 */
import mysql from "mysql2/promise";
import { config } from "dotenv";
config();

const BASE = process.env.JIRA_BASE_URL;
const auth = Buffer.from(process.env.JIRA_EMAIL + ":" + process.env.JIRA_API_TOKEN).toString("base64");
const HEADERS = {
  "Authorization": "Basic " + auth,
  "Accept": "application/json",
  "Content-Type": "application/json",
};

const db = await mysql.createConnection(process.env.DATABASE_URL);

// Mapeo serviceId → nuevo Space JSM
const SERVICE_MAP = {
  7: "MDSCLA",       // Claro Ecuador Apigee
  90001: "MDSCEN",   // CEN Portal Pronósticos
  120001: "MDSTIEX", // Komatsu TIEX
};

async function createIssue(projectKey, summary, description, dueDate) {
  const fields = {
    project: { key: projectKey },
    summary: summary.length > 255 ? summary.substring(0, 252) + "..." : summary,
    issuetype: { name: "Task" },
  };
  if (description) {
    const paragraphs = description.split("\n").filter(Boolean);
    fields.description = {
      type: "doc", version: 1,
      content: paragraphs.map(p => ({ type: "paragraph", content: [{ type: "text", text: p }] })),
    };
  }
  if (dueDate) {
    const normalized = typeof dueDate === "object" ? dueDate.toISOString().split("T")[0] : String(dueDate).split("T")[0];
    fields.duedate = normalized;
  }

  const res = await fetch(`${BASE}/rest/api/3/issue`, {
    method: "POST", headers: HEADERS, body: JSON.stringify({ fields }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`JIRA error ${res.status}: ${JSON.stringify(data).substring(0, 200)}`);
  return data;
}

async function resyncService(serviceId) {
  const projectKey = SERVICE_MAP[serviceId];
  console.log(`\n=== Servicio ${serviceId} → ${projectKey} ===`);

  // 1. Limpiar jiraIssueKey viejos en work_plan
  const [wpRows] = await db.execute(
    "SELECT id, title, description, dueDate FROM recurring_service_work_plan WHERE serviceId = ?",
    [serviceId]
  );
  console.log(`  Work plan items: ${wpRows.length}`);

  let wpCreated = 0, wpErrors = 0;
  for (const item of wpRows) {
    try {
      const issue = await createIssue(
        projectKey,
        item.title,
        item.description,
        item.dueDate
      );
      await db.execute(
        "UPDATE recurring_service_work_plan SET jiraIssueKey = ? WHERE id = ?",
        [issue.key, item.id]
      );
      wpCreated++;
      process.stdout.write(".");
    } catch (e) {
      console.error(`\n  ERROR wp item ${item.id}: ${e.message.substring(0, 100)}`);
      wpErrors++;
    }
  }
  console.log(`\n  Work plan: ${wpCreated} creados, ${wpErrors} errores`);

  // 2. Limpiar y re-crear billing months
  const [bmRows] = await db.execute(
    "SELECT id, monthNumber, amount, currency, dueDate FROM recurring_service_billing_months WHERE serviceId = ?",
    [serviceId]
  );
  console.log(`  Billing months: ${bmRows.length}`);

  let bmCreated = 0, bmErrors = 0;
  for (const month of bmRows) {
    try {
      const summary = `Facturación Mes ${month.monthNumber} - ${month.amount} ${month.currency || "USD"}`;
      const desc = `Cuota mensual #${month.monthNumber}\nMonto: ${month.amount} ${month.currency || "USD"}`;
      const issue = await createIssue(projectKey, summary, desc, month.dueDate);
      await db.execute(
        "UPDATE recurring_service_billing_months SET jiraIssueKey = ? WHERE id = ?",
        [issue.key, month.id]
      );
      bmCreated++;
      process.stdout.write(".");
    } catch (e) {
      console.error(`\n  ERROR billing month ${month.id}: ${e.message.substring(0, 100)}`);
      bmErrors++;
    }
  }
  console.log(`\n  Billing months: ${bmCreated} creados, ${bmErrors} errores`);

  return { serviceId, projectKey, wpCreated, wpErrors, bmCreated, bmErrors };
}

// Main
console.log("=== Re-sincronización de issues JSM ===");
console.log(`Tenant: ${BASE}`);

const results = [];
for (const serviceId of [7, 90001, 120001]) {
  const r = await resyncService(serviceId);
  results.push(r);
}

await db.end();

console.log("\n=== Resumen Final ===");
for (const r of results) {
  console.log(`${r.projectKey} (svc ${r.serviceId}): WP ${r.wpCreated}✓/${r.wpErrors}✗ | BM ${r.bmCreated}✓/${r.bmErrors}✗`);
}
console.log("\nRe-sincronización completa.");
