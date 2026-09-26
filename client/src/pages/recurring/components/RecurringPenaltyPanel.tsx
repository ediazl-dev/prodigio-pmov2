import React, { useState } from "react";
import { AlertTriangle, FileUp, Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PenaltyItem {
  id: number;
  serviceId: number;
  penaltyDate: string;
  description: string;
  amount: string | null;
  currency: string | null;
  status: "identificada" | "aplicada" | "disputada" | "resuelta";
  evidenceFileName: string | null;
  evidenceFileUrl: string | null;
  evidenceMimeType: string | null;
  evidenceFileSize: number | null;
  evidenceUploadedAt: Date | null;
}

const STATUS_LABEL: Record<PenaltyItem["status"], string> = {
  identificada: "Identificada",
  aplicada: "Aplicada",
  disputada: "Disputada",
  resuelta: "Resuelta",
};

async function filePayload(file: File) {
  if (file.size > 15 * 1024 * 1024) throw new Error("El archivo no puede superar 15 MB");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No fue posible leer el archivo"));
    reader.readAsDataURL(file);
  });
  return {
    fileName: file.name,
    fileBase64: dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl,
    mimeType: file.type || "application/octet-stream",
  };
}

function money(amount: string | null, currency: string | null) {
  if (amount == null) return "Monto no informado";
  const value = Number(amount);
  if (!Number.isFinite(value)) return "Monto no informado";
  return `${currency || "USD"} ${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(value)}`;
}

export function RecurringPenaltyPanel({
  serviceId,
  currency,
  penalties,
  canEdit,
}: {
  serviceId: number;
  currency: string;
  penalties: PenaltyItem[];
  canEdit: boolean;
}) {
  const utils = trpc.useUtils();
  const [penaltyDate, setPenaltyDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [replacementByPenalty, setReplacementByPenalty] = useState<Record<number, File | null>>({});

  const refresh = async () => {
    await Promise.all([
      utils.recurringServices.getById.invalidate({ id: serviceId }),
      utils.recurringServices.dashboardV2.invalidate(),
      utils.recurringServices.dashboardKpis.invalidate(),
    ]);
  };

  const createPenalty = trpc.recurringServices.createPenalty.useMutation({
    onSuccess: async () => {
      toast.success("Multa registrada");
      setDescription("");
      setAmount("");
      setFile(null);
      await refresh();
    },
    onError: error => toast.error(error.message),
  });

  const uploadEvidence = trpc.recurringServices.uploadPenaltyEvidence.useMutation({
    onSuccess: async (_result, variables) => {
      toast.success("Respaldo adjuntado");
      setReplacementByPenalty(current => ({ ...current, [variables.id]: null }));
      await refresh();
    },
    onError: error => toast.error(error.message),
  });

  const updateStatus = trpc.recurringServices.updatePenaltyStatus.useMutation({
    onSuccess: refresh,
    onError: error => toast.error(error.message),
  });

  const submit = async () => {
    if (!description.trim()) {
      toast.error("Describe la multa cursada");
      return;
    }
    try {
      const evidence = file ? await filePayload(file) : undefined;
      createPenalty.mutate({
        serviceId,
        penaltyDate,
        description: description.trim(),
        amount: amount ? Number(amount) : undefined,
        currency,
        evidence,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Archivo inválido");
    }
  };

  const attach = async (penaltyId: number) => {
    const selected = replacementByPenalty[penaltyId];
    if (!selected) return;
    try {
      const payload = await filePayload(selected);
      uploadEvidence.mutate({ id: penaltyId, serviceId, ...payload });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Archivo inválido");
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <div className="flex items-center gap-2 text-[15px] font-black text-slate-950">
            <AlertTriangle size={17} className="text-[#B42318]" /> Multas cursadas
          </div>
          <p className="mt-1 text-[11.5px] text-slate-600">
            Registra la multa y adjunta el documento recibido. La evidencia queda vinculada al servicio.
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black text-slate-700">
          {penalties.length} registrada{penalties.length === 1 ? "" : "s"}
        </span>
      </header>

      {canEdit && (
        <div className="grid gap-3 border-b border-slate-200 bg-slate-50/60 p-5 lg:grid-cols-[150px_minmax(0,1fr)_150px_minmax(220px,0.8fr)_auto]">
          <label className="text-[11px] font-bold text-slate-700">
            Fecha
            <Input className="mt-1 bg-white" type="date" value={penaltyDate} onChange={event => setPenaltyDate(event.target.value)} />
          </label>
          <label className="text-[11px] font-bold text-slate-700">
            Descripción
            <Textarea className="mt-1 min-h-10 bg-white" value={description} onChange={event => setDescription(event.target.value)} placeholder="Motivo informado por el cliente" />
          </label>
          <label className="text-[11px] font-bold text-slate-700">
            Monto {currency}
            <Input className="mt-1 bg-white" type="number" min="0" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} placeholder="Opcional" />
          </label>
          <label className="text-[11px] font-bold text-slate-700">
            Respaldo
            <Input className="mt-1 bg-white" type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" onChange={event => setFile(event.target.files?.[0] ?? null)} />
          </label>
          <Button className="self-end bg-[#C91879] text-white hover:bg-[#A91566]" onClick={submit} disabled={createPenalty.isPending}>
            {createPenalty.isPending ? <Loader2 size={15} className="mr-2 animate-spin" /> : <FileUp size={15} className="mr-2" />}
            Registrar
          </Button>
        </div>
      )}

      {penalties.length === 0 ? (
        <p className="px-5 py-7 text-center text-[12px] text-slate-600">No hay multas registradas para este servicio.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {penalties.map(penalty => (
            <article key={penalty.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[130px_minmax(0,1fr)_150px_170px_minmax(230px,0.8fr)] lg:items-center">
              <div>
                <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">Fecha</p>
                <p className="mt-1 font-mono text-[12px] font-bold text-slate-900">{penalty.penaltyDate}</p>
              </div>
              <div>
                <p className="text-[12.5px] font-bold text-slate-950">{penalty.description}</p>
                <p className="mt-1 text-[11px] text-slate-600">{money(penalty.amount, penalty.currency)}</p>
              </div>
              {canEdit ? (
                <Select value={penalty.status} onValueChange={value => updateStatus.mutate({ id: penalty.id, serviceId, status: value as PenaltyItem["status"] })}>
                  <SelectTrigger aria-label={`Estado multa ${penalty.id}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABEL).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-700">{STATUS_LABEL[penalty.status]}</span>
              )}
              <div>
                {penalty.evidenceFileUrl ? (
                  <a className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#175CD3] underline-offset-2 hover:underline" href={penalty.evidenceFileUrl} target="_blank" rel="noreferrer">
                    <Paperclip size={13} /> {penalty.evidenceFileName || "Abrir respaldo"}
                  </a>
                ) : (
                  <span className="text-[11px] font-semibold text-[#B54708]">Sin respaldo adjunto</span>
                )}
              </div>
              {canEdit && (
                <div className="flex items-center gap-2">
                  <Input type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" onChange={event => setReplacementByPenalty(current => ({ ...current, [penalty.id]: event.target.files?.[0] ?? null }))} />
                  <Button variant="outline" size="sm" onClick={() => attach(penalty.id)} disabled={!replacementByPenalty[penalty.id] || uploadEvidence.isPending}>
                    Adjuntar
                  </Button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
