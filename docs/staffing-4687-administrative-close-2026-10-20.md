# Staffing Deal 4687 — resolución canónica y cierre administrativo

## Identificación y autorización

Servicio PMO **2040001**, Consalud, `Deal 4687_Servicio Staffing`. El usuario solicitó el 20-10-2026 resolver el hito duplicado y cerrar el servicio. Base previa: checkpoint `f6d95f1f`, rama `feat/recurring-management-dashboard-v2`, referencias HEAD/origin/main/user_github/main alineadas y árbol limpio. Bloque de datos guardado en checkpoint **db65051d**.

## Qué se resolvió

La lectura Jira completa encontró dos M01 con el mismo título `Deal 4687_H1_Mes 1`. **CONSALOP01-23** es el original, creado el 08-05-2026: conserva una adjunción, un comentario y dos vínculos. **CONSALOP01-20** fue creado el 28-09-2026 y conserva una adjunción, sin comentarios ni vínculos en el corte. El read model previo elegía -20 por desempate de clave, al no haber binding local persistido. Esa selección automática no constituía una decisión de negocio ni probaba emisión de factura.

Se guardaron vínculos explícitos de las tres cuotas: **M01 → CONSALOP01-23**, **M02 → CONSALOP01-21**, **M03 → CONSALOP01-22**. La lectura PMO posterior muestra **3 hitos, 0 grupos duplicados y 3 estados de facturación N/D**. El registro -20 **no se borró, archivó ni editó en Jira**; quedó fuera de la selección canónica de PMO. Así se preservan ambas evidencias externas y no se suma ni se vuelve a inferir automáticamente el candidato duplicado. Los tres tickets artificiales PMO previamente descartados continúan excluidos.

## Cierre registrado

Una transacción local respaldada marcó el servicio `status=completado`, `currentStage=cierre` y cerró administrativamente las etapas Ejecución/Cierre. La terminación administrativa se registró el **20-10-2026, 16:36:48 hora de Chile** (`2026-10-20T19:36:48.879Z`). El término contractual permanece **27-07-2026**, sin prórroga ni modificación retroactiva.

La metadata de Ejecución/Cierre conserva `closureMode=administrative`, motivo explícito, fecha, usuario admin autorizado, bindings canónicos y pendientes de evidencia. El registro de auditoría es **12480001**, acción `administrative_close_staffing_4687`; se verificó exactamente una auditoría. La segunda ejecución del script devolvió `already_closed`, sin nuevas escrituras.

Cerrar las etapas administrativas **no marcó completado ningún ítem del plan** ni acreditó prestación, entrega, aceptación o factura. La pantalla de Cierre declara expresamente la naturaleza administrativa y las evidencias pendientes.

## Preservación y límites

- Tres cuotas originales **UF 160**, total **UF 480**, con mismos IDs, fechas, moneda, estado local y número de factura; sólo se agregaron bindings y notas de decisión.
- Plan Staffing de 12 controles, documentos y decisiones canónicas, evidencia de reportes/financiera, multas y SLA locales: comparación previa/posterior íntegra sin cambios.
- Inicialización, Plan de trabajo y JSM Setup: datos y fechas históricas intactos.
- Jira/JSM: únicamente lecturas; **cero creaciones, ediciones, eliminaciones o transiciones**.
- Finanzas históricas/planilla corporativa/CRM: sin escrituras ni conciliación o conversión de monedas.
- Staffing: SLA de incidentes, DR y 24×7 **No aplica**. Cero reglas SLA locales, sin nuevas multas inventadas.
- Facturación operacional: **3/3 N/D** porque Jira no aporta un estado explícito de emisión. Esto no equivale a cero facturado, deuda acreditada o ausencia de mora. La emisión y las evidencias de worklog, reportes, aceptación y NPS quedan como regularización documental independiente del lifecycle cerrado.

## Respaldo y ejecución

Respaldo selectivo privado con PMO y los cuatro issues Jira: `/home/ubuntu/backups/prodigio-pmo/2026-10-20-staffing-4687-closure/before.json`; resultado `/home/ubuntu/backups/prodigio-pmo/2026-10-20-staffing-4687-closure/after.json`. Directorio `700`, archivos `600`. SHA-256 del respaldo previo: **3a82491767aa9c483f84509bae830b33181bc072f6aff6edbd1d17008b548213**, verificado antes y después.

Script reproducible: `scripts/closeStaffing4687.ts`. Por defecto es dry-run; la aplicación exige `--apply`, identidad/contrato y estado previo exactos, propietario admin, checksum, fingerprint PMO/Jira, lectura completa y bloqueo transaccional de ficha/etapas/cuotas. No debe usarse para cerrar otros servicios ni para restaurar un respaldo sobre la aplicación. No repetir trabajo aplicado para forzar publicaciones.

## Validación final

**1.142 pruebas aprobadas, 20 omitidas; 161 archivos aprobados**, suite determinista con concurrencia acotada y prueba live UF externa excluida como en la base anterior. Build productivo exitoso. `pnpm check` conserva exactamente **cinco errores TypeScript heredados**: cuatro en `server/jiraMilestoneSync.ts` y uno `estadoSII` en `server/routers.ts`. Ningún error adicional de esta implementación.

Regresiones: original M01 preservado mediante binding explícito, duplicado externo no eliminado, idempotencia, no alteración de cuotas, cierre administrativo sin aceptación/factura inventada, N/D financiero y separación de monedas. `git diff --check` y escaneo de secretos sin hallazgos. Preview autenticada confirmó servicio Completado, etapas cerradas, panel de tres hitos únicos y pantalla de Cierre administrativo con motivo, fecha real y N/D. Se corrigió también la fecha contractual date-only para que no retroceda un día por zona horaria.

La verificación de interfaz corresponde a **preview autenticada**; el checkpoint final debe publicarse para incorporar esa presentación al dominio productivo. Los cambios de datos ya están aplicados en la base PMO.
