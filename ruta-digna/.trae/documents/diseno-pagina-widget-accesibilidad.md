# Diseño de página — Widget de accesibilidad (menú flotante)

## Enfoque
Desktop-first. El widget vive en todas las páginas del sitio y se superpone sin romper el layout existente.

## Global Styles (tokens sugeridos)
- Z-index del widget: `z-50` (o superior a nav/modales existentes).
- Superficie del panel: fondo `#FFFFFF` (modo normal) / `#0B0F14` (modo oscuro) con borde sutil.
- Tipografía base (sin widget): la existente del sitio.
- Estados interactivos:
  - Focus: outline visible (2px) + offset.
  - Hover: aumentar contraste del botón y resaltar ítems.
  - Disabled: opacidad 0.5 y cursor default.
- Aplicación global de preferencias:
  - Usar atributos en `html` (p. ej. `data-a11y-font-scale`, `data-a11y-contrast`, `data-a11y-tools`) y/o CSS variables para que el cambio afecte a todo el sitio.

## Página: Todas las páginas (sitio existente)

### Meta Information
- Title/Description: sin cambios (heredado de cada página).
- Open Graph: sin cambios.

### Layout
- Contenido principal: sin cambios.
- Widget flotante: `position: fixed` anclado abajo-derecha.
- Breakpoints (desktop-first):
  - ≥1024px: panel de 360–420px de ancho, altura máx. 70vh, con scroll interno.
  - 768–1023px: panel 320–360px.
  - <768px: el panel puede ocupar ancho casi completo (margen 12–16px) manteniendo botón accesible.

### Page Structure
- Capa base: página existente.
- Capa overlay: widget de accesibilidad.

### Secciones & Componentes

#### 1) Botón flotante (launcher)
- Ubicación: esquina inferior derecha (márgenes 16–24px).
- Contenido: ícono + label accesible (p. ej. “Accesibilidad”).
- Comportamiento:
  - Click/Enter/Espacio: abrir/cerrar el panel.
  - Atributos: `aria-expanded`, `aria-controls` apuntando al panel.
  - Estado: mostrar visualmente cuando está activo.

#### 2) Panel/Menú flotante
- Contenedor: tarjeta/sheet con sombra moderada y bordes redondeados.
- Header:
  - Título: “Accesibilidad”.
  - Botón cerrar: visible y accesible.
- Cuerpo: lista de secciones (idealmente acordeón, si así viene en el HTML).
- Footer (opcional según HTML):
  - Botón “Restablecer” (destructivo/neutral) + confirmación ligera si el sitio lo requiere.
- Interacción y accesibilidad:
  - Cierre por `Esc`.
  - Orden de tabulación lógico.
  - Si actúa como diálogo modal: trap de foco dentro del panel y `aria-modal="true"`.

#### 3) Sección “Tipografía”
- Controles (según opciones del HTML):
  - Tamaño de texto: botones A- / A+ y/o slider con pasos.
  - Interlineado / espaciado: toggles o selectores si existen.
  - Fuente accesible (si existe): toggle “Fuente legible”.
- Feedback:
  - Mostrar valor actual (p. ej. 100%, 110%, 120%).

#### 4) Sección “Contraste”
- Controles:
  - Toggle “Alto contraste” y/o “Invertir colores”.
  - Alternancia de tema (claro/oscuro) si está contemplado por el HTML.
- Reglas visuales:
  - Asegurar contraste mínimo en el propio panel (texto/botones).

#### 5) Sección “Herramientas”
- Controles típicos (solo si aparecen en el HTML dado):
  - “Resaltar enlaces”.
  - “Subrayar títulos”.
  - “Escala de grises”.
  - “Ocultar imágenes”.
  - “Pausar animaciones”.
- Cada herramienta: switch con descripción corta (1 línea) y estado persistente.

#### 6) Persistencia (comportamiento transversal)
- Al cambiar cualquier control: guardar inmediatamente en localStorage.
- Al cargar página/navegar: restaurar preferencias antes de pintar (o lo más temprano posible) para minimizar “flash” visual.
- Botón “Restablecer”: volver a defaults y limpiar localStorage.

## Estados y microinteracciones
- Transición de apertura: slide/fade 150–220ms.
- Indicadores de estado: switches/checkboxes con label + descripción.
- Errores: no se esperan (sin red); si localStorage falla, degradar sin persistencia.
