"use client"

import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { getTenantStamp, isValidStamp } from "@/lib/services/tenant-stamp"

/**
 * Resumen de pagos del periodo, derivado de la tabla `ventas_pagos_detalle`
 * (migracion 011). Sirve como fuente unica para:
 *   - KPIs de Venta Bruta vs Venta Neta en el Dashboard
 *   - Total de Comisiones Pagadas
 *   - Pie chart "Ingresos por Metodo de Pago"
 *   - Gasto Financiero en el Estado de Resultados
 *
 * IMPORTANTE: todas las consultas se filtran por la razon_social_id de la
 * sesion (multi-tenant) y por el rango de fechas indicado.
 */
export interface PagosResumen {
  /** Suma de monto_bruto del periodo (lo que el cliente pago en total). */
  totalBruto: number
  /** Suma de monto_neto del periodo (lo que efectivamente entro al banco). */
  totalNeto: number
  /** totalBruto - totalNeto. Comisiones bancarias del periodo. */
  totalComisiones: number
  /**
   * Distribucion por metodo, ya etiquetada para visualizacion.
   * - Efectivo agrupa todos los pagos en cash.
   * - Para Banco/Link_Pago se usa el `banco` de cuentas_config (ej. "BAC",
   *   "Banpais"). Si no se pudo resolver, cae a "Banco" / "Link de Pago".
   */
  porMetodo: {
    label: string
    metodo_pago: string
    bruto: number
    neto: number
    comision: number
    count: number
  }[]
  /** True si la tabla ventas_pagos_detalle aun no existe (migracion pendiente). */
  featurePending?: boolean
}

/**
 * Construye el rango ISO inclusivo para un anio/mes opcional.
 * - Sin anio: undefined (sin filtro de fecha; "todos").
 * - Con anio sin mes: enero 1 -> diciembre 31 23:59:59.
 * - Con anio y mes: primer al ultimo dia del mes.
 */
function buildDateRange(anio?: number, mes?: number): { start?: string; end?: string } {
  if (!anio) return {}
  const m0 = mes ? mes - 1 : 0
  const m1 = mes ?? 12
  // El ultimo dia se obtiene con `new Date(year, m1, 0)` (dia 0 del mes
  // siguiente = ultimo del mes pedido).
  const start = new Date(anio, m0, 1).toISOString()
  const end = new Date(anio, m1, 0, 23, 59, 59).toISOString()
  return { start, end }
}

/**
 * Obtiene el resumen de pagos del periodo. Resiliente:
 *   - Si la tabla ventas_pagos_detalle no existe -> featurePending: true,
 *     totales en 0 y porMetodo vacio (UI degradada).
 *   - Si no hay sesion valida -> mismo objeto vacio (no rompe el dashboard).
 */
export async function getPagosResumen(
  anio?: number,
  mes?: number
): Promise<{ data: PagosResumen; error: string | null }> {
  const empty: PagosResumen = {
    totalBruto: 0,
    totalNeto: 0,
    totalComisiones: 0,
    porMetodo: [],
  }

  if (!isSupabaseConfigured()) return { data: empty, error: null }

  const supabase = createClient()
  if (!supabase) return { data: empty, error: null }

  const stamp = await getTenantStamp(supabase)
  if (!isValidStamp(stamp)) return { data: empty, error: null }

  const { start, end } = buildDateRange(anio, mes)

  try {
    // Estrategia: filtrar primero los venta_id del tenant (+ rango de fechas)
    // desde ventas_encabezado y luego leer ventas_pagos_detalle con .in().
    // Esto evita el problema de PostgREST donde los filtros sobre tablas
    // relacionadas con !inner no siempre se aplican correctamente desde el
    // cliente JS de Supabase.

    // 1) Obtener los IDs de ventas del tenant en el periodo.
    let encabQ = supabase
      .from("ventas_encabezado")
      .select("id")
      .eq("razon_social_id", stamp.razon_social_id!)

    if (start && end) {
      encabQ = encabQ.gte("fecha_venta", start).lte("fecha_venta", end)
    }

    const { data: encabData, error: encabErr } = await encabQ

    if (encabErr) {
      return { data: empty, error: encabErr.message }
    }

    const ventaIds = (encabData || []).map((r: { id: number }) => r.id)

    // Sin ventas en el periodo: devolver totales en cero (es un resultado
    // valido — puede que los filtros de fecha no tengan ventas).
    if (ventaIds.length === 0) {
      return { data: { ...empty }, error: null }
    }

    // 2) Leer los pagos de esas ventas.
    const { data, error } = await supabase
      .from("ventas_pagos_detalle")
      .select(`
        metodo_pago,
        monto_bruto,
        monto_neto,
        cuentas_config(nombre)
      `)
      .in("venta_id", ventaIds)

    if (error) {
      if (/does not exist|ventas_pagos_detalle/i.test(error.message)) {
        return { data: { ...empty, featurePending: true }, error: null }
      }
      return { data: empty, error: error.message }
    }

    let totalBruto = 0
    let totalNeto = 0
    const acc = new Map<
      string,
      { metodo_pago: string; bruto: number; neto: number; count: number }
    >()

    type Row = {
      metodo_pago: string
      monto_bruto: number | null
      monto_neto: number | null
      // La columna real en `cuentas_config` es `nombre` (no `banco`).
      cuentas_config?: { nombre?: string } | null
    }

    for (const raw of (data || []) as Row[]) {
      const metodo = raw.metodo_pago
      const banco = raw.cuentas_config?.nombre
      const bruto = Number(raw.monto_bruto) || 0
      const neto = Number(raw.monto_neto) || 0

      // Etiqueta amigable: el cliente del Pie chart distingue bancos reales.
      let label: string
      if (metodo === "Efectivo") label = "Efectivo"
      else if (metodo === "Link_Pago") label = banco ? `${banco} (Link)` : "Link de Pago"
      else if (metodo === "Banco") label = banco || "Banco"
      else if (metodo === "Credito") label = "Credito"
      else label = "Otro"

      totalBruto += bruto
      totalNeto += neto

      const cur = acc.get(label) || { metodo_pago: metodo, bruto: 0, neto: 0, count: 0 }
      cur.bruto += bruto
      cur.neto += neto
      cur.count += 1
      acc.set(label, cur)
    }

    const porMetodo = Array.from(acc.entries())
      .map(([label, v]) => ({
        label,
        metodo_pago: v.metodo_pago,
        bruto: +v.bruto.toFixed(2),
        neto: +v.neto.toFixed(2),
        comision: +(v.bruto - v.neto).toFixed(2),
        count: v.count,
      }))
      .sort((a, b) => b.bruto - a.bruto)

    return {
      data: {
        totalBruto: +totalBruto.toFixed(2),
        totalNeto: +totalNeto.toFixed(2),
        totalComisiones: +(totalBruto - totalNeto).toFixed(2),
        porMetodo,
      },
      error: null,
    }
  } catch (err) {
    console.error("[getPagosResumen] error:", err)
    return { data: empty, error: "Error de conexion" }
  }
}

/**
 * Solo el total de comisiones del periodo. Atajo para el Estado de Resultados
 * cuando no se necesita el detalle por metodo. Filtra por razon_social_id.
 */
export async function getComisionesPeriodo(
  anio: number,
  mes?: number
): Promise<{ data: number; error: string | null; featurePending?: boolean }> {
  const { data, error } = await getPagosResumen(anio, mes)
  return {
    data: data?.totalComisiones ?? 0,
    error,
    featurePending: data?.featurePending,
  }
}

/**
 * Devuelve un Map<venta_id, etiqueta> con la categorizacion del metodo
 * agregado de cada venta:
 *   "Efectivo"  -> todas las lineas son efectivo
 *   "Banco"     -> todas las lineas son Banco o Link_Pago
 *   "Mixto"     -> al menos una de efectivo y una de banco
 *   "Credito"   -> solo lineas Credito (saldo CXC)
 *   "Otro"      -> solo lineas Otro
 *
 * Ventas sin filas en ventas_pagos_detalle no aparecen en el Map (tipicamente
 * son ventas a credito puro o creadas antes de la migracion 011).
 */
export async function getMetodosPagoPorVenta(
  ventaIds: number[]
): Promise<{ data: Map<number, string>; error: string | null }> {
  const empty = new Map<number, string>()
  if (ventaIds.length === 0) return { data: empty, error: null }

  if (!isSupabaseConfigured()) return { data: empty, error: null }
  const supabase = createClient()
  if (!supabase) return { data: empty, error: null }

  try {
    const { data, error } = await supabase
      .from("ventas_pagos_detalle")
      .select("venta_id, metodo_pago")
      .in("venta_id", ventaIds)

    if (error) {
      // Tabla pendiente: regresa map vacio para que la UI muestre fallback.
      if (/does not exist|ventas_pagos_detalle/i.test(error.message)) {
        return { data: empty, error: null }
      }
      return { data: empty, error: error.message }
    }

    type Row = { venta_id: number; metodo_pago: string }
    const sets = new Map<number, Set<string>>()
    for (const r of (data || []) as Row[]) {
      const s = sets.get(r.venta_id) || new Set<string>()
      s.add(r.metodo_pago)
      sets.set(r.venta_id, s)
    }

    const out = new Map<number, string>()
    for (const [id, set] of sets) {
      const tieneEfectivo = set.has("Efectivo")
      const tieneBanco = set.has("Banco") || set.has("Link_Pago")
      const tieneCredito = set.has("Credito")
      const tieneOtro = set.has("Otro")

      if (tieneEfectivo && tieneBanco) out.set(id, "Mixto")
      else if (tieneEfectivo) out.set(id, "Efectivo")
      else if (tieneBanco) out.set(id, "Banco")
      else if (tieneCredito) out.set(id, "Credito")
      else if (tieneOtro) out.set(id, "Otro")
    }

    return { data: out, error: null }
  } catch (err) {
    console.error("[getMetodosPagoPorVenta] error:", err)
    return { data: empty, error: "Error de conexion" }
  }
}
