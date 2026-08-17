import { parseGanttBuffer } from "./server/ganttParser.ts";

const resp = await fetch('https://d2xsxph8kpxj0f.cloudfront.net/310519663043443217/bXMkzYF2PmF6AbhicJnZQ6/gantt/150001/1773275212675_Gantt%20SFA%20Tanner%2020260224.xlsx%20(1).xlsx');
const buf = Buffer.from(await resp.arrayBuffer());
const rows = parseGanttBuffer(buf);

console.log("=== HITOS ===");
const hitos = rows.filter(r => r.isHito);
hitos.forEach(h => console.log(JSON.stringify({ name: h.name, start: h.startDate, end: h.endDate })));

console.log("\n=== PHASES (level 1) ===");
const phases = rows.filter(r => r.level === 1 && !r.isHito);
phases.forEach(p => console.log(JSON.stringify({ name: p.name, start: p.startDate, end: p.endDate })));

console.log("\n=== PROJECT (level 0) ===");
const project = rows.filter(r => r.level === 0);
project.forEach(p => console.log(JSON.stringify({ name: p.name, start: p.startDate, end: p.endDate })));
