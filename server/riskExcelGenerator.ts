import ExcelJS from "exceljs";

const PROB_LABEL: Record<string, string> = { alta: "Alta", media: "Media", baja: "Baja" };
const IMPACT_LABEL: Record<string, string> = { alto: "Alto", medio: "Medio", bajo: "Bajo" };
const TYPE_LABEL: Record<string, string> = {
  riesgo: "Técnico",
  riesgo_oculto: "Oculto",
  supuesto_no_validado: "Supuesto No Validado",
  dependencia_externa: "Dependencia Externa",
};
const CAT_LABEL: Record<string, string> = {
  tecnico: "Técnico",
  organizacional: "Organizacional",
  externo: "Externo",
  oculto: "Oculto",
};

// Risk score matrix: probability × impact
function riskScore(probability: string, impact: string): number {
  const probScore: Record<string, number> = { alta: 3, media: 2, baja: 1 };
  const impactScore: Record<string, number> = { alto: 3, medio: 2, bajo: 1 };
  return (probScore[probability] ?? 1) * (impactScore[impact] ?? 1);
}

function riskLevel(score: number): string {
  if (score >= 7) return "CRÍTICO";
  if (score >= 5) return "ALTO";
  if (score >= 3) return "MEDIO";
  return "BAJO";
}

function riskLevelColor(level: string): string {
  switch (level) {
    case "CRÍTICO": return "FFDC2626"; // red-600
    case "ALTO": return "FFEA580C"; // orange-600
    case "MEDIO": return "FFD97706"; // amber-600
    default: return "FF16A34A"; // green-600
  }
}

export async function generateRiskMatrixExcel(
  risks: any[],
  projectName: string,
  clientName: string,
  version: string,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Prodigio PMO Platform";
  wb.created = new Date();

  // ==================== PORTADA ====================
  const coverSheet = wb.addWorksheet("Portada", {
    pageSetup: { paperSize: 9, orientation: "landscape" },
  });
  coverSheet.mergeCells("A1:J1");
  coverSheet.getCell("A1").value = "MATRIZ DE RIESGOS";
  coverSheet.getCell("A1").font = { name: "Calibri", bold: true, size: 24, color: { argb: "FFFFFFFF" } };
  coverSheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
  coverSheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  coverSheet.getRow(1).height = 50;

  coverSheet.mergeCells("A2:J2");
  coverSheet.getCell("A2").value = `Proyecto: ${projectName}`;
  coverSheet.getCell("A2").font = { name: "Calibri", bold: true, size: 14, color: { argb: "FF334155" } };
  coverSheet.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
  coverSheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };
  coverSheet.getRow(2).height = 30;

  coverSheet.mergeCells("A3:J3");
  coverSheet.getCell("A3").value = `Cliente: ${clientName}  |  Versión: ${version}  |  Fecha: ${new Date().toLocaleDateString("es-CL")}`;
  coverSheet.getCell("A3").font = { name: "Calibri", size: 11, color: { argb: "FF64748B" } };
  coverSheet.getCell("A3").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
  coverSheet.getCell("A3").alignment = { horizontal: "center", vertical: "middle" };
  coverSheet.getRow(3).height = 24;

  // Summary stats
  const highRisks = risks.filter(r => riskScore(r.probability, r.impact) >= 7).length;
  const medRisks = risks.filter(r => { const s = riskScore(r.probability, r.impact); return s >= 3 && s < 7; }).length;
  const lowRisks = risks.filter(r => riskScore(r.probability, r.impact) < 3).length;

  const summaryData = [
    ["", ""],
    ["RESUMEN EJECUTIVO", ""],
    ["Total de Riesgos Identificados", risks.length],
    ["Riesgos Críticos/Altos", highRisks],
    ["Riesgos Medios", medRisks],
    ["Riesgos Bajos", lowRisks],
    ["", ""],
    ["Generado por", "Prodigio PMO Platform"],
    ["Versión del documento", version],
    ["Fecha de generación", new Date().toLocaleDateString("es-CL")],
  ];

  summaryData.forEach((row, i) => {
    const r = coverSheet.getRow(5 + i);
    r.getCell("B").value = row[0];
    r.getCell("C").value = row[1];
    if (row[0] === "RESUMEN EJECUTIVO") {
      r.getCell("B").font = { bold: true, size: 13, color: { argb: "FF1E293B" } };
    } else if (row[0]) {
      r.getCell("B").font = { size: 11, color: { argb: "FF475569" } };
      r.getCell("C").font = { bold: true, size: 11, color: { argb: "FF1E293B" } };
    }
    r.height = 20;
  });

  // ==================== MATRIZ PRINCIPAL ====================
  const ws = wb.addWorksheet("Matriz de Riesgos", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1 },
    properties: { tabColor: { argb: "FF1E293B" } },
  });

  // Header row
  const headers = [
    "Código", "Tipo", "Categoría", "Descripción del Riesgo",
    "Probabilidad", "Impacto", "Nivel de Riesgo", "Estrategia de Mitigación",
    "Plan de Contingencia", "Responsable", "Fecha Estimada", "Costo Estimado", "Estado",
  ];

  const headerRow = ws.getRow(1);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: "Calibri", bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FF334155" } },
      bottom: { style: "thin", color: { argb: "FF334155" } },
      left: { style: "thin", color: { argb: "FF334155" } },
      right: { style: "thin", color: { argb: "FF334155" } },
    };
  });
  headerRow.height = 36;

  // Column widths
  const colWidths = [10, 20, 16, 50, 14, 12, 16, 55, 45, 22, 16, 18, 14];
  colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // Data rows
  risks.forEach((risk, idx) => {
    const score = riskScore(risk.probability, risk.impact);
    const level = riskLevel(score);
    const levelColor = riskLevelColor(level);
    const isEven = idx % 2 === 0;
    const bgColor = isEven ? "FFFAFAFA" : "FFFFFFFF";

    const row = ws.getRow(idx + 2);
    const values = [
      risk.riskCode ?? `R${String(idx + 1).padStart(3, "0")}`,
      TYPE_LABEL[risk.type] ?? risk.type,
      CAT_LABEL[risk.category] ?? risk.category,
      risk.description ?? "",
      PROB_LABEL[risk.probability] ?? risk.probability,
      IMPACT_LABEL[risk.impact] ?? risk.impact,
      level,
      risk.mitigation ?? "",
      risk.contingency ?? "",
      risk.owner ?? "",
      risk.dueDate ?? "",
      risk.estimatedCost ?? "",
      risk.status === "mitigado" ? "Mitigado" : risk.status === "cerrado" ? "Cerrado" : "Abierto",
    ];

    values.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v;
      cell.font = { name: "Calibri", size: 9 };
      cell.alignment = { vertical: "top", wrapText: true, horizontal: i === 0 ? "center" : "left" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
      cell.border = {
        top: { style: "hair", color: { argb: "FFE2E8F0" } },
        bottom: { style: "hair", color: { argb: "FFE2E8F0" } },
        left: { style: "hair", color: { argb: "FFE2E8F0" } },
        right: { style: "hair", color: { argb: "FFE2E8F0" } },
      };

      // Color the risk level cell
      if (i === 6) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: levelColor } };
        cell.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
        cell.alignment = { horizontal: "center", vertical: "top" };
      }
      // Color probability
      if (i === 4) {
        const probColors: Record<string, string> = { Alta: "FFDC2626", Media: "FFD97706", Baja: "FF16A34A" };
        const pc = probColors[v as string];
        if (pc) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: pc } };
          cell.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
          cell.alignment = { horizontal: "center", vertical: "top" };
        }
      }
      // Color impact
      if (i === 5) {
        const impColors: Record<string, string> = { Alto: "FFDC2626", Medio: "FFD97706", Bajo: "FF16A34A" };
        const ic = impColors[v as string];
        if (ic) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ic } };
          cell.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
          cell.alignment = { horizontal: "center", vertical: "top" };
        }
      }
    });
    row.height = 60;
  });

  // ==================== HEATMAP ====================
  const heatSheet = wb.addWorksheet("Mapa de Calor", {
    properties: { tabColor: { argb: "FFDC2626" } },
  });

  heatSheet.mergeCells("A1:F1");
  heatSheet.getCell("A1").value = "MAPA DE CALOR - MATRIZ DE RIESGOS";
  heatSheet.getCell("A1").font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  heatSheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
  heatSheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  heatSheet.getRow(1).height = 36;

  // Heatmap grid: rows = impact (alto, medio, bajo), cols = probability (baja, media, alta)
  const heatColors = [
    ["FFD97706", "FFDC2626", "FFDC2626"], // alto impact
    ["FF16A34A", "FFD97706", "FFDC2626"], // medio impact
    ["FF16A34A", "FF16A34A", "FFD97706"], // bajo impact
  ];
  const impactLabels = ["Alto", "Medio", "Bajo"];
  const probLabels = ["Baja", "Media", "Alta"];

  // Header
  heatSheet.getRow(3).getCell(2).value = "PROBABILIDAD →";
  heatSheet.getRow(3).getCell(2).font = { bold: true };
  ["", "Baja", "Media", "Alta"].forEach((v, i) => {
    const cell = heatSheet.getRow(4).getCell(i + 2);
    cell.value = v;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
    cell.alignment = { horizontal: "center" };
  });

  heatSheet.getRow(4).getCell(1).value = "IMPACTO ↓";
  heatSheet.getRow(4).getCell(1).font = { bold: true };

  impactLabels.forEach((imp, ri) => {
    const row = heatSheet.getRow(5 + ri);
    row.getCell(1).value = imp;
    row.getCell(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
    row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };

    probLabels.forEach((prob, ci) => {
      const cell = row.getCell(ci + 2);
      const impLower = imp.toLowerCase();
      const probLower = prob.toLowerCase();
      const count = risks.filter(r =>
        IMPACT_LABEL[r.impact]?.toLowerCase() === impLower &&
        PROB_LABEL[r.probability]?.toLowerCase() === probLower
      ).length;

      cell.value = count > 0 ? `${count} riesgo${count > 1 ? "s" : ""}` : "-";
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: heatColors[ri][ci] } };
      cell.font = { bold: count > 0, color: { argb: "FFFFFFFF" }, size: 11 };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFFFFFFF" } },
        bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
        left: { style: "thin", color: { argb: "FFFFFFFF" } },
        right: { style: "thin", color: { argb: "FFFFFFFF" } },
      };
      row.height = 40;
    });
  });

  [1, 2, 3, 4, 5].forEach(i => { heatSheet.getColumn(i).width = 20; });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
