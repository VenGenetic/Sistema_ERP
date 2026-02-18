
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    console.log('Missing env vars')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkColumns() {
    console.log('Fetching profiles table structure...')
    // We can't easily get table structure via anon key if RLS is on for postgres_api, 
    // but we can try to select a row and see what's there or use a hacky way to get headers.
    // Alternatively, we can just try to select * and see the keys of the first object.
    const { data, error } = await supabase.from('profiles').select('*').limit(1)

    if (error) {
        console.error('Error fetching profiles:', error.message)
    } else if (data && data.length > 0) {
        console.log('Columns found:', Object.keys(data[0]).join(', '))
    } else {
        console.log('No data in profiles table, cannot infer columns this way.')
        // Fallback: try to insert a dummy row with many fields and see what errors we get
    }
}

checkColumns()
