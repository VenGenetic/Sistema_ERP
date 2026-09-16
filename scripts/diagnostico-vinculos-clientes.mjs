/**
 * Vista previa del trabajo de vincular conversaciones con clientes.
 *
 * NO MODIFICA NADA. Sólo clasifica qué se podría vincular, qué es ambiguo y
 * qué no tiene arreglo automático, para poder decidir con números en la mano
 * antes de tocar 11.000 conversaciones.
 *
 *     node scripts/diagnostico-vinculos-clientes.mjs
 *     node scripts/diagnostico-vinculos-clientes.mjs --muestra 3000
 *
 * Por qué hace falta: `agent_conversations.customer_id` está en NULL en todas
 * las conversaciones. Mientras siga así, una venta que nace de un chat no se
 * puede cruzar con ese chat, y la atribución publicitaria no tiene de dónde
 * agarrarse.
 *
 * Qué NO hace, a propósito:
 *   - no crea clientes;
 *   - no fusiona fichas parecidas;
 *   - no escribe `customer_id`;
 *   - no imprime teléfonos completos ni nombres de clientes.
 *
 * Los teléfonos se muestran enmascarados (593•••••1125): alcanza para
 * reconocer un caso y no alcanza para llevarse la base de contactos.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});

const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };
const LIMITE = Number(arg('--muestra') ?? 12000);

/* ── Las mismas reglas que utils/compradorDeChat.ts ──────────────────────── */
const PREFIJO_DE_GRUPO = '120363';
const pareceGrupo = (d) => d.startsWith(PREFIJO_DE_GRUPO) || d.length >= 16;
const pareceLid = (d, lid) => (lid && d === String(lid).replace(/\D/g, '')) || d.length > 13;

function telefonoNormalizado(tel, lid) {
    if (!tel) return null;
    let d = String(tel).replace(/\D/g, '');
    if (d.startsWith('00')) d = d.slice(2);
    if (pareceGrupo(d) || pareceLid(d, lid)) return null;
    if (d.length === 10 && d.startsWith('0')) d = '593' + d.slice(1);
    else if (d.length === 9 && d.startsWith('9')) d = '593' + d;
    return d.length >= 10 && d.length <= 13 ? d : null;
}

/** 593982901125 -> 593•••••1125. Reconocible, no reutilizable. */
const enmascarar = (t) => (t && t.length > 8 ? `${t.slice(0, 3)}${'•'.repeat(t.length - 7)}${t.slice(-4)}` : '•••');

async function main() {
    console.log('Vista previa de vinculación conversación → cliente');
    console.log('(no modifica nada)\n');

    const { data: convs, error } = await db
        .from('agent_conversations')
        .select('id, phone_number, customer_name, lid, is_group, customer_id, last_message_at')
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(LIMITE);
    if (error) throw new Error(error.message);

    const { data: clientes, error: e2 } = await db
        .from('customers')
        .select('id, phone, name, is_final_consumer');
    if (e2) throw new Error(e2.message);

    /*
        Se indexan los clientes por TODAS las formas en que su teléfono pudo
        haberse guardado. Las fichas viejas tienen "0982901125" y las nuevas
        "593982901125": si sólo se buscara por la forma normalizada, el mismo
        cliente parecería dos personas distintas y se crearía una tercera.
    */
    const porTelefono = new Map();
    for (const c of clientes ?? []) {
        for (const forma of [c.phone, telefonoNormalizado(c.phone)]) {
            if (!forma) continue;
            const clave = String(forma).replace(/\D/g, '');
            if (!porTelefono.has(clave)) porTelefono.set(clave, []);
            if (!porTelefono.get(clave).some((x) => x.id === c.id)) porTelefono.get(clave).push(c);
        }
    }

    const cat = {
        ya_vinculada: [], exacta: [], ambigua: [], sin_cliente: [],
        es_grupo: [], es_lid: [], sin_telefono: [],
    };

    for (const cv of convs ?? []) {
        if (cv.customer_id) { cat.ya_vinculada.push(cv); continue; }
        if (cv.is_group === true) { cat.es_grupo.push(cv); continue; }

        const crudo = String(cv.phone_number ?? '').replace(/\D/g, '');
        if (!crudo) { cat.sin_telefono.push(cv); continue; }
        if (pareceGrupo(crudo)) { cat.es_grupo.push(cv); continue; }
        if (pareceLid(crudo, cv.lid)) { cat.es_lid.push(cv); continue; }

        const tel = telefonoNormalizado(cv.phone_number, cv.lid);
        if (!tel) { cat.sin_telefono.push(cv); continue; }

        const candidatos = [
            ...(porTelefono.get(tel) ?? []),
            ...(tel.startsWith('593') ? porTelefono.get('0' + tel.slice(3)) ?? [] : []),
        ];
        const unicos = [...new Map(candidatos.map((c) => [c.id, c])).values()]
            .filter((c) => !c.is_final_consumer);

        if (unicos.length === 1) cat.exacta.push({ ...cv, tel, cliente: unicos[0] });
        else if (unicos.length > 1) cat.ambigua.push({ ...cv, tel, clientes: unicos });
        else cat.sin_cliente.push({ ...cv, tel });
    }

    const total = (convs ?? []).length;
    const linea = (etiqueta, arr, nota) =>
        console.log(`  ${String(arr.length).padStart(6)}  ${etiqueta.padEnd(34)} ${nota}`);

    console.log(`Conversaciones analizadas: ${total}\n`);
    console.log('CLASIFICACIÓN');
    console.log('─────────────');
    linea('Ya vinculadas', cat.ya_vinculada, 'nada que hacer');
    linea('Vínculo exacto', cat.exacta, 'un solo cliente con ese teléfono');
    linea('Ambiguas', cat.ambigua, 'varios clientes — NO fusionar solo');
    linea('Sin cliente todavía', cat.sin_cliente, 'teléfono válido, ficha inexistente');
    linea('Son grupos', cat.es_grupo, 'no son clientes, se excluyen');
    linea('Sólo tienen LID', cat.es_lid, 'el cliente oculta su número');
    linea('Sin teléfono usable', cat.sin_telefono, 'no hay por dónde');

    const suma = Object.values(cat).reduce((a, v) => a + v.length, 0);
    console.log(`  ${String(suma).padStart(6)}  ${'TOTAL'.padEnd(34)} ${suma === total ? '(cuadra)' : '(NO CUADRA — revisar)'}`);

    if (cat.ambigua.length > 0) {
        console.log('\nAMBIGUAS — cada una necesita que una persona decida');
        console.log('────────────────────────────────────────────────────');
        for (const a of cat.ambigua.slice(0, 15)) {
            console.log(`  chat ${String(a.id).padEnd(7)} ${enmascarar(a.tel)}  →  ${a.clientes.length} fichas: ${a.clientes.map((c) => `#${c.id}`).join(', ')}`);
        }
        if (cat.ambigua.length > 15) console.log(`  … y ${cat.ambigua.length - 15} más`);
    }

    console.log('\nLECTURA');
    console.log('───────');
    console.log(`  Vinculables sin decisión humana : ${cat.exacta.length}`);
    console.log(`  Requieren crear ficha de cliente: ${cat.sin_cliente.length}`);
    console.log(`  Requieren decisión humana       : ${cat.ambigua.length}`);
    console.log(`  Fuera de alcance (grupo/LID)    : ${cat.es_grupo.length + cat.es_lid.length}`);
    console.log('\nNada de esto se aplicó. Vincular el histórico es una decisión aparte.');
}

main().catch((e) => { console.error('Falló el diagnóstico:', e.message); process.exit(1); });
