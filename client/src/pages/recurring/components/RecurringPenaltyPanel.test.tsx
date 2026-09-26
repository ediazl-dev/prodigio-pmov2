import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecurringPenaltyPanel } from "./RecurringPenaltyPanel";

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      recurringServices: {
        getById: { invalidate: vi.fn() },
        dashboardV2: { invalidate: vi.fn() },
        dashboardKpis: { invalidate: vi.fn() },
      },
    }),
    recurringServices: {
      createPenalty: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      uploadPenaltyEvidence: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      updatePenaltyStatus: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

afterEach(cleanup);

const penalty = {
  id: 1,
  serviceId: 2100001,
  penaltyDate: "2026-09-25",
  description: "Descuento SLA septiembre",
  amount: "12.50",
  currency: "UF",
  status: "aplicada" as const,
  evidenceFileName: "multa-septiembre.pdf",
  evidenceFileUrl: "https://files.example/multa.pdf",
  evidenceMimeType: "application/pdf",
  evidenceFileSize: 2048,
  evidenceUploadedAt: new Date("2026-09-25T12:00:00Z"),
};

describe("RecurringPenaltyPanel", () => {
  it("muestra multas y respaldo a perfiles de lectura sin controles de edición", () => {
    render(<RecurringPenaltyPanel serviceId={2100001} currency="UF" penalties={[penalty]} canEdit={false} />);

    expect(screen.getByText("Multas cursadas")).toBeTruthy();
    expect(screen.getByText("Descuento SLA septiembre")).toBeTruthy();
    expect(screen.getByRole("link", { name: /multa-septiembre\.pdf/i }).getAttribute("href")).toBe("https://files.example/multa.pdf");
    expect(screen.queryByRole("button", { name: "Registrar" })).toBeNull();
  });

  it("permite registrar y adjuntar evidencia a Admin o PMO", () => {
    render(<RecurringPenaltyPanel serviceId={2100001} currency="USD" penalties={[]} canEdit />);

    expect(screen.getByRole("button", { name: "Registrar" })).toBeTruthy();
    expect(screen.getByLabelText("Respaldo").getAttribute("accept")).toBe(".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx");
  });
});
