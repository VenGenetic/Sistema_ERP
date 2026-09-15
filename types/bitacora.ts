export interface Bitacora {
    id: string;
    /** Texto corto que identifica la bitácora en el listado. El título es la fecha. */
    resumen: string;
    content: string;
    bitacora_date: string;
    created_at: string;
    updated_at: string;
    created_by: string | null;
}

export type BitacoraPatch = Partial<Pick<Bitacora, 'resumen' | 'content' | 'bitacora_date'>>;
