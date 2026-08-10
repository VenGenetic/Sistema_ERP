import React from 'react';
import { Loader2 } from 'lucide-react';
import { button, cn } from './styles';

type Variant = keyof typeof button.variant;
type Size = keyof typeof button.size;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Muestra un spinner y bloquea el botón. Evita el doble envío. */
  loading?: boolean;
  /** Icono antes del texto. */
  icon?: React.ReactNode;
  /** Icono después del texto (ej. chevron). */
  trailingIcon?: React.ReactNode;
  /** Botón cuadrado sin texto. Requiere `aria-label`. */
  iconOnly?: boolean;
  fullWidth?: boolean;
}

/**
 * Botón del sistema.
 *
 * - `loading` deshabilita e indica progreso: nunca dejar un clic sin respuesta.
 * - `iconOnly` exige `aria-label`; en desarrollo avisa por consola si falta.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      loading = false,
      icon,
      trailingIcon,
      iconOnly = false,
      fullWidth = false,
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    if (import.meta.env?.DEV && iconOnly && !props['aria-label']) {
      console.warn('[ui/Button] iconOnly requiere aria-label para lectores de pantalla.');
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          button.base,
          button.variant[variant],
          iconOnly ? button.icon[size] : button.size[size],
          fullWidth && 'w-full',
          className,
        )}
        {...props}
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin shrink-0" aria-hidden="true" />
        ) : (
          icon
        )}
        {!iconOnly && children}
        {!iconOnly && !loading && trailingIcon}
      </button>
    );
  },
);

Button.displayName = 'Button';

export default Button;
