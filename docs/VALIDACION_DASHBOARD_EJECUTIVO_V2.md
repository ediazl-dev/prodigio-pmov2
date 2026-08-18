# Validación — Dashboard Ejecutivo v2 (Tanner)

## Alcance y estado

Este documento concentra la evidencia de cierre del piloto Tanner en la ruta `/projects/180002/executive-dashboard-v2`. La validación comprueba que el dashboard conserva el principio de gobierno aprobado: el avance contractual se deriva exclusivamente de la cardinalidad de hitos con acta de aceptación; Jira aporta señal operativa secundaria y no puede mejorar el estado.

| Control | Evidencia actual | Estado |
| --- | --- | --- |
| Base recuperable | Checkpoint `4ed43986` previo a esta ronda de validación | Conforme |
| Ruta publicada | `https://prodigio-pmo-neyq89tj.manus.space/projects/180002/executive-dashboard-v2` | Protegida por autenticación |
| Verificación visual automatizada aislada | La captura de desarrollo a 1280 px mostró `Cargando evidencia ejecutiva…` porque su contexto independiente no porta la cookie OAuth; la sesión autenticada sí fue verificada mediante navegador | Limitada por aislamiento de sesión, no es un defecto funcional |
| Datos reales Tanner | No se alteraron datos ni se registraron actas, minutas, exigencias o valores financieros durante la validación | Conforme |

## Validación ejecutada

| Ámbito | Evidencia | Resultado |
| --- | --- | --- |
| Compilación estática | `pnpm exec tsc --noEmit` ejecutado el 18-ago-2026 después del último ajuste de interfaz | Sin errores de TypeScript |
| Regresión completa | `pnpm test` ejecutado el 18-ago-2026 después de la auditoría final | 51 archivos aprobados, 452 pruebas aprobadas y 3 pruebas live omitidas explícitamente |
| Motor y datos cardinales | Suites `executiveGovernanceEngine`, `executiveDashboardFixture`, `executiveMilestoneAcceptancePolicy` y `executiveFinancialEvidence` | Cubren cardinalidad, fixture Tanner, actas obligatorias y separación entre avance, exposición e impacto financiero |
| Gobierno documental y permisos | Suites `executiveMinutes`, `executiveMinutesCoverage`, `executiveRequirements`, `executiveRecoveryPlanPolicy` y `executiveVerdictReviewPolicy` | Cubren minuta revisable, cobertura semanal, exigencias evidenciadas, PRD versionado y revisión humana del veredicto |
| Señales Jira | Suite `executiveOperationalEvidence` y regla `secondary_penalty_only` | Jira conserva procedencia y sólo puede penalizar; no acredita aceptación ni mejora el estado |
| Accesibilidad estática | `pnpm vitest run server/executiveDashboardV2.accessibility.test.ts` | 7 de 7 pruebas aprobadas: navegación nombrada, pestañas con ARIA y flechas, foco visible, señales secundarias inicialmente colapsadas/desaturadas, reducción de movimiento, reglas adaptativas y contraste |

## Accesibilidad y paridad verificadas

La interfaz declara una navegación de secciones con nombre accesible y enlaces a cada zona. Las perspectivas CFO, Comercial y CTO utilizan el patrón `tablist`/`tab`/`tabpanel`, exponen su selección mediante `aria-selected` y permiten recorrer las pestañas con las flechas izquierda y derecha. Enlace, botón y pestaña poseen un foco visible de tres píxeles en el magenta corporativo. Las señales operativas se presentan con etiqueta textual **“no gobierna el estado”**, comienzan colapsadas y desaturadas, y no se usan como semáforo alternativo.

La estructura vigente conserva el dictamen único, el eje contractual cardinal, impacto financiero separado, exigencias, PRD, descargos, escalamiento, evidencia documental, señales secundarias, vistas derivadas y trazabilidad. Cuando una fuente no entrega evidencia verificable, la vista utiliza `[PENDIENTE]` o `[POR CONFIRMAR]`; no materializa cifras de ejemplo ni fechas supuestas.

## Revisión visual autenticada — 18-ago-2026

Con la sesión OAuth autorizada, la ruta publicada cargó la evidencia completa del piloto Tanner. La vista verificó correctamente el dictamen **CRÍTICO**, el avance cardinal **0/10**, los diez hitos `M01`–`M10`, las fuentes SoW v6 / Jira PBTISD1 / Deal1934 y la regla visible de no-gobierno para Jira. También quedaron visibles los controles restringidos de actas, exigencias, minutas, PRD, revisión humana de observación agéntica y las perspectivas derivadas CFO, Comercial y CTO.

La composición confirma la barra grafito autónoma, el hero de gobierno, el sello único, los indicadores contractuales, la navegación por anclas y las señales secundarias colapsadas. Se detectó una brecha de jerarquía antes del cierre: el panel de **preclasificación documental** se renderiza por encima de la barra principal, cuando debe quedar contenido dentro de la zona documental/minutas para preservar el orden de lectura de la maqueta aprobada. Esta observación no altera datos del proyecto y se corrige antes de declarar la paridad final.

Después de reubicar el panel, la revisión autenticada en desarrollo confirmó que la primera región visible inicia con la barra grafito, el hero contractual y la navegación de secciones. El control de **Preclasificar compromisos antes de registrarlos** ahora aparece después de la zona de minutas y antes de las perspectivas derivadas, por lo que ya no interrumpe la jerarquía ejecutiva inicial.

La navegación por teclado fue comprobada sobre la sesión cargada: `Tab` alcanzó el enlace **Proyectos** con un anillo de foco claramente visible; la lista de pestañas de perspectivas aceptó foco y `ArrowRight` cambió desde **Perspectiva CFO** a **Dirección Comercial**, actualizando el contenido derivado. Los resúmenes de señales secundarias permanecieron contraídos inicialmente y los formularios, tablas y pestañas conservaron nombres accesibles en el árbol de la página. La paleta usada mantiene contraste fuerte entre grafito/papel y los estados de foco visibles; los estados de semáforo se acompañan siempre de texto, no sólo de color.

## Matriz de paridad bloque a bloque

| Bloque aprobado | Evidencia implementada y verificada | Control asociado |
| --- | --- | --- |
| Gobierno contractual | Barra autónoma, dictamen, sello único, CHC-T/CHC-G/Esperado-G, hitos M01–M10 y actas | `executiveGovernanceEngine`, `executiveMilestoneAcceptancePolicy`, matriz de aceptación |
| Impacto y exposición | Daño por desviación separado del descalce de facturación; los valores ausentes conservan `[POR CONFIRMAR]` | `executiveFinancialEvidence`, matriz de aceptación |
| Exigencias y remediación | Exigencias evidenciadas, pauta/PRD, descargos y escalamiento sin fechas o datos inventados | `executiveRequirements`, `executiveRecoveryPlanPolicy`, matriz de aceptación |
| Evidencia documental | Minutas, compromisos, cobertura semanal y preclasificación manual dentro del flujo documental | `executiveMinutes`, `executiveMinutesCoverage`, prueba de orden estructural |
| Señales secundarias | Jira/backlog colapsado, desaturado y con etiqueta permanente **“no gobierna el estado”** | `executiveOperationalEvidence`, `executiveDashboardV2.accessibility` |
| Perspectivas derivadas | CFO, Comercial y CTO como pestañas ARIA; cada lectura muestra una decisión requerida y conserva los faltantes como pendientes | `executiveDashboardV2.parity`, matriz de aceptación y recorrido autenticado con teclado |
| Trazabilidad | Fuentes SoW/Jira/finanzas, corte, revisión de veredicto y versiones de PRD | consulta `getExecutiveDashboardV2` y suites de políticas de gobierno |

La prueba `executiveDashboardV2.acceptance.test.ts` fija el orden `veredicto → hitos → finanzas → exigencias → operación → minutas → preclasificación → perspectivas → trazabilidad`, la separación de cardinalidad y pesos, los rótulos de evidencia ausente, el bloque secundario de Jira y las vistas ricas derivadas. Esta prueba impide que una futura modificación reintroduzca la preclasificación antes del hero o convierta la señal operativa en un indicador de gobierno.

## Matriz de permisos y evidencia

| Perfil o condición | Lectura del tablero | Acciones permitidas en el contrato del servidor | Barrera comprobada |
| --- | --- | --- | --- |
| Usuario autenticado (`admin`, `pmo`, `pm`, `consulta`) | Sí, para el piloto Tanner habilitado | Consulta `getExecutiveDashboardV2` | `protectedProcedure` y restricción del piloto |
| `admin` / `pmo` | Sí | Registrar minuta y acta; crear/cerrar exigencia con evidencia; registrar PRD; validar o rechazar observación agéntica | `adminOrPmo` en cada mutación; políticas focales aprobadas |
| Gerente de Delivery asignado | Sí | Anular una exigencia abierta con motivo y aprobar un PRD evidenciado | Verificación del rol de asignación `delivery_manager` antes de persistir |
| `pm` / `consulta` sin asignación Delivery | Sí | Sin mutaciones de gobierno en esta vista | No satisfacen `adminOrPmo` ni la asignación `delivery_manager` |

El 18-ago-2026 se ejecutaron las cinco suites focales de evidencia y gobierno: **11 pruebas aprobadas** para minutas, actas, exigencias, PRD y revisión de veredictos. Además, la matriz de aceptación estática comprobó que las ocho mutaciones sensibles permanecen vinculadas a `adminOrPmo` o validan expresamente la asignación `delivery_manager`.

## Auditoría de accesibilidad verificable

| Criterio | Evidencia | Resultado |
| --- | --- | --- |
| Semántica de regiones y contenido | Sesión autenticada: región principal presente; 28 encabezados jerárquicos; `tablist`, tres `tab` y un `tabpanel` activo | Conforme |
| Teclado y foco | `Tab` alcanzó el enlace inicial con anillo visible; `ArrowRight` activó Dirección Comercial desde CFO | Conforme |
| Estados y controles | Pestañas comunican selección con ARIA; Jira inicia contraído; semáforo y fuentes incluyen texto, no sólo color | Conforme |
| Foco visible | Regla CSS para enlaces, botones y pestañas con contorno de 3 px | Conforme |
| Contraste | Prueba numérica: texto grafito/papel y gris/papel ≥ 4,5:1; anillo magenta/papel ≥ 3:1 | Conforme |
| Movimiento reducido | Media query `prefers-reduced-motion: reduce` que suprime transiciones y animaciones no esenciales; prueba estática de regresión | Conforme |

La evidencia manual autenticada se limita al recorrido de escritorio disponible; no se declararon alteraciones de datos reales durante la comprobación. La validación responsiva y de contraste se fija también mediante las reglas adaptativas y los tokens cromáticos de la interfaz, y permanece visible como control de regresión en las pruebas de accesibilidad y paridad.
