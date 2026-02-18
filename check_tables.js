
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

async function check() {
    console.log('Checking for profiles table...')
    const { data, error } = await supabase.from('profiles').select('count').limit(1)
    if (error) {
        console.log('Error checking profiles table:', error.message)
        if (error.code === '42P01') { // undefined_table
            console.log('Table "profiles" does NOT exist.')
        } else {
            console.log('Likely exists but error:', error.message)
        }
    } else {
        console.log('Profiles table exists.')
    }
}

check()
