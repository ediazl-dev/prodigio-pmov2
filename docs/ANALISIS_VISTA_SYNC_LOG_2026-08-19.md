# Análisis — Vista de historial de sincronización financiera + fecha en Dashboard v2
Fecha: 2026-08-19

## Objetivo (aprobado por el usuario)
1. Vista de administración con el historial de sincronizaciones financieras (registro persistente de cada ejecución del cron).
2. Mostrar fecha/hora de la última sincronización en el Dashboard Ejecutivo v2.

## Estructura actual verificada

### Esquema Drizzle (drizzle/schema.ts)
- Última tabla: recurringServiceAiAnalyses (termina con createdAt timestamp defaultNow).
- Patrón de tabla: mysqlTable con columnas, luego export type X = typeof tabla.$inferSelect y InsertX = typeof tabla.$inferInsert.
- Importar desde "drizzle-orm/mysql-core": mysqlTable, int, varchar, text, timestamp, mysqlEnum, etc.

### Rutas admin (client/src/App.tsx)
- Imports líneas 19-27: AdminUsers, AdminFinance, AdminTemplates, AdminSettings, AdminDeadlines, ComplianceReport, AdminAuditLog, JiraSpacesPage, AdminJiraToken.
- AdminGuard (línea 44): restringe a role==="admin".
- Rutas admin líneas 76-94: /admin/users, /admin/finance, /admin/templates, /admin/deadlines, /admin/compliance, /admin/audit, /admin/jira-spaces, /admin/jira-token, /admin/settings.
- NUEVA RUTA a añadir: /admin/financial-sync con AdminGuard.

### Menú admin (client/src/components/DashboardLayout.tsx)
- adminMenuItems líneas 80-90: Usuarios, Financiero, Plazos por Etapa, Cumplimiento, Auditoría, Spaces JIRA, Plantillas, Token JIRA, Configuración.
- Iconos importados de lucide-react. Añadir: { icon: RefreshCw, label: "Sincronización Financiera", path: "/admin/financial-sync" } (verificar que RefreshCw esté importado).

### Estilos admin (client/src/pages/admin/adminStyles.ts)
- Exporta: C (paleta), headerGradient, cardStyle, headerKpiCard, headerKpiLabel, headerKpiValue, thStyle, tdStyle, footerStyle, footerText.
- Paleta C: blue #1B4F8A, blue2 #2563AB, accent #e91e8c, teal #0D7A6B, teal2 #12A08D, gold #B8860B, gold2 #D4A017, red #B83232, green #1A7A4A, g200, g400.
- Página de referencia: AdminAuditLog.tsx usa estos estilos + componentes shadcn (Button, Input, Badge, Select, Dialog, Separator) + iconos lucide.

### Dashboard Ejecutivo v2 (client/src/pages/stages/ExecutiveDashboardV2.tsx)
- Query: trpc.advance.getExecutiveDashboardV2.useQuery({ projectId }, { retry: false, enabled: ... }) línea 132.
- Procedure server/routers.ts línea 3806: getExecutiveDashboardV2 (protectedProcedure, input projectId + cutoffDate opcional).
- Return final (líneas 3937-3971): { project, source, cutoff, contractual, commercialExposure, financial, financialEvidence, governance, agenticVerdict, operationalEvidence, financialAlerts, financialContext }.
- AÑADIR al return: financialSync: { lastSyncAt, lastSyncStatus } consultando la nueva tabla financial_sync_log (la más reciente).
- El componente mostrará la fecha/hora de última sincronización (formateada es-CL) en el encabezado o cerca del bloque financiero.

## Plan de implementación (6 fases)
1. Tabla financial_sync_log: id, status (applied/error), inputDeals, insertCount, updateCount, errorMessage (nullable), triggeredBy (cron/manual), createdAt. Migración vía drizzle-kit generate + webdev_execute_sql.
2. financialSync.ts: registrar cada ejecución (éxito y error) en el log.
3. routers.ts: procedure admin listFinancialSyncLogs (paginado) + incluir última sync en getExecutiveDashboardV2.
4. Vista admin AdminFinancialSync.tsx (tabla con fecha, estado, deals, mensaje) + ruta + menú.
5. ExecutiveDashboardV2.tsx: mostrar fecha/hora de última sincronización.
6. Validar TypeScript + pruebas + checkpoint.

## Notas
- El cron financial-sync-daily (task_uid koZvKFb8FE7TZ6hy8GAnvM) corre 03:00 UTC. Cada ejecución debe quedar registrada.
- Consistencia visual: usar adminStyles (C, cardStyle, thStyle, tdStyle) como las demás vistas admin.

---

## PROGRESO DE IMPLEMENTACIÓN (actualizado)

### ✅ Fase 2 — Tabla creada
- drizzle/schema.ts: tabla financialSyncLogs (financial_sync_log) añadida al final. Columnas: id, status enum(applied,error), inputDeals, insertCount, updateCount, errorMessage text nullable, triggeredBy varchar(20) default 'cron', createdAt timestamp defaultNow.
- Migración drizzle/0032_slow_paladin.sql generada y aplicada vía webdev_execute_sql.
- Registro histórico insertado: id=1, applied, 37 inputDeals, 0 insert, 37 update, triggeredBy=manual, createdAt=2026-08-19 12:18:01.

### ✅ Fase 3 (parcial) — Logging + helpers + procedures
- server/financialSync.ts: runFinancialSync renombrada a runFinancialSyncInternal; nuevo wrapper exportado runFinancialSync que registra éxito (applied con inputDeals/insert/update) y error (error con errorMessage) vía logSyncExecution (nunca lanza, triggeredBy='cron').
- server/db.ts: helpers añadidos al final: getFinancialSyncLogs(limit=50) y getLatestFinancialSync(). Usan import dinámico de financialSyncLogs y desc(createdAt).
- server/routers.ts: import ampliado con getFinancialSyncLogs, getLatestFinancialSync (junto a getFinancialDataSyncInfo). financialRouter: añadidos syncLogs (adminOnly, input limit opcional) y latestSync (protectedProcedure, devuelve row o null).
- TypeScript: 0 errores tras cada cambio.

### ⏳ Pendiente
- Fase 4: Vista admin AdminFinancialSync.tsx + ruta /admin/financial-sync en App.tsx (AdminGuard) + entrada en adminMenuItems de DashboardLayout.tsx (icono RefreshCw, label "Sincronización Financiera"). Usar adminStyles (C, cardStyle, thStyle, tdStyle, headerGradient) como AdminAuditLog. Query: trpc.financial.syncLogs.useQuery({limit:100}). Columnas: Fecha (es-CL con hora), Estado (Badge applied=verde/error=rojo), Deals leídos, Insertados, Actualizados, Origen (triggeredBy), Mensaje de error.
- Fase 5: ExecutiveDashboardV2.tsx — mostrar fecha/hora última sync. Query: trpc.financial.latestSync.useQuery(). Formato es-CL con hora. Ubicación: encabezado o bloque financiero.
- Fase 6: Validar tsc + vitest + checkpoint.

### ✅ Fase 4 (parcial) — Vista admin creada y ruta registrada
- client/src/pages/admin/AdminFinancialSync.tsx CREADO. Patrón visual replicado de AdminAuditLog: headerGradient navy + badge ADMINISTRACIÓN + icono RefreshCw + título "Sincronización Financiera", 3 KPI cards (última sync, exitosas, con error), tabla con thStyle/tdStyle. Columnas: Fecha y Hora (formatDateTime es-CL con segundos), Estado (statusBadge: applied=verde "Exitosa"/error=rojo "Error"), Deals leídos, Insertados (verde), Actualizados (azul), Origen (originLabel: cron="Automática (cron)"/manual="Manual"), Mensaje de error (rojo con title tooltip, "-" si null). Query: trpc.financial.syncLogs.useQuery({limit:100}). Imports de adminStyles: C, headerGradient, cardStyle, thStyle, tdStyle, badgeStyle. Iconos lucide: RefreshCw, CheckCircle2, XCircle, Clock, Database. TypeScript 0 errores.
- client/src/App.tsx: import AdminFinancialSync añadido tras AdminJiraToken (línea ~27). Ruta añadida tras /admin/jira-token: <Route path="/admin/financial-sync">{() => <AdminGuard><AdminFinancialSync /></AdminGuard>}</Route>. TypeScript 0 errores.

### ⏳ Pendiente inmediato
1. Añadir entrada en adminMenuItems de DashboardLayout.tsx: icono RefreshCw, label "Sincronización Financiera", path /admin/financial-sync. Verificar que RefreshCw esté importado de lucide-react en DashboardLayout.
2. Fase 5: ExecutiveDashboardV2.tsx — query trpc.financial.latestSync.useQuery() y mostrar fecha/hora última sync (formato es-CL con hora). Ubicación: encabezado o bloque financiero del dashboard.
3. Fase 6: Validar tsc + vitest focal + checkpoint.
