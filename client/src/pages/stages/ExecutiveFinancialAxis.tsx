type FinancialAxisProps = {
  projectFinance: any;
  financialEvidence: any;
  commercialExposure: any;
  latestSyncAt?: Date | string | null;
  auditBase: string;
};

export function formatUfOrNd(value: unknown, digits = 2) {
  if (value === null || value === undefined || value === "") return "N/D";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "N/D";
  return `${numeric.toLocaleString("es-CL", { minimumFractionDigits: digits, maximumFractionDigits: digits })} UF`;
}

function formatPercentOrNd(value: unknown, ratio = false) {
  if (value === null || value === undefined || value === "") return "N/D";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "N/D";
  return `${(ratio ? numeric * 100 : numeric).toLocaleString("es-CL", { maximumFractionDigits: 1 })}%`;
}

function sourceLabel(source: unknown) {
  if (source === "snapshot") return "Snapshot financiero del corte";
  if (source === "financial_sync") return "Sincronización financiera por Deal";
  return "Sin evidencia financiera";
}

function FinancialCell({ label, value, detail, danger = false }: { label: string; value: string; detail: string; danger?: boolean }) {
  return <div className={`edv2-financial${danger ? " danger" : ""}`}>
    <span>{label}</span>
    <b>{value}</b>
    <p>{detail}</p>
  </div>;
}

export function ExecutiveFinancialAxis({ projectFinance, financialEvidence, commercialExposure, latestSyncAt, auditBase }: FinancialAxisProps) {
  const finance = projectFinance ?? {};
  const overview = finance.overview ?? {};
  const costs = finance.costs ?? {};
  const margin = finance.margin ?? {};
  const billing = finance.billing ?? {};
  const capturedAt = finance.capturedAt ?? latestSyncAt ?? null;
  const formattedCapturedAt = capturedAt
    ? new Date(capturedAt).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "N/D";
  const acceptedCoverage = overview.milestoneAmountCoverage?.total
    ? `${overview.milestoneAmountCoverage.withAmount}/${overview.milestoneAmountCoverage.total} hitos con monto`
    : "Sin hitos valorizables";

  return <section className="edv2-section" id="finanzas">
    <header className="edv2-section-header">
      <span>02</span>
      <div>
        <h2>Finanzas del proyecto — costos, margen y ciclo de caja</h2>
        <p>Separa valor contratado, costos consumidos, devengo, facturación SII y cobro. Un hito aceptado no se presenta como factura emitida.</p>
      </div>
      <b>UF · corte trazable</b>
    </header>

    <div className="edv2-kpis">
      <article className="edv2-kpi teal"><span className="edv2-kpi-label">Valor contratado</span><strong className="edv2-kpi-value">{formatUfOrNd(overview.contractedUf)}</strong><p>{overview.contractedSource === "financial_sync" ? "Venta sincronizada por Deal" : overview.contractedSource === "contract" ? "Contrato financiero registrado" : "Sin monto contractual disponible"}</p><small>{sourceLabel(finance.source)}</small></article>
      <article className="edv2-kpi ambar"><span className="edv2-kpi-label">Costo consumido</span><strong className="edv2-kpi-value">{formatUfOrNd(costs.consumedUf)}</strong><p>{formatPercentOrNd(costs.consumedPct, true)} del presupuesto de costo</p><small>financial_data.utilizadoUF</small></article>
      <article className="edv2-kpi gris"><span className="edv2-kpi-label">Presupuesto de costo</span><strong className="edv2-kpi-value">{formatUfOrNd(costs.budgetUf)}</strong><p>Base aprobada para medir consumo</p><small>financial_data.presupuestoUF</small></article>
      <article className="edv2-kpi magenta"><span className="edv2-kpi-label">Costo proyectado</span><strong className="edv2-kpi-value">{formatUfOrNd(costs.projectedCostUf)}</strong><p>Estimación a término disponible</p><small>No se infiere si la fuente no lo entrega</small></article>
      <article className="edv2-kpi teal"><span className="edv2-kpi-label">Margen proyectado</span><strong className="edv2-kpi-value">{formatUfOrNd(margin.projectedUf)}</strong><p>{formatPercentOrNd(margin.projectedPct, true)} sobre venta</p><small>Brecha objetivo: {margin.gapPp == null ? "N/D" : `${Number(margin.gapPp).toLocaleString("es-CL", { maximumFractionDigits: 1 })} pp`}</small></article>
    </div>

    <div className="edv2-two-col" style={{ marginTop: 16 }}>
      <article className="edv2-card">
        <div className="edv2-card-head"><h3>Embudo de facturación real</h3><span>{billing.available ? `${billing.contractCount} contrato(s)` : "SIN CONTRATO ENLAZADO"}</span></div>
        <div className="edv2-financials">
          <FinancialCell label="Devengado" value={formatUfOrNd(billing.accruedUf)} detail={`${billing.revenueEventCount ?? 0} evento(s) de devengo al corte`} />
          <FinancialCell label="Facturado (SII)" value={formatUfOrNd(billing.billedUf)} detail={`${billing.invoiceCount ?? 0} factura(s) emitida(s) o aceptada(s)`} />
          <FinancialCell label="Cobrado" value={formatUfOrNd(billing.collectedUf)} detail={`${billing.paymentCount ?? 0} pago(s) registrado(s)`} />
          <FinancialCell label="Cuentas por cobrar" value={formatUfOrNd(billing.accountsReceivableUf)} detail="Facturado menos cobrado" danger={Number(billing.accountsReceivableUf ?? 0) > 0} />
          <FinancialCell label="WIP" value={formatUfOrNd(billing.wipUf)} detail="Devengado aún no facturado" />
          <FinancialCell label="Backlog contractual" value={formatUfOrNd(billing.backlogUf)} detail="Contratado aún no devengado" />
        </div>
        {!billing.available ? <p className="edv2-note" style={{ margin: "0 18px 18px" }}><b>Brecha de datos:</b> no existe un contrato financiero enlazado a este proyecto o Deal. Por eso devengado, facturado y cobrado se muestran como N/D; no se reemplazan por hitos cerrados.</p> : null}
      </article>

      <article className="edv2-card">
        <div className="edv2-card-head"><h3>Capacidad, margen y procedencia</h3><span>{sourceLabel(finance.source)}</span></div>
        <div className="edv2-financials">
          <FinancialCell label="Capacity utilizado" value={formatUfOrNd(costs.capacityUsedUf)} detail="Carga consumida valorizada" />
          <FinancialCell label="Capacity planificado" value={formatUfOrNd(costs.capacityPlannedUf)} detail="Carga futura planificada" />
          <FinancialCell label="Capacity proyectado" value={formatUfOrNd(costs.capacityProjectedUf)} detail="Utilizado más planificado" />
          <FinancialCell label="Otros costos" value={formatUfOrNd(costs.otherCostsUf)} detail="Sólo cuando la fuente los informa" />
          <FinancialCell label="Valor de hitos aceptados" value={formatUfOrNd(overview.acceptedUf)} detail={acceptedCoverage} />
          <FinancialCell label="Cobertura de hitos" value={acceptedCoverage} detail="Monto directo o venta/contrato × peso" />
        </div>
        <p className="edv2-note" style={{ margin: "0 18px 18px" }}><b>Fuente y corte:</b> {sourceLabel(finance.source)} · {formattedCapturedAt}. Los montos de hitos miden exposición contractual; no acreditan facturación ni cobro.</p>
      </article>
    </div>

    <article className="edv2-card" style={{ marginTop: 16 }}>
      <div className="edv2-card-head"><h3>Impacto de la desviación sobre costo y margen</h3><span>modelo de gobierno cardinal</span></div>
      <div className="edv2-financials">
        <FinancialCell label="CV · sobre-ejecución" value={formatUfOrNd(financialEvidence?.impact?.cvUf)} detail="Valor ganado cardinal menos costo ejecutado" danger={Number(financialEvidence?.impact?.cvUf ?? 0) < 0} />
        <FinancialCell label="CPI-H" value={financialEvidence?.impact?.cpiH == null ? "N/D" : Number(financialEvidence.impact.cpiH).toLocaleString("es-CL", { maximumFractionDigits: 2 })} detail="Productividad sobre avance aceptado" />
        <FinancialCell label="EAC · banda" value={financialEvidence?.impact?.eacFloorUf == null || financialEvidence?.impact?.eacCeilingUf == null ? "N/D" : `${formatUfOrNd(financialEvidence.impact.eacFloorUf)} – ${formatUfOrNd(financialEvidence.impact.eacCeilingUf)}`} detail="Rango; no es pronóstico puntual" />
        <FinancialCell label="Daño total" value={formatUfOrNd(financialEvidence?.impact?.totalDamageUf)} detail="CV, carry, caja y penalidad trazables" danger={Number(financialEvidence?.impact?.totalDamageUf ?? 0) > 0} />
      </div>
      <div className="edv2-note" style={{ margin: "0 18px 18px" }}><b>Lectura contractual separada:</b> el valor de los hitos aceptados con acta es {formatUfOrNd(overview.acceptedUf)}. El descalce cardinal/comercial es {commercialExposure?.mismatchPp == null ? "N/D" : `${Number(commercialExposure.mismatchPp).toLocaleString("es-CL", { maximumFractionDigits: 1 })} pp`}. Ninguna de estas cifras equivale a una factura emitida. {auditBase}</div>
    </article>

    {Array.isArray(finance.warnings) && finance.warnings.length ? <div className="edv2-note" style={{ marginTop: 12 }}><b>Brechas de cobertura:</b> {finance.warnings.join(" ")}</div> : null}
  </section>;
}
