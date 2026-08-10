import React from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown, Loader2, SearchX } from 'lucide-react';
import { cn, table } from './styles';

/* -------------------------------------------------------------------------- */
/*  Envoltorios                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Contenedor de tabla. El scroll horizontal vive aquí, no en la página:
 * así una tabla ancha nunca desborda el layout en tablet/móvil.
 */
export const TableWrapper: React.FC<{
  className?: string;
  /** Alto máximo; habilita la cabecera pegajosa. Ej. "max-h-[70vh]". */
  maxHeight?: string;
  children: React.ReactNode;
}> = ({ className, maxHeight, children }) => (
  <div className={cn(table.wrapper, className)}>
    <div className={cn(table.scroll, maxHeight && `overflow-y-auto ${maxHeight}`)}>
      {children}
    </div>
  </div>
);

export const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = ({
  className,
  children,
  ...props
}) => (
  <table className={cn(table.root, className)} {...props}>
    {children}
  </table>
);

export const Thead: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  className,
  children,
  ...props
}) => (
  <thead className={cn(table.thead, className)} {...props}>
    {children}
  </thead>
);

export const Tbody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  className,
  children,
  ...props
}) => (
  <tbody className={cn(table.tbody, className)} {...props}>
    {children}
  </tbody>
);

export interface TrProps extends React.HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean;
}

export const Tr: React.FC<TrProps> = ({ selected, className, children, ...props }) => (
  <tr
    aria-selected={selected || undefined}
    className={cn(table.tr, selected && table.trSelected, className)}
    {...props}
  >
    {children}
  </tr>
);

/* -------------------------------------------------------------------------- */
/*  Celdas                                                                     */
/* -------------------------------------------------------------------------- */

export interface TdProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  /** Números y moneda: alineados a la derecha, cifras tabulares. */
  numeric?: boolean;
  /** Dato principal de la fila. */
  primary?: boolean;
  /** Dato de apoyo, en gris. */
  muted?: boolean;
  dense?: boolean;
}

export const Td: React.FC<TdProps> = ({
  numeric,
  primary,
  muted,
  dense,
  className,
  children,
  ...props
}) => (
  <td
    className={cn(
      dense ? table.tdDense : table.td,
      numeric && table.num,
      primary && table.tdPrimary,
      muted && table.tdMuted,
      className,
    )}
    {...props}
  >
    {children}
  </td>
);

export type SortDirection = 'asc' | 'desc';

export interface ThProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean;
  /** Habilita el clic de ordenación. */
  sortable?: boolean;
  /** Dirección actual, o null si la tabla no está ordenada por esta columna. */
  sortDirection?: SortDirection | null;
  onSort?: () => void;
}

/**
 * Cabecera de columna.
 * Cuando es ordenable expone `aria-sort` y un icono que distingue los tres
 * estados (sin ordenar / ascendente / descendente).
 */
export const Th: React.FC<ThProps> = ({
  numeric,
  sortable,
  sortDirection = null,
  onSort,
  className,
  children,
  ...props
}) => {
  const content = (
    <span className={cn('inline-flex items-center gap-1', numeric && 'flex-row-reverse')}>
      {children}
      {sortable && (
        <span className="text-fg-subtle" aria-hidden="true">
          {sortDirection === 'asc' ? (
            <ArrowUp size={12} className="text-primary" />
          ) : sortDirection === 'desc' ? (
            <ArrowDown size={12} className="text-primary" />
          ) : (
            <ChevronsUpDown size={12} className="opacity-50" />
          )}
        </span>
      )}
    </span>
  );

  return (
    <th
      scope="col"
      aria-sort={
        !sortable ? undefined : sortDirection === 'asc' ? 'ascending' : sortDirection === 'desc' ? 'descending' : 'none'
      }
      className={cn(table.th, numeric && 'text-right', sortable && table.thSortable, className)}
      {...props}
    >
      {sortable ? (
        <button
          type="button"
          onClick={onSort}
          className="inline-flex items-center gap-1 uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
        >
          {content}
        </button>
      ) : (
        content
      )}
    </th>
  );
};

/* -------------------------------------------------------------------------- */
/*  Estados                                                                    */
/* -------------------------------------------------------------------------- */

export const TableEmpty: React.FC<{
  colSpan: number;
  message?: string;
  /** Acción sugerida: limpiar filtros, crear el primer registro… */
  action?: React.ReactNode;
  icon?: React.ReactNode;
}> = ({ colSpan, message = 'No hay registros que coincidan con tu búsqueda.', action, icon }) => (
  <tr>
    <td colSpan={colSpan} className={table.empty}>
      <div className="flex flex-col items-center gap-2">
        <span className="text-fg-subtle" aria-hidden="true">
          {icon ?? <SearchX size={28} />}
        </span>
        <span>{message}</span>
        {action}
      </div>
    </td>
  </tr>
);

export const TableLoading: React.FC<{ colSpan: number; message?: string }> = ({
  colSpan,
  message = 'Cargando…',
}) => (
  <tr>
    <td colSpan={colSpan} className={table.empty}>
      <div className="flex flex-col items-center gap-2" role="status">
        <Loader2 size={26} className="animate-spin text-primary" aria-hidden="true" />
        <span>{message}</span>
      </div>
    </td>
  </tr>
);

/**
 * Filas esqueleto. Preferible al spinner cuando ya sabes cuántas filas
 * vendrán: mantiene la altura y evita el salto de layout (CLS).
 */
export const TableSkeleton: React.FC<{ rows?: number; cols: number }> = ({
  rows = 8,
  cols,
}) => (
  <>
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <tr key={rowIndex} aria-hidden="true">
        {Array.from({ length: cols }).map((__, colIndex) => (
          <td key={colIndex} className={table.td}>
            <div
              className="h-3.5 animate-pulse rounded bg-surface-3"
              style={{ width: `${55 + ((rowIndex + colIndex) % 4) * 12}%` }}
            />
          </td>
        ))}
      </tr>
    ))}
  </>
);
