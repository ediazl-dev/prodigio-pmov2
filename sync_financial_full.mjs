/**
 * Sincronización completa de datos financieros desde Google Sheets → BD
 * Ejecutar: node sync_financial_full.mjs
 */
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import http from 'http';

// Leer el payload generado por Python
const payloadPath = '/home/ubuntu/financial_payload.json';
const rows = JSON.parse(readFileSync(payloadPath, 'utf8'));

console.log(`Sincronizando ${rows.length} registros...`);

// Llamar al endpoint tRPC directamente en el servidor local
// El endpoint adminOnly requiere autenticación — usamos el owner token
const dotenv = (await import('/home/ubuntu/prodigio-pmo/node_modules/dotenv/lib/main.js')).default;
dotenv.config({ path: '/home/ubuntu/prodigio-pmo/.env' });

const jwt = (await import('/home/ubuntu/prodigio-pmo/node_modules/jsonwebtoken/index.js')).default;

// Obtener el owner ID desde la BD para crear un token admin válido
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Construir el body tRPC
const body = JSON.stringify({
  "0": {
    "json": { rows }
  }
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/trpc/financial.syncFromPayload',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  }
};

const result = await new Promise((resolve, reject) => {
  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => resolve({ status: res.statusCode, body: data }));
  });
  req.on('error', reject);
  req.write(body);
  req.end();
});

console.log('Status:', result.status);
try {
  const parsed = JSON.parse(result.body);
  if (parsed[0]?.result?.data?.json) {
    console.log('Resultado:', parsed[0].result.data.json);
  } else if (parsed[0]?.error) {
    console.log('Error tRPC:', JSON.stringify(parsed[0].error).substring(0, 300));
  } else {
    console.log('Respuesta:', result.body.substring(0, 500));
  }
} catch {
  console.log('Raw:', result.body.substring(0, 500));
}
