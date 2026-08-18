import { describe, expect, it } from "vitest";
import { isoWeekFromDate } from "./executiveMinutes";

describe("isoWeekFromDate", () => {
  it("calcula semanas ISO en torno al cambio de año", () => {
    expect(isoWeekFromDate("2026-08-17")).toBe("2026-W34");
    expect(isoWeekFromDate("2021-01-01")).toBe("2020-W53");
  });
});
