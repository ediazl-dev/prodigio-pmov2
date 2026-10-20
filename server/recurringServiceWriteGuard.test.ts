import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getRecurringServiceById: vi.fn(),
  getRecurringServiceIdForChild: vi.fn(),
  updateRecurringService: vi.fn(),
  updateBillingMonthStatus: vi.fn(),
  deleteServiceDocument: vi.fn(),
}));

vi.mock("./recurringServicesDb", async () => {
  const actual = await vi.importActual<typeof import("./recurringServicesDb")>("./recurringServicesDb");
  return { ...actual, ...mocks };
});

import { appRouter } from "./routers";

function makeCtx(role: "admin" | "pmo" = "admin"): TrpcContext {
  return {
    user: {
      id: 900001,
      openId: "closed-guard-test",
      email: `${role}@example.test`,
      name: "Closed guard test",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {}, cookie: () => {} } as unknown as TrpcContext["res"],
  };
}

const closedService = (status: "completado" | "cancelado") => ({
  id: 2040001,
  serviceName: "Staffing2040001",
  status,
  serviceType: "staffing",
} as any);

describe("recurring service write guard via real tRPC callers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRecurringServiceById.mockResolvedValue(closedService("completado"));
  });

  it.each(["admin", "pmo"] as const)("blocks updateStatus for %s on completed services before any write", async role => {
    const caller = appRouter.createCaller(makeCtx(role));

    await expect(
      caller.recurringServices.updateStatus({ id: 2040001, status: "activo" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.updateRecurringService).not.toHaveBeenCalled();
  });

  it("blocks cancelled services, including direct URLs that try to change the service", async () => {
    mocks.getRecurringServiceById.mockResolvedValue(closedService("cancelado"));
    const caller = appRouter.createCaller(makeCtx("admin"));

    await expect(
      caller.recurringServices.update({ id: 2040001, data: { serviceName: "no tocar" } }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.updateRecurringService).not.toHaveBeenCalled();
  });

  it("resolves the real child owner before billing writes and cannot bypass closure with a false serviceId", async () => {
    mocks.getRecurringServiceIdForChild.mockResolvedValue(2040001);
    const caller = appRouter.createCaller(makeCtx("admin"));

    await expect(
      caller.recurringServices.updateBillingStatus({ id: 700001, serviceId: 999999, status: "facturado" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.updateBillingMonthStatus).not.toHaveBeenCalled();

    await expect(
      caller.recurringServices.updateBillingStatus({ id: 700001, serviceId: 2040001, status: "facturado" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.updateBillingMonthStatus).not.toHaveBeenCalled();
  });

  it("resolves document ownership before delete and blocks a closed owner", async () => {
    mocks.getRecurringServiceIdForChild.mockResolvedValue(2040001);
    const caller = appRouter.createCaller(makeCtx("pmo"));

    await expect(
      caller.recurringServices.deleteDocument({ serviceId: 2040001, documentId: 700002 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.deleteServiceDocument).not.toHaveBeenCalled();
  });
});
