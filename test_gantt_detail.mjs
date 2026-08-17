import { parseGanttBuffer } from "./server/ganttParser.ts";

const resp = await fetch('https://d2xsxph8kpxj0f.cloudfront.net/310519663043443217/bXMkzYF2PmF6AbhicJnZQ6/gantt/150001/1773275212675_Gantt%20SFA%20Tanner%2020260224.xlsx%20(1).xlsx');
const buf = Buffer.from(await resp.arrayBuffer());
const rows = parseGanttBuffer(buf);

console.log(`Total rows: ${rows.length}`);
console.log(`\n=== ALL ROWS (first 30) ===`);
rows.slice(0, 30).forEach(r => {
  const prefix = "  ".repeat(r.level);
  const hitoFlag = r.isHito ? " [HITO]" : "";
  const summaryFlag = r.isSummary ? " [SUMMARY]" : "";
  console.log(`${prefix}L${r.level} ${r.name}${hitoFlag}${summaryFlag} | ${r.startDate || "-"} → ${r.endDate || "-"}`);
});

// Check if any row name contains "hito" case insensitive
const hitoLike = rows.filter(r => r.name.toLowerCase().includes("hito"));
console.log(`\n=== ROWS containing "hito" in name: ${hitoLike.length} ===`);
hitoLike.forEach(r => console.log(`  L${r.level} ${r.name} | isHito=${r.isHito} | ${r.startDate} → ${r.endDate}`));

// Show phases (level 1)
const phases = rows.filter(r => r.level === 1);
console.log(`\n=== LEVEL 1 ROWS: ${phases.length} ===`);
phases.forEach(r => console.log(`  ${r.name} | ${r.startDate} → ${r.endDate} | isHito=${r.isHito}`));
