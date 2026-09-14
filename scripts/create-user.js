/**
 * Crea un usuario del ERP: lo da de alta en Supabase Auth y completa su fila en `profiles`.
 *
 * Uso:
 *   node scripts/create-user.js --name "Nombre Apellido" --email correo@dominio.com --password "clave-inicial" --role admin
 *
 * Notas:
 * - Requiere SUPABASE_SERVICE_ROLE_KEY en .env (bypassa RLS; nunca se sube al navegador).
 * - El email queda confirmado de una, sin correo de verificacion.
 * - Un trigger de Postgres crea la fila de `profiles` al insertarse el usuario en auth.users;
 *   este script espera esa fila y luego la actualiza con el nombre y el rol correctos.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ quiet: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error('Error: falta VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
    process.exit(1);
}

function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i += 2) {
        const key = argv[i];
        if (!key?.startsWith('--')) continue;
        args[key.slice(2)] = argv[i + 1];
    }
    return args;
}

const { name, email, password, role = 'admin', nickname } = parseArgs(process.argv.slice(2));

if (!name || !email || !password) {
    console.error('Uso: node scripts/create-user.js --name "Nombre Apellido" --email correo@dominio.com --password "clave" --role admin [--nickname "Apodo"]');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

const normalizedEmail = email.trim().toLowerCase();

// 1. Resolver el rol por nombre (case-insensitive) contra la tabla `roles`.
const { data: roles, error: rolesError } = await supabase.from('roles').select('id, name');
if (rolesError) {
    console.error('No se pudieron leer los roles:', rolesError.message);
    process.exit(1);
}

const matchedRole = roles.find((r) => r.name.toLowerCase() === role.toLowerCase());
if (!matchedRole) {
    console.error(`Rol "${role}" no existe. Roles disponibles: ${roles.map((r) => r.name).join(', ')}`);
    process.exit(1);
}

// 2. Crear el usuario en Auth (o reutilizarlo si el correo ya existe).
let userId;
const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
});

if (createError) {
    const alreadyExists = /already|registered|exists/i.test(createError.message);
    if (!alreadyExists) {
        console.error('No se pudo crear el usuario:', createError.message);
        process.exit(1);
    }

    const { data: list, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) {
        console.error('El usuario ya existe pero no se pudo localizar:', listError.message);
        process.exit(1);
    }
    const existing = list.users.find((u) => u.email?.toLowerCase() === normalizedEmail);
    if (!existing) {
        console.error(`El correo ${normalizedEmail} ya esta registrado pero no aparece en la lista de usuarios.`);
        process.exit(1);
    }
    userId = existing.id;
    console.log(`El usuario ya existia (${userId}); se actualizara su contrasena y su perfil.`);
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: { full_name: name },
    });
    if (updateError) {
        console.error('No se pudo actualizar el usuario existente:', updateError.message);
        process.exit(1);
    }
} else {
    userId = created.user.id;
    console.log(`Usuario creado en Auth: ${normalizedEmail} (${userId})`);
}

// 3. Esperar a que el trigger cree la fila de profiles; si no aparece, insertarla a mano.
const profilePatch = {
    full_name: name,
    email: normalizedEmail,
    role_id: matchedRole.id,
    is_active: true,
    ...(nickname ? { nickname } : {}),
};

let profile = null;
for (let attempt = 0; attempt < 5 && !profile; attempt++) {
    const { data } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
    if (data) profile = data;
    else await new Promise((resolve) => setTimeout(resolve, 500));
}

const { error: profileError } = profile
    ? await supabase.from('profiles').update(profilePatch).eq('id', userId)
    : await supabase.from('profiles').insert({ id: userId, ...profilePatch });

if (profileError) {
    console.error('El usuario quedo creado en Auth pero fallo su perfil:', profileError.message);
    process.exit(1);
}

const { data: final } = await supabase
    .from('profiles')
    .select('id, full_name, email, nickname, role_id, is_active, referral_code, roles(name)')
    .eq('id', userId)
    .single();

console.log('Perfil listo:');
console.log(JSON.stringify(final, null, 2));
