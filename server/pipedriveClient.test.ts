import { describe, it, expect } from "vitest";
import { pipedriveHealthCheck, getDeal, getDealNotes, getDealFlow, syncDealComplete } from "./pipedriveClient";

describe("pipedriveClient", () => {
  // ─── API Token Validation ───────────────────────────────────────────────
  it("should validate Pipedrive API token works", async () => {
    const ok = await pipedriveHealthCheck();
    expect(ok).toBe(true);
  }, 15000);

  // ─── Get Deal ───────────────────────────────────────────────────────────
  it("should fetch a real deal by ID (1996)", async () => {
    const deal = await getDeal(1996);
    expect(deal).toBeDefined();
    expect(deal.id).toBe(1996);
    expect(deal.title).toBeDefined();
    expect(deal.value).toBeGreaterThanOrEqual(0);
    expect(deal.currency).toBeDefined();
    expect(deal.status).toBeDefined();
    expect(deal.add_time).toBeDefined();
  }, 15000);

  // ─── Get Deal Notes ─────────────────────────────────────────────────────
  it("should fetch notes for deal 1996", async () => {
    const notes = await getDealNotes(1996);
    expect(Array.isArray(notes)).toBe(true);
    // Deal 1996 has 2 notes
    expect(notes.length).toBeGreaterThanOrEqual(1);
    expect(notes[0].content).toBeDefined();
    expect(notes[0].add_time).toBeDefined();
  }, 15000);

  // ─── Get Deal Flow ──────────────────────────────────────────────────────
  it("should fetch deal flow for deal 1996", async () => {
    const flow = await getDealFlow(1996, "activity,note,mailMessage");
    expect(Array.isArray(flow)).toBe(true);
    expect(flow.length).toBeGreaterThan(0);
    expect(flow[0].object).toBeDefined();
    expect(flow[0].timestamp).toBeDefined();
  }, 15000);

  // ─── Composite Sync ─────────────────────────────────────────────────────
  it("should perform a full deal sync for deal 1996", async () => {
    const result = await syncDealComplete(1996);
    expect(result).toBeDefined();
    expect(result.deal.id).toBe(1996);
    expect(result.contactName).toBeTruthy();
    expect(result.contactEmail).toBeTruthy();
    expect(result.orgName).toBeTruthy();
    expect(result.dealValue).toBeGreaterThan(0);
    expect(result.dealCurrency).toBe("USD");
    expect(result.opportunityStartDate).toBeTruthy();
    expect(result.activitiesCount).toBeGreaterThan(0);
    expect(result.notes.length).toBeGreaterThanOrEqual(1);
    expect(result.flowSummary.totalActivities).toBeGreaterThanOrEqual(0);
    expect(result.flowSummary.totalEmails).toBeGreaterThanOrEqual(0);
  }, 30000);

  // ─── Error handling ─────────────────────────────────────────────────────
  it("should throw error for non-existent deal", async () => {
    await expect(getDeal(999999999)).rejects.toThrow();
  }, 15000);
});
