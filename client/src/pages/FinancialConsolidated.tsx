import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";

function formatUf(value: number | null | undefined): string {
  return value == null ? "N/D" : `UF ${value.toLocaleString("es-CL")}`;
}

export default function FinancialConsolidated() {
  const { user } = useAuth();
  const [fechaCorte, setFechaCorte] = useState(new Date().toISOString().split("T")[0]);

  const { data, isLoading, error } = trpc.portfolioConsole.getFinancialConsolidated.useQuery(
    { fechaCorte },
    { enabled: !!user }
  );
  const { data: ufDelDia } = trpc.portfolioConsole.ufDelDia.useQuery(undefined, { enabled: !!user });
  const ufTexto = ufDelDia?.valorCLP
    ? `$${Number(ufDelDia.valorCLP).toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : null;

  if (isLoading) {
    return (
      <div className="df-app">
        <main className="df-main">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-4 w-96 mb-8" />
          <div className="df-brechas">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="df-app">
        <main className="df-main">
          <div className="df-card">
            <div className="df-card-cuerpo">
              <p className="text-red-500">Error al cargar el consolidado: {error.message}</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const {
    fechaCorte: fechaCorteData,
    totalContratos,
    contratosActivos,
    contratosCerrados,
    contratado,
    devengado,
    facturado,
    cobrado,
    wip,
    ar,
    backlog,
    descalce,
    contratos: detalleContratos,
    proyeccionCobranza,
    agingAR,
    cicloFacturacion,
    modelosNegocio,
    modelosNegocioAvailability,
    concentracionCartera,
    invarianteOk,
  } = data || {};

  const pctDevengado = (contratado ?? 0) > 0 ? ((devengado ?? 0) / (contratado ?? 1)) * 100 : 0;
  const pctFacturado = (contratado ?? 0) > 0 ? ((facturado ?? 0) / (contratado ?? 1)) * 100 : 0;
  const pctCobrado = (contratado ?? 0) > 0 ? ((cobrado ?? 0) / (contratado ?? 1)) * 100 : 0;
  const pctBacklog = (contratado ?? 0) > 0 ? ((backlog ?? 0) / (contratado ?? 1)) * 100 : 0;

  return (
    <div className="df-app">

      {/* ═══ Contenido principal ═══ */}
      <main className="df-main">
        {/* ═══ ZONA 1: Cabecera ═══ */}
        <div className="df-cab">
          <div>
            <div className="df-eyebrow">Consolidado de Facturación</div>
            <h1>Cartera al {fechaCorteData ?? "N/D"}</h1>
            <p className="df-sub">
              Fecha de corte: {fechaCorteData ?? "N/D"} · UF del día:{" "}
              {ufTexto ? (
                <span className="df-uf-valor">{ufTexto}</span>
              ) : (
                <span className="df-alerta">[POR CONFIRMAR — Banco Central]</span>
              )}
            </p>
          </div>
          <div className="df-acciones">
            <label className="df-selector inline-flex items-center gap-2">
              <span>Fecha de corte</span>
              <input type="date" value={fechaCorte} onChange={(event) => setFechaCorte(event.target.value)} />
            </label>
          </div>
        </div>

        {/* ═══ ZONA 2: Barra unidad ═══ */}
        <div className="df-unidad">
          <div>
            <b>Todas las cifras en UF</b> · Contratos activos y cerrados
          </div>
          <div className="df-alerta">
            UF del día: {ufTexto || "[POR CONFIRMAR — Banco Central]"}
          </div>
          <div className="df-der">
            {totalContratos ?? 0} contratos · {contratosActivos ?? 0} activos · {contratosCerrados ?? 0} cerrados
          </div>
        </div>

        {/* ═══ ZONA 3: Lectura del periodo ═══ */}
        <div className="df-lectura">
          <span className="df-lbl">Lectura del periodo</span>
          <h2>
            La cartera muestra un <em>descalce de {formatUf(Math.abs(descalce ?? 0))}</em> entre lo devengado y lo planificado.
          </h2>
          <div className="df-lectura-cols">
            <div>
              <h4>Contratado vs. Devengado</h4>
              <p>
                De <b>{formatUf(contratado)}</b> contratados, <b>{formatUf(devengado)}</b> están devengados ({pctDevengado.toFixed(1)}%).
                El backlog de <b>{formatUf(backlog)}</b> representa el {pctBacklog.toFixed(1)}% de la cartera.
              </p>
            </div>
            <div>
              <h4>Facturación y Cobranza</h4>
              <p>
                El sistema registra <b>{formatUf(facturado)}</b> facturados y <b>{formatUf(cobrado)}</b> cobrados al corte.
                El WIP de <b>{formatUf(wip)}</b> está pendiente de facturación.
              </p>
            </div>
            <div>
              <h4>Descalce y Riesgo</h4>
              <p>
                El descalce de <b>{formatUf(Math.abs(descalce ?? 0))}</b> compara el plan acumulado con el devengo real.
                {descalce === 0 ? " No existe brecha al corte." : " Requiere revisar los contratos que explican la diferencia."}
              </p>
            </div>
          </div>
        </div>

        {/* ═══ ZONA 4: Embudo ═══ */}
        <div className="df-embudo">
          <div className="df-embudo-cab">
            <h2>Embudo de facturación</h2>
            <span className="df-nota">Cifras en UF · % sobre contratado</span>
          </div>

          {/* Etapa 1: Contratado */}
          <div className="df-etapa-top">
            <div className="df-nom">Contratado</div>
            <div className="df-def">Valor total de contratos activos</div>
            <div className="df-val">{formatUf(contratado)}</div>
            <div className="df-pct">100%</div>
          </div>
          <div className="df-etapa-barra">
            <i style={{ width: "100%", background: "var(--df-azul)" }} />
          </div>

          {/* Brecha 1: WIP */}
          <div className="df-brecha df-tibia">
            <span className="df-flecha">↓</span>
            <div className="df-t">
              WIP — Devengado no facturado
              <span>Pendiente de emisión de factura</span>
            </div>
            <span className="df-conv">DEVENGADO → FACTURADO</span>
            <span className="df-m">{formatUf(wip)}</span>
            <span className="df-dueno">Administración</span>
          </div>

          {/* Etapa 2: Devengado */}
          <div className="df-etapa-top">
            <div className="df-nom">Devengado</div>
            <div className="df-def">Hitos aceptados con acta</div>
            <div className="df-val">{formatUf(devengado)}</div>
            <div className="df-pct">{pctDevengado.toFixed(1)}%</div>
          </div>
          <div className="df-etapa-barra">
            <i style={{ width: `${pctDevengado}%`, background: "var(--df-cyan)" }} />
          </div>

          {/* Brecha 2: AR */}
          <div className="df-brecha df-mala">
            <span className="df-flecha">↓</span>
            <div className="df-t">
              AR — Facturado no cobrado
              <span>Cuentas por cobrar vencidas</span>
            </div>
            <span className="df-conv">FACTURADO → COBRADO</span>
            <span className="df-m">{formatUf(ar)}</span>
            <span className="df-dueno">Cobranza</span>
          </div>

          {/* Etapa 3: Facturado */}
          <div className="df-etapa-top">
            <div className="df-nom">Facturado</div>
            <div className="df-def">Facturas emitidas (SII)</div>
            <div className="df-val">{formatUf(facturado)}</div>
            <div className="df-pct">{pctFacturado.toFixed(1)}%</div>
          </div>
          <div className="df-etapa-barra">
            <i style={{ width: `${pctFacturado}%`, background: "var(--df-ambar)" }} />
          </div>

          {/* Brecha 3: Backlog */}
          <div className="df-brecha df-mala">
            <span className="df-flecha">↓</span>
            <div className="df-t">
              Backlog — Contratado no devengado
              <span>Hitos pendientes de aceptación</span>
            </div>
            <span className="df-conv">CONTRATADO → DEVENGADO</span>
            <span className="df-m">{formatUf(backlog)}</span>
            <span className="df-dueno">Delivery</span>
          </div>

          {/* Etapa 4: Cobrado */}
          <div className="df-etapa-top">
            <div className="df-nom">Cobrado</div>
            <div className="df-def">Pagos recibidos (banco)</div>
            <div className="df-val">{formatUf(cobrado)}</div>
            <div className="df-pct">{pctCobrado.toFixed(1)}%</div>
          </div>
          <div className="df-etapa-barra">
            <i style={{ width: `${pctCobrado}%`, background: "var(--df-verde)" }} />
          </div>
        </div>

        {/* ═══ ZONA 5: Tarjetas de brecha ═══ */}
        <div className="df-brechas">
          <div className="df-bcard df-tibia">
            <div className="df-et">WIP</div>
            <div className="df-v">{formatUf(wip)}</div>
            <div className="df-d">
              Devengado no facturado según eventos de ingreso y facturas elegibles al corte.
            </div>
            <div className="df-pie">
              <span>LAG_EMISION: N/D</span>
              <b>→ Administración</b>
            </div>
          </div>

          <div className="df-bcard df-mala">
            <div className="df-et">AR</div>
            <div className="df-v">{formatUf(ar)}</div>
            <div className="df-d">
              Facturado elegible menos pagos imputados por factura al corte.
            </div>
            <div className="df-pie">
              <span>DSO: N/D</span>
              <b>→ Cobranza</b>
            </div>
          </div>

          <div className="df-bcard df-mala">
            <div className="df-et">Backlog</div>
            <div className="df-v">{formatUf(backlog)}</div>
            <div className="df-d">
              Contratado no devengado. <b>{pctBacklog.toFixed(1)}%</b> de la cartera comercial al corte.
            </div>
            <div className="df-pie">
              <span>Plan vs. Real: {formatUf(descalce)}</span>
              <b>→ Delivery</b>
            </div>
          </div>

          <div className="df-bcard df-mala">
            <div className="df-et">Descalce</div>
            <div className="df-v">{formatUf(Math.abs(descalce ?? 0))}</div>
            <div className="df-d">
              Diferencia entre plan de pagos acumulado y devengo real al corte.
            </div>
            <div className="df-pie">
              <span>Invariante contable: {invarianteOk ? "OK" : "REVISAR"}</span>
              <b>→ PMO</b>
            </div>
          </div>
        </div>

        {/* ═══ ZONA 6: Detalle por contrato ═══ */}
        <div className="df-card">
          <div className="df-card-cab">
            <h3>Detalle por contrato</h3>
            <span className="df-tag">{totalContratos ?? 0} contratos</span>
          </div>
          <div className="df-tabla-scroll">
            <table className="df-tabla">
              <thead>
                <tr>
                  <th>Contrato</th>
                  <th>Cliente</th>
                  <th className="df-num">Contratado</th>
                  <th className="df-num">Devengado</th>
                  <th className="df-num">Facturado</th>
                  <th className="df-num">Cobrado</th>
                  <th className="df-num">WIP</th>
                  <th>Estado financiero</th>
                </tr>
              </thead>
              <tbody>
                {(detalleContratos || []).map((c: any) => (
                  <tr key={c.contractId}>
                    <td>
                      <div>{c.contractName}</div>
                      <span className="df-mini">{c.dealId}</span>
                    </td>
                    <td>{c.clientName}</td>
                    <td className="df-num">{formatUf(c.contratado)}</td>
                    <td className="df-num">{formatUf(c.devengado)}</td>
                    <td className="df-num">{formatUf(c.facturado)}</td>
                    <td className="df-num">{formatUf(c.cobrado)}</td>
                    <td className="df-num">{formatUf(c.wip)}</td>
                    <td>
                      {c.devengado > 0 ? (
                        <span className="df-chip df-verde">Devengando</span>
                      ) : c.contratado > 0 ? (
                        <span className="df-chip df-ambar">Backlog</span>
                      ) : (
                        <span className="df-chip df-gris">Sin datos</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ═══ ZONA 7: Proyección de cobranza + Aging de AR ═══ */}
        <div className="df-grid2">
          {/* Proyección de cobranza */}
          <div className="df-card">
            <div className="df-card-header">
              <h3 className="df-card-title">Proyección de cobranza</h3>
              <span className="df-card-badge">Próximos 10 pagos</span>
            </div>
            <div className="df-proyeccion-lista">
              {(proyeccionCobranza || []).length > 0 ? (
                (proyeccionCobranza || []).map((p: any, i: number) => (
                  <div key={i} className={`df-proyeccion-item ${p.estado}`}>
                    <div className="df-proyeccion-fecha">{p.fecha}</div>
                    <div className="df-proyeccion-concepto">
                      {p.concepto} — {p.cliente}
                    </div>
                    <div className="df-proyeccion-monto">{formatUf(Number(p.monto))}</div>
                  </div>
                ))
              ) : (
                <div className="df-proyeccion-item">
                  <div className="df-proyeccion-concepto">No hay pagos planificados en los datos cargados.</div>
                </div>
              )}
            </div>
          </div>

          {/* Aging de AR */}
          <div className="df-card">
            <div className="df-card-header">
              <h3 className="df-card-title">Aging de AR</h3>
              <span className="df-card-badge">Facturas pendientes</span>
            </div>
            <div className="df-aging-lista">
              {(agingAR || []).map((a: any, i: number) => (
                <div key={i} className="df-aging-item">
                  <div className="df-aging-rango">{a.rango}</div>
                  <div className="df-aging-monto">{formatUf(a.monto)}</div>
                  <div className="df-aging-pct">{(a.porcentaje ?? 0).toFixed(1)}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ ZONA 8: Ciclo de facturación + Modelos de negocio + Concentración ═══ */}
        <div className="df-grid2">
          {/* Ciclo de facturación */}
          <div className="df-card">
            <div className="df-card-header">
              <h3 className="df-card-title">Ciclo de facturación</h3>
              <span className="df-card-badge">4 etapas</span>
            </div>
            <div className="df-ciclo-lista">
              {(cicloFacturacion || []).map((c: any) => (
                <div key={c.numero} className="df-ciclo-item">
                  <div className="df-ciclo-numero">{c.numero}</div>
                  <div className="df-ciclo-contenido">
                    <div className="df-ciclo-titulo">{c.titulo}</div>
                    <div className="df-ciclo-descripcion">{c.descripcion}</div>
                    <div className="df-ciclo-metrica">{c.metrica}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Modelos de negocio */}
          <div className="df-card">
            <div className="df-card-header">
              <h3 className="df-card-title">Modelos de negocio</h3>
              <span className="df-card-badge">Distribución de cartera</span>
            </div>
            <div className="df-modelos-lista">
              {modelosNegocioAvailability === "unavailable" && (
                <div className="df-modelo-item">N/D — los contratos aún no tienen una clasificación verificable por modelo de negocio.</div>
              )}
              {(modelosNegocio || []).map((m: any, i: number) => (
                <div key={i} className="df-modelo-item">
                  <div>
                    <div className="df-modelo-nombre">{m.nombre}</div>
                    <div className="df-modelo-descripcion">{m.descripcion}</div>
                  </div>
                  <div className="df-modelo-monto">
                    {formatUf(m.monto)}
                    <div className="df-modelo-pct">{(m.porcentaje ?? 0).toFixed(0)}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Concentración de cartera */}
        <div className="df-card" style={{ marginBottom: 32 }}>
          <div className="df-card-header">
            <h3 className="df-card-title">Concentración de cartera</h3>
            <span className="df-card-badge">Top 5 clientes</span>
          </div>
          <div className="df-concentracion-lista">
            {(concentracionCartera || []).map((c: any, i: number) => (
              <div key={i}>
                <div className="df-concentracion-item">
                  <div className="df-concentracion-cliente">{c.cliente}</div>
                  <div className="df-concentracion-monto">{formatUf(c.monto)}</div>
                  <div className="df-concentracion-pct">{(c.porcentaje ?? 0).toFixed(1)}%</div>
                </div>
                <div className="df-concentracion-barra">
                  <div className="df-concentracion-barra-fill" style={{ width: `${c.porcentaje}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    
      {/* Zona 9: Supuestos */}
      <div className="df-supuestos">
        <div className="df-supuestos-titulo">Supuestos y Limitaciones</div>
        <div className="df-supuestos-lista">
          <div className="df-supuesto-item">
            <div className="df-supuesto-icono">1</div>
            <div className="df-supuesto-texto">
              <strong>UF del día:</strong> {ufTexto ? (
                <>Disponible desde {ufDelDia?.fuente === "cache" ? "caché local" : ufDelDia?.fuente || "findic.cl"}: {ufTexto} CLP.</>
              ) : (
                <>No disponible — requiere integración con Banco Central de Chile. Las cifras se muestran en UF sin conversión a CLP.</>
              )}
            </div>
          </div>
          <div className="df-supuesto-item">
            <div className="df-supuesto-icono">2</div>
            <div className="df-supuesto-texto">
              <strong>Facturación y Cobranza:</strong> Se consideran únicamente facturas `emitida` o `aceptada` y pagos imputados por `invoiceId` al corte. Cero significa que no existen registros elegibles en la base.
            </div>
          </div>
          <div className="df-supuesto-item">
            <div className="df-supuesto-icono">3</div>
            <div className="df-supuesto-texto">
              <strong>Proyección de cobranza:</strong> Basada exclusivamente en ítems de curva de pago con fecha y monto registrados.
            </div>
          </div>
          <div className="df-supuesto-item">
            <div className="df-supuesto-icono">4</div>
            <div className="df-supuesto-texto">
              <strong>Aging de AR:</strong> Calculado sobre el saldo vencido de facturas elegibles, descontando pagos registrados por factura al corte.
            </div>
          </div>
        </div>
      </div>

      {/* Zona 10: Pie nota */}
      <div className="df-pie-nota">
        <div className="df-pie-nota-texto">
          <strong>Nota:</strong> Este consolidado se genera automáticamente desde la planilla financiera corporativa 
          (Google Sheets) y los hitos contractuales de Jira. La sincronización se ejecuta diariamente a las 03:00 UTC. 
          Para consultas o correcciones, contactar al equipo de Administración.
        </div>
      </div>
</div>
  );
}
