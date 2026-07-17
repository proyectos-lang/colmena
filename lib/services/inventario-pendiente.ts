"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import type { RawInventarioRow } from "@/lib/utils/excel-parsers"
import { getHondurasNowISO } from "@/lib/utils/honduras-time"

export interface IngresoPendiente {
  id?: number
  emprendimiento_id: number
  emprendimiento_nombre?: string
  razon_social_id: number
  producto_id: number
  producto_nombre?: string
  producto_codigo?: string
  almacen_id?: number | null
  almacen_nombre?: string
  cantidad: number
  costo_unitario?: number | null
  estado?: "pendiente" | "aprobado" | "rechazado"
  motivo_rechazo?: string | null
  usuario?: string | null
  created_at?: string
}

export async function submitIngresoPendiente(
  data: Omit<IngresoPendiente, "id" | "estado">
): Promise<{ error: string | null }> {
  const supabase = createAdminClient()
  if (!supabase) return { error: "Cliente no disponible" }

  const { error } = await supabase.from("ingresos_inventario_pendientes").insert({
    emprendimiento_id: data.emprendimiento_id,
    razon_social_id: data.razon_social_id,
    producto_id: data.producto_id,
    almacen_id: data.almacen_id ?? null,
    cantidad: data.cantidad,
    costo_unitario: data.costo_unitario ?? null,
    usuario: data.usuario ?? null,
  })

  return { error: error?.message ?? null }
}

export async function submitIngresosBulkFromCodigos(
  rawRows: RawInventarioRow[],
  emprendimientoId: number,
  razonSocialId: number,
  usuario: string,
  almacenId?: number | null
): Promise<{ insertados: number; rowErrors: string[]; error: string | null }> {
  const supabase = createAdminClient()
  if (!supabase) return { insertados: 0, rowErrors: [], error: "Cliente no disponible" }

  const rowErrors: string[] = []
  const payload: any[] = []

  for (const row of rawRows) {
    const { data: producto } = await supabase
      .from("productos")
      .select("id")
      .eq("codigo_barras", row.codigo_barras)
      .eq("emprendimiento_id", emprendimientoId)
      .single()

    if (!producto?.id) {
      rowErrors.push(`Código "${row.codigo_barras}": producto no encontrado`)
      continue
    }

    payload.push({
      emprendimiento_id: emprendimientoId,
      razon_social_id: razonSocialId,
      producto_id: producto.id,
      almacen_id: almacenId ?? null,
      cantidad: row.cantidad,
      costo_unitario: null,
      usuario,
    })
  }

  if (payload.length === 0) return { insertados: 0, rowErrors, error: null }

  const { error } = await supabase.from("ingresos_inventario_pendientes").insert(payload)
  if (error) return { insertados: 0, rowErrors, error: error.message }

  return { insertados: payload.length, rowErrors, error: null }
}

export async function getIngresosPendientes(
  razonSocialId: number,
  estado?: "pendiente" | "aprobado" | "rechazado"
): Promise<IngresoPendiente[]> {
  const supabase = createAdminClient()
  if (!supabase) return []

  let query = supabase
    .from("ingresos_inventario_pendientes")
    .select("*, emprendimientos(nombre), productos(nombre, codigo_barras), almacenes(nombre)")
    .eq("razon_social_id", razonSocialId)
    .order("created_at", { ascending: false })

  if (estado) query = query.eq("estado", estado)

  const { data, error } = await query
  if (error) {
    console.error("[inventario-pendiente] Error:", error)
    return []
  }

  return (data ?? []).map((row: any) => ({
    ...row,
    emprendimiento_nombre: row.emprendimientos?.nombre ?? null,
    producto_nombre: row.productos?.nombre ?? null,
    producto_codigo: row.productos?.codigo_barras ?? null,
    almacen_nombre: row.almacenes?.nombre ?? null,
    emprendimientos: undefined,
    productos: undefined,
    almacenes: undefined,
  }))
}

export async function getIngresosPendientesByEmprendimiento(
  emprendimientoId: number
): Promise<IngresoPendiente[]> {
  const supabase = createAdminClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("ingresos_inventario_pendientes")
    .select("*, productos(nombre, codigo_barras), almacenes(nombre)")
    .eq("emprendimiento_id", emprendimientoId)
    .order("created_at", { ascending: false })

  if (error) return []

  return (data ?? []).map((row: any) => ({
    ...row,
    producto_nombre: row.productos?.nombre ?? null,
    producto_codigo: row.productos?.codigo_barras ?? null,
    almacen_nombre: row.almacenes?.nombre ?? null,
    productos: undefined,
    almacenes: undefined,
  }))
}

export async function aprobarIngresoPendiente(
  id: number,
  adminUsuario: string,
  almacenId: number,
  localizacionId: number
): Promise<{ error: string | null }> {
  const supabase = createAdminClient()
  if (!supabase) return { error: "Cliente no disponible" }

  const { data: ingreso, error: fetchErr } = await supabase
    .from("ingresos_inventario_pendientes")
    .select("*")
    .eq("id", id)
    .single()

  if (fetchErr || !ingreso) return { error: "Ingreso pendiente no encontrado" }
  if (ingreso.estado !== "pendiente") return { error: "Este ingreso ya fue procesado" }

  const { error: txErr } = await supabase.from("transacciones_inventario").insert({
    producto_id: ingreso.producto_id,
    almacen_id: almacenId,
    localizacion_id: localizacionId,
    tipo_movimiento: "Ingreso Manual",
    cantidad: ingreso.cantidad,
    costo_o_precio_unitario: ingreso.costo_unitario ?? 0,
    razon_social_id: ingreso.razon_social_id,
    usuario: adminUsuario,
  })

  if (txErr) return { error: txErr.message }

  const { data: producto } = await supabase
    .from("productos")
    .select("stock_total, costo_promedio")
    .eq("id", ingreso.producto_id)
    .single()

  if (producto) {
    const nuevoStock = (producto.stock_total ?? 0) + ingreso.cantidad
    const costoProm =
      ingreso.costo_unitario && ingreso.costo_unitario > 0
        ? ((producto.costo_promedio ?? 0) * (producto.stock_total ?? 0) +
            ingreso.costo_unitario * ingreso.cantidad) /
          nuevoStock
        : producto.costo_promedio

    await supabase
      .from("productos")
      .update({ stock_total: nuevoStock, costo_promedio: costoProm })
      .eq("id", ingreso.producto_id)
  }

  await supabase
    .from("ingresos_inventario_pendientes")
    .update({ estado: "aprobado", updated_at: getHondurasNowISO() })
    .eq("id", id)

  return { error: null }
}

export async function rechazarIngresoPendiente(
  id: number,
  motivo: string
): Promise<{ error: string | null }> {
  const supabase = createAdminClient()
  if (!supabase) return { error: "Cliente no disponible" }

  const { error } = await supabase
    .from("ingresos_inventario_pendientes")
    .update({ estado: "rechazado", motivo_rechazo: motivo, updated_at: getHondurasNowISO() })
    .eq("id", id)

  return { error: error?.message ?? null }
}

// ==================== BÚSQUEDA DE PRODUCTOS POR EMPRENDIMIENTO ====================

export async function buscarProductosByEmprendimiento(
  emprendimientoId: number,
  query: string,
  limit = 100
): Promise<Omit<StockEmprendedor, "stock_total">[]> {
  const supabase = createAdminClient()
  if (!supabase) return []

  const q = query.trim()
  if (!q) return []

  const { data, error } = await supabase
    .from("productos")
    .select("id, nombre, codigo_barras, precio_venta_sugerido")
    .eq("emprendimiento_id", emprendimientoId)
    .or(`nombre.ilike.%${q}%,codigo_barras.eq.${q}`)
    .order("codigo_barras", { ascending: true })
    .limit(limit)

  if (error) {
    console.error("[inventario] Error buscarProductosByEmprendimiento:", error)
    return []
  }

  return (data ?? []).map((p: any) => ({
    producto_id: p.id,
    nombre: p.nombre,
    codigo_barras: p.codigo_barras ?? "",
    precio_venta_sugerido: p.precio_venta_sugerido ?? 0,
  }))
}

// ==================== STOCK POR EMPRENDIMIENTO ====================

export interface StockEmprendedor {
  producto_id: number
  nombre: string
  codigo_barras: string
  precio_venta_sugerido: number
  stock_total: number
  created_at?: string
}

export async function getStockByEmprendimiento(
  emprendimientoId: number,
  _razonSocialId: number
): Promise<StockEmprendedor[]> {
  const supabase = createAdminClient()
  if (!supabase) return []

  const PAGE = 1000

  try {
    // Paginar productos de a 1000 hasta traerlos todos (evita el límite PostgREST)
    let allProductos: any[] = []
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('productos')
        .select('id, nombre, codigo_barras, precio_venta_sugerido')
        .eq('emprendimiento_id', emprendimientoId)
        .order('codigo_barras', { ascending: true })
        .range(from, from + PAGE - 1)

      if (error) {
        console.error('[inventario] Error getStockByEmprendimiento productos:', error)
        return []
      }
      if (!data || data.length === 0) break
      allProductos = allProductos.concat(data)
      if (data.length < PAGE) break
      from += PAGE
    }

    if (allProductos.length === 0) return []

    // Paginar stock de la vista
    let allStockRows: any[] = []
    from = 0
    while (true) {
      const { data, error } = await supabase
        .from('vista_stock_por_localizacion')
        .select('producto_id, stock_actual')
        .eq('emprendimiento_id', emprendimientoId)
        .range(from, from + PAGE - 1)

      if (error) {
        console.error('[inventario] Error getStockByEmprendimiento stock:', error)
        break
      }
      if (!data || data.length === 0) break
      allStockRows = allStockRows.concat(data)
      if (data.length < PAGE) break
      from += PAGE
    }

    const stockMap: Record<number, number> = {}
    for (const row of allStockRows) {
      stockMap[row.producto_id] = (stockMap[row.producto_id] ?? 0) + (row.stock_actual ?? 0)
    }

    return allProductos.map((p: any) => ({
      producto_id: p.id,
      nombre: p.nombre,
      codigo_barras: p.codigo_barras ?? '',
      precio_venta_sugerido: p.precio_venta_sugerido ?? 0,
      stock_total: stockMap[p.id] ?? 0,
    }))
  } catch (err) {
    console.error('[inventario] Excepcion getStockByEmprendimiento:', err)
    return []
  }
}
