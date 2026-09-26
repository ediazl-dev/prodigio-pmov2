# Dashboard gerencial Clásico de servicios recurrentes v2

**Fecha:** 26-sep-2026
**Base segura:** checkpoint `3a5a46e2`
**Rama:** `feat/recurring-management-dashboard-v2`
**Alcance:** lectura gerencial consolidada; no modifica datos financieros, servicios, Jira ni JSM.

## Objetivo

Responder directamente, por servicio y con fuente trazable:

- qué está programado contractualmente;
- qué fue facturado realmente en la fuente corporativa;
- en qué moneda ocurre cada hecho;
- qué diferencias impiden una comparación válida;
- qué cobertura existe para incidentes y SLA;
- qué entregables, documentos y multas requieren acción.

## Cambios implementados

### 1. Modelo financiero no destructivo

La reconciliación conserva dos identidades separadas:

| Identidad | Campos principales | Fuente |
|---|---|---|
| Programación | `expectedAmount`, `expectedCurrency`, `expectedDueDate` | Plan recurrente local |
| Factura real | `invoiceAmount`, `invoiceCurrency`, `invoiceDate`, `invoiceSource` | `financial_billing_items` |

Una factura corporativa ya no reemplaza el monto ni la moneda del plan. Los estados visibles incluyen coincidencia, diferencia de moneda, diferencia de monto, ambigüedad y ausencia de factura verificada. Un estado local histórico `pagado` se conserva sólo como compatibilidad y nunca se presenta como cobro.

### 2. Read model gerencial

`server/recurringManagementDashboard.ts` agrega:

- resumen de servicios, facturas verificadas y excepciones;
- montos por moneda sin conversión implícita;
- contribución por servicio al esperado y al facturado;
- SLA configurado, JSM vinculado, muestra medida y cumplimiento;
- entregables, documentos y multas por servicio;
- excepciones con impacto y acción recomendada;
- cortes separados de fuente financiera, JSM y documentación.

### 3. Período y filtros

El procedimiento `recurringServices.dashboardV2` acepta:

- `cutOffDate`;
- `fromDate`;
- cliente;
- tipo de servicio;
- estado;
- `onlyExceptions`.

La UI ofrece mes actual, últimos tres meses, año a la fecha, contrato completo y rango personalizado. La comparación mensual/acumulada se calcula sin mezclar monedas. El filtro “Sólo excepciones” restringe todo el universo desde el servidor.

### 4. Nueva vista Clásico

Orden de lectura:

1. cabecera con filtros y cortes de fuente;
2. respuesta explícita sobre facturación USD;
3. indicadores inmediatos de cartera;
4. finanzas por moneda y servicio;
5. esperado versus facturado real, mensual o acumulado;
6. embudo SLA;
7. evolución del stock de tickets;
8. entregables, formalidad y multas;
9. excepciones con impacto y acción;
10. evidencia consolidada;
11. resumen final expandible por servicio.

El consolidado de Finanzas, Entregables, Formalidad y Operación JSM permanece exclusivamente en Clásico. Torre V2 no vuelve a renderizarlo.

## Lectura real al 26-sep-2026

| Pregunta | Resultado verificable |
|---|---|
| Servicios activos | 3 |
| Servicios con factura corporativa | 1/3 |
| Facturación USD real | **USD 0** |
| Facturación UF real | **UF 282**; Camanchaca Deal 2383, tres facturas de UF 94 |
| Programación USD al corte | USD 1.152 |
| Programación USD futura | USD 1.062 |
| Diferencia Camanchaca | Programación local USD 282 al corte y USD 282 futura; factura real UF 282 |
| Brecha comparable USD | USD 870, sólo Consalud Deals 4687 y 4727; Camanchaca queda excluido por moneda distinta |
| SLA configurado | 3/3 servicios |
| JSM vinculado | 1/3 servicios |
| SLA medible | 0/3; cumplimiento N/D |
| Camanchaca | 32 abiertos, 3 altos y 14 con más de 30 días |
| Entregables | 15 planificados, 15 sin fecha exigible |
| Documentos | presencia 3/3; validación 0/3; 6 documentos presentes y no validados |
| Multas | 0 registros |

## Guardrails aplicados

- No se suman UF y USD.
- No se convierte moneda sin una política aprobada y fechada.
- Camanchaca nunca recibe un porcentaje comparable entre USD y UF.
- Facturado real exige factura corporativa verificada.
- El ciclo recurrente termina en Facturado; no muestra Cobrado, Pagado ni CxC.
- Los snapshots JSM se presentan como stock; no se afirma flujo mensual de tickets resueltos.
- Reglas SLA, vínculo JSM, muestra medida y cumplimiento son etapas distintas.
- Un denominador cero produce N/D, no 0 %.
- Presencia documental no equivale a validación.
- Entregables sin fecha se presentan como brecha de planificación.
- El render usa datos locales persistidos; no consulta ni modifica Jira/JSM durante la carga.

## Validación ejecutada

- Read model real de sólo lectura: Camanchaca 2383, Consalud 4687 y 4727.
- Pruebas focales backend/UI: 32 aprobadas.
- Suite determinista integral: 1.030 pruebas aprobadas y 19 omitidas; se excluyó únicamente `server/ufService.test.ts` porque valida un servicio externo cuyo token respondió código `-5`.
- Build productivo: exitoso.
- TypeScript: sin regresiones nuevas; permanecen cinco errores heredados en `jiraMilestoneSync.ts` y `routers.ts`.
- Navegador autenticado:
  - USD 0 real y servicios programados en USD;
  - UF 282 atribuido a Camanchaca;
  - cambio mensual/acumulado;
  - filtro por Camanchaca aplicado a toda la vista;
  - embudo SLA 3/3 → 1/3 → 0/3 → N/D;
  - escritorio 1440 px y móvil 390 px sin desbordamiento horizontal detectado.

## Archivos principales

- `server/recurringBillingReconciliation.ts`
- `server/recurringServicesMetricsEngine.ts`
- `server/recurringServicesDashboardV2.ts`
- `server/recurringManagementDashboard.ts`
- `server/recurringServicesDb.ts`
- `server/recurringServicesRouter.ts`
- `client/src/pages/RecurringServicesList.tsx`
- `client/src/pages/recurring/classicManagementViewModel.ts`
- `client/src/pages/recurring/ClassicManagementDashboard.tsx`
