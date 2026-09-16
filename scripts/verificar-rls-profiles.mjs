/**
 * Comprueba que la protección de `profiles` quedó bien puesta.
 *
 * Se corre DESPUÉS de aplicar `20260914180000_rls_profiles.sql`, y también
 * sirve ANTES para confirmar el diagnóstico: en ese caso las pruebas de
 * acceso anónimo van a fallar, que es justamente el problema.
 *
 *     node scripts/verificar-rls-profiles.mjs
 *
 * Todo lo que hace es LEER. No crea usuarios, no modifica ninguna fila y no
 * imprime nombres ni correos: sólo cuenta y compara.
 *
 * Lo que NO puede comprobar solo: si un usuario AUTENTICADO puede cambiar su
 * propio `role_id`. Eso exige una sesión real, y crear usuarios de prueba en
 * producción necesita autorización expresa. El script dice qué falta y cómo
 * hacerlo a mano.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !svcKey) {
    console.error('Faltan VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY en .env');
    process.exit(1);
}

const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const svc = createClient(url, svcKey, { auth: { persistSession: false } });

let fallos = 0;
const ok = (pasa, titulo, detalle = '') => {
    if (!pasa) fallos++;
    console.log(`  ${pasa ? 'OK   ' : 'FALLA'} ${titulo}${detalle ? ` — ${detalle}` : ''}`);
};

console.log('Verificación de la protección de `profiles`\n');

/* ── 1. Lo esencial: un anónimo no puede ver nada ────────────────────────── */
console.log('1. Acceso anónimo (la clave que viaja en el navegador)');

const { count: filasServicio } = await svc
    .from('profiles')
    .select('id', { count: 'exact', head: true });

const lecturaAnon = await anon.from('profiles').select('id', { count: 'exact', head: true });
/*
    Dos resultados son correctos y uno no:
      - error 42501  -> el privilegio de lectura está revocado. Perfecto.
      - 0 filas      -> RLS activa y ninguna política deja pasar al anónimo. Perfecto.
      - N filas      -> la tabla sigue abierta. Es el fallo que se vino a cerrar.
*/
const anonVeNada = Boolean(lecturaAnon.error) || (lecturaAnon.count ?? 0) === 0;
ok(
    anonVeNada,
    'un anónimo NO puede leer perfiles',
    lecturaAnon.error
        ? `bloqueado (${lecturaAnon.error.code})`
        : `${lecturaAnon.count} filas visibles de ${filasServicio}`,
);

const NADIE = '00000000-0000-0000-0000-000000000000';
for (const [etiqueta, prueba] of [
    ['UPDATE', () => anon.from('profiles').update({ full_name: 'x' }).eq('id', NADIE).select()],
    ['DELETE', () => anon.from('profiles').delete().eq('id', NADIE).select()],
    ['INSERT', () => anon.from('profiles').insert({ id: NADIE, email: 'x@x.invalid' }).select()],
]) {
    const r = await prueba();
    /*
        Se usa un id que no existe: si algo pasara igual, no tocaría ninguna
        fila real. Un 42501 o un 42P17 significa que el privilegio no está.
        Que no haya error NO demuestra que se pueda modificar una fila real,
        pero sí que el permiso sigue concedido, que es lo que hay que cerrar.
    */
    ok(Boolean(r.error), `un anónimo NO tiene privilegio de ${etiqueta}`,
        r.error ? `bloqueado (${r.error.code})` : 'el privilegio SIGUE concedido');
}

/* ── 2. Que el equipo siga pudiendo trabajar ─────────────────────────────── */
console.log('\n2. El servicio interno sigue operando (el agente y los scripts)');
const { error: errSvc, count: cSvc } = await svc
    .from('profiles')
    .select('id', { count: 'exact', head: true });
ok(!errSvc && (cSvc ?? 0) > 0, 'la clave de servicio lee los perfiles',
    errSvc ? errSvc.message : `${cSvc} perfiles`);

/* ── 3. Que nadie quede sin administrador ────────────────────────────────── */
console.log('\n3. Integridad de los roles');
const { count: admins } = await svc
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role_id', 1);
ok((admins ?? 0) >= 1, 'queda al menos un administrador', `${admins} con role_id = 1`);

const { count: activos } = await svc
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);
ok((activos ?? 0) >= 1, 'queda al menos una cuenta activa', `${activos} activas`);

/* ── 4. Lo que este script no puede probar solo ──────────────────────────── */
console.log('\n4. Pendiente de comprobación manual (requiere una sesión real)');
console.log('   Con una cuenta normal del equipo, desde el navegador:');
console.log('     a) iniciar sesión                      -> debe funcionar');
console.log('     b) abrir Ajustes y editar el perfil     -> debe guardar');
console.log('     c) abrir la pantalla de Equipo          -> debe listar a todos');
console.log('     d) en la consola del navegador:');
console.log("        await supabase.from('profiles').update({ role_id: 1 }).eq('id', (await supabase.auth.getUser()).data.user.id)");
console.log('        -> DEBE fallar. Si pasa, la escalada de privilegios sigue abierta.');

console.log(`\n${fallos === 0 ? 'Todas las comprobaciones automáticas pasaron.' : `${fallos} comprobación(es) fallaron.`}`);
process.exit(fallos === 0 ? 0 : 1);
