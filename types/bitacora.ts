export interface Bitacora {
    id: string;
    title: string;
    content: string;
    bitacora_date: string;
    created_at: string;
    updated_at: string;
    created_by: string | null;
}

export type BitacoraPatch = Partial<Pick<Bitacora, 'title' | 'content' | 'bitacora_date'>>;
