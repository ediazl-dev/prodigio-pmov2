# Reformulación financiera del Dashboard Ejecutivo v2

**Fecha:** 22 de septiembre de 2026  
**Autor:** Manus AI  
**Alcance:** Eje 01 — Hitos y Eje 02 — Impacto financiero

## Resultado

El Dashboard Ejecutivo v2 ahora presenta una vista financiera del proyecto basada en evidencia persistida. El **Eje 01** conserva el avance cardinal por actas, pero agrega el monto contractual y la procedencia de cada hito. El **Eje 02** separa valor contratado, costos, margen, devengo, facturación tributaria, cobros y capacidad. La implementación no convierte hitos aceptados en facturas ni suma monedas distintas.[1] [2]

## Regla de lectura del Eje 01

El monto de un hito se resuelve con una jerarquía determinista. Primero se usa el monto directo del calendario financiero. Si ese dato no existe, se usa el valor de venta en UF multiplicado por el peso contractual del hito. Cuando el campo numérico de peso está vacío o contiene cero, el motor puede recuperar un porcentaje explícito escrito en el título, por ejemplo `(20%)`. Si no existe una base monetaria o un peso verificable, el monto queda en **N/D**.[1]

La métrica de avance continúa siendo cardinal: un hito suma cumplimiento sólo cuando existe un acta de aceptación válida. El monto muestra exposición contractual y no modifica el porcentaje de avance. Tampoco acredita facturación ni cobro.

| Campo mostrado por hito | Regla |
|---|---|
| Monto directo | Importe registrado en el calendario financiero del hito |
| Venta × peso | Valor contratado en UF multiplicado por el peso contractual |
| Peso del campo | Porcentaje persistido en la fuente contractual |
| Peso del título | Porcentaje explícito recuperado desde el nombre del hito |
| N/D | Falta monto directo o falta una base válida para calcularlo |

## Vista financiera del Eje 02

El Eje 02 se denomina **Finanzas del proyecto — costos, margen y ciclo de caja**. Sus tarjetas distinguen métricas que antes aparecían resumidas o ausentes.

| Métrica | Significado y fuente |
|---|---|
| Valor contratado | Venta sincronizada por Deal; si no existe, contrato financiero UF |
| Costo consumido | `financial_data.utilizadoUF` |
| Presupuesto de costo | `financial_data.presupuestoUF` |
| Costo proyectado | `financial_data.proyectadoUF` |
| Margen proyectado | Valor contratado menos costo proyectado |
| Devengado | Eventos de devengo del contrato hasta el corte |
| Facturado (SII) | Sólo facturas emitidas o aceptadas |
| Cobrado | Pagos registrados |
| Cuentas por cobrar | Facturado menos cobrado |
| WIP | Devengado todavía no facturado |
| Backlog contractual | Contratado todavía no devengado |
| Capacity utilizado | Carga consumida valorizada |
| Capacity planificado | Carga futura planificada |
| Capacity proyectado | Utilizado más planificado |
| Otros costos | Se muestra sólo cuando la fuente los informa; de otro modo queda N/D |
| Valor de hitos aceptados | Suma contractual de hitos con acta; no equivale a facturación |

El embudo de facturación reutiliza las reglas financieras existentes: sólo contratos en UF participan del consolidado ejecutivo. Los contratos de otras monedas no se convierten ni se suman. Los valores no disponibles se mantienen como **N/D** y los ceros se muestran sólo cuando existe evidencia de cero.[2]

## Casos certificados

### PMO-2670001 — CCLA SRP MVP1 Deal 4728

El dashboard muestra **UF 6.533,33** de valor contratado. Los cinco hitos comerciales de 20% quedan valorizados en **UF 1.306,67** cada uno; el hito de preparación conserva 0% y **UF 0,00**. El costo consumido es **UF 708,98**, el presupuesto de costo es **UF 2.255,00**, el costo proyectado es **UF 3.544,90** y el margen proyectado es **UF 2.988,43**. No existen eventos de devengo, facturas SII ni pagos persistidos, por lo que devengado, facturado y cobrado se muestran en **UF 0,00**. El backlog contractual es **UF 6.533,33**.

### PMO-180002 — Banco Tanner, Deal 1934

El dashboard mantiene **UF 8.200,00** contratados y los diez montos directos de su calendario financiero. El costo consumido es **UF 2.378,17**, el presupuesto de costo es **UF 2.050,00**, el costo proyectado es **UF 5.169,94** y el margen proyectado es **UF 3.030,06**. El contrato registra **UF 3.690,00** devengados, **UF 0,00** facturados y **UF 0,00** cobrados. Por ello, WIP es **UF 3.690,00** y backlog contractual es **UF 4.510,00**. El valor contractual de los ocho hitos aceptados es **UF 6.970,00**; esta cifra no se presenta como factura.

### PMO-510001 — Staffing Consalud, Deal 4687

Este proyecto tiene baseline ejecutivo, pero no posee evidencia financiera ni contrato enlazado. El Eje 01 muestra **N/D** en los nueve montos de hitos. El Eje 02 mantiene **N/D** en contratado, costos, margen, devengado, facturado, cobrado y backlog. Una advertencia explica que los hitos cerrados no reemplazan el contrato, las facturas ni los pagos ausentes.

## Guardrails

La implementación mantiene cinco controles no negociables. **No suma monedas distintas. No denomina facturado a un hito aceptado. No infiere otros costos. No reemplaza N/D por cero. No altera Jira, facturas, pagos ni datos financieros durante la lectura.**

El endpoint del Dashboard Ejecutivo carga todas las fuentes en paralelo y produce un read model de sólo lectura. La interfaz muestra la fuente y el corte de los datos financieros. Los cálculos quedan cubiertos por pruebas de monto directo, venta por peso, porcentaje recuperado desde el título, ausencia de base y contrato no UF.[1] [3]

## Validación

La certificación focal aprobó **39 pruebas** del read model financiero, motor de facturación, perspectivas derivadas y matriz de aceptación del Dashboard Ejecutivo. La suite determinista completa aprobó **878 pruebas** en 119 archivos; se excluyeron únicamente cuatro integraciones live externas. El build productivo finalizó correctamente. CCLA y Tanner fueron revisados en preview autenticado; el Gantt muestra nombres y montos legibles en escritorio. Las capturas móviles de 390 px confirmaron que el contenido queda contenido y las tarjetas financieras se apilan sin introducir una suma multimoneda.

## References

[1]: ../server/executiveProjectFinance.ts "Read model financiero ejecutivo por proyecto"
[2]: ../server/financialEngine.ts "Motor determinista del embudo financiero"
[3]: ../client/src/pages/stages/ExecutiveFinancialAxis.tsx "Componente del Eje 02 financiero"
