import { describe, expect, it } from "vitest";
import {
  bottleneckTone,
  days,
  moneyList,
  percent,
  signedDays,
  worstBottleneck,
} from "./executiveDashboardFormat";
import {
  buildHomeProjectInput,
  canCreateProjectsFromHome,
  findDuplicateProject,
} from "./homeProjectCreation";

const bottleneck = {
  stageId: "risks",
  label: "Riesgos",
  allowedDays: 5,
  avgEffectiveAllowedDays: 10,
  closedCount: 1,
  avgUsedDays: 9,
  overCount: 0,
  extensionCount: 1,
  extraDays: 5,
};

describe("dashboard Home · creación compatible", () => {
  it("muestra alta sólo a Admin y PMO", () => {
    expect(canCreateProjectsFromHome("admin")).toBe(true);
    expect(canCreateProjectsFromHome("pmo")).toBe(true);
    expect(canCreateProjectsFromHome("pm")).toBe(false);
    expect(canCreateProjectsFromHome("consulta")).toBe(false);
  });

  it("detecta el mismo nombre después de normalizar espacios y Unicode", () => {
    const duplicate = findDuplicateProject(
      [{ id: 2670001, projectName: "[PMO] CCLA SRP MVP1 Deal 4728" }],
      "  [PMO]  CCLA SRP MVP1 Deal 4728  "
    );
    expect(duplicate?.id).toBe(2670001);
  });

  it("omite email y monto vacíos para respetar el contrato opcional", () => {
    expect(
      buildHomeProjectInput({
        projectName: "  Proyecto Nuevo  ",
        clientName: " Cliente ",
        clientEmail: " ",
        projectType: "desarrollo",
        totalAmount: "",
        currency: "uf",
      })
    ).toEqual({
      projectName: "Proyecto Nuevo",
      clientName: "Cliente",
      clientEmail: undefined,
      projectType: "desarrollo",
      totalAmount: undefined,
      currency: "UF",
    });
  });

  it("rechaza formularios sin nombre o cliente", () => {
    expect(
      buildHomeProjectInput({
        projectName: " ",
        clientName: "Cliente",
        clientEmail: "",
        projectType: "otro",
        totalAmount: "",
        currency: "USD",
      })
    ).toBeNull();
  });
});

describe("dashboard Home · formato determinista", () => {
  it("no suma monedas y presenta cada importe por separado", () => {
    expect(
      moneyList([
        { currency: "UF", value: 100 },
        { currency: "USD", value: 200 },
      ])
    ).toContain("UF 100 + USD 200");
  });

  it("representa falta de evidencia como N/D", () => {
    expect(percent(null)).toBe("N/D");
    expect(days(null)).toBe("N/D");
    expect(signedDays(null)).toBe("N/D");
  });

  it("evalúa el cuello de botella contra el plazo efectivo, no sólo la base", () => {
    expect(bottleneckTone(bottleneck)).toBe("good");
    expect(bottleneckTone({ ...bottleneck, avgUsedDays: 11 })).toBe("alert");
    expect(
      worstBottleneck([
        bottleneck,
        { ...bottleneck, stageId: "sow", avgUsedDays: 11 },
      ])?.stageId
    ).toBe("sow");
  });
});
