import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { getTenantStamp, isValidStamp, SESION_INVALIDA_ERROR } from '@/lib/services/tenant-stamp'

// ==================== INTERFACES ====================

export interface CompraEncabezado {
  id?: number
  proveedor_id: number
  proveedor_nombre?: string
  fecha_orden?: string  // timestamp with time zone, defaults to now()
  fecha_tentativa: string  // date
  moneda: 'LPS' | 'USD'
  tasa_cambio: number  // numeric(12,4), default 1
  costos_importacion: number  // numeric(12,2), default 0
  impuestos_compra: number  // numeric(12,2), default 0
  otros_costos: number  // numeric(12,2), default 0
  total_compra_local: number  // numeric(12,2), default 0
  subtotal?: number
  total?: number
  estado: 'Pendiente' | 'Recibida' | 'Cancelada'
}

export interface CompraDetalle {
  id?: number
  compra_id: number
  producto_id: number
  producto_nombre?: string
  producto_codigo?: string
  cantidad: number
  cantidad_recibida?: number
  costo_unitario_moneda_origen: number
  costo_final_local?: number
}

export interface TransaccionInventario {
  id?: number
  producto_id: number
  almacen_id: number
  localizacion_id: number
  tipo_movimiento: 'Entrada Compra' | 'Salida Venta' | 'Traslado Entrada' | 'Traslado Salida' | 'Ajuste'
  cantidad: number
  costo_o_precio_unitario: number
  referencia_id: number
  fecha?: string  // defaults to now() in database
}

// ==================== ORDEN DE COMPRA ====================

export async function getCompras(estado?: string): Promise<{ data: CompraEncabezado[]; error: string | null }> {
  if (!isSupabaseConfigured()) {
    const saved = localStorage.getItem('compras_encabezado')
    let compras: CompraEncabezado[] = saved ? JSON.parse(saved) : []
    if (estado) {
      compras = compras.filter(c => c.estado === estado)
    }
    return { data: compras, error: null }
  }

  const supabase = createClient()
  if (!supabase) return { data: [], error: 'Cliente no disponible' }

  try {
    let query = supabase
      .from('compras_encabezado')
      .select(`
        *,
        proveedores (nombre)
      `)
      .order('id', { ascending: false })

    if (estado) {
      query = query.eq('estado', estado)
    }

    const { data, error } = await query

    if (error) return { data: [], error: error.message }
    
    const formattedData = (data || []).map(c => ({
      ...c,
      proveedor_nombre: c.proveedores?.nombre || ''
    }))
    
    return { data: formattedData, error: null }
  } catch (err) {
    console.error('[Supabase] Error obteniendo compras:', err)
    return { data: [], error: 'Error de conexion' }
  }
}

export async function getCompraById(id: number): Promise<{ data: CompraEncabezado | null; error: string | null }> {
  if (!isSupabaseConfigured()) {
    const saved = localStorage.getItem('compras_encabezado')
    const compras: CompraEncabezado[] = saved ? JSON.parse(saved) : []
    const compra = compras.find(c => c.id === id) || null
    return { data: compra, error: null }
  }

  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Cliente no disponible' }

  try {
    const { data, error } = await supabase
      .from('compras_encabezado')
      .select(`
        *,
        proveedores (nombre)
      `)
      .eq('id', id)
      .single()

    if (error) return { data: null, error: error.message }
    
    return { 
      data: { ...data, proveedor_nombre: data.proveedores?.nombre || '' }, 
      error: null 
    }
  } catch (err) {
    console.error('[Supabase] Error obteniendo compra:', err)
    return { data: null, error: 'Error de conexion' }
  }
}

export async function getDetallesCompra(compraId: number): Promise<{ data: CompraDetalle[]; error: string | null }> {
  if (!isSupabaseConfigured()) {
    const saved = localStorage.getItem('compras_detalle')
    const detalles: CompraDetalle[] = saved ? JSON.parse(saved) : []
    return { data: detalles.filter(d => d.compra_id === compraId), error: null }
  }

  const supabase = createClient()
  if (!supabase) return { data: [], error: 'Cliente no disponible' }

  try {
    const { data, error } = await supabase
      .from('compras_detalle')
      .select(`
        *,
        productos (nombre, codigo_barras)
      `)
      .eq('compra_id', compraId)
      .order('id', { ascending: true })

    if (error) return { data: [], error: error.message }
    
    const formattedData = (data || []).map(d => ({
      ...d,
      producto_nombre: d.productos?.nombre || '',
      producto_codigo: d.productos?.codigo_barras || ''
    }))
    
    return { data: formattedData, error: null }
  } catch (err) {
    console.error('[Supabase] Error obteniendo detalles:', err)
    return { data: [], error: 'Error de conexion' }
  }
}

export async function createCompra(
  encabezado: Omit<CompraEncabezado, 'id' | 'created_at' | 'updated_at'>,
  detalles: Omit<CompraDetalle, 'id' | 'compra_id' | 'created_at'>[]
): Promise<{ data: CompraEncabezado | null; error: string | null }> {
  if (!isSupabaseConfigured()) {
    const savedEnc = localStorage.getItem('compras_encabezado')
    const savedDet = localStorage.getItem('compras_detalle')
    const compras: CompraEncabezado[] = savedEnc ? JSON.parse(savedEnc) : []
    const allDetalles: CompraDetalle[] = savedDet ? JSON.parse(savedDet) : []
    
    const newCompra: CompraEncabezado = { 
      ...encabezado, 
      id: Date.now(),
      created_at: new Date().toISOString()
    }
    compras.push(newCompra)
    localStorage.setItem('compras_encabezado', JSON.stringify(compras))
    
    const newDetalles = detalles.map((d, idx) => ({
      ...d,
      id: Date.now() + idx + 1,
      compra_id: newCompra.id!,
      created_at: new Date().toISOString()
    }))
    allDetalles.push(...newDetalles)
    localStorage.setItem('compras_detalle', JSON.stringify(allDetalles))
    
    return { data: newCompra, error: null }
  }

  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Cliente no disponible' }

  try {
    const stamp = await getTenantStamp(supabase)
    if (!isValidStamp(stamp)) {
      console.log('[v0][createCompra] Stamp invalido:', stamp)
      return { data: null, error: SESION_INVALIDA_ERROR }
    }

    // Insert encabezado (sello completo: empresa + usuario que crea la orden)
    const { data: compraData, error: compraError } = await supabase
      .from('compras_encabezado')
      .insert({ ...encabezado, ...stamp })
      .select()
      .single()

    if (compraError) return { data: null, error: compraError.message }

    // Insert detalles (solo razon_social_id a nivel linea)
    const detallesConCompra = detalles.map(d => ({
      ...d,
      compra_id: compraData.id,
      razon_social_id: stamp.razon_social_id
    }))

    const { error: detallesError } = await supabase
      .from('compras_detalle')
      .insert(detallesConCompra)

    if (detallesError) {
      // Rollback: delete the encabezado
      await supabase.from('compras_encabezado').delete().eq('id', compraData.id)
      return { data: null, error: detallesError.message }
    }

    return { data: compraData, error: null }
  } catch (err) {
    console.error('[Supabase] Error creando compra:', err)
    return { data: null, error: 'Error de conexion' }
  }
}

// ==================== DELETE COMPRA ====================

export async function deleteCompra(compraId: number): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured()) {
    const savedEnc = localStorage.getItem('compras_encabezado')
    const savedDet = localStorage.getItem('compras_detalle')
    
    let compras: CompraEncabezado[] = savedEnc ? JSON.parse(savedEnc) : []
    let detalles: CompraDetalle[] = savedDet ? JSON.parse(savedDet) : []
    
    // Check if order is pending
    const compra = compras.find(c => c.id === compraId)
    if (!compra) return { success: false, error: 'Orden no encontrada' }
    if (compra.estado !== 'Pendiente') return { success: false, error: 'Solo se pueden eliminar ordenes pendientes' }
    
    // Delete
    compras = compras.filter(c => c.id !== compraId)
    detalles = detalles.filter(d => d.compra_id !== compraId)
    
    localStorage.setItem('compras_encabezado', JSON.stringify(compras))
    localStorage.setItem('compras_detalle', JSON.stringify(detalles))
    
    return { success: true, error: null }
  }

  const supabase = createClient()
  if (!supabase) return { success: false, error: 'Cliente no disponible' }

  try {
    // Check if order is pending
    const { data: compra, error: checkError } = await supabase
      .from('compras_encabezado')
      .select('estado')
      .eq('id', compraId)
      .single()

    if (checkError) return { success: false, error: checkError.message }
    if (compra.estado !== 'Pendiente') return { success: false, error: 'Solo se pueden eliminar ordenes pendientes' }

    // Delete details first
    const { error: detError } = await supabase
      .from('compras_detalle')
      .delete()
      .eq('compra_id', compraId)

    if (detError) return { success: false, error: detError.message }

    // Delete encabezado
    const { error: encError } = await supabase
      .from('compras_encabezado')
      .delete()
      .eq('id', compraId)

    if (encError) return { success: false, error: encError.message }

    return { success: true, error: null }
  } catch (err) {
    console.error('[Supabase] Error eliminando compra:', err)
    return { success: false, error: 'Error de conexion' }
  }
}

// ==================== RECEPCION Y PRORRATEO ====================

interface RecepcionData {
  compraId: number
  costos_importacion: number
  impuestos_compra: number
  otros_costos: number
  tasa_cambio: number
  almacen_id: number
  localizacion_id: number
  detalles: {
    detalle_id: number
    producto_id: number
    cantidad_recibida: number
    costo_final_local: number
  }[]
}

export async function procesarRecepcion(data: RecepcionData): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured()) {
    // LocalStorage fallback
    const savedEnc = localStorage.getItem('compras_encabezado')
    const savedDet = localStorage.getItem('compras_detalle')
    const savedProd = localStorage.getItem('productos')
    const savedTrans = localStorage.getItem('transacciones_inventario')
    
    const compras: CompraEncabezado[] = savedEnc ? JSON.parse(savedEnc) : []
    const detalles: CompraDetalle[] = savedDet ? JSON.parse(savedDet) : []
    const productos: { id: number; costo_promedio: number; stock_total: number }[] = savedProd ? JSON.parse(savedProd) : []
    const transacciones: TransaccionInventario[] = savedTrans ? JSON.parse(savedTrans) : []
    
    // Calculate total_compra_local
    const totalCompraLocal = data.detalles.reduce((acc, d) => acc + (d.cantidad_recibida * d.costo_final_local), 0)
    
    // Update compra encabezado
    const compraIdx = compras.findIndex(c => c.id === data.compraId)
    if (compraIdx >= 0) {
      compras[compraIdx] = {
        ...compras[compraIdx],
        costos_importacion: data.costos_importacion,
        impuestos_compra: data.impuestos_compra,
        otros_costos: data.otros_costos,
        tasa_cambio: data.tasa_cambio,
        total_compra_local: totalCompraLocal,
        estado: 'Recibida'
      }
    }
    
    // Update detalles and products
    for (const item of data.detalles) {
      // Update detalle
      const detIdx = detalles.findIndex(d => d.id === item.detalle_id)
      if (detIdx >= 0) {
        detalles[detIdx] = {
          ...detalles[detIdx],
          cantidad_recibida: item.cantidad_recibida,
          costo_final_local: item.costo_final_local
        }
      }
      
      // Update product stock and average cost
      const prodIdx = productos.findIndex(p => p.id === item.producto_id)
      if (prodIdx >= 0) {
        const prod = productos[prodIdx]
        const stockActual = prod.stock_total || 0
        const costoActual = prod.costo_promedio || 0
        const cantRecibida = item.cantidad_recibida
        const costoFinal = item.costo_final_local
        
        // Weighted average cost formula
        const nuevoStock = stockActual + cantRecibida
        const nuevoCosto = nuevoStock > 0 
          ? ((stockActual * costoActual) + (cantRecibida * costoFinal)) / nuevoStock
          : costoFinal
        
        productos[prodIdx] = {
          ...prod,
          stock_total: nuevoStock,
          costo_promedio: nuevoCosto
        }
      }
      
      // Create inventory transaction
      transacciones.push({
        id: Date.now() + Math.random(),
        producto_id: item.producto_id,
        almacen_id: data.almacen_id,
        localizacion_id: data.localizacion_id,
        tipo_movimiento: 'Entrada Compra',
        cantidad: item.cantidad_recibida,
        costo_o_precio_unitario: item.costo_final_local,
        referencia_id: data.compraId,
        fecha: new Date().toISOString()
      })
    }
    
    localStorage.setItem('compras_encabezado', JSON.stringify(compras))
    localStorage.setItem('compras_detalle', JSON.stringify(detalles))
    localStorage.setItem('productos', JSON.stringify(productos))
    localStorage.setItem('transacciones_inventario', JSON.stringify(transacciones))
    
    return { success: true, error: null }
  }

  const supabase = createClient()
  if (!supabase) return { success: false, error: 'Cliente no disponible' }

  try {
    const stamp = await getTenantStamp(supabase)
    if (!isValidStamp(stamp)) {
      console.log('[v0][procesarRecepcion] Stamp invalido:', stamp)
      return { success: false, error: SESION_INVALIDA_ERROR }
    }

    // Calculate total_compra_local
    const totalCompraLocal = data.detalles.reduce((acc, d) => acc + (d.cantidad_recibida * d.costo_final_local), 0)
    
    // 1. Update compra encabezado (no alteramos razon_social_id ni usuario
    // originales para preservar aislamiento e historial de autoria)
    const { error: encError } = await supabase
      .from('compras_encabezado')
      .update({
        costos_importacion: data.costos_importacion,
        impuestos_compra: data.impuestos_compra,
        otros_costos: data.otros_costos,
        tasa_cambio: data.tasa_cambio,
        total_compra_local: totalCompraLocal,
        estado: 'Recibida'
      })
      .eq('id', data.compraId)

    if (encError) return { success: false, error: encError.message }

    // 2. Process each detail
    for (const item of data.detalles) {
      // Update detalle
      const { error: detError } = await supabase
        .from('compras_detalle')
        .update({
          cantidad_recibida: item.cantidad_recibida,
          costo_final_local: item.costo_final_local
        })
        .eq('id', item.detalle_id)

      if (detError) return { success: false, error: detError.message }

      // Get current product data
      const { data: prodData, error: prodReadError } = await supabase
        .from('productos')
        .select('stock_total, costo_promedio')
        .eq('id', item.producto_id)
        .single()

      if (prodReadError) return { success: false, error: prodReadError.message }

      const stockActual = prodData?.stock_total || 0
      const costoActual = prodData?.costo_promedio || 0
      const cantRecibida = item.cantidad_recibida
      const costoFinal = item.costo_final_local

      // Calculate new weighted average cost
      const nuevoStock = stockActual + cantRecibida
      const nuevoCosto = nuevoStock > 0
        ? ((stockActual * costoActual) + (cantRecibida * costoFinal)) / nuevoStock
        : costoFinal

      // Update product
      const { error: prodUpdateError } = await supabase
        .from('productos')
        .update({
          stock_total: nuevoStock,
          costo_promedio: nuevoCosto,
          updated_at: new Date().toISOString()
        })
        .eq('id', item.producto_id)

      if (prodUpdateError) return { success: false, error: prodUpdateError.message }

      // Insert inventory transaction (sello completo: empresa + usuario
      // que procesa la recepcion, que puede diferir de quien creo la orden)
      const { error: transError } = await supabase
        .from('transacciones_inventario')
        .insert({
          producto_id: item.producto_id,
          almacen_id: data.almacen_id,
          localizacion_id: data.localizacion_id,
          tipo_movimiento: 'Entrada Compra',
          cantidad: item.cantidad_recibida,
          costo_o_precio_unitario: item.costo_final_local,
          referencia_id: data.compraId,
          ...stamp
          // fecha defaults to now() in database
        })

      if (transError) return { success: false, error: transError.message }
    }

    return { success: true, error: null }
  } catch (err) {
    console.error('[Supabase] Error procesando recepcion:', err)
    return { success: false, error: 'Error de conexion' }
  }
}

// ==================== HELPERS ====================

export function calcularProrrateo(
  detalles: CompraDetalle[],
  costosAdicionales: number,
  moneda: 'LPS' | 'USD',
  tasaCambio: number
): { detalle_id: number; producto_id: number; cantidad: number; costo_final_local: number }[] {
  // Calculate subtotal of all items in origin currency
  const subtotal = detalles.reduce((acc, d) => acc + (d.cantidad * d.costo_unitario_moneda_origen), 0)
  
  // Convert to LPS if USD
  const subtotalLPS = moneda === 'USD' ? subtotal * tasaCambio : subtotal
  const costosLPS = costosAdicionales // Already in LPS
  
  return detalles.map(d => {
    const valorItemOriginal = d.cantidad * d.costo_unitario_moneda_origen
    const valorItemLPS = moneda === 'USD' ? valorItemOriginal * tasaCambio : valorItemOriginal
    
    // Proportional share of additional costs
    const proporcion = subtotalLPS > 0 ? valorItemLPS / subtotalLPS : 0
    const costosProrrateados = costosLPS * proporcion
    
    // Final unit cost in local currency (LPS)
    const costoFinalTotal = valorItemLPS + costosProrrateados
    const costoFinalLocal = d.cantidad > 0 ? costoFinalTotal / d.cantidad : 0
    
    return {
      detalle_id: d.id!,
      producto_id: d.producto_id,
      cantidad: d.cantidad,
      costo_final_local: Math.round(costoFinalLocal * 100) / 100
    }
  })
}
