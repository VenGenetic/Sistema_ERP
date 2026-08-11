import React from 'react';
import { TagManager } from '../components/TagManager';

const Tags: React.FC = () => {
    return (
        <div className="p-6 md:p-8 max-w-[800px] mx-auto flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-bold dark:text-white tracking-tight">Etiquetas</h1>
                <p className="text-fg-muted mt-1">Gestiona las etiquetas (tags) para categorizar y organizar los repuestos del catálogo.</p>
            </div>
            <div className="h-[70vh] border border-subtle rounded-xl overflow-hidden shadow-sm">
                <TagManager embedded={true} />
            </div>
        </div>
    );
};

export default Tags;
