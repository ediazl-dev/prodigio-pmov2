# Backlog de ajustes — Dashboard Ejecutivo v2 de Tanner

**Estado:** propuesta para aprobación; no se aplicaron cambios funcionales con este documento.  
**Alcance:** navegación lateral, línea de tiempo contractual con fechas y carga/validación directa de evidencia documental.  
**Guardrails vigentes:** avance por cardinalidad de hitos con acta; SoW como fuente contractual; Jira sólo como señal operativa secundaria; datos ausentes como **[POR CONFIRMAR]**; no se modificarán datos reales de Tanner sin evidencia cargada y validada.

## 1. Diagnóstico de la implementación actual

| Tema | Hallazgo verificable | Efecto actual | Criterio de corrección |
|---|---|---|---|
| Navegación | La vista tiene barra superior y subnavegación horizontal fija; no tiene barra lateral propia. | Las zonas requieren desplazamiento horizontal en la subnavegación y no existe índice persistente a la izquierda. | Implementar un índice lateral contextual en escritorio y una alternativa accesible en móvil. |
| Línea de tiempo | El backend ya expone `baselineDate`, `jiraDueDate`, `committedDate` y `acceptedAt`; el frontend calcula un único punto usando la fecha comprometida o baseline. | No se ven simultáneamente la fecha contractual baseline, la fecha real de aceptación ni la desviación por hito como en la maqueta. | Renderizar fechas y marcadores separados, con procedencia explícita. |
| Evidencia documental | Las mutaciones de minutas, actas y PRD solicitan `fileName` y `fileUrl` manuales. Las tablas persistidas ya conservan nombre, URL y SHA-256 opcional. | El usuario debe alojar y copiar una URL; no hay carga, validación técnica ni flujo de revisión desde la vista. | Cargar archivos directamente al almacenamiento del proyecto, registrar metadatos, validar y enlazar sólo cuando el flujo de gobierno lo autorice. |

> **Conclusión:** las fechas y documentos no deben tratarse como texto decorativo. Deben ser evidencia con procedencia, fecha de observación, estado de validación y trazabilidad de usuario.

## 2. Decisiones de diseño propuestas

### 2.1 Navegación lateral del Dashboard v2

La barra lateral será **específica de esta ruta**, no el `DashboardLayout` magenta general de Prodigio. Mantendrá el sistema autónomo grafito/papel/teal del Dashboard Ejecutivo v2 y no modificará la navegación global de la plataforma.

| Área | Propuesta |
|---|---|
| Escritorio | Rail izquierdo fijo o `sticky`, de aproximadamente 236–264 px, debajo de la barra superior. Incluirá: retorno al proyecto, nombre abreviado del proyecto, estado único, corte observado y anclas 00–07. |
| Estado activo | La sección visible se resaltará con contraste suficiente y se anunciará mediante `aria-current="location"`; el índice conservará el número y nombre de cada zona. |
| Móvil/tablet | El rail se reemplazará por un botón de índice que abre un panel lateral con foco contenido, Escape para cerrar y retorno de foco al disparador. La vista no usará una barra lateral permanente que reduzca ilegiblemente el contenido. |
| Rutas de salida | Se mantendrán enlaces a **Proyecto** y **Proyectos**. Ninguna interacción obligará a usar sólo el historial del navegador. |
| Accesibilidad | Hitos de ancla con `scroll-margin-top`, foco visible, orden semántico `header → nav → main`, navegación por teclado y preferencia de movimiento reducido. |

### 2.2 Línea de tiempo contractual: baseline vs. real

El concepto de “real” debe tener una definición rigurosa:

| Campo mostrado | Fuente | Regla de gobierno |
|---|---|---|
| **Baseline contractual** | `executive_contract_milestones.baselineDate` desde el SoW aprobado. | Es la fecha plan contractual y nunca se sobreescribe con Jira. |
| **Fecha operacional** | `jiraDueDate`, sólo si existe. | Se rotula como operativa/Jira; puede advertir atraso, pero no es fecha real contractual ni acredita entrega. |
| **Fecha real acreditada** | `executive_milestone_acceptances.acceptedAt` con acta válida. | Es la única fecha real de cumplimiento que puede actualizar el avance cardinal. Sin acta: **[POR CONFIRMAR]**. |
| **Desviación contractual** | `acceptedAt - baselineDate`, en días calendario, sólo si ambas fechas existen. | Se muestra como atraso/adelanto; no se calcula cuando falta evidencia. |

La línea de tiempo mostrará, por hito M01–M10, un eje por meses derivado de las fechas baseline existentes, un marcador baseline, un marcador de aceptación real cuando exista y una guía de desviación cuando ambas fechas sean válidas. Una tabla complementaria incluirá **Baseline**, **Real acreditada**, **Operacional Jira**, **Desviación**, **Estado de acta** y **Procedencia**. No se fabricarán barras de duración cuando el SoW sólo entregue fechas de hito.

### 2.3 Carga y validación de documentos

Se propone un flujo en dos niveles para cumplir la solicitud sin convertir un archivo cargado en una aceptación automática:

1. **Recepción técnica:** usuario autorizado selecciona un archivo; el sistema valida tipo, tamaño, extensión, firma/mime cuando sea posible, calcula hash SHA-256, lo guarda mediante el almacenamiento del proyecto y crea un registro en estado `received` o `technical_rejected`.
2. **Validación de gobierno:** PMO/Admin revisa los metadatos y el vínculo al objeto de gobierno. Sólo al confirmar la revisión se crea o actualiza la minuta, el PRD o el registro de acta. Para un acta, se exigirá además hito, fecha de aceptación y vínculo al documento; el avance cardinal se recalculará únicamente después de este paso.

> La carga exitosa de un archivo **no** implica por sí sola que un hito esté aceptado ni que el dashboard mejore su estado. Esto preserva la política contractual vigente.

## 3. Backlog priorizado

| ID | Prioridad | Entregable | Actividades técnicas verificables | Criterios de aceptación |
|---|---|---|---|---|
| NAV-01 | P0 | Rail lateral del Dashboard v2 | Crear componente de navegación contextual; mover anclas 00–07 al rail; incorporar retorno al proyecto, estado y corte; ajustar grilla de contenido. | En escritorio se ve una barra izquierda persistente; cada enlace lleva a su zona; el estado activo cambia con la sección visible; no se altera la navegación general de Prodigio. |
| NAV-02 | P0 | Navegación accesible y adaptable | Implementar panel de índice para móvil, foco visible, Escape, restauración de foco, `aria-current`, `aria-label` y reducción de movimiento. | Se puede recorrer el índice y todas sus acciones con teclado; móvil no pierde contenido ni crea scroll horizontal. |
| TL-01 | P0 | Contrato de datos de cronograma | Extender la respuesta `getExecutiveDashboardV2` con un objeto de timeline por hito: baseline, fecha operacional, fecha real acreditada, desviación, procedencia y estado. | Cada fecha tiene fuente explícita; una fecha de Jira no se expone como “real”; los nulos se muestran como **[POR CONFIRMAR]**. |
| TL-02 | P0 | Gantt baseline vs. real | Sustituir el punto único actual por marcadores diferenciados y eje mensual calculado desde fechas baseline; incluir línea de corte y leyenda. | M01–M10 muestran fechas baseline visibles; sólo los hitos con acta muestran fecha real; la desviación se visualiza únicamente con ambos datos válidos. |
| TL-03 | P1 | Tabla de auditoría de fechas | Añadir columnas Baseline, Real acreditada, Operacional Jira, Desviación, Acta y fuente; conservar vínculo al documento de acta cuando exista. | No hay inferencia de fecha real; el usuario puede auditar por qué un hito está o no acreditado. |
| DOC-01 | P0 | Modelo de documento de evidencia | Crear tabla de documentos ejecutivos y migración aditiva: tipo, nombre original, clave de almacenamiento, URL de acceso, MIME, tamaño, SHA-256, estado de validación, motivo de rechazo, cargador, revisor y fechas. Añadir vínculos opcionales a minuta, acta, PRD y cierre de exigencia. | Migración no destructiva; los registros existentes con URL siguen consultables; todos los nuevos archivos quedan trazables. |
| DOC-02 | P0 | Servicio de carga segura | Crear procedimientos protegidos de preparación, carga y confirmación usando el almacenamiento del proyecto; validar autorización, proyecto piloto, límite de tamaño, allowlist de MIME/extensión y hash. | No se aceptan URLs manuales como vía principal; un usuario sin rol no puede cargar; los bytes no se guardan en la base de datos. |
| DOC-03 | P0 | Validación documental por tipo | Definir reglas por evidencia: minuta (fecha/título y revisión), acta (M01–M10, fecha, archivo y vínculo), PRD (versión, vencimiento, resumen y archivo), cierre de exigencia (archivo y notas). Persistir estado `received`, `reviewed`, `incomplete` o `rejected`. | La interfaz explica cada falta; no crea aceptación ni PRD vigente sin revisión y permisos vigentes. |
| DOC-04 | P1 | Experiencia de carga en Zona 05 | Reemplazar entradas `fileUrl` por dropzone, selector de archivo, progreso, resultado de validación, estado y vínculo de descarga; conservar carga manual sólo para migración administrativa temporal si se aprueba. | El usuario puede cargar una minuta desde la vista; al validarse se actualizan cobertura, minutas y compromisos sin recargar toda la aplicación. |
| DOC-05 | P1 | Carga de actas y PRD | Aplicar el mismo selector validado en los formularios de acta y PRD; enlazar documento a hito/versión en una transacción de gobierno. | Un hito nunca figura aceptado sin archivo, fecha y vínculo; sólo Delivery puede aprobar un PRD borrador con archivo validado. |
| DOC-06 | P1 | Auditoría y recuperación | Registrar en `audit_logs` carga, rechazo, revisión, vínculo, sustitución y revocación; permitir descarga mediante URL controlada y no exponer claves internas. | Cada modificación se atribuye a usuario y hora; reemplazos preservan historia y hash anterior. |
| QA-01 | P0 | Pruebas y validación | Agregar Vitest de permisos, archivos inválidos, tamaños/MIME, hash, estados, invariancia cardinal, fechas y desviaciones; validación visual desktop/móvil y teclado. | `pnpm exec tsc --noEmit` y `pnpm test` aprueban; se comprueba que Jira nunca acredita real/aceptado. |

## 4. Secuencia recomendada de implementación

| Incremento | Alcance | Dependencias | Checkpoint de salida |
|---|---|---|---|
| C1 | NAV-01, NAV-02, TL-01 | Ninguna migración; reutiliza campos existentes de hitos. | Captura desktop/móvil y prueba de teclado. |
| C2 | TL-02, TL-03 | C1 y datos baseline de M01–M10. | Comparación de fechas contra SoW y actas reales, sin cambios a datos. |
| C3 | DOC-01, DOC-02 | Migración, almacenamiento del proyecto y decisión de tipos/tamaños. | Pruebas de carga y validación técnica; rollback recuperable. |
| C4 | DOC-03, DOC-04, DOC-05 | C3; definición aprobada de reglas de documento. | Flujo completo de minuta, acta y PRD con roles. |
| C5 | DOC-06, QA-01 | C1–C4. | Regresión completa, auditoría de permisos y evidencia visual autenticada. |

## 5. Salvaguardas de datos y sincronización

| Riesgo | Control obligatorio |
|---|---|
| Fecha Jira confundida con fecha real | Mantener columnas, rótulos y colores distintos; prohibir que `jiraDueDate` alimente `acceptedAt` o avance cardinal. |
| Documento cargado sin validez de gobierno | Estados de validación separados; confirmación humana obligatoria para actas y PRD. |
| Pérdida de evidencia | Archivo en almacenamiento del proyecto, hash SHA-256, metadatos y auditoría; no guardar bytes en MySQL/TiDB. |
| Cambio de esquema riesgoso | Migración aditiva, lectura compatible de URLs antiguas, prueba de repositorios y checkpoint antes/después de cada bloque. |
| Conflicto de sincronización | `git status --short` antes de cada bloque multiarchivo; TypeScript y pruebas antes de cada checkpoint; no editar datos de Tanner sin archivo validado. |

## 6. Decisiones que requieren confirmación antes de implementar DOC-01 a DOC-05

| Decisión | Recomendación | Motivo |
|---|---|---|
| Tipos admitidos | PDF para actas; PDF/DOCX para minutas y PRD; bloquear ejecutables, archivos comprimidos y formatos no declarados. | Simplifica revisión, reduce superficie de riesgo y mantiene evidencia legible. |
| Límite por archivo | Definir explícitamente un máximo por tipo antes de construir el endpoint; propuesta inicial: no exceder 25 MB. | Evita cargas inesperadas y debe adecuarse al almacenamiento disponible. |
| Validación semántica automática | Preclasificar metadatos y advertir inconsistencias, pero exigir revisión humana para cualquier estado contractual. | Evita que IA/OCR invente aceptación o fecha contractual. |
| Migración de URLs históricas | Mantenerlas como evidencia legada de sólo lectura y permitir sustitución documentada por archivo cargado. | No rompe evidencia existente ni altera registros reales. |

## 7. Resultado esperado

Al terminar el backlog, el Dashboard Ejecutivo v2 tendrá una navegación lateral coherente con una vista de gobierno, una línea de tiempo que distingue visualmente **baseline contractual**, **señal Jira** y **real acreditado con acta**, y un flujo de evidencia que permite cargar documentos directamente sin debilitar las reglas de aceptación cardinal, roles ni auditoría.
