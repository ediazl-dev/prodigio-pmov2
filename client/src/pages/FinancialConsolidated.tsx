import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, TrendingUp, TrendingDown, Minus, Info } from "lucide-react";

function fmtUF(v: number): string {
  if (v === 0) return "0";
  const abs = Math.abs(v);
  if (abs >= 1000) return (v / 1000).toFixed(1) + "K";
  return v.toFixed(1);
}

function fmtUFFull(v: number): string {
  return new Intl.NumberFormat("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v);
}

export default function FinancialConsolidated() {
  const [fechaCorte] = useState(() => new Date().toISOString().split("T")[0]);

  const { data, isLoading, error } = trpc.portfolioConsole.getFinancialConsolidated.useQuery(
    { fechaCorte },
    { staleTime: 60_000 }
  );

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 p-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !data) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-700">Error al cargar el consolidado financiero: {error?.message ?? "Sin datos"}</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const d = data;
  const fechaFormateada = new Date(fechaCorte + "T12:00:00").toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* ZONA 0: Cabecera */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Consolidado de Facturación</p>
            <h1 className="text-2xl font-bold tracking-tight">
              Cartera al {fechaFormateada}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {d.totalContratos} contratos · {d.contratosActivos} activos · {d.contratosCerrados} cerrados
              {d.inversionInterna > 0 && (
                <span className="ml-2 text-amber-600">
                  · Inversión interna: UF {fmtUF(d.inversionInterna)} (fuera de ratios)
                </span>
              )}
            </p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>Fecha de corte: {fechaCorte}</p>
            <p className="text-xs mt-1">UF del día: [POR CONFIRMAR — Banco Central]</p>
          </div>
        </div>

        {/* ZONA 1: Invariante */}
        {!d.invarianteOk && (
          <Card className="border-red-300 bg-red-50">
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <p className="font-semibold text-red-800">Descuadre detectado</p>
                <p className="text-sm text-red-600">
                  CONTRATADO ({fmtUFFull(d.contratado)}) ≠ COBRADO ({fmtUFFull(d.cobrado)}) + AR ({fmtUFFull(d.ar)}) + WIP ({fmtUFFull(d.wip)}) + BACKLOG ({fmtUFFull(d.backlog)})
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ZONA 2: Lectura del periodo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Contratado</p>
              <p className="text-2xl font-bold mt-1">UF {fmtUF(d.contratado)}</p>
              <p className="text-xs text-muted-foreground mt-1">{d.totalContratos} contratos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Devengado</p>
              <p className="text-2xl font-bold mt-1 text-blue-600">UF {fmtUF(d.devengado)}</p>
              <p className="text-xs text-muted-foreground mt-1">{d.pctDevengado.toFixed(1)}% del contratado</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Facturado</p>
              <p className="text-2xl font-bold mt-1 text-amber-600">UF {fmtUF(d.facturado)}</p>
              <p className="text-xs text-muted-foreground mt-1">{d.pctFacturado.toFixed(1)}% del contratado</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Cobrado</p>
              <p className="text-2xl font-bold mt-1 text-green-600">UF {fmtUF(d.cobrado)}</p>
              <p className="text-xs text-muted-foreground mt-1">{d.pctCobrado.toFixed(1)}% del contratado</p>
            </CardContent>
          </Card>
        </div>

        {/* ZONA 3: Embudo visual */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Embudo de Facturación</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="relative h-12 bg-gray-100 rounded-lg overflow-hidden">
                {d.contratado > 0 && (
                  <>
                    <div
                      className="absolute inset-y-0 left-0 bg-blue-500 transition-all"
                      style={{ width: `${Math.min(d.pctDevengado, 100)}%` }}
                    />
                    <div
                      className="absolute inset-y-0 left-0 bg-amber-500 transition-all"
                      style={{ width: `${Math.min(d.pctFacturado, 100)}%` }}
                    />
                    <div
                      className="absolute inset-y-0 left-0 bg-green-500 transition-all"
                      style={{ width: `${Math.min(d.pctCobrado, 100)}%` }}
                    />
                  </>
                )}
              </div>
              <div className="flex gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span>Devengado: UF {fmtUF(d.devengado)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span>Facturado: UF {fmtUF(d.facturado)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span>Cobrado: UF {fmtUF(d.cobrado)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-300" />
                  <span>Backlog: UF {fmtUF(d.backlog)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ZONA 4: 4 tarjetas de brecha */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className={d.wip > 0 ? "border-amber-200" : ""}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">WIP</p>
                {d.wip > 0 ? <TrendingUp className="h-4 w-4 text-amber-500" /> : <Minus className="h-4 w-4 text-gray-400" />}
              </div>
              <p className="text-xl font-bold mt-1">UF {fmtUF(d.wip)}</p>
              <p className="text-xs text-muted-foreground mt-1">Devengado no facturado</p>
            </CardContent>
          </Card>
          <Card className={d.ar > 0 ? "border-red-200" : ""}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">AR</p>
                {d.ar > 0 ? <TrendingUp className="h-4 w-4 text-red-500" /> : <Minus className="h-4 w-4 text-gray-400" />}
              </div>
              <p className="text-xl font-bold mt-1">UF {fmtUF(d.ar)}</p>
              <p className="text-xs text-muted-foreground mt-1">Facturado no cobrado</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Backlog</p>
                <Info className="h-4 w-4 text-blue-400" />
              </div>
              <p className="text-xl font-bold mt-1">UF {fmtUF(d.backlog)}</p>
              <p className="text-xs text-muted-foreground mt-1">Contratado no devengado</p>
            </CardContent>
          </Card>
          <Card className={d.descalce < 0 ? "border-red-200" : d.descalce > 0 ? "border-green-200" : ""}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Descalce</p>
                {d.descalce < 0 ? <TrendingDown className="h-4 w-4 text-red-500" /> : d.descalce > 0 ? <TrendingUp className="h-4 w-4 text-green-500" /> : <Minus className="h-4 w-4 text-gray-400" />}
              </div>
              <p className={`text-xl font-bold mt-1 ${d.descalce < 0 ? "text-red-600" : d.descalce > 0 ? "text-green-600" : ""}`}>
                {d.descalce > 0 ? "+" : ""}UF {fmtUF(d.descalce)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Plan vs real (curva)</p>
            </CardContent>
          </Card>
        </div>

        {/* Detalle por contrato */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Detalle por Contrato</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Contrato</th>
                    <th className="pb-2 pr-4">Cliente</th>
                    <th className="pb-2 pr-4 text-right">Contratado</th>
                    <th className="pb-2 pr-4 text-right">Devengado</th>
                    <th className="pb-2 pr-4 text-right">Facturado</th>
                    <th className="pb-2 pr-4 text-right">Cobrado</th>
                    <th className="pb-2 pr-4 text-right">WIP</th>
                    <th className="pb-2 pr-4 text-right">AR</th>
                    <th className="pb-2 text-right">Backlog</th>
                  </tr>
                </thead>
                <tbody>
                  {d.contratos
                    .filter((c: any) => !c.esInversionInterna && c.contratado > 0)
                    .sort((a: any, b: any) => b.contratado - a.contratado)
                    .map((c: any) => (
                      <tr key={c.contractId} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-2 pr-4 font-medium">{c.contractName}</td>
                        <td className="py-2 pr-4 text-muted-foreground">{c.clientName}</td>
                        <td className="py-2 pr-4 text-right font-mono">{fmtUF(c.contratado)}</td>
                        <td className="py-2 pr-4 text-right font-mono text-blue-600">{fmtUF(c.devengado)}</td>
                        <td className="py-2 pr-4 text-right font-mono text-amber-600">{fmtUF(c.facturado)}</td>
                        <td className="py-2 pr-4 text-right font-mono text-green-600">{fmtUF(c.cobrado)}</td>
                        <td className="py-2 pr-4 text-right font-mono">{fmtUF(c.wip)}</td>
                        <td className="py-2 pr-4 text-right font-mono">{fmtUF(c.ar)}</td>
                        <td className="py-2 text-right font-mono">{fmtUF(c.backlog)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {d.contratos.filter((c: any) => !c.esInversionInterna && c.contratado > 0).length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No hay contratos comerciales con valor registrado. Los datos se poblarán desde la sincronización financiera.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Nota de fuente */}
        <div className="text-xs text-muted-foreground border-t pt-4">
          <p>
            Fuente: financial_data (sincronización diaria 03:00 UTC) + executive_contract_milestones (actas de aceptación).
            Facturación y cobros: [POR CONFIRMAR — integración SII/banco pendiente].
            UF del día: [POR CONFIRMAR — Banco Central].
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
