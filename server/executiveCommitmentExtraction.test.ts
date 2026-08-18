import { describe, expect, it } from "vitest";
import { extractReviewableCommitments } from "./executiveCommitmentExtraction";

describe("extractReviewableCommitments", () => {
  it("preclasifica sólo líneas explícitas y conserva la revisión humana como requisito", () => {
    const result = extractReviewableCommitments(`
      Discusión general del comité.
      Compromiso: Enviar matriz de riesgos. Responsable: Eduardo. Fecha: 2026-08-22
      Acuerdo: Ariel coordina la validación técnica. Dueño: Ariel. Vence: 23/08/2026
    `);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ title: "Enviar matriz de riesgos.", ownerName: "Eduardo", dueDate: "2026-08-22", confidence: "detected" });
    expect(result[1]).toMatchObject({ title: "Ariel coordina la validación técnica.", ownerName: "Ariel", dueDate: "2026-08-23", confidence: "detected" });
  });

  it("no crea compromisos cuando el texto no los declara", () => {
    expect(extractReviewableCommitments("Se revisó el estado general del proyecto.")).toEqual([]);
  });
});
