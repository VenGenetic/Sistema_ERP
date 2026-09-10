-- Registro de guías de transporte ya reenviadas a su destinatario.
--
-- La clave es el NÚMERO DE GUÍA, que es lo único verdaderamente único de un
-- envío: el mismo cliente puede tener dos guías el mismo día, y la misma
-- guía nunca corresponde a dos clientes. Por eso la restricción de unicidad
-- va sobre `numero_guia` y no sobre la conversación.
--
-- Este registro es solo UNA de las tres capas contra el doble envío (ver
-- utils/reenvioDeGuias.ts). No alcanza por sí solo porque no sabe nada de
-- las guías que el equipo reenvió a mano antes de que esto existiera.
BEGIN;

CREATE TABLE IF NOT EXISTS public.whatsapp_guias_reenviadas (
    id BIGSERIAL PRIMARY KEY,
    -- Solo dígitos, como lo devuelve parsearGuia().
    numero_guia TEXT NOT NULL,
    -- A quién se le mandó.
    conversation_id BIGINT NOT NULL,
    -- El mensaje del que salió la guía (el que mandó el transportista o
    -- quien la reenvió). Sirve para rastrear de dónde vino.
    mensaje_origen_id BIGINT,
    -- La fila de agent_outbox que la despachó, para poder seguir su estado.
    outbox_id BIGINT,
    -- Qué campos coincidieron: 'nombre,ciudad'. Queda escrito para poder
    -- auditar una decisión después, cuando ya nadie recuerda por qué se
    -- eligió a ese cliente.
    campos_coincidentes TEXT,
    enviada_por UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Una guía se reenvía UNA vez. Es la barrera dura contra el doble envío:
-- aunque dos personas aprieten el botón a la vez, la segunda inserción
-- falla y el segundo mensaje no se encola.
CREATE UNIQUE INDEX IF NOT EXISTS ux_guias_reenviadas_numero
    ON public.whatsapp_guias_reenviadas(numero_guia);

CREATE INDEX IF NOT EXISTS idx_guias_reenviadas_conversacion
    ON public.whatsapp_guias_reenviadas(conversation_id, created_at DESC);

COMMENT ON TABLE public.whatsapp_guias_reenviadas IS
    'Guías de transporte ya reenviadas al cliente. Evita mandar dos veces la misma.';

ALTER TABLE public.whatsapp_guias_reenviadas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guias reenviadas para autenticados" ON public.whatsapp_guias_reenviadas;
CREATE POLICY "guias reenviadas para autenticados"
    ON public.whatsapp_guias_reenviadas FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

COMMIT;
