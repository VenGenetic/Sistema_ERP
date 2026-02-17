
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '.env')

console.log('Reading .env from:', envPath)

try {
    const envContent = fs.readFileSync(envPath, 'utf-8')
    const envVars = {}
    envContent.split('\n').forEach(line => {
        const parts = line.split('=')
        if (parts.length >= 2) {
            const key = parts[0].trim()
            const value = parts.slice(1).join('=').trim()
            envVars[key] = value
        }
    })

    const url = envVars['VITE_SUPABASE_URL']
    const key = envVars['VITE_SUPABASE_ANON_KEY']

    console.log('URL:', url)
    console.log('Key length:', key ? key.length : 'undefined')

    if (!url || !key) {
        console.error('Missing credentials in .env')
        process.exit(1)
    }

    const supabase = createClient(url, key)

    console.log('Testing connection...')

    // Try to fetch something simple, e.g. verify the auth endpoint is responsive
    // or just a simple query if we knew a table name.
    // Since we don't know tables, we can try to get the session, which checks auth connectivity.
    const { data, error } = await supabase.auth.getSession()

    if (error) {
        console.error('Connection error:', error)
    } else {
        console.log('Connection successful! Session data:', data)
    }

} catch (err) {
    console.error('Script error:', err)
}
