import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey)
}

// Singleton: un solo cliente de Supabase por tab del navegador.
// Evita que multiples instancias compitan por el mismo storage/session
// y resuelve bugs de "Cargando sesion..." colgado al refrescar.
let browserClient: SupabaseClient | null = null

export function createClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      '[Supabase] Variables de entorno no configuradas. ' +
      'Asegurate de definir NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY'
    )
    return null
  }

  if (!browserClient) {
    // El SDK infiere el schema en un generico que por defecto es 'public'.
    // Como la app vive en 'colmena', el tipo concreto no encaja con el
    // `SupabaseClient` por defecto que consumen los servicios. El cliente en
    // runtime es correcto; solo normalizamos el tipo expuesto.
    browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey, {
      db: { schema: 'colmena' },
    }) as unknown as SupabaseClient
  }

  return browserClient
}
