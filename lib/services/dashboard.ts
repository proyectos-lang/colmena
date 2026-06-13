import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'

// ==================== INTERFACES ====================

export interface DashboardMetrics {
  valorInventario: number
  cuentasPorCobrar: number
  utilidadBruta: number
  ventasMes: number
  ventasMesCount: number
}

export interface VentasVsCobros {
  fecha: string
  ventas: number
  cobros: number
}

export interface TopProducto {
  producto_id: number
  producto_nombre: string
  cantidad_vendida: number
}

export interface ProductoStockBajo {
  id: number
  nombre: string
  codigo_barras: string
  stock_total: number
}

export interface CompraPendiente {
  id: number
  proveedor_nombre: string
  fecha_tentativa: string
  total_compra_local: number
  estado: string
}

export interface ClienteDeudor {
  cliente_id: number
  cliente_nombre: string
  total_deuda: number
  facturas_pendientes: number
}

const DEFAULT_METRICS: DashboardMetrics = {
  valorInventario: 0,
  cuentasPorCobrar: 0,
  utilidadBruta: 0,
  ventasMes: 0,
  ventasMesCount: 0,
}

// ==================== DASHBOARD DATA ====================

export async function getDashboardMetrics(
  razonSocialId: number | null
): Promise<{ data: DashboardMetrics; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { data: DEFAULT_METRICS, error: null }
  }

  const supabase = createClient()
  if (!supabase) return { data: DEFAULT_METRICS, error: 'Cliente no disponible' }

  if (razonSocialId == null) {
    console.log('[v0][Dashboard] getDashboardMetrics: razonSocialId es null, devolviendo ceros')
    return { data: DEFAULT_METRICS, error: null }
  }

  try {
    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const [productosRes, ventasRes, pagosRes, detallesRes, ventasMesRes] = await Promise.all([
      supabase
        .from('productos')
        .select('stock_total, costo_promedio')
        .eq('razon_social_id', razonSocialId),
      supabase
        .from('ventas_encabezado')
        .select('total_venta')
        .eq('razon_social_id', razonSocialId),
      supabase
        .from('pagos_ventas')
        .select('monto, ventas_encabezado!inner(razon_social_id)')
        .eq('ventas_encabezado.razon_social_id', razonSocialId),
      supabase
        .from('ventas_detalle')
        .select('utilidad_linea, ventas_encabezado!inner(razon_social_id)')
        .eq('ventas_encabezado.razon_social_id', razonSocialId),
      supabase
        .from('ventas_encabezado')
        .select('total_venta')
        .eq('razon_social_id', razonSocialId)
        .gte('fecha_venta', firstDayOfMonth),
    ])

    // Log errores de cada consulta para debug
    if (productosRes.error) console.log('[v0][Dashboard] productos error:', productosRes.error)
    if (ventasRes.error) console.log('[v0][Dashboard] ventas error:', ventasRes.error)
    if (pagosRes.error) console.log('[v0][Dashboard] pagos error:', pagosRes.error)
    if (detallesRes.error) console.log('[v0][Dashboard] detalles error:', detallesRes.error)
    if (ventasMesRes.error) console.log('[v0][Dashboard] ventasMes error:', ventasMesRes.error)

    const valorInventario = (productosRes.data || []).reduce(
      (acc, p: any) => acc + ((p.stock_total || 0) * (p.costo_promedio || 0)),
      0
    )

    const totalVentas = (ventasRes.data || []).reduce((acc, v: any) => acc + (v.total_venta || 0), 0)
    const totalPagos = (pagosRes.data || []).reduce((acc, p: any) => acc + (p.monto || 0), 0)
    const cuentasPorCobrar = Math.max(0, totalVentas - totalPagos)

    const utilidadBruta = (detallesRes.data || []).reduce(
      (acc, d: any) => acc + (d.utilidad_linea || 0),
      0
    )

    const ventasMes = (ventasMesRes.data || []).reduce(
      (acc, v: any) => acc + (v.total_venta || 0),
      0
    )
    const ventasMesCount = (ventasMesRes.data || []).length

    return {
      data: { valorInventario, cuentasPorCobrar, utilidadBruta, ventasMes, ventasMesCount },
      error: null,
    }
  } catch (err: any) {
    console.log('[v0][Dashboard] Excepcion en getDashboardMetrics:', err)
    return { data: DEFAULT_METRICS, error: err?.message || 'Error de conexion' }
  }
}

export async function getVentasVsCobros(
  razonSocialId: number | null,
  dias: number = 7
): Promise<{ data: VentasVsCobros[]; error: string | null }> {
  const result: VentasVsCobros[] = []
  for (let i = dias - 1; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    result.push({ fecha: date.toISOString().split('T')[0], ventas: 0, cobros: 0 })
  }

  if (!isSupabaseConfigured()) return { data: result, error: null }

  const supabase = createClient()
  if (!supabase) return { data: result, error: 'Cliente no disponible' }
  if (razonSocialId == null) return { data: result, error: null }

  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - dias + 1)
    startDate.setHours(0, 0, 0, 0)

    const [ventasRes, pagosRes] = await Promise.all([
      supabase
        .from('ventas_encabezado')
        .select('total_venta, fecha_venta')
        .eq('razon_social_id', razonSocialId)
        .gte('fecha_venta', startDate.toISOString()),
      supabase
        .from('pagos_ventas')
        .select('monto, fecha_pago, ventas_encabezado!inner(razon_social_id)')
        .eq('ventas_encabezado.razon_social_id', razonSocialId)
        .gte('fecha_pago', startDate.toISOString()),
    ])

    if (ventasRes.error) console.log('[v0][Dashboard] ventasVsCobros ventas error:', ventasRes.error)
    if (pagosRes.error) console.log('[v0][Dashboard] ventasVsCobros pagos error:', pagosRes.error)

    ;(ventasRes.data || []).forEach((v: any) => {
      if (!v.fecha_venta) return
      const fecha = v.fecha_venta.split('T')[0]
      const item = result.find(r => r.fecha === fecha)
      if (item) item.ventas += v.total_venta || 0
    })

    ;(pagosRes.data || []).forEach((p: any) => {
      if (!p.fecha_pago) return
      const fecha = p.fecha_pago.split('T')[0]
      const item = result.find(r => r.fecha === fecha)
      if (item) item.cobros += p.monto || 0
    })

    return { data: result, error: null }
  } catch (err: any) {
    console.log('[v0][Dashboard] Excepcion en getVentasVsCobros:', err)
    return { data: result, error: err?.message || 'Error de conexion' }
  }
}

export async function getTopProductos(
  razonSocialId: number | null,
  limit: number = 5
): Promise<{ data: TopProducto[]; error: string | null }> {
  if (!isSupabaseConfigured()) return { data: [], error: null }

  const supabase = createClient()
  if (!supabase) return { data: [], error: 'Cliente no disponible' }
  if (razonSocialId == null) return { data: [], error: null }

  try {
    const { data, error } = await supabase
      .from('ventas_detalle')
      .select('producto_id, cantidad, productos(nombre), ventas_encabezado!inner(razon_social_id)')
      .eq('ventas_encabezado.razon_social_id', razonSocialId)

    if (error) {
      console.log('[v0][Dashboard] getTopProductos error:', error)
      return { data: [], error: error.message }
    }

    const aggregated: Record<number, { nombre: string; cantidad: number }> = {}
    ;(data || []).forEach((d: any) => {
      if (!aggregated[d.producto_id]) {
        aggregated[d.producto_id] = {
          nombre: d.productos?.nombre || 'Desconocido',
          cantidad: 0,
        }
      }
      aggregated[d.producto_id].cantidad += d.cantidad || 0
    })

    const sorted = Object.entries(aggregated)
      .map(([id, info]) => ({
        producto_id: parseInt(id),
        producto_nombre: info.nombre,
        cantidad_vendida: info.cantidad,
      }))
      .sort((a, b) => b.cantidad_vendida - a.cantidad_vendida)
      .slice(0, limit)

    return { data: sorted, error: null }
  } catch (err: any) {
    console.log('[v0][Dashboard] Excepcion en getTopProductos:', err)
    return { data: [], error: err?.message || 'Error de conexion' }
  }
}

export async function getProductosStockBajo(
  razonSocialId: number | null,
  umbral: number = 5
): Promise<{ data: ProductoStockBajo[]; error: string | null }> {
  if (!isSupabaseConfigured()) return { data: [], error: null }

  const supabase = createClient()
  if (!supabase) return { data: [], error: 'Cliente no disponible' }
  if (razonSocialId == null) return { data: [], error: null }

  try {
    const { data, error } = await supabase
      .from('productos')
      .select('id, nombre, codigo_barras, stock_total')
      .eq('razon_social_id', razonSocialId)
      .lt('stock_total', umbral)
      .order('stock_total', { ascending: true })

    if (error) {
      console.log('[v0][Dashboard] getProductosStockBajo error:', error)
      return { data: [], error: error.message }
    }
    return { data: data || [], error: null }
  } catch (err: any) {
    console.log('[v0][Dashboard] Excepcion en getProductosStockBajo:', err)
    return { data: [], error: err?.message || 'Error de conexion' }
  }
}

export async function getComprasPendientes(
  razonSocialId: number | null
): Promise<{ data: CompraPendiente[]; error: string | null }> {
  if (!isSupabaseConfigured()) return { data: [], error: null }

  const supabase = createClient()
  if (!supabase) return { data: [], error: 'Cliente no disponible' }
  if (razonSocialId == null) return { data: [], error: null }

  try {
    const { data, error } = await supabase
      .from('compras_encabezado')
      .select('id, fecha_tentativa, total_compra_local, estado, proveedores(nombre)')
      .eq('razon_social_id', razonSocialId)
      .eq('estado', 'Pendiente')
      .order('fecha_tentativa', { ascending: true })

    if (error) {
      console.log('[v0][Dashboard] getComprasPendientes error:', error)
      return { data: [], error: error.message }
    }

    const formatted: CompraPendiente[] = (data || []).map((c: any) => ({
      id: c.id,
      proveedor_nombre: c.proveedores?.nombre || 'Desconocido',
      fecha_tentativa: c.fecha_tentativa,
      total_compra_local: c.total_compra_local || 0,
      estado: c.estado,
    }))

    return { data: formatted, error: null }
  } catch (err: any) {
    console.log('[v0][Dashboard] Excepcion en getComprasPendientes:', err)
    return { data: [], error: err?.message || 'Error de conexion' }
  }
}

export async function getTopClientesDeudores(
  razonSocialId: number | null,
  limit: number = 5
): Promise<{ data: ClienteDeudor[]; error: string | null }> {
  if (!isSupabaseConfigured()) return { data: [], error: null }

  const supabase = createClient()
  if (!supabase) return { data: [], error: 'Cliente no disponible' }
  if (razonSocialId == null) return { data: [], error: null }

  try {
    const { data: ventasData, error: ventasError } = await supabase
      .from('ventas_encabezado')
      .select('id, cliente_id, total_venta, clientes(nombre)')
      .eq('razon_social_id', razonSocialId)
      .neq('estado_pago', 'Pagado')

    if (ventasError) {
      console.log('[v0][Dashboard] getTopClientesDeudores ventas error:', ventasError)
      return { data: [], error: ventasError.message }
    }

    const ventaIds = (ventasData || []).map((v: any) => v.id)
    let pagosMap: Record<number, number> = {}

    if (ventaIds.length > 0) {
      const { data: pagosData, error: pagosError } = await supabase
        .from('pagos_ventas')
        .select('venta_id, monto')
        .in('venta_id', ventaIds)

      if (pagosError) console.log('[v0][Dashboard] getTopClientesDeudores pagos error:', pagosError)

      pagosMap = (pagosData || []).reduce((acc: Record<number, number>, p: any) => {
        acc[p.venta_id] = (acc[p.venta_id] || 0) + p.monto
        return acc
      }, {})
    }

    const deudaCliente: Record<number, { nombre: string; deuda: number; facturas: number }> = {}

    ;(ventasData || []).forEach((v: any) => {
      const pagado = pagosMap[v.id] || 0
      const saldo = v.total_venta - pagado
      if (saldo > 0) {
        if (!deudaCliente[v.cliente_id]) {
          deudaCliente[v.cliente_id] = {
            nombre: v.clientes?.nombre || 'Desconocido',
            deuda: 0,
            facturas: 0,
          }
        }
        deudaCliente[v.cliente_id].deuda += saldo
        deudaCliente[v.cliente_id].facturas += 1
      }
    })

    const sorted = Object.entries(deudaCliente)
      .map(([id, info]) => ({
        cliente_id: parseInt(id),
        cliente_nombre: info.nombre,
        total_deuda: info.deuda,
        facturas_pendientes: info.facturas,
      }))
      .sort((a, b) => b.total_deuda - a.total_deuda)
      .slice(0, limit)

    return { data: sorted, error: null }
  } catch (err: any) {
    console.log('[v0][Dashboard] Excepcion en getTopClientesDeudores:', err)
    return { data: [], error: err?.message || 'Error de conexion' }
  }
}
