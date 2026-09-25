# Implementación del Portafolio Financiero v2

**Fecha:** 25 de septiembre de 2026  
**Alcance:** página **Financiero**, sincronización corporativa y modelo de lectura multianual.

## Resultado

La página financiera dejó de depender de contratos creados manualmente para explicar facturación. Ahora utiliza dos dominios sincronizados desde el mismo libro corporativo: `Artefactos_proyectos` para cartera, costos y margen; y `Artefactos_facturacion` para hitos, fechas planificadas, fechas de factura, importes, monedas y equivalente `EN_USD` calculado por la fuente.

La interfaz muestra explícitamente la ventana analizada, ofrece filtros por año y rango personalizado, permite comparar con el período anterior o con el mismo período del año anterior, y presenta rankings de clientes, evolución temporal, sobrecostos, brechas de margen y detalle paginado por proyecto o servicio.

## Fuentes y trazabilidad

| Fuente | Uso | Regla |
|---|---|---|
| `financial_data` | Valor de venta, presupuesto, utilizado, costo y margen proyectado | Sólo filas con `sourceActive = true` forman la cartera vigente. Las filas retiradas se conservan como historia. |
| `financial_billing_item` | Hitos y facturación histórica | Cada fila tiene una clave SHA-256 determinista; una nueva corrida actualiza sin duplicar. |
| `financial_sync_batch` | Auditoría de sincronización | Registra hash del workbook, cobertura, insertados, actualizados, inactivados y período facturado. |
| `projects` / `recurring_services` | Estado operacional | Un ítem es abierto sólo si aparece activo o pausado en alguno de estos universos. |

La sincronización aplica ambas hojas en **una sola transacción**. Si falla cualquier escritura, no se confirma el lote. No se eliminan filas ausentes del workbook: se marcan inactivas para conservar trazabilidad.

## Semántica financiera

**Abierto** significa que existe un proyecto PMO o servicio recurrente activo/pausado asociado al Deal. **Cerrado** significa que existe cerrado o que no figura en el universo operacional abierto. Las iniciativas internas se separan de la cartera comercial.

La facturación se reconoce sólo cuando la hoja corporativa informa `Estado Facturacion = FACTURADO` y una fecha de factura válida. Un hito aceptado no se transforma en factura. Los montos UF, USD y otras monedas permanecen separados. El ranking comparable usa únicamente `EN_USD` provisto por la fuente; no aplica tipos de cambio inventados.

Los valores ausentes se muestran como **N/D**, no como cero. “Vencido no facturado” es una señal operativa basada en fecha planificada y no equivale a una factura SII.

## Carga real certificada

La corrida aplicada el 25 de septiembre de 2026 produjo:

| Métrica | Resultado |
|---|---:|
| Ítems financieros vigentes | 43 |
| Filas históricas conservadas e inactivadas | 3 |
| Hitos financieros vigentes | 306 |
| Período con facturación real | 16-jun-2023 a 21-sep-2026 |
| Hitos con fecha de factura | 253 |
| Hitos con equivalente USD comparable | 305 |
| Universo abierto | 5 |
| Universo no abierto | 38, compuesto por 34 cerrados y 4 iniciativas internas |

El preflight posterior mostró **0 inserciones y 0 inactivaciones pendientes**, con 43 ítems y 306 hitos reconocidos, demostrando idempotencia sin ejecutar una segunda escritura.

## Lectura 2026 YTD validada

Para la ventana 1-ene-2026 a 25-sep-2026, la interfaz mostró facturación comparable de **US$776.307**, compuesta en moneda nativa por **UF 15.134,9 y USD 174.000**. El cliente líder fue **Tanner**, con **US$293.694**, equivalente al **37,8%** de la facturación comparable. La cartera comercial vigente fue **UF 106.320,91**.

También se validó 2025 completo: **US$1.597.021** de facturación comparable y **Banco BICE** como cliente líder con **US$433.417**, demostrando que el ranking cambia con la ventana temporal seleccionada.

## Casos de control

- **Tanner / Deal1934:** abierto por PMO, facturación histórica UF 7.380 y datos de costo/margen visibles.
- **CCLA / Deal4728:** abierto por PMO, valores financieros y cinco hitos cargados; se conserva la moneda informada por la fuente.
- **MaxAgro / Deal4532:** cerrado, facturación histórica UF 552 visible; ya no aparece vacío.
- **Ruta Pass / Deal1996:** cerrado y clasificado fuera del universo abierto.
- **Camanchaca / Deal2383:** abierto mediante servicio recurrente y facturación histórica visible.
- **Iniciativas Prodigio:** separadas como inversión interna, fuera de cartera comercial.

## Navegación

`/admin/finance` es la única vista financiera del menú. La URL heredada `/admin/financial-consolidated` redirige a la nueva página para mantener compatibilidad con marcadores existentes. La tabla de escritorio dispone de paginación; en móvil se reemplaza por tarjetas legibles sin exigir desplazamiento horizontal.

## Guardrails

La página consume sólo el read model local sincronizado. No consulta Google, Jira o JSM en cada render. La integración Jira/JSM continúa GET-only y este cambio no realiza ninguna escritura externa. La migración es aditiva y existe un respaldo previo de las tablas financieras.
