import React from 'react';
import { CalendarDays, Check, Loader2, Maximize2, Plus, Trash2, TriangleAlert, User, X } from 'lucide-react';
import { Bitacora, BitacoraPatch } from '../../types/bitacora';
import { parseBullets, serializeBullets } from '../../utils/bitacoraResumen';
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
  // Siempre queda al menos un punto, aunque esté vacío: si no, no habría
  // dónde escribir al abrir una bitácora sin resumen.
  const [bullets, setBullets] = React.useState<string[]>(() => {
    const parsed = parseBullets(bitacora.resumen);
    return parsed.length ? parsed : [''];
  });
  const [bitacoraDate, setBitacoraDate] = React.useState(bitacora.bitacora_date);
  const [content, setContent] = React.useState(bitacora.content);
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>('idle');
  const [focusIndex, setFocusIndex] = React.useState<number | null>(null);

  const bulletRefs = React.useRef<(HTMLInputElement | null)[]>([]);
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
    scheduleSave({ resumen: serializeBullets(bullets) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bullets]);

  React.useEffect(() => {
    if (isFirstRender.current) return;
    scheduleSave({ bitacora_date: bitacoraDate });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bitacoraDate]);

  React.useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  // El foco se pide por índice y se aplica ya renderizada la lista nueva:
  // al insertar o borrar un punto el input destino todavía no existe.
  React.useEffect(() => {
    if (focusIndex === null) return;
    bulletRefs.current[focusIndex]?.focus();
    setFocusIndex(null);
  }, [focusIndex]);

  const handleContentChange = (html: string) => {
    setContent(html);
    scheduleSave({ content: html });
  };

  const updateBullet = (index: number, value: string) =>
    setBullets(prev => prev.map((bullet, i) => (i === index ? value : bullet)));

  const addBulletAfter = (index: number) => {
    setBullets(prev => [...prev.slice(0, index + 1), '', ...prev.slice(index + 1)]);
    setFocusIndex(index + 1);
  };

  const removeBullet = (index: number) => {
    setBullets(prev => (prev.length === 1 ? [''] : prev.filter((_, i) => i !== index)));
    setFocusIndex(Math.max(0, index - 1));
  };

  const handleBulletKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addBulletAfter(index);
      return;
    }
    // Backspace en un punto vacío lo elimina, como en cualquier lista.
    if (event.key === 'Backspace' && bullets[index] === '' && bullets.length > 1) {
      event.preventDefault();
      removeBullet(index);
    }
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
          {/* El icono va en `icon`: con `iconOnly`, Button descarta children. */}
          {variant === 'peek' && onOpenFullView && (
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              aria-label="Ver completa"
              title="Vista completa"
              icon={<Maximize2 size={15} aria-hidden="true" />}
              onClick={onOpenFullView}
            />
          )}
          {variant === 'peek' && onClose && (
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              aria-label="Cerrar"
              title="Cerrar panel"
              icon={<X size={16} aria-hidden="true" />}
              onClick={onClose}
            />
          )}
        </div>
      </div>

      <div className="border-b border-subtle pb-3">
        <span className="text-xs font-semibold text-fg-muted">Resumen</span>
        <ul className="mt-1.5 space-y-1">
          {bullets.map((bullet, index) => (
            <li key={index} className="group flex items-center gap-2">
              <span className="select-none text-fg-subtle" aria-hidden="true">•</span>
              <input
                ref={(el) => { bulletRefs.current[index] = el; }}
                value={bullet}
                onChange={(e) => updateBullet(index, e.target.value)}
                onKeyDown={(e) => handleBulletKeyDown(e, index)}
                placeholder={index === 0 ? '¿De qué trata esta bitácora?' : 'Otro punto…'}
                aria-label={`Punto ${index + 1} del resumen`}
                className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle"
              />
              <button
                type="button"
                onClick={() => removeBullet(index)}
                aria-label={`Eliminar punto ${index + 1}`}
                title="Eliminar punto"
                className="shrink-0 rounded p-1 text-fg-subtle opacity-0 transition-opacity hover:bg-danger-soft hover:text-danger focus:opacity-100 group-hover:opacity-100"
              >
                <X size={13} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => addBulletAfter(bullets.length - 1)}
          className="mt-1.5 inline-flex items-center gap-1 rounded px-1 text-xs font-semibold text-primary hover:underline"
        >
          <Plus size={13} aria-hidden="true" />
          Añadir punto
        </button>
      </div>

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
