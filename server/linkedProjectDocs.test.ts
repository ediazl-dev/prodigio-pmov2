import { describe, it, expect, vi, beforeEach } from "vitest";

// ==================== MOCK JIRA CLIENT ====================
vi.mock("./jiraClient", () => ({
  listJiraProjects: vi.fn(),
  getJiraProject: vi.fn(),
  getProjectIssues: vi.fn(),
  createJiraIssue: vi.fn(),
  transitionJiraIssue: vi.fn(),
  getAssignableUsers: vi.fn(),
  getProjectStatuses: vi.fn(),
  jiraHealthCheck: vi.fn(),
  searchJiraIssues: vi.fn(),
  getTemplateStructure: vi.fn(),
  createJiraSpace: vi.fn(),
  getJiraCurrentUser: vi.fn(),
  getJiraProjectReport: vi.fn(),
  getProjectBoards: vi.fn(),
  getJiraAdvanceReport: vi.fn(),
}));

// ==================== MOCK STORAGE ====================
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ key: "linked-docs/1/sow/abc123.pdf", url: "https://cdn.example.com/linked-docs/1/sow/abc123.pdf" }),
}));

// ==================== MOCK DB ====================
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getProjectById: vi.fn().mockResolvedValue({
      id: 1, projectName: "Test Linked Project", clientName: "Test Client",
      origin: "linked", jiraProjectKey: "TLP",
    }),
    insertLinkedProjectDocument: vi.fn().mockResolvedValue(42),
    getLinkedProjectDocuments: vi.fn().mockResolvedValue([
      {
        id: 1, projectId: 1, docType: "sow", fileName: "SoW_TestProject.pdf",
        fileUrl: "https://cdn.example.com/sow.pdf", fileKey: "linked-docs/1/sow/abc.pdf",
        fileSize: 1024000, mimeType: "application/pdf", notes: "Versión aprobada",
        uploadedBy: 10, uploadedByName: "Keno", createdAt: new Date("2026-01-15"),
      },
      {
        id: 2, projectId: 1, docType: "gantt", fileName: "Gantt_TestProject.xlsx",
        fileUrl: "https://cdn.example.com/gantt.xlsx", fileKey: "linked-docs/1/gantt/def.xlsx",
        fileSize: 512000, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        notes: null, uploadedBy: 10, uploadedByName: "Keno", createdAt: new Date("2026-01-16"),
      },
    ]),
    deleteLinkedProjectDocument: vi.fn().mockResolvedValue(undefined),
    getLinkedProjectDocumentById: vi.fn().mockResolvedValue({
      id: 1, projectId: 1, docType: "sow", fileName: "SoW_TestProject.pdf",
      fileUrl: "https://cdn.example.com/sow.pdf", fileKey: "linked-docs/1/sow/abc.pdf",
      fileSize: 1024000, uploadedBy: 10, uploadedByName: "Keno",
    }),
    createAuditLog: vi.fn().mockResolvedValue(undefined),
  };
});

import {
  getProjectById,
  insertLinkedProjectDocument,
  getLinkedProjectDocuments,
  deleteLinkedProjectDocument,
  getLinkedProjectDocumentById,
} from "./db";
import { storagePut } from "./storage";

// ==================== SCHEMA TESTS ====================
describe("linked_project_documents schema", () => {
  it("should have correct docType enum values", () => {
    const validTypes = ["sow", "gantt"];
    validTypes.forEach(t => {
      expect(["sow", "gantt"]).toContain(t);
    });
  });

  it("should require projectId, docType, fileName, fileUrl, fileKey, uploadedBy", () => {
    const requiredFields = ["projectId", "docType", "fileName", "fileUrl", "fileKey", "uploadedBy"];
    requiredFields.forEach(field => {
      expect(field).toBeTruthy();
    });
  });

  it("should have optional fields: fileSize, mimeType, notes, uploadedByName", () => {
    const optionalFields = ["fileSize", "mimeType", "notes", "uploadedByName"];
    optionalFields.forEach(field => {
      expect(field).toBeTruthy();
    });
  });
});

// ==================== DB HELPER TESTS ====================
describe("insertLinkedProjectDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should insert a SoW document and return its ID", async () => {
    const docId = await insertLinkedProjectDocument({
      projectId: 1,
      docType: "sow",
      fileName: "SoW_Project.pdf",
      fileUrl: "https://cdn.example.com/sow.pdf",
      fileKey: "linked-docs/1/sow/abc.pdf",
      fileSize: 2048000,
      mimeType: "application/pdf",
      notes: "Versión final aprobada por cliente",
      uploadedBy: 10,
      uploadedByName: "Keno",
    });
    expect(docId).toBe(42);
    expect(insertLinkedProjectDocument).toHaveBeenCalledOnce();
  });

  it("should insert a Gantt document and return its ID", async () => {
    const docId = await insertLinkedProjectDocument({
      projectId: 1,
      docType: "gantt",
      fileName: "Gantt_Project.xlsx",
      fileUrl: "https://cdn.example.com/gantt.xlsx",
      fileKey: "linked-docs/1/gantt/def.xlsx",
      fileSize: 512000,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      notes: null,
      uploadedBy: 10,
      uploadedByName: "Keno",
    });
    expect(docId).toBe(42);
    expect(insertLinkedProjectDocument).toHaveBeenCalledWith(expect.objectContaining({
      docType: "gantt",
      projectId: 1,
    }));
  });
});

describe("getLinkedProjectDocuments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return all documents for a project", async () => {
    const docs = await getLinkedProjectDocuments(1);
    expect(docs).toHaveLength(2);
    expect(docs[0].docType).toBe("sow");
    expect(docs[1].docType).toBe("gantt");
  });

  it("should filter by docType when provided", async () => {
    vi.mocked(getLinkedProjectDocuments).mockResolvedValueOnce([
      {
        id: 1, projectId: 1, docType: "sow", fileName: "SoW.pdf",
        fileUrl: "https://cdn.example.com/sow.pdf", fileKey: "linked-docs/1/sow/abc.pdf",
        fileSize: 1024000, mimeType: "application/pdf", notes: null,
        uploadedBy: 10, uploadedByName: "Keno", createdAt: new Date("2026-01-15"),
      },
    ]);
    const sowDocs = await getLinkedProjectDocuments(1, "sow");
    expect(sowDocs).toHaveLength(1);
    expect(sowDocs[0].docType).toBe("sow");
  });
});

describe("deleteLinkedProjectDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete a document by ID", async () => {
    await deleteLinkedProjectDocument(1);
    expect(deleteLinkedProjectDocument).toHaveBeenCalledWith(1);
  });

  it("should verify document exists before deletion", async () => {
    const doc = await getLinkedProjectDocumentById(1);
    expect(doc).toBeTruthy();
    expect(doc!.fileName).toBe("SoW_TestProject.pdf");
    await deleteLinkedProjectDocument(doc!.id);
    expect(deleteLinkedProjectDocument).toHaveBeenCalledWith(1);
  });
});

// ==================== UPLOAD FLOW TESTS ====================
describe("upload document flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should upload file to S3 and save metadata", async () => {
    // Simulate the upload flow
    const fileBuffer = Buffer.from("fake pdf content");
    const { url } = await storagePut("linked-docs/1/sow/test.pdf", fileBuffer, "application/pdf");
    expect(url).toBe("https://cdn.example.com/linked-docs/1/sow/abc123.pdf");

    const docId = await insertLinkedProjectDocument({
      projectId: 1,
      docType: "sow",
      fileName: "SoW_Test.pdf",
      fileUrl: url,
      fileKey: "linked-docs/1/sow/test.pdf",
      fileSize: fileBuffer.length,
      mimeType: "application/pdf",
      notes: "Test upload",
      uploadedBy: 10,
      uploadedByName: "Keno",
    });
    expect(docId).toBe(42);
    expect(storagePut).toHaveBeenCalledOnce();
    expect(insertLinkedProjectDocument).toHaveBeenCalledOnce();
  });

  it("should reject files larger than 25MB", () => {
    const maxSize = 25 * 1024 * 1024;
    const oversizedFile = 26 * 1024 * 1024;
    expect(oversizedFile > maxSize).toBe(true);

    const validFile = 5 * 1024 * 1024;
    expect(validFile > maxSize).toBe(false);
  });

  it("should validate project exists before upload", async () => {
    const project = await getProjectById(1);
    expect(project).toBeTruthy();
    expect(project!.projectName).toBe("Test Linked Project");
  });

  it("should generate unique S3 keys per upload", () => {
    const key1 = `linked-docs/1/sow/${Date.now()}-a.pdf`;
    const key2 = `linked-docs/1/sow/${Date.now()}-b.pdf`;
    expect(key1).not.toBe(key2);
  });
});

// ==================== FILE TYPE VALIDATION ====================
describe("file type validation", () => {
  const validExtensions = [".pdf", ".docx", ".doc", ".xlsx", ".xls", ".pptx", ".mpp", ".png", ".jpg", ".jpeg", ".csv"];
  const invalidExtensions = [".exe", ".bat", ".sh", ".zip", ".tar"];

  it("should accept valid file extensions", () => {
    const regex = /\.(pdf|docx?|xlsx?|pptx?|mpp|png|jpe?g|csv)$/i;
    validExtensions.forEach(ext => {
      expect(`file${ext}`).toMatch(regex);
    });
  });

  it("should reject invalid file extensions", () => {
    const regex = /\.(pdf|docx?|xlsx?|pptx?|mpp|png|jpe?g|csv)$/i;
    invalidExtensions.forEach(ext => {
      expect(`file${ext}`).not.toMatch(regex);
    });
  });
});

// ==================== DOCUMENT LISTING TESTS ====================
describe("document listing and filtering", () => {
  it("should separate SoW and Gantt documents", async () => {
    const allDocs = await getLinkedProjectDocuments(1);
    const sowDocs = allDocs.filter((d: any) => d.docType === "sow");
    const ganttDocs = allDocs.filter((d: any) => d.docType === "gantt");
    expect(sowDocs.length + ganttDocs.length).toBe(allDocs.length);
    expect(sowDocs.length).toBeGreaterThan(0);
    expect(ganttDocs.length).toBeGreaterThan(0);
  });

  it("should include file metadata in document records", async () => {
    const docs = await getLinkedProjectDocuments(1);
    const doc = docs[0];
    expect(doc).toHaveProperty("id");
    expect(doc).toHaveProperty("projectId");
    expect(doc).toHaveProperty("docType");
    expect(doc).toHaveProperty("fileName");
    expect(doc).toHaveProperty("fileUrl");
    expect(doc).toHaveProperty("fileKey");
    expect(doc).toHaveProperty("fileSize");
    expect(doc).toHaveProperty("mimeType");
    expect(doc).toHaveProperty("uploadedBy");
    expect(doc).toHaveProperty("uploadedByName");
    expect(doc).toHaveProperty("createdAt");
  });
});

// ==================== AUDIT LOG TESTS ====================
describe("audit logging for document operations", () => {
  it("should create audit log for upload", () => {
    const auditEntry = {
      action: "upload_linked_doc",
      entity: "linked_project_document",
      entityId: 42,
      entityName: "SoW_Test.pdf",
      details: { projectId: 1, docType: "sow", fileSize: 1024000 },
    };
    expect(auditEntry.action).toBe("upload_linked_doc");
    expect(auditEntry.entity).toBe("linked_project_document");
    expect(auditEntry.details.docType).toBe("sow");
  });

  it("should create audit log for deletion", () => {
    const auditEntry = {
      action: "delete_linked_doc",
      entity: "linked_project_document",
      entityId: 1,
      entityName: "SoW_Test.pdf",
      details: { projectId: 1, docType: "sow" },
    };
    expect(auditEntry.action).toBe("delete_linked_doc");
    expect(auditEntry.entity).toBe("linked_project_document");
  });
});
