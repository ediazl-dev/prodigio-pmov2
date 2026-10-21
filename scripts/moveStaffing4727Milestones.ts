import { getJiraRuntimeCredentials } from "../server/jiraClient";
import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const backupArg = args.find(a => a.startsWith("--backup="))?.slice(9);
if (!backupArg) throw new Error("Indique --backup=<respaldo completo verificado>");
const BACKUP = resolve(backupArg);
const ROOT = "/home/ubuntu/backups/prodigio-pmo/2026-10-21-staffing-4727-native-move";
const FIELD = "customfield_12127";
const TARGET = "CONSALOP02";
const TYPE = "12979";
const apply = args.includes("--apply");
const canary = args.includes("--canary");
mkdirSync(ROOT, { recursive: true, mode: 0o700 });
const JOURNAL = join(ROOT, "journal.json");
const hash = (x: string | Buffer) => createHash("sha256").update(x).digest("hex");
function readVerified(name: string): any {
  const bytes = readFileSync(join(BACKUP, name));
  const expected = readFileSync(join(BACKUP, name + ".sha256"), "utf8").split(/\s/)[0];
  if (hash(bytes) !== expected) throw new Error(`Hash inválido: ${name}`);
  return JSON.parse(bytes.toString());
}
function save(name: string, x: unknown) {
  const text = JSON.stringify(x, null, 2);
  const path = join(ROOT, name);
  writeFileSync(path + ".tmp", text, { mode: 0o600 }); renameSync(path + ".tmp", path);
  writeFileSync(path + ".sha256", `${hash(text)}  ${name}\n`, { mode: 0o600 });
}
async function jira(path: string, method = "GET", payload?: unknown): Promise<any> {
  const c = getJiraRuntimeCredentials();
  const r = await fetch(c.baseUrl + "/rest/api/3" + path, { method, headers: { Authorization: c.authorization, Accept: "application/json", ...(payload ? { "Content-Type": "application/json" } : {}) }, ...(payload ? { body: JSON.stringify(payload) } : {}), signal: AbortSignal.timeout(30000) });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path.split("?")[0]} HTTP ${r.status}: ${text.slice(0, 1200)}`);
  return text ? JSON.parse(text) : null;
}
function billingValue(issue: any): string {
  const values: string[] = (issue.fields.customfield_11237 ?? []).map((v: any) => String(v.value ?? v));
  if (values.length !== 1) throw new Error(`Estado financiero no inequívoco: ${issue.key}`);
  const text = values[0].toLowerCase();
  if (/no\s*factur/.test(text)) return "No facturado";
  if (/factur/.test(text)) return "Facturado";
  throw new Error(`Estado financiero desconocido: ${issue.key}`);
}
function targetStatus(issue: any): string {
  const s = issue.fields.status;
  if (s.id === "13539" && s.name === "Cumplido (Entregable)") return "14389";
  if (s.id === "13538" && s.name === "Pendiente") return "14485";
  throw new Error(`Estado operativo sin mapping aprobado: ${issue.key}`);
}
function links(issue: any) {
  return (issue.fields.issuelinks ?? []).map((v: any) => ({ id: v.id, type: v.type?.id, inward: v.inwardIssue?.id ?? null, outward: v.outwardIssue?.id ?? null })).sort((a: any, b: any) => String(a.id).localeCompare(String(b.id)));
}
async function fullComments(id: string) {
  const values: any[] = []; let startAt = 0;
  for (let page = 0; page < 50; page++) {
    const r = await jira(`/issue/${id}/comment?startAt=${startAt}&maxResults=100`);
    values.push(...r.comments);
    if (values.length >= r.total) return values;
    startAt += r.comments.length;
  }
  throw new Error("Comentarios incompletos");
}
function preserved(before: any, after: any) {
  const a = before.fields, b = after.fields;
  for (const field of ["summary", "description", "duedate", "created", "resolutiondate", "labels"]) {
    if (JSON.stringify(a[field] ?? null) !== JSON.stringify(b[field] ?? null)) throw new Error(`${before.key}: no se conservó ${field}`);
  }
  for (const field of ["reporter", "assignee"]) {
    if ((a[field]?.accountId ?? null) !== (b[field]?.accountId ?? null)) throw new Error(`${before.key}: no se conservó ${field}`);
  }
  if (JSON.stringify(links(before)) !== JSON.stringify(links(after))) throw new Error(`${before.key}: relaciones alteradas`);
  const attachments = (i: any) => (i.fields.attachment ?? []).map((v: any) => ({ id: v.id, filename: v.filename, size: v.size })).sort((x: any, y: any) => String(x.id).localeCompare(String(y.id)));
  if (JSON.stringify(attachments(before)) !== JSON.stringify(attachments(after))) throw new Error(`${before.key}: adjuntos alterados`);
  if (after.id !== before.id || after.fields.project.key !== TARGET || after.fields.issuetype.id !== TYPE) throw new Error(`${before.key}: identidad/tipo/destino no verificados`);
  if (after.fields.status.id !== targetStatus(before)) throw new Error(`${before.key}: estado operativo destino incorrecto`);
  if (after.fields[FIELD]?.value !== billingValue(before)) throw new Error(`${before.key}: estado explícito financiero no conservado en campo local`);
}
(async () => {
  const manifest = readVerified("manifest.json");
  if (!manifest.backupComplete || manifest.serviceId !== 2070001 || manifest.mapping.length !== 6 || manifest.targetProject.key !== TARGET) throw new Error("Manifiesto inválido");
  const metadata = await jira(`/issue/createmeta/13114/issuetypes/${TYPE}?maxResults=200`);
  const field = (metadata.fields ?? metadata.values ?? []).find((f: any) => f.fieldId === FIELD);
  if (!field || field.name !== "Estado de Facturación Staffing") throw new Error("Campo destino no verificado");
  const options = new Map<string, string>(field.allowedValues.map((v: any) => [v.value, v.id]));
  const before: any[] = manifest.mapping.map((m: any) => readVerified(m.sourceKey + ".json"));
  const journal: any = existsSync(JOURNAL) ? JSON.parse(readFileSync(JOURNAL, "utf8")) : { version: 1, backupDirectory: BACKUP, sourceIds: before.map(i => i.id), items: {} };
  if (journal.backupDirectory !== BACKUP || JSON.stringify(journal.sourceIds) !== JSON.stringify(before.map(i => i.id))) throw new Error("Journal pertenece a otro respaldo; no sobrescribir");
  const requests: any[] = [];
  for (const original of before) {
    const value = billingValue(original); const option = options.get(value);
    if (!option) throw new Error("Opción de facturación no disponible");
    if (original.fields.parent || original.fields.subtasks?.length) throw new Error("Jerarquía no contemplada; no mover padres/hijos");
    requests.push({ sourceKey: original.key, issueId: original.id, originalStatus: original.fields.status.name, targetStatusId: targetStatus(original), billingValue: value, payload: {
      sendBulkNotification: false,
      targetToSourcesMapping: { [`${TARGET},${TYPE}`]: {
        issueIdsOrKeys: [original.id], inferClassificationDefaults: true, inferFieldDefaults: false, inferStatusDefaults: false, inferSubtaskTypeDefault: true,
        targetMandatoryFields: [{ fields: {
          summary: { retain: true, type: "raw", value: [original.fields.summary] },
          reporter: { retain: true, type: "raw", value: [original.fields.reporter.accountId] },
          ...(original.fields.description ? { description: { retain: true, type: "adf", value: original.fields.description } } : {}),
          [FIELD]: { retain: false, type: "raw", value: [option] },
        } }],
        targetStatus: [{ statuses: { [targetStatus(original)]: [original.fields.status.id] } }],
      } },
    } });
  }
  save("dry-run.json", { backup: BACKUP, field: FIELD, note: "Cumplido (Entregable) pasa a Done por su nombre explícito, aunque el workflow origen lo clasificaba como new; no se inventa fecha de resolución ni factura.", requests });
  console.log(JSON.stringify({ apply, canary, plan: requests.map(r => ({ sourceKey: r.sourceKey, issueId: r.issueId, billingValue: r.billingValue, targetStatusId: r.targetStatusId })) }));
  if (!apply) return;
  const selected = canary ? [before[5]] : before;
  for (const original of selected) {
    let current = await jira(`/issue/${original.id}?fields=*all`);
    let entry = journal.items[original.id];
    if (current.fields.project.key === TARGET) {
      console.log(`Verificando movimiento ya existente: ${original.key} → ${current.key}`);
    } else {
      if (entry?.intent) throw new Error(`${original.key}: envío previo pendiente/incierto. No repetir POST; inspeccionar journal/taskId.`);
      if (current.fields.project.key !== "PSCSC4S" || current.fields.updated !== original.fields.updated) throw new Error(`${original.key}: origen cambió desde respaldo`);
      const request = requests.find(r => r.issueId === original.id);
      entry = journal.items[original.id] = { sourceKey: original.key, intent: new Date().toISOString(), payloadSha256: hash(JSON.stringify(request.payload)) };
      save("journal.json", journal);
      console.log(`Traslado nativo ${original.key}: POST único`);
      const response = await jira("/bulk/issues/move", "POST", request.payload);
      entry.taskId = response.taskId; save("journal.json", journal);
      if (!entry.taskId) throw new Error("Jira no devolvió taskId; no repetir");
    }
    if (entry?.taskId && !entry.verifiedAt) {
      let done = false;
      for (let poll = 0; poll < 60; poll++) {
        const progress = await jira(`/bulk/queue/${entry.taskId}`);
        entry.lastProgress = progress; save("journal.json", journal);
        if (progress.status === "COMPLETE") { if (progress.invalidOrInaccessibleIssueCount || progress.totalIssueCount !== 1) throw new Error("Movimiento parcial"); done = true; break; }
        if (["FAILED", "CANCELLED"].includes(progress.status)) throw new Error("Jira reportó fallo; inspeccionar antes de cualquier reintento");
        if (poll % 5 === 0) console.log(`${original.key}: Jira ${progress.status}, ${progress.progressPercent ?? 0}%`);
        await new Promise(r => setTimeout(r, 1500));
      }
      if (!done) throw new Error("Task todavía pendiente; no reenviar");
    }
    current = await jira(`/issue/${original.id}?fields=*all`);
    // El traslado nativo conserva el issue, pero no copia un campo global
    // incompatible a una definición local opcional. Copiar el valor observado,
    // nunca inferirlo del workflow ni cambiar una opción existente discrepante.
    if (current.fields[FIELD] == null) {
      const edit = await jira(`/issue/${original.id}/editmeta`);
      const editable = edit.fields?.[FIELD];
      const option = editable?.allowedValues?.find((v: any) => v.value === billingValue(original));
      if (current.fields.project.key !== TARGET || current.fields.issuetype.id !== TYPE || !option || !editable.operations?.includes("set")) throw new Error("Campo financiero local no editable/verificado; detener");
      entry = journal.items[original.id] ??= { sourceKey: original.key };
      entry.billingCopyIntent = { at: new Date().toISOString(), sourceField: "customfield_11237", sourceValue: original.fields.customfield_11237, destinationField: FIELD, destinationOptionId: option.id };
      save("journal.json", journal);
      console.log(`Copiando estado explícito respaldado a ${current.key}: ${billingValue(original)}`);
      await jira(`/issue/${original.id}?notifyUsers=false`, "PUT", { fields: { [FIELD]: { id: option.id } } });
      current = await jira(`/issue/${original.id}?fields=*all`);
      entry.billingCopyVerifiedAt = new Date().toISOString(); save("journal.json", journal);
    }
    preserved(original, current);
    const comments = await fullComments(original.id);
    if (JSON.stringify(original.commentsFull.map((v: any) => ({ id: v.id, body: v.body, created: v.created }))) !== JSON.stringify(comments.map((v: any) => ({ id: v.id, body: v.body, created: v.created })))) throw new Error("Comentarios no conservados");
    const change = await jira(`/issue/${original.id}/changelog?maxResults=100`);
    if (change.total < original.changelogFull.length) throw new Error("Changelog perdió entradas");
    if (change.total > change.values.length) throw new Error("Historial requiere paginación adicional; detener antes del siguiente traslado");
    for (const old of original.changelogFull) {
      const found = change.values.find((v: any) => v.id === old.id);
      if (!found || JSON.stringify({ created: found.created, items: found.items }) !== JSON.stringify({ created: old.created, items: old.items })) throw new Error(`Entrada histórica ${old.id} no conservada`);
    }
    for (const att of current.fields.attachment ?? []) {
      const originalAttachment = (original.fields.attachment ?? []).find((a: any) => a.id === att.id);
      const c = getJiraRuntimeCredentials();
      if (new URL(att.content).origin !== new URL(c.baseUrl).origin) throw new Error("Origen de adjunto inesperado");
      const res = await fetch(att.content, { headers: { Authorization: c.authorization }, signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error("No se pudo verificar bytes del adjunto");
      const bytes = Buffer.from(await res.arrayBuffer());
      const filename = `attachment-${originalAttachment.id}-${String(originalAttachment.filename).replace(/[^A-Za-z0-9._-]/g, "_")}`;
      if (hash(bytes) !== readFileSync(join(BACKUP, filename + ".sha256"), "utf8").split(/\s/)[0]) throw new Error("Bytes de adjunto alterados");
    }
    save(`${original.id}-after.json`, { ...current, commentsFull: comments, changelogCount: change.total });
    entry = journal.items[original.id] ??= { sourceKey: original.key };
    Object.assign(entry, { destinationKey: current.key, verifiedAt: new Date().toISOString(), issueId: current.id, billingValue: billingValue(original), amount: "195.00", currency: "UF" });
    save("journal.json", journal);
    console.log(`VERIFICADO ${original.key} → ${current.key}; mismo ID, campo financiero, fecha, descripción, vínculos y evidencia.`);
  }
  console.log(JSON.stringify({ verified: Object.values(journal.items).filter((v: any) => v.verifiedAt).length, canary, journal: JOURNAL }));
})().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
