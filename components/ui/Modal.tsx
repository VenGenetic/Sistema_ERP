import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useBackDismiss } from '../../hooks/useBackDismiss';
import { cn, modal } from './styles';

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

let openModalCount = 0;

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  width?: keyof typeof modal.width;
  /** Contenido del pie. Normalmente los botones de acción. */
  footer?: React.ReactNode;
  /** Desactiva el cierre por clic en el fondo (para flujos que no deben abortarse). */
  dismissOnOverlay?: boolean;
  /** Desactiva el cierre con Escape. */
  dismissOnEscape?: boolean;
  hideCloseButton?: boolean;
  /** En escritorio lo acopla a la derecha y deja el contenido de fondo visible y utilizable. */
  presentation?: 'modal' | 'side-panel';
  className?: string;
  children: React.ReactNode;
}

/**
 * Modal accesible.
 *
 * Se encarga de lo que casi siempre se olvida al escribir un overlay a mano:
 *   - bloquea el scroll del fondo (y lo restaura contando modales anidados);
 *   - atrapa el Tab dentro del panel;
 *   - devuelve el foco al elemento que lo abrió al cerrarse;
 *   - enfoca el primer control al abrir;
 *   - cierra con Escape;
 *   - cierra con el botón «atrás» del teléfono en vez de dejar la pantalla.
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  width = 'md',
  footer,
  dismissOnOverlay = true,
  dismissOnEscape = true,
  hideCloseButton = false,
  presentation = 'modal',
  className,
  children,
}) => {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const restoreFocusRef = React.useRef<HTMLElement | null>(null);
  const titleId = React.useId();

  // El «atrás» del teléfono se trata igual que Escape: los flujos que no deben
  // abortarse (dismissOnEscape={false}) tampoco se cierran por gesto.
  useBackDismiss(isOpen && dismissOnEscape, onClose);

  // Bloqueo de scroll del documento mientras haya algún modal abierto.
  React.useEffect(() => {
    if (!isOpen) return;

    openModalCount += 1;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      openModalCount -= 1;
      if (openModalCount === 0) document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  // Gestión del foco: guardar, enfocar dentro, restaurar al cerrar.
  React.useEffect(() => {
    if (!isOpen) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;

    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const first = panel.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panel).focus();
    });

    return () => {
      cancelAnimationFrame(raf);
      restoreFocusRef.current?.focus?.();
    };
  }, [isOpen]);

  // Escape para cerrar + Tab confinado al panel.
  React.useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissOnEscape) {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;

      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen, dismissOnEscape, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className={cn(
        modal.overlay,
        presentation === 'side-panel' && 'lg:pointer-events-none lg:justify-end lg:bg-transparent lg:p-0 lg:backdrop-blur-none',
      )}
      onMouseDown={(event) => {
        // mousedown (no click) evita cerrar si el arrastre empezó dentro del panel.
        if (dismissOnOverlay && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          modal.panel,
          modal.width[width],
          presentation === 'side-panel' && 'lg:pointer-events-auto lg:h-full lg:max-h-full lg:w-[480px] lg:max-w-[480px] lg:rounded-none lg:border-y-0 lg:border-r-0 lg:shadow-2xl',
          className,
        )}
      >
        {(title || !hideCloseButton) && (
          <div className={modal.header}>
            <div className="min-w-0">
              {title && (
                <h2 id={titleId} className={modal.title}>
                  {title}
                </h2>
              )}
              {subtitle && <p className={modal.subtitle}>{subtitle}</p>}
            </div>
            {!hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className={modal.close}
                aria-label="Cerrar"
              >
                <X size={18} aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        <div className={modal.body}>{children}</div>

        {footer && <div className={modal.footer}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
};

export default Modal;
