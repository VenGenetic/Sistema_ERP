import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Bitacora, BitacoraPatch } from '../types/bitacora';
import { Button, ConfirmDialog, Input, Modal } from '../components/ui';
import { cn, page } from '../components/ui/styles';
import { Table, TableWrapper, Thead, Tbody, Tr, Th, Td, TableEmpty, TableSkeleton } from '../components/ui/Table';
import { BitacoraDetail } from '../components/bitacoras/BitacoraDetail';
import {
  BookText,
  ChevronRight,
  NotebookPen,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';

const todayLocal = (): string => {
  const now = new Date();
  const localMs = now.getTime() - 5 * 60 * 60 * 1000; // Ecuador, UTC-5
  return new Date(localMs).toISOString().split('T')[0];
};

const formatDate = (dateStr: string) =>
  new Date(`${dateStr}T12:00:00`).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('es-EC', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

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
    const query = searchQuery.trim().toLocaleLowerCase('es');
    if (!query) return bitacoras;
    return bitacoras.filter(b => b.title.toLocaleLowerCase('es').includes(query));
  }, [bitacoras, searchQuery]);

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
          title: 'Sin título',
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
          placeholder="Buscar por título..."
          aria-label="Buscar bitácoras por título"
          wrapperClassName="min-w-[240px] flex-1 max-w-sm"
        />
        <span className="text-xs text-fg-muted">
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
              <Th>Título</Th>
              <Th>Fecha de bitácora</Th>
              <Th>Creado por</Th>
              <Th>Creado el</Th>
              <Th>Última edición</Th>
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
                <Td primary className="max-w-xs truncate">{b.title || 'Sin título'}</Td>
                <Td muted>{formatDate(b.bitacora_date)}</Td>
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
                    aria-label={`Eliminar bitácora ${b.title}`}
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
        cita={pendingDelete?.title}
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
