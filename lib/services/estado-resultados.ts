"use client"

import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { getTenantStamp } from "@/lib/services/tenant-stamp"
import { getComisionesPeriodo } from "@/lib/services/ventas-analytics"
import { getTotalAlquilerPagado } from "@/lib/services/pagos-alquiler"

// ==================== TIPOS ====================

export interface EstadoResultadosMensual {
  anio: number
  mes: number
  mes_nombre: string
  ventas_totales: number        // = ingresos por alquiler en modelo concept store
  costo_mercancia_vendida: number  // = 0 (concept store no tiene CMV propio)
  utilidad_bruta: number
  gastos_servicios: number
  gastos_publicidad: number
  gastos_nomina: number
  gastos_arriendo: number
  gastos_mantenimiento: number
  gastos_impuestos: number
  gastos_suministros: number
  gastos_otros: number
  total_gastos_operativos: number
  comisiones_bancarias: number
  utilidad_neta: number
  margen_bruto: number
  margen_neto: number
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

// ==================== ESTADO DE RESULTADOS ====================

export async function getEstadoResultadosMensual(anio: number, mes: number): Promise<{ data: EstadoResultadosMensual | null; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return getEstadoResultadosLocal(anio, mes)
  }

  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Cliente no disponible' }

  // Obtener tenantId una sola vez para usarlo en ambos caminos
  const stamp = await getTenantStamp(supabase)
  const tenantId = stamp.razon_social_id

  try {
    // Intentar obtener gastos desde la vista (mantiene gastos operativos históricos)
    const { data, error } = await supabase
      .from('vista_estado_resultados_mensual')
      .select('*')
      .eq('anio', anio)
      .eq('mes', mes)
      .single()

    if (error) {
      return getEstadoResultadosCalculado(supabase, tenantId, anio, mes)
    }

    // Ingresos = alquiler pagado (no ventas de productos)
    const alquilerMes = tenantId != null ? await getTotalAlquilerPagado(tenantId, anio, mes) : 0
    const { data: comisiones } = await getComisionesPeriodo(anio, mes)

    // Gastos operativos desde la vista (se mantienen igual)
    const totalGastos = data.total_gastos_operativos || 0
    const utilidadNeta = alquilerMes - totalGastos - comisiones

    const enriched: EstadoResultadosMensual = {
      ...data,
      ventas_totales: alquilerMes,
      costo_mercancia_vendida: 0,
      utilidad_bruta: alquilerMes,
      comisiones_bancarias: comisiones,
      utilidad_neta: utilidadNeta,
      margen_bruto: alquilerMes > 0 ? 100 : 0,
      margen_neto: alquilerMes > 0 ? (utilidadNeta / alquilerMes) * 100 : 0,
    }
    return { data: enriched, error: null }
  } catch {
    return getEstadoResultadosCalculado(supabase, tenantId, anio, mes)
  }
}

export async function getEstadoResultadosAnual(anio: number): Promise<{ data: EstadoResultadosMensual[]; error: string | null }> {
  if (!isSupabaseConfigured()) {
    const resultados: EstadoResultadosMensual[] = []
    for (let mes = 1; mes <= 12; mes++) {
      const { data } = await getEstadoResultadosLocal(anio, mes)
      if (data) resultados.push(data)
    }
    return { data: resultados, error: null }
  }

  const supabase = createClient()
  if (!supabase) return { data: [], error: 'Cliente no disponible' }

  const stamp = await getTenantStamp(supabase)
  const tenantId = stamp.razon_social_id

  try {
    const { data, error } = await supabase
      .from('vista_estado_resultados_mensual')
      .select('*')
      .eq('anio', anio)
      .order('mes', { ascending: true })

    if (error) {
      const resultados: EstadoResultadosMensual[] = []
      for (let mes = 1; mes <= 12; mes++) {
        const { data: mesData } = await getEstadoResultadosCalculado(supabase, tenantId, anio, mes)
        if (mesData) resultados.push(mesData)
      }
      return { data: resultados, error: null }
    }

    // Enriquecer cada mes con ingresos de alquiler y comisiones
    const enriched = await Promise.all(
      (data || []).map(async (m) => {
        const alquilerMes = tenantId != null ? await getTotalAlquilerPagado(tenantId, anio, m.mes) : 0
        const { data: comisiones } = await getComisionesPeriodo(anio, m.mes)
        const totalGastos = m.total_gastos_operativos || 0
        const utilidadNeta = alquilerMes - totalGastos - comisiones
        return {
          ...m,
          ventas_totales: alquilerMes,
          costo_mercancia_vendida: 0,
          utilidad_bruta: alquilerMes,
          comisiones_bancarias: comisiones,
          utilidad_neta: utilidadNeta,
          margen_bruto: alquilerMes > 0 ? 100 : 0,
          margen_neto: alquilerMes > 0 ? (utilidadNeta / alquilerMes) * 100 : 0,
        } as EstadoResultadosMensual
      })
    )

    return { data: enriched, error: null }
  } catch {
    return { data: [], error: 'Error de conexion' }
  }
}

// ==================== HELPERS ====================

async function getEstadoResultadosLocal(anio: number, mes: number): Promise<{ data: EstadoResultadosMensual | null; error: string | null }> {
  // Ingresos: pagos de alquiler registrados en localStorage
  const savedPagos = localStorage.getItem('pagos_alquiler_emprendimientos')
  const pagosAlquiler: { anio: number; mes: number; estado: string; monto: number }[] = savedPagos ? JSON.parse(savedPagos) : []
  const ventasTotales = pagosAlquiler
    .filter((p) => p.anio === anio && p.mes === mes && p.estado === 'pagado')
    .reduce((acc, p) => acc + (p.monto || 0), 0)

  // Gastos: siguen leyéndose desde localStorage
  const savedGastos = localStorage.getItem('gastos')
  const savedConceptos = localStorage.getItem('conceptos_gastos')
  const gastos: { fecha_gasto: string; monto: number; concepto_id: number }[] = savedGastos ? JSON.parse(savedGastos) : []
  const conceptos: { id: number; categoria_macro: string }[] = savedConceptos ? JSON.parse(savedConceptos) : []

  const gastosMes = gastos.filter(g => {
    const fecha = new Date(g.fecha_gasto)
    return fecha.getFullYear() === anio && fecha.getMonth() + 1 === mes
  })

  const gastosPorCategoria: Record<string, number> = {
    'Servicios': 0, 'Publicidad': 0, 'Nomina': 0, 'Arriendo': 0,
    'Mantenimiento': 0, 'Impuestos': 0, 'Suministros': 0, 'Otros': 0
  }
  gastosMes.forEach(g => {
    const concepto = conceptos.find(c => c.id === g.concepto_id)
    const cat = concepto?.categoria_macro || 'Otros'
    gastosPorCategoria[cat] = (gastosPorCategoria[cat] || 0) + g.monto
  })

  const totalGastosOperativos = Object.values(gastosPorCategoria).reduce((a, b) => a + b, 0)
  const utilidadNeta = ventasTotales - totalGastosOperativos

  const resultado: EstadoResultadosMensual = {
    anio,
    mes,
    mes_nombre: MESES[mes - 1],
    ventas_totales: ventasTotales,
    costo_mercancia_vendida: 0,
    utilidad_bruta: ventasTotales,
    gastos_servicios: gastosPorCategoria['Servicios'],
    gastos_publicidad: gastosPorCategoria['Publicidad'],
    gastos_nomina: gastosPorCategoria['Nomina'],
    gastos_arriendo: gastosPorCategoria['Arriendo'],
    gastos_mantenimiento: gastosPorCategoria['Mantenimiento'],
    gastos_impuestos: gastosPorCategoria['Impuestos'],
    gastos_suministros: gastosPorCategoria['Suministros'],
    gastos_otros: gastosPorCategoria['Otros'],
    total_gastos_operativos: totalGastosOperativos,
    comisiones_bancarias: 0,
    utilidad_neta: utilidadNeta,
    margen_bruto: ventasTotales > 0 ? 100 : 0,
    margen_neto: ventasTotales > 0 ? (utilidadNeta / ventasTotales) * 100 : 0
  }

  return { data: resultado, error: null }
}

async function getEstadoResultadosCalculado(
  supabase: ReturnType<typeof createClient>,
  tenantId: number | null,
  anio: number,
  mes: number
): Promise<{ data: EstadoResultadosMensual | null; error: string | null }> {
  if (!supabase) return { data: null, error: 'Cliente no disponible' }

  const primerDia = `${anio}-${String(mes).padStart(2, '0')}-01`
  const ultimoDia = new Date(anio, mes, 0).toISOString().split('T')[0]

  try {
    // Ingresos = alquiler pagado (no ventas de productos)
    const ventasTotales = tenantId != null ? await getTotalAlquilerPagado(tenantId, anio, mes) : 0

    // Gastos operativos del mes
    let gastosQuery = supabase
      .from('gastos')
      .select(`monto, conceptos_gastos (categoria_macro)`)
      .gte('fecha_gasto', primerDia)
      .lte('fecha_gasto', ultimoDia)
    if (tenantId != null) gastosQuery = gastosQuery.eq('razon_social_id', tenantId)
    const { data: gastosData } = await gastosQuery

    const gastosPorCategoria: Record<string, number> = {
      'Servicios': 0, 'Publicidad': 0, 'Nomina': 0, 'Arriendo': 0,
      'Mantenimiento': 0, 'Impuestos': 0, 'Suministros': 0, 'Otros': 0
    }
    ;(gastosData || []).forEach(g => {
      const cat = (g.conceptos_gastos as unknown as { categoria_macro: string } | null)?.categoria_macro || 'Otros'
      gastosPorCategoria[cat] = (gastosPorCategoria[cat] || 0) + (g.monto || 0)
    })

    const totalGastosOperativos = Object.values(gastosPorCategoria).reduce((a, b) => a + b, 0)
    const { data: comisionesBancarias } = await getComisionesPeriodo(anio, mes)
    const utilidadNeta = ventasTotales - totalGastosOperativos - comisionesBancarias

    const resultado: EstadoResultadosMensual = {
      anio,
      mes,
      mes_nombre: MESES[mes - 1],
      ventas_totales: ventasTotales,
      costo_mercancia_vendida: 0,
      utilidad_bruta: ventasTotales,
      gastos_servicios: gastosPorCategoria['Servicios'],
      gastos_publicidad: gastosPorCategoria['Publicidad'],
      gastos_nomina: gastosPorCategoria['Nomina'],
      gastos_arriendo: gastosPorCategoria['Arriendo'],
      gastos_mantenimiento: gastosPorCategoria['Mantenimiento'],
      gastos_impuestos: gastosPorCategoria['Impuestos'],
      gastos_suministros: gastosPorCategoria['Suministros'],
      gastos_otros: gastosPorCategoria['Otros'],
      total_gastos_operativos: totalGastosOperativos,
      comisiones_bancarias: comisionesBancarias,
      utilidad_neta: utilidadNeta,
      margen_bruto: ventasTotales > 0 ? 100 : 0,
      margen_neto: ventasTotales > 0 ? (utilidadNeta / ventasTotales) * 100 : 0
    }

    return { data: resultado, error: null }
  } catch {
    return { data: null, error: 'Error calculando estado de resultados' }
  }
}

// ==================== ACUMULADO ANUAL ====================

export async function getEstadoResultadosAcumulado(anio: number): Promise<{ data: EstadoResultadosMensual | null; error: string | null }> {
  const { data: mensual, error } = await getEstadoResultadosAnual(anio)

  if (error || !mensual || mensual.length === 0) {
    return { data: null, error: error || 'Sin datos' }
  }

  const acumulado: EstadoResultadosMensual = {
    anio,
    mes: 0,
    mes_nombre: `Acumulado ${anio}`,
    ventas_totales: mensual.reduce((acc, m) => acc + m.ventas_totales, 0),
    costo_mercancia_vendida: 0,
    utilidad_bruta: mensual.reduce((acc, m) => acc + m.utilidad_bruta, 0),
    gastos_servicios: mensual.reduce((acc, m) => acc + m.gastos_servicios, 0),
    gastos_publicidad: mensual.reduce((acc, m) => acc + m.gastos_publicidad, 0),
    gastos_nomina: mensual.reduce((acc, m) => acc + m.gastos_nomina, 0),
    gastos_arriendo: mensual.reduce((acc, m) => acc + m.gastos_arriendo, 0),
    gastos_mantenimiento: mensual.reduce((acc, m) => acc + m.gastos_mantenimiento, 0),
    gastos_impuestos: mensual.reduce((acc, m) => acc + m.gastos_impuestos, 0),
    gastos_suministros: mensual.reduce((acc, m) => acc + m.gastos_suministros, 0),
    gastos_otros: mensual.reduce((acc, m) => acc + m.gastos_otros, 0),
    total_gastos_operativos: mensual.reduce((acc, m) => acc + m.total_gastos_operativos, 0),
    comisiones_bancarias: mensual.reduce((acc, m) => acc + (m.comisiones_bancarias || 0), 0),
    utilidad_neta: mensual.reduce((acc, m) => acc + m.utilidad_neta, 0),
    margen_bruto: 0,
    margen_neto: 0
  }

  if (acumulado.ventas_totales > 0) {
    acumulado.margen_bruto = (acumulado.utilidad_bruta / acumulado.ventas_totales) * 100
    acumulado.margen_neto = (acumulado.utilidad_neta / acumulado.ventas_totales) * 100
  }

  return { data: acumulado, error: null }
}
