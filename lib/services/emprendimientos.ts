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

export async function deleteEmprendimiento(id: number): Promise<{ error: string | null }> {
  const supabase = createAdminClient()
  if (!supabase) return { error: "Cliente admin no disponible" }

  const { error } = await supabase
    .from("emprendimientos")
    .delete()
    .eq("id", id)

  return { error: error?.message ?? null }
}
