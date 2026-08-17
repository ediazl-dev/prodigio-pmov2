import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeCtx(role: "admin" | "pmo" | "consulta" = "admin"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-open-id",
      email: "test@prodigio.tech",
      name: "Test User",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
      cookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

function makeUnauthCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
      cookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

// ─── Auth Tests ─────────────────────────────────────────────────────────────

describe("auth.me", () => {
  it("returns user when authenticated", async () => {
    const ctx = makeCtx("admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.email).toBe("test@prodigio.tech");
  });

  it("returns null when unauthenticated", async () => {
    const ctx = makeUnauthCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});

describe("auth.logout", () => {
  it("clears session cookie and returns success", async () => {
    const clearedCookies: string[] = [];
    const ctx: TrpcContext = {
      ...makeCtx(),
      res: {
        clearCookie: (name: string) => { clearedCookies.push(name); },
        cookie: () => {},
      } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
    expect(clearedCookies.length).toBeGreaterThan(0);
  });
});

// ─── Projects Tests ─────────────────────────────────────────────────────────

describe("projects.list", () => {
  it("resolves for authenticated admin user", async () => {
    const ctx = makeCtx("admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.projects.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("throws UNAUTHORIZED for unauthenticated user", async () => {
    const ctx = makeUnauthCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.projects.list()).rejects.toThrow();
  });
});

describe("projects.stats", () => {
  it("returns stats object with expected keys", async () => {
    const ctx = makeCtx("admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.projects.stats();
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("active");
    expect(result).toHaveProperty("completed");
    expect(result).toHaveProperty("users");
    expect(typeof result.total).toBe("number");
  });
});

// ─── Users Tests ─────────────────────────────────────────────────────────────

describe("users.list", () => {
  it("resolves for admin user", async () => {
    const ctx = makeCtx("admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.users.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("throws FORBIDDEN for consulta role", async () => {
    const ctx = makeCtx("consulta");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.users.list()).rejects.toThrow();
  });
});

// ─── SoW Tests ───────────────────────────────────────────────────────────────

describe("sow.get", () => {
  it("returns null or object for valid projectId", async () => {
    const ctx = makeCtx("admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.sow.get({ projectId: 99999 });
    // Non-existent project returns null or undefined
    expect(result === null || result === undefined || typeof result === "object").toBe(true);
  });
});

// ─── Risks Tests ─────────────────────────────────────────────────────────────

describe("risks.get", () => {
  it("returns array for valid projectId", async () => {
    const ctx = makeCtx("admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.risks.get({ projectId: 99999 });
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── WBS Tests ───────────────────────────────────────────────────────────────

describe("wbs.get", () => {
  it("returns array for valid projectId", async () => {
    const ctx = makeCtx("admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.wbs.get({ projectId: 99999 });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("wbs.getBilling", () => {
  it("returns array for valid projectId", async () => {
    const ctx = makeCtx("admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.wbs.getBilling({ projectId: 99999 });
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── WBS pushBacklogToJira Tests ───────────────────────────────────────────

describe("wbs.pushBacklogToJira - selectedIds parameter", () => {
  it("throws error when project has no JIRA space", async () => {
    const ctx = makeCtx("admin");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.wbs.pushBacklogToJira({ projectId: 99999, selectedIds: [1, 2, 3] }),
    ).rejects.toThrow();
  });

  it("throws error without selectedIds when project has no JIRA space", async () => {
    const ctx = makeCtx("admin");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.wbs.pushBacklogToJira({ projectId: 99999 }),
    ).rejects.toThrow();
  });

  it("accepts empty selectedIds array without crashing on input validation", async () => {
    const ctx = makeCtx("admin");
    const caller = appRouter.createCaller(ctx);
    // Should throw about missing JIRA space, not about input validation
    await expect(
      caller.wbs.pushBacklogToJira({ projectId: 99999, selectedIds: [] }),
    ).rejects.toThrow("El proyecto no tiene un Space JIRA asociado");
  });
});

// ─── Role-based Access Control Tests ────────────────────────────────────────

describe("role-based access: admin-only endpoints", () => {
  it("admin can access users.list", async () => {
    const ctx = makeCtx("admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.users.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("pmo can access users.list (adminOrPmo)", async () => {
    const ctx = makeCtx("pmo");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.users.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("consulta cannot access users.list", async () => {
    const ctx = makeCtx("consulta");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.users.list()).rejects.toThrow();
  });
});

describe("role-based access: project operations", () => {
  it("pmo can list projects", async () => {
    const ctx = makeCtx("pmo");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.projects.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("consulta can list projects (read-only)", async () => {
    const ctx = makeCtx("consulta");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.projects.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("pmo can get project stats", async () => {
    const ctx = makeCtx("pmo");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.projects.stats();
    expect(result).toHaveProperty("total");
  });

  it("consulta can get project stats", async () => {
    const ctx = makeCtx("consulta");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.projects.stats();
    expect(result).toHaveProperty("total");
  });
});

describe("users.delete", () => {
  it("admin can call delete (even if user doesn't exist)", async () => {
    const ctx = makeCtx("admin");
    const caller = appRouter.createCaller(ctx);
    // Deleting non-existent user should return success: true
    const result = await caller.users.delete({ userId: 99999 });
    expect(result).toHaveProperty("success");
  });

  it("pmo cannot delete users", async () => {
    const ctx = makeCtx("pmo");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.users.delete({ userId: 99999 })).rejects.toThrow();
  });

  it("consulta cannot delete users", async () => {
    const ctx = makeCtx("consulta");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.users.delete({ userId: 99999 })).rejects.toThrow();
  });

  it("cannot delete yourself", async () => {
    const ctx = makeCtx("admin");
    const caller = appRouter.createCaller(ctx);
    // User id in makeCtx is 1
    await expect(caller.users.delete({ userId: 1 })).rejects.toThrow();
  });
});

describe("deadlines admin-only access", () => {
  it("admin can list deadlines", async () => {
    const ctx = makeCtx("admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.deadlines.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("pmo cannot update deadlines", async () => {
    const ctx = makeCtx("pmo");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.deadlines.upsert({ stageId: "sow", maxBusinessDays: 10 })
    ).rejects.toThrow();
  });

  it("consulta cannot update deadlines", async () => {
    const ctx = makeCtx("consulta");
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.deadlines.upsert({ stageId: "sow", maxBusinessDays: 10 })
    ).rejects.toThrow();
  });
});
