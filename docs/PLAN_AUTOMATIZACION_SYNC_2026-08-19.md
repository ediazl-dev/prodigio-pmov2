# Plan de automatización de la sincronización financiera (Opción B — Heartbeat en el servidor)

## Viabilidad confirmada
- GOOGLE_DRIVE_TOKEN del entorno descarga la planilla vía API de Drive (HTTP 200, 2.022.643 bytes).
- xlsx@0.18.5 y exceljs@4.4.0 ya instalados en el proyecto (Node.js).
- upsertFinancialData y bulkUpsertFinancialData existen en server/db.ts (líneas 1641-1656).
- server/_core/heartbeat.ts existe (SDK Heartbeat).
- manus-heartbeat CLI disponible; 0 crons existentes.
- FIELD_MAP replicado del script Python validado (37 Deals, 0 errores).

## Componentes a implementar
1. Parche legacy del SDK (sección 5c del skill webdev-periodic-updates):
   - manusTypes.ts: añadir taskUid?: string | null a GetUserInfoWithJwtResponse.
   - sdk.ts: añadir CRON_OPEN_ID_PREFIX, AuthenticatedUser, buildCronUser, short-circuit en authenticateRequest.
2. server/financialSync.ts (nuevo): descarga XLSX vía Drive API con GOOGLE_DRIVE_TOKEN, parsea hoja Artefactos_proyectos con xlsx, aplica FIELD_MAP, valida duplicados/vacíos, UPSERT vía bulkUpsertFinancialData.
3. Handler Express POST /api/scheduled/syncFinancial en server/_core/index.ts: autentica con sdk.authenticateRequest, exige user.isCron, ejecuta la sincronización, devuelve JSON con resultado; try/catch con 500 JSON.
4. Secret GOOGLE_DRIVE_TOKEN inyectado al entorno de producción vía webdev_request_secrets.
5. Checkpoint + deploy (auto-publicado).
6. Crear el cron con manus-heartbeat create (diario, 6-field UTC) apuntando a /api/scheduled/syncFinancial.
7. Verificar con manus-heartbeat logs tras la primera ejecución.

## Controles
- Handler idempotente (UPSERT por dealId).
- Rechaza workbook vacío y Deal IDs duplicados.
- Timeout del handler: 2 minutos (la descarga + parseo + 37 UPSERTs caben).
- No expone tokens en logs.
