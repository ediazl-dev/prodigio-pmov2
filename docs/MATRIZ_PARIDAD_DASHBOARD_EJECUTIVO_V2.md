# Matriz de paridad — Dashboard Ejecutivo v2 · Tanner

**Versión de trabajo:** corte observado del 18 de agosto de 2026.  
**Objeto:** ruta `/projects/180002/executive-dashboard-v2`.  
**Criterio rector:** el avance ejecutivo se calcula por cardinalidad de hitos con acta aceptada; los pesos comerciales, Jira y las fuentes financieras no sustituyen evidencia contractual.

> Esta matriz compara la jerarquía funcional de la maqueta aprobada con la implementación. No transforma ausencias de evidencia en datos: los valores sin fuente permanecen como `[PENDIENTE]` o `[POR CONFIRMAR]`.

## Fuentes de contraste

| Clave | Fuente | Uso en la comprobación |
|---|---|---|
| R-01 | `dashboard-ejecutivo-pmo-v2-layout_1.html` | Maqueta aprobada de jerarquía, zonas, bloques enriquecidos y vistas derivadas. |
| R-02 | `PROMPT-rediseno-dashboard-ejecutivo-pmo-v2.md` | Reglas de gobierno, batería de aceptación T-01 a T-20 y restricciones de evidencia. |
| I-01 | `client/src/pages/stages/ExecutiveDashboardV2.tsx` | Composición productiva y semántica renderizada. |
| T-01 | `server/executiveDashboardV2.acceptance.test.ts` | Contratos estáticos de orden, contenido y guardrails visuales. |
| T-02 | `server/executiveDashboardV2.accessibility.test.ts` | Foco, semántica, contraste, movimiento reducido y adaptación. |
| T-03 | `server/executiveGovernanceEngine.test.ts` | Matriz determinista T-01 a T-20, curva comercial y aceptación cardinal. |
| E-01 | Sesión OAuth autenticada de Tanner, 18-ago-2026 | Inspección de cabecera, hitos, remediación, señales, documental y perspectivas. |

## Paridad de jerarquía y zonas

| Zona de la maqueta | Implementación verificable | Evidencia de contrato y sesión | Estado |
|---|---|---|---|
| Barra grafito, fuente y retorno al proyecto | `edv2-topbar`, breadcrumb de Tanner y enlace a `/projects/180002` | I-01; E-01 | Verificado |
| Dictamen, sello y fuentes | Hero contractual con estado único, IGE, gatillos, SoW, Jira no gobernante, Deal y corte observado | T-01: estado único; T-03: estado y gatillos; E-01: `CRÍTICO`, G-01 y G-02 | Verificado |
| Cobertura de gobierno | Cinco indicadores: actas, exigibles, vencidos, minutas y finanzas | I-01; E-01: `0/10`, `6/10`, `6`, minutas pendientes y `financial_sync` | Verificado |
| 00 · Observación agéntica | Veredicto persistido, revisión PMO/Admin y rechazo con fundamento | I-01; router y T-01 de roles; E-01: ID 720001 en estado pendiente | Verificado |
| 01 · Cumplimiento cardinal | CHC-T, CHC-G, Esperado-G, vencidos, DRC, Gantt M01–M10 y tabla de evidencia | T-03: aceptación cardinal; E-01: 0% CHC-T, 0% CHC-G, 60% esperado y 10 hitos | Verificado |
| 02 · Impacto | CV, CPI-H, EAC en banda, daño total, puente, descalce, facturación aceptada y UF retenidas | T-01: puente y descalce; I-01: fuente/pending explícitos | Verificado |
| 03 · Exigencias | Lista de exigencias y formulario Admin/PMO con dueño, fecha, criterio y evidencia | I-01; router y T-01 de roles; E-01: estado sin exigencias persistidas | Verificado |
| 03B · PRD, descargos y escalamiento | Rúbrica PRD, marcador/SLA, cuatro descargos al PM y tabla D-01 a D-03 | T-01: rúbrica, preguntas y tabla; E-01: tarjetas y filas visibles | Verificado |
| 04 · Señales secundarias | Jira/backlog, riesgos/gatillos y capacity/stop-loss en detalles colapsados y desaturados | T-01: tres paneles y regla no-gobernante; E-01: 56%, 2 gatillos y capacidad pendiente | Verificado |
| 05 · Minutas y compromisos | Evidencia de minutas, cobertura semanal, brecha, recibidas sin revisión, preclasificación y coherencia narrativa | I-01; T-01: rótulos y regla de revisión; E-01: `0/1`, `0%`, W34 faltante y coherencia `[PENDIENTE]` | Verificado |
| 06 · Vistas derivadas | Pestañas CFO, Comercial y CTO con panel tabulado y restricciones de gobierno por audiencia | I-01; T-01: rótulos y roles ARIA; prueba de render de los tres paneles; E-01: pestañas abiertas | Verificado |
| 07 · Trazabilidad | Fuentes, procedencia, corte y guardrails de evidencia | I-01; E-01 | Verificado |

## Bloques funcionales enriquecidos

| Bloque | Requisito observable | Implementación actual | Evidencia disponible | Pendiente exacto |
|---|---|---|---|---|
| PRD | Rúbrica, regla de aprobación, SLA y sin puntaje inventado | Siete criterios, umbral de 75 puntos, marca de 72 h y estado pendiente | T-01 e inspección E-01 | Ninguno |
| Descargos | Preguntas accionables asignadas al PM | Cuatro preguntas con numeración y respuesta escrita de Eduardo | T-01 e inspección E-01 | Ninguno |
| Escalamiento | Decisiones, alternativas, impacto y fecha | Tabla D-01, D-02 y D-03; datos no disponibles en `[POR CONFIRMAR]` | T-01 e inspección E-01 | Ninguno |
| Minutas y cobertura | Semanas exigibles, recibidas/revisadas, brecha y coherencia sin mejora automática | Motor de cobertura y tarjeta documental con datos reales/pending | I-01, pruebas de cobertura y E-01: `0/1`, `0%`, W34 y narrativa pendiente | Ninguno |
| Señales secundarias | Diagnóstico detallado, no gobernante y no jerárquico | Tres paneles colapsados y matriz tabular de lectura, procedencia y límite | T-01, prueba de matriz enriquecida e inspección E-01 | Ninguno |

## Vistas derivadas

| Vista | Contenido mínimo de implementación | Guardrail visible | Evidencia actual | Pendiente |
|---|---|---|---|---|
| CFO | CV, CPI-H, EAC en banda, daño/puente y exposición UF | No pronóstico puntual sin insumos financieros | Panel compartido inspeccionado; prueba de render | Ninguno |
| Comercial | Facturación aceptada, descalce, UF retenidas y decisión comercial | Pesos comerciales no acreditan avance | Panel compartido inspeccionado; prueba de render | Ninguno |
| CTO | Vínculos Jira, vencidos, backlog y riesgos técnicos | Jira no acredita aceptación ni mejora estado | Panel compartido inspeccionado; prueba de render | Ninguno |

## Trazabilidad de las decisiones de paridad

La estructura, los textos de guardrail y el orden de las zonas están asegurados por pruebas estáticas, pruebas de render y observación autenticada. La condición de cierre requiere que cada fila mantenga evidencia contractual, visual y de regresión sin modificar métricas reales de Tanner ni cambiar el motor cardinal.
