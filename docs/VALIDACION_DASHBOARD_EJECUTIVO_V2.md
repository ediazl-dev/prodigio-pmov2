# Validación — Dashboard Ejecutivo v2 (Tanner)

## Alcance y estado

Este documento concentra la evidencia de cierre del piloto Tanner en la ruta `/projects/180002/executive-dashboard-v2`. La validación comprueba que el dashboard conserva el principio de gobierno aprobado: el avance contractual se deriva exclusivamente de la cardinalidad de hitos con acta de aceptación; Jira aporta señal operativa secundaria y no puede mejorar el estado.

| Control | Evidencia actual | Estado |
| --- | --- | --- |
| Base recuperable | Checkpoint `4ed43986` previo a esta ronda de validación | Conforme |
| Ruta publicada | `https://prodigio-pmo-neyq89tj.manus.space/projects/180002/executive-dashboard-v2` | Protegida por autenticación |
| Verificación visual externa | El 18-ago-2026 el visor abrió la ruta y mostró el estado de carga; al resolver sesión fue redirigido al acceso OAuth, sin credenciales de una cuenta autorizada | Limitada, no es un defecto funcional |
| Datos reales Tanner | No se alteraron datos ni se registraron actas, minutas, exigencias o valores financieros durante la validación | Conforme |

## Validación ejecutada

| Ámbito | Evidencia | Resultado |
| --- | --- | --- |
| Compilación estática | `pnpm exec tsc --noEmit` ejecutado el 18-ago-2026 después del último ajuste de interfaz | Sin errores de TypeScript |
| Regresión completa | `pnpm test` ejecutado el 18-ago-2026 | 49 archivos aprobados, 439 pruebas aprobadas y 3 pruebas live omitidas explícitamente |
| Motor y datos cardinales | Suites `executiveGovernanceEngine`, `executiveDashboardFixture`, `executiveMilestoneAcceptancePolicy` y `executiveFinancialEvidence` | Cubren cardinalidad, fixture Tanner, actas obligatorias y separación entre avance, exposición e impacto financiero |
| Gobierno documental y permisos | Suites `executiveMinutes`, `executiveMinutesCoverage`, `executiveRequirements`, `executiveRecoveryPlanPolicy` y `executiveVerdictReviewPolicy` | Cubren minuta revisable, cobertura semanal, exigencias evidenciadas, PRD versionado y revisión humana del veredicto |
| Señales Jira | Suite `executiveOperationalEvidence` y regla `secondary_penalty_only` | Jira conserva procedencia y sólo puede penalizar; no acredita aceptación ni mejora el estado |
| Accesibilidad estática | `pnpm vitest run server/executiveDashboardV2.accessibility.test.ts` | 4 de 4 pruebas aprobadas: navegación nombrada, pestañas con ARIA y flechas, foco visible y señales secundarias inicialmente colapsadas/desaturadas |

## Accesibilidad y paridad verificadas

La interfaz declara una navegación de secciones con nombre accesible y enlaces a cada zona. Las perspectivas CFO, Comercial y CTO utilizan el patrón `tablist`/`tab`/`tabpanel`, exponen su selección mediante `aria-selected` y permiten recorrer las pestañas con las flechas izquierda y derecha. Enlace, botón y pestaña poseen un foco visible de tres píxeles en el magenta corporativo. Las señales operativas se presentan con etiqueta textual **“no gobierna el estado”**, comienzan colapsadas y desaturadas, y no se usan como semáforo alternativo.

La estructura vigente conserva el dictamen único, el eje contractual cardinal, impacto financiero separado, exigencias, PRD, descargos, escalamiento, evidencia documental, señales secundarias, vistas derivadas y trazabilidad. Cuando una fuente no entrega evidencia verificable, la vista utiliza `[PENDIENTE]` o `[POR CONFIRMAR]`; no materializa cifras de ejemplo ni fechas supuestas.

## Limitación de revisión visual autenticada

La captura automatizada del entorno de desarrollo alcanzó el estado **“Cargando evidencia ejecutiva…”** antes de concluir la transición de autenticación. La misma sesión registró una respuesta válida de `auth.me` para el usuario administrador, pero el capturador no mantuvo la página abierta el tiempo suficiente para disparar la consulta dependiente de autenticación. La comprobación de composición publicada continúa limitada por OAuth, no por una exposición pública de información. Esta limitación queda documentada para que la inspección final de composición se realice con una sesión autenticada persistente, sin alterar datos reales de Tanner.
