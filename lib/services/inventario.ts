import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { getTenantStamp, isValidStamp, SESION_INVALIDA_ERROR } from '@/lib/services/tenant-stamp'

// ==================== INTERFACES ====================

export interface TransaccionInventario {
  id?: number
  producto_id: number
  producto_nombre?: string
  producto_codigo?: string
  almacen_id: number
  almacen_nombre?: string
  localizacion_id: number
  localizacion_nombre?: string
  tipo_movimiento: 'Entrada Compra' | 'Salida Venta' | 'Traslado Entrada' | 'Traslado Salida' | 'Ajuste' | 'Ingreso Manual' | 'Salida Manual'
  cantidad: number
  costo_o_precio_unitario: number
  referencia_id?: number
  fecha?: string
}

export interface ProductoValoracion {
  id: number
  nombre: string
  codigo_barras: string
  stock_total: number
  costo_promedio: number
  valor_total: number
}

// ==================== KARDEX ====================

export async function getKardexByProducto(productoId: number): Promise<{ data: TransaccionInventario[]; error: string | null }> {
  if (!isSupabaseConfigured()) {
    const saved = localStorage.getItem('transacciones_inventario')
    const transacciones: TransaccionInventario[] = saved ? JSON.parse(saved) : []
    const filtradas = transacciones
      .filter(t => t.producto_id === productoId)
      .sort((a, b) => new Date(b.fecha || '').getTime() - new Date(a.fecha || '').getTime())
    return { data: filtradas, error: null }
  }

  const supabase = createClient()
  if (!supabase) return { data: [], error: 'Cliente no disponible' }

  try {
    const { data, error } = await supabase
      .from('transacciones_inventario')
      .select(`
        *,
        productos (nombre, codigo_barras),
        almacenes (nombre),
        localizaciones (nombre)
      `)
      .eq('producto_id', productoId)
      .order('fecha', { ascending: false })

    if (error) return { data: [], error: error.message }
    
    const formattedData = (data || []).map(t => ({
      ...t,
      producto_nombre: t.productos?.nombre || '',
      producto_codigo: t.productos?.codigo_barras || '',
      almacen_nombre: t.almacenes?.nombre || '',
      localizacion_nombre: t.localizaciones?.nombre || ''
    }))
    
    return { data: formattedData, error: null }
  } catch (err) {
    console.error('[Supabase] Error obteniendo kardex:', err)
    return { data: [], error: 'Error de conexion' }
  }
}

export async function getAllTransacciones(): Promise<{ data: TransaccionInventario[]; error: string | null }> {
  if (!isSupabaseConfigured()) {
    const saved = localStorage.getItem('transacciones_inventario')
    return { data: saved ? JSON.parse(saved) : [], error: null }
  }

  const supabase = createClient()
  if (!supabase) return { data: [], error: 'Cliente no disponible' }

  try {
    const { data, error } = await supabase
      .from('transacciones_inventario')
      .select(`
        *,
        productos (nombre, codigo_barras),
        almacenes (nombre),
        localizaciones (nombre)
      `)
      .order('fecha', { ascending: false })
      .limit(500)

    if (error) return { data: [], error: error.message }
    
    const formattedData = (data || []).map(t => ({
      ...t,
      producto_nombre: t.productos?.nombre || '',
      producto_codigo: t.productos?.codigo_barras || '',
      almacen_nombre: t.almacenes?.nombre || '',
      localizacion_nombre: t.localizaciones?.nombre || ''
    }))
    
    return { data: formattedData, error: null }
  } catch (err) {
    console.error('[Supabase] Error obteniendo transacciones:', err)
    return { data: [], error: 'Error de conexion' }
  }
}

// ==================== VALORACION ====================

export interface ProductoValoracionExtendida {
  id: number
  nombre: string
  codigo_barras: string
  stock_total: number
  costo_promedio: number
  precio_venta: number
  valor_costo: number
  valor_comercial: number
  margen_potencial: number
  dias_sin_venta: number | null
  ultima_venta: string | null
  emprendimiento_id: number | null
  emprendimiento_nombre: string | null
  stock_por_almacen: { almacen_id: number; almacen_nombre: string; stock: number; valor_costo: number; valor_comercial: number }[]
}

export async function getValoracionInventarioExtendida(): Promise<{ data: ProductoValoracionExtendida[]; error: string | null }> {
  if (!isSupabaseConfigured()) {
    const savedProds = localStorage.getItem('productos')
    const savedTrans = localStorage.getItem('transacciones_inventario')
    const savedAlmacenes = localStorage.getItem('almacenes')
    
    const productos = savedProds ? JSON.parse(savedProds) : []
    const transacciones: TransaccionInventario[] = savedTrans ? JSON.parse(savedTrans) : []
    const almacenes = savedAlmacenes ? JSON.parse(savedAlmacenes) : []
    
    const now = new Date()
    
    const valoracion = productos.map((p: { id: number; nombre: string; codigo_barras: string; stock_total: number; costo_promedio: number; precio_venta_sugerido: number; emprendimiento_id?: number | null }) => {
      const stockPorAlmacen = almacenes.map((a: { id: number; nombre: string }) => {
        const stock = transacciones
          .filter(t => t.producto_id === p.id && t.almacen_id === a.id)
          .reduce((sum, t) => sum + (t.cantidad || 0), 0)
        return {
          almacen_id: a.id,
          almacen_nombre: a.nombre,
          stock,
          valor_costo: stock * (p.costo_promedio || 0),
          valor_comercial: stock * (p.precio_venta_sugerido || 0)
        }
      }).filter((s: { stock: number }) => s.stock !== 0)
      
      // Find last sale for this product
      const ventasProducto = transacciones
        .filter(t => t.producto_id === p.id && t.tipo_movimiento === 'Salida Venta')
        .sort((a, b) => new Date(b.fecha || '').getTime() - new Date(a.fecha || '').getTime())
      
      const ultimaVenta = ventasProducto.length > 0 ? ventasProducto[0].fecha || null : null
      let diasSinVenta: number | null = null
      
      if (ultimaVenta) {
        const fechaUltimaVenta = new Date(ultimaVenta)
        diasSinVenta = Math.floor((now.getTime() - fechaUltimaVenta.getTime()) / (1000 * 60 * 60 * 24))
      }
      
      return {
        id: p.id,
        nombre: p.nombre,
        codigo_barras: p.codigo_barras || '',
        stock_total: p.stock_total || 0,
        costo_promedio: p.costo_promedio || 0,
        precio_venta: p.precio_venta_sugerido || 0,
        valor_costo: (p.stock_total || 0) * (p.costo_promedio || 0),
        valor_comercial: (p.stock_total || 0) * (p.precio_venta_sugerido || 0),
        margen_potencial: ((p.stock_total || 0) * (p.precio_venta_sugerido || 0)) - ((p.stock_total || 0) * (p.costo_promedio || 0)),
        dias_sin_venta: diasSinVenta,
        ultima_venta: ultimaVenta,
        emprendimiento_id: p.emprendimiento_id ?? null,
        emprendimiento_nombre: null,
        stock_por_almacen: stockPorAlmacen
      }
    })
    return { data: valoracion, error: null }
  }

  const supabase = createClient()
  if (!supabase) return { data: [], error: 'Cliente no disponible' }

  try {
    // Fetch ALL products paginated (Supabase default cap is 1000 rows per query)
    const PAGE = 1000
    const allProductos: any[] = []
    let prodFrom = 0
    while (true) {
      const { data: batch, error: prodError } = await supabase
        .from('productos')
        .select('id, nombre, codigo_barras, stock_total, costo_promedio, precio_venta_sugerido, emprendimiento_id, emprendimientos(nombre)')
        .order('nombre', { ascending: true })
        .range(prodFrom, prodFrom + PAGE - 1)
      if (prodError) return { data: [], error: prodError.message }
      if (!batch || batch.length === 0) break
      allProductos.push(...batch)
      if (batch.length < PAGE) break
      prodFrom += PAGE
    }
    const productos = allProductos

    // Fetch ALL transactions paginated
    const allTransacciones: any[] = []
    let transFrom = 0
    while (true) {
      const { data: batch, error: transError } = await supabase
        .from('transacciones_inventario')
        .select('producto_id, almacen_id, cantidad, tipo_movimiento, fecha, almacenes(nombre)')
        .range(transFrom, transFrom + PAGE - 1)
      if (transError) return { data: [], error: transError.message }
      if (!batch || batch.length === 0) break
      allTransacciones.push(...batch)
      if (batch.length < PAGE) break
      transFrom += PAGE
    }
    const transacciones = allTransacciones

    const now = new Date()

    // Process valoracion
    const valoracion = (productos || []).map(p => {
      // Group transactions by almacen
      const stockByAlmacen: Record<number, { nombre: string; stock: number }> = {}
      
      const transaccionesProducto = (transacciones || []).filter(t => t.producto_id === p.id)
      
      transaccionesProducto.forEach(t => {
          if (!stockByAlmacen[t.almacen_id]) {
            stockByAlmacen[t.almacen_id] = {
              nombre: (t.almacenes as unknown as { nombre: string })?.nombre || `Almacen ${t.almacen_id}`,
              stock: 0
            }
          }
          stockByAlmacen[t.almacen_id].stock += t.cantidad || 0
        })

      const stockPorAlmacen = Object.entries(stockByAlmacen)
        .filter(([_, v]) => v.stock !== 0)
        .map(([almacenId, v]) => ({
          almacen_id: parseInt(almacenId),
          almacen_nombre: v.nombre,
          stock: v.stock,
          valor_costo: v.stock * (p.costo_promedio || 0),
          valor_comercial: v.stock * (p.precio_venta_sugerido || 0)
        }))

      // Find last sale for this product
      const ventas = transaccionesProducto
        .filter(t => t.tipo_movimiento === 'Salida Venta' && t.fecha)
        .sort((a, b) => new Date(b.fecha!).getTime() - new Date(a.fecha!).getTime())
      
      const ultimaVenta = ventas.length > 0 ? ventas[0].fecha! : null
      let diasSinVenta: number | null = null
      
      if (ultimaVenta) {
        const fechaUltimaVenta = new Date(ultimaVenta)
        diasSinVenta = Math.floor((now.getTime() - fechaUltimaVenta.getTime()) / (1000 * 60 * 60 * 24))
      }

      return {
        id: p.id,
        nombre: p.nombre,
        codigo_barras: p.codigo_barras || '',
        stock_total: p.stock_total || 0,
        costo_promedio: p.costo_promedio || 0,
        precio_venta: p.precio_venta_sugerido || 0,
        valor_costo: (p.stock_total || 0) * (p.costo_promedio || 0),
        valor_comercial: (p.stock_total || 0) * (p.precio_venta_sugerido || 0),
        margen_potencial: ((p.stock_total || 0) * (p.precio_venta_sugerido || 0)) - ((p.stock_total || 0) * (p.costo_promedio || 0)),
        dias_sin_venta: diasSinVenta,
        ultima_venta: ultimaVenta,
        emprendimiento_id: (p as any).emprendimiento_id ?? null,
        emprendimiento_nombre: (p as any).emprendimientos?.nombre ?? null,
        stock_por_almacen: stockPorAlmacen
      }
    })

    return { data: valoracion, error: null }
  } catch (err) {
    console.error('[Supabase] Error obteniendo valoracion extendida:', err)
    return { data: [], error: 'Error de conexion' }
  }
}

export async function getValoracionPorAlmacen(almacenId: number): Promise<{ data: ProductoValoracionExtendida[]; error: string | null }> {
  if (!isSupabaseConfigured()) {
    const savedProds = localStorage.getItem('productos')
    const savedTrans = localStorage.getItem('transacciones_inventario')
    const savedAlmacenes = localStorage.getItem('almacenes')
    
    const productos = savedProds ? JSON.parse(savedProds) : []
    const transacciones: TransaccionInventario[] = savedTrans ? JSON.parse(savedTrans) : []
    const almacenes = savedAlmacenes ? JSON.parse(savedAlmacenes) : []
    const almacen = almacenes.find((a: { id: number }) => a.id === almacenId)
    
    const now = new Date()
    
    const valoracion = productos.map((p: { id: number; nombre: string; codigo_barras: string; costo_promedio: number; precio_venta_sugerido: number }) => {
      // Get stock only for the specific almacen
      const stockAlmacen = transacciones
        .filter(t => t.producto_id === p.id && t.almacen_id === almacenId)
        .reduce((sum, t) => sum + (t.cantidad || 0), 0)
      
      if (stockAlmacen === 0) return null // Exclude products with no stock in this almacen
      
      // Find last sale for this product
      const ventasProducto = transacciones
        .filter(t => t.producto_id === p.id && t.tipo_movimiento === 'Salida Venta')
        .sort((a, b) => new Date(b.fecha || '').getTime() - new Date(a.fecha || '').getTime())
      
      const ultimaVenta = ventasProducto.length > 0 ? ventasProducto[0].fecha || null : null
      let diasSinVenta: number | null = null
      
      if (ultimaVenta) {
        const fechaUltimaVenta = new Date(ultimaVenta)
        diasSinVenta = Math.floor((now.getTime() - fechaUltimaVenta.getTime()) / (1000 * 60 * 60 * 24))
      }
      
      return {
        id: p.id,
        nombre: p.nombre,
        codigo_barras: p.codigo_barras || '',
        stock_total: stockAlmacen,
        costo_promedio: p.costo_promedio || 0,
        precio_venta: p.precio_venta_sugerido || 0,
        valor_costo: stockAlmacen * (p.costo_promedio || 0),
        valor_comercial: stockAlmacen * (p.precio_venta_sugerido || 0),
        margen_potencial: (stockAlmacen * (p.precio_venta_sugerido || 0)) - (stockAlmacen * (p.costo_promedio || 0)),
        dias_sin_venta: diasSinVenta,
        ultima_venta: ultimaVenta,
        stock_por_almacen: [{
          almacen_id: almacenId,
          almacen_nombre: almacen?.nombre || `Almacen ${almacenId}`,
          stock: stockAlmacen,
          valor_costo: stockAlmacen * (p.costo_promedio || 0),
          valor_comercial: stockAlmacen * (p.precio_venta_sugerido || 0)
        }]
      }
    }).filter((p): p is ProductoValoracionExtendida => p !== null)
    
    return { data: valoracion, error: null }
  }

  const supabase = createClient()
  if (!supabase) return { data: [], error: 'Cliente no disponible' }

  try {
    // Fetch ALL products paginated
    const PAGE = 1000
    const allProductos: any[] = []
    let prodFrom = 0
    while (true) {
      const { data: batch, error: prodError } = await supabase
        .from('productos')
        .select('id, nombre, codigo_barras, costo_promedio, precio_venta_sugerido, emprendimiento_id, emprendimientos(nombre)')
        .order('nombre', { ascending: true })
        .range(prodFrom, prodFrom + PAGE - 1)
      if (prodError) return { data: [], error: prodError.message }
      if (!batch || batch.length === 0) break
      allProductos.push(...batch)
      if (batch.length < PAGE) break
      prodFrom += PAGE
    }
    const productos = allProductos

    // Fetch ALL transactions for this almacen paginated
    const allTransacciones: any[] = []
    let transFrom = 0
    while (true) {
      const { data: batch, error: transError } = await supabase
        .from('transacciones_inventario')
        .select('producto_id, cantidad, tipo_movimiento, fecha')
        .eq('almacen_id', almacenId)
        .range(transFrom, transFrom + PAGE - 1)
      if (transError) return { data: [], error: transError.message }
      if (!batch || batch.length === 0) break
      allTransacciones.push(...batch)
      if (batch.length < PAGE) break
      transFrom += PAGE
    }
    const transacciones = allTransacciones

    // Get almacen name
    const { data: almacenData } = await supabase
      .from('almacenes')
      .select('nombre')
      .eq('id', almacenId)
      .single()

    const now = new Date()

    // Process valoracion
    const valoracion = (productos || []).map(p => {
      // Calculate stock for this almacen
      const transaccionesProducto = (transacciones || []).filter(t => t.producto_id === p.id)
      const stockAlmacen = transaccionesProducto.reduce((sum, t) => sum + (t.cantidad || 0), 0)
      
      if (stockAlmacen === 0) return null
      
      // Find last sale for this product
      const ventas = transaccionesProducto
        .filter(t => t.tipo_movimiento === 'Salida Venta' && t.fecha)
        .sort((a, b) => new Date(b.fecha!).getTime() - new Date(a.fecha!).getTime())
      
      const ultimaVenta = ventas.length > 0 ? ventas[0].fecha! : null
      let diasSinVenta: number | null = null
      
      if (ultimaVenta) {
        const fechaUltimaVenta = new Date(ultimaVenta)
        diasSinVenta = Math.floor((now.getTime() - fechaUltimaVenta.getTime()) / (1000 * 60 * 60 * 24))
      }

      return {
        id: p.id,
        nombre: p.nombre,
        codigo_barras: p.codigo_barras || '',
        stock_total: stockAlmacen,
        costo_promedio: p.costo_promedio || 0,
        precio_venta: p.precio_venta_sugerido || 0,
        valor_costo: stockAlmacen * (p.costo_promedio || 0),
        valor_comercial: stockAlmacen * (p.precio_venta_sugerido || 0),
        margen_potencial: (stockAlmacen * (p.precio_venta_sugerido || 0)) - (stockAlmacen * (p.costo_promedio || 0)),
        dias_sin_venta: diasSinVenta,
        ultima_venta: ultimaVenta,
        emprendimiento_id: (p as any).emprendimiento_id ?? null,
        emprendimiento_nombre: (p as any).emprendimientos?.nombre ?? null,
        stock_por_almacen: [{
          almacen_id: almacenId,
          almacen_nombre: almacenData?.nombre || `Almacen ${almacenId}`,
          stock: stockAlmacen,
          valor_costo: stockAlmacen * (p.costo_promedio || 0),
          valor_comercial: stockAlmacen * (p.precio_venta_sugerido || 0)
        }]
      }
    }).filter((p): p is ProductoValoracionExtendida => p !== null)

    return { data: valoracion, error: null }
  } catch (err) {
    console.error('[Supabase] Error obteniendo valoracion por almacen:', err)
    return { data: [], error: 'Error de conexion' }
  }
}

export async function getValoracionInventario(): Promise<{ data: ProductoValoracion[]; error: string | null }> {
  if (!isSupabaseConfigured()) {
    const saved = localStorage.getItem('productos')
    const productos: ProductoValoracion[] = saved ? JSON.parse(saved) : []
    const valoracion = productos.map(p => ({
      id: p.id,
      nombre: p.nombre,
      codigo_barras: p.codigo_barras || '',
      stock_total: p.stock_total || 0,
      costo_promedio: p.costo_promedio || 0,
      valor_total: (p.stock_total || 0) * (p.costo_promedio || 0)
    }))
    return { data: valoracion, error: null }
  }

  const supabase = createClient()
  if (!supabase) return { data: [], error: 'Cliente no disponible' }

  try {
    const { data, error } = await supabase
      .from('productos')
      .select('id, nombre, codigo_barras, stock_total, costo_promedio')
      .order('nombre', { ascending: true })

    if (error) return { data: [], error: error.message }
    
    const valoracion = (data || []).map(p => ({
      id: p.id,
      nombre: p.nombre,
      codigo_barras: p.codigo_barras || '',
      stock_total: p.stock_total || 0,
      costo_promedio: p.costo_promedio || 0,
      valor_total: (p.stock_total || 0) * (p.costo_promedio || 0)
    }))
    
    return { data: valoracion, error: null }
  } catch (err) {
    console.error('[Supabase] Error obteniendo valoracion:', err)
    return { data: [], error: 'Error de conexion' }
  }
}

// ==================== STOCK POR LOCALIZACION ====================

export async function getStockByLocalizacion(
  productoId: number, 
  localizacionId: number
): Promise<{ stock: number; error: string | null }> {
  if (!isSupabaseConfigured()) {
    const saved = localStorage.getItem('transacciones_inventario')
    const transacciones: TransaccionInventario[] = saved ? JSON.parse(saved) : []
    
    const stock = transacciones
      .filter(t => t.producto_id === productoId && t.localizacion_id === localizacionId)
      .reduce((sum, t) => sum + (t.cantidad || 0), 0)
    
    return { stock, error: null }
  }

  const supabase = createClient()
  if (!supabase) return { stock: 0, error: 'Cliente no disponible' }

  try {
    const { data, error } = await supabase
      .from('transacciones_inventario')
      .select('cantidad')
      .eq('producto_id', productoId)
      .eq('localizacion_id', localizacionId)

    if (error) return { stock: 0, error: error.message }
    
    const stock = (data || []).reduce((sum, t) => sum + (t.cantidad || 0), 0)
    return { stock, error: null }
  } catch (err) {
    console.error('[Supabase] Error obteniendo stock por localizacion:', err)
    return { stock: 0, error: 'Error de conexion' }
  }
}

export async function getStockMultipleProducts(
  productoIds: number[], 
  localizacionId: number
): Promise<{ data: Record<number, number>; error: string | null }> {
  if (productoIds.length === 0 || !localizacionId) {
    return { data: {}, error: null }
  }

  if (!isSupabaseConfigured()) {
    const saved = localStorage.getItem('transacciones_inventario')
    const transacciones: TransaccionInventario[] = saved ? JSON.parse(saved) : []
    
    const stockMap: Record<number, number> = {}
    productoIds.forEach(pid => {
      stockMap[pid] = transacciones
        .filter(t => t.producto_id === pid && t.localizacion_id === localizacionId)
        .reduce((sum, t) => sum + (t.cantidad || 0), 0)
    })
    
    return { data: stockMap, error: null }
  }

  const supabase = createClient()
  if (!supabase) return { data: {}, error: 'Cliente no disponible' }

  try {
    const { data, error } = await supabase
      .from('transacciones_inventario')
      .select('producto_id, cantidad')
      .in('producto_id', productoIds)
      .eq('localizacion_id', localizacionId)

    if (error) return { data: {}, error: error.message }
    
    const stockMap: Record<number, number> = {}
    productoIds.forEach(pid => { stockMap[pid] = 0 })
    
    ;(data || []).forEach(t => {
      stockMap[t.producto_id] = (stockMap[t.producto_id] || 0) + (t.cantidad || 0)
    })
    
    return { data: stockMap, error: null }
  } catch (err) {
    console.error('[Supabase] Error obteniendo stock multiple:', err)
    return { data: {}, error: 'Error de conexion' }
  }
}

// ==================== INGRESO MANUAL ====================

interface IngresoManualData {
  producto_id: number
  almacen_id: number
  localizacion_id: number
  cantidad: number
  costo_unitario: number
  observaciones?: string
  stock_anterior: number
  costo_anterior: number
  nuevo_stock: number
  nuevo_costo: number
}

export async function procesarIngresoManual(data: IngresoManualData): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured()) {
    // LocalStorage implementation
    const savedTrans = localStorage.getItem('transacciones_inventario')
    const transacciones: TransaccionInventario[] = savedTrans ? JSON.parse(savedTrans) : []
    
    const savedProds = localStorage.getItem('productos')
    const productos = savedProds ? JSON.parse(savedProds) : []
    
    const now = new Date().toISOString()
    
    // Insert transaction
    transacciones.push({
      id: Date.now(),
      producto_id: data.producto_id,
      almacen_id: data.almacen_id,
      localizacion_id: data.localizacion_id,
      tipo_movimiento: 'Ajuste',
      cantidad: data.cantidad,
      costo_o_precio_unitario: data.costo_unitario,
      fecha: now
    })
    
    // Update product stock and cost
    const prodIndex = productos.findIndex((p: { id: number }) => p.id === data.producto_id)
    if (prodIndex !== -1) {
      productos[prodIndex].stock_total = data.nuevo_stock
      productos[prodIndex].costo_promedio = data.nuevo_costo
    }
    
    localStorage.setItem('transacciones_inventario', JSON.stringify(transacciones))
    localStorage.setItem('productos', JSON.stringify(productos))
    
    return { success: true, error: null }
  }

  const supabase = createClient()
  if (!supabase) return { success: false, error: 'Cliente no disponible' }

  try {
    const stamp = await getTenantStamp(supabase)
    if (!isValidStamp(stamp)) {
      console.log('[v0][procesarIngresoManual] Stamp invalido:', stamp)
      return { success: false, error: SESION_INVALIDA_ERROR }
    }

    // Insert transaction
    const { error: transError } = await supabase
      .from('transacciones_inventario')
      .insert({
        producto_id: data.producto_id,
        almacen_id: data.almacen_id,
        localizacion_id: data.localizacion_id,
        tipo_movimiento: 'Ingreso Manual',
        cantidad: data.cantidad,
        costo_o_precio_unitario: data.costo_unitario,
        ...stamp
      })

    if (transError) return { success: false, error: transError.message }

    // Update product stock and cost
    const { error: updateError } = await supabase
      .from('productos')
      .update({
        stock_total: data.nuevo_stock,
        costo_promedio: data.nuevo_costo
      })
      .eq('id', data.producto_id)

    if (updateError) return { success: false, error: updateError.message }

    return { success: true, error: null }
  } catch (err) {
    console.error('[Supabase] Error procesando ingreso manual:', err)
    return { success: false, error: 'Error de conexion' }
  }
}

// ==================== TRASLADOS ====================

interface TrasladoData {
  producto_id: number
  origen_almacen_id: number
  origen_localizacion_id: number
  destino_almacen_id: number
  destino_localizacion_id: number
  cantidad: number
  costo_unitario: number
}

export async function procesarTraslado(data: TrasladoData): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured()) {
    const saved = localStorage.getItem('transacciones_inventario')
    const transacciones: TransaccionInventario[] = saved ? JSON.parse(saved) : []
    
    const now = new Date().toISOString()
    const refId = Date.now()
    
    // Salida del origen
    transacciones.push({
      id: Date.now(),
      producto_id: data.producto_id,
      almacen_id: data.origen_almacen_id,
      localizacion_id: data.origen_localizacion_id,
      tipo_movimiento: 'Traslado Salida',
      cantidad: -data.cantidad,
      costo_o_precio_unitario: data.costo_unitario,
      referencia_id: refId,
      fecha: now
    })
    
    // Entrada al destino
    transacciones.push({
      id: Date.now() + 1,
      producto_id: data.producto_id,
      almacen_id: data.destino_almacen_id,
      localizacion_id: data.destino_localizacion_id,
      tipo_movimiento: 'Traslado Entrada',
      cantidad: data.cantidad,
      costo_o_precio_unitario: data.costo_unitario,
      referencia_id: refId,
      fecha: now
    })
    
    localStorage.setItem('transacciones_inventario', JSON.stringify(transacciones))
    return { success: true, error: null }
  }

  const supabase = createClient()
  if (!supabase) return { success: false, error: 'Cliente no disponible' }

  try {
    const stamp = await getTenantStamp(supabase)
    if (!isValidStamp(stamp)) {
      console.log('[v0][procesarTraslado] Stamp invalido:', stamp)
      return { success: false, error: SESION_INVALIDA_ERROR }
    }

    const refId = Date.now()
    
    // Insert salida (cantidad negativa)
    const { error: salidaError } = await supabase
      .from('transacciones_inventario')
      .insert({
        producto_id: data.producto_id,
        almacen_id: data.origen_almacen_id,
        localizacion_id: data.origen_localizacion_id,
        tipo_movimiento: 'Traslado Salida',
        cantidad: -data.cantidad,
        costo_o_precio_unitario: data.costo_unitario,
        referencia_id: refId,
        ...stamp
      })

    if (salidaError) return { success: false, error: salidaError.message }

    // Insert entrada (cantidad positiva)
    const { error: entradaError } = await supabase
      .from('transacciones_inventario')
      .insert({
        producto_id: data.producto_id,
        almacen_id: data.destino_almacen_id,
        localizacion_id: data.destino_localizacion_id,
        tipo_movimiento: 'Traslado Entrada',
        cantidad: data.cantidad,
        costo_o_precio_unitario: data.costo_unitario,
        referencia_id: refId,
        ...stamp
      })

    if (entradaError) return { success: false, error: entradaError.message }

    return { success: true, error: null }
  } catch (err) {
    console.error('[Supabase] Error procesando traslado:', err)
    return { success: false, error: 'Error de conexion' }
  }
}

// ==================== TRASLADOS MULTIPLES ====================

export interface TrasladoLineaData {
  producto_id: number
  producto_nombre: string
  cantidad: number
  costo_unitario: number
}

export async function procesarTrasladosMultiples(
  lineas: TrasladoLineaData[],
  origen_almacen_id: number,
  origen_localizacion_id: number,
  destino_almacen_id: number,
  destino_localizacion_id: number
): Promise<{ success: boolean; error: string | null; procesados: number }> {
  if (lineas.length === 0) {
    return { success: false, error: 'No hay productos para trasladar', procesados: 0 }
  }

  if (!isSupabaseConfigured()) {
    const saved = localStorage.getItem('transacciones_inventario')
    const transacciones: TransaccionInventario[] = saved ? JSON.parse(saved) : []
    
    const now = new Date().toISOString()
    const refIdBase = Date.now()
    
    lineas.forEach((linea, index) => {
      const refId = refIdBase + index
      
      // Salida del origen
      transacciones.push({
        id: refIdBase + (index * 2),
        producto_id: linea.producto_id,
        almacen_id: origen_almacen_id,
        localizacion_id: origen_localizacion_id,
        tipo_movimiento: 'Traslado Salida',
        cantidad: -linea.cantidad,
        costo_o_precio_unitario: linea.costo_unitario,
        referencia_id: refId,
        fecha: now
      })
      
      // Entrada al destino
      transacciones.push({
        id: refIdBase + (index * 2) + 1,
        producto_id: linea.producto_id,
        almacen_id: destino_almacen_id,
        localizacion_id: destino_localizacion_id,
        tipo_movimiento: 'Traslado Entrada',
        cantidad: linea.cantidad,
        costo_o_precio_unitario: linea.costo_unitario,
        referencia_id: refId,
        fecha: now
      })
    })
    
    localStorage.setItem('transacciones_inventario', JSON.stringify(transacciones))
    return { success: true, error: null, procesados: lineas.length }
  }

  const supabase = createClient()
  if (!supabase) return { success: false, error: 'Cliente no disponible', procesados: 0 }

  try {
    const stamp = await getTenantStamp(supabase)
    if (!isValidStamp(stamp)) {
      console.log('[v0][procesarTrasladosMultiples] Stamp invalido:', stamp)
      return { success: false, error: SESION_INVALIDA_ERROR, procesados: 0 }
    }

    const refIdBase = Date.now()
    const insertData: {
      producto_id: number
      almacen_id: number
      localizacion_id: number
      tipo_movimiento: string
      cantidad: number
      costo_o_precio_unitario: number
      referencia_id: number
      razon_social_id: number
      usuario: string
    }[] = []
    
    lineas.forEach((linea, index) => {
      const refId = refIdBase + index
      
      // Salida del origen
      insertData.push({
        producto_id: linea.producto_id,
        almacen_id: origen_almacen_id,
        localizacion_id: origen_localizacion_id,
        tipo_movimiento: 'Traslado Salida',
        cantidad: -linea.cantidad,
        costo_o_precio_unitario: linea.costo_unitario,
        referencia_id: refId,
        ...stamp
      })
      
      // Entrada al destino
      insertData.push({
        producto_id: linea.producto_id,
        almacen_id: destino_almacen_id,
        localizacion_id: destino_localizacion_id,
        tipo_movimiento: 'Traslado Entrada',
        cantidad: linea.cantidad,
        costo_o_precio_unitario: linea.costo_unitario,
        referencia_id: refId,
        ...stamp
      })
    })
    
    const { error } = await supabase
      .from('transacciones_inventario')
      .insert(insertData)

    if (error) return { success: false, error: error.message, procesados: 0 }

    return { success: true, error: null, procesados: lineas.length }
  } catch (err) {
    console.error('[Supabase] Error procesando traslados multiples:', err)
    return { success: false, error: 'Error de conexion', procesados: 0 }
  }
}

// ==================== STOCK POR EMPRENDIMIENTO ====================

export interface StockEmprendedor {
  producto_id: number
  nombre: string
  codigo_barras: string
  precio_venta_sugerido: number
  stock_total: number
}

export async function getStockByEmprendimiento(
  emprendimientoId: number,
  razonSocialId: number
): Promise<StockEmprendedor[]> {
  const supabase = createClient()
  if (!supabase) return []

  try {
    const { data, error } = await supabase
      .from('productos')
      .select('id, nombre, codigo_barras, precio_venta_sugerido, stock_total')
      .eq('emprendimiento_id', emprendimientoId)
      .eq('razon_social_id', razonSocialId)
      .order('nombre', { ascending: true })

    if (error) {
      console.error('[inventario] Error getStockByEmprendimiento:', error)
      return []
    }

    return (data ?? []).map((p: any) => ({
      producto_id: p.id,
      nombre: p.nombre,
      codigo_barras: p.codigo_barras,
      precio_venta_sugerido: p.precio_venta_sugerido ?? 0,
      stock_total: p.stock_total ?? 0,
    }))
  } catch (err) {
    console.error('[inventario] Excepcion getStockByEmprendimiento:', err)
    return []
  }
}

// ==================== SALIDA MANUAL ====================

interface SalidaManualData {
  producto_id: number
  almacen_id: number
  localizacion_id?: number
  cantidad: number       // positivo; se registra negativo en la transacción
  observaciones?: string
}

export async function procesarSalidaManual(data: SalidaManualData): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured()) {
    const savedTrans = localStorage.getItem('transacciones_inventario')
    const transacciones: TransaccionInventario[] = savedTrans ? JSON.parse(savedTrans) : []
    const savedProds = localStorage.getItem('productos')
    const productos = savedProds ? JSON.parse(savedProds) : []

    transacciones.push({
      id: Date.now(),
      producto_id: data.producto_id,
      almacen_id: data.almacen_id,
      localizacion_id: data.localizacion_id ?? 0,
      tipo_movimiento: 'Salida Manual',
      cantidad: -Math.abs(data.cantidad),
      costo_o_precio_unitario: 0,
      fecha: new Date().toISOString(),
    })

    const prodIndex = productos.findIndex((p: { id: number }) => p.id === data.producto_id)
    if (prodIndex !== -1) {
      productos[prodIndex].stock_total = Math.max(0, (productos[prodIndex].stock_total || 0) - data.cantidad)
    }

    localStorage.setItem('transacciones_inventario', JSON.stringify(transacciones))
    localStorage.setItem('productos', JSON.stringify(productos))
    return { success: true, error: null }
  }

  const supabase = createClient()
  if (!supabase) return { success: false, error: 'Cliente no disponible' }

  try {
    const stamp = await getTenantStamp(supabase)
    if (!isValidStamp(stamp)) return { success: false, error: SESION_INVALIDA_ERROR }

    // Obtener stock actual para actualizar
    const { data: producto } = await supabase
      .from('productos')
      .select('stock_total')
      .eq('id', data.producto_id)
      .single()

    const stockActual = producto?.stock_total ?? 0
    const nuevoStock = Math.max(0, stockActual - data.cantidad)

    const { error: transError } = await supabase
      .from('transacciones_inventario')
      .insert({
        producto_id: data.producto_id,
        almacen_id: data.almacen_id,
        localizacion_id: data.localizacion_id ?? null,
        tipo_movimiento: 'Salida Manual',
        cantidad: -Math.abs(data.cantidad),
        costo_o_precio_unitario: 0,
        ...stamp,
      })

    if (transError) return { success: false, error: transError.message }

    const { error: updateError } = await supabase
      .from('productos')
      .update({ stock_total: nuevoStock })
      .eq('id', data.producto_id)

    if (updateError) return { success: false, error: updateError.message }

    return { success: true, error: null }
  } catch (err) {
    console.error('[inventario] Error procesando salida manual:', err)
    return { success: false, error: 'Error de conexion' }
  }
}

// ==================== MOVIMIENTOS MASIVOS ADMIN ====================

export async function procesarIngresosMasivoAdmin(
  rows: Array<{ codigo_barras: string; cantidad: number; costo_unitario?: number | null }>,
  tipo: 'ingreso' | 'salida',
  almacen_id: number,
  localizacion_id?: number
): Promise<{ procesados: number; errores: string[] }> {
  const errores: string[] = []
  let procesados = 0

  if (!isSupabaseConfigured()) {
    return { procesados: 0, errores: ['Supabase no configurado'] }
  }

  const supabase = createClient()
  if (!supabase) return { procesados: 0, errores: ['Cliente no disponible'] }

  // Resolver todos los códigos de barras a producto_ids en una sola query
  const codigos = [...new Set(rows.map((r) => r.codigo_barras.trim()).filter(Boolean))]
  const { data: productosData } = await supabase
    .from('productos')
    .select('id, nombre, codigo_barras, stock_total, costo_promedio')
    .in('codigo_barras', codigos)

  const productoMap = new Map(
    (productosData ?? []).map((p) => [p.codigo_barras, p])
  )

  for (const row of rows) {
    const codigo = row.codigo_barras.trim()
    const producto = productoMap.get(codigo)

    if (!producto) {
      errores.push(`Código "${codigo}": producto no encontrado`)
      continue
    }

    if (tipo === 'ingreso') {
      const costoUnitario = row.costo_unitario ?? producto.costo_promedio ?? 0
      const stockAnterior = producto.stock_total ?? 0
      const nuevoStock = stockAnterior + row.cantidad
      const nuevoCosto = nuevoStock > 0
        ? ((stockAnterior * (producto.costo_promedio ?? 0)) + (row.cantidad * costoUnitario)) / nuevoStock
        : costoUnitario

      const result = await procesarIngresoManual({
        producto_id: producto.id,
        almacen_id,
        localizacion_id: localizacion_id ?? 0,
        cantidad: row.cantidad,
        costo_unitario: costoUnitario,
        observaciones: 'Carga masiva admin',
        stock_anterior: stockAnterior,
        costo_anterior: producto.costo_promedio ?? 0,
        nuevo_stock: nuevoStock,
        nuevo_costo: nuevoCosto,
      })

      if (result.error) {
        errores.push(`Código "${codigo}": ${result.error}`)
      } else {
        // Actualizar el mapa para que los cálculos subsiguientes del mismo producto sean correctos
        producto.stock_total = nuevoStock
        producto.costo_promedio = nuevoCosto
        procesados++
      }
    } else {
      // salida
      const result = await procesarSalidaManual({
        producto_id: producto.id,
        almacen_id,
        localizacion_id: localizacion_id,
        cantidad: row.cantidad,
        observaciones: 'Salida masiva admin',
      })

      if (result.error) {
        errores.push(`Código "${codigo}": ${result.error}`)
      } else {
        producto.stock_total = Math.max(0, (producto.stock_total ?? 0) - row.cantidad)
        procesados++
      }
    }
  }

  return { procesados, errores }
}
