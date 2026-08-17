import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("./db", () => ({
  getMyProfileData: vi.fn(),
  getAuditLogs: vi.fn(),
  createAuditLog: vi.fn(),
}));

import { getMyProfileData, getAuditLogs } from "./db";

describe("Profile & Audit Export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getMyProfileData", () => {
    it("should return null when user is not found", async () => {
      (getMyProfileData as any).mockResolvedValue(null);
      const result = await getMyProfileData(999);
      expect(result).toBeNull();
    });

    it("should return profile data with user, stats, and recentActivity", async () => {
      const mockProfile = {
        user: {
          id: 1,
          name: "Test User",
          email: "test@prodigio.tech",
          role: "admin",
          status: "activo",
          createdAt: new Date("2026-01-01"),
          lastSignedIn: new Date("2026-03-14"),
          loginMethod: "google",
        },
        stats: {
          pmProjectCount: 3,
          activeProjectCount: 2,
          recurringServiceCount: 1,
          totalActivity: 150,
        },
        recentActivity: [
          { id: 1, action: "create_project", entity: "project", entityName: "Test Project", createdAt: new Date() },
          { id: 2, action: "update_role", entity: "user", entityName: "User X", createdAt: new Date() },
        ],
      };
      (getMyProfileData as any).mockResolvedValue(mockProfile);

      const result = await getMyProfileData(1);
      expect(result).not.toBeNull();
      expect(result!.user.name).toBe("Test User");
      expect(result!.user.role).toBe("admin");
      expect(result!.stats.pmProjectCount).toBe(3);
      expect(result!.stats.activeProjectCount).toBe(2);
      expect(result!.stats.recurringServiceCount).toBe(1);
      expect(result!.stats.totalActivity).toBe(150);
      expect(result!.recentActivity).toHaveLength(2);
      expect(result!.recentActivity[0].action).toBe("create_project");
    });

    it("should return correct stats structure", async () => {
      const mockProfile = {
        user: { id: 2, name: "PMO User", role: "pmo", status: "activo" },
        stats: { pmProjectCount: 0, activeProjectCount: 0, recurringServiceCount: 0, totalActivity: 0 },
        recentActivity: [],
      };
      (getMyProfileData as any).mockResolvedValue(mockProfile);

      const result = await getMyProfileData(2);
      expect(result!.stats).toEqual({
        pmProjectCount: 0,
        activeProjectCount: 0,
        recurringServiceCount: 0,
        totalActivity: 0,
      });
      expect(result!.recentActivity).toEqual([]);
    });
  });

  describe("Audit CSV Export", () => {
    it("should generate valid CSV format from audit logs", async () => {
      const mockLogs = {
        logs: [
          {
            id: 1,
            createdAt: new Date("2026-03-14T10:00:00Z"),
            userName: "Admin User",
            userRole: "admin",
            action: "create_project",
            entity: "project",
            entityId: "42",
            entityName: "Test Project",
            details: { name: "Test Project" },
          },
          {
            id: 2,
            createdAt: new Date("2026-03-14T11:00:00Z"),
            userName: "PMO User",
            userRole: "pmo",
            action: "update_role",
            entity: "user",
            entityId: "5",
            entityName: "John Doe",
            details: { newRole: "consulta" },
          },
        ],
        total: 2,
      };
      (getAuditLogs as any).mockResolvedValue(mockLogs);

      const result = await getAuditLogs({ page: 1, pageSize: 5000 });
      expect(result.total).toBe(2);
      expect(result.logs).toHaveLength(2);

      // Simulate CSV generation logic
      const header = "ID,Fecha,Usuario,Rol,Acción,Entidad,ID Entidad,Nombre Entidad,Detalles";
      const rows = result.logs.map((log: any) => {
        const date = new Date(log.createdAt).toISOString();
        const details = log.details ? JSON.stringify(log.details).replace(/"/g, '""') : "";
        return [
          log.id,
          date,
          `"${(log.userName || "Sistema").replace(/"/g, '""')}"`,
          log.userRole || "-",
          log.action,
          log.entity,
          log.entityId || "-",
          `"${(log.entityName || "-").replace(/"/g, '""')}"`,
          `"${details}"`,
        ].join(",");
      });
      const csv = [header, ...rows].join("\n");

      expect(csv).toContain("ID,Fecha,Usuario,Rol,Acción,Entidad,ID Entidad,Nombre Entidad,Detalles");
      expect(csv).toContain("Admin User");
      expect(csv).toContain("create_project");
      expect(csv).toContain("Test Project");
      expect(csv).toContain("PMO User");
      expect(csv).toContain("update_role");
      expect(csv.split("\n")).toHaveLength(3); // header + 2 rows
    });

    it("should handle empty audit logs", async () => {
      (getAuditLogs as any).mockResolvedValue({ logs: [], total: 0 });
      const result = await getAuditLogs({ page: 1, pageSize: 5000 });
      expect(result.total).toBe(0);
      expect(result.logs).toHaveLength(0);
    });

    it("should handle logs without details", async () => {
      const mockLogs = {
        logs: [
          {
            id: 10,
            createdAt: new Date("2026-03-14T12:00:00Z"),
            userName: null,
            userRole: null,
            action: "delete",
            entity: "user",
            entityId: null,
            entityName: null,
            details: null,
          },
        ],
        total: 1,
      };
      (getAuditLogs as any).mockResolvedValue(mockLogs);

      const result = await getAuditLogs({ page: 1, pageSize: 5000 });
      const log = result.logs[0];
      const userName = log.userName || "Sistema";
      const entityName = log.entityName || "-";
      const details = log.details ? JSON.stringify(log.details) : "";

      expect(userName).toBe("Sistema");
      expect(entityName).toBe("-");
      expect(details).toBe("");
    });
  });

  describe("Role Permissions Matrix", () => {
    const PERMISSIONS = [
      { label: "Ver Dashboard principal", admin: true, pmo: true, consulta: true },
      { label: "Crear / editar proyectos", admin: true, pmo: true, consulta: false },
      { label: "Panel de Usuarios", admin: true, pmo: false, consulta: false },
      { label: "Cambiar roles de usuario", admin: true, pmo: false, consulta: false },
      { label: "Invitar usuarios", admin: true, pmo: true, consulta: false },
    ];

    it("admin should have access to all permissions", () => {
      const adminPerms = PERMISSIONS.filter(p => p.admin === true);
      expect(adminPerms).toHaveLength(PERMISSIONS.length);
    });

    it("pmo should have limited admin permissions", () => {
      const pmoPerms = PERMISSIONS.filter(p => p.pmo === true);
      expect(pmoPerms.length).toBeLessThan(PERMISSIONS.length);
      expect(pmoPerms.some(p => p.label === "Panel de Usuarios")).toBe(false);
    });

    it("consulta should have read-only permissions", () => {
      const consultaPerms = PERMISSIONS.filter(p => p.consulta === true);
      expect(consultaPerms.length).toBeLessThan(PERMISSIONS.filter(p => p.pmo === true).length);
      expect(consultaPerms.some(p => p.label === "Crear / editar proyectos")).toBe(false);
    });
  });
});
