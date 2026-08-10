import React from 'react';
import { badge, cn, stockTone } from './styles';

type Tone = keyof typeof badge.tone;
type Size = keyof typeof badge.size;

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  size?: Size;
  /** Punto de color antes del texto: señal adicional al color de fondo. */
  dot?: boolean;
  icon?: React.ReactNode;
}

/**
 * Etiqueta de estado.
 *
 * Los tonos no se eligen por estética sino por significado:
 *   success → disponible / pagado / entregado
 *   warning → bajo / pendiente
 *   danger  → agotado / anulado
 *   info    → en proceso
 *   neutral → sin estado relevante
 */
export const Badge: React.FC<BadgeProps> = ({
  tone = 'neutral',
  size = 'md',
  dot = false,
  icon,
  className,
  children,
  ...props
}) => (
  <span
    className={cn(badge.base, badge.size[size], badge.tone[tone], className)}
    {...props}
  >
    {dot && <span className={badge.dot} aria-hidden="true" />}
    {icon}
    {children}
  </span>
);

export interface StockBadgeProps {
  qty: number;
  /** Por debajo o igual a este valor se considera stock bajo. */
  lowThreshold?: number;
  size?: Size;
  /** Muestra "Agotado"/"Bajo"/"Disponible" en vez del número. */
  showLabel?: boolean;
  className?: string;
}

/**
 * Badge de stock. Centraliza el umbral para que todas las pantallas
 * (Inventario, POS, Reposición) coincidan en qué es "bajo".
 */
export const StockBadge: React.FC<StockBadgeProps> = ({
  qty,
  lowThreshold = 5,
  size = 'md',
  showLabel = false,
  className,
}) => {
  const tone = stockTone(qty, lowThreshold);
  const label = qty <= 0 ? 'Agotado' : qty <= lowThreshold ? 'Bajo' : 'Disponible';

  return (
    <Badge tone={tone} size={size} dot className={cn('tnum', className)}>
      {showLabel ? label : qty}
      {/* El número solo no comunica el estado a un lector de pantalla. */}
      {!showLabel && <span className="sr-only"> unidades — {label}</span>}
    </Badge>
  );
};

export default Badge;
