"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getHondurasNowISO } from "@/lib/utils/honduras-time"

export interface CambioPrecioPendiente {
  id?: number
  emprendimiento_id: number
  emprendimiento_nombre?: string | null
  razon_social_id: number
  producto_id: number
  producto_nombre: string
  codigo_barras: string
  precio_actual: number
  precio_nuevo: number
  motivo?: string | null
  estado?: "pendiente" | "aprobado" | "rechazado"
  motivo_rechazo?: string | null
  usuario?: string | null
  created_at?: string
}

export async function submitCambioPrecio(
  data: Omit<CambioPrecioPendiente, "id" | "estado">
): Promise<{ error: string | null }> {
  const supabase = createAdminClient()
  if (!supabase) return { error: "Cliente no disponible" }

  const { error } = await supabase.from("cambios_precio_pendientes").insert({
    emprendimiento_id: data.emprendimiento_id,
    razon_social_id:   data.razon_social_id,
    producto_id:       data.producto_id,
    producto_nombre:   data.producto_nombre,
    codigo_barras:     data.codigo_barras,
    precio_actual:     data.precio_actual,
    precio_nuevo:      data.precio_nuevo,
    motivo:            data.motivo ?? null,
    usuario:           data.usuario ?? null,
  })

  return { error: error?.message ?? null }
}

export async function getCambiosPrecioPendientes(
  razonSocialId: number
): Promise<CambioPrecioPendiente[]> {
  const supabase = createAdminClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("cambios_precio_pendientes")
    .select("*, emprendimientos(nombre)")
    .eq("razon_social_id", razonSocialId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[cambios-precio] Error getCambiosPrecioPendientes:", error)
    return []
  }
  return (data ?? []).map((row: any) => ({
    ...row,
    emprendimiento_nombre: row.emprendimientos?.nombre ?? null,
    emprendimientos: undefined,
  }))
}

export async function getCambiosPrecioByEmprendimiento(
  emprendimientoId: number
): Promise<CambioPrecioPendiente[]> {
  const supabase = createAdminClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("cambios_precio_pendientes")
    .select("*")
    .eq("emprendimiento_id", emprendimientoId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[cambios-precio] Error getCambiosPrecioByEmprendimiento:", error)
    return []
  }
  return data ?? []
}

export async function aprobarCambioPrecio(
  id: number,
  adminUsuario: string
): Promise<{ error: string | null }> {
  const supabase = createAdminClient()
  if (!supabase) return { error: "Cliente no disponible" }

  const { data: cambio, error: fetchErr } = await supabase
    .from("cambios_precio_pendientes")
    .select("*")
    .eq("id", id)
    .single()

  if (fetchErr || !cambio) return { error: "Solicitud no encontrada" }
  if (cambio.estado !== "pendiente") return { error: "Esta solicitud ya fue procesada" }

  const { error: prodErr } = await supabase
    .from("productos")
    .update({ precio_venta_sugerido: cambio.precio_nuevo, updated_at: getHondurasNowISO() })
    .eq("id", cambio.producto_id)

  if (prodErr) return { error: prodErr.message }

  const { error: updErr } = await supabase
    .from("cambios_precio_pendientes")
    .update({ estado: "aprobado", updated_at: getHondurasNowISO() })
    .eq("id", id)

  return { error: updErr?.message ?? null }
}

export async function rechazarCambioPrecio(
  id: number,
  motivo: string
): Promise<{ error: string | null }> {
  const supabase = createAdminClient()
  if (!supabase) return { error: "Cliente no disponible" }

  const { error } = await supabase
    .from("cambios_precio_pendientes")
    .update({ estado: "rechazado", motivo_rechazo: motivo, updated_at: getHondurasNowISO() })
    .eq("id", id)

  return { error: error?.message ?? null }
}
