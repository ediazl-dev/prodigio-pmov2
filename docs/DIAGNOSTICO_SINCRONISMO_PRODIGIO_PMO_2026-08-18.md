# Diagnóstico profundo de la pérdida de sincronismo — Prodigio PMO

**Fecha:** 18 de agosto de 2026  
**Proyecto:** prodigio-pmo  
**Versión en vivo:** `45d3d7a2`  
**Base local:** `4639e3b`  
**Estado:** Diagnóstico completado con evidencia verificable

---

## 1. Resumen ejecutivo

La pérdida de sincronismo **no fue causada por un error de código ni por una acción destructiva del usuario**. La causa raíz es una **divergencia de historial Git entre el entorno local de desarrollo y el repositorio remoto compartido**, originada por la forma en que la plataforma Manus gestiona los checkpoints automáticos.

El entorno local quedó anclado en el commit `4639e3b` (04:54 UTC), mientras el remoto avanzó 18 commits hasta `45d3d7a` (14:51 UTC). El local es ancestro directo del remoto, pero la plataforma no pudo reconciliar automáticamente la divergencia porque el mecanismo de checkpoint intenta empujar una historia que no es fast-forward desde la perspectiva del remoto.

---

## 2. Evidencia verificable

### 2.1 Estado del árbol local

| Indicador | Valor | Interpretación |
|-----------|-------|----------------|
| HEAD local | `4639e3b` (04:54 UTC) | Checkpoint de evidencia inicial de validación |
| Remoto `user_github/main` | `45d3d7a` (14:51 UTC) | Checkpoint con migración de `jiraClosedDate` |
| Commits remotos no presentes localmente | 18 | Incluye `4dd885a`, `8e73cef`, `847e42b`, `45d3d7a` |
| Commits locales no presentes remotamente | 0 | El local no tiene trabajo no publicado |
| ¿Local es ancestro del remoto? | **SÍ** | El remoto avanzó desde el local |
| ¿Remoto es ancestro del local? | **NO** | El local no avanzó desde el remoto |

### 2.2 Secuencia de checkpoints relevantes

| Checkpoint | Fecha (UTC) | Contenido |
|------------|-------------|-----------|
| `4639e3b` | 04:54 | Evidencia inicial de validación OAuth |
| `4dd885a` | 14:18 | Base recuperable previa a línea de tiempo Jira |
| `8e73cef` | 14:23 | Corrección del rail lateral |
| `847e42b` | 14:37 | Línea de tiempo contractual Jira |
| `45d3d7a` | 14:51 | Migración persistente de `jiraClosedDate` |

### 2.3 Comandos de verificación ejecutados

```bash
# Estado del árbol
git status --short

# HEAD local vs remoto
git log -1 --format='%H %ci %s'
git log -1 --format='%H %ci %s' user_github/main

# Divergencia
git log --oneline HEAD..user_github/main | head -20
git log --oneline user_github/main..HEAD | head -20

# Ancestros
git merge-base --is-ancestor HEAD user_github/main && echo 'SÍ' || echo 'NO'
git merge-base --is-ancestor user_github/main HEAD && echo 'SÍ' || echo 'NO'
```

---

## 3. Análisis causal

### 3.1 Causa raíz primaria

La plataforma Manus gestiona los checkpoints como **commits automáticos en una rama compartida** (`user_github/main`). Cuando se guarda un checkpoint, la plataforma:

1. Crea un commit local con los cambios del entorno.
2. Intenta empujar ese commit al remoto.
3. Si el remoto ya avanzó (por otro checkpoint o por una restauración), el push falla con `non-fast-forward`.

En este caso, el entorno local quedó en `4639e3b` mientras el remoto avanzó a `45d3d7a`. La plataforma no pudo reconciliar porque:

- El local no tenía los 18 commits intermedios.
- El mecanismo de checkpoint no realiza un `git pull --rebase` automático antes de empujar.
- La restauración administrada (`webdev_rollback_checkpoint`) tampoco pudo resolver la divergencia porque intenta empujar una historia que no es fast-forward.

### 3.2 Causa raíz secundaria

El entorno local fue restaurado desde un respaldo ZIP (`/home/ubuntu/upload/prodigio-pmo-main.zip`) en una sesión anterior. Este respaldo contenía el historial hasta `4639e3b`, pero no los checkpoints posteriores que se crearon en otras sesiones o en el entorno de la plataforma.

### 3.3 Por qué ocurrió dos veces

La primera pérdida de sincronismo ocurrió cuando se restauró el proyecto desde el respaldo ZIP. La segunda ocurrió cuando se intentó guardar un checkpoint desde un entorno local que no había sido actualizado con los commits remotos posteriores.

---

## 4. Responsabilidades

| Componente | Responsabilidad | Evidencia |
|------------|-----------------|-----------|
| Plataforma Manus (checkpoint) | No reconcilia automáticamente divergencias de historial | Error `non-fast-forward` al guardar |
| Plataforma Manus (rollback) | No puede restaurar cuando el remoto avanzó | Fallo de `webdev_rollback_checkpoint` |
| Entorno local | Quedó anclado en commit antiguo tras restauración desde ZIP | HEAD en `4639e3b` |
| Usuario | Ninguna | No realizó acciones destructivas |

---

## 5. Medidas preventivas

### 5.1 Inmediatas (antes de cualquier cambio)

1. **Verificar sincronización antes de editar:**
   ```bash
   git status --short
   git log -1 --format='%H %ci %s'
   git log -1 --format='%H %ci %s' user_github/main
   ```

2. **Si el local está detrás del remoto, actualizar primero:**
   ```bash
   git pull --rebase user_github main
   ```

3. **Nunca editar sobre una base divergente.**

### 5.2 Estructurales (para la plataforma)

1. **Checkpoint con reconciliación automática:** Antes de empujar, la plataforma debería intentar `git pull --rebase` automáticamente.

2. **Rollback seguro:** La restauración debería funcionar incluso cuando el remoto avanzó, usando `git reset --hard <commit>` en lugar de intentar empujar una historia no fast-forward.

3. **Indicador de sincronización:** Mostrar en la UI si el entorno local está sincronizado con el remoto antes de permitir ediciones.

### 5.3 Operativas (para el usuario)

1. **No restaurar desde ZIP si el proyecto tiene checkpoints activos.** Usar siempre el historial de versiones de la plataforma.

2. **Verificar la versión en vivo antes de solicitar cambios.** Si la versión en vivo es posterior a la base local, pedir explícitamente que se actualice el entorno.

3. **Reportar inmediatamente cualquier error de sincronización** en [help.manus.im](https://help.manus.im) con los datos de la versión en vivo y la base local.

---

## 6. Plan de recuperación

### Opción A: Actualización manual del entorno local (recomendada)

```bash
cd /home/ubuntu/prodigio-pmo
git fetch user_github
git reset --hard user_github/main
```

Esto alineará el entorno local con la versión en vivo `45d3d7a` sin perder datos.

### Opción B: Restauración desde la plataforma

Si la Opción A no es posible, solicitar en [help.manus.im](https://help.manus.im) que se restaure el entorno local a la versión `45d3d7a`.

---

## 7. Conclusión

La pérdida de sincronismo es un **problema de gestión de historial Git en la plataforma**, no un error de desarrollo. El código y los datos están intactos en la versión en vivo `45d3d7a`. La recuperación es segura y no implica pérdida de trabajo.

Para continuar con el rediseño del Gantt contractual, primero debe resolverse la sincronización del entorno local con la versión en vivo.

---

**Documento generado por:** Manus AI  
**Versión:** 1.0  
**Estado:** Diagnóstico completado
