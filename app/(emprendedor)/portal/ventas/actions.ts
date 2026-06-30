"use server"

import { createAdminClient } from "@/lib/supabase/admin"

export async function marcarVentaPagadaEmprendedor(
  ventaId: number,
  emprendimientoId: number
): Promise<{ error: string | null }> {
  const supabase = createAdminClient()
  if (!supabase) return { error: "Error de conexión" }

  // Verificar que esta venta incluye productos del emprendimiento
  const { count } = await supabase
    .from("ventas_detalle")
    .select("venta_id, productos!inner(emprendimiento_id)", { count: "exact", head: true })
    .eq("venta_id", ventaId)
    .eq("productos.emprendimiento_id", emprendimientoId)

  if (!count || count === 0) return { error: "No tienes acceso a esta venta" }

  const { data: ventaData, error: ventaErr } = await supabase
    .from("ventas_encabezado")
    .select("total_venta, estado_pago")
    .eq("id", ventaId)
    .single()

  if (ventaErr || !ventaData) return { error: "Venta no encontrada" }
  if (ventaData.estado_pago === "Pagado") return { error: null }

  const { error: updateError } = await supabase
    .from("ventas_encabezado")
    .update({ estado_pago: "Pagado", valorpago: ventaData.total_venta })
    .eq("id", ventaId)

  if (updateError) return { error: updateError.message }
  return { error: null }
}
