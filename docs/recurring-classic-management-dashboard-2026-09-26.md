# Vista clásica gerencial de servicios recurrentes

**Fecha:** 26-sep-2026  
**Base:** checkpoint `f68fd07f`  
**Captura de referencia:** `FireShotCapture366-Prodigio-PlataformaPMO-[pmo.prodigio.tech].pdf`

## Problema confirmado

La vista Clásico priorizaba distribuciones administrativas y separaba poco las preguntas gerenciales. La caja “Distribución por Etapa” repetía información del pipeline y ocupaba el espacio necesario para contrato, facturación, incidentes, SLA y tendencia mensual.

## Diseño implementado

1. **Resumen gerencial** con corte y procedencia.
2. **KPIs agregados**: monto comprometido, facturado, pendiente de facturar, incidentes resueltos/pendientes, reportes, SLA y formalidad.
3. **Evolución mensual** de facturación por moneda, sin sumar UF y USD.
4. **Evolución mensual operativa** basada en el último snapshot JSM de cada servicio y mes.
5. **Pendientes operativos** por servicio con reglas SLA configuradas por prioridad; no se asigna una regla a un ticket cuando su prioridad no está disponible.
6. Se conservan las tres cajas complementarias: **SLA medido, Multas y Distribución por tipo**.
7. Se elimina **Distribución por Etapa**.
8. El detalle consolidado **Financiero, Entregables, Formalidad y Operación JSM** vive únicamente en Clásico; Torre V2 conserva alertas y priorización sin duplicar ese cuerpo.
9. La **tabla resumen por servicio queda al final**, después del consolidado, con alternativa móvil en tarjetas.

## Fuentes deterministas

- Finanzas: read model recurrente V2 y facturación corporativa conciliada por Deal.
- Incidentes/SLA: snapshots JSM persistidos; no consulta Jira/JSM en vivo al renderizar.
- Multas: `recurring_service_penalties`.
- Reportes/formalidad: work plan y evidencia documental recurrente.

## Validación real inicial

En la lectura del 26-sep-2026:

- 3 servicios activos.
- Facturado: **UF 282**.
- Programado/comprometido recurrente visible: **USD 2.214** y dimensión UF separada.
- Operación JSM medida en 1 de 3 servicios.
- Snapshot Camanchaca: **66 incidentes observados, 34 resueltos y 32 abiertos**; 3 altos, 0 críticos, 14 con más de 30 días.
- Las reglas SLA configuradas de Camanchaca se muestran por prioridad; el cumplimiento permanece **N/D** cuando los ciclos SLA no fueron medidos.

## Guardrails

- N/D nunca se reemplaza por cero.
- No se suman monedas distintas.
- “Resueltos” se deriva sólo como `total observado - abiertos` dentro del mismo snapshot.
- La serie mensual de incidentes representa stock observado por snapshot, no tickets creados en el mes.
- El ciclo financiero termina en Facturado; no presenta cobros ni CxC.
