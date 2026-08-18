import { readFileSync, writeFileSync } from "node:fs";

const file = "client/src/pages/stages/ExecutiveDashboardV2.tsx";
let source = readFileSync(file, "utf8");

const replacements = [
  [
    'title="Evidencia documental"',
    'title="Evidencia documental — minutas y compromisos"',
  ],
  [
    "<h3>Pauta del Plan de Recuperación y Descargo</h3>",
    "<h3>Pauta del Plan de Recuperación y Descargo (PRD)</h3>",
  ],
  [
    "<h3>Escalamiento para Delivery</h3>",
    "<h3>Escalamiento — decisiones que requieren al Gerente de Delivery</h3>",
  ],
];

for (const [from, to] of replacements) {
  if (!source.includes(from)) throw new Error(`No se encontró el texto esperado: ${from}`);
  source = source.replace(from, to);
}

const anchor = '\n\n    {canManageRequirements ? <section className="edv2-section" id="preclasificacion"';
const coherence = `

      <section className="edv2-section" id="coherencia-narrativa"><SectionHeader number="05A" title="Coherencia narrativa" lead="El relato ejecutivo se sostiene sólo con documentos y compromisos registrados; los vacíos se declaran como evidencia pendiente." tag="contraste documental" /><article className="edv2-card"><div className="edv2-evidence-panel"><p className="edv2-kpi-label">Estado de contraste</p><p className="edv2-evidence-value">{minutes.length === 0 ? "[PENDIENTE]" : commitments.length ? "REVISABLE" : "EVIDENCIA PARCIAL"}</p><p className="edv2-note">{minutes.length === 0 ? "No existe una minuta real para contrastar hitos, compromisos, riesgos o decisiones. El dashboard no infiere una narrativa favorable ni una causa sin evidencia documental." : commitments.length ? \`Hay \${minutes.length} minuta(s) y \${commitments.length} compromiso(s) registrados. La coherencia queda sujeta a la revisión de PMO contra sus fuentes vinculadas.\` : \`Hay \${minutes.length} minuta(s) registrada(s), pero no hay compromisos revisados. La coherencia narrativa permanece parcial hasta que PMO valide responsables, plazos y decisiones.\`}</p></div></article></section>`;

if (!source.includes(anchor)) throw new Error("No se encontró el ancla de preclasificación documental.");
source = source.replace(anchor, `${coherence}${anchor}`);

writeFileSync(file, source);
