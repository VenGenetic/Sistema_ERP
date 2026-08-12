# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Modo Movil Industrial
**Generated:** 2026-07-29 23:32:12
**Category:** Inventory & Stock Management
**Design Dials:** Variance 6/10 (Balanced / Modern) | Motion 5/10 (Standard) | Density 7/10 (Standard)

---

## Global Rules

### Color Palette

> **Actualizado 2026-08-11.** Esta tabla describía una interfaz clara con acento
> verde que nunca llegó a implementarse: el modo móvil se construyó **oscuro y
> con acento ámbar**, y así se quedó en Catálogo, Inventario y Etiquetas. Se
> corrige el documento para que refleje el código, no al revés — reescribir tres
> pantallas para perseguir un spec que nadie siguió no aporta nada. El ámbar
> además funciona mejor aquí: es el color de la impresión de etiquetas, que es
> la acción central de este modo, y destaca sobre fondo oscuro sin competir con
> el verde de "hay stock" ni con el rojo de "agotado".

| Role | Hex | Uso |
|------|-----|-----|
| Background | `#020617` (slate-950) | Fondo de la aplicación |
| Surface | `#0F172A` (slate-900) | Tarjetas, hojas inferiores, barras |
| Surface alt | `#1E293B` (slate-800) | Controles, fichas, campos |
| Border | `#1E293B` / `#334155` | Canto de tarjeta / canto de control |
| Foreground | `#FFFFFF` | Títulos y descripciones |
| Foreground muted | `#CBD5E1` (slate-300) | Dato secundario |
| Foreground subtle | `#64748B` (slate-500) | Etiquetas, pistas |
| **Accent / CTA** | `#F59E0B` (amber-500) | Acción principal, selección, etiquetas |
| On accent | `#020617` | Texto sobre ámbar (13.9:1) |
| Success / stock | `#10B981` (emerald-500) | Hay existencias |
| Destructive | `#F43F5E` (rose-500) | Eliminar, agotado, descontinuado |
| Info | `#22D3EE` (cyan-400) | Repuestos equivalentes |

**Color Notes:** Slate industrial oscuro + acento ámbar de impresión. El verde
queda reservado para "hay stock", nunca para acciones.

### Tamaños táctiles y de texto

Reglas duras, comprobadas en el Catálogo:

| Regla | Valor | Motivo |
|-------|-------|--------|
| Zona táctil mínima | **44 × 44 px** | Por debajo se falla el toque y se dispara la acción vecina |
| Texto de cuerpo | **15 px** | Descripciones de repuesto |
| Texto secundario | **12 px mínimo** | Marca, contadores, metadatos |
| Peso máximo | **700 (bold)** | `font-black`/`extrabold` a 11px se empasta y se lee peor |
| Radio de tarjeta | **16 px** (`rounded-2xl`) | 24px comía ancho útil en pantallas de 360px |

> **No hay `hover` en una pantalla táctil.** Un botón cuya única explicación sea
> el atributo `title` es un botón sin explicación: si la acción no es evidente
> por el icono, lleva texto al lado.

### Typography

- **Heading Font:** Inter
- **Body Font:** Inter
- **Mood:** dark, cinematic, technical, precision, clean, premium, developer, professional, high-end utility
- **Google Fonts:** [Inter + Inter](https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap)

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
```

### Spacing Variables

*Density: 7/10 — Standard*

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

> Se documentan con clases de Tailwind porque es lo que usa el código. Las
> versiones anteriores describían botones claros con `:hover` y `translateY`,
> que en una pantalla táctil no ocurre nunca: el estado que sí existe es
> `:active`, y es el que debe dar la respuesta al dedo.

### Botones

```jsx
/* Principal — una sola por pantalla */
className="min-h-[48px] px-4 rounded-xl bg-amber-500 text-slate-950
           font-bold text-sm active:bg-amber-600"

/* Secundario — el caballo de batalla */
className="min-h-[48px] px-4 rounded-xl bg-slate-900 border border-slate-700
           text-slate-200 font-semibold text-sm active:bg-slate-800"

/* Dentro de una hoja o tarjeta */
className="min-h-[52px] px-3 rounded-xl bg-slate-800 border border-slate-700
           text-slate-200 font-semibold text-sm active:bg-slate-700"

/* Destructivo */
className="min-h-[52px] px-3 rounded-xl bg-rose-500/10 border border-rose-500/30
           text-rose-300 font-semibold active:bg-rose-500/20"

/* Solo icono — nunca por debajo de 44px */
className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center"
```

### Tarjetas

```jsx
className="bg-slate-900 rounded-2xl border border-slate-800"
/* Seleccionada: tinte + borde, sin mover nada de sitio */
className="bg-amber-500/5 border-amber-500"
```

Sin `:hover` y sin `transform`: desplazar una tarjeta bajo el dedo mientras se
recorre la lista se lee como un fallo, no como una respuesta.

### Campos

```jsx
className="min-h-[48px] px-4 bg-slate-800 border border-slate-700 rounded-xl
           text-slate-200 text-base focus:border-amber-500 outline-none"
```

`font-size` de 16px como mínimo: por debajo, iOS hace zoom automático al enfocar
el campo y descoloca toda la pantalla.

**Preferir fichas a `<select>`.** Un desplegable nativo abre la rueda del sistema
operativo — tres gestos para elegir entre tres opciones. Un grupo de fichas se
resuelve en un toque y además deja ver qué hay elegido sin abrir nada.

### Hojas inferiores (en vez de modales centrados)

```jsx
/* Fondo */
className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm"
/* Panel */
className="bg-slate-900 rounded-t-3xl border-t border-slate-700
           max-h-[85vh] flex flex-col"
```

Todo lo que se pueda tocar entra por abajo. Un diálogo centrado deja sus botones
en mitad de la pantalla, fuera del arco del pulgar; una hoja inferior los deja
justo donde está la mano.

### Zonas de alcance

El tercio inferior es la zona cómoda. Ahí van buscar-filtrar-ordenar-crear y las
acciones en lote. La cabecera sirve para leer (título, contador) y para el campo
de búsqueda, que se enfoca por teclado o por lector físico, no por pulgar.

### Gestos

| Gesto | Acción | Nota |
|-------|--------|------|
| Tirar hacia abajo desde arriba | Recargar el catálogo | Con resistencia (÷2.2) para que no se dispare solo |
| Deslizar la tarjeta a la izquierda | Descubre "Cola" e "Imprimir" | Sólo engancha si `abs(dx) > abs(dy) * 1.4`, si no se abriría al hacer scroll |
| Tocar la tarjeta | Desplegar / plegar | La zona de selección va aparte, con sus 44px |

---

## Style Guidelines

**Style:** Modern Dark (Cinema Mobile)

**Keywords:** dark mode, cinematic, ambient light, glassmorphism, deep black, indigo, glow, blur, atmospheric, reanimated, haptic, premium, layered, frosted glass, linear gradient

**Best For:** Developer tools, pro productivity apps, fintech/trading dashboards, media/streaming platforms, AI tool interfaces, high-end gaming companion apps

**Key Effects:** Expo.out Bezier(0.16,1,0.3,1) easing; spring modals (damping:20 stiffness:90); haptic-linked press (Impact Light/Medium); animated ambient light blobs (Reanimated translateX/Y slow oscillation); BlurView glassmorphism headers/nav (intensity 20); scale press 0.97 → 1.0; avoid pure #000000 (OLED smear)

### Page Pattern

**Pattern Name:** Feature-Rich Showcase

- **CTA Placement:** Above fold
- **Section Order:** Hero > Features > CTA

---

## Motion

**Stagger List** (Standard) — Trigger: load or scroll | Duration: 300-450ms | Easing: `back.out(1.4)`

```js
gsap.from('.grid-item', { opacity: 0, scale: 0.92, y: 16, duration: 0.4, stagger: { each: 0.06, from: 'start', grid: 'auto' }, ease: 'back.out(1.4)' });
```

**Framework notes:** grid: 'auto' lets GSAP infer rows/columns from a CSS grid layout for a natural wave stagger

- ✅ Combine with from: 'center' for a bento-grid layout to draw the eye inward first
- ❌ Don't use back.out on dense data tables; the overshoot reads as sloppy on informational UI
- ⚡ Group DOM writes; avoid interleaving layout reads (getBoundingClientRect) between staggered tweens

---

## Anti-Patterns (Do NOT Use)

- ❌ Excessive decoration
- ❌ Complex shadows
- ❌ 3D effects

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Reescrita para una interfaz **táctil y oscura**. La versión anterior pedía
comprobar el modo claro, los estados `:hover` y anchos de 1024/1440px: nada de
eso existe aquí.

- [ ] Cero emoji haciendo de icono — todos de **lucide-react**, el mismo set que el escritorio
- [ ] Toda zona táctil mide **44 × 44 px** como mínimo
- [ ] Ningún botón depende de `title` para explicarse: si el icono no basta, lleva texto
- [ ] Respuesta al dedo con `active:`, no con `hover:`
- [ ] Texto de cuerpo ≥ 15px; ningún texto por debajo de 12px
- [ ] Campos de texto a 16px (por debajo, iOS hace zoom al enfocar)
- [ ] Contraste 4.5:1 sobre fondo oscuro
- [ ] `prefers-reduced-motion` respetado
- [ ] Nada tapado por la barra inferior **ni por su botón central**, que sobresale hasta ~108px
- [ ] Probado a 360px de ancho (no sólo 375px: el Android más común es más estrecho)
- [ ] Sin scroll horizontal
- [ ] Las acciones frecuentes caen en el tercio inferior de la pantalla
