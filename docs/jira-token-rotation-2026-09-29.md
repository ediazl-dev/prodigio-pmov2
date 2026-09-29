# Rotación segura del token Jira

**Fecha:** 29-sep-2026  
**Estado:** implementado y validado

## Síntoma

La pantalla administrativa mostraba el token como “Expirado” después de ingresar una credencial nueva.

## Diagnóstico

Se confirmaron dos problemas distintos:

1. La credencial persistida anterior recibía HTTP 401 de Atlassian.
2. El cliente Jira calculaba la cabecera Basic una sola vez al cargar el módulo. El procedimiento `updateToken` validaba el token nuevo y actualizaba `process.env`, pero las llamadas posteriores seguían usando la cabecera antigua hasta reiniciar el servidor.

Además, un HTTP 401 no demuestra por sí solo que el token expiró: también puede significar token inválido, revocado o perteneciente a otra cuenta distinta de `JIRA_EMAIL`.

## Corrección

- Todas las APIs Jira, JSM y Agile leen `JIRA_BASE_URL`, `JIRA_EMAIL` y `JIRA_API_TOKEN` en tiempo de ejecución.
- El token validado se activa inmediatamente en el proceso actual.
- La entrada se normaliza para evitar espacios accidentales.
- La pantalla distingue “autenticación rechazada” de una expiración confirmada y muestra mensajes específicos para HTTP 401 y 403.
- `JIRA_API_TOKEN` quedó persistido en el gestor seguro del proyecto; no se guardó en código, base de datos ni logs.
- Se añadió una prueba live opt-in y GET-only contra `/rest/api/3/myself`.

## Validación

- `/myself`: autenticación aprobada con la cuenta configurada.
- Pantalla Administración → Token Jira: estado **Activo**.
- Usuario autenticado: `ediazl@prodigio.tech`.
- La prueba de regresión confirma que cambiar el token cambia la cabecera usada sin reiniciar el módulo.
- Las operaciones de validación fueron exclusivamente de lectura.
- Suite determinista: **1.108 pruebas aprobadas y 20 omitidas**.
- Build productivo: aprobado.
- TypeScript: permanecen sólo los cinco errores heredados ya conocidos, sin regresiones nuevas.
