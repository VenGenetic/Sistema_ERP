import React, { useEffect, useState } from 'react';
import { BellRing, Check, ChevronDown, ChevronUp, Clock3, Save, Sparkles } from 'lucide-react';
import { button, cn, focusRing, input } from '../ui/styles';
import {
    EMPTY_WORK, getConversationWork, saveConversationWork, toLocalDateTimeValue,
    type ConversationWork, type WorkStatus,
} from '../../utils/whatsappWorkflow';

const STATUS: Array<{ value: WorkStatus; label: string }> = [
    { value: 'new', label: 'Nuevo' }, { value: 'reviewing', label: 'Revisando' },
    { value: 'waiting_customer', label: 'Esperando cliente' }, { value: 'quoting', label: 'Cotizando' },
    { value: 'quote_sent', label: 'Proforma enviada' }, { value: 'sale_confirmed', label: 'Venta confirmada' },
    { value: 'resolved', label: 'Resuelto' },
];

interface Props { conversationId: number; aiReady?: boolean; }

const ConversationWorkCard: React.FC<Props> = ({ conversationId, aiReady }) => {
    const [work, setWork] = useState<ConversationWork>(() => EMPTY_WORK(conversationId));
    const [open, setOpen] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        setLoading(true);
        getConversationWork(conversationId).then((value) => active && setWork(value)).catch(() => active && setMessage('No se pudo cargar el seguimiento.')).finally(() => active && setLoading(false));
        return () => { active = false; };
    }, [conversationId]);

    const patch = <K extends keyof ConversationWork>(key: K, value: ConversationWork[K]) => setWork((current) => ({ ...current, [key]: value }));
    const save = async () => {
        setSaving(true); setMessage(null);
        try { setWork(await saveConversationWork(work)); setMessage('Seguimiento guardado'); }
        catch (error: any) { setMessage(error?.message || 'No se pudo guardar. Aplica la migración de analítica.'); }
        finally { setSaving(false); }
    };

    return (
        <section className="mb-3 overflow-hidden rounded-xl border border-subtle bg-surface shadow-sm">
            <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className={cn('flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left hover:bg-surface-hover', focusRing)}>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary"><Sparkles size={16} /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-fg">Resumen de trabajo</span><span className="block truncate text-2xs text-fg-muted">{aiReady ? 'Información preparada por IA · ' : ''}{STATUS.find((item) => item.value === work.work_status)?.label}</span></span>
                {open ? <ChevronUp size={16} className="text-fg-muted" /> : <ChevronDown size={16} className="text-fg-muted" />}
            </button>
            {open && <div className="space-y-3 border-t border-subtle p-3">
                <label className="block text-2xs font-semibold uppercase tracking-wide text-fg-muted">Estado
                    <select value={work.work_status} onChange={(event) => patch('work_status', event.target.value as WorkStatus)} className={cn(input.base, 'mt-1 h-9 py-1 text-xs')}>
                        {STATUS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                </label>
                <label className="block text-2xs font-semibold uppercase tracking-wide text-fg-muted">Qué solicita
                    <input value={work.requested_part ?? ''} onChange={(event) => patch('requested_part', event.target.value)} placeholder="Ej. faro delantero" className={cn(input.base, 'mt-1 h-9 text-xs')} />
                </label>
                <div className="grid grid-cols-2 gap-2">
                    <input aria-label="Marca" value={work.vehicle_make ?? ''} onChange={(event) => patch('vehicle_make', event.target.value)} placeholder="Marca" className={cn(input.base, 'h-9 text-xs')} />
                    <input aria-label="Modelo" value={work.vehicle_model ?? ''} onChange={(event) => patch('vehicle_model', event.target.value)} placeholder="Modelo" className={cn(input.base, 'h-9 text-xs')} />
                    <input aria-label="Año" inputMode="numeric" value={work.vehicle_year ?? ''} onChange={(event) => patch('vehicle_year', event.target.value ? Number(event.target.value) : null)} placeholder="Año" className={cn(input.base, 'h-9 text-xs')} />
                    <div className="relative"><Clock3 size={13} className="absolute left-2 top-3 text-fg-subtle" /><input aria-label="Recordatorio" type="datetime-local" value={toLocalDateTimeValue(work.reminder_at)} onChange={(event) => patch('reminder_at', event.target.value ? new Date(event.target.value).toISOString() : null)} className={cn(input.base, 'h-9 pl-7 text-[10px]')} /></div>
                </div>
                <label className="block text-2xs font-semibold uppercase tracking-wide text-fg-muted">Resumen interno
                    <textarea value={work.internal_summary ?? ''} onChange={(event) => patch('internal_summary', event.target.value)} rows={3} placeholder="Datos confirmados, condiciones y siguiente paso…" className={cn(input.base, 'mt-1 resize-none text-xs')} />
                </label>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={save} disabled={saving || loading} className={cn(button.base, button.variant.primary, button.size.sm, 'flex-1')}><Save size={14} />{saving ? 'Guardando…' : 'Guardar'}</button>
                    {work.reminder_at && <span title={`Recordatorio ${new Date(work.reminder_at).toLocaleString('es-EC')}`} className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning-soft text-warning"><BellRing size={15} /></span>}
                </div>
                {message && <p role="status" className={cn('flex items-center gap-1 text-2xs', message.includes('guardado') ? 'text-success' : 'text-danger')}>{message.includes('guardado') && <Check size={12} />}{message}</p>}
            </div>}
        </section>
    );
};

export default ConversationWorkCard;
