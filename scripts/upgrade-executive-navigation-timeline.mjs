import { readFileSync, writeFileSync } from "node:fs";

const pagePath = "/home/ubuntu/prodigio-pmo/client/src/pages/stages/ExecutiveDashboardV2.tsx";
const cssPath = "/home/ubuntu/prodigio-pmo/client/src/index.css";
let page = readFileSync(pagePath, "utf8");

function replaceOnce(source, pattern, replacement, label) {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`No se encontró el bloque esperado: ${label}`);
  return next;
}

page = replaceOnce(
  page,
  /  const sortedDatedMilestones = milestones\.filter\(\(milestone\) => milestone\.committedDate \|\| milestone\.baselineDate\);[\s\S]*?  const notAccepted = contractual\.openOverdueCount \?\? 0;/,
  `  const timelineCandidates = milestones.flatMap((milestone) => [milestone.baselineDate, milestone.committedDate, milestone.acceptedAt]);
  const timelineDates = timelineCandidates.map((value) => Date.parse(\`\${String(value ?? "").slice(0, 10)}T00:00:00Z\`)).filter(Number.isFinite);
  const minDate = timelineDates.length ? Math.min(...timelineDates) : 0;
  const maxDate = timelineDates.length ? Math.max(...timelineDates) : 0;
  const timelineSpan = Math.max(maxDate - minDate, 24 * 60 * 60 * 1000);
  const timelinePosition = (value: unknown) => {
    const date = Date.parse(\`\${String(value ?? "").slice(0, 10)}T00:00:00Z\`);
    return Number.isFinite(date) && minDate ? Math.min(94, Math.max(2, ((date - minDate) / timelineSpan) * 92 + 3)) : null;
  };
  const notAccepted = contractual.openOverdueCount ?? 0;`,
  "cálculo de fechas del cronograma",
);

page = replaceOnce(
  page,
  /    <nav className="edv2-subnav"[\s\S]*?<\/nav>\n\n    <div className="edv2-wrap">/,
  `    <div className="edv2-body-shell">
      <aside className="edv2-side-nav" aria-label="Navegación lateral del dashboard ejecutivo">
        <p className="edv2-side-nav-title">Navegación</p>
        <a href="#veredicto"><em>00</em>Observación IA</a><a href="#hitos"><em>01</em>Hitos</a><a href="#finanzas"><em>02</em>Impacto</a><a href="#exigencias"><em>03</em>Exigencias</a><a href="#operacion"><em>04</em>Operación</a><a href="#minutas"><em>05</em>Minutas</a><a href="#perspectivas"><em>06</em>Vistas derivadas</a><a href="#trazabilidad"><em>07</em>Trazabilidad</a>
        <a className="edv2-side-nav-return" href={\`/projects/\${projectId}\`}>← Volver al proyecto</a>
      </aside>
      <div className="edv2-main-content"><div className="edv2-wrap">`,
  "navegación horizontal",
);

page = replaceOnce(
  page,
  /<div className="edv2-card" style=\{\{ marginTop: 16 \}\}><div className="edv2-card-head"><h3>Línea de tiempo contractual — baseline vs\. real<\/h3>[\s\S]*?<\/div><\/div>\n\s*<div className="edv2-card" style=\{\{ marginTop: 16 \}\}><div className="edv2-card-head"><h3>Hitos vencidos sin aceptación y evidencia por hito<\/h3>/,
  `<div className="edv2-card" style={{ marginTop: 16 }}><div className="edv2-card-head"><h3>Línea de tiempo contractual — baseline vs. real</h3><span>fechas SoW · compromiso · aceptación</span></div><div className="edv2-gantt"><div className="edv2-gantt-axis"><span>Hito contractual</span><span>Baseline / real acreditado</span></div>{milestones.map((milestone) => { const baselinePosition = timelinePosition(milestone.baselineDate); const realizedDate = milestone.acceptedAt ?? milestone.committedDate; const realizedPosition = timelinePosition(realizedDate); const accepted = Boolean(milestone.acceptedAt && milestone.acceptanceEvidenceUrl); const overdue = milestone.acceptanceStatus !== "accepted" && milestone.committedDate && Date.parse(\`\${String(milestone.committedDate).slice(0, 10)}T00:00:00Z\`) < Date.parse(\`\${cutoff.date}T00:00:00Z\`); return <div className="edv2-gantt-row" key={milestone.id}><div className="edv2-hito"><code>{milestone.milestoneCode}</code><span title={milestone.title}>{milestone.title}</span></div><div><div className="edv2-track" title={\`Baseline: \${formatDate(milestone.baselineDate)}. Compromiso: \${formatDate(milestone.committedDate)}. Aceptación: \${formatDate(milestone.acceptedAt)}\`}>{baselinePosition != null ? <i className="edv2-dot baseline" style={{ left: \`\${baselinePosition}%\` }} /> : null}{realizedPosition != null ? <i className={\`edv2-dot realized \${accepted ? "accepted" : overdue ? "overdue" : "pending"}\`} style={{ left: \`\${realizedPosition}%\` }} /> : null}</div><div className="edv2-timeline-dates"><span><b>Baseline</b> {formatDate(milestone.baselineDate)}</span><span><b>Real</b> {accepted ? formatDate(milestone.acceptedAt) : milestone.committedDate ? \`Compromiso: \${formatDate(milestone.committedDate)}\` : "[POR CONFIRMAR]"}</span></div></div></div>; })}</div></div></div>
       <div className="edv2-card" style={{ marginTop: 16 }}><div className="edv2-card-head"><h3>Hitos vencidos sin aceptación y evidencia por hito</h3>`,
  "línea de tiempo contractual",
);

page = replaceOnce(
  page,
  /    <footer className="edv2-footer">/,
  "    </div></div>\n    <footer className=\"edv2-footer\">",
  "cierre del rail lateral",
);

writeFileSync(pagePath, page);

let css = readFileSync(cssPath, "utf8");
if (!css.includes(".edv2-root .edv2-body-shell")) {
  css += `

/* Rail lateral del Dashboard Ejecutivo v2: navegación persistente en escritorio y flujo único en móvil. */
.edv2-root .edv2-body-shell { display: grid; grid-template-columns: 216px minmax(0, 1fr); align-items: start; max-width: 1560px; margin: 0 auto; }
.edv2-root .edv2-side-nav { align-self: start; background: #F7F9FB; border-right: 1px solid #DDE3EA; display: grid; gap: 2px; min-height: calc(100vh - 60px); padding: 24px 14px; position: sticky; top: 60px; }
.edv2-root .edv2-side-nav-title { color: #7E8896; font: 700 9px "JetBrains Mono", monospace; letter-spacing: .14em; margin: 0 8px 10px; text-transform: uppercase; }
.edv2-root .edv2-side-nav a { border-left: 3px solid transparent; color: #5A6472; display: flex; font-size: 12px; gap: 8px; padding: 9px 8px; text-decoration: none; }
.edv2-root .edv2-side-nav a:hover { background: #E8EDF1; border-left-color: #00B3A4; color: #0D1117; }
.edv2-root .edv2-side-nav em { color: #7E8896; font: 9px "JetBrains Mono", monospace; font-style: normal; padding-top: 2px; }
.edv2-root .edv2-side-nav .edv2-side-nav-return { border: 1px solid #DDE3EA; color: #0D1117; font-weight: 700; margin: 18px 4px 0; }
.edv2-root .edv2-side-nav .edv2-side-nav-return:hover { border-left-color: #00B3A4; }
.edv2-root .edv2-main-content { min-width: 0; }
.edv2-root .edv2-timeline-dates { color: #5A6472; display: flex; flex-wrap: wrap; font-size: 10px; gap: 6px 14px; margin-top: 5px; }
.edv2-root .edv2-timeline-dates b { color: #0D1117; font: 700 9px "JetBrains Mono", monospace; letter-spacing: .07em; text-transform: uppercase; }
.edv2-root .edv2-dot.baseline { background: #F2F4F7; border-color: #7E8896; box-shadow: 0 0 0 1px #7E8896; top: 5px; }
.edv2-root .edv2-dot.realized { top: 5px; transform: translateY(4px); }
@media (max-width: 980px) { .edv2-root .edv2-body-shell { display: block; } .edv2-root .edv2-side-nav { border-bottom: 1px solid #DDE3EA; border-right: 0; display: flex; gap: 4px; min-height: auto; overflow-x: auto; padding: 8px 15px; position: sticky; top: 60px; z-index: 50; } .edv2-root .edv2-side-nav-title { display: none; } .edv2-root .edv2-side-nav a { white-space: nowrap; } .edv2-root .edv2-side-nav .edv2-side-nav-return { margin: 0 0 0 auto; } }
@media (max-width: 640px) { .edv2-root .edv2-side-nav { top: 60px; } .edv2-root .edv2-side-nav a { font-size: 11px; padding: 8px 6px; } .edv2-root .edv2-side-nav em { display: none; } .edv2-root .edv2-side-nav .edv2-side-nav-return { display: none; } .edv2-root .edv2-timeline-dates { display: grid; gap: 3px; } }
`;
  writeFileSync(cssPath, css);
}
