# Contrato transversal de evidencia PMO

## Propósito

Este contrato define cómo las vistas ejecutivas, reportes y exportaciones deben resolver y presentar evidencia operacional, local y financiera. Su objetivo es evitar que una ausencia, una falla externa o un dato vencido se conviertan en un hecho aparente.

## Política Jira

La evidencia Jira se considera reciente durante **36 horas** desde `lastSuccessAt`. Un snapshot `success` reciente es utilizable. Un snapshot `partial` reciente es utilizable únicamente por campo: los valores presentes pueden mostrarse y los ausentes permanecen como `N/D`. Un snapshot `error`, vencido o sin éxito previo no puede alimentar fase operacional, avance, salud, hitos, riesgos ni PM.

Las vistas deben conservar `status`, `availability`, `capturedAt`, `lastSuccessAt`, `sourceUpdatedAt`, `stale`, `reason` y `errorCode`. Los procedimientos de lectura no deben actualizar Jira ni persistir observaciones.

## Separación semántica

| Dimensión | Fuente autorizada | Regla |
|---|---|---|
| Pipeline y plazo PMO | Etapas, aperturas, cierres, pausas, extensiones y feriados locales | Jira no modifica la etapa ni mide el SLA PMO. |
| Fase, avance, salud e hitos operacionales | Snapshot Jira reciente y utilizable | No existe fallback financiero para fase operacional. |
| PM | Asignación local → snapshot Jira utilizable → datos financieros | La fuente debe conservarse. |
| Riesgos | Matriz PMO confirmada → snapshot Jira utilizable → `N/D` | Ausencia no equivale a cero. |
| Monto contratado | Datos financieros por Deal → ficha con moneda válida → hitos en una única moneda | Nunca se suman monedas diferentes. |
| Facturado y cobrado | Evidencia financiera validada | Un hito cerrado no es una factura ni una aceptación del cliente. |
| IA | Inferencia o recomendación | Nunca sustituye una fuente oficial ni inventa cifras o fechas. |

## Monedas y ausencia

Una moneda vacía, `N/D`, `ND` o `N.A.` se considera ausente. Un monto sin moneda válida permanece como `N/D`. Los agregados conservan filas separadas por moneda y omiten valores sin unidad verificable.

## Política financiera inicial

Las facturas `emitida` y `aceptada` son las únicas elegibles para facturado; `por_confirmar`, `rechazada` y `anulada` no se agregan. Los pagos se imputan por `invoiceId` y el aging utiliza saldo pendiente al corte. Una fecha mensual `YYYY-MM` debe transformarse explícitamente al último día del mes antes de calcular el embudo.

## Presentación

`N/D` indica ausencia de evidencia utilizable. `POR CONFIRMAR` indica que existe un dato o decisión pendiente de validación humana. Ninguna interfaz debe reemplazarlos por cero, amarillo, fechas literales, arreglos vacíos o cifras demostrativas.
