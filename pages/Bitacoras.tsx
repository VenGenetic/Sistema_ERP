import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Bitacora, BitacoraPatch } from '../types/bitacora';
import { Button, ConfirmDialog, Input, Modal, Select, Tooltip } from '../components/ui';
import { parseBullets } from '../utils/bitacoraResumen';
import { cn, page } from '../components/ui/styles';
import { Table, TableWrapper, Thead, Tbody, Tr, Th, Td, TableEmpty, TableSkeleton, type SortDirection } from '../components/ui/Table';
import { BitacoraDetail } from '../components/bitacoras/BitacoraDetail';
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  BookText,
  ChevronRight,
  NotebookPen,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';

/** Las tres fechas por las que se puede ordenar el listado. */
type SortField = 'bitacora_date' | 'created_at' | 'updated_at';

const SORT_FIELDS: { value: SortField; label: string }[] = [
  { value: 'bitacora_date', label: 'Fecha de bitácora' },
  { value: 'created_at', label: 'Fecha de creación' },
  { value: 'updated_at', label: 'Última edición' },
];

/** Tope por punto en la tabla; el texto completo va en el globo al pasar por encima. */
const MAX_BULLET_CHARS = 50;

/**
 * Los puntos del resumen en la fila de la tabla. Cada uno se recorta a 50
 * caracteres y solo los recortados llevan globo: `soloSiRecortado` mide el
 * desbordamiento por CSS y acá el recorte se hace cortando el texto.
 */
const ResumenBullets: React.FC<{ resumen: string }> = ({ resumen }) => {
  const bullets = parseBullets(resumen);
  if (!bullets.length) return <span className="italic text-fg-subtle">Sin resumen</span>;

  return (
    <ul className="space-y-0.5">
      {bullets.map((bullet, index) => {
        const recortado = bullet.length > MAX_BULLET_CHARS;
        const linea = (
          <li className="flex gap-1.5 text-sm leading-snug">
            <span className="select-none text-fg-subtle" aria-hidden="true">•</span>
            <span>{recortado ? `${bullet.slice(0, MAX_BULLET_CHARS).trimEnd()}…` : bullet}</span>
          </li>
        );

        if (!recortado) return <React.Fragment key={index}>{linea}</React.Fragment>;
        return (
          <Tooltip key={index} texto={bullet} soloSiRecortado={false}>
            {linea}
          </Tooltip>
        );
      })}
    </ul>
  );
};

const todayLocal = (): string => {
  const now = new Date();
  const localMs = now.getTime() - 5 * 60 * 60 * 1000; // Ecuador, UTC-5
  return new Date(localMs).toISOString().split('T')[0];
};

const formatDate = (dateStr: string) =>
  new Date(`${dateStr}T12:00:00`).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('es-EC', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Sin mayúsculas ni tildes: buscar "atencion" tiene que encontrar "Atención". */
const normalize = (value: string) =>
  value.toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Todo lo que se ve de una bitácora, en un solo texto: el resumen, la fecha
 * ISO y las tres fechas tal como se muestran. Así "sept", "15/09", "2026" o
 * un trozo de un punto del resumen encuentran la misma fila.
 */
const searchHaystack = (b: Bitacora) => {
  // El locale es-EC rinde "15 sept 2026", así que sin estas dos formas
  // escribir "15/09" (como se teclea una fecha acá) no encontraría nada.
  const [year, month, day] = b.bitacora_date.split('-');

  return normalize([
    b.resumen.replace(/\n/g, ' '),
    b.bitacora_date,
    `${day}/${month}/${year}`,
    `${Number(day)}/${Number(month)}/${year}`,
    formatDate(b.bitacora_date),
    formatDateTime(b.created_at),
    formatDateTime(b.updated_at),
  ].join(' '));
};

const Bitacoras: React.FC = () => {
  const navigate = useNavigate();
  const [bitacoras, setBitacoras] = useState<Bitacora[]>([]);
  const [profilesMap, setProfilesMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Bitacora | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sortField, setSortField] = useState<SortField>('bitacora_date');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: rows, error: rowsErr }, { data: profiles, error: profilesErr }] = await Promise.all([
        supabase.from('bitacoras').select('*').order('bitacora_date', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name'),
      ]);
      if (rowsErr) throw rowsErr;
      if (profilesErr) throw profilesErr;
      setBitacoras((rows as Bitacora[]) || []);
      setProfilesMap(new Map((profiles || []).map((p: any) => [p.id, p.full_name])));
    } catch (err: any) {
      console.error('Error cargando bitácoras:', err);
      setError(err?.message || 'No se pudieron cargar las bitácoras.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filteredBitacoras = useMemo(() => {
    const terms = normalize(searchQuery).split(/\s+/).filter(Boolean);
    const rows = terms.length
      ? bitacoras.filter(b => {
          const haystack = searchHaystack(b);
          return terms.every(term => haystack.includes(term));
        })
      : [...bitacoras];

    // Las tres fechas llegan en formato ISO (YYYY-MM-DD…), así que ordenan
    // bien como texto y no hace falta construir un Date por comparación.
    return rows.sort((a, b) => {
      const comparison = a[sortField] < b[sortField] ? -1 : a[sortField] > b[sortField] ? 1 : 0;
      return sortDir === 'asc' ? comparison : -comparison;
    });
  }, [bitacoras, searchQuery, sortField, sortDir]);

  const applySort = (field: SortField) => {
    if (field === sortField) {
      setSortDir(current => (current === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setSortField(field);
    setSortDir('desc');
  };

  const sortDirectionFor = (field: SortField): SortDirection | null =>
    sortField === field ? sortDir : null;

  const selectedBitacora = useMemo(
    () => bitacoras.find(b => b.id === selectedId) || null,
    [bitacoras, selectedId],
  );

  const handleCreate = async () => {
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error: insertErr } = await supabase
        .from('bitacoras')
        .insert({
          resumen: '',
          content: '',
          bitacora_date: todayLocal(),
          created_by: session?.user?.id ?? null,
        })
        .select()
        .single();
      if (insertErr) throw insertErr;
      setBitacoras(prev => [data as Bitacora, ...prev]);
      setSelectedId((data as Bitacora).id);
    } catch (err: any) {
      console.error('Error creando bitácora:', err);
      alert(err?.message || 'No se pudo crear la bitácora.');
    } finally {
      setCreating(false);
    }
  };

  const handlePersist = useCallback(async (id: string, patch: BitacoraPatch) => {
    const { data, error: updateErr } = await supabase
      .from('bitacoras')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (updateErr) throw updateErr;
    setBitacoras(prev => prev.map(b => (b.id === id ? { ...b, ...(data as Bitacora) } : b)));
  }, []);

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const { error: deleteErr } = await supabase.from('bitacoras').delete().eq('id', pendingDelete.id);
      if (deleteErr) throw deleteErr;
      setBitacoras(prev => prev.filter(b => b.id !== pendingDelete.id));
      if (selectedId === pendingDelete.id) setSelectedId(null);
      setPendingDelete(null);
    } catch (err: any) {
      console.error('Error eliminando bitácora:', err);
      alert(err?.message || 'No se pudo eliminar la bitácora.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={page.root}>
      <div className="flex items-center gap-2 text-sm text-fg-muted">
        <span className="cursor-pointer transition-colors hover:text-primary" onClick={() => navigate('/dashboard')}>Inicio</span>
        <ChevronRight size={16} aria-hidden="true" />
        <span className="font-medium text-fg">Bitácoras</span>
      </div>

      <div className={page.header}>
        <div>
          <h1 className={cn(page.title, 'flex items-center gap-2')}>
            <BookText size={24} className="text-primary" aria-hidden="true" />
            Bitácoras
          </h1>
          <p className={page.subtitle}>Registro de bitácoras del equipo, con fecha, contenido y autoría.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={fetchAll} loading={loading} icon={<RefreshCw size={15} aria-hidden="true" />}>
            Actualizar
          </Button>
          <Button variant="primary" onClick={handleCreate} loading={creating} icon={<Plus size={15} aria-hidden="true" />}>
            Nueva Bitácora
          </Button>
        </div>
      </div>

      <div className={page.toolbar}>
        <Input
          leadingIcon={<Search size={15} aria-hidden="true" />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar: texto del resumen, «sept», «2026», «15/09»..."
          aria-label="Buscar bitácoras por resumen o fecha"
          wrapperClassName="min-w-[240px] flex-1 max-w-sm"
        />

        <div className="flex items-center gap-2">
          <label htmlFor="bitacoras-sort-field" className="text-xs font-semibold text-fg-muted">
            Ordenar por
          </label>
          {/* Select trae `w-full`: el ancho se fija en el contenedor para no
              depender del orden en que Tailwind emita las dos utilidades. */}
          <div className="w-[190px]">
            <Select
              id="bitacoras-sort-field"
              inputSize="sm"
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
            >
              {SORT_FIELDS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => setSortDir(current => (current === 'desc' ? 'asc' : 'desc'))}
          icon={sortDir === 'desc'
            ? <ArrowDownWideNarrow size={15} aria-hidden="true" />
            : <ArrowUpNarrowWide size={15} aria-hidden="true" />}
          title="Cambiar el orden"
        >
          {sortDir === 'desc' ? 'Más recientes primero' : 'Más antiguas primero'}
        </Button>

        <span className="ml-auto text-xs text-fg-muted">
          {filteredBitacoras.length} bitácora{filteredBitacoras.length === 1 ? '' : 's'}
        </span>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger-soft-fg">
          {error}
        </div>
      )}

      <TableWrapper>
        <Table>
          <Thead>
            <Tr>
              <Th sortable sortDirection={sortDirectionFor('bitacora_date')} onSort={() => applySort('bitacora_date')}>
                Bitácora
              </Th>
              <Th>Resumen</Th>
              <Th>Creado por</Th>
              <Th sortable sortDirection={sortDirectionFor('created_at')} onSort={() => applySort('created_at')}>
                Creado el
              </Th>
              <Th sortable sortDirection={sortDirectionFor('updated_at')} onSort={() => applySort('updated_at')}>
                Última edición
              </Th>
              <Th className="w-12" />
            </Tr>
          </Thead>
          <Tbody>
            {loading && bitacoras.length === 0 && <TableSkeleton cols={6} />}
            {!loading && filteredBitacoras.length === 0 && (
              <TableEmpty
                colSpan={6}
                icon={<NotebookPen size={28} aria-hidden="true" />}
                message={searchQuery ? 'No hay bitácoras que coincidan con tu búsqueda.' : 'Todavía no hay bitácoras. Crea la primera.'}
              />
            )}
            {filteredBitacoras.map((b) => (
              <Tr
                key={b.id}
                selected={selectedId === b.id}
                className="cursor-pointer"
                onClick={() => setSelectedId(b.id)}
              >
                <Td primary className="whitespace-nowrap">{formatDate(b.bitacora_date)}</Td>
                <Td muted className="max-w-md">
                  <ResumenBullets resumen={b.resumen} />
                </Td>
                <Td muted>{profilesMap.get(b.created_by || '') || 'Desconocido'}</Td>
                <Td muted className="whitespace-nowrap">{formatDateTime(b.created_at)}</Td>
                <Td muted className="whitespace-nowrap">
                  {b.updated_at !== b.created_at ? formatDateTime(b.updated_at) : '—'}
                </Td>
                <Td className="text-right">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPendingDelete(b); }}
                    className="rounded p-1.5 text-fg-subtle transition-colors hover:bg-danger-soft hover:text-danger"
                    title="Eliminar bitácora"
                    aria-label={`Eliminar bitácora del ${formatDate(b.bitacora_date)}`}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableWrapper>

      <Modal
        isOpen={Boolean(selectedBitacora)}
        onClose={() => setSelectedId(null)}
        presentation="side-panel"
        width="xl"
        hideCloseButton
        title={null}
      >
        {selectedBitacora && (
          <BitacoraDetail
            key={selectedBitacora.id}
            bitacora={selectedBitacora}
            creatorName={profilesMap.get(selectedBitacora.created_by || '') || 'Desconocido'}
            onPersist={handlePersist}
            onDelete={(b) => setPendingDelete(b)}
            variant="peek"
            onOpenFullView={() => navigate(`/bitacoras/${selectedBitacora.id}`)}
            onClose={() => setSelectedId(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        title="Eliminar bitácora"
        description="Esta acción no se puede deshacer. Se eliminará el registro y todo su contenido."
        cita={pendingDelete ? `${formatDate(pendingDelete.bitacora_date)}${pendingDelete.resumen ? ` — ${pendingDelete.resumen}` : ''}` : null}
        confirmLabel="Eliminar"
        tono="danger"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
};

export default Bitacoras;
