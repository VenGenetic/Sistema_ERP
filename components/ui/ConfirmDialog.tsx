import React from 'react';
import { AlertTriangle, Info, ShieldAlert, type LucideIcon } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import { cn } from './styles';

/**
 * La confirmación de una acción que no tiene vuelta atrás.
 *
 * Reemplaza a `window.confirm`, que en esta aplicación es un problema
 * concreto y no solo estético:
 *
 *   - es una caja gris del navegador, sin el tema ni el idioma del sistema,
 *     y en pantalla táctil aparece pegada al borde de arriba;
 *   - BLOQUEA el hilo del navegador: mientras está abierta no corre el
 *     repaso del hilo ni llega un mensaje nuevo por realtime, así que un
 *     diálogo olvidado deja la bandeja congelada sin que nadie lo note;
 *   - no puede decir QUÉ se va a borrar, y "¿Está seguro?" sobre un
 *     mensaje equivocado es exactamente el clic que después se lamenta.
 *
 * El botón que confirma acepta `loading`: la acción se ejecuta con el
 * diálogo todavía abierto y, si falla, el error se muestra adentro en vez
 * de cerrarse y dejar a la persona sin saber si pasó algo.
 */

export type TonoConfirmacion = 'danger' | 'warning' | 'info';

const ICONO: Record<TonoConfirmacion, LucideIcon> = {
  danger: ShieldAlert,
  warning: AlertTriangle,
  info: Info,
};

const MARCO: Record<TonoConfirmacion, string> = {
  danger: 'bg-danger-soft text-danger-soft-fg',
  warning: 'bg-warning-soft text-warning-soft-fg',
  info: 'bg-primary-soft text-primary-soft-fg',
};

const VARIANTE_CONFIRMAR: Record<TonoConfirmacion, 'danger' | 'primary'> = {
  danger: 'danger',
  warning: 'danger',
  info: 'primary',
};

export interface ConfirmDialogProps {
  isOpen: boolean;
  /** Qué se va a hacer, en una línea. Ej.: «Borrar este mensaje». */
  title: string;
  /** El detalle que hace falta para decidir. Admite markup. */
  description?: React.ReactNode;
  /**
   * Lo que se va a afectar, citado tal cual. En un chat es el texto del
   * mensaje: sin verlo, la confirmación no confirma nada.
   */
  cita?: string | null;
  confirmLabel?: string;
  cancelLabel?: string;
  tono?: TonoConfirmacion;
  /** Se muestra dentro del diálogo, sin cerrarlo. */
  error?: string | null;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  cita,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tono = 'danger',
  error,
  loading = false,
  onConfirm,
  onClose,
}) => {
  const Icono = ICONO[tono];

  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? () => {} : onClose}
      width="sm"
      hideCloseButton
      // Mientras la acción corre, ni el fondo ni Escape la abortan: ya está
      // encolada y cerrar el diálogo solo escondería el resultado.
      dismissOnOverlay={!loading}
      dismissOnEscape={!loading}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={VARIANTE_CONFIRMAR[tono]} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        <span
          className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', MARCO[tono])}
        >
          <Icono size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-fg">{title}</h2>
          {description && <div className="mt-1 text-sm leading-5 text-fg-muted">{description}</div>}

          {cita && (
            <blockquote className="mt-3 max-h-32 overflow-y-auto rounded-lg border-l-2 border-strong bg-surface-2 px-3 py-2 text-sm leading-5 text-fg-muted">
              <span className="line-clamp-6 whitespace-pre-wrap break-words">{cita}</span>
            </blockquote>
          )}

          {error && (
            <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-soft-fg">
              {error}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
