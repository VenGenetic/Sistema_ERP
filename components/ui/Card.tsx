import React from 'react';
import { card, cn, stat } from './styles';

/* -------------------------------------------------------------------------- */
/*  Card                                                                       */
/* -------------------------------------------------------------------------- */

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Aplica hover/cursor. Úsalo solo si toda la tarjeta es clicable. */
  interactive?: boolean;
}

export const Card: React.FC<CardProps> = ({
  interactive = false,
  className,
  children,
  ...props
}) => (
  <div className={cn(interactive ? card.interactive : card.base, className)} {...props}>
    {children}
  </div>
);

export const CardHeader: React.FC<{
  title: React.ReactNode;
  /** Acciones alineadas a la derecha del encabezado. */
  actions?: React.ReactNode;
  className?: string;
}> = ({ title, actions, className }) => (
  <div className={cn(card.header, className)}>
    {typeof title === 'string' ? <h3 className={card.title}>{title}</h3> : title}
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
);

export const CardBody: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => (
  <div className={cn(card.body, className)} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => (
  <div className={cn(card.footer, className)} {...props}>
    {children}
  </div>
);

/* -------------------------------------------------------------------------- */
/*  StatCard — tarjeta de métrica / KPI                                        */
/* -------------------------------------------------------------------------- */

export interface StatCardProps {
  label: string;
  /** Ya formateado (moneda, unidades…). El componente no formatea. */
  value: React.ReactNode;
  icon?: React.ReactNode;
  /** Línea de contexto bajo el valor. */
  meta?: React.ReactNode;
  /** Variación respecto al periodo anterior, en %. Signo define el color. */
  delta?: number;
  /** Etiqueta del periodo comparado, ej. "vs. mes anterior". */
  deltaLabel?: string;
  /** Para un total destacado (el "a cobrar" del POS). */
  emphasis?: boolean;
  /** Reserva el espacio mientras carga: evita saltos de layout. */
  loading?: boolean;
  className?: string;
}

/**
 * Tarjeta de KPI.
 *
 * El valor usa cifras tabulares (`tnum`) para que no cambie de ancho al
 * actualizarse — importante en pantallas que refrescan en vivo.
 */
export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  meta,
  delta,
  deltaLabel,
  emphasis = false,
  loading = false,
  className,
}) => {
  const hasDelta = typeof delta === 'number' && Number.isFinite(delta);
  const positive = hasDelta && (delta as number) >= 0;

  return (
    <div className={cn(stat.root, className)}>
      <span className={stat.label}>
        {icon && (
          <span className="text-fg-subtle" aria-hidden="true">
            {icon}
          </span>
        )}
        {label}
      </span>

      {loading ? (
        <div className="h-8 w-24 animate-pulse rounded-md bg-surface-3" aria-hidden="true" />
      ) : (
        <span className={emphasis ? stat.valueLg : stat.value}>{value}</span>
      )}

      {(meta || hasDelta) && (
        <div className="flex items-center gap-2 flex-wrap">
          {hasDelta && (
            <span className={positive ? stat.deltaUp : stat.deltaDown}>
              {/* Signo + flecha: la dirección no depende solo del color. */}
              <span aria-hidden="true">{positive ? '▲' : '▼'}</span>
              {Math.abs(delta as number).toFixed(1)}%
              <span className="sr-only">
                {positive ? 'aumento' : 'disminución'} {deltaLabel ?? ''}
              </span>
            </span>
          )}
          {meta && <span className={stat.meta}>{meta}</span>}
          {hasDelta && deltaLabel && <span className={stat.meta}>{deltaLabel}</span>}
        </div>
      )}
    </div>
  );
};

export default Card;
