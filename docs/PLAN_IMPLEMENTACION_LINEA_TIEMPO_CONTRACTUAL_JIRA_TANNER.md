# Plan de implementación — Línea de tiempo contractual Jira · Tanner

**Fecha:** 18 de agosto de 2026  
**Piloto:** `[PMO Banco Tanner] - Implementación SFA - Deal 1934` · Proyecto `180002` · Jira `PBTISD1`  
**Estado:** Plan de implementación aprobado para ejecución técnica; no se han modificado datos productivos en este análisis.

## Decisión de gobierno

La **fecha planificada de cada hito en Jira** pasa a ser la **fecha comprometida contractualmente** para el Dashboard Ejecutivo v2. La fecha no se interpreta como una señal secundaria: representa la obligación temporal del hito contractual previamente vinculado a su issue Jira.

El cierre de la issue en Jira representa **cierre operativo**, no aceptación contractual. Un hito sólo acredita avance cardinal cuando existe una **acta de aceptación vigente**, con documento, fecha de aceptación y vínculo al hito. Entre el cierre Jira y la aceptación del cliente existirá una ventana máxima de **cinco días calendario**.

> La tolerancia de cinco días es una ventana de control para formalizar la aceptación del cliente. No modifica la fecha comprometida, no posterga el compromiso Jira y no acredita avance sin acta.

| Concepto | Fuente de verdad | Efecto de gobierno |
|---|---|---|
| Fecha comprometida | Campo `duedate` de la issue Jira vinculada al hito | Baseline contractual visible y referencia de variación |
| Cierre operativo | Estado Jira cerrado más `resolutiondate` | Inicia la ventana de cinco días para obtener acta; no suma avance |
| Fecha real | Fecha de aceptación del acta vigente | Acredita el hito y permite calcular la variación real |
| Avance contractual | Cardinalidad de hitos con acta válida | Sólo aumenta con documento, fecha y vínculo válidos |

## Diagnóstico confirmado

La maqueta objetivo presenta una escala temporal mensual, una línea de corte y la distinción gráfica entre aceptación del cliente, hito vencido sin aceptación y compromiso planificado. La implementación actual muestra una lista de tracks genéricos y rotula como `BASELINE [POR CONFIRMAR]` lo que ya está disponible como `jiraDueDate`.

La consulta productiva ya entrega la fecha Jira en el contrato del dashboard (`jiraDueDate`) y hoy la usa de forma transitoria como `committedDate`. Sin embargo, no cuenta con un campo persistido ni un contrato de datos para la fecha de cierre Jira. La integración Jira solicita `resolutiondate`, pero su proyección de hitos aún no la expone ni la conserva.

Además, los diez hitos Tanner tienen fecha planificada Jira y no tienen `baselineDate` SoW por hito. Existen cero actas de aceptación vigentes. En consecuencia, el marcador `[POR CONFIRMAR]` es incorrecto para la fecha comprometida, mientras que la ausencia de aceptación sí debe continuar visible como pendiente.

| Hito | Issue Jira | Fecha comprometida Jira | Estado Jira observado | Acta vigente |
|---|---|---:|---|---|
| M01 · Kick Off | PBTISD1-8 | 02/02/2026 | Cumplido (Entregable) | No |
| M02 · Cierre Diseño y pre-requisitos | PBTISD1-9 | 20/03/2026 | Cumplido (Entregable) | No |
| M03 · Arquitectura SFA Pre-Prod | PBTISD1-10 | 27/07/2026 | Retrasado | No |
| M04 · Arquitectura SFA Prod | PBTISD1-11 | 02/10/2026 | Pendiente | No |
| M05 · Cierre Sprint 1 y 2 | PBTISD1-12 | 03/08/2026 | Pendiente | No |
| M06 · Cierre Sprint 3 y 4 | PBTISD1-13 | 10/08/2026 | Pendiente | No |
| M07 · Iniciador de Pagos | PBTISD1-14 | 03/09/2026 | Pendiente | No |
| M08 · Cierre Sprint 6 y 7 | PBTISD1-15 | 17/08/2026 | Pendiente | No |
| M09 · Cierre Sprint 8 y 9 | PBTISD1-86 | 25/08/2026 | Pendiente | No |
| M10 · Cierre y Garantía | PBTISD1-16 | 09/10/2026 | Pendiente | No |

También se confirmó que la fuente actual define estilos para navegación contextual, pero no renderiza un elemento `<nav>` con accesos de sección. Por ello, el rail lateral solicitado no puede ser visible de forma consistente: el problema no se limita a CSS responsivo.

## Modelo de estado temporal propuesto

La clasificación se evaluará por hito usando la fecha de corte del dashboard y fechas ISO `YYYY-MM-DD`, normalizadas en UTC. El cálculo de diferencia usa días calendario completos, para respetar exactamente la tolerancia aprobada.

| Prioridad | Condición determinista | Estado mostrado | Tratamiento del avance |
|---:|---|---|---|
| 1 | Acta vigente con documento, fecha y vínculo al hito | **ACEPTADO** | Suma una unidad a la cardinalidad; muestra fecha real y variación |
| 2 | Jira cerrado; no hay acta; días desde cierre Jira entre 0 y 5 inclusive | **PENDIENTE ACTA** | No suma avance; muestra fecha de cierre y días restantes o transcurridos |
| 3 | Jira cerrado; no hay acta; han transcurrido más de 5 días | **VENCIDO SIN ACTA** | No suma avance; penaliza la lectura contractual y se marca en rojo |
| 4 | Jira no cerrado y la fecha comprometida es anterior al corte | **EN RIESGO** | No suma avance; marca incumplimiento de compromiso |
| 5 | Jira no cerrado y la fecha comprometida es igual o posterior al corte | **COMPROMETIDO** | No suma avance; se mantiene planificado |
| 6 | No existe fecha Jira vinculada o la fecha no es válida | **[PENDIENTE VINCULACIÓN JIRA]** | No se inventa fecha ni estado contractual |

La clasificación no empleará pesos de facturación. Los porcentajes monetarios seguirán aislados en las vistas comerciales y financieras, sin alterar los contadores cardinales ni la condición de aceptación.

## Diseño objetivo de la línea de tiempo

La vista reemplazará el track genérico actual por la composición de la maqueta:

| Zona visual | Implementación propuesta |
|---|---|
| Encabezado | `Línea de tiempo contractual — compromiso Jira vs. aceptación` y leyenda explícita: `Fecha programada Jira · Cierre operativo · Aceptación cliente` |
| Eje temporal | Meses desde la menor a la mayor fecha Jira del baseline activo; línea vertical de fecha de corte |
| Fila de hito | Código, título, fecha comprometida Jira, marcador de cierre Jira si existe y marcador de aceptación si existe |
| Etiqueta de estado | Chip semántico: ACEPTADO, PENDIENTE ACTA, VENCIDO SIN ACTA, EN RIESGO, COMPROMETIDO o PENDIENTE VINCULACIÓN JIRA |
| Variación | Días de aceptación menos fecha comprometida; se muestra sólo con acta válida. Un valor positivo se expresa como atraso y uno negativo como anticipación |
| Detalle accesible | Tabla equivalente bajo la visualización con: `Hito`, `Fecha comprometida`, `Cierre Jira`, `Fecha real`, `Estado`, `Variación`, `Acta` |
| Leyenda | Verde: aceptado por cliente; ámbar: pendiente dentro de tolerancia; rojo: vencido sin acta o en riesgo; gris: programado; negro: fecha de corte |

La tabla accesible asegura que la decisión no dependa sólo del color o de la posición del marcador. En móvil, se mostrará primero la tabla horizontal desplazable y luego una escala temporal compacta; el rail lateral se convertirá en navegación superior contextual.

## Plan de ejecución por bloques recuperables

| Bloque | Alcance y archivos principales | Pruebas de salida | Checkpoint |
|---:|---|---|---|
| 0 | Ejecutar preflight de sincronización: base, árbol, rama y resultado de pruebas. Crear punto recuperable antes de cambios multiarchivo. | Árbol limpio, remoto alineado, pruebas conocidas. | Preventivo |
| 1 | Corregir el rail lateral real en `ExecutiveDashboardV2.tsx` y `index.css`: `<nav aria-label>`, retorno al proyecto, enlaces a secciones, escritorio fijo y alternativa móvil. | Render DOM, teclado, foco, captura autenticada. | Navegación |
| 2 | Extender `JiraAdvanceReport` y `getJiraAdvanceReport()` para proyectar `resolutiondate`; ampliar el modelo de `executive_contract_milestones` con `jiraClosedDate`; crear migración y sincronización explícita del vínculo por hito. | Pruebas de adaptador Jira y migración; ninguna aceptación es creada o modificada. | Datos Jira |
| 3 | Incorporar `classifyMilestoneTimeline()` en `executiveGovernanceEngine.ts`, junto con contrato de salida que entregue fechas, estado, variación y ventana de acta. Actualizar `routers.ts`. | Casos de borde 0, 5 y 6 días; aceptación con y sin evidencia; fecha Jira ausente. | Motor temporal |
| 4 | Sustituir la línea temporal visual y agregar la tabla equivalente. Eliminar el texto ambiguo `BASELINE [POR CONFIRMAR]` cuando exista `jiraDueDate`. | Render de los diez hitos Tanner; formato de fecha; contraste; móvil y escritorio. | Interfaz temporal |
| 5 | Ejecutar regresión completa, validar la ruta autenticada de Tanner y registrar el resultado. Verificar cardinalidad sin cambios indebidos y datos Jira vigentes. | TypeScript, Vitest, captura y validación de datos. | Publicación automática |

## Cambios técnicos necesarios

El modelo `executive_contract_milestones` requiere una columna `jiraClosedDate` nullable. El valor se cargará exclusivamente desde `resolutiondate` de la issue Jira vinculada. Cuando Jira informe un estado de cierre sin `resolutiondate`, el dashboard mostrará `CERRADO JIRA · fecha de cierre [PENDIENTE]` y no iniciará silenciosamente la tolerancia de cinco días; se deberá recuperar la fecha mediante una consulta Jira verificable o dejar la inconsistencia explícita.

La consulta `advance.getExecutiveDashboardV2` devolverá por hito los campos `jiraDueDate`, `jiraClosedDate`, `acceptedAt`, `acceptanceEvidenceUrl`, `timelineStatus`, `acceptanceWindowDays` y `varianceDays`. El motor cardinal conservará `isMilestoneAcceptedAtCutoff()` como única regla para sumar aceptación. La nueva clasificación temporal podrá penalizar el semáforo, pero nunca elevarlo por un estado Jira cerrado.

## Batería de aceptación obligatoria

| ID | Caso | Resultado esperado |
|---|---|---|
| TT-01 | Hito con fecha Jira futura, sin cierre ni acta | COMPROMETIDO; sin avance |
| TT-02 | Fecha Jira pasada, sin cierre ni acta | EN RIESGO; sin avance |
| TT-03 | Cierre Jira hoy, sin acta | PENDIENTE ACTA; 5 días disponibles |
| TT-04 | Cierre Jira hace exactamente 5 días, sin acta | PENDIENTE ACTA; dentro de tolerancia |
| TT-05 | Cierre Jira hace 6 días, sin acta | VENCIDO SIN ACTA; sin avance |
| TT-06 | Cierre Jira y acta vigente al día 5 | ACEPTADO; suma una unidad cardinal |
| TT-07 | Acta sin URL/documento o sin fecha | No ACEPTADO; rechazo de persistencia |
| TT-08 | Acta vigente con fecha anterior o posterior a la fecha comprometida | Variación negativa o positiva correcta |
| TT-09 | Issue cerrada sin `resolutiondate` | Cierre visible sin cómputo de tolerancia; dato pendiente explícito |
| TT-10 | Cambio de pesos de facturación | Línea temporal y avance cardinal invariantes |
| TT-11 | Rail lateral en escritorio y navegación móvil | Visible, navegable por teclado, con retorno funcional |

## Controles de sincronización y publicación

La ejecución seguirá el protocolo de sincronización de versiones: no se editará sobre un árbol divergente, cada bloque tendrá pruebas focales y un checkpoint independiente, y cualquier conflicto de sincronización detendrá la implementación antes del siguiente bloque. El último checkpoint conocido para recuperación es `ffffdb95`; el ajuste anterior de Dashboard Ejecutivo v2 permanece disponible en `3e5cd07d`.

No se modificará retrospectivamente ninguna fecha Jira, acta, aceptación o condición contractual durante la implementación. Los datos actuales se leerán, se reconciliarán contra Jira y sólo se persistirá la fecha de cierre operacional obtenida desde la issue vinculada. La publicación se realizará automáticamente al guardar cada checkpoint exitoso.

