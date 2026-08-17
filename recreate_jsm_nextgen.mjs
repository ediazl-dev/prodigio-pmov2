/**
 * Elimina los 3 Spaces JSM classic (MDSTIEX, MDSCEN, MDSCLA) y los recrea
 * con el template next-gen (simplified-it-service-management) que coincide
 * con el estándar MSCSPP de referencia.
 */
import { config } from "dotenv";
config();

const BASE = process.env.JIRA_BASE_URL;
const auth = Buffer.from(process.env.JIRA_EMAIL + ":" + process.env.JIRA_API_TOKEN).toString("base64");
const H = {
  "Authorization": "Basic " + auth,
  "Accept": "application/json",
  "Content-Type": "application/json",
};

const OWNER_ACCOUNT_ID = "712020:326edb27-3fca-4a40-afc0-9a274e88fba0";
const CATEGORY_ID = "10007"; // Mesa de Servicio
// Verified via API testing: this is the only template that produces style='next-gen', simplified=true
const TEMPLATE_KEY = "com.atlassian.servicedesk:next-gen-it-service-desk";

// Los 3 Spaces a re-crear
const SPACES = [
  { key: "MDSTIEX", name: "Mesa de Servicio - Komatsu TIEX",        description: "Mesa de Servicio: PMO Komatsu - Modernización TIEX" },
  { key: "MDSCEN",  name: "Mesa de Servicio - CEN Portal Pronósticos", description: "Mesa de Servicio: Soporte Portal de Pronósticos - CEN" },
  { key: "MDSCLA",  name: "Mesa de Servicio - Claro Ecuador Apigee", description: "Mesa de Servicio: Claro Ecuador - Soporte Apigee" },
];

async function deleteProject(key) {
  console.log(`  Eliminando ${key}...`);
  const r = await fetch(`${BASE}/rest/api/3/project/${key}`, {
    method: "DELETE", headers: H,
  });
  if (r.status === 204 || r.status === 200) {
    console.log(`  ✓ ${key} eliminado`);
    return true;
  }
  const text = await r.text();
  console.error(`  ✗ Error eliminando ${key}: ${r.status} ${text.substring(0, 150)}`);
  return false;
}

async function createProject(space) {
  console.log(`  Creando ${space.key} con template next-gen...`);
  const body = {
    name: space.name,
    key: space.key,
    projectTypeKey: "service_desk",
    projectTemplateKey: TEMPLATE_KEY,
    leadAccountId: OWNER_ACCOUNT_ID,
    description: space.description,
    assigneeType: "UNASSIGNED",
    categoryId: CATEGORY_ID,
  };
  const r = await fetch(`${BASE}/rest/api/3/project`, {
    method: "POST", headers: H, body: JSON.stringify(body),
  });
  const data = await r.json();
  if (r.ok && data.id) {
    console.log(`  ✓ ${space.key} creado: id=${data.id}, key=${data.key}`);
    return data;
  }
  console.error(`  ✗ Error creando ${space.key}: ${r.status} ${JSON.stringify(data).substring(0, 200)}`);
  return null;
}

async function verifyProject(key) {
  const r = await fetch(`${BASE}/rest/api/3/project/${key}`, { headers: H });
  const p = await r.json();
  return {
    key: p.key,
    style: p.style,
    simplified: p.simplified,
    projectTypeKey: p.projectTypeKey,
    category: p.projectCategory?.name,
    issueTypes: p.issueTypes?.map(t => t.name),
  };
}

// Main
console.log("=== Re-creación de Spaces JSM con estándar next-gen ===\n");

const results = [];
for (const space of SPACES) {
  console.log(`\n--- ${space.key} ---`);
  
  // 1. Eliminar el Space classic existente
  const deleted = await deleteProject(space.key);
  if (!deleted) {
    results.push({ key: space.key, status: "ERROR_DELETE" });
    continue;
  }
  
  // Pequeña pausa para que JIRA procese la eliminación
  await new Promise(r => setTimeout(r, 2000));
  
  // 2. Crear el nuevo Space con template next-gen
  const created = await createProject(space);
  if (!created) {
    results.push({ key: space.key, status: "ERROR_CREATE" });
    continue;
  }
  
  // 3. Verificar el resultado
  await new Promise(r => setTimeout(r, 1500));
  const verified = await verifyProject(space.key);
  results.push({ key: space.key, status: "OK", ...verified });
}

console.log("\n=== Resumen ===");
for (const r of results) {
  if (r.status === "OK") {
    console.log(`✓ ${r.key}: style=${r.style}, simplified=${r.simplified}, issueTypes=${r.issueTypes?.length}`);
  } else {
    console.log(`✗ ${r.key}: ${r.status}`);
  }
}
console.log("\nListo.");
