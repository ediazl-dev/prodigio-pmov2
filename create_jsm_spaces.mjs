/**
 * Crea 3 nuevos Spaces JSM (service_desk + categoría Mesa de Servicio)
 * para los servicios recurrentes existentes.
 * 
 * Mesa de Servicio category id: 10007
 * Yanahí account_id: 712020:326edb27-3fca-4a40-afc0-9a274e88fba0
 */
import { readFileSync } from "fs";
import { config } from "dotenv";
config();

const BASE = process.env.JIRA_BASE_URL;
const auth = Buffer.from(process.env.JIRA_EMAIL + ":" + process.env.JIRA_API_TOKEN).toString("base64");
const HEADERS = {
  "Authorization": "Basic " + auth,
  "Accept": "application/json",
  "Content-Type": "application/json",
};

const LEAD_ACCOUNT_ID = "712020:326edb27-3fca-4a40-afc0-9a274e88fba0"; // Yanahí
const MESA_SERVICIO_CATEGORY_ID = 10007;

// Los 3 servicios a migrar
const SPACES_TO_CREATE = [
  {
    serviceId: 120001,
    name: "Mesa de Servicio - Komatsu TIEX",
    key: "MDSTIEX",
    clientName: "Komatsu Chile S.A.",
    oldKey: "TIEX",
  },
  {
    serviceId: 90001,
    name: "Mesa de Servicio - CEN Portal Pronósticos",
    key: "MDSCEN",
    clientName: "Coordinador Eléctrico Nacional",
    oldKey: "SPP",
  },
  {
    serviceId: 7,
    name: "Mesa de Servicio - Claro Ecuador Apigee",
    key: "MDSCLA",
    clientName: "Claro Ecuador",
    oldKey: "MDS2937",
  },
];

async function createJSMProject(space) {
  const body = {
    name: space.name,
    key: space.key,
    projectTypeKey: "service_desk",
    projectTemplateKey: "com.atlassian.servicedesk:itil-v2-service-desk-project",
    leadAccountId: LEAD_ACCOUNT_ID,
    categoryId: MESA_SERVICIO_CATEGORY_ID,
    description: `Mesa de Servicio para ${space.clientName} - Migrado desde ${space.oldKey}`,
  };

  console.log(`\nCreando Space JSM: ${space.key} (${space.name})...`);
  const res = await fetch(`${BASE}/rest/api/3/project`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error(`  ERROR ${res.status}:`, JSON.stringify(data, null, 2));
    return null;
  }

  console.log(`  ✅ Creado: key=${data.key}, id=${data.id}`);
  console.log(`  URL: ${BASE}/jira/servicedesk/projects/${data.key}/boards`);
  return data;
}

async function verifyCategory(projectKey) {
  const res = await fetch(`${BASE}/rest/api/3/project/${projectKey}`, {
    headers: HEADERS,
  });
  const d = await res.json();
  const cat = d.projectCategory;
  console.log(`  Verificación ${projectKey}: type=${d.projectTypeKey}, category=${cat?.name || "SIN CATEGORÍA"}`);
  return d;
}

// Main
console.log("=== Creando Spaces JSM con categoría Mesa de Servicio ===");
console.log(`Tenant: ${BASE}`);
console.log(`Lead: Yanahí (${LEAD_ACCOUNT_ID})`);

const results = [];

for (const space of SPACES_TO_CREATE) {
  const created = await createJSMProject(space);
  if (created) {
    await verifyCategory(created.key);
    results.push({
      serviceId: space.serviceId,
      oldKey: space.oldKey,
      newKey: created.key,
      newId: String(created.id),
      name: created.name,
    });
  }
}

console.log("\n=== Resumen de Spaces creados ===");
console.log(JSON.stringify(results, null, 2));
console.log("\nCopia el JSON anterior para actualizar la BD.");
