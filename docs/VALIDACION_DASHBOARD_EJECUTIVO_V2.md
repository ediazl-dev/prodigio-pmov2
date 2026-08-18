# Validación — Dashboard Ejecutivo v2 (Tanner)

## Alcance y estado

Este documento concentra la evidencia de cierre del piloto Tanner en la ruta `/projects/180002/executive-dashboard-v2`. La validación comprueba que el dashboard conserva el principio de gobierno aprobado: el avance contractual se deriva exclusivamente de la cardinalidad de hitos con acta de aceptación; Jira aporta señal operativa secundaria y no puede mejorar el estado.

| Control | Evidencia actual | Estado |
| --- | --- | --- |
| Base recuperable | Checkpoint `4ed43986` previo a esta ronda de validación | Conforme |
| Ruta publicada | `https://prodigio-pmo-neyq89tj.manus.space/projects/180002/executive-dashboard-v2` | Protegida por autenticación |
| Verificación visual automatizada aislada | La captura de desarrollo a 1280 px mostró `Cargando evidencia ejecutiva…` porque su contexto independiente no porta la cookie OAuth; la sesión autenticada sí fue verificada mediante navegador | Limitada por aislamiento de sesión, no es un defecto funcional |
| Datos reales Tanner | No se alteraron datos ni se registraron actas, minutas, exigencias o valores financieros durante la validación | Conforme |

## Carga documental directa — verificación autenticada

El 18-ago-2026, la sesión autenticada de Tanner mostró controles de archivo y no campos de URL manual en los tres flujos definidos para evidencia ejecutiva. El formulario de actas exige **“Acta de aceptación (PDF, máx. 25 MB)”**; el registro de minutas exige **“Documento de minuta (PDF o DOCX, máx. 25 MB)”**; y el registro de PRD exige **“Documento PRD (PDF o DOCX, máx. 25 MB)”**. Los campos asociados de nombre son de sólo lectura y se completan después de la validación del archivo.

No se cargó evidencia de prueba ni se modificó Tanner durante esta comprobación. El contrato técnico valida extensión, MIME, firma y tamaño; una carga aislada se audita como pendiente de registro y no modifica por sí misma la aceptación contractual, la cobertura de minutas ni la vigencia del PRD.

## Validación ejecutada

| Ámbito | Evidencia | Resultado |
| --- | --- | --- |
| Compilación estática | `pnpm exec tsc --noEmit` ejecutado el 18-ago-2026 después del último ajuste de interfaz | Sin errores de TypeScript |
| Regresión completa | `pnpm test` ejecutado el 18-ago-2026 después de ampliar las reglas formales de gobierno | 51 archivos aprobados, 458 pruebas aprobadas y 3 pruebas live omitidas explícitamente |
| Motor y datos cardinales | Suites `executiveGovernanceEngine`, `executiveDashboardFixture`, `executiveMilestoneAcceptancePolicy` y `executiveFinancialEvidence` | Cubren cardinalidad, fixture Tanner, actas obligatorias y separación entre avance, exposición e impacto financiero |
| Reglas formales de gobierno | Casos R-01, R-02, R-05, R-06 y R-11 a R-13 en `executiveGovernanceEngine.test.ts` | Jira no mejora un crítico; una entrega sin acta no acredita avance; el acta recalcula contrato/exposición; la curva comercial queda aislada y G-07 no aplica con cumplimiento total |
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

## Matriz formal del motor — corte Tanner 17-ago-2026

La suite `executiveGovernanceEngine.test.ts` materializa los casos **T-01 a T-20** con una entrada determinista y aislada del proyecto productivo. Los casos T-01 a T-18 comprueban `CHC-T 33,33%`, `CHC-G 20,00%`, `Esperado-G 60,00%`, cuatro vencidos abiertos, tasa de incumplimiento `66,67%`, `SPI-H 0,33`, `EV 410,00 UF`, `CPI-H 0,1317`, costo por hito `1.557,00 UF`, `DRC 21 días`, la banda EAC `4.754,00–15.570,00 UF`, VAC `−2.704,00–−13.520,00 UF`, banda de margen `42,02%–−89,88%`, descalce `+25,00 pp`, UF retenidas `2.870,00`, sesgo Jira `+22,67 pp`, los gatillos G-01 a G-07 y el estado `CRÍTICO`.

El IGE interno de precisión es `14,67/100`; la presentación ejecutiva lo redondea a `15/100`, sin modificar el estado ni los gatillos. T-19 verifica que una curva declarada debe sumar exactamente `100,00` y rechaza un total de `105,00`. T-20 demuestra que los pesos comerciales no alteran `CHC-T` ni `CHC-G`. La banda EAC usa el cociente cardinal sin redondeo intermedio y sólo redondea la salida, evitando que una precisión truncada de CPI-H distorsione el extremo superior de la proyección.

La inspección autenticada del 18-ago-2026 muestra el **estado productivo real** sin actas registradas: `0/10` aceptados, `6/10` exigibles y seis vencidos abiertos. Esto no se sustituye por los valores del fixture y confirma que la ruta preserva la regla de no fabricación. El fixture del 17-ago-2026 existe exclusivamente en la suite de aceptación para reproducir los casos T-01 a T-20 sin escribir sobre Tanner.

Después de corregir la resolución del corte, la misma sesión autenticada muestra `Corte observado · 18 ago 2026`, `0/10` actas de aceptación, `6/10` hitos exigibles y seis vencidos abiertos. La etiqueta de fixture ya no se renderiza en la consulta productiva; sólo se conserva en las pruebas unitarias deterministas.

La inspección autenticada posterior confirma la jerarquía de gobierno y los encabezados enriquecidos: dictamen contractual, eje cardinal, impacto financiero, exigencias/remediación, señales secundarias, evidencia documental, coherencia narrativa, perspectivas y trazabilidad. El piloto muestra `0/10` actas y ninguna minuta o exigencia registrada; por ello, la coherencia narrativa permanece como `[PENDIENTE]` y no se genera relato, compromiso, aceptación ni proyección que no esté respaldada por evidencia real.

La verificación autenticada de la zona documental confirma que el bloque expone las semanas revisadas/exigibles, el porcentaje de cobertura, las minutas recibidas sin revisión, la brecha consecutiva y las semanas faltantes calculadas desde el baseline hasta el corte observado. Las minutas ausentes o recibidas sin revisión no mejoran la cobertura y se mantienen como evidencia pendiente.

La revisión autenticada posterior sobre la ruta de desarrollo confirmó la composición completa de la ruta de Tanner: barra de control, dictamen contractual, métricas cardinales, tabla M01–M10 con vínculos Jira expresamente no gobernantes, registro restringido de actas y controles de exigencias, minutas, PRD y perspectivas derivadas. En ese corte productivo se observaron `0/10` actas, `6/10` hitos exigibles, `6` vencidos abiertos y señal Jira `56%` únicamente como diagnóstico. La ruta resolvió la consulta después del estado transitorio de carga; no se registraron ni modificaron datos durante la inspección.

La inspección de las zonas inferiores comprobó la trazabilidad del corte —SoW v6 aprobado, Jira PBTISD1 como diagnóstico y finanzas `financial_sync`— junto con el bloque de PRD versionado. Al no existir un PRD real persistido, la interfaz lo señala como `[PENDIENTE]`, mantiene el formulario de registro de versión real y reserva la aprobación al Gerente de Delivery Ariel. La decisión requerida conserva explícitamente como pendientes WACC, dotación bloqueada, tarifa diaria y cláusula de penalidad; no se extrapola pérdida final.

En las vistas derivadas, la sesión autenticada mostró la perspectiva CFO con exposición de margen/caja basada en la información disponible y la perspectiva Comercial con facturación aceptada, descalce y UF retenidas sin declarar cumplimiento por cobro. Ambas conservan `[POR CONFIRMAR]` cuando la fuente financiera no aporta el valor necesario y reiteran que ninguna perspectiva altera el estado contractual.

La perspectiva CTO fue inspeccionada en la misma sesión: expone `10/10` hitos con issue Jira, `6` vencidos abiertos y confiabilidad de backlog como `[POR CONFIRMAR]`. Su restricción visible establece que una issue, épica o sprint no modifica por sí sola el estado de un hito contractual; la aceptación documentada sigue siendo el único gatillo de avance.

La navegación autenticada a **Exigencias** mostró directamente el estado `[PENDIENTE]` de las exigencias reales y del plan de recuperación, el formulario restringido para registrar una exigencia de comité y la sección **Remediación, descargos y escalamiento**. La pauta PRD renderiza sus siete rúbricas —causa raíz, contraparte, cronograma, recuperación financiera, dependencias, higiene de control y riesgos— con puntajes visibles y sin calificación fabricada. El marcador PRD conserva SLA de 72 horas hábiles y puntaje sugerido pendiente hasta contar con evidencia real.

En el mismo recorrido se comprobó visualmente el bloque de **Descargos requeridos al PM** con cuatro preguntas accionables y la tabla de **Escalamiento** destinada a Ariel. Esta última expone tres decisiones ricas: `D-01` re-baseline formal, `D-02` continuidad/stop-loss y `D-03` recuperación económica, cada una con alternativas, impacto y fecha explícitamente `[POR CONFIRMAR]` cuando no existe una decisión persistida. Debajo, las tres señales secundarias —Jira/backlog `56%`, riesgos y gatillos `2`, y capacidad/stop-loss `[POR CONFIRMAR]`— se verificaron como resúmenes colapsados, desaturados y rotulados de forma permanente como **“no gobierna el estado”**.

La evidencia autenticada posterior incorporó la **Matriz de señales secundarias y sus límites de gobierno** debajo de los tres resúmenes colapsados. La tabla muestra, para cada señal, lectura observada, procedencia y límite explícito: Jira `56% · 83/147` issues cerradas sólo puede penalizar; los gatillos `G-01` y `G-02` requieren análisis y dueño; y capacity/stop-loss se conserva como `[POR CONFIRMAR]` hasta contar con sincronización financiera. Ninguna fila acredita actas, CHC, IGE, estado, carry ni continuidad sin evidencia aprobada.

La prueba de render `executiveDashboardV2.derivedViews.render.test.ts` renderiza de forma aislada los tres paneles que usa la ruta productiva. Verifica el contenido mínimo de CFO —CV, CPI-H, daño total y guardrail de no extrapolar pérdida—, Comercial —facturación aceptada, descalce, UF retenidas y acta obligatoria— y CTO —hitos Jira vinculados, vencidos, confiabilidad pendiente y prohibición de acreditar avance con una issue. Junto con `executiveDashboardV2.acceptance.test.ts`, ambas suites aprobadas fijan la densidad y los límites visibles de la maqueta. La regresión integral posterior aprobó **52 archivos y 464 pruebas**, con tres pruebas live omitidas explícitamente.

En la sesión autenticada de desarrollo se confirmó el render de los paneles compartidos: **CFO** mostró CV `−2.113,57 UF`, CPI-H `0,00` y daño total `[POR CONFIRMAR]`, preservando la decisión de no extrapolar pérdida; **Dirección Comercial** mostró facturación aceptada `0%`, descalce `0,0 pp` y UF retenidas `[POR CONFIRMAR]`, con la restricción de no declarar fecha comercial aceptada sin contraparte, documento y evidencia vinculada al hito. La prueba de render cubre además la perspectiva CTO con su límite explícito de no acreditación por Jira.

La navegación autenticada a **Minutas** hizo visible el subbloque completo de cobertura documental: `0/1` semana cubierta desde kickoff, cobertura revisada `0%`, cero minutas recibidas sin revisión y semana faltante `2026-W34`. La tarjeta de coherencia narrativa quedó en `[PENDIENTE]` y declara que no construye un relato favorable ni causalidad sin una minuta real. Esta evidencia confirma que la ausencia documental permanece expuesta y no mejora la cobertura ni el dictamen.

La extracción directa del DOM autenticado registra los mismos valores de cobertura y además confirma el contrato de la matriz de señales: Jira/backlog `[SIN SNAPSHOT]` con procedencia `Jira PBTISD1 · [POR CONFIRMAR]` sólo penaliza y no acredita actas, CHC, IGE ni estado; los riesgos G-01/G-02 exigen análisis y dueño sin reemplazar evidencia contractual; y capacity/stop-loss queda `[POR CONFIRMAR]`, sin proyectar carry ni autorizar continuidad. En la misma extracción, la pestaña Comercial permaneció seleccionada mediante `aria-selected="true"`; CFO y CTO mantuvieron el contrato de pestañas accesible.

La inspección autenticada de **Perspectiva CTO** mostró `10/10` hitos con issue Jira, `6` vencidos abiertos y backlog confiable `[POR CONFIRMAR]`. Su restricción visible declara que una issue, épica o sprint no cambia por sí sola el estado del hito contractual y que la aceptación documentada conserva el único gatillo de avance. Con ello, las tres perspectivas derivadas tienen evidencia de interfaz y prueba de render sobre el mismo panel compartido.

## Navegación lateral y línea de tiempo contractual — 18-ago-2026

La sesión autenticada del piloto Tanner verificó el rail lateral con las anclas `00` a `07` y el enlace visible **«Volver al proyecto»** hacia `/projects/180002`. La prueba `executiveDashboardV2.accessibility.test.ts` fija el nombre accesible del rail, sus anclas y el retorno al detalle del proyecto.

La línea de tiempo **«baseline vs. real»** muestra los hitos `M01`–`M10`, sus fechas de compromiso y el estado real acreditado sólo cuando existe acta. En este corte, la fuente contractual no contiene fechas baseline persistidas para Tanner; por ello, cada baseline se mantiene como `[POR CONFIRMAR]` y no se sustituye con fixture ni se infiere desde Jira. Esta es una limitación de la fuente contractual, no una fecha omitida de la visualización.

La activación autenticada del enlace lateral **«Volver al proyecto»** navegó correctamente a `/projects/180002` y cargó el detalle del proyecto Tanner, donde quedan visibles los accesos al Dashboard Ejecutivo v2 y al dashboard heredado. La comprobación confirma que el rail no crea un callejón de navegación.

## Carga directa de evidencia documental — 18-ago-2026

La evidencia de minutas, actas de aceptación y versiones PRD se selecciona ahora desde los formularios del Dashboard Ejecutivo v2. El flujo sustituye el ingreso manual de URL por carga validada y exige una selección de archivo antes de permitir el registro formal de gobierno.

| Documento | Formatos admitidos | Límite | Validación previa | Efecto de cargar |
| --- | --- | ---: | --- | --- |
| Acta de aceptación | PDF | 25 MB | Extensión, MIME, firma PDF y SHA-256 | No acredita el hito hasta registrar fecha, vínculo y revisión autorizada. |
| Minuta | PDF o DOCX | 25 MB | Extensión, MIME, firma y SHA-256 | No crea compromisos ni mejora cobertura hasta revisión humana. |
| PRD | PDF o DOCX | 25 MB | Extensión, MIME, firma y SHA-256 | No aprueba ni vuelve vigente una versión; la aprobación sigue restringida a Delivery. |

La mutación `uploadExecutiveEvidence` sólo está disponible para Admin/PMO dentro del piloto Tanner. Almacena el archivo mediante el servicio de almacenamiento, registra auditoría con nombre, tipo, tamaño y hash SHA-256, y devuelve la referencia para que el formulario formal la vincule. La carga aislada no modifica cardinalidad, aceptación contractual, estado de minuta ni vigencia del PRD.

La validación focal aprobó 13 pruebas para el contrato de carga y aceptación. La regresión completa aprobó 469 pruebas, con 3 pruebas live omitidas explícitamente.
