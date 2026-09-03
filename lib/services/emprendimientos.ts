"use server"

import { createClient } from "@/lib/supabase/client"
import { createAdminClient } from "@/lib/supabase/admin"

export interface Emprendimiento {
  id?: number
  razon_social_id?: number
  nombre: string
  descripcion?: string | null
  email_contacto?: string | null
  telefono?: string | null
  zona?: string | null
  valor_alquiler_mensual?: number
  activo?: boolean
  usuario?: string
  created_at?: string
  usuarios_count?: number
}

export async function getEmprendimientos(razonSocialId: number): Promise<Emprendimiento[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("emprendimientos")
    .select("*")
    .eq("razon_social_id", razonSocialId)
    .eq("activo", true)
    .order("nombre", { ascending: true })

  if (error) {
    console.error("[emprendimientos] Error al obtener:", error)
    return []
  }
  return data ?? []
}

export async function getEmprendimientoById(id: number): Promise<Emprendimiento | null> {
  const supabase = createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from("emprendimientos")
    .select("*")
    .eq("id", id)
    .single()

  if (error) return null
  return data
}

export async function saveEmprendimiento(
  data: Emprendimiento,
  isNew: boolean,
  razonSocialId: number,
  usuarioNombre: string
): Promise<{ id: number | null; error: string | null }> {
  const supabase = createAdminClient()
  if (!supabase) return { id: null, error: "Cliente admin no disponible" }

  const payload: Record<string, unknown> = {
    nombre: data.nombre,
    descripcion: data.descripcion ?? null,
    email_contacto: data.email_contacto ?? null,
    telefono: data.telefono ?? null,
    zona: data.zona ?? null,
    valor_alquiler_mensual: data.valor_alquiler_mensual ?? 0,
    activo: data.activo ?? true,
  }

  if (isNew) {
    payload.razon_social_id = razonSocialId
    payload.usuario = usuarioNombre

    const { data: inserted, error } = await supabase
      .from("emprendimientos")
      .insert(payload)
      .select("id")
      .single()

    if (error) return { id: null, error: error.message }
    return { id: inserted.id, error: null }
  } else {
    const { error } = await supabase
      .from("emprendimientos")
      .update(payload)
      .eq("id", data.id!)

    return { id: data.id ?? null, error: error?.message ?? null }
  }
}

/**
 * "Eliminar" un emprendimiento = DESACTIVARLO (baja logica). No borra la fila
 * ni sus ventas: conserva el historial. Efectos:
 *  - Oculta sus productos (baja logica) → salen de catalogo, POS, inventario y restock.
 *  - Bloquea el login de sus usuarios del portal.
 *  - Borra sus alquileres PENDIENTES (los pagados quedan como historial).
 *  - Marca el emprendimiento como inactivo → desaparece de listados y selectores.
 */
export async function deleteEmprendimiento(id: number): Promise<{ error: string | null }> {
  const supabase = createAdminClient()
  if (!supabase) return { error: "Cliente admin no disponible" }

  // 1. Ocultar productos del emprendimiento (baja logica; el historial de ventas
  //    los sigue referenciando para mostrar nombre/precio).
  await supabase
    .from("productos")
    .update({ activo: false })
    .eq("emprendimiento_id", id)

  // 2. Bloquear el acceso al portal de sus usuarios (cierra sesion activa).
  await supabase
    .from("emprendedores_usuarios")
    .update({ activo: false, session_token: null, token_expires_at: null })
    .eq("emprendimiento_id", id)

  // 3. Borrar los alquileres PENDIENTES para que salgan de pagos/liquidaciones.
  //    Los pagados se conservan como historial.
  await supabase
    .from("pagos_alquiler_emprendimientos")
    .delete()
    .eq("emprendimiento_id", id)
    .eq("estado", "pendiente")

  // 4. Desactivar el emprendimiento (paso critico: reportamos su error).
  const { error } = await supabase
    .from("emprendimientos")
    .update({ activo: false })
    .eq("id", id)

  return { error: error?.message ?? null }
}
