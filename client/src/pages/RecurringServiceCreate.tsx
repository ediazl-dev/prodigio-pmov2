import AppBreadcrumb from "@/components/AppBreadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, RefreshCw, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  RECURRING_SERVICE_TYPE_OPTIONS,
  type RecurringServiceType,
} from "@shared/recurringServiceTypes";

const C = {
  navy: "#0A1628", navy2: "#112240", navy3: "#1A3358",
  accent: "#e91e8c", g100: "#F4F7FB", g200: "#D8E2EF", g400: "#7A8FA8",
};

export default function RecurringServiceCreate() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const createMutation = trpc.recurringServices.create.useMutation({
    onSuccess: (data) => {
      toast.success("Servicio recurrente creado");
      utils.recurringServices.list.invalidate();
      navigate(`/recurring-services/${data.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const [form, setForm] = useState({
    clientName: "",
    serviceName: "",
    serviceType: "soporte_incidentes" as RecurringServiceType,
    durationMonths: 12,
    billingType: "cuota_fija" as "cuota_fija" | "cuotas_variables",
    fixedMonthlyAmount: 0,
    currency: "" as "" | "UF" | "USD" | "CLP",
    estimatedStartDate: "",
  });

  const handleSubmit = () => {
    if (!form.clientName.trim()) return toast.error("Ingresa el nombre del cliente");
    if (!form.serviceName.trim()) return toast.error("Ingresa el nombre del servicio");
    if (form.durationMonths < 1) return toast.error("La duración debe ser al menos 1 mes");
    const currency = form.currency;
    if (!currency) return toast.error("Selecciona la moneda indicada en el contrato, SoW u orden de compra");
    createMutation.mutate({
      ...form,
      currency,
      fixedMonthlyAmount: form.billingType === "cuota_fija" ? form.fixedMonthlyAmount : undefined,
    });
  };

  return (
    <div style={{ background: C.g100, fontFamily: "'Inter', sans-serif", color: C.navy, minHeight: "100vh" }}>
      <AppBreadcrumb segments={[
        { label: "Servicios Recurrentes", href: "/recurring-services" },
        { label: "Nuevo Servicio" },
      ]} />

      {/* Header */}
      <div style={{
        background: `linear-gradient(160deg, ${C.navy} 0%, ${C.navy2} 55%, ${C.navy3} 100%)`,
        borderBottom: `3px solid ${C.accent}`,
        borderRadius: 16, padding: "28px 36px", margin: "0 0 24px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate("/recurring-services")} style={{ background: "rgba(255,255,255,.08)", border: "none", borderRadius: 8, padding: 8, cursor: "pointer" }}>
            <ArrowLeft size={18} color="#fff" />
          </button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <RefreshCw size={18} color={C.accent} />
              <span style={{ fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: ".1em", textTransform: "uppercase" }}>
                Nuevo Servicio Recurrente
              </span>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-.5px" }}>
              Crear Servicio
            </h1>
          </div>
        </div>
      </div>

      {/* Form */}
      <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${C.g200}`, padding: 32, maxWidth: 700 }}>
        <div style={{ display: "grid", gap: 20 }}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label style={{ fontSize: 12, fontWeight: 600, color: C.navy }}>Cliente *</Label>
              <Input
                placeholder="Nombre del cliente"
                value={form.clientName}
                onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                style={{ marginTop: 4 }}
              />
            </div>
            <div>
              <Label style={{ fontSize: 12, fontWeight: 600, color: C.navy }}>Nombre del Servicio *</Label>
              <Input
                placeholder="Ej: Soporte Nivel 2 - Plataforma Core"
                value={form.serviceName}
                onChange={(e) => setForm({ ...form, serviceName: e.target.value })}
                style={{ marginTop: 4 }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label style={{ fontSize: 12, fontWeight: 600, color: C.navy }}>Tipo de Servicio *</Label>
              <Select value={form.serviceType} onValueChange={(v: any) => setForm({ ...form, serviceType: v })}>
                <SelectTrigger style={{ marginTop: 4 }}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RECURRING_SERVICE_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label style={{ fontSize: 12, fontWeight: 600, color: C.navy }}>Duración (meses) *</Label>
              <Input
                type="number"
                min={1}
                max={120}
                value={form.durationMonths}
                onChange={(e) => setForm({ ...form, durationMonths: parseInt(e.target.value) || 1 })}
                style={{ marginTop: 4 }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label style={{ fontSize: 12, fontWeight: 600, color: C.navy }}>Tipo de Facturación *</Label>
              <Select value={form.billingType} onValueChange={(v: any) => setForm({ ...form, billingType: v })}>
                <SelectTrigger style={{ marginTop: 4 }}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cuota_fija">Cuota Fija Mensual</SelectItem>
                  <SelectItem value="cuotas_variables">Cuotas Variables</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label style={{ fontSize: 12, fontWeight: 600, color: C.navy }}>Moneda contractual *</Label>
              <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v as "UF" | "USD" | "CLP" })}>
                <SelectTrigger aria-label="Moneda contractual" style={{ marginTop: 4 }}><SelectValue placeholder="Selecciona moneda" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UF">UF</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="CLP">CLP</SelectItem>
                </SelectContent>
              </Select>
              <p style={{ marginTop: 4, fontSize: 10, lineHeight: 1.4, color: C.g400 }}>Debe coincidir con el contrato, SoW u orden de compra; no se convierte automáticamente.</p>
            </div>
          </div>

          {form.billingType === "cuota_fija" && (
            <div style={{ maxWidth: 340 }}>
              <Label style={{ fontSize: 12, fontWeight: 600, color: C.navy }}>Monto Mensual Fijo{form.currency ? ` (${form.currency})` : ""}</Label>
              <Input
                type="number"
                min={0}
                value={form.fixedMonthlyAmount}
                onChange={(e) => setForm({ ...form, fixedMonthlyAmount: parseFloat(e.target.value) || 0 })}
                style={{ marginTop: 4 }}
              />
            </div>
          )}

          <div style={{ maxWidth: 340 }}>
            <Label style={{ fontSize: 12, fontWeight: 600, color: C.navy }}>Fecha Estimada de Inicio</Label>
            <Input
              type="date"
              value={form.estimatedStartDate}
              onChange={(e) => setForm({ ...form, estimatedStartDate: e.target.value })}
              style={{ marginTop: 4 }}
            />
          </div>
        </div>

        <div style={{ marginTop: 32, display: "flex", gap: 12 }}>
          <Button variant="outline" onClick={() => navigate("/recurring-services")}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            style={{ background: C.accent, color: "#fff", fontWeight: 700 }}
          >
            {createMutation.isPending ? <Loader2 size={16} className="animate-spin mr-1" /> : <Save size={16} className="mr-1" />}
            Crear Servicio
          </Button>
        </div>
      </div>
    </div>
  );
}
