"use client"

import * as React from "react"
import { useEmprendedorAuth } from "@/lib/contexts/emprendedor-auth-context"
import { getStockByEmprendimiento, type StockEmprendedor } from "@/lib/services/inventario-pendiente"
import {
  submitCambioPrecio,
  getCambiosPrecioByEmprendimiento,
  type CambioPrecioPendiente,
} from "@/lib/services/cambios-precio"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { format } from "date-fns"
import { Tag } from "lucide-react"

function EstadoBadge({ estado }: { estado: string }) {
  if (estado === "aprobado") return <Badge className="bg-green-600 text-white">Aprobado</Badge>
  if (estado === "rechazado") return <Badge variant="destructive">Rechazado</Badge>
  return <Badge variant="secondary">Pendiente</Badge>
}

export default function CambiosPrecioPage() {
  const { emprendedor } = useEmprendedorAuth()
  const emprendimientoId = emprendedor?.emprendimientoId ?? 0
  const razonSocialId = emprendedor?.razonSocialId ?? 0

  const [productos, setProductos] = React.useState<StockEmprendedor[]>([])
  const [historial, setHistorial] = React.useState<CambioPrecioPendiente[]>([])
  const [loadingProds, setLoadingProds] = React.useState(true)
  const [loadingHist, setLoadingHist] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)

  const [productoId, setProductoId] = React.useState("")
  const [precioNuevo, setPrecioNuevo] = React.useState("")
  const [motivo, setMotivo] = React.useState("")

  const productoSeleccionado = productos.find((p) => String(p.producto_id) === productoId)

  const cargar = React.useCallback(async () => {
    if (!emprendimientoId) return
    setLoadingProds(true)
    setLoadingHist(true)
    const [prods, hist] = await Promise.all([
      getStockByEmprendimiento(emprendimientoId, razonSocialId),
      getCambiosPrecioByEmprendimiento(emprendimientoId),
    ])
    setProductos(prods)
    setLoadingProds(false)
    setHistorial(hist)
    setLoadingHist(false)
  }, [emprendimientoId, razonSocialId])

  React.useEffect(() => { cargar() }, [cargar])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!emprendedor || !productoSeleccionado) return

    const nuevo = parseFloat(precioNuevo)
    if (!nuevo || nuevo <= 0) {
      toast.error("Ingresa un precio válido mayor a 0")
      return
    }
    if (nuevo === productoSeleccionado.precio_venta_sugerido) {
      toast.error("El precio nuevo debe ser diferente al precio actual")
      return
    }

    setSubmitting(true)
    const { error } = await submitCambioPrecio({
      emprendimiento_id: emprendimientoId,
      razon_social_id: razonSocialId,
      producto_id: productoSeleccionado.producto_id,
      producto_nombre: productoSeleccionado.nombre,
      codigo_barras: productoSeleccionado.codigo_barras,
      precio_actual: productoSeleccionado.precio_venta_sugerido,
      precio_nuevo: nuevo,
      motivo: motivo.trim() || null,
      usuario: emprendedor.nombre,
    })
    setSubmitting(false)

    if (error) {
      toast.error(`Error al enviar solicitud: ${error}`)
      return
    }

    toast.success("Solicitud enviada correctamente")
    setProductoId("")
    setPrecioNuevo("")
    setMotivo("")
    cargar()
  }

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Cambios de precio</h1>
        <p className="text-sm text-stone-500 mt-1">
          Solicita un cambio en el precio de venta de uno de tus productos. El administrador revisará tu solicitud.
        </p>
      </div>

      {/* ── Formulario ── */}
      <div className="rounded-xl border border-stone-200 bg-white p-6 space-y-5 max-w-lg shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Tag className="h-5 w-5 text-amber-700" />
          <h2 className="text-base font-semibold text-stone-700">Nueva solicitud</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Producto</Label>
            {loadingProds ? (
              <p className="text-sm text-stone-400">Cargando productos...</p>
            ) : (
              <Select
                value={productoId}
                onValueChange={(v) => { setProductoId(v); setPrecioNuevo("") }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un producto" />
                </SelectTrigger>
                <SelectContent>
                  {productos.map((p) => (
                    <SelectItem key={p.producto_id} value={String(p.producto_id)}>
                      {p.codigo_barras} — {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {productoSeleccionado && (
            <div className="space-y-1.5">
              <Label>Precio actual</Label>
              <Input
                value={`L ${productoSeleccionado.precio_venta_sugerido.toLocaleString("es")}`}
                readOnly
                className="bg-stone-50 text-stone-500 cursor-not-allowed"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>
              Precio nuevo solicitado <span className="text-red-500">*</span>
            </Label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={precioNuevo}
              onChange={(e) => setPrecioNuevo(e.target.value)}
              disabled={!productoSeleccionado}
            />
          </div>

          <div className="space-y-1.5">
            <Label>
              Motivo{" "}
              <span className="text-stone-400 font-normal">(opcional)</span>
            </Label>
            <Textarea
              placeholder="Explica brevemente el motivo del cambio..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
            />
          </div>

          <Button
            type="submit"
            disabled={submitting || !productoId || !precioNuevo}
            className="w-full text-white"
            style={{ background: "#78350f" }}
          >
            {submitting ? "Enviando..." : "Enviar solicitud"}
          </Button>
        </form>
      </div>

      {/* ── Historial ── */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-stone-700">Historial de solicitudes</h2>

        {loadingHist ? (
          <p className="text-sm text-stone-400">Cargando historial...</p>
        ) : historial.length === 0 ? (
          <p className="text-sm text-stone-400">No has enviado solicitudes de cambio de precio.</p>
        ) : (
          <div className="rounded-xl border border-stone-200 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead className="text-right">Precio actual</TableHead>
                  <TableHead className="text-right">Precio solicitado</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Motivo rechazo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historial.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm">
                      {c.created_at ? format(new Date(c.created_at), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell className="font-medium">{c.producto_nombre}</TableCell>
                    <TableCell className="font-mono text-sm">{c.codigo_barras}</TableCell>
                    <TableCell className="text-right">
                      L {c.precio_actual.toLocaleString("es")}
                    </TableCell>
                    <TableCell className="text-right">
                      L {c.precio_nuevo.toLocaleString("es")}
                    </TableCell>
                    <TableCell>
                      <EstadoBadge estado={c.estado ?? "pendiente"} />
                    </TableCell>
                    <TableCell className="text-sm text-stone-500">
                      {c.motivo_rechazo ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
