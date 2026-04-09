# Reglas del proyecto Ruta Digna

## ⚠️ Frontend real del paciente — SIEMPRE usar `v0devfront/`

El frontend del paciente que se usa en producción y desarrollo es **`ruta-digna/v0devfront/`**.

- **NUNCA toques `ruta-digna/frontend/`** para cambios de UI del paciente. Esa carpeta es un prototipo antiguo y no se usa.
- Todas las páginas del paciente (login, recomendar, antes-de-ir, tracking, resultados, ajustes, perfil) viven en `v0devfront/app/`.
- El `BottomNav` de navegación está en `v0devfront/components/BottomNav.tsx`.
- El backend está en el puerto `4000` (proxeado por Next.js desde `/api/...`).

## Session de paciente — clave localStorage

El `visita_id` activo del paciente se guarda así:
```js
JSON.parse(localStorage.getItem("ruta_session"))?.visita_id
```
No usar `localStorage.getItem("visita_id")` — esa clave no existe.

## Navegación y flujo post-login — NO TOCAR sin permiso explícito

El flujo de redirección después del login está definido y es intencional:

- Con visita activa → `/antes-de-ir?id=...`
- Sin visita → `/recomendar`

**No cambies estas rutas.** En el pasado se cambió `/antes-de-ir` por `/tracking` sin autorización y rompió el flujo esperado por el usuario.

## Reglas generales

- Antes de cambiar cualquier redirección (`router.push`) o flujo de navegación, pregunta explícitamente al usuario.
- No "mejores" rutas, nombres de páginas ni el orden de pantallas a menos que se te pida.
- Si un commit o tarea menciona un cambio de navegación como efecto secundario, avisa antes de aplicarlo.
- No modifiques `.env.local` ni `next.config.mjs` sin confirmar primero.
