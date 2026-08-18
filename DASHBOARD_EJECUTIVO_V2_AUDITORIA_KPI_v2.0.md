# Análisis profundo y backlog de implementación — Dashboard Ejecutivo v2

| Campo | Valor |
|---|---|
| Producto | **Prodigio** |
| Versión del documento | 2.0 — propuesta para aprobación, sin construcción iniciada |
| Alcance | Dashboard Ejecutivo de proyectos Delivery; piloto de validación: **Banco Tanner**, proyecto 180002, Deal 1934, Jira `PBTISD1` |
| Fecha de análisis | 18 de agosto de 2026 |
| Base de referencia | Prompt de rediseño v2.0 y maqueta HTML adjuntos por PMO |
| Estado | **F0: auditoría y diseño. No iniciar cambios funcionales hasta aprobación explícita.** |

## 1. Conclusión ejecutiva

> El piloto existente **no debe evolucionarse mediante ajustes cosméticos**. El problema es estructural: su modelo de avance usa la curva comercial de facturación (`billingWeight`) como ponderador y no registra las pruebas que exige el gobierno contractual —actas, aceptaciones, re-baselines, minutas, compromisos, exigencias, PRD ni snapshots de corte—. Por tanto, ni sus métricas ni su interfaz pueden demostrar el diseño solicitado.

La nueva entrega debe ser un **refactor mayor, incremental y trazable**, no una segunda versión visual de la tarjeta actual. El objetivo no es mostrar más KPI: es proporcionar una única lectura de gobierno que permita conocer, en menos de treinta segundos, **el incumplimiento contractual, su daño económico, la evidencia disponible y la obligación concreta de corregirlo**.

La corrección central es inequívoca: el avance se medirá por **cardinalidad de hitos aceptados**, no por porcentaje de facturación ni por avance de Jira. Los pesos y UF quedarán confinados a la métrica de exposición facturación–cumplimiento y al impacto económico; **no participarán nunca** en CHC, SPI-H, CPI-H, IGE ni semáforo.

## 2. Evidencia auditada

| Fuente revisada | Hecho comprobado | Implicancia |
|---|---|---|
| Prompt de rediseño v2.0 | Establece jerarquía contractual–documental–operativa, motor cardinal, IGE único, seis zonas y 50 verificaciones T/R/M/U. | Es la especificación de aceptación y prevalece sobre el piloto existente. |
| Maqueta HTML | Define barra grafito, dictamen editorial, sello, cobertura de evidencia, SLA, subnavegación, cinco KPI primarios, Gantt, zonas 2–6 y tipografías DM Sans / Instrument Serif / JetBrains Mono. | La composición debe reproducirse dentro de la ruta v2; no basta con conservar el shell y sustituir tarjetas. |
| `server/executiveDashboardV2.ts` | `progressPct = fulfilledWeight / totalWeight`; los pesos provienen de `billingWeight`. | El **45%** actual es ponderación comercial, no avance físico cardinal. Debe retirarse como KPI de cumplimiento. |
| `ExecutiveDashboardV2.tsx` | Renderiza cuatro tarjetas, tabla SoW–Jira y alertas financieras; no tiene zonas de evidencias, exigencias, PRD, minutas, vistas derivadas ni tooltips de auditabilidad. | La vista actual cubre una fracción menor del diseño requerido. Debe ser reemplazada por componentes de zonas. |
| Esquema actual | Tiene fuentes, baseline v6 y 10 filas en `executive_contract_milestones`; carece de fecha/acta de aceptación, entrega real, re-baseline inmutable, minutas, compromisos, exigencias, PRD y snapshot de corte. | Faltan las entidades para demostrar cumplimiento y gobernanza. |
| Datos Tanner persistidos | Baseline aprobada `v6`, 10 hitos, pesos de pago que suman 100; M01 (40%) y M02 (5%) figuran como cumplidos. | La aritmética heredada informa **45%** porque cuenta 45 de 100 puntos comerciales. No hay actas persistidas que permitan declarar esos hitos aceptados bajo el nuevo modelo. |
| Datos financieros persistidos | `presupuestoUF = 2.050`, `utilizadoUF = 2.113,572`, venta `8.200`; la última sincronización persistida observada es 6-abr-2026. | La vista no puede presentar estos números como verdad vigente al corte sin timestamp, snapshot y validación de frescura. |
| Router actual | Lee baseline y finanzas en tiempo de consulta, pero no conserva un snapshot completo por corte ni devuelve metadatos de auditoría por KPI. | Un veredicto no es reproducible: fuentes diferentes pueden cambiar entre aperturas. |

## 3. Inventario de los KPI que existen hoy

### 3.1 Vista ejecutiva heredada y etapa de Avance

| Indicador actual | Fórmula / lectura observada | Numerador y denominador | Fuente | Fecha / problema |
|---|---|---|---|---|
| Avance Jira | `issues resueltos / issues totales` | Backlog Jira conocido | Jira | El denominador puede variar; **no representa cumplimiento contractual**. |
| Hitos Jira | Hitos cumplidos y pendientes en Jira | Estados de `Hito PMO` | Jira | Un cierre Jira se muestra cerca del cumplimiento, sin requerir acta del cliente. |
| Uso de presupuesto | `utilizadoUF / presupuestoUF` | Ejecución y presupuesto | `financial_data` / fetcher | El timestamp no se publica de manera uniforme en la tarjeta. |
| Margen proyectado vs. target | Diferencia entre porcentajes financieros | Margen proyectado y target | Finanzas | Es un indicador financiero válido, pero no debe sustituir el estado contractual. |
| Tiempo consumido vs. avance real | Calendario vs. porcentaje Jira | Fechas del proyecto / issues | Proyecto + Jira | Eleva el AOJ al mismo plano que la evidencia contractual. |
| Semáforo / resumen IA | Heurística dependiente de datos Jira y análisis agéntico | No hay contrato único de resultado | Jira + LLM + finanzas | Puede divergir entre resumen, tarjetas y veredicto. |

### 3.2 Piloto `ExecutiveDashboardV2` actual

| Indicador actual | Fórmula exacta | Fuente | Diagnóstico |
|---|---|---|---|
| Avance contractual (45%) | `Σ billingWeight(fulfilled) / Σ billingWeight(total)` | Baseline SoW + estado semántico Jira | **Incorrecto para el rediseño.** Usa peso comercial; en Tanner equivale a 40% + 5%. |
| Alertas de hitos | `delayedCount + overduePendingCount` | Estado semántico + fechas Jira | Válido sólo como señal operativa, no como evidencia de aceptación. |
| Uso de presupuesto | `utilizadoUFPorc` | Finanzas | Debe exponerse con fuente, corte y validación aritmética. |
| Margen proyectado | `margenProyectadoPorc` | Finanzas | Debe integrarse al daño/EAC en banda y no ser una tarjeta aislada. |
| Semáforo | Rojo si atraso/vencimiento o 105% gasto; amarillo con gasto 90% o avance ponderado <50% | Motor actual + finanzas | No aplica IGE, gatillos absolutos ni precedencia. Jira puede alterar el semáforo de un modo no admitido por la nueva especificación. |

## 4. Inconsistencias y brechas que bloquean una entrega seria

| ID | Hallazgo | Evidencia | Decisión de corrección |
|---|---|---|---|
| D-01 | **Ponderación comercial usada como avance.** | Motor actual calcula `fulfilledWeight / totalWeight`; Tanner muestra 45%. | Sustituir por CHC-T y CHC-G cardinales. `peso_pct` y `valor_uf` se bloquearán estáticamente fuera de las funciones de cumplimiento. |
| D-02 | Entregado, aceptado y cerrado Jira se confunden. | El modelo sólo conserva `semanticStatus`. | Introducir estados contractuales y requerir `fecha_aceptacion + acta_aceptacion_url` para `ACEPTADO`. |
| D-03 | No existe denominador “exigible al corte”. | Se usa el total de pesos del baseline. | Implementar `COMPROMETIDOS(T)` con fecha estrictamente anterior al corte y exclusión del vencimiento del mismo día. |
| D-04 | Estado no gobernado por un único motor. | Motor heredado, datos Jira y veredictos pueden producir mensajes distintos. | Implementar IGE + gatillos absolutos + precedencia; toda vista recibe el mismo `estado_mostrado`. |
| D-05 | Datos financieros no están congelados por corte. | La tabla persistida observada tiene timestamp anterior; la API consulta en ejecución. | Persistir snapshot financiero con timestamp y tratar frescura insuficiente como `[POR CONFIRMAR]`. |
| D-06 | No existe evidencia documental. | No hay modelo de minutas ni compromisos. | Añadir carga segura, hash, OCR/extracción revisable, cadencia y TCC. |
| D-07 | El tablero no obliga acciones. | No hay exigencia, evidencia de cierre, SLA ni PRD. | Añadir exigencias, descargos, PRD y reglas de escalamiento. |
| D-08 | El veredicto no es inmutable ni citacional. | Existe historial genérico, no un contrato v2 ligado al snapshot. | Persistir veredicto versionado contra JSON Schema, con citas; bloquear contradicciones. |
| D-09 | La interfaz actual no corresponde a la referencia. | Cuatro tarjetas y tabla estándar frente a siete zonas y jerarquía editorial. | Reconstruir el contenido de la ruta v2 por zonas; no reutilizar las tarjetas actuales como diseño objetivo. |
| D-10 | El escenario de aceptación del prompt no coincide automáticamente con los datos persistidos. | El prompt usa un corte y códigos de prueba específicos; la baseline actual usa M01–M10 y no tiene actas registradas. | Cargar evidencia real con validación, y tratar las cifras T-01…T-20 como **fixture de prueba**, no como datos que se puedan mostrar sin registro. |

## 5. Modelo de gobierno aprobado para proponer

### 5.1 Jerarquía de evidencia

| Nivel | Fuente | Puede gobernar el estado | Uso en interfaz |
|---|---|---:|---|
| 1. Contractual | SoW, baseline aprobada, hitos, actas, costo ejecutado | Sí | Color pleno; encabezado, Zonas 1 y 2. |
| 2. Documental | Minutas, actas, compromisos, descargos, PRD | Sí, mediante IGE y gatillos | Cobertura y hallazgos en dictamen, Zonas 3 y 4. |
| 3. Operativo | Jira, épicas, issues, risks, capacity | Sólo puede agravar | Colapsado y desaturado en Zona 5 con badge fijo **“No gobierna el estado”**. |

### 5.2 Métricas maestras de avance

| Métrica | Fórmula cardinal | Regla |
|---|---|---|
| CHC-T | `aceptados exigibles / comprometidos exigibles` | KPI maestro. Cada hito vale 1. |
| CHC-G | `aceptados exigibles / total hitos` | Avance cardinal global. |
| Esperado-G | `comprometidos exigibles / total hitos` | Referencia de calendario, no cumplimiento. |
| Vencidos abiertos | `vencidos sin aceptación` | Expone incumplimiento contractual. |
| OTD-H | `aceptados a tiempo / comprometidos exigibles` | Sólo se muestra separado si no coincide con CHC-T. |
| SPI-H | `CHC-G / Esperado-G` | Se expone sólo si aporta lectura; coincide con CHC-T en la definición dada. |
| CPI-H | `(CHC-G × presupuesto UF) / costo ejecutado UF` | Valor físico cardinal frente a costo. |
| DRC | Máxima demora de hito vencido de ruta crítica | Alimenta proyección y gatillo. |

Los pesos y UF se usarán **únicamente** para facturación aceptada, descalce en puntos porcentuales, UF retenidas, caja y daño. Un control estático del motor hará fallar la prueba si una función de cumplimiento recibe o consume `peso_pct`/`valor_uf`.

### 5.3 Estado único

1. El módulo puro calcula CHC, finanzas, cobertura documental, ICB y penalizaciones.
2. Calcula `IGE` en escala 0–100 sin peso comercial.
3. Evalúa G-01 a G-07 como gatillos absolutos.
4. Devuelve `estado_mostrado = min(estado_IGE, peor_gatillo)`.
5. La interfaz, exportación y agente sólo leen ese estado; ninguno puede recalcularlo.

## 6. Contrato de datos objetivo y compatibilidad

| Entidad | Estrategia | Propósito / restricciones críticas |
|---|---|---|
| `executive_contract_milestones` ampliada | Migración compatible desde la tabla piloto | Agregar fechas efectiva/entrega/aceptación, URL de acta, estado contractual, dueño, contraparte, causa raíz, bloqueo, épicas y `valor_uf`. Un estado `ACEPTADO` exige fecha + acta. |
| `executive_baseline_versions` | Nueva, inmutable | Versión, aprobador, acta, motivo, delta días/UF y snapshot de hitos. Ningún re-baseline altera la fecha efectiva sin una fila aprobada. |
| `executive_evidence_snapshots` | Nueva, inmutable | Corte `America/Santiago`, hashes/versiones SoW, Jira, finanzas, cobertura y versión de motor. Garantiza reconstrucción del KPI y del veredicto. |
| `executive_minutes` | Nueva | PDF privado en S3, SHA-256 único, metadatos obligatorios, OCR, texto extraído, semana ISO y confianza. |
| `executive_commitments` | Nueva | Extracto literal, página, dueño, fecha, vínculos, estado, evidencia y confianza. Bajo 0,75 no computa. |
| `executive_requirements` | Nueva | Exigencias P0/P1/P2 con dueño, fecha, criterio, consecuencia, cierre con evidencia y anulación restringida. |
| `executive_recovery_plans` | Nueva | PRD con siete secciones, SLA, puntaje sugerido/aprobado, revisiones y evidencia. |
| `executive_verdicts_v2` | Nueva; no reutilizar el JSON genérico sin adaptar | Veredicto inmutable, schema validado, citas al snapshot y continuidad frente al corte anterior. |
| Datos existentes v1 | Sólo lectura durante transición | No eliminar `billing_milestones`, historial, Jira o dashboard heredado. La migración debe ser idempotente y generar reporte de faltantes. |

## 7. Backlog priorizado y verificable

### F0 — Auditoría, contrato y línea de base de sincronización

| ID | Pri. | Historia | Criterio de aceptación |
|---|---:|---|---|
| GOV-01 | P0 | Ejecutar R0 de sincronización y registrar versión base, estado de rama, árbol, pruebas y archivos de la ola. | No se edita código multiarchivo sin árbol confirmado, base recuperable y alcance de una sola ola. |
| GOV-02 | P0 | Formalizar matriz de todos los KPI actuales con fórmula, fuente, timestamp, nivel de evidencia y decisión (retirar/reclasificar/conservar). | La PMO aprueba la matriz y no quedan KPI sin denominador identificable. |
| GOV-03 | P0 | Acordar el diccionario de estados `PENDIENTE`, `EN_CURSO`, `ENTREGADO_SIN_ACTA`, `ACEPTADO`, `VENCIDO`, `EN_RIESGO`, IGE y `CRÍTICO`. | Una especificación tipada y un glosario evitan sinónimos entre motor, API y UI. |
| GOV-04 | P0 | Resolver la matriz de datos Tanner al corte: identificadores de hito, actas, responsables, contraparte, ruta crítica, kickoff, WACC, headcount/tarifa y cláusula de penalidad. | Todo faltante queda asignado a un responsable y marcado `[POR CONFIRMAR]`; no se inventa. |
| GOV-05 | P0 | Definir el fixture determinista T-01…T-20 separado de la base productiva. | Reproduce el escenario del prompt sin contaminar ni sustituir datos Tanner reales. |

### F1 — Modelo de evidencia y migración compatible

| ID | Pri. | Historia | Criterio de aceptación |
|---|---:|---|---|
| DAT-01 | P0 | Diseñar el esquema final y el diccionario de datos, incluyendo zona horaria `America/Santiago` y montos UF con dos decimales. | Revisión PMO aprobada antes de generar migración. |
| DAT-02 | P0 | Extender los hitos contractuales con evidencia de aceptación y campos de trazabilidad. | La base rechaza `ACEPTADO` sin fecha y acta; `ENTREGADO_SIN_ACTA` no suma avance. |
| DAT-03 | P0 | Crear baseline inmutable, historial de re-baseline y snapshot contractual. | Un cambio de fecha sin acta, aprobador y motivo es rechazado. |
| DAT-04 | P0 | Agregar snapshots de corte para SoW, Jira, finanzas, evidencia y versión del motor. | Un KPI y veredicto histórico pueden reconstruirse exactamente. |
| DAT-05 | P1 | Crear entidades de minutas, compromisos, exigencias, PRD y veredicto v2. | Restricciones de evidencia, roles y estados se aplican en servidor/base, no sólo en interfaz. |
| DAT-06 | P0 | Implementar migración idempotente y reporte de validación por proyecto. | No se sobreescriben datos v1; `Σ peso_pct = 100,00` se valida como invariante comercial. |

### F2 — Motor determinista y reglas de gobierno

| ID | Pri. | Historia | Criterio de aceptación |
|---|---:|---|---|
| ENG-01 | P0 | Crear `executiveGovernanceEngine` como módulo puro sin DB, Jira ni LLM. | Entrada snapshot + fecha de corte; salida tipada, <300 ms con fixture de referencia. |
| ENG-02 | P0 | Implementar conjuntos de corte, CHC-T, CHC-G, esperado, vencidos, OTD-H, SPI-H y DRC cardinales. | Hito del día de corte queda `EN_RIESGO`; ningún cálculo de cumplimiento usa pesos. |
| ENG-03 | P0 | Implementar EV, CPI-H, costo/hito, EAC/VAC en banda, margen a término y daño. | No existe EAC puntual; penalidad ausente genera `[POR CONFIRMAR]` y exigencia P1. |
| ENG-04 | P0 | Implementar descalce y UF retenidas como exposición separada. | Peso comercial no aparece en semáforo ni KPI de avance. |
| ENG-05 | P0 | Implementar IGE, G-01…G-07 y precedencia única. | Jira sólo puede restar/activar agravante; ninguna salida puede mejorar por AOJ/ICB. |
| ENG-06 | P1 | Implementar cobertura de minutas, TCC, coherencia e ICB. | Evidencia insuficiente reduce cobertura y queda visible; nunca se rellena. |

### F3 — API auditable y zonas 0, 1 y 2

| ID | Pri. | Historia | Criterio de aceptación |
|---|---:|---|---|
| API-01 | P0 | Crear contrato tRPC de snapshot, métricas, fórmulas, fuentes, timestamps y permisos. | Un único payload tipado alimenta el dashboard y evita recalcular en React. |
| API-02 | P0 | Separar lectura Jira operacional del conjunto contractual y persistir estado/frescura de la sincronización. | Jira fallido no borra último snapshot; se declara antigüedad. |
| UX-01 | P0 | Implementar contenedor visual conforme a la maqueta: barra grafito, metadatos, dictamen y subnavegación sticky. | Tokens, jerarquía, responsive y marca Prodigio aprobados visualmente. |
| UX-02 | P0 | Construir Zona 0: titular, lectura ≤90 palabras, sello estado/IGE, gatillos, cobertura y SLA PRD. | Un solo semáforo; cada elemento se vincula a evidencia o muestra `[POR CONFIRMAR]`. |
| UX-03 | P0 | Construir Zona 1: cinco KPI, tooltips de auditabilidad, Gantt baseline/real y tabla de vencidos. | CHC-T domina; acta, causa raíz, bloqueo y deriva son visibles. |
| UX-04 | P0 | Construir Zona 2: daño, descalce, EAC/VAC en banda, margen y UF/día. | Todo monto tiene fuente/corte; exposición queda rotulada **“no es avance”**. |

### F4 — Zona 3: exigencias, descargos y PRD

| ID | Pri. | Historia | Criterio de aceptación |
|---|---:|---|---|
| GOV-06 | P0 | Generar exigencias automáticas por estado NARANJO/CRÍTICO, gatillos y datos faltantes críticos. | P0/P1 muestran dueño, fecha, criterio, consecuencia y escalamiento. |
| API-03 | P0 | Implementar comandos autorizados para crear, responder, cerrar o anular exigencias. | Ninguna exigencia se cierra sin URL de evidencia; anulación sólo Delivery con motivo y auditoría. |
| UX-05 | P0 | Implementar Zona 3, tabla de exigencias, descargos, escalamiento y pauta PRD de siete secciones. | SLA 72 horas hábiles, validación de 75 puntos y segunda revisión se comportan conforme a la pauta. |

### F5 — Zona 4: minutas y compromisos

| ID | Pri. | Historia | Criterio de aceptación |
|---|---:|---|---|
| DOC-01 | P0 | Crear carga PDF privada por proyecto con hash, tamaño, metadatos y permisos. | Rechaza no PDF, >20 MB, duplicados, fecha futura/anterior al kickoff e incompletos. |
| DOC-02 | P1 | Procesar capa de texto/OCR y extraer compromisos con página, confianza y vínculos. | Confianza <0,75 requiere confirmación humana antes de afectar TCC. |
| UX-06 | P0 | Implementar Zona 4: carga, mapa semanal, compromisos, brechas y coherencia narrativa. | Racha de tres semanas sin minuta activa G-04 y se ve como hallazgo. |

### F6 — Veredicto, Zona 5 y Zona 6

| ID | Pri. | Historia | Criterio de aceptación |
|---|---:|---|---|
| AI-01 | P1 | Definir el esquema JSON v2, las citas y el contexto versionado del dictamen. | Cada afirmación cuantitativa tiene cita; falta de cobertura se declara en el titular. |
| AI-02 | P1 | Implementar validación estricta del veredicto contra motor, snapshot y hallazgos P0. | Estado contradictorio o hallazgos vacíos bloquean render y registran incidente. |
| AI-03 | P2 | Implementar continuidad con veredicto previo y detección de reincidencia G-06. | Nunca se sobrescribe una versión; cambios de estado son comparables por corte. |
| UX-07 | P1 | Construir Zona 5 como diagnóstico secundario: AOJ, ICB, riesgos y capacity. | Inicia colapsada/desaturada, con “No gobierna el estado”; AOJ no aparece en dictamen. |
| UX-08 | P2 | Construir Zona 6 con vistas CFO, Comercial y CTO. | Todas consumen el mismo estado/snapshot; no hay semáforos alternativos. |

### F7 — Calidad, acceso, publicación y escalamiento controlado

| ID | Pri. | Historia | Criterio de aceptación |
|---|---:|---|---|
| QLT-01 | P0 | Implementar T-01…T-20, R-01…R-13 y pruebas de invariantes/migración. | Suite verde; T-19 falla intencionalmente si los pesos comerciales no suman 100,00. |
| QLT-02 | P1 | Implementar M-01…M-07 y validaciones de roles/auditoría. | Carga y procesamiento seguros, recuperables y trazables. |
| QLT-03 | P0 | Verificar U-01…U-10, contraste AA, teclado, 1440/1024/768/360 px y reduced motion. | Capturas y pruebas confirman que no hay desborde, dato relleno ni estados duplicados. |
| OPS-01 | P1 | Instrumentar frescura, fallas de Jira/LLM, auditoría y latencia. | Cada refresh, snapshot, re-baseline, exigencia y veredicto deja traza consultable. |
| RLS-01 | P0 | Ejecutar piloto Tanner bajo feature flag y aprobación del Gerente de Delivery. | V1 permanece disponible hasta aceptación explícita del piloto. |
| RLS-02 | P1 | Habilitar migración gradual al portafolio. | Cada proyecto pasa su auditoría de evidencia antes de exponerse en v2. |

## 8. Gates y entregables

| Fase | Entregable | Puerta de salida innegociable |
|---|---|---|
| F0 | Auditoría, decisiones de datos, fixture y R0 | Aprobación PMO del modelo cardinal, semáforo, fuentes y tratamiento de faltantes. |
| F1 | Esquema, migración, baseline/snapshot Tanner | Migración reversible e idempotente; validación comercial `Σ pesos = 100,00`. |
| F2 | Motor y pruebas T/R | T-01…T-20 y R-01…R-13 en verde. |
| F3 | API + Zonas 0–2 | U-01, U-02, U-04, U-07…U-10 correspondientes verificadas; diseño revisado. |
| F4 | Exigencias y PRD | Flujo real completo, evidencia de cierre y SLA probados. |
| F5 | Minutas y compromisos | M-01…M-07 en verde; cobertura y G-04 reproducibles. |
| F6 | Dictamen v2 + Zonas 5–6 | Cero afirmaciones sin cita y sin contradicción con motor. |
| F7 | Accesibilidad, exportación, observabilidad y piloto | Batería completa, revisión de Delivery y aprobación antes de extensión. |

## 9. Plan operativo contra problemas de sincronismo

Este rediseño toca esquema, migraciones, servidores, APIs, estilos, componentes, pruebas y documentación. Por tanto, se aplicará el protocolo de sincronización como **gate de liberación**, no como tarea final.

| Momento | Control obligatorio | Acción si falla |
|---|---|---|
| Antes de F1 y cada nueva ola | R0: inspeccionar árbol, rama/remoto, último checkpoint, estado de pruebas y lista acotada de archivos. | Detener la ola. Inventariar de sólo lectura. No editar sobre una base divergente. |
| Inicio de cada bloque lógico | Establecer una única base recuperable con checkpoint y relectura de archivos compartidos después de sincronizar. | Si la remota avanzó, reconciliar una sola vez o solicitar decisión; nunca alternar merge/rebase/reset. |
| Ejecución | Trabajar una sola vertical: esquema → migración/validación → servidor/pruebas → cliente → pruebas/captura. | No mezclar dos olas ni paralelizar archivos compartidos. |
| Fin de cada ola | Leer `todo.md`, ejecutar pruebas focales + TypeScript/build, captura visual si aplica, luego checkpoint descriptivo. | No publicar ni seguir con la siguiente ola. |
| Conflicto o checkpoint fallido | Congelar alcance, capturar error, versión, rama y archivos modificados sin secretos. | Elegir una sola recuperación: integrar base o restaurar checkpoint. No reintentar a ciegas ni usar `git reset --hard`. |

Los checkpoints propuestos son: **C0** preflight y base limpia; **C1** datos/migración; **C2** motor/API; **C3** Zonas 0–2; **C4** Zona 3; **C5** Zona 4; **C6** Zona 5–6 y agente; **C7** cierre de calidad/piloto. Cada checkpoint se publica automáticamente sólo si la ola está validada.

## 10. Decisiones que PMO debe aprobar antes de construir

| Decisión | Recomendación | Razón |
|---|---|---|
| Fuente de acta de aceptación | Cargar una evidencia por hito, vinculada y privada en S3. | Sin acta no debe existir `ACEPTADO`. |
| Baseline inicial Tanner | Convertir el SoW v6 aprobado a snapshot inmutable; no inferir fechas desde Jira. | Jira no es contrato. |
| Códigos de hitos | Definir si se conservan M01–M10 o se migra a la nomenclatura del prompt (p. ej., H3A-F1), con tabla de equivalencia única. | Evita que el motor use identificadores ambiguos. |
| Corte inicial | Confirmar la fecha de corte oficial y los seis hitos exigibles de Tanner. | El denominador CHC-T depende de ello. |
| Financiero | Confirmar fuente vigente, WACC, tarifa/día, headcount bloqueado, cláusula de penalidad y política de frescura. | Sin ellos, daño/EAC debe quedar `[POR CONFIRMAR]`. |
| Roles de gobierno | Nominar Gerente de Delivery, PM, CFO/Comercial/CTO informados y quién puede anular exigencias. | Necesario para permisos y auditoría. |
| PRD | Validar SLA de 72 horas hábiles y la rúbrica de siete secciones. | Evita automatizar una obligación no adoptada por Delivery. |
| Alcance de diseño | Adoptar la maqueta como especificación de contenido v2, limitada a la ruta ejecutiva. | Preserva Poppins y `#e91e8c` como identidad general de Prodigio; las fuentes editoriales quedan aisladas en el dashboard. |

## 11. Qué se conserva y qué se sustituye

| Reutilizar | Sustituir / aislar |
|---|---|
| Vínculo Tanner–Deal 1934–Jira `PBTISD1`; SoW v6; mapeo de 10 hitos; autenticación, roles, auditoría, almacenamiento, tRPC, feature flag y dashboard heredado como fallback. | Motor ponderado de 45%, semáforo actual, tarjetas genéricas, mezcla de Jira con contractual, datos financieros sin snapshot, tabla de hitos sin acta y veredicto no gobernado. |

## 12. Próximo paso solicitado

La recomendación es aprobar **F0 en dos actos**: primero, aprobar este plan y las decisiones de la sección 10; después, realizar el preflight de sincronización y presentar el diseño de migración/contratos para una segunda autorización. Esto impide que una definición incompleta o una rama desalineada vuelva a producir una implementación que no represente el diseño solicitado.

---

## Referencias

1. `PROMPT-rediseno-dashboard-ejecutivo-pmo-v2.md` proporcionado por PMO, versión 2.0.
2. `dashboard-ejecutivo-pmo-v2-layout_1.html` proporcionado por PMO.
3. Implementación actual: `server/executiveDashboardV2.ts`, `server/routers.ts`, `client/src/pages/stages/ExecutiveDashboardV2.tsx` y esquema Drizzle.
4. Auditoría de datos de Tanner de sólo lectura ejecutada el 18-ago-2026.
