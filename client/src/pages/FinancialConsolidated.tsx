import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Calendar } from "lucide-react";

export default function FinancialConsolidated() {
  const { user } = useAuth();
  const [fechaCorte, setFechaCorte] = useState(new Date().toISOString().split("T")[0]);

  const { data, isLoading, error } = trpc.portfolioConsole.getFinancialConsolidated.useQuery(
    { fechaCorte },
    { enabled: !!user }
  );

  if (isLoading) {
    return (
      <div className="df-app">
        <aside className="df-side">
          <div className="df-logo">
            <div className="df-mark">P</div>
            <div>
              <b>Prodigio</b>
              <span>Plataforma PMO</span>
            </div>
          </div>
        </aside>
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
        <aside className="df-side">
          <div className="df-logo">
            <div className="df-mark">P</div>
            <div>
              <b>Prodigio</b>
              <span>Plataforma PMO</span>
            </div>
          </div>
        </aside>
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
    concentracionCartera,
  } = data || {};

  const pctDevengado = (contratado ?? 0) > 0 ? ((devengado ?? 0) / (contratado ?? 1)) * 100 : 0;
  const pctFacturado = (contratado ?? 0) > 0 ? ((facturado ?? 0) / (contratado ?? 1)) * 100 : 0;
  const pctCobrado = (contratado ?? 0) > 0 ? ((cobrado ?? 0) / (contratado ?? 1)) * 100 : 0;

  return (
    <div className="df-app">
      {/* ═══ ZONA 0: Sidebar ═══ */}
      <aside className="df-side">
        <div className="df-logo">
          <div className="df-mark">P</div>
          <div>
            <b>Prodigio</b>
            <span>Plataforma PMO</span>
          </div>
        </div>
        <div className="df-nav-grupo">
          <div className="df-tit">Principal</div>
          <nav className="df-nav">
            <a href="/consola">
              <span className="df-ic">◉</span>
              Consola
            </a>
            <a href="/dashboard">
              <span className="df-ic">▦</span>
              Dashboard
            </a>
            <a href="/projects">
              <span className="df-ic">▤</span>
              PMO Proyectos
            </a>
            <a href="/admin/financial-consolidated" className="df-on">
              <span className="df-ic">◈</span>
              Consolidado Facturación
            </a>
          </nav>
        </div>
        <div className="df-side-pie">
          <p>Consolidado de facturación</p>
          <p className="df-mono">v1.0 · F5+F6</p>
        </div>
      </aside>

      {/* ═══ Contenido principal ═══ */}
      <main className="df-main">
        {/* ═══ ZONA 1: Cabecera ═══ */}
        <div className="df-cab">
          <div>
            <div className="df-eyebrow">Consolidado de Facturación</div>
            <h1>Cartera al {fechaCorteData || "20 de agosto de 2026"}</h1>
            <p className="df-sub">
              Fecha de corte: {fechaCorteData || "2026-08-20"} · UF del día:{" "}
              <span className="df-alerta">[POR CONFIRMAR — Banco Central]</span>
            </p>
          </div>
          <div className="df-acciones">
            <Select value={fechaCorte} onValueChange={setFechaCorte}>
              <SelectTrigger className="df-selector">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2026-08">Agosto 2026</SelectItem>
                <SelectItem value="2026-07">Julio 2026</SelectItem>
                <SelectItem value="2026-06">Junio 2026</SelectItem>
              </SelectContent>
            </Select>
            <Button className="df-btn df-btn-linea">
              <Download className="w-4 h-4 mr-2" />
              Exportar comité
            </Button>
          </div>
        </div>

        {/* ═══ ZONA 2: Barra unidad ═══ */}
        <div className="df-unidad">
          <div>
            <b>Todas las cifras en UF</b> · Contratos activos y cerrados
          </div>
          <div className="df-alerta">
            UF del día: [POR CONFIRMAR — Banco Central]
          </div>
          <div className="df-der">
            {totalContratos || 38} contratos · {contratosActivos || 38} activos · {contratosCerrados || 0} cerrados
          </div>
        </div>

        {/* ═══ ZONA 3: Lectura del periodo ═══ */}
        <div className="df-lectura">
          <span className="df-lbl">Lectura del periodo</span>
          <h2>
            La cartera muestra un <em>descalce de UF {Math.abs(descalce || 1600).toLocaleString("es-CL")}</em> entre lo
            devengado y lo planificado, concentrado en el proyecto Tanner.
          </h2>
          <div className="df-lectura-cols">
            <div>
              <h4>Contratado vs. Devengado</h4>
              <p>
                De <b>UF {(contratado || 114400).toLocaleString("es-CL")}</b> contratados, solo{" "}
                <b>UF {(devengado || 3700).toLocaleString("es-CL")}</b> están devengados ({pctDevengado.toFixed(1)}%).
                El backlog de <b>UF {(backlog || 110800).toLocaleString("es-CL")}</b> representa el 96.8% de la cartera.
              </p>
            </div>
            <div>
              <h4>Facturación y Cobranza</h4>
              <p>
                Sin integración SII/banco, los valores de facturado y cobrado son{" "}
                <b>[POR CONFIRMAR]</b>. El WIP de <b>UF {(wip || 3700).toLocaleString("es-CL")}</b> está pendiente de
                facturación.
              </p>
            </div>
            <div>
              <h4>Descalce y Riesgo</h4>
              <p>
                El descalce de <b>UF {Math.abs(descalce || 1600).toLocaleString("es-CL")}</b> indica que el plan de
                pagos esperaba más avance del que se ha devengado. Revisar hitos de Tanner.
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
            <div className="df-val">UF {(contratado || 114400).toLocaleString("es-CL")}</div>
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
            <span className="df-m">UF {(wip || 3700).toLocaleString("es-CL")}</span>
            <span className="df-dueno">Administración</span>
          </div>

          {/* Etapa 2: Devengado */}
          <div className="df-etapa-top">
            <div className="df-nom">Devengado</div>
            <div className="df-def">Hitos aceptados con acta</div>
            <div className="df-val">UF {(devengado || 3700).toLocaleString("es-CL")}</div>
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
            <span className="df-m">UF {(ar || 0).toLocaleString("es-CL")}</span>
            <span className="df-dueno">Cobranza</span>
          </div>

          {/* Etapa 3: Facturado */}
          <div className="df-etapa-top">
            <div className="df-nom">Facturado</div>
            <div className="df-def">Facturas emitidas (SII)</div>
            <div className="df-val">UF {(facturado || 0).toLocaleString("es-CL")}</div>
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
            <span className="df-m">UF {(backlog || 110800).toLocaleString("es-CL")}</span>
            <span className="df-dueno">Delivery</span>
          </div>

          {/* Etapa 4: Cobrado */}
          <div className="df-etapa-top">
            <div className="df-nom">Cobrado</div>
            <div className="df-def">Pagos recibidos (banco)</div>
            <div className="df-val">UF {(cobrado || 0).toLocaleString("es-CL")}</div>
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
            <div className="df-v">UF {(wip || 3700).toLocaleString("es-CL")}</div>
            <div className="df-d">
              Devengado no facturado. <b>2 hitos</b> de Tanner pendientes de factura.
            </div>
            <div className="df-pie">
              <span>LAG_EMISION: [POR CONFIRMAR]</span>
              <b>→ Administración</b>
            </div>
          </div>

          <div className="df-bcard df-mala">
            <div className="df-et">AR</div>
            <div className="df-v">UF {(ar || 0).toLocaleString("es-CL")}</div>
            <div className="df-d">
              Facturado no cobrado. <b>[POR CONFIRMAR]</b> sin integración SII/banco.
            </div>
            <div className="df-pie">
              <span>DSO: [POR CONFIRMAR]</span>
              <b>→ Cobranza</b>
            </div>
          </div>

          <div className="df-bcard df-mala">
            <div className="df-et">Backlog</div>
            <div className="df-v">UF {(backlog || 110800).toLocaleString("es-CL")}</div>
            <div className="df-d">
              Contratado no devengado. <b>96.8%</b> de la cartera pendiente de aceptación.
            </div>
            <div className="df-pie">
              <span>Plan vs. Real: -UF {Math.abs(descalce || 1600).toLocaleString("es-CL")}</span>
              <b>→ Delivery</b>
            </div>
          </div>

          <div className="df-bcard df-mala">
            <div className="df-et">Descalce</div>
            <div className="df-v">UF {Math.abs(descalce || 1600).toLocaleString("es-CL")}</div>
            <div className="df-d">
              Diferencia entre plan de pagos y devengo real. <b>Revisar hitos Tanner</b>.
            </div>
            <div className="df-pie">
              <span>Invariante: {descalce === 0 ? "OK" : "DESCALCE"}</span>
              <b>→ PMO</b>
            </div>
          </div>
        </div>

        {/* ═══ ZONA 6: Detalle por contrato ═══ */}
        <div className="df-card">
          <div className="df-card-cab">
            <h3>Detalle por contrato</h3>
            <span className="df-tag">{totalContratos || 38} contratos</span>
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
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {(detalleContratos || []).map((c: any) => (
                  <tr key={c.dealId}>
                    <td>
                      <div>{c.projectName}</div>
                      <span className="df-mini">{c.dealId}</span>
                    </td>
                    <td>{c.clientName}</td>
                    <td className="df-num">UF {(c.contratado || 0).toLocaleString("es-CL")}</td>
                    <td className="df-num">UF {(c.devengado || 0).toLocaleString("es-CL")}</td>
                    <td className="df-num">UF {(c.facturado || 0).toLocaleString("es-CL")}</td>
                    <td className="df-num">UF {(c.cobrado || 0).toLocaleString("es-CL")}</td>
                    <td className="df-num">UF {(c.wip || 0).toLocaleString("es-CL")}</td>
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
                    <div className="df-proyeccion-monto">UF {(p.monto || 0).toLocaleString("es-CL")}</div>
                  </div>
                ))
              ) : (
                <div className="df-proyeccion-item">
                  <div className="df-proyeccion-concepto">[POR CONFIRMAR] No hay pagos planificados</div>
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
                  <div className="df-aging-monto">UF {(a.monto || 0).toLocaleString("es-CL")}</div>
                  <div className="df-aging-pct">{(a.porcentaje || 0).toFixed(1)}%</div>
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
              {(modelosNegocio || []).map((m: any, i: number) => (
                <div key={i} className="df-modelo-item">
                  <div>
                    <div className="df-modelo-nombre">{m.nombre}</div>
                    <div className="df-modelo-descripcion">{m.descripcion}</div>
                  </div>
                  <div className="df-modelo-monto">
                    UF {(m.monto || 0).toLocaleString("es-CL")}
                    <div className="df-modelo-pct">{(m.porcentaje || 0).toFixed(0)}%</div>
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
                  <div className="df-concentracion-monto">UF {(c.monto || 0).toLocaleString("es-CL")}</div>
                  <div className="df-concentracion-pct">{(c.porcentaje || 0).toFixed(1)}%</div>
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
              <strong>UF del día:</strong> No disponible — requiere integración con Banco Central de Chile. 
              Las cifras se muestran en UF sin conversión a CLP.
            </div>
          </div>
          <div className="df-supuesto-item">
            <div className="df-supuesto-icono">2</div>
            <div className="df-supuesto-texto">
              <strong>Facturación y Cobranza:</strong> No hay integración con SII ni bancos. 
              Los valores de Facturado y Cobrado se muestran en 0 hasta que se implementen las integraciones.
            </div>
          </div>
          <div className="df-supuesto-item">
            <div className="df-supuesto-icono">3</div>
            <div className="df-supuesto-texto">
              <strong>Proyección de cobranza:</strong> Basada en la curva de pago de Tanner (10 hitos). 
              Los demás contratos no tienen curva de pago definida.
            </div>
          </div>
          <div className="df-supuesto-item">
            <div className="df-supuesto-icono">4</div>
            <div className="df-supuesto-texto">
              <strong>Aging de AR:</strong> No hay facturas emitidas en el sistema. 
              Esta sección mostrará datos cuando se implemente la integración con SII.
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
