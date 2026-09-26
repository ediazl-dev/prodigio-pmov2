# Servicios recurrentes: ciclo hasta Facturado y evidencia de multas

**Fecha:** 26-sep-2026  
**Checkpoint base:** `6655652d`  
**Rama:** `fix/recurring-invoiced-penalty-evidence`

## Decisión funcional

El ciclo financiero de Servicios Recurrentes termina en **Facturado**. El módulo no presenta ni calcula `Cobrado`, `Pagado`, cuentas por cobrar ni avance de cobro, porque esa evidencia no está disponible.

El valor histórico `pagado` se mantiene sólo como compatibilidad interna de datos y se interpreta como **facturado**. La API ya no permite asignarlo a nuevas cuotas y ninguna interfaz lo expone.

## Fuentes

- Programación local: `recurring_service_billing_months`.
- Facturación real: `financial_billing_items` sincronizado desde `Artefactos_facturacion`.
- Vinculación: Deal explícito o Deal detectado en el nombre del servicio mediante el helper financiero común.
- Multas: `recurring_service_penalties` con evidencia almacenada en S3 y metadatos persistidos en base de datos.

No se suman monedas distintas ni se infieren pagos.

## Reconciliación financiera

El reconciliador puro `server/recurringBillingReconciliation.ts`:

1. resuelve el Deal del servicio;
2. busca hitos corporativos facturados;
3. vincula por número mensual y, como contingencia, por fecha;
4. marca la cuota como `facturado` y conserva la evidencia corporativa;
5. normaliza `pagado` histórico a `facturado`;
6. no crea montos de cobro ni CxC.

La misma fuente se usa en listado, detalle, dashboard v2, ejecución y análisis IA.

## Evidencia de multas

La migración `0051_crazy_marten_broadcloak.sql` agrega a `recurring_service_penalties`:

- fecha de multa;
- nombre, URL, clave S3, MIME y tamaño del archivo;
- hash SHA-256;
- usuario y fecha de carga.

El panel del detalle permite:

- registrar fecha, descripción, monto y moneda;
- adjuntar PDF, PNG, JPG, DOCX o XLSX de hasta 10 MB;
- descargar la evidencia;
- reemplazar evidencia;
- cambiar estado a aplicada o disputada.

La lectura está disponible para usuarios autenticados. La creación, carga y cambio de estado quedan en Admin/PMO, consistentes con el módulo recurrente.

## Validación real

Al corte 26-sep-2026:

- Camanchaca, Deal 2383: tres cuotas reconciliadas como facturadas por **UF 282** total.
- La programación local remanente conserva tres cuotas USD pendientes; la pantalla las mantiene separadas y advierte el conflicto de moneda.
- Staffing Deal 4687: USD 480 pendientes de facturar, tres cuotas vencidas.
- Staffing Deal 4727: USD 1.170 pendientes de facturar, dos cuotas vencidas por USD 390.
- El read model serializado no contiene `collected`, `accountsReceivable`, `totalPaid` ni `billingPaid`.

## Certificación

- 83 pruebas focales deterministas aprobadas en el checkpoint funcional.
- Suite determinista integral: **954 pruebas aprobadas, 19 omitidas**; se excluyeron las cuatro suites externas conocidas.
- Validación visual autenticada de listado y detalle de Camanchaca en escritorio y móvil.
- Build productivo exitoso.
- TypeScript conserva exactamente cinco errores heredados: cuatro en `server/jiraMilestoneSync.ts` y uno en `server/routers.ts`; no se agregaron errores nuevos.
- Jira/JSM no recibió escrituras.
