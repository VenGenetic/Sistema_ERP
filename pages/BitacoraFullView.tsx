import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Bitacora, BitacoraPatch } from '../types/bitacora';
import { Button, Card, ConfirmDialog } from '../components/ui';
import { page } from '../components/ui/styles';
import { BitacoraDetail } from '../components/bitacoras/BitacoraDetail';
import { ArrowLeft, Loader2, NotebookPen } from 'lucide-react';

const BitacoraFullView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [bitacora, setBitacora] = useState<Bitacora | null>(null);
  const [creatorName, setCreatorName] = useState('Desconocido');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Bitacora | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let mounted = true;

    const fetchBitacora = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchErr } = await supabase
          .from('bitacoras')
          .select('*')
          .eq('id', id)
          .single();
        if (fetchErr) throw fetchErr;
        if (!mounted) return;
        setBitacora(data as Bitacora);

        if (data?.created_by) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', data.created_by)
            .single();
          if (mounted && profile?.full_name) setCreatorName(profile.full_name);
        }
      } catch (err: any) {
        console.error('Error cargando la bitácora:', err);
        if (mounted) setError(err?.message || 'No se encontró la bitácora.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchBitacora();
    return () => { mounted = false; };
  }, [id]);

  const handlePersist = useCallback(async (bitacoraId: string, patch: BitacoraPatch) => {
    const { data, error: updateErr } = await supabase
      .from('bitacoras')
      .update(patch)
      .eq('id', bitacoraId)
      .select()
      .single();
    if (updateErr) throw updateErr;
    setBitacora(prev => (prev ? { ...prev, ...(data as Bitacora) } : prev));
  }, []);

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const { error: deleteErr } = await supabase.from('bitacoras').delete().eq('id', pendingDelete.id);
      if (deleteErr) throw deleteErr;
      navigate('/bitacoras');
    } catch (err: any) {
      console.error('Error eliminando bitácora:', err);
      alert(err?.message || 'No se pudo eliminar la bitácora.');
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  return (
    <div className={page.root}>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft size={15} aria-hidden="true" />}
          onClick={() => navigate('/bitacoras')}
        >
          Volver a Bitácoras
        </Button>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-fg-muted" role="status">
          <Loader2 size={20} className="animate-spin text-primary" aria-hidden="true" />
          Cargando bitácora…
        </div>
      )}

      {!loading && error && (
        <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <NotebookPen size={32} className="text-fg-subtle" aria-hidden="true" />
          <p className="text-sm text-fg-muted">{error}</p>
          <Button variant="primary" size="sm" onClick={() => navigate('/bitacoras')}>
            Ver todas las bitácoras
          </Button>
        </Card>
      )}

      {!loading && bitacora && (
        <Card className="mx-auto w-full max-w-4xl px-6 py-5">
          <BitacoraDetail
            key={bitacora.id}
            bitacora={bitacora}
            creatorName={creatorName}
            onPersist={handlePersist}
            onDelete={(b) => setPendingDelete(b)}
            variant="full"
          />
        </Card>
      )}

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

export default BitacoraFullView;
