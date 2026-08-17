import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@prodigio.tech",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

function createPmContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "pm-user",
    email: "pm@prodigio.tech",
    name: "PM User",
    loginMethod: "manus",
    role: "pmo",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe("deadlines", () => {
  it("lists all stage deadlines", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const deadlines = await caller.deadlines.list();
    
    expect(Array.isArray(deadlines)).toBe(true);
    expect(deadlines.length).toBe(6);
    
    // Verify all 6 stages are present
    const stageIds = deadlines.map((d) => d.stageId);
    expect(stageIds).toContain("sow");
    expect(stageIds).toContain("jira");
    expect(stageIds).toContain("risks");
    expect(stageIds).toContain("planning");
    expect(stageIds).toContain("design");
    expect(stageIds).toContain("closure");
    
    // Each deadline should have maxBusinessDays > 0
    for (const d of deadlines) {
      expect(d.maxBusinessDays).toBeGreaterThan(0);
      expect(d.label).toBeTruthy();
    }
  });

  it("admin can update a stage deadline", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    
    const result = await caller.deadlines.update({
      stageId: "sow",
      maxBusinessDays: 15,
      label: "Statement of Work Updated",
      description: "Test description",
    });
    
    expect(result).toEqual({ success: true });
    
    // Verify the update
    const deadlines = await caller.deadlines.list();
    const sow = deadlines.find((d) => d.stageId === "sow");
    expect(sow?.maxBusinessDays).toBe(15);
    expect(sow?.label).toBe("Statement of Work Updated");
    
    // Restore original
    await caller.deadlines.update({
      stageId: "sow",
      maxBusinessDays: 10,
      label: "Statement of Work",
    });
  });

  it("admin can bulk update deadlines", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    
    const result = await caller.deadlines.bulkUpdate({
      deadlines: [
        { stageId: "jira", maxBusinessDays: 7, label: "Jira Config" },
        { stageId: "risks", maxBusinessDays: 8, label: "Risk Matrix" },
      ],
    });
    
    expect(result).toEqual({ success: true });
    
    const deadlines = await caller.deadlines.list();
    const jira = deadlines.find((d) => d.stageId === "jira");
    const risks = deadlines.find((d) => d.stageId === "risks");
    expect(jira?.maxBusinessDays).toBe(7);
    expect(risks?.maxBusinessDays).toBe(8);
    
    // Restore originals
    await caller.deadlines.bulkUpdate({
      deadlines: [
        { stageId: "jira", maxBusinessDays: 5, label: "Configuración Jira" },
        { stageId: "risks", maxBusinessDays: 5, label: "Matriz de Riesgos" },
      ],
    });
  });

  it("non-admin cannot update deadlines", async () => {
    const caller = appRouter.createCaller(createPmContext());
    
    await expect(
      caller.deadlines.update({
        stageId: "sow",
        maxBusinessDays: 99,
        label: "Hacked",
      })
    ).rejects.toThrow();
  });
});

describe("holidays", () => {
  it("lists all holidays", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const holidays = await caller.holidays.list();
    
    expect(Array.isArray(holidays)).toBe(true);
    expect(holidays.length).toBeGreaterThan(0);
    
    // Each holiday should have date, name, year
    for (const h of holidays) {
      expect(h.name).toBeTruthy();
      expect(h.year).toBeGreaterThanOrEqual(2025);
      expect(h.year).toBeLessThanOrEqual(2028);
    }
  });

  it("filters holidays by year", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const holidays2026 = await caller.holidays.byYear({ year: 2026 });
    
    expect(Array.isArray(holidays2026)).toBe(true);
    expect(holidays2026.length).toBeGreaterThan(0);
    
    // All should be 2026
    for (const h of holidays2026) {
      expect(h.year).toBe(2026);
    }
  });
});

describe("stageOpenings", () => {
  it("records a stage opening and returns it", async () => {
    const caller = appRouter.createCaller(createPmContext());
    
    // Record opening for project 1, sow stage
    const opening = await caller.stageOpenings.recordOpening({
      projectId: 1,
      stageId: "sow",
    });
    
    // Should return the opening record
    expect(opening).toBeTruthy();
    expect(opening?.projectId).toBe(1);
    expect(opening?.stageId).toBe("sow");
    expect(opening?.openedAt).toBeTruthy();
  });

  it("does not create duplicate openings", async () => {
    const caller = appRouter.createCaller(createPmContext());
    
    // Record again - should return existing
    const opening1 = await caller.stageOpenings.recordOpening({
      projectId: 1,
      stageId: "sow",
    });
    
    const opening2 = await caller.stageOpenings.recordOpening({
      projectId: 1,
      stageId: "sow",
    });
    
    // Both should have the same openedAt
    expect(opening1?.id).toBe(opening2?.id);
  });

  it("gets openings by project", async () => {
    const caller = appRouter.createCaller(createPmContext());
    
    const openings = await caller.stageOpenings.byProject({ projectId: 1 });
    expect(Array.isArray(openings)).toBe(true);
    expect(openings.length).toBeGreaterThan(0);
  });

  it("calculates time remaining for project stages", async () => {
    const caller = appRouter.createCaller(createPmContext());
    
    // Ensure stage opening exists
    await caller.stageOpenings.recordOpening({ projectId: 1, stageId: "sow" });
    
    const timeData = await caller.stageOpenings.timeRemaining({ projectId: 1 });
    
    expect(Array.isArray(timeData)).toBe(true);
    expect(timeData.length).toBe(6); // All 6 stages
    
    // Find the sow stage (which was opened)
    const sow = timeData.find((t) => t.stageId === "sow");
    expect(sow).toBeTruthy();
    expect(sow?.openedAt).toBeTruthy();
    expect(sow?.totalBusinessDays).toBeGreaterThan(0);
    
    // If stage is completed, deadlineDate is null and status is completed
    // If stage is in progress, deadlineDate should be set
    if (sow?.stageStatus === "completed") {
      expect(sow?.status).toBe("completed");
    } else {
      expect(sow?.deadlineDate).toBeTruthy();
      expect(sow?.remainingBusinessDays).toBeDefined();
      expect(Number(sow?.remainingBusinessDays)).not.toBeNaN();
      expect(["on_track", "caution", "warning", "overdue", "paused"]).toContain(sow?.status);
    }
    
    // Locked stages should have not_started status
    const locked = timeData.filter((t) => t.stageStatus === "locked");
    for (const l of locked) {
      expect(l.status).toBe("not_started");
      expect(l.deadlineDate).toBeNull();
    }
  });
});

describe("extensions", () => {
  it("admin can pause and resume a stage", async () => {
    const caller = appRouter.createCaller(createAdminContext());

    // First ensure the stage opening exists
    await caller.stageOpenings.recordOpening({ projectId: 1, stageId: "sow" });

    // Clean up any active pause left by a prior test run. The latest history record
    // may be an extension, so it is not a reliable proxy for the current state.
    try {
      await caller.extensions.resume({ projectId: 1, stageId: "sow", reason: "Cleanup before test" });
    } catch {
      // The stage was already active; the test can continue.
    }
    // Small delay to ensure DB state is consistent
    await new Promise(r => setTimeout(r, 100));

    // Now pause
    const pauseResult = await caller.extensions.pause({
      projectId: 1,
      stageId: "sow",
      reason: "Vacaciones del equipo",
    });
    expect(pauseResult).toBeTruthy();
    expect(pauseResult.success).toBe(true);

    // Now resume
    const resumeResult = await caller.extensions.resume({
      projectId: 1,
      stageId: "sow",
      reason: "Equipo de vuelta",
    });
    expect(resumeResult).toBeTruthy();
    expect(resumeResult.success).toBe(true);
  });

  it("admin can extend a stage deadline", async () => {
    const caller = appRouter.createCaller(createAdminContext());

    const result = await caller.extensions.extend({
      projectId: 1,
      stageId: "sow",
      extraDays: 5,
      reason: "Cambio de alcance",
    });

    expect(result).toBeTruthy();
    expect(result.success).toBe(true);
  });

  it("returns history of extensions for a stage", async () => {
    const caller = appRouter.createCaller(createAdminContext());

    const history = await caller.extensions.history({
      projectId: 1,
      stageId: "sow",
    });

    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThanOrEqual(3); // pause, resume, extend from above
  });

  it("time remaining reflects extensions", async () => {
    const caller = appRouter.createCaller(createAdminContext());

    // Ensure stage opening exists
    await caller.stageOpenings.recordOpening({ projectId: 1, stageId: "sow" });

    // Add extension if not already present
    const historyBefore = await caller.extensions.history({ projectId: 1, stageId: "sow" });
    const hasExtension = historyBefore.some((h) => h.type === "extend");
    if (!hasExtension) {
      await caller.extensions.extend({ projectId: 1, stageId: "sow", extraDays: 5, reason: "Test extension" });
    }

    const timeData = await caller.stageOpenings.timeRemaining({ projectId: 1 });
    const sow = timeData.find((t) => t.stageId === "sow");

    expect(sow).toBeTruthy();
    expect(sow?.extraDays).toBeGreaterThanOrEqual(5);
  });
});

describe("compliance", () => {
  it("returns compliance metrics", async () => {
    const caller = appRouter.createCaller(createAdminContext());

    const metrics = await caller.compliance.metrics();

    expect(metrics).toBeTruthy();
    expect(typeof metrics.onTime).toBe("number");
    expect(typeof metrics.late).toBe("number");
    expect(typeof metrics.inProgress).toBe("number");
    expect(Array.isArray(metrics.details)).toBe(true);
  });

  it("details contain expected fields", async () => {
    const caller = appRouter.createCaller(createAdminContext());

    const metrics = await caller.compliance.metrics();

    for (const d of metrics.details) {
      expect(d.projectId).toBeDefined();
      expect(d.stageId).toBeDefined();
      expect(d.projectName).toBeDefined();
      expect(typeof d.daysUsed).toBe("number");
      expect(typeof d.totalAllowed).toBe("number");
      expect(["on_time", "late", "in_progress", "not_started"]).toContain(d.status);
    }
  });
});

describe("deadlineNotifications", () => {
  it("checkAndNotify runs without error", async () => {
    const caller = appRouter.createCaller(createAdminContext());

    const result = await caller.deadlineNotifications.checkAndNotify();

    expect(result).toBeTruthy();
    expect(result.success).toBe(true);
    expect(typeof result.notificationsSent).toBe("number");
  });
});

describe("stageApprovals - SoW close flow", () => {
  it("getApproval returns null when no approval exists", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    // Use a non-existent project to avoid conflicts
    const approval = await caller.sow.getApproval({ projectId: 9999, stageId: "sow" });
    expect(approval).toBeNull();
  });

  it("uploadApproval creates an approval record for risks stage", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    // Create a small base64 string to simulate a file
    const fakeBase64 = Buffer.from("fake pdf content for testing").toString("base64");
    
    const result = await caller.sow.uploadApproval({
      projectId: 1,
      stageId: "risks",
      fileName: "sow_aprobado_test.pdf",
      fileBase64: fakeBase64,
      mimeType: "application/pdf",
      notes: "Aprobado por el cliente en reunión del 03/03/2026",
    });

    expect(result).toBeTruthy();
    expect(result.id).toBeTruthy();
    expect(result.fileName).toBe("sow_aprobado_test.pdf");
    expect(result.url).toBeTruthy();
  });

  it("getApproval returns the uploaded approval for risks stage", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const approval = await caller.sow.getApproval({ projectId: 1, stageId: "risks" });

    expect(approval).toBeTruthy();
    expect(approval?.fileName).toBe("sow_aprobado_test.pdf");
    expect(approval?.fileUrl).toBeTruthy();
    expect(approval?.notes).toBe("Aprobado por el cliente en reunión del 03/03/2026");
  });

  it("closeStage (deprecated) fails without SoW generated for a non-existent project", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    // Project 9999 has no SoW generated
    await expect(
      caller.sow.closeStage({ projectId: 9999 })
    ).rejects.toThrow();
  });

  it("consulta user cannot upload approval", async () => {
    const consultaUser: AuthenticatedUser = {
      id: 3,
      openId: "consulta-user",
      email: "consulta@prodigio.tech",
      name: "Consulta User",
      loginMethod: "manus",
      role: "consulta",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    const ctx: TrpcContext = {
      user: consultaUser,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const fakeBase64 = Buffer.from("fake").toString("base64");

    await expect(
      caller.sow.uploadApproval({
        projectId: 1,
        fileName: "hack.pdf",
        fileBase64: fakeBase64,
        mimeType: "application/pdf",
      })
    ).rejects.toThrow();
  });

  it("deleteApproval removes the approval record", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const approval = await caller.sow.getApproval({ projectId: 1, stageId: "risks" });
    expect(approval).toBeTruthy();

    const result = await caller.sow.deleteApproval({ approvalId: approval!.id });
    expect(result).toEqual({ success: true });

    // Verify it's gone
    const afterDelete = await caller.sow.getApproval({ projectId: 1, stageId: "risks" });
    expect(afterDelete).toBeNull();
  });
});
