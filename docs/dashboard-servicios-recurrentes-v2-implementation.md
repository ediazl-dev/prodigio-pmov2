# Dashboard de Servicios Recurrentes V2 — Bitácora de implementación

**Autor:** Manus AI  
**Inicio:** 16 de septiembre de 2026  
**Base de código:** `da9615671c633383f8c6c93f44765a22d31a3258`

## R0 — Línea base, sincronismo y salvaguardas

El gate de versión confirmó la rama `main`, con `HEAD`, `origin/main` y `user_github/main` alineados en `da961567`. El único cambio local era el backlog de esta implementación. El estado TypeScript conserva cinco errores heredados ya documentados, sin relación con el dashboard recurrente.

La línea base productiva al 16 de septiembre de 2026 contiene tres servicios activos: uno de soporte de incidentes, uno de requerimientos y uno mixto. En conjunto poseen 15 cuotas programadas, todas pendientes; ocho ya están vencidas por fecha de corte. No existe monto local marcado como facturado o pagado. Los tres servicios tienen contrato y SoW, doce reglas SLA configuradas en total, y ninguno presenta penalidades activas. Solo Camanchaca tiene clave de proyecto JSM y solo ese Deal encuentra coincidencia en `financial_data`; todavía no existe un `serviceDeskId` confirmado.

Antes de cualquier reconciliación se creó una salvaguarda física con prefijo `backup_recurring_dashboard_v2_20260916_`. El manifiesto verificó coincidencia exacta entre producción y respaldo para 3 servicios, 15 cuotas, 12 documentos, 15 etapas, 73 ítems de plan, 12 reglas SLA, 1 corrida de vínculo JSM y 1 registro financiero coincidente. Los conjuntos de penalidades, análisis IA, mapeos JSM y corridas de sincronización estaban vacíos. Estas tablas no se eliminarán durante la implementación.

| Control R0 | Resultado |
|---|---|
| Rama y referencias | Alineadas en `da961567` |
| Árbol previo | Solo `todo.md`, cambio esperado |
| Servicios productivos | 3 |
| Cuotas programadas | 15 |
| Cuotas vencidas pendientes | 8 |
| Facturado local verificable | 0 |
| Pagado local verificable | 0 |
| Respaldos físicos | 12 tablas de datos + manifiesto |
| Conteos respaldo versus producción | 12 de 12 coincidentes |
| Errores TypeScript de línea base | 5 heredados |

## Estado de fases

| Fase | Estado |
|---|---|
| R0 — Línea base y salvaguardas | Completada |
| D0 — Contrato de métricas | Completada |
| D1–D10 | Pendientes |

## D0 — Contrato de métricas y salud determinista

Se implementó `recurringServicesMetricsEngine.ts` como motor puro y versionado `2.0`. El contrato separa **contratado, programado, facturado, cobrado, cuentas por cobrar, pendiente y vencido** por moneda. No existe un total monetario transversal que sume USD, CLP, UF u otras monedas. El motor usa una fecha de corte explícita y solo considera facturada una cuota cuyo estado sea `facturado` o `pagado`; solo considera cobrada una cuota `pagado`.

La configuración SLA quedó separada del cumplimiento real. Cuando no existe snapshot operacional medible, incidentes y porcentajes SLA se entregan como `null`, con estado de evidencia `not_configured`, `stale` o `error`. El semáforo combina reglas auditables para cuotas vencidas, reportes exigibles pendientes, formalidad documental, incidentes críticos y mediciones SLA. Si no existe ninguna dimensión medible, el resultado es `no_data` en vez de fabricar un estado favorable.

| Regla D0 | Resultado verificable |
|---|---|
| Contrato de salida | Versionado como `2.0` |
| Monedas | Agregación independiente por código monetario |
| Facturado | Estados `facturado` + `pagado` |
| Cobrado | Solo estado `pagado` |
| Vencido financiero | `pendiente` con fecha anterior al corte |
| Reporte exigible | Fecha menor o igual al corte |
| SLA sin evidencia | `null`, nunca inferido desde configuración |
| Salud sin evidencia | `no_data` |
| Suite focal | 7 pruebas aprobadas |

La suite `server/recurringServicesMetricsEngine.test.ts` cubre separación financiera, fecha de corte, N/D de SLA, multimoneda, cumplimiento medido, salud estable y ausencia total de evidencia. Los cinco errores TypeScript heredados de la línea base permanecen fuera de este incremento.
