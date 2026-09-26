# Baseline — ciclo financiero recurrente y evidencia de multas

**Fecha:** 26-sep-2026  
**Base:** `6655652d` (`origin/main` y `user_github/main` alineados)  
**Rama:** `fix/recurring-invoiced-penalty-evidence`

## Diagnóstico

El concepto **Cobrado/Pagado** no es un texto aislado. Está modelado en cinco capas del módulo de servicios recurrentes:

1. El enum histórico de `recurring_service_billing_months.status` admite `pagado`.
2. Los motores `recurringServicesMetricsEngine` y `recurringServicesDashboardV2` calculan `collected` y cuentas por cobrar.
3. `recurringServicesRouter` devuelve `paid`, `billingPaid`, `billingProgress` y utiliza pagos en prompts IA.
4. El listado, detalle, ejecución y paneles de evidencia presentan Cobrado, Pagado, CxC o Avance de cobro.
5. Las pruebas fijan esa semántica como contrato.

La información de pago no está disponible como fuente corporativa confiable para servicios recurrentes. Por ello el ciclo visible y analítico debe terminar en **Facturado**. Un estado histórico `pagado`, si apareciera, se interpretará únicamente como compatibilidad de una cuota ya facturada; nunca como evidencia de cobro.

## Datos reales antes del cambio

- `recurring_service_billing_months`: 15 filas, todas `pendiente`.
- `recurring_service_financial_evidence`: 0 filas; no existe evidencia de pagos.
- `recurring_service_penalties`: 0 filas.
- Respaldo cifrado por permisos de archivo y con huella SHA-256 disponible fuera del repositorio en `/home/ubuntu/backups/recurring-finance-penalties-2026-09-25/snapshot.json`.

## Diseño aprobado por el requerimiento

### Ciclo financiero recurrente

- Estados de negocio visibles: **Programado → Facturado**.
- Métricas: contratado, programado, facturado, pendiente de facturar y vencido sin facturar.
- Se eliminan de vistas, read models y prompts: Cobrado, Pagado, CxC, pendiente de cobro y avance de cobro.
- La fuente financiera corporativa de facturas tiene precedencia para el monto facturado; el plan local conserva programación y vencimientos.
- No se borran columnas o estados históricos de inmediato: se conserva compatibilidad de lectura para no romper registros existentes.

### Multas

Cada multa tendrá fecha, descripción, monto opcional, moneda, estado y un archivo probatorio opcional para compatibilidad con registros anteriores. Las nuevas cargas desde el detalle exigirán archivo y usarán almacenamiento S3; la base guardará sólo clave, URL y metadatos. La lectura estará disponible para todos los perfiles autenticados y la creación/cambio de estado seguirá restringida a Admin/PMO.

La captura de multas del detalle y del cierre reutilizará el mismo endpoint y el mismo modelo. No se crearán dos repositorios de multas.
