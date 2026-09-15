import React from 'react';
import { CalendarDays, Check, Loader2, Maximize2, Trash2, TriangleAlert, User, X } from 'lucide-react';
import { Bitacora, BitacoraPatch } from '../../types/bitacora';
import { Button } from '../ui';
import { cn } from '../ui/styles';
import { BitacoraRichTextEditor } from './BitacoraRichTextEditor';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const AUTOSAVE_DELAY_MS = 800;

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('es-EC', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

const SaveStatusIndicator: React.FC<{ status: SaveStatus }> = ({ status }) => {
  if (status === 'idle') return null;
  if (status === 'saving') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-fg-subtle">
        <Loader2 size={13} className="animate-spin" aria-hidden="true" /> Guardando…
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-danger">
        <TriangleAlert size={13} aria-hidden="true" /> Error al guardar
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
      <Check size={13} aria-hidden="true" /> Guardado
    </span>
  );
};

interface BitacoraDetailProps {
  bitacora: Bitacora;
  creatorName: string;
  onPersist: (id: string, patch: BitacoraPatch) => Promise<void>;
  onDelete: (bitacora: Bitacora) => void;
  variant: 'peek' | 'full';
  onOpenFullView?: () => void;
  onClose?: () => void;
}

/**
 * Detalle editable de una bitácora: título, fecha, contenido enriquecido y
 * metadatos. Se usa tanto en el side peek de la lista como en la vista
 * completa — el padre lo monta con `key={bitacora.id}` para que el estado
 * local se reinicie al cambiar de bitácora.
 */
export const BitacoraDetail: React.FC<BitacoraDetailProps> = ({
  bitacora,
  creatorName,
  onPersist,
  onDelete,
  variant,
  onOpenFullView,
  onClose,
}) => {
  const [resumen, setResumen] = React.useState(bitacora.resumen);
  const [bitacoraDate, setBitacoraDate] = React.useState(bitacora.bitacora_date);
  const [content, setContent] = React.useState(bitacora.content);
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>('idle');

  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = React.useRef(true);
  const latestPatch = React.useRef<BitacoraPatch>({});

  const scheduleSave = React.useCallback((patch: BitacoraPatch) => {
    latestPatch.current = { ...latestPatch.current, ...patch };
    setSaveStatus('saving');
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      const toSave = latestPatch.current;
      latestPatch.current = {};
      try {
        await onPersist(bitacora.id, toSave);
        setSaveStatus('saved');
      } catch (err) {
        console.error('Error guardando bitácora:', err);
        setSaveStatus('error');
      }
    }, AUTOSAVE_DELAY_MS);
  }, [bitacora.id, onPersist]);

  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    scheduleSave({ resumen });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumen]);

  React.useEffect(() => {
    if (isFirstRender.current) return;
    scheduleSave({ bitacora_date: bitacoraDate });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bitacoraDate]);

  React.useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const handleContentChange = (html: string) => {
    setContent(html);
    scheduleSave({ content: html });
  };

  return (
    <div className="flex flex-col">
      {/* La fecha ES el título de la bitácora, y sigue siendo editable. */}
      <div className="flex items-start justify-between gap-3 pb-1">
        <label className="inline-flex min-w-0 items-center gap-2">
          <CalendarDays size={18} className="shrink-0 text-primary" aria-hidden="true" />
          <span className="sr-only">Fecha de la bitácora</span>
          <input
            type="date"
            value={bitacoraDate}
            onChange={(e) => setBitacoraDate(e.target.value)}
            className="bg-transparent text-lg font-bold text-fg outline-none focus:underline focus:decoration-primary focus:underline-offset-4"
          />
        </label>
        <div className="flex shrink-0 items-center gap-1.5">
          <SaveStatusIndicator status={saveStatus} />
          {variant === 'peek' && onOpenFullView && (
            <Button variant="ghost" size="sm" iconOnly aria-label="Ver completa" title="Vista completa" onClick={onOpenFullView}>
              <Maximize2 size={15} aria-hidden="true" />
            </Button>
          )}
          {variant === 'peek' && onClose && (
            <Button variant="ghost" size="sm" iconOnly aria-label="Cerrar" title="Cerrar" onClick={onClose}>
              <X size={15} aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      <input
        value={resumen}
        onChange={(e) => setResumen(e.target.value)}
        placeholder="Resumen: ¿de qué trata esta bitácora?"
        aria-label="Resumen de la bitácora"
        className="w-full border-b border-subtle bg-transparent pb-3 text-sm font-medium text-fg outline-none placeholder:font-normal placeholder:text-fg-subtle"
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-subtle py-2.5 text-xs text-fg-muted">
        <span className="inline-flex items-center gap-1.5">
          <User size={13} className="text-fg-subtle" aria-hidden="true" />
          Creado por <span className="font-semibold text-fg">{creatorName}</span>
        </span>
        <span>Creado: {formatDateTime(bitacora.created_at)}</span>
        {bitacora.updated_at !== bitacora.created_at && (
          <span>Última edición: {formatDateTime(bitacora.updated_at)}</span>
        )}
      </div>

      <div className="py-3">
        <BitacoraRichTextEditor
          content={content}
          onChange={handleContentChange}
          contentClassName={variant === 'full' ? 'min-h-[55vh]' : 'min-h-[320px]'}
        />
      </div>

      <div className="flex items-center justify-between border-t border-subtle pt-3">
        <Button
          variant="dangerGhost"
          size="sm"
          icon={<Trash2 size={14} aria-hidden="true" />}
          onClick={() => onDelete(bitacora)}
        >
          Eliminar bitácora
        </Button>
      </div>
    </div>
  );
};

export default BitacoraDetail;
