import fs from 'node:fs';

const pagePath = '/home/ubuntu/prodigio-pmo/client/src/pages/stages/ExecutiveDashboardV2.tsx';
const source = fs.readFileSync(pagePath, 'utf8');
const marker = /(<div className="edv2-card" style=\{\{ marginTop: 16 \}\}><div className="edv2-card-head"><h3>Línea de tiempo contractual — baseline vs\. real<\/h3>[\s\S]*?<\/div><\/div>)<\/div>(\n\s*<div className="edv2-card" style=\{\{ marginTop: 16 \}\}><div className="edv2-card-head"><h3>Hitos vencidos sin aceptación y evidencia por hito<\/h3>)/;
const next = source.replace(marker, '$1$2');

if (next === source) {
  throw new Error('No se encontró el cierre adicional del cronograma contractual.');
}

fs.writeFileSync(pagePath, next);
