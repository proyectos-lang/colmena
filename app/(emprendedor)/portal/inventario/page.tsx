"use client"

import * as React from "react"
import { useEmprendedorAuth } from "@/lib/contexts/emprendedor-auth-context"
import {
  getStockByEmprendimiento,
  type StockEmprendedor,
} from "@/lib/services/inventario"
import {
  submitIngresoPendiente,
  submitIngresosBulkFromCodigos,
  getIngresosPendientesByEmprendimiento,
  type IngresoPendiente,
} from "@/lib/services/inventario-pendiente"
import { getVentasByEmprendimiento } from "@/lib/services/ventas"
import { parseInventarioExcelRaw, type RawInventarioRow } from "@/lib/utils/excel-parsers"
import { getAlmacenes } from "@/lib/services/catalogos"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { Download, Upload, Send, FileSpreadsheet, CalendarClock } from "lucide-react"
import { format, subDays, differenceInDays, parseISO } from "date-fns"
import { es } from "date-fns/locale"

function EstadoBadge({ estado }: { estado?: string }) {
  if (estado === "aprobado")  return <Badge className="bg-green-600 text-white text-xs">Aprobado</Badge>
  if (estado === "rechazado") return <Badge variant="destructive" className="text-xs">Rechazado</Badge>
  return <Badge variant="secondary" className="text-xs">Pendiente</Badge>
}

function fmoney(n: number) {
  return "L " + new Intl.NumberFormat("es-HN", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

/* ─── Badge de días sin venta ──────────────────────────────── */
function DiasSinVentaBadge({ dias }: { dias: number | null }) {
  if (dias === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
        style={{ background: "#fee2e2", color: "#dc2626" }}>
        <CalendarClock className="h-3 w-3" />
        Sin ventas
      </span>
    )
  }
  if (dias === 0) {
    return (
      <span className="rounded-full px-2 py-0.5 text-xs font-medium"
        style={{ background: "#dcfce7", color: "#16a34a" }}>
        Hoy
      </span>
    )
  }
  if (dias <= 7) {
    return (
      <span className="rounded-full px-2 py-0.5 text-xs font-medium"
        style={{ background: "#dcfce7", color: "#15803d" }}>
        {dias}d
      </span>
    )
  }
  if (dias <= 30) {
    return (
      <span className="rounded-full px-2 py-0.5 text-xs font-medium"
        style={{ background: "#fef9c3", color: "#a16207" }}>
        {dias}d
      </span>
    )
  }
  if (dias <= 60) {
    return (
      <span className="rounded-full px-2 py-0.5 text-xs font-medium"
        style={{ background: "#ffedd5", color: "#c2410c" }}>
        {dias}d
      </span>
    )
  }
  return (
    <span className="rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: "#fee2e2", color: "#dc2626" }}>
      {dias}d
    </span>
  )
}

export default function InventarioPage() {
  const { emprendedor } = useEmprendedorAuth()
  const [stock, setStock] = React.useState<StockEmprendedor[]>([])
  const [stockLoading, setStockLoading] = React.useState(true)
  const [almacenes, setAlmacenes] = React.useState<any[]>([])
  const [historial, setHistorial] = React.useState<IngresoPendiente[]>([])
  /* mapa producto_id → días desde última venta (null = nunca vendido) */
  const [diasSinVenta, setDiasSinVenta] = React.useState<Record<number, number | null>>({})

  const [productoSeleccionado, setProductoSeleccionado] = React.useState("")
  const [cantidad, setCantidad] = React.useState("")
  const [costo, setCosto] = React.useState("")
  const [almacenId, setAlmacenId] = React.useState("")
  const [sending, setSending] = React.useState(false)

  const [excelRows, setExcelRows] = React.useState<RawInventarioRow[]>([])
  const [excelErrors, setExcelErrors] = React.useState<string[]>([])
  const [excelSending, setExcelSending] = React.useState(false)
  const [excelFileName, setExcelFileName] = React.useState("")
  const fileRef = React.useRef<HTMLInputElement>(null)

  const cargar = React.useCallback(async () => {
    if (!emprendedor) return
    setStockLoading(true)

    const hoy   = new Date()
    const desde = format(subDays(hoy, 365), "yyyy-MM-dd") + "T00:00:00"
    const hasta = format(hoy, "yyyy-MM-dd")               + "T23:59:59"

    const [stockData, alms, hist, ventasData] = await Promise.all([
      getStockByEmprendimiento(emprendedor.emprendimientoId, emprendedor.razonSocialId),
      getAlmacenes(),
      getIngresosPendientesByEmprendimiento(emprendedor.emprendimientoId),
      getVentasByEmprendimiento(emprendedor.emprendimientoId, desde, hasta),
    ])

    setStock(stockData)
    setAlmacenes(alms.data ?? [])
    setHistorial(hist.filter((x) => x.estado !== "rechazado"))

    /* Calcular última venta por producto */
    const ultimaVenta: Record<number, Date> = {}
    ventasData.forEach((v) => {
      const fecha = parseISO(v.fecha_venta)
      if (!ultimaVenta[v.producto_id] || fecha > ultimaVenta[v.producto_id]) {
        ultimaVenta[v.producto_id] = fecha
      }
    })
    const mapa: Record<number, number | null> = {}
    stockData.forEach((p) => {
      if (ultimaVenta[p.producto_id]) {
        mapa[p.producto_id] = differenceInDays(hoy, ultimaVenta[p.producto_id])
      } else {
        mapa[p.producto_id] = null
      }
    })
    setDiasSinVenta(mapa)
    setStockLoading(false)
  }, [emprendedor])

  React.useEffect(() => { cargar() }, [cargar])

  const enviarIngreso = async () => {
    if (!emprendedor) return
    if (!productoSeleccionado || !cantidad || !almacenId) {
      toast.error("Producto, cantidad y almacén son requeridos")
      return
    }
    setSending(true)
    const { error } = await submitIngresoPendiente({
      emprendimiento_id: emprendedor.emprendimientoId,
      razon_social_id:   emprendedor.razonSocialId,
      producto_id:       Number(productoSeleccionado),
      almacen_id:        Number(almacenId),
      cantidad:          parseFloat(cantidad),
      costo_unitario:    costo ? parseFloat(costo) : null,
      usuario:           emprendedor.usuario,
    })
    setSending(false)
    if (error) { toast.error(`Error: ${error}`); return }
    toast.success("Ingreso enviado para aprobación")
    setProductoSeleccionado(""); setCantidad(""); setCosto(""); setAlmacenId("")
    cargar()
  }

  const descargarPlantilla = async () => {
    const res  = await fetch("/api/emprendedor/plantilla-inventario")
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href     = url
    a.download = "plantilla_inventario.xlsx"
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setExcelFileName(file.name)
    const buffer = Buffer.from(await file.arrayBuffer())
    const { rows, errors } = parseInventarioExcelRaw(buffer)
    setExcelRows(rows); setExcelErrors(errors)
  }

  const enviarMasivo = async () => {
    if (!emprendedor || excelRows.length === 0) return
    setExcelSending(true)
    const { insertados, rowErrors, error } = await submitIngresosBulkFromCodigos(
      excelRows, emprendedor.emprendimientoId, emprendedor.razonSocialId,
      emprendedor.usuario, almacenId ? Number(almacenId) : null
    )
    setExcelSending(false)
    if (error) { toast.error(`Error: ${error}`); return }
    if (rowErrors.length > 0) toast.error(rowErrors.join(" | "))
    if (insertados > 0) toast.success(`${insertados} registros enviados para aprobación`)
    setExcelRows([]); setExcelErrors([]); setExcelFileName("")
    if (fileRef.current) fileRef.current.value = ""
    cargar()
  }

  /* ─── Leyenda rotación ─────────────────────────────── */
  const legendaItems = [
    { label: "Hoy / ≤7d",  bg: "#dcfce7", text: "#15803d" },
    { label: "8–30d",       bg: "#fef9c3", text: "#a16207" },
    { label: "31–60d",      bg: "#ffedd5", text: "#c2410c" },
    { label: ">60d",        bg: "#fee2e2", text: "#dc2626" },
    { label: "Sin ventas",  bg: "#fee2e2", text: "#dc2626" },
  ]

  return (
    <div className="space-y-6 -m-4 md:-m-6 p-4 md:p-6 min-h-screen bg-gradient-to-br from-stone-50 via-amber-50/20 to-orange-50/30">

      <div>
        <h1 className="text-2xl font-bold text-stone-800">Inventario</h1>
        <p className="text-stone-500 text-sm">Consulta tu stock y solicita cargas de inventario</p>
      </div>

      <Tabs defaultValue="stock">
        <TabsList className="bg-stone-100/80">
          <TabsTrigger value="stock">Ver Stock</TabsTrigger>
          <TabsTrigger value="individual">Agregar individual</TabsTrigger>
          <TabsTrigger value="excel">Carga Excel</TabsTrigger>
        </TabsList>

        {/* ── Tab stock ─────────────────────────────────── */}
        <TabsContent value="stock" className="mt-4">
          <div className="rounded-2xl bg-white border border-stone-200/60 shadow-sm overflow-hidden"
            style={{ boxShadow: "0 1px 3px rgba(120,53,15,0.08)" }}>

            {/* Leyenda */}
            <div className="px-5 pt-4 pb-3 flex flex-wrap items-center gap-3 border-b border-stone-100">
              <div className="flex items-center gap-1.5 text-stone-500">
                <CalendarClock className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Días sin venta:</span>
              </div>
              {legendaItems.map((l) => (
                <span key={l.label} className="rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ background: l.bg, color: l.text }}>
                  {l.label}
                </span>
              ))}
            </div>

            {stockLoading ? (
              <div className="p-5 space-y-2">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-stone-50/60">
                    <TableHead className="text-stone-500">Producto</TableHead>
                    <TableHead className="text-stone-500">Código</TableHead>
                    <TableHead className="text-right text-stone-500">Precio sugerido</TableHead>
                    <TableHead className="text-right text-stone-500">Stock actual</TableHead>
                    <TableHead className="text-center text-stone-500">
                      <span className="flex items-center justify-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5" />
                        Días sin venta
                      </span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stock.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-stone-400 py-10">
                        Sin productos aprobados aún
                      </TableCell>
                    </TableRow>
                  ) : (
                    stock.map((p) => (
                      <TableRow key={p.producto_id} className="hover:bg-stone-50/60">
                        <TableCell className="font-medium text-stone-700">{p.nombre}</TableCell>
                        <TableCell className="font-mono text-sm text-stone-500">{p.codigo_barras}</TableCell>
                        <TableCell className="text-right text-stone-600">{fmoney(p.precio_venta_sugerido)}</TableCell>
                        <TableCell className="text-right font-bold text-stone-800">{p.stock_total.toLocaleString()}</TableCell>
                        <TableCell className="text-center">
                          <DiasSinVentaBadge dias={diasSinVenta[p.producto_id] ?? null} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* ── Tab individual ────────────────────────────── */}
        <TabsContent value="individual" className="mt-4">
          <div className="rounded-2xl bg-white border border-stone-200/60 p-5 shadow-sm"
            style={{ boxShadow: "0 1px 3px rgba(120,53,15,0.08)" }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
              <div className="sm:col-span-2">
                <Label className="text-stone-600">Producto *</Label>
                <Select value={productoSeleccionado} onValueChange={setProductoSeleccionado}>
                  <SelectTrigger><SelectValue placeholder="Selecciona un producto" /></SelectTrigger>
                  <SelectContent>
                    {stock.map((p) => (
                      <SelectItem key={p.producto_id} value={String(p.producto_id)}>
                        {p.nombre} ({p.codigo_barras})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-stone-600">Cantidad *</Label>
                <Input type="number" min={1} value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
              </div>
              <div>
                <Label className="text-stone-600">Costo unitario</Label>
                <Input type="number" min={0} value={costo} onChange={(e) => setCosto(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-stone-600">Almacén destino *</Label>
                <Select value={almacenId} onValueChange={setAlmacenId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar almacén" /></SelectTrigger>
                  <SelectContent>
                    {almacenes.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>{a.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="mt-4" onClick={enviarIngreso} disabled={sending}
              style={{ background: "#78350f", color: "#fff" }}>
              <Send className="h-4 w-4 mr-2" />
              {sending ? "Enviando…" : "Enviar para aprobación"}
            </Button>
          </div>
        </TabsContent>

        {/* ── Tab Excel ─────────────────────────────────── */}
        <TabsContent value="excel" className="mt-4 space-y-4">
          <div className="rounded-2xl bg-white border border-stone-200/60 p-5 shadow-sm space-y-4"
            style={{ boxShadow: "0 1px 3px rgba(120,53,15,0.08)" }}>
            <div className="flex gap-3 flex-wrap">
              <Button variant="outline" onClick={descargarPlantilla}
                className="border-stone-200 text-stone-700 hover:bg-stone-50">
                <Download className="h-4 w-4 mr-2" /> Descargar plantilla
              </Button>
              <Button variant="outline" onClick={() => fileRef.current?.click()}
                className="border-stone-200 text-stone-700 hover:bg-stone-50">
                <Upload className="h-4 w-4 mr-2" /> Cargar archivo Excel
              </Button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelFile} />
            </div>

            {excelFileName && (
              <p className="text-sm text-stone-500 flex items-center gap-1">
                <FileSpreadsheet className="h-4 w-4" /> {excelFileName}
              </p>
            )}
            {excelErrors.length > 0 && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 space-y-1">
                {excelErrors.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            )}
            {excelRows.length > 0 && (
              <>
                <p className="text-sm text-stone-500">{excelRows.length} registros listos para enviar</p>
                <Button onClick={enviarMasivo} disabled={excelSending}
                  style={{ background: "#78350f", color: "#fff" }}>
                  <Send className="h-4 w-4 mr-2" />
                  {excelSending ? "Enviando…" : `Confirmar envío (${excelRows.length})`}
                </Button>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Historial ──────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-stone-800">Historial de cargas</h2>
        <div className="rounded-2xl bg-white border border-stone-200/60 shadow-sm overflow-hidden"
          style={{ boxShadow: "0 1px 3px rgba(120,53,15,0.08)" }}>
          <Table>
            <TableHeader>
              <TableRow className="bg-stone-50/60">
                <TableHead className="text-stone-500">Fecha</TableHead>
                <TableHead className="text-stone-500">Producto</TableHead>
                <TableHead className="text-right text-stone-500">Cantidad</TableHead>
                <TableHead className="text-stone-500">Estado</TableHead>
                <TableHead className="text-stone-500">Motivo rechazo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historial.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-stone-400 py-8">
                    Sin solicitudes aún
                  </TableCell>
                </TableRow>
              ) : (
                historial.map((item) => (
                  <TableRow key={item.id} className="hover:bg-stone-50/60">
                    <TableCell className="text-sm text-stone-600">
                      {item.created_at ? format(new Date(item.created_at), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-stone-700">{item.producto_nombre ?? "—"}</TableCell>
                    <TableCell className="text-right text-stone-700">{item.cantidad}</TableCell>
                    <TableCell><EstadoBadge estado={item.estado} /></TableCell>
                    <TableCell className="text-sm text-stone-400">{item.motivo_rechazo ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
