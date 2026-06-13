import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Sello multi-tenant + auditoria que se inyecta en CADA insert de la app.
 *
 *   razon_social_id: tenant del registro (aislamiento multi-empresa).
 *   usuario:         nombre del usuario logueado que creo el registro (auditoria).
 *
 * Uso tipico en una funcion de servicio:
 *
 *   const stamp = await getTenantStamp(supabase)
 *   if (!isValidStamp(stamp)) {
 *     return { data: null, error: SESION_INVALIDA_ERROR }
 *   }
 *   await supabase.from("marcas").insert({ nombre, ...stamp })
 */
export interface TenantStamp {
  razon_social_id: number | null
  usuario: string | null
}

/** Mensaje estandar cuando falta tenant o usuario en la sesion */
export const SESION_INVALIDA_ERROR =
  "Sesion invalida, no se pudo registrar la empresa o usuario"

/**
 * Devuelve `{ razon_social_id, usuario }` del usuario actualmente logueado.
 * Si no hay sesion o el perfil no esta enlazado, devuelve valores null.
 */
export async function getTenantStamp(
  supabase: SupabaseClient
): Promise<TenantStamp> {
  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser) {
      return { razon_social_id: null, usuario: null }
    }

    const { data, error } = await supabase
      .from("usuarios")
      .select("razon_social_id, nombre")
      .eq("id", authUser.id)
      .single()

    if (error || !data) {
      console.log("[v0][tenant-stamp] No se pudo leer usuarios:", error)
      return { razon_social_id: null, usuario: null }
    }

    return {
      razon_social_id: data.razon_social_id ?? null,
      usuario: data.nombre ?? null,
    }
  } catch (err) {
    console.log("[v0][tenant-stamp] Excepcion:", err)
    return { razon_social_id: null, usuario: null }
  }
}

/** true si ambos campos estan presentes y son utilizables en un insert */
export function isValidStamp(stamp: TenantStamp): boolean {
  return (
    stamp.razon_social_id != null &&
    typeof stamp.usuario === "string" &&
    stamp.usuario.trim().length > 0
  )
}
