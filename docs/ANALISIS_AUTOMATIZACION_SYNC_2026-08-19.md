# Análisis de automatización de la sincronización financiera — 2026-08-19

## Restricción técnica identificada
El script `scripts/sync_financial_data.py` depende de:
1. `gws` CLI para exportar la planilla desde Google Drive (sólo disponible en el sandbox de Manus, NO en el servidor de producción).
2. `pymysql` y `openpyxl` (Python) — el servidor de producción es Node.js, no tiene Python ni estas librerías.

Por lo tanto, el script NO puede ejecutarse directamente como Heartbeat job en el servidor de producción.

## Estado del proyecto
- Heartbeat SDK: server/_core/heartbeat.ts EXISTE (6784 bytes).
- SDK reconoce cron: NO (grep isCron/taskUid/CRON_OPEN_ID_PREFIX = 0 coincidencias). Requiere parche de legacy (sección 5c del skill webdev-periodic-updates).
- Crons existentes: 0 (manus-heartbeat list vacío).
- Función de BD disponible: upsertFinancialData en server/db.ts (línea 1641) — hace UPSERT por dealId.
- Acceso a Google Sheets desde el servidor: NO existe (sin googleapis ni integración).

## Opciones viables

### Opción A — Tarea agéntica programada (manus-config schedule)
Un agente Manus se despierta periódicamente, exporta la planilla con gws y ejecuta el script Python en el sandbox.
- Pros: reutiliza el script exacto que ya validamos; sin cambios de código; sin deploy.
- Contras: consume créditos Manus por ejecución; el agente no tiene el contexto del proyecto (hay que darle las instrucciones completas en el prompt).
- Frecuencia recomendada: 1 vez al día (los datos financieros no cambian más seguido).

### Opción B — Heartbeat job en el servidor (webdev cron)
Reescribir la lógica de sincronización en TypeScript dentro del servidor, con acceso a Google Sheets vía API (requiere configurar credenciales de servicio de Google).
- Pros: gratis por ejecución; corre en producción; gestionable desde el panel de Schedules.
- Contras: requiere reescribir el script en TS, configurar credenciales de Google API (service account), parchear el SDK para cron, y redeploy. Esfuerzo alto.

## Recomendación
Opción A (tarea agéntica programada) — es la más rápida, reutiliza el script validado y no requiere cambios de código ni deploy. La frecuencia diaria es suficiente para datos financieros.
