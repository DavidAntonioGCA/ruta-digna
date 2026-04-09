# Reglas del proyecto Ruta Digna

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
