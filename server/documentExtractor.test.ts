import { describe, it, expect } from "vitest";
import {
  detectMimeType,
  isDocx,
  isExcel,
  isPdf,
  extractTextFromExcel,
} from "./documentExtractor";

describe("documentExtractor", () => {
  describe("detectMimeType", () => {
    it("detects PDF files", () => {
      expect(detectMimeType("https://example.com/file.pdf")).toBe("application/pdf");
      expect(detectMimeType("https://example.com/file.PDF", "Report.pdf")).toBe("application/pdf");
    });

    it("detects DOCX files", () => {
      expect(detectMimeType("https://example.com/file.docx")).toBe(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      expect(detectMimeType("https://example.com/file", "SoW Final.docx")).toBe(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
    });

    it("detects XLSX files", () => {
      expect(detectMimeType("https://example.com/gantt.xlsx")).toBe(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
    });

    it("detects XLS files", () => {
      expect(detectMimeType("https://example.com/old.xls")).toBe("application/vnd.ms-excel");
    });

    it("detects PPTX files", () => {
      expect(detectMimeType("https://example.com/report.pptx")).toBe(
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      );
    });

    it("detects CSV files", () => {
      expect(detectMimeType("https://example.com/data.csv")).toBe("text/csv");
    });

    it("detects image files", () => {
      expect(detectMimeType("https://example.com/photo.png")).toBe("image/png");
      expect(detectMimeType("https://example.com/photo.jpg")).toBe("image/jpeg");
      expect(detectMimeType("https://example.com/photo.jpeg")).toBe("image/jpeg");
    });

    it("returns octet-stream for unknown types", () => {
      expect(detectMimeType("https://example.com/file.xyz")).toBe("application/octet-stream");
      expect(detectMimeType("https://example.com/file")).toBe("application/octet-stream");
    });

    it("prefers fileName over URL for detection", () => {
      expect(detectMimeType("https://example.com/blob/abc123", "Report.docx")).toBe(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
    });
  });

  describe("isDocx", () => {
    it("returns true for .docx files", () => {
      expect(isDocx("https://example.com/file.docx")).toBe(true);
      expect(isDocx("https://example.com/blob", "SoW.docx")).toBe(true);
    });

    it("returns false for non-docx files", () => {
      expect(isDocx("https://example.com/file.pdf")).toBe(false);
      expect(isDocx("https://example.com/file.xlsx")).toBe(false);
      expect(isDocx("https://example.com/file.doc")).toBe(false);
    });
  });

  describe("isExcel", () => {
    it("returns true for Excel files", () => {
      expect(isExcel("https://example.com/file.xlsx")).toBe(true);
      expect(isExcel("https://example.com/file.xls")).toBe(true);
      expect(isExcel("https://example.com/file.csv")).toBe(true);
      expect(isExcel("https://example.com/blob", "Gantt.xlsx")).toBe(true);
    });

    it("returns false for non-Excel files", () => {
      expect(isExcel("https://example.com/file.pdf")).toBe(false);
      expect(isExcel("https://example.com/file.docx")).toBe(false);
    });
  });

  describe("isPdf", () => {
    it("returns true for PDF files", () => {
      expect(isPdf("https://example.com/file.pdf")).toBe(true);
      expect(isPdf("https://example.com/blob", "Report.pdf")).toBe(true);
    });

    it("returns false for non-PDF files", () => {
      expect(isPdf("https://example.com/file.docx")).toBe(false);
      expect(isPdf("https://example.com/file.xlsx")).toBe(false);
    });
  });

  describe("extractTextFromExcel", () => {
    it("extracts text from a simple Excel buffer", () => {
      // Create a minimal XLSX buffer using the xlsx library
      const XLSX = require("xlsx");
      const wb = XLSX.utils.book_new();
      const data = [
        ["Tarea", "Inicio", "Fin", "Estado"],
        ["Kickoff", "2026-01-01", "2026-01-05", "Completado"],
        ["Análisis", "2026-01-06", "2026-02-01", "En progreso"],
        ["Desarrollo", "2026-02-02", "2026-04-01", "Pendiente"],
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "Gantt");
      const buffer = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));

      const result = extractTextFromExcel(buffer);
      expect(result).toContain("Gantt");
      expect(result).toContain("Kickoff");
      expect(result).toContain("Análisis");
      expect(result).toContain("Desarrollo");
      expect(result).toContain("3 filas");
    });
  });

  describe("file type routing logic", () => {
    it("correctly routes DOCX SoW files to mammoth extraction", () => {
      // Verify the routing logic: DOCX should NOT go through LLM file_url
      const testFiles = [
        { url: "https://cdn.example.com/sow.docx", fileName: "SoW Proyecto.docx", expectedRoute: "docx" },
        { url: "https://cdn.example.com/sow.pdf", fileName: "SoW Proyecto.pdf", expectedRoute: "pdf" },
        { url: "https://cdn.example.com/sow.xlsx", fileName: "SoW Data.xlsx", expectedRoute: "excel" },
        { url: "https://cdn.example.com/blob/abc", fileName: "Propuesta.docx", expectedRoute: "docx" },
      ];

      for (const f of testFiles) {
        if (isDocx(f.url, f.fileName)) {
          expect(f.expectedRoute).toBe("docx");
        } else if (isPdf(f.url, f.fileName)) {
          expect(f.expectedRoute).toBe("pdf");
        } else if (isExcel(f.url, f.fileName)) {
          expect(f.expectedRoute).toBe("excel");
        }
      }
    });

    it("correctly routes Gantt files to appropriate extractors", () => {
      const testFiles = [
        { url: "https://cdn.example.com/gantt.xlsx", fileName: "Gantt SFA.xlsx", expectedRoute: "excel" },
        { url: "https://cdn.example.com/gantt.xls", fileName: "Gantt Legacy.xls", expectedRoute: "excel" },
        { url: "https://cdn.example.com/gantt.csv", fileName: "Timeline.csv", expectedRoute: "excel" },
        { url: "https://cdn.example.com/gantt.pdf", fileName: "Cronograma.pdf", expectedRoute: "pdf" },
      ];

      for (const f of testFiles) {
        if (isExcel(f.url, f.fileName)) {
          expect(f.expectedRoute).toBe("excel");
        } else if (isPdf(f.url, f.fileName)) {
          expect(f.expectedRoute).toBe("pdf");
        }
      }
    });
  });

  describe("LLM-compatible file types", () => {
    it("only PDF should be sent directly to LLM file_url", () => {
      // These are the ONLY mime types the LLM API supports via file_url:
      // "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4"
      const llmSupportedDocTypes = ["application/pdf"];
      
      const testCases = [
        { ext: ".docx", mime: detectMimeType("file.docx"), shouldUseLLM: false },
        { ext: ".xlsx", mime: detectMimeType("file.xlsx"), shouldUseLLM: false },
        { ext: ".xls", mime: detectMimeType("file.xls"), shouldUseLLM: false },
        { ext: ".csv", mime: detectMimeType("file.csv"), shouldUseLLM: false },
        { ext: ".pptx", mime: detectMimeType("file.pptx"), shouldUseLLM: false },
        { ext: ".pdf", mime: detectMimeType("file.pdf"), shouldUseLLM: true },
      ];

      for (const tc of testCases) {
        const isLLMCompatible = llmSupportedDocTypes.includes(tc.mime);
        expect(isLLMCompatible).toBe(tc.shouldUseLLM);
      }
    });
  });
});
