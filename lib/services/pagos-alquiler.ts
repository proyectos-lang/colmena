"use server"

import { createClient } from "@/lib/supabase/client"
import { createAdminClient } from "@/lib/supabase/admin"
import { getHondurasNowISO } from "@/lib/utils/honduras-time"

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

export interface PagoAlquiler {
  id?: number
  emprendimiento_id: number
  razon_social_id?: number
  anio: number
  mes: number
  monto: number
  fecha_pago?: string | null
  estado: "pendiente" | "pagado"
  notas?: string | null
  usuario?: string
  created_at?: string
  updated_at?: string
  // Joined fields
  emprendimiento_nombre?: string
  valor_alquiler_esperado?: number
}


// Pagos de TODOS los emprendimientos para un mes/año dado (vista de admin)
export async function getPagosAlquilerDelMes(
  razonSocialId: number,
  anio: number,
  mes: number
): Promise<PagoAlquiler[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("pagos_alquiler_emprendimientos")
    .select(`
      *,
      emprendimientos (
        nombre,
        valor_alquiler_mensual
      )
    `)
    .eq("razon_social_id", razonSocialId)
    .eq("anio", anio)
    .eq("mes", mes)
    .order("emprendimiento_id", { ascending: true })

  if (error) {
    console.error("[pagos-alquiler] Error getPagosDelMes:", error)
    return []
  }

  return (data ?? []).map((r) => ({
    ...r,
    emprendimiento_nombre: (r.emprendimientos as { nombre: string } | null)?.nombre ?? "",
    valor_alquiler_esperado: (r.emprendimientos as { valor_alquiler_mensual: number } | null)?.valor_alquiler_mensual ?? 0,
    emprendimientos: undefined,
  }))
}

// Todos los registros (12 meses) para un emprendimiento en un año
export async function getPagosAlquilerByEmprendimiento(
  emprendimientoId: number,
  anio: number
): Promise<PagoAlquiler[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("pagos_alquiler_emprendimientos")
    .select("*")
    .eq("emprendimiento_id", emprendimientoId)
    .eq("anio", anio)
    .order("mes", { ascending: true })

  if (error) {
    console.error("[pagos-alquiler] Error getPagosEmprendimiento:", error)
    return []
  }

  return data ?? []
}

// Registrar (marcar como pagado) un mes existente
export async function registrarPagoAlquiler(
  id: number,
  monto: number,
  fechaPago: string,
  notas: string,
  usuario: string
): Promise<{ error: string | null }> {
  const supabase = createAdminClient()
  if (!supabase) return { error: "Cliente admin no disponible" }

  const { error } = await supabase
    .from("pagos_alquiler_emprendimientos")
    .update({
      monto,
      fecha_pago: fechaPago,
      notas: notas || null,
      estado: "pagado",
      usuario,
      updated_at: getHondurasNowISO(),
    })
    .eq("id", id)

  if (error) {
    console.error("[pagos-alquiler] Error registrar:", error)
    return { error: error.message }
  }
  return { error: null }
}

// Revertir un pago a pendiente
export async function revertirPagoAlquiler(
  id: number,
  usuario: string
): Promise<{ error: string | null }> {
  const supabase = createAdminClient()
  if (!supabase) return { error: "Cliente admin no disponible" }

  const { error } = await supabase
    .from("pagos_alquiler_emprendimientos")
    .update({
      fecha_pago: null,
      notas: null,
      estado: "pendiente",
      usuario,
      updated_at: getHondurasNowISO(),
    })
    .eq("id", id)

  if (error) return { error: error.message }
  return { error: null }
}

// Generar registros 'pendiente' para todos los emprendimientos activos de un mes
// Si ya existe el registro para ese emprendimiento/mes, lo ignora (UNIQUE constraint)
export async function generarRegistrosMensuales(
  razonSocialId: number,
  anio: number,
  mes: number,
  usuario: string
): Promise<{ insertados: number; error: string | null }> {
  const supabase = createAdminClient()
  if (!supabase) return { insertados: 0, error: "Cliente admin no disponible" }

  // Obtener todos los emprendimientos activos con su valor de alquiler
  const { data: emprendimientos, error: empError } = await supabase
    .from("emprendimientos")
    .select("id, valor_alquiler_mensual")
    .eq("razon_social_id", razonSocialId)
    .eq("activo", true)

  if (empError || !emprendimientos?.length) {
    return { insertados: 0, error: empError?.message ?? "Sin emprendimientos activos" }
  }

  const rows = emprendimientos.map((e) => ({
    emprendimiento_id: e.id,
    razon_social_id: razonSocialId,
    anio,
    mes,
    monto: e.valor_alquiler_mensual ?? 0,
    estado: "pendiente",
    usuario,
  }))

  // upsert con onConflict ignora duplicados
  const { data, error } = await supabase
    .from("pagos_alquiler_emprendimientos")
    .upsert(rows, { onConflict: "emprendimiento_id,anio,mes", ignoreDuplicates: true })
    .select("id")

  if (error) {
    console.error("[pagos-alquiler] Error generar registros:", error)
    return { insertados: 0, error: error.message }
  }

  return { insertados: data?.length ?? 0, error: null }
}

// Suma total de alquiler pagado en un mes (para estado de resultados)
export async function getTotalAlquilerPagado(
  razonSocialId: number,
  anio: number,
  mes: number
): Promise<number> {
  const supabase = createClient()
  if (!supabase) return 0

  const { data, error } = await supabase
    .from("pagos_alquiler_emprendimientos")
    .select("monto")
    .eq("razon_social_id", razonSocialId)
    .eq("anio", anio)
    .eq("mes", mes)
    .eq("estado", "pagado")

  if (error) {
    console.error("[pagos-alquiler] Error getTotalPagado:", error)
    return 0
  }

  return (data ?? []).reduce((acc, r) => acc + (r.monto ?? 0), 0)
}

// Resumen de pagos del año para todos los emprendimientos (dashboard admin)
export async function getResumenAlquilerAnual(
  razonSocialId: number,
  anio: number
): Promise<{ mes: number; mes_nombre: string; total_pagado: number; total_esperado: number; pendientes: number }[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("pagos_alquiler_emprendimientos")
    .select(`
      mes,
      monto,
      estado,
      emprendimientos (valor_alquiler_mensual)
    `)
    .eq("razon_social_id", razonSocialId)
    .eq("anio", anio)

  if (error) return []

  const porMes: Record<number, { total_pagado: number; total_esperado: number; pendientes: number }> = {}

  for (let m = 1; m <= 12; m++) {
    porMes[m] = { total_pagado: 0, total_esperado: 0, pendientes: 0 }
  }

  for (const r of data ?? []) {
    const m = r.mes as number
    if (!porMes[m]) continue
    const esperado = (r.emprendimientos as unknown as { valor_alquiler_mensual: number } | null)?.valor_alquiler_mensual ?? 0
    porMes[m].total_esperado += esperado
    if (r.estado === "pagado") {
      porMes[m].total_pagado += r.monto ?? 0
    } else {
      porMes[m].pendientes += 1
    }
  }

  return Object.entries(porMes).map(([mes, v]) => ({
    mes: Number(mes),
    mes_nombre: MESES[Number(mes) - 1],
    ...v,
  }))
}

