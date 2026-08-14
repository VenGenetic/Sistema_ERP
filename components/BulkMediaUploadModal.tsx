import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { compressImageForUpload } from '../utils/imageCompression';
import {
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock,
  Film,
  FolderOpen,
  FolderUp,
  Image as ImageIcon,
  Info,
  Loader2,
  X,
} from 'lucide-react';

interface BulkMediaUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface FileValidation {
    file: File;
    sku: string;
    extension: string;
    type: 'video' | 'image' | 'unknown';
    productId: number | null;
    status: 'pending' | 'uploading' | 'success' | 'error';
    errorMessage?: string;
}

export const BulkMediaUploadModal: React.FC<BulkMediaUploadModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [files, setFiles] = useState<FileValidation[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch all SKUs when modal opens to do fast local validation
    const [dbProducts, setDbProducts] = useState<Map<string, number>>(new Map());

    useEffect(() => {
        if (isOpen) {
            fetchAllProducts();
            setFiles([]);
            setProgress(0);
        }
    }, [isOpen]);

    const fetchAllProducts = async () => {
        try {
            const skuMap = new Map<string, number>();
            let from = 0;
            const batchSize = 1000;
            while (true) {
                const { data, error } = await supabase
                    .from('products')
                    .select('id, sku')
                    .range(from, from + batchSize - 1);
                
                if (error) throw error;
                if (!data || data.length === 0) break;
                
                data.forEach(p => {
                    skuMap.set(p.sku.toUpperCase(), p.id);
                });
                
                if (data.length < batchSize) break;
                from += batchSize;
            }
            setDbProducts(skuMap);
        } catch (error) {
            console.error("Error fetching SKUs:", error);
        }
    };

    const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        
        setIsScanning(true);
        const selectedFiles = Array.from(e.target.files);
        const validations: FileValidation[] = [];

        selectedFiles.forEach(file => {
            // Ignore hidden files like .DS_Store
            if (file.name.startsWith('.')) return;

            const lastDotIndex = file.name.lastIndexOf('.');
            if (lastDotIndex === -1) return;

            const nameWithoutExt = file.name.substring(0, lastDotIndex).toUpperCase();
            const extension = file.name.substring(lastDotIndex + 1).toLowerCase();
            
            let type: 'video' | 'image' | 'unknown' = 'unknown';
            if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension)) type = 'image';
            if (['mp4', 'mov', 'webm'].includes(extension)) type = 'video';

            if (type !== 'unknown') {
                validations.push({
                    file,
                    sku: nameWithoutExt,
                    extension,
                    type,
                    productId: dbProducts.get(nameWithoutExt) || null,
                    status: 'pending'
                });
            }
        });

        setFiles(validations);
        setIsScanning(false);
        // Reset input so it can be re-selected if needed
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSkuChange = (index: number, newSku: string) => {
        setFiles(prev => {
            const copy = [...prev];
            copy[index].sku = newSku;
            const foundId = dbProducts.get(newSku) || null;
            copy[index].productId = foundId;
            return copy;
        });
    };

    const handleUploadAll = async () => {
        const validFiles = files.filter(f => f.productId !== null && f.status !== 'success');
        if (validFiles.length === 0) return;

        setIsUploading(true);
        setProgress(0);

        let completed = 0;

        for (let i = 0; i < files.length; i++) {
            const f = files[i];
            if (f.productId === null || f.status === 'success') continue;

            // Mark as uploading
            setFiles(prev => {
                const copy = [...prev];
                copy[i].status = 'uploading';
                return copy;
            });

            try {
                const bucket = f.type === 'video' ? 'product_videos' : 'product_images';
                const folder = f.type === 'video' ? '' : 'products/';
                // Se comprime cada foto antes de subirla (los videos pasan
                // intactos). Aquí importa más que en el resto: por este camino
                // entran decenas de imágenes de una sola vez.
                const upload = await compressImageForUpload(f.file);
                const extension = upload.name?.split('.').pop() || f.extension;
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
                const filePath = `${folder}${fileName}`;

                // Upload
                const { error: uploadError } = await supabase.storage
                    .from(bucket)
                    .upload(filePath, upload, {
                        cacheControl: '31536000',
                        upsert: true
                    });

                if (uploadError) throw uploadError;

                // Get URL
                const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);

                // Update Database
                const updatePayload = f.type === 'video' 
                    ? { video_url: data.publicUrl }
                    : { image_url: data.publicUrl };

                const { error: dbError } = await supabase
                    .from('products')
                    .update(updatePayload)
                    .eq('id', f.productId);

                if (dbError) throw dbError;

                setFiles(prev => {
                    const copy = [...prev];
                    copy[i].status = 'success';
                    return copy;
                });
            } catch (error: any) {
                console.error(`Error with ${f.file.name}:`, error);
                setFiles(prev => {
                    const copy = [...prev];
                    copy[i].status = 'error';
                    copy[i].errorMessage = error.message;
                    return copy;
                });
            }

            completed++;
            setProgress(Math.round((completed / validFiles.length) * 100));
        }

        setIsUploading(false);
        onSuccess(); // Refresh catalog in background
    };

    if (!isOpen) return null;

    const validCount = files.filter(f => f.productId !== null).length;
    const missingCount = files.filter(f => f.productId === null).length;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-surface rounded-xl shadow-xl w-full max-w-4xl overflow-hidden border border-subtle flex flex-col max-h-[90dvh]">
                {/* Header */}
                <div className="p-5 border-b border-subtle flex justify-between items-center bg-surface-2">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-success-soft text-success-soft-fg rounded-lg">
                            <FolderUp size={24} aria-hidden="true" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-fg">
                                Carga Masiva Multimedia
                            </h2>
                            <p className="text-xs text-fg-muted">Sube carpetas completas de imágenes y videos</p>
                        </div>
                    </div>
                    <button onClick={onClose} disabled={isUploading} className="text-fg-subtle hover:text-slate-600 dark:hover:text-slate-200 transition-colors disabled:opacity-50">
                        <X size={18} aria-hidden="true" />
                    </button>
                </div>

                <div className="p-6 flex flex-col gap-6 flex-1 overflow-y-auto">
                    {/* Instructions */}
                    <div className="bg-primary-soft border border-primary/20 rounded-xl p-4 flex gap-4">
                        <Info size={18} className="text-primary mt-1" aria-hidden="true" />
                        <div className="text-sm text-fg">
                            <p className="font-semibold mb-1">¿Cómo funciona?</p>
                            <p className="mb-2">1. Selecciona una carpeta de tu computadora que contenga fotos y videos.</p>
                            <p className="mb-2">2. El sistema vinculará automáticamente el archivo al repuesto, asegurando que <strong>el nombre del archivo sea exactamente igual al SKU</strong> del producto.</p>
                            <p className="text-xs text-fg-muted">Ejemplo: <code className="bg-surface px-1 rounded">CG150-123.mp4</code> se enlazará como video del producto con código <strong>CG150-123</strong>.</p>
                        </div>
                    </div>

                    {/* Selector */}
                    <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-strong rounded-xl bg-surface-2 hover:bg-surface-hover transition-colors relative group cursor-pointer" onClick={() => !isUploading && fileInputRef.current?.click()}>
                        {isScanning ? (
                            <div className="flex flex-col items-center">
                                <Loader2 size={48} className="text-primary animate-spin" aria-hidden="true" />
                                <p className="mt-2 text-fg-muted font-medium">Escaneando archivos...</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center text-center">
                                <FolderOpen size={48} className="text-fg-subtle group-hover:text-primary transition-colors mb-2" aria-hidden="true" />
                                <h3 className="text-lg font-bold text-fg">Haz clic aquí para seleccionar una carpeta</h3>
                                <p className="text-sm text-fg-muted mt-1">Soporta múltiples videos e imágenes a la vez</p>
                            </div>
                        )}
                        {/* React trick for directory upload */}
                        <input 
                            type="file" 
                            className="hidden" 
                            ref={fileInputRef}
                            onChange={handleFolderSelect} 
                            disabled={isUploading || isScanning}
                            {...({ webkitdirectory: "true", directory: "true" } as any)}
                        />
                    </div>

                    {/* Results Table */}
                    {files.length > 0 && (
                        <div className="flex flex-col flex-1 min-h-[300px]">
                            <div className="flex justify-between items-end mb-2">
                                <h3 className="font-bold text-fg">Archivos Detectados ({files.length})</h3>
                                <div className="flex gap-3 text-sm">
                                    <span className="px-2 py-1 bg-success-soft text-success-soft-fg rounded-lg font-medium">
                                        {validCount} Válidos
                                    </span>
                                    <span className="px-2 py-1 bg-danger-soft text-danger-soft-fg rounded-lg font-medium">
                                        {missingCount} SKU No Encontrado
                                    </span>
                                </div>
                            </div>
                            
                            <div className="border border-subtle rounded-xl overflow-hidden flex-1 flex flex-col">
                                <div className="overflow-y-auto max-h-[350px]">
                                    <table className="w-full text-left border-collapse text-sm">
                                        <thead className="bg-surface-2 text-fg-muted font-medium text-xs uppercase sticky top-0 z-10 backdrop-blur-md">
                                            <tr>
                                                <th className="px-4 py-2.5">Archivo</th>
                                                <th className="px-4 py-2.5">Tipo</th>
                                                <th className="px-4 py-2.5">SKU Detectado</th>
                                                <th className="px-4 py-2.5">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-subtle">
                                            {files.map((f, i) => (
                                                <tr key={i} className={`${f.productId ? '' : 'bg-danger-soft/50 dark:bg-danger/10'} hover:bg-surface-hover`}>
                                                    <td className="px-4 py-3 font-mono text-xs text-fg-muted truncate max-w-[200px]" title={f.file.name}>
                                                        {f.file.name}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {f.type === 'video' ? (
                                                            <span className="flex items-center gap-1 text-success"><Film size={16} aria-hidden="true" /> Video</span>
                                                        ) : (
                                                            <span className="flex items-center gap-1 text-primary"><ImageIcon size={16} aria-hidden="true" /> Imagen</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {f.productId === null && f.status !== 'success' ? (
                                                            <div className="flex flex-col gap-1">
                                                                <input 
                                                                    type="text"
                                                                    value={f.sku}
                                                                    onChange={(e) => handleSkuChange(i, e.target.value.toUpperCase())}
                                                                    className="w-full min-w-[120px] px-2 py-1.5 text-xs border border-danger/20 bg-surface rounded shadow-sm text-fg outline-none focus:ring-2 focus:ring-danger/50 focus:border-danger font-mono uppercase transition-all"
                                                                    placeholder="Escribe el SKU correcto..."
                                                                />
                                                                <span className="text-2xs text-danger font-medium">Corrige el SKU para enlazar</span>
                                                            </div>
                                                        ) : (
                                                            <span className="font-bold text-fg font-mono">{f.sku}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {f.productId === null ? (
                                                            <span className="text-danger flex items-center gap-1 text-xs font-semibold"><CircleAlert size={14} aria-hidden="true" /> No existe en DB</span>
                                                        ) : f.status === 'pending' ? (
                                                            <span className="text-fg-muted flex items-center gap-1 text-xs"><Clock size={14} aria-hidden="true" /> Listo para subir</span>
                                                        ) : f.status === 'uploading' ? (
                                                            <span className="text-primary flex items-center gap-1 text-xs"><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Subiendo...</span>
                                                        ) : f.status === 'success' ? (
                                                            <span className="text-success flex items-center gap-1 text-xs font-semibold"><CircleCheck size={14} aria-hidden="true" /> Completado</span>
                                                        ) : (
                                                            <span className="text-danger flex items-center gap-1 text-xs font-semibold" title={f.errorMessage}><CircleX size={14} aria-hidden="true" /> Error</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer with Actions and Progress */}
                <div className="p-5 border-t border-subtle bg-surface-2 flex flex-col gap-4">
                    {isUploading && (
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                            <div className="bg-primary h-3 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                        </div>
                    )}
                    
                    <div className="flex justify-between items-center">
                        <div className="text-sm text-fg-muted">
                            {isUploading ? `Progreso: ${progress}%` : files.length > 0 ? `Se subirán ${validCount} archivos.` : ''}
                        </div>
                        <div className="flex gap-3">
                            <button 
                                onClick={onClose} 
                                disabled={isUploading}
                                className="px-4 py-2 text-fg hover:bg-surface-hover rounded-lg transition-colors font-medium disabled:opacity-50"
                            >
                                {files.length > 0 && progress === 100 ? 'Cerrar' : 'Cancelar'}
                            </button>
                            {validCount > 0 && progress < 100 && (
                                <button 
                                    onClick={handleUploadAll}
                                    disabled={isUploading}
                                    className="px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg shadow-sm transition-all font-medium flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {isUploading && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
                                    {isUploading ? 'Procesando Lote...' : 'Confirmar y Subir Archivos'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
