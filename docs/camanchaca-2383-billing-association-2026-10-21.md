# Camanchaca 2383 — asociación y evidencia de facturación

**Servicio:** PMO 2100001 · Deal 2383 · Soporte y Evolutivo Camanchaca. **Fuente operacional:** CAMANSOP01. **Fecha:** 21 de octubre de 2026. **Base:** `ba5fe6ac`, rama `feat/recurring-management-dashboard-v2`, referencias verificadas y árbol limpio al inicio.

## Causa confirmada

Las seis cuotas PMO no tenían `jiraIssueKey`. La lectura dependía de conciliación por mes entre originales, tickets PMO y otro candidato M05. Además, el campo global Estado de Facturación está vacío en los originales: el lector omitía las confirmaciones explícitas que Aiza registró en sus comentarios. Completed por sí solo no demuestra emisión; aquí la evidencia es el comentario financiero explícito, no el workflow.

## Asociación aplicada

| Cuota | Hito original | Importe | Confirmación JSM |
|---|---|---:|---|
| M01 | CAMANSOP01-20 | UF94 | Aiza · comentario59170 · «Facturado» |
| M02 | CAMANSOP01-21 | UF94 | Aiza · comentario59171 · «Facturado» |
| M03 | CAMANSOP01-22 | UF94 | Aiza · comentario59564 · «Facturación confirmada el 15/09» |
| M04 | CAMANSOP01-23 | UF94 | Aiza · comentario59715 · «Confirmada facturación, asociada a la HES» |
| M05 | CAMANSOP01-24 | UF94 | Aiza · comentario59716 · «Facturación completada asociada a la HES» |
| M06 | CAMANSOP01-25 | UF94 | Sin confirmación: N/D |

Resultado GET real: **seis hitos, cinco confirmados, UF470 confirmados, una cuota N/D, cero duplicados sumados y cero advertencias**. M06 N/D no se presenta como deuda ni como no facturado. El compromiso total UF564 se conserva. La fecha del comentario es fecha de observación; no se transforma el texto «15/09» en una fecha fiscal de emisión.

## Política y cambios

Se guardaron las seis claves originales en las cuotas y se configuró reutilización de hitos existentes (`external_reference`) para evitar nuevas creaciones. Una política opt-in administrativa restringe los comentarios a este servicio, CAMANSOP01, seis claves explícitas y la cuenta Jira verificada de Aiza. El campo estructurado conserva precedencia; En Proceso, campos inválidos, comentarios incompletos, autores no permitidos, preguntas o citas no acreditan factura. Negaciones y anulaciones explícitas posteriores invalidan la confirmación previa. Ningún otro servicio adquiere esta política automáticamente.

El panel expone autor, texto y enlace directo a cada comentario. Esto es confirmación operacional en JSM, no validación de una factura tributaria ni evidencia de cobro. La planilla financiera histórica no cambia.

La comprobación visual detectó otro defecto: la cabecera ocultaba todo el subtotal si quedaba cualquier cuota N/D. Se corrigió la cabecera y el KPI de Ejecución para conservar el importe confirmado y señalar las cuotas no incluidas. Con todas las cuotas desconocidas sigue mostrándose N/D, nunca un cero inventado. La ficha verificada muestra UF470 en cabecera y panel; JSM Setup muestra Facturación(6) y reutilización sin duplicar.

## Preservación y recuperación

Respaldo privado con SHA-256 en `/home/ubuntu/backups/prodigio-pmo/2026-10-21-camanchaca-2383-billing-association/`: `before.json`, `association-before.json`, `association-after.json` y `verified-after.json` con sus hashes. Una transacción y un registro de auditoría documentan el cambio. La segunda ejecución devuelve noop.

Se verificaron cuotas, monedas, fechas, campos de factura, etapas, plan, artefactos y decisiones sin cambios. **Cero escrituras Jira/JSM, cero copias y cero eliminaciones.** El Staffing4687 sigue cerrado e intacto; CONSALOP02 conserva UF585 y CONSALOP03 UF320 según sus campos estructurados.

## Certificación

51 pruebas focales del bloque financiero y regresión adicional del subtotal parcial aprobadas; suite final: **1.232 aprobadas, 20 omitidas**. Build productivo exitoso; TypeScript conserva exactamente los cinco errores heredados, sin errores nuevos. Vista previa autenticada HTTP200: ficha y JSM Setup verificados. Los nuevos archivos se guardaron primero en `c44e44a1` antes de reiniciar la vista previa desde referencias alineadas; la entrega final incorpora el ajuste visual posterior. El dominio productivo requiere publicar la versión guardada; no se confunde checkpoint con despliegue.
