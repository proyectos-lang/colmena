"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import type { ExcelProductoRow } from "@/lib/utils/excel-parsers"

export interface ProductoPendiente {
  id?: number
  emprendimiento_id: number
  emprendimiento_nombre?: string
  razon_social_id: number
  nombre: string
  codigo_barras: string
  precio_venta_sugerido: number
  precio_costo?: number | null
  cantidad_inicial?: number
  foto_url?: string | null
  marca_nombre?: string | null
  categoria_nombre?: string | null
  subcategoria_nombre?: string | null
  estado?: "pendiente" | "aprobado" | "rechazado"
  motivo_rechazo?: string | null
  usuario?: string | null
  created_at?: string
}

export async function submitProductoPendiente(
  data: Omit<ProductoPendiente, "id" | "estado">
): Promise<{ error: string | null }> {
  const supabase = createAdminClient()
  if (!supabase) return { error: "Cliente no disponible" }

  const { error } = await supabase.from("productos_pendientes").insert({
    emprendimiento_id: data.emprendimiento_id,
    razon_social_id: data.razon_social_id,
    nombre: data.nombre,
    codigo_barras: data.codigo_barras,
    precio_venta_sugerido: data.precio_venta_sugerido,
    precio_costo: data.precio_costo ?? null,
    cantidad_inicial: data.cantidad_inicial ?? 0,
    foto_url: data.foto_url ?? null,
    marca_nombre: data.marca_nombre ?? null,
    categoria_nombre: data.categoria_nombre ?? null,
    subcategoria_nombre: data.subcategoria_nombre ?? null,
    usuario: data.usuario ?? null,
  })

  return { error: error?.message ?? null }
}

export async function submitProductosPendientesBulk(
  rows: ExcelProductoRow[],
  emprendimientoId: number,
  razonSocialId: number,
  usuario: string
): Promise<{ insertados: number; error: string | null }> {
  const supabase = createAdminClient()
  if (!supabase) return { insertados: 0, error: "Cliente no disponible" }

  const payload = rows.map((r) => ({
    emprendimiento_id: emprendimientoId,
    razon_social_id: razonSocialId,
    nombre: r.nombre,
    codigo_barras: String(r.codigo_barras),
    precio_venta_sugerido: Number(r.precio_venta_sugerido) || 0,
    precio_costo: null,
    cantidad_inicial: Number(r.cantidad_inicial) || 0,
    marca_nombre: r.marca ?? null,
    categoria_nombre: r.categoria ?? null,
    subcategoria_nombre: r.subcategoria ?? null,
    usuario,
  }))

  const { error } = await supabase.from("productos_pendientes").insert(payload)
  if (error) return { insertados: 0, error: error.message }
  return { insertados: rows.length, error: null }
}

export async function getProductosPendientes(
  razonSocialId: number,
  estado?: "pendiente" | "aprobado" | "rechazado"
): Promise<ProductoPendiente[]> {
  const supabase = createAdminClient()
  if (!supabase) return []

  let query = supabase
    .from("productos_pendientes")
    .select("*, emprendimientos(nombre)")
    .eq("razon_social_id", razonSocialId)
    .order("created_at", { ascending: false })

  if (estado) query = query.eq("estado", estado)

  const { data, error } = await query
  if (error) {
    console.error("[productos-pendientes] Error:", error)
    return []
  }

  return (data ?? []).map((row: any) => ({
    ...row,
    emprendimiento_nombre: row.emprendimientos?.nombre ?? null,
    emprendimientos: undefined,
  }))
}

export async function getProductosPendientesByEmprendimiento(
  emprendimientoId: number
): Promise<ProductoPendiente[]> {
  const supabase = createAdminClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("productos_pendientes")
    .select("*")
    .eq("emprendimiento_id", emprendimientoId)
    .order("created_at", { ascending: false })

  if (error) return []
  return data ?? []
}

async function resolveOrCreateMarca(
  supabase: ReturnType<typeof createAdminClient>,
  nombre: string | null | undefined,
  razonSocialId: number
): Promise<number | null> {
  if (!supabase || !nombre?.trim()) return null

  const { data } = await supabase
    .from("marcas")
    .select("id")
    .eq("nombre", nombre.trim())
    .eq("razon_social_id", razonSocialId)
    .single()

  if (data?.id) return data.id

  const { data: created } = await supabase
    .from("marcas")
    .insert({ nombre: nombre.trim(), razon_social_id: razonSocialId })
    .select("id")
    .single()

  return created?.id ?? null
}

async function resolveOrCreateCategoria(
  supabase: ReturnType<typeof createAdminClient>,
  nombre: string | null | undefined,
  razonSocialId: number
): Promise<number | null> {
  if (!supabase || !nombre?.trim()) return null

  const { data } = await supabase
    .from("categorias")
    .select("id")
    .eq("nombre", nombre.trim())
    .eq("razon_social_id", razonSocialId)
    .single()

  if (data?.id) return data.id

  const { data: created } = await supabase
    .from("categorias")
    .insert({ nombre: nombre.trim(), razon_social_id: razonSocialId })
    .select("id")
    .single()

  return created?.id ?? null
}

export async function aprobarProductoPendiente(
  id: number,
  adminUsuario: string,
  razonSocialId: number,
  almacenIdDefault?: number,
  localizacionIdDefault?: number
): Promise<{ error: string | null }> {
  const supabase = createAdminClient()
  if (!supabase) return { error: "Cliente no disponible" }

  const { data: pendiente, error: fetchErr } = await supabase
    .from("productos_pendientes")
    .select("*")
    .eq("id", id)
    .single()

  if (fetchErr || !pendiente) return { error: "Producto pendiente no encontrado" }
  if (pendiente.estado !== "pendiente") return { error: "Este producto ya fue procesado" }

  const marcaId = await resolveOrCreateMarca(supabase, pendiente.marca_nombre, razonSocialId)
  const categoriaId = await resolveOrCreateCategoria(supabase, pendiente.categoria_nombre, razonSocialId)

  const productoPayload: Record<string, unknown> = {
    nombre: pendiente.nombre,
    codigo_barras: pendiente.codigo_barras,
    precio_venta_sugerido: pendiente.precio_venta_sugerido,
    costo_promedio: pendiente.precio_costo ?? 0,
    stock_total: 0,
    foto_url: pendiente.foto_url ?? null,
    marca_id: marcaId,
    categoria_id: categoriaId,
    emprendimiento_id: pendiente.emprendimiento_id,
    razon_social_id: razonSocialId,
    usuario: adminUsuario,
  }

  const { data: productoInsertado, error: prodErr } = await supabase
    .from("productos")
    .insert(productoPayload)
    .select("id")
    .single()

  if (prodErr || !productoInsertado) return { error: prodErr?.message ?? "Error al crear producto" }

  const productoId = productoInsertado.id

  if ((pendiente.cantidad_inicial ?? 0) > 0 && almacenIdDefault && localizacionIdDefault) {
    const txPayload = {
      producto_id: productoId,
      almacen_id: almacenIdDefault,
      localizacion_id: localizacionIdDefault,
      tipo_movimiento: "Ingreso Manual",
      cantidad: pendiente.cantidad_inicial,
      costo_o_precio_unitario: pendiente.precio_costo ?? 0,
      razon_social_id: razonSocialId,
      usuario: adminUsuario,
    }

    const { error: txErr } = await supabase.from("transacciones_inventario").insert(txPayload)
    if (!txErr) {
      await supabase
        .from("productos")
        .update({ stock_total: pendiente.cantidad_inicial, costo_promedio: pendiente.precio_costo ?? 0 })
        .eq("id", productoId)
    }
  }

  await supabase
    .from("productos_pendientes")
    .update({ estado: "aprobado", updated_at: new Date().toISOString() })
    .eq("id", id)

  return { error: null }
}

export async function rechazarProductoPendiente(
  id: number,
  motivo: string
): Promise<{ error: string | null }> {
  const supabase = createAdminClient()
  if (!supabase) return { error: "Cliente no disponible" }

  const { error } = await supabase
    .from("productos_pendientes")
    .update({ estado: "rechazado", motivo_rechazo: motivo, updated_at: new Date().toISOString() })
    .eq("id", id)

  return { error: error?.message ?? null }
}

export async function countAprobacionesPendientes(razonSocialId: number): Promise<number> {
  const supabase = createAdminClient()
  if (!supabase) return 0

  const [r1, r2] = await Promise.all([
    supabase
      .from("productos_pendientes")
      .select("id", { count: "exact", head: true })
      .eq("razon_social_id", razonSocialId)
      .eq("estado", "pendiente"),
    supabase
      .from("ingresos_inventario_pendientes")
      .select("id", { count: "exact", head: true })
      .eq("razon_social_id", razonSocialId)
      .eq("estado", "pendiente"),
  ])

  return (r1.count ?? 0) + (r2.count ?? 0)
}
