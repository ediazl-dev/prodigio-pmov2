/**
 * Pipedrive CRM API Client
 * Provides typed access to deals, persons, notes, activities and deal flow.
 * Uses Pipedrive REST API v1 with api_token authentication.
 */
import { ENV } from "./_core/env";

const BASE_URL = "https://api.pipedrive.com/v1";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PipedrivePerson {
  name: string;
  email: { label: string; value: string; primary: boolean }[];
  phone: { label?: string; value: string; primary: boolean }[];
  active_flag: boolean;
  value: number;
}

export interface PipedriveOrg {
  name: string;
  address: string;
  people_count: number;
  active_flag: boolean;
  value: number;
}

export interface PipedriveDeal {
  id: number;
  title: string;
  value: number;
  currency: string;
  status: string; // open | won | lost | deleted
  add_time: string;
  update_time: string;
  won_time: string | null;
  close_time: string | null;
  expected_close_date: string | null;
  stage_id: number;
  pipeline_id: number;
  person_id: PipedrivePerson | null;
  org_id: PipedriveOrg | null;
  user_id: { id: number; name: string; email: string } | null;
  activities_count: number;
  done_activities_count: number;
  undone_activities_count: number;
  notes_count: number;
  email_messages_count: number;
  lost_reason: string | null;
  stage_change_time: string | null;
  label: string | null;
  probability: number | null;
}

export interface PipedriveNote {
  id: number;
  content: string;
  add_time: string;
  update_time: string;
  user_id: number;
  deal_id: number;
  pinned_to_deal_flag: boolean;
}

export interface PipedriveFlowItem {
  object: string; // activity | note | mailMessage | change | deal | file
  action: string | null;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface PipedriveActivity {
  id: number;
  subject: string;
  type: string;
  done: boolean;
  due_date: string;
  due_time: string;
  add_time: string;
  marked_as_done_time: string | null;
  note: string;
  deal_id: number;
}

// ─── API Helpers ─────────────────────────────────────────────────────────────

function getToken(): string {
  const token = ENV.pipedriveApiToken;
  if (!token) throw new Error("PIPEDRIVE_API_TOKEN no está configurado");
  return token;
}

async function pipedriveGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("api_token", getToken());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pipedrive API error ${res.status}: ${text}`);
  }

  const json = (await res.json()) as { success: boolean; data: T; error?: string };
  if (!json.success) {
    throw new Error(`Pipedrive API failed: ${json.error || "unknown error"}`);
  }
  return json.data;
}

async function pipedriveGetPaginated<T>(
  path: string,
  params: Record<string, string> = {},
  maxItems = 500,
): Promise<T[]> {
  const all: T[] = [];
  let start = 0;
  const limit = 100;

  while (all.length < maxItems) {
    const url = new URL(`${BASE_URL}${path}`);
    url.searchParams.set("api_token", getToken());
    url.searchParams.set("start", String(start));
    url.searchParams.set("limit", String(limit));
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Pipedrive API error ${res.status}: ${text}`);
    }

    const json = (await res.json()) as {
      success: boolean;
      data: T[] | null;
      additional_data?: { pagination?: { more_items_in_collection?: boolean; next_start?: number } };
    };

    if (!json.success || !json.data) break;
    all.push(...json.data);

    const more = json.additional_data?.pagination?.more_items_in_collection;
    if (!more) break;
    start = json.additional_data?.pagination?.next_start ?? start + limit;
  }

  return all;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Get a single deal by ID with all standard fields */
export async function getDeal(dealId: number): Promise<PipedriveDeal> {
  return pipedriveGet<PipedriveDeal>(`/deals/${dealId}`);
}

/** Get all notes attached to a deal */
export async function getDealNotes(dealId: number): Promise<PipedriveNote[]> {
  return pipedriveGetPaginated<PipedriveNote>("/notes", { deal_id: String(dealId) });
}

/** Get the deal flow (activities, notes, emails, changes) */
export async function getDealFlow(
  dealId: number,
  items?: string,
): Promise<PipedriveFlowItem[]> {
  const params: Record<string, string> = {};
  if (items) params.items = items;
  return pipedriveGetPaginated<PipedriveFlowItem>(`/deals/${dealId}/flow`, params);
}

/** Get all activities for a deal */
export async function getDealActivities(dealId: number): Promise<PipedriveActivity[]> {
  // The flow endpoint with items=activity returns activity data
  const flow = await getDealFlow(dealId, "activity,call");
  return flow.map((item) => item.data as unknown as PipedriveActivity);
}

/** Health check: verify the API token works */
export async function pipedriveHealthCheck(): Promise<boolean> {
  const url = new URL(`${BASE_URL}/deals`);
  url.searchParams.set("api_token", getToken());
  url.searchParams.set("limit", "1");

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json", "User-Agent": "Prodigio-PMO/1.0" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) return false;
      const json = (await res.json()) as { success: boolean };
      if (json.success === true) return true;
    } catch {
      if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 400));
    }
  }
  return false;
}

// ─── Composite: Full Deal Sync ───────────────────────────────────────────────

export interface PipedriveDealSyncResult {
  deal: PipedriveDeal;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  orgName: string;
  orgAddress: string;
  dealValue: number;
  dealCurrency: string;
  dealStatus: string;
  opportunityStartDate: string; // add_time
  opportunityCloseDate: string | null; // won_time or close_time
  activitiesCount: number;
  doneActivitiesCount: number;
  emailsCount: number;
  notesCount: number;
  notes: { content: string; date: string }[];
  flowSummary: {
    totalActivities: number;
    totalEmails: number;
    totalNotes: number;
    totalChanges: number;
    activityTypes: Record<string, number>;
    emailSubjects: string[];
  };
}

/** Fetch all deal data in one composite call */
export async function syncDealComplete(dealId: number): Promise<PipedriveDealSyncResult> {
  // Parallel fetch: deal + notes + flow
  const [deal, notes, flow] = await Promise.all([
    getDeal(dealId),
    getDealNotes(dealId),
    getDealFlow(dealId, "activity,call,note,mailMessage,change"),
  ]);

  // Extract contact info from deal.person_id
  const person = deal.person_id;
  const contactName = person?.name ?? "";
  const contactEmail = person?.email?.find((e) => e.primary)?.value ?? person?.email?.[0]?.value ?? "";
  const contactPhone = person?.phone?.find((p) => p.primary)?.value ?? person?.phone?.[0]?.value ?? "";

  // Extract org info
  const org = deal.org_id;
  const orgName = org?.name ?? "";
  const orgAddress = org?.address ?? "";

  // Analyze flow for summary
  const flowSummary = {
    totalActivities: 0,
    totalEmails: 0,
    totalNotes: 0,
    totalChanges: 0,
    activityTypes: {} as Record<string, number>,
    emailSubjects: [] as string[],
  };

  for (const item of flow) {
    switch (item.object) {
      case "activity":
      case "call":
        flowSummary.totalActivities++;
        {
          const aType = (item.data as Record<string, unknown>).type as string ?? "other";
          flowSummary.activityTypes[aType] = (flowSummary.activityTypes[aType] ?? 0) + 1;
        }
        break;
      case "mailMessage":
        flowSummary.totalEmails++;
        {
          const subject = (item.data as Record<string, unknown>).subject as string;
          if (subject && !flowSummary.emailSubjects.includes(subject)) {
            flowSummary.emailSubjects.push(subject);
          }
        }
        break;
      case "note":
        flowSummary.totalNotes++;
        break;
      case "change":
      case "dealChange":
        flowSummary.totalChanges++;
        break;
    }
  }

  // Clean notes content (strip HTML)
  const cleanNotes = notes.map((n) => ({
    content: n.content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
    date: n.add_time,
  }));

  return {
    deal,
    contactName,
    contactEmail,
    contactPhone,
    orgName,
    orgAddress,
    dealValue: deal.value,
    dealCurrency: deal.currency,
    dealStatus: deal.status,
    opportunityStartDate: deal.add_time,
    opportunityCloseDate: deal.won_time ?? deal.close_time,
    activitiesCount: deal.activities_count,
    doneActivitiesCount: deal.done_activities_count,
    emailsCount: deal.email_messages_count,
    notesCount: deal.notes_count,
    notes: cleanNotes,
    flowSummary,
  };
}
