# BACKLOG — Consolidado de Facturación (reemplazo de /admin/finance)
Fecha: 2026-08-20 · Fuentes: dashboard-financiero-consolidado.html + INSTRUCCIONES-consolidado-facturacion.md

## Auditoría de origen (F0) — qué existe hoy
- Vista actual: client/src/pages/admin/AdminFinance.tsx — KPIs desde projects.totalAmount, gráfico 2 barras, tabla Proyecto/Cliente/Estado/Monto. Problemas D1-D9 confirmados.
- Datos existentes: financial_data (37 Deals: valorVentaUF, presupuesto, utilizado, margen, planificado/proyectado), billing_milestones, financial_sync_log, executive_contract_milestones (baseline+actas), executive_verdicts.
- NO existe: contract, payment_schedule_item, revenue_event, invoice, credit_note, payment, uf_value, internal_investment.
- Router financiero actual (routers.ts 6061-6105): upsertFinancialData, syncLogs, latestSync, syncNow. No hay consolidado.

## Fases (de la especificación, adaptadas a lo que existe)
- F0 Auditoría + reclasificación inversión interna (Prodigio Tech: 360001, 390001, 450001)
- F1 Modelo de datos: tablas contract, payment_schedule_item, revenue_event, invoice, credit_note, payment, uf_value, internal_investment + migración desde financial_data/billing_milestones
- F2 Sync UF (Banco Central) + estados SII/banco (stubs con [POR CONFIRMAR] si no hay integración real)
- F3 Motor determinista (server/financialEngine.ts): agregados ciclo, invariante, DSO/LAG, descalce, proyección, concentración, riesgos RF-01..08 + tests 12.1/12.2
- F4 Zonas 0-4: cabecera, barra unidad, lectura periodo, embudo, 4 tarjetas brecha
- F5 Zonas 5-8: curva S, proyección 90d, aging+DSO, mapa descalce, ciclo en días
- F6 Bloques de análisis híbridos (motor + LLM con citas motor:*) + validaciones 12.3
- F7 Zonas 9-13: detalle proyecto, modelo ingreso, concentración, riesgos, inversión interna, supuestos + exportación PDF/XLSX + accesibilidad

## Decisiones clave
- Reemplazo completo de /admin/finance (misma ruta, nueva página)
- Sistema visual heredado de la consola (cg-* → nuevo prefijo cf-* o reutilizar variables)
- Regla anti-fabricación: dato ausente = [POR CONFIRMAR], nunca 0
- Invariante de cierre: si no cuadra, banner de descuadre y no publicar totales
- DSO nunca sin LAG_EMISION
- Gráficos SVG inline (como el HTML de referencia), sin librería externa

## DECISIONES DEL USUARIO (2026-08-20) — Primera iteración = F0+F1+F3+F4
1. Por etapas: primera iteración = F0 (auditoría) + F1 (modelo datos) + F3 (motor) + F4 (zonas 0-4 embudo)
2. Sin integraciones externas: UF/SII/banco = stubs que muestran [POR CONFIRMAR] con responsable (regla anti-fabricación)
3. Curvas de pago: generar como línea base desde billing_milestones donde existan (Tanner), resto [POR CONFIRMAR]
4. Roles actuales: admin→ve todo, pmo→Delivery/Comercial, pm→sus proyectos, consulta→solo lectura

## Batería de validación del motor (sección 12.1) — conjunto de prueba
8 contratos cliente: CONTRATADO 19.032 UF, DEVENGADO 10.927, FACTURADO 8.287, COBRADO 6.945
- T-01 WIP=2.640 | T-02 AR=1.342 | T-03 AR_VENCIDO=862 (64%) | T-04 BACKLOG=8.105 | T-05 BLOQUEADO=3.490
- T-06 invariante: 6.945+1.342+2.640+8.105=19.032 | T-07 conv: 57,4%/75,8%/83,8%/36,5%
- T-08 DESCALCE_PP Deal1934=+25pp (45%-20%) | T-09 LAG_EMISION máx=137d (Plan Vital)
- T-10 SOBRECOMPROMISO sep=+134% (2.145/915) | T-11 CONCENTRACIÓN=43,1%→RF-05 | T-12 riesgos: RF-01..07

## Fórmulas del motor (sección 4.1)
CONTRATADO=Σcontract.valor_uf (FIRMADO/EN_EJECUCION/CERRADO); DEVENGADO=Σrevenue_event.monto_uf ≤T
FACTURADO=Σinvoice.monto_uf(SII=ACEPTADO)−Σcredit_note; COBRADO=Σpayment.monto_uf(conciliado_banco=true)
BACKLOG=CONTRATADO−DEVENGADO; BLOQUEADO=Σpayment_schedule_item vencido sin acta
WIP=DEVENGADO−FACTURADO; AR=FACTURADO−COBRADO; AR_VENCIDO=ΣAR vencidas
INVARIANTE: CONTRATADO=COBRADO+AR+WIP+BACKLOG (si no cuadra: banner descuadre, no publicar totales)
DSO=AR/(FACTURADO_365d/365); LAG_EMISION=mediana(emision−devengo); CICLO=mediana(pago−devengo)
DESCALCE_PP(p)=(FACTURADO/CONTRATADO − CHC_G)×100; umbral |20|pp
Proyección 90d: EN_FECHA (defendible) vs EN_RIESGO; SOBRECOMPROMISO=bruta/defendible−1 (>30%→RF-04)
CONCENTRACION(g)=CONTRATADO(grupo)/CONTRATADO (>30%→RF-05)

## Riesgos RF (sección 4.8)
RF-01 WIP>5% o LAG>15d (Adm+PM, 3d) | RF-02 AR_VENCIDO>20% AR (Cobranza, 2d)
RF-03 BLOQUEADO>10% contratado (Delivery, 3d) | RF-04 SOBRECOMPROMISO>30% (Finanzas+PMO, 1d)
RF-05 CONCENTRACIÓN>30% (Comercial, 15d) | RF-06 UF sin sync>2d (Plataforma, 2d)
RF-07 suscripción sin conciliar (Adm, 10d) | RF-08 factura +90d (Cobranza+Comercial, 1d)

## Proyectos inversión interna (excluir de ratios cartera): 360001 Nexos SFA, 390001 Producto Apigee Impl, 450001 Producto Apigee
## Reglas duras: dato ausente=[POR CONFIRMAR] nunca 0 | UF sin símbolo $ | DSO nunca sin LAG_EMISION | plan congelado | entregado sin acta no devenga | pago no conciliado no es cobrado

## HALLAZGOS F0 — Auditoría de origen (2026-08-20)

### financial_data (40 Deals totales, 8 relevantes para proyectos activos)
| Deal | Proyecto | Cliente | valorVentaUF | presupuestoUF | utilizadoUF | estado |
|---|---|---|---|---|---|---|
| Deal1934 | Tanner Framework SFA | Tanner | 8.200 | 2.050 | 2.113,57 | EN EJECUCION |
| Deal2207 | Vida Cámara Implementacion APIGEE | Vida Camara | 397 | 218 | 0 | EN EJECUCION |
| Deal4529 | Consalud Habilitación Apigee X | Consalud | 1.100 | 580 | 41,84 | EN EJECUCION |
| Deal4669 | Banco BCI Nexos SFA | Banco BCI | NULL | NULL | 0 | EN EJECUCION |
| Deal4687 | CloudOps Consalud Staffing | Consalud | (no encontrado en financial_data) | — | — | — |
| — | Producto Apigee (450001) | Prodigio Tech | — | — | — | inversión interna |
| — | Producto Apigee Impl (390001) | Prodigio Tech | — | — | — | inversión interna |

### billing_milestones de Tanner (180002)
Tabla existe pero la consulta retornó 0 filas visibles (posiblemente vacía o con datos en otra estructura). Columnas: milestoneNumber, description, amount, percentage, currency, dueDate, status, invoiceNumber, paidAt, responsableName, dateSource, jiraIssueKey.

### Reclasificación inversión interna (excluir de ratios cartera)
- 360001 Nexos SFA (Prodigio Tech) — aunque tiene Deal4669 en financial_data, es proyecto interno
- 390001 Producto Apigee Implementación/Migración (Prodigio Tech)
- 450001 Producto Apigee (Prodigio Tech)

### Datos ausentes que se mostrarán como [POR CONFIRMAR]
- Deal4669 (Nexos SFA): valorVentaUF y presupuestoUF son NULL
- Deal4687 (CloudOps): no existe en financial_data
- Producto Apigee ×2: sin financial_data (son inversión interna, correcto)
- billing_milestones de Tanner: vacío o sin datos accesibles
- UF value: sin integración Banco Central (stub)
- Invoice/payment: sin integración SII/banco (stub)
