# Dashboard gerencial Clásico de servicios recurrentes v2

**Fecha:** 26-sep-2026
**Base segura de la corrección:** checkpoint `96834e39`
**Rama:** `feat/recurring-management-dashboard-v2`
**Alcance:** lectura gerencial consolidada y corrección auditada de la moneda contractual de tres servicios; no modifica montos, fechas, estados, Jira ni JSM.

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
| Registro corporativo facturado | `invoiceAmount`, `invoiceCurrency`, `invoiceDate`, `invoiceSource` | `financial_billing_items` |

Un registro corporativo ya no reemplaza el monto ni la moneda del plan. Los estados visibles incluyen coincidencia, diferencia de moneda, diferencia de monto, ambigüedad y ausencia de un registro marcado Facturado. Un estado local histórico `pagado` se conserva sólo como compatibilidad y nunca se presenta como cobro.

### 2. Read model gerencial

`server/recurringManagementDashboard.ts` agrega:

- resumen de servicios, registros corporativos facturados y excepciones;
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
5. esperado versus facturación registrada, mensual o acumulada;
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
| Servicios con registro corporativo facturado | 1/3 |
| Facturación USD registrada | **USD 0** |
| Programación contractual USD | **USD 0** |
| Facturación UF registrada | **UF 282**; Camanchaca Deal 2383, tres registros de UF 94 marcados Facturado |
| Programación UF al corte | **UF 1.152** |
| Programación UF futura | **UF 1.062** |
| Conciliación Camanchaca | UF 282 esperado al corte y UF 282 registrado como facturado; conciliado, sin diferencia de moneda |
| Brecha comparable UF | **UF 870**, correspondiente a Consalud Deals 4687 y 4727 sin registro corporativo facturado vinculado |
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
- Una diferencia de moneda bloquea porcentajes hasta corregir la fuente o aprobar una conversión explícita.
- La UI usa “facturación registrada en la fuente corporativa”; `financial_billing_items` no se presenta como factura SII.
- El ciclo recurrente termina en Facturado; no muestra Cobrado, Pagado ni CxC.
- Los snapshots JSM se presentan como stock; no se afirma flujo mensual de tickets resueltos.
- Reglas SLA, vínculo JSM, muestra medida y cumplimiento son etapas distintas.
- Un denominador cero produce N/D, no 0 %.
- Presencia documental no equivale a validación.
- Entregables sin fecha se presentan como brecha de planificación.
- El render usa datos locales persistidos; no consulta ni modifica Jira/JSM durante la carga.

## Validación ejecutada

- Respaldo previo: 3 fichas, 15 cuotas, 6 registros corporativos y referencias financieras.
- Corrección transaccional: 3 fichas y 15 cuotas cambiadas exclusivamente de USD a UF; montos, fechas y estados preservados.
- Read model real: UF 1.152 al corte, UF 1.062 futura, UF 282 registrada como facturada y UF 870 sin registro corporativo facturado.
- Pruebas focales backend/UI y guardrails de moneda: 36 aprobadas.
- Suite determinista integral: 1.034 pruebas aprobadas y 19 omitidas; se excluyó únicamente `server/ufService.test.ts` porque valida un servicio externo cuyo token respondió código `-5`.
- Build productivo: exitoso.
- TypeScript: sin regresiones nuevas; permanecen cinco errores heredados en `jiraMilestoneSync.ts` y `routers.ts`.
- Navegador autenticado:
  - USD 0 registrado y USD 0 programado contractualmente;
  - UF 282 registrado y atribuido a Camanchaca;
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
