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
| D1 — Calidad y reconciliación | Completada |
| D2 — Modelo de evidencias y snapshots | Completada |
| D3 — API consolidada de portafolio | Completada |
| D4–D10 | Pendientes |

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

## D1 — Calidad y reconciliación de datos

Se implementó `recurringServicesQualityEngine.ts`, que diagnostica seis dimensiones por servicio: **Deal, moneda, tipología, contrato, documentación y JSM**. La salida distingue condiciones informativas, advertencias y bloqueos de métricas confiables; normaliza la identidad del Deal sin modificarla y solo propone correcciones cuando existe evidencia no contradictoria.

El diagnóstico productivo confirmó que los tres planes de facturación coinciden exactamente con sus montos contractuales y monedas locales, y que cada servicio posee contrato y SoW. Camanchaca coincide de forma única con `financial_data`; los Deals 4687 y 4727 todavía no aparecen en esa fuente y quedan como brecha visible, no como error corregido. Ningún servicio tiene aún un `serviceDeskId` JSM confirmado, por lo que incidentes y SLA continuarán como N/D hasta D7.

Los servicios 2040001 y 2070001 contenían la palabra **Staffing** de forma explícita en su denominación persistida, pero estaban clasificados como `soporte_incidentes` y `requerimientos`. Se corrigieron exclusivamente esos dos IDs a `staffing` dentro de una transacción. La tabla `backup_recurring_dashboard_v2_20260916_services` conserva los valores originales y `audit_logs` contiene una entrada D1 por cada corrección. No se modificaron monedas, montos, cuotas, documentos ni vínculos JSM.

| Control D1 | Resultado |
|---|---|
| Servicios diagnosticados | 3 |
| Plan contractual versus cuotas | 3 de 3 coincidentes |
| Moneda servicio versus cuotas | 3 de 3 coincidentes |
| Contrato + SoW | 3 de 3 completos |
| Deal reconciliado con fuente financiera | 1 de 3 |
| Service Desk JSM confirmado | 0 de 3 |
| Tipologías Staffing corregidas | 2 |
| Registros de auditoría | 2 |
| Pruebas de calidad | 6 aprobadas |

## D2 — Evidencia verificable e historial operacional

La migración aditiva `0045_cute_may_parker.sql` incorporó cuatro entidades nuevas sin alterar los registros productivos existentes: control de vigencia documental, evidencia mensual de entrega y aceptación, evidencia financiera de factura/pago/nota de crédito y snapshots históricos JSM/SLA. Las tablas usan claves e índices para impedir duplicidad por documento, período y fingerprint de snapshot.

Durante la aplicación inicial, la última sentencia de creación quedó incompleta por un corte en la consulta enviada. La diferencia fue detectada inmediatamente con `information_schema` cuando las cuatro tablas tenían **cero filas**. Se completaron las columnas, enums, clave primaria e índices antes de insertar cualquier dato. La estructura final coincide con el esquema y la migración generada: 11, 16, 25 y 15 columnas respectivamente, con todos los índices declarados.

| Tabla D2 | Propósito | Filas productivas al cierre |
|---|---|---:|
| `recurring_service_document_controls` | Vigencia y validación de documentos | 0 |
| `recurring_service_report_evidence` | Período, entrega, aceptación y evidencia mensual | 0 |
| `recurring_service_financial_evidence` | Factura, pago, nota de crédito y trazabilidad | 0 |
| `recurring_service_jsm_snapshots` | Incidentes y cumplimiento SLA histórico | 0 |

La prueba opt-in `recurringDashboardV2Persistence.test.ts` insertó un servicio aislado y registros de las cuatro entidades, validó unicidad de períodos y snapshots, y eliminó todos los datos de prueba. El control posterior confirmó cero residuos. La reversión segura quedó documentada en `docs/migrations/0045-dashboard-recurrente-v2-rollback.md` y exige respaldo/autorización si las tablas ya contienen evidencia real.

## D3 — API consolidada del portafolio

Se agregó el procedimiento protegido `recurringServices.dashboardV2`, manteniendo intacto `dashboardKpis` para permitir convivencia V1/V2. El endpoint acepta fecha de corte y filtros por cliente, estado, tipo, salud, moneda y texto; todos los KPIs se recalculan sobre el universo filtrado en el servidor.

La capa de datos obtiene por separado servicios, cuotas, plan de trabajo, documentos, controles documentales, evidencias mensuales, evidencias financieras, reglas SLA, snapshots JSM y referencias financieras. Esto evita multiplicación de montos por joins uno-a-muchos. El agregador puro integra el contrato D0 y el diagnóstico D1, selecciona el snapshot JSM más reciente por servicio y lo marca obsoleto cuando excede 36 horas.

| Salida D3 | Contenido |
|---|---|
| `metadata` | Versión, fecha de corte, filtros, universo y frescura JSM |
| `filterOptions` | Clientes, estados, tipos, monedas y salud disponibles |
| `kpis` | Cartera, finanzas por moneda, reportes, formalidad, incidentes, SLA y calidad |
| `trends` | Series financieras por moneda, reportes e incidentes |
| `matrix` | Fila 360 resumida y ordenada por criticidad para cada servicio |
| `quality` | Diagnóstico por dimensión y resumen del portafolio |
| `evidenceInventory` | Cobertura de las cuatro entidades D2 |

Las pruebas unitarias D3 cubren filtros, búsqueda, snapshot vigente/obsoleto, salud, calidad y series multimoneda. La prueba de integración opt-in consultó la base real en modo solo lectura y construyó el portafolio completo sin sumar monedas distintas. Resultado acumulado: 19 pruebas unitarias D0–D3 y 1 prueba de integración aprobadas; no se agregaron errores TypeScript a los cinco heredados.
