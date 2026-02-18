import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

const ProfilePanel: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [fullName, setFullName] = useState('');
    const [nickname, setNickname] = useState('');
    const [bio, setBio] = useState('');
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        getProfile();
    }, []);

    const getProfile = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                setUser(user);
                const { data, error } = await supabase
                    .from('profiles')
                    .select('full_name, nickname, bio, avatar_url')
                    .eq('id', user.id)
                    .single();

                if (error && error.code !== 'PGRST116') {
                    throw error;
                }

                if (data) {
                    setFullName(data.full_name || '');
                    setNickname(data.nickname || '');
                    setBio(data.bio || '');
                    setAvatarUrl(data.avatar_url);
                }
            }
        } catch (error: any) {
            console.error('Error loading profile:', error.message);
        } finally {
            setLoading(false);
        }
    };

    const updateProfile = async () => {
        try {
            setLoading(true);
            setMessage(null);

            const { error } = await supabase
                .from('profiles')
                .upsert({
                    id: user?.id,
                    full_name: fullName,
                    nickname,
                    bio,
                    avatar_url: avatarUrl,
                    updated_at: new Date().toISOString(),
                });

            if (error) throw error;
            setMessage({ type: 'success', text: 'Perfil actualizado correctamente.' });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
        }
    };

    const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true);
            setMessage(null);

            if (!event.target.files || event.target.files.length === 0) {
                throw new Error('Debes seleccionar una imagen para subir.');
            }

            const file = event.target.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${user?.id || 'unknown'}-${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

            setAvatarUrl(data.publicUrl);

            // Auto-save after upload
            const { error: updateError } = await supabase
                .from('profiles')
                .upsert({
                    id: user?.id,
                    avatar_url: data.publicUrl,
                    updated_at: new Date().toISOString(),
                });

            if (updateError) throw updateError;

            setMessage({ type: 'success', text: 'Avatar actualizado.' });

        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="flex flex-col gap-8 animate-fade-in max-w-3xl">
            <div className="bg-surface-dark border border-border-dark rounded-xl p-8">
                <h3 className="text-xl font-bold text-white mb-6">Información Pública</h3>

                <div className="flex flex-col md:flex-row gap-8 items-start">
                    {/* Avatar Section */}
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative group">
                            <div className="h-32 w-32 rounded-full border-4 border-surface-hover overflow-hidden bg-background-dark flex items-center justify-center">
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                                ) : (
                                    <span className="text-4xl font-bold text-text-secondary">
                                        {fullName ? fullName.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </div>
                            <label className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full">
                                <span className="material-symbols-outlined text-white text-3xl">cloud_upload</span>
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={uploadAvatar}
                                    disabled={uploading}
                                />
                            </label>
                            {uploading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-text-secondary text-center max-w-[150px]">
                            Haz clic para cambiar tu foto. Max 2MB.
                        </p>
                    </div>

                    {/* Form Fields */}
                    <div className="flex-1 w-full space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1.5">Nombre Completo</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 material-symbols-outlined text-text-secondary text-[20px]">badge</span>
                                    <input
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="w-full bg-background-dark border border-border-dark rounded-lg text-white text-sm py-2.5 pl-10 pr-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                        placeholder="Ej. Alex Morgan"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1.5">Apodo (Nickname)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 material-symbols-outlined text-text-secondary text-[20px]">alternate_email</span>
                                    <input
                                        type="text"
                                        value={nickname}
                                        onChange={(e) => setNickname(e.target.value)}
                                        className="w-full bg-background-dark border border-border-dark rounded-lg text-white text-sm py-2.5 pl-10 pr-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                        placeholder="Ej. alexm"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1.5">Biografía</label>
                            <textarea
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                rows={4}
                                className="w-full bg-background-dark border border-border-dark rounded-lg text-white text-sm p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none placeholder-text-secondary/50"
                                placeholder="Escribe una breve descripción sobre ti..."
                            />
                            <p className="text-xs text-text-secondary mt-1 text-right">{bio.length}/500 caracteres</p>
                        </div>

                        <div className="pt-4 flex items-center justify-between">
                            {message && (
                                <div className={`text-sm flex items-center gap-2 ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                                    <span className="material-symbols-outlined text-[18px]">
                                        {message.type === 'success' ? 'check_circle' : 'error'}
                                    </span>
                                    {message.text}
                                </div>
                            )}
                            {!message && <div></div>} {/* Spacer */}

                            <button
                                onClick={updateProfile}
                                disabled={loading}
                                className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading && !uploading ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                ) : (
                                    <span className="material-symbols-outlined text-[20px]">save</span>
                                )}
                                Guardar Cambios
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfilePanel;
