import { readFileSync, writeFileSync } from "node:fs";

const file = "client/src/pages/stages/ExecutiveDashboardV2.tsx";
let source = readFileSync(file, "utf8");
const minutesSection = '<section className="edv2-section" id="minutas">';
const start = source.indexOf(minutesSection);
if (start < 0) throw new Error("No se encontró la zona documental.");

const closing = source.indexOf("</div></section>", start);
if (closing < 0) throw new Error("No se encontró el cierre de la zona documental.");

const coverageCard = `<article className="edv2-card" style={{ gridColumn: "1 / -1" }}><div className="edv2-card-head"><h3>Cobertura de evidencia — semanas desde kickoff</h3><span>baseline a corte observado</span></div><div className="edv2-evidence-panel"><p className="edv2-kpi-label">Semanas revisadas / exigibles</p><p className="edv2-evidence-value">{minutesCoverage.expectedWeeks == null ? "[POR CONFIRMAR]" : \`\${minutesCoverage.reviewedWeeks}/\${minutesCoverage.expectedWeeks}\`}</p><p className="edv2-note">{minutesCoverage.expectedWeeks == null ? "[PENDIENTE] No existe una fecha de baseline suficiente para calcular semanas exigibles." : \`Cobertura revisada: \${minutesCoverage.coveragePct ?? 0}%. Las minutas recibidas sin revisión no mejoran esta métrica.\`}</p><p className="edv2-note" style={{ marginTop: 10 }}><b>Brecha consecutiva:</b> {minutesCoverage.consecutiveGapWeeks == null ? "[POR CONFIRMAR]" : \`\${minutesCoverage.consecutiveGapWeeks} semana(s)\`} · <b>recibidas sin revisión:</b> {minutesCoverage.receivedUnreviewedWeeks} · <b>semanas faltantes:</b> {minutesCoverage.missingWeeks?.length ? \`\${minutesCoverage.missingWeeks.slice(0, 6).join(", ")}\${minutesCoverage.missingWeeks.length > 6 ? "…" : ""}\` : "[NINGUNA]"}.</p></div></article>`;

source = `${source.slice(0, closing)}${coverageCard}${source.slice(closing)}`;
writeFileSync(file, source);
