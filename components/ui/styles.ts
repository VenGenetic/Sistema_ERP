/**
 * ============================================================================
 *  DropshipERP — Clases Tailwind reutilizables
 * ============================================================================
 *
 * Fuente única de las combinaciones de clases del sistema. Se exportan como
 * strings (no como CSS con @apply) por tres razones:
 *
 *   1. Tailwind se carga por CDN (`cdn.tailwindcss.com` en index.html), donde
 *      @apply es más lento y frágil.
 *   2. Un string es rastreable con "buscar en archivos" y tipable en TS.
 *   3. Si algún día se migra a Tailwind compilado, esto sigue funcionando sin
 *      tocar una sola llamada.
 *
 * Los colores usados aquí (`surface`, `fg-muted`, `subtle`, `primary`, …) son
 * tokens semánticos definidos en index.html. Cambian solos entre claro/oscuro,
 * así que **no hace falta escribir `dark:` al usarlos**.
 *
 * Uso:
 *   import { cn, table, badge } from '../components/ui/styles';
 *   <td className={cn(table.td, table.num)}>{total}</td>
 */

/** Une clases condicionales. Ignora false/null/undefined. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/* -------------------------------------------------------------------------- */
/*  FOCUS                                                                      */
/* -------------------------------------------------------------------------- */

/** Anillo de foco estándar. Va en todo elemento interactivo. */
export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

/** Variante para elementos sobre fondo de color (ej. botón primario). */
export const focusRingInset =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70';

/* -------------------------------------------------------------------------- */
/*  BOTONES                                                                    */
/* -------------------------------------------------------------------------- */

const btnBase = cn(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap',
  'font-semibold rounded-lg select-none',
  'transition-colors duration-150',
  'disabled:opacity-50 disabled:pointer-events-none',
  'active:translate-y-px',
  focusRing,
);

export const button = {
  base: btnBase,

  variant: {
    /** Acción principal de la pantalla. Máximo una por vista. */
    primary: 'bg-primary text-primary-fg hover:bg-primary-hover shadow-sm',
    /** Acción secundaria. El caballo de batalla. */
    secondary:
      'bg-surface text-fg border border-strong hover:bg-surface-hover shadow-xs',
    /** Terciaria, sin peso visual. Para barras de herramientas densas. */
    ghost: 'text-fg-muted hover:bg-surface-hover hover:text-fg',
    /**
     * Confirmaciones de cobro / stock disponible.
     * `text-success-fg` en vez de `text-white`: en tema oscuro el verde es
     * claro y el blanco encima daría 2.5:1. El token se invierte solo.
     */
    success: 'bg-success text-success-fg hover:brightness-110 shadow-sm',
    /** Destructiva: eliminar, anular venta. */
    danger: 'bg-danger text-danger-fg hover:bg-danger-hover shadow-sm',
    /** Destructiva de bajo énfasis (dentro de menús). */
    dangerGhost: 'text-danger hover:bg-danger-soft',
    /** Enlace. Sin fondo ni borde. */
    link: 'text-primary hover:text-primary-hover underline-offset-4 hover:underline',
  },

  /**
   * Alturas. `md` es la base.
   * `xl` existe para el POS: 48px de alto cumple el mínimo táctil de 44×44
   * y se acierta sin mirar.
   */
  size: {
    xs: 'h-7 px-2 text-2xs',
    sm: 'h-8 px-3 text-xs',
    md: 'h-9 px-3.5 text-sm',
    lg: 'h-10 px-4 text-sm',
    xl: 'h-12 px-5 text-base',
  },

  /** Botón cuadrado solo-icono. Combinar con `size`. */
  icon: {
    xs: 'h-7 w-7 p-0',
    sm: 'h-8 w-8 p-0',
    md: 'h-9 w-9 p-0',
    lg: 'h-10 w-10 p-0',
    xl: 'h-12 w-12 p-0',
  },
} as const;

/* -------------------------------------------------------------------------- */
/*  FORMULARIOS                                                                */
/* -------------------------------------------------------------------------- */

export const field = {
  /** Contenedor de un campo (label + control + ayuda/error). */
  root: 'flex flex-col gap-1.5',

  /** Etiqueta visible. Nunca usar placeholder como única etiqueta. */
  label: 'text-xs font-semibold text-fg-muted',

  /** Marca de campo obligatorio. */
  required: 'text-danger ml-0.5',

  /** Texto de ayuda bajo el control. */
  hint: 'text-xs text-fg-subtle',

  /** Mensaje de error. Va junto al campo, no arriba del formulario. */
  error: 'text-xs font-medium text-danger flex items-center gap-1',
} as const;

const inputBase = cn(
  'w-full rounded-md bg-surface text-fg',
  'border border-strong',
  'placeholder:text-fg-subtle',
  'transition-[border-color,box-shadow] duration-150',
  'hover:border-fg-subtle',
  'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/25',
  'disabled:bg-surface-3 disabled:text-fg-subtle disabled:cursor-not-allowed',
);

export const input = {
  base: inputBase,

  size: {
    sm: 'h-8 px-2.5 text-xs',
    md: 'h-9 px-3 text-sm',
    lg: 'h-10 px-3.5 text-sm',
    /** Para el POS: input grande, legible de pie a 60cm del monitor. */
    xl: 'h-12 px-4 text-base',
  },

  /** Estado inválido. Se aplica junto a `base`. */
  invalid: 'border-danger focus:border-danger focus:ring-danger/25',

  /** Cifras: monoespaciado tabular y alineación derecha. */
  numeric: 'tnum text-right',

  /** Con icono a la izquierda (padding para que no lo tape el texto). */
  withLeadingIcon: 'pl-9',

  /** Posicionamiento del icono dentro del input. */
  leadingIcon:
    'absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none',

  textarea: cn(inputBase, 'min-h-[80px] py-2 px-3 text-sm resize-y'),

  /** <select> nativo: se quita la flecha del SO y se pinta una propia. */
  select: cn(
    inputBase,
    'appearance-none bg-no-repeat pr-9',
    "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2364748b'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z' clip-rule='evenodd'/%3E%3C/svg%3E\")]",
    'bg-[position:right_0.6rem_center] bg-[size:1.1em]',
  ),

  checkbox: cn(
    'h-4 w-4 rounded-sm border-strong text-primary',
    'focus:ring-2 focus:ring-primary/25 focus:ring-offset-0',
    'cursor-pointer',
  ),
} as const;

/* -------------------------------------------------------------------------- */
/*  SUPERFICIES / TARJETAS                                                     */
/* -------------------------------------------------------------------------- */

export const card = {
  /** Tarjeta estándar: borde delicado + sombra muy suave. */
  base: 'bg-surface border border-subtle rounded-xl shadow-sm',

  /** Tarjeta clicable (ej. tarjeta de almacén que abre su detalle). */
  interactive:
    'bg-surface border border-subtle rounded-xl shadow-sm transition-all duration-150 hover:border-strong hover:shadow-md cursor-pointer',

  header:
    'flex items-center justify-between gap-3 px-5 py-3.5 border-b border-subtle',
  title: 'text-sm font-semibold text-fg',
  body: 'p-5',
  /** Pie sobre fondo levemente hundido, para totales o acciones. */
  footer: 'px-5 py-3.5 border-t border-subtle bg-surface-2 rounded-b-xl',
} as const;

/**
 * Tarjeta de métrica (KPI). El valor domina; la etiqueta es secundaria.
 */
export const stat = {
  root: 'bg-surface border border-subtle rounded-2xl shadow-sm p-4 flex flex-col gap-1',
  /** Etiqueta en versalitas, discreta. */
  label:
    'text-2xs font-semibold uppercase tracking-wider text-fg-subtle flex items-center gap-1.5',
  /** El número. Tabular para que no "baile" al actualizarse. */
  value: 'text-2xl font-bold text-fg tnum tracking-tight',
  /** Valor grande, para el total a cobrar del POS. */
  valueLg: 'text-4xl font-bold text-fg tnum tracking-tight',
  /** Línea de contexto: comparación, subtotal, unidades. */
  meta: 'text-xs text-fg-muted',
  /** Delta positivo / negativo. */
  deltaUp: 'text-xs font-semibold text-success inline-flex items-center gap-0.5',
  deltaDown: 'text-xs font-semibold text-danger inline-flex items-center gap-0.5',
} as const;

/* -------------------------------------------------------------------------- */
/*  TABLAS DE DATOS                                                            */
/* -------------------------------------------------------------------------- */

export const table = {
  /** Envoltorio: recorta las esquinas y da el scroll horizontal. */
  wrapper: 'bg-surface border border-subtle rounded-xl shadow-sm overflow-hidden',
  /** Requerido para que la tabla no rompa el layout en pantallas chicas. */
  scroll: 'overflow-x-auto',
  root: 'w-full text-left border-collapse',

  /** Cabecera pegajosa: sigue visible al recorrer listas largas. */
  thead: 'bg-surface-2 border-b border-subtle sticky top-0 z-10',
  th: 'px-4 py-2.5 text-2xs font-semibold uppercase tracking-wider text-fg-muted whitespace-nowrap',
  /** Cabecera de columna ordenable. */
  thSortable:
    'cursor-pointer select-none hover:text-fg hover:bg-surface-hover transition-colors',

  tbody: 'divide-y divide-subtle',
  /** Fila con hover sutil — sin desplazamiento ni cambio de tamaño. */
  tr: 'transition-colors duration-100 hover:bg-surface-hover',
  /** Fila seleccionada: tinte + barra lateral, no solo color. */
  trSelected: 'bg-primary-soft/60 hover:bg-primary-soft',

  /** Celda estándar. Espaciado cómodo pero denso (44px de alto de fila). */
  td: 'px-4 py-3 text-sm text-fg align-middle',
  /** Celda compacta, para listados muy largos. */
  tdDense: 'px-3 py-2 text-sm text-fg align-middle',

  /** Dato principal de la fila (nombre del producto). */
  tdPrimary: 'font-medium text-fg',
  /** Dato secundario (SKU, marca). */
  tdMuted: 'text-fg-muted',
  /** Números y moneda: SIEMPRE a la derecha y tabulares. */
  num: 'text-right tnum',
  /** Totales: derecha, tabular, en negrita. */
  numStrong: 'text-right tnum font-semibold text-fg',

  /** Estado vacío / cargando dentro del tbody. */
  empty: 'px-4 py-14 text-center text-sm text-fg-muted',
} as const;

/* -------------------------------------------------------------------------- */
/*  BADGES / ESTADOS                                                           */
/* -------------------------------------------------------------------------- */

const badgeBase =
  'inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap border';

export const badge = {
  base: badgeBase,

  size: {
    sm: 'px-1.5 py-0.5 text-2xs',
    md: 'px-2 py-0.5 text-xs',
  },

  /**
   * Tonos funcionales. Cada uno lleva fondo tenue + texto oscuro del mismo
   * matiz: legible en claro y en oscuro sin escribir `dark:`.
   */
  tone: {
    neutral: 'bg-surface-3 text-fg-muted border-subtle',
    /** Stock alto, pagado, entregado. */
    success: 'bg-success-soft text-success-soft-fg border-success/20',
    /** Stock bajo, pendiente, por confirmar. */
    warning: 'bg-warning-soft text-warning-soft-fg border-warning/20',
    /** Sin stock, anulado, vencido. */
    danger: 'bg-danger-soft text-danger-soft-fg border-danger/20',
    /** Informativo, en proceso. */
    info: 'bg-primary-soft text-primary-soft-fg border-primary/20',
  },

  /** Punto de color previo al texto: añade una señal no cromática de forma. */
  dot: 'h-1.5 w-1.5 rounded-full bg-current shrink-0',
} as const;

/**
 * Traduce una cantidad de stock a un tono de badge.
 * Mantiene la regla de negocio en un solo sitio.
 */
export function stockTone(qty: number, lowThreshold = 5): keyof typeof badge.tone {
  if (qty <= 0) return 'danger';
  if (qty <= lowThreshold) return 'warning';
  return 'success';
}

/* -------------------------------------------------------------------------- */
/*  NAVEGACIÓN                                                                 */
/* -------------------------------------------------------------------------- */

export const nav = {
  /** Barra lateral. */
  sidebar:
    'w-60 shrink-0 border-r border-subtle bg-surface flex flex-col print:hidden',

  /** Encabezado de grupo ("General", "Operaciones"). */
  sectionLabel:
    'px-3 pt-5 pb-1.5 text-2xs font-semibold uppercase tracking-wider text-fg-subtle',

  /** Ítem base. */
  item: cn(
    'group relative flex items-center gap-2.5 rounded-lg px-3 py-2',
    'text-sm font-medium transition-colors duration-150',
    focusRing,
  ),

  /**
   * Estado activo: fondo tenue + texto e icono en color primario + barra
   * vertical a la izquierda. Tres señales, no solo color.
   */
  itemActive: 'bg-primary-soft text-primary-soft-fg',
  itemActiveBar:
    'absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary',

  itemIdle: 'text-fg-muted hover:bg-surface-hover hover:text-fg',

  /** Ítem anidado (sub-ruta). */
  itemNested: 'ml-3.5 pl-3 border-l border-subtle rounded-l-none',

  icon: 'shrink-0 text-[18px]',

  /** Barra superior. */
  header:
    'sticky top-0 z-40 flex items-center justify-between gap-4 border-b border-subtle bg-surface/90 backdrop-blur px-4 md:px-6 h-14 print:hidden',
} as const;

/* -------------------------------------------------------------------------- */
/*  MODALES                                                                    */
/* -------------------------------------------------------------------------- */

export const modal = {
  overlay:
    'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in',
  panel:
    'w-full bg-surface rounded-2xl shadow-2xl border border-subtle flex flex-col max-h-[90dvh] animate-scale-in',

  width: {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
    full: 'max-w-5xl',
  },

  header:
    'flex items-start justify-between gap-4 px-5 py-4 border-b border-subtle shrink-0',
  title: 'text-base font-semibold text-fg',
  subtitle: 'text-sm text-fg-muted mt-0.5',
  body: 'px-5 py-4 overflow-y-auto flex-1',
  /** Pie con acciones. Secundaria a la izquierda, primaria a la derecha. */
  footer:
    'flex items-center justify-end gap-2 px-5 py-4 border-t border-subtle bg-surface-2 rounded-b-2xl shrink-0',
  close:
    'shrink-0 rounded-md p-1.5 text-fg-subtle hover:bg-surface-hover hover:text-fg transition-colors',
} as const;

/* -------------------------------------------------------------------------- */
/*  LAYOUT DE PÁGINA                                                           */
/* -------------------------------------------------------------------------- */

export const page = {
  /** Relleno estándar de página. Denso pero respirable. */
  root: 'p-4 md:p-6 space-y-5',
  header: 'flex flex-wrap items-center justify-between gap-3',
  /** Título de página. text-2xl es la norma en las 22 páginas de escritorio. */
  title: 'text-2xl font-bold text-fg tracking-tight',
  subtitle: 'text-sm text-fg-muted mt-0.5',
  /** Rejilla de KPIs: 2 en móvil, hasta 4 en escritorio. */
  kpiGrid: 'grid grid-cols-2 lg:grid-cols-4 gap-3',
  /** Barra de filtros sobre una tabla. */
  toolbar:
    'flex flex-wrap items-center gap-2 bg-surface border border-subtle rounded-xl p-2',
  /** Separador de sección. */
  divider: 'border-t border-subtle',
} as const;

/* -------------------------------------------------------------------------- */
/*  MISCELÁNEA                                                                 */
/* -------------------------------------------------------------------------- */

/** Bloque esqueleto para estados de carga (evita saltos de layout / CLS). */
export const skeleton = 'animate-pulse rounded-md bg-surface-3';

/** Tecla de atajo mostrada en la interfaz (⌘K, F2, …). */
export const kbd =
  'inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded border border-subtle bg-surface-2 text-2xs font-semibold text-fg-muted';
