"use client"

import * as React from "react"
import { Package, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, FileSpreadsheet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { getProductos, getAlmacenes, getLocalizaciones, type Producto, type Almacen, type Localizacion } from "@/lib/services/catalogos"
import { getAllTransacciones, type TransaccionInventario } from "@/lib/services/inventario"
import * as XLSX from "xlsx"

export default function KardexPage() {
  const { toast } = useToast()
  
  // Catalogos
  const [productos, setProductos] = React.useState<Producto[]>([])
  const [almacenes, setAlmacenes] = React.useState<Almacen[]>([])
  const [localizaciones, setLocalizaciones] = React.useState<Localizacion[]>([])
  
  // Data
  const [transacciones, setTransacciones] = React.useState<TransaccionInventario[]>([])
  const [loading, setLoading] = React.useState(true)

  // Filters
  const [filtroFechaInicio, setFiltroFechaInicio] = React.useState("")
  const [filtroFechaFin, setFiltroFechaFin] = React.useState("")
  const [filtroProductoId, setFiltroProductoId] = React.useState("")
  const [filtroAlmacenId, setFiltroAlmacenId] = React.useState("")
  const [filtroLocalizacionId, setFiltroLocalizacionId] = React.useState("")
  const [filtroTipoMovimiento, setFiltroTipoMovimiento] = React.useState("")

  React.useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [prodRes, almRes, locRes, transRes] = await Promise.all([
      getProductos(),
      getAlmacenes(),
      getLocalizaciones(),
      getAllTransacciones()
    ])
    
    if (prodRes.error) toast({ title: "Error", description: prodRes.error, variant: "destructive" })
    else setProductos(prodRes.data)
    
    if (!almRes.error) setAlmacenes(almRes.data)
    if (!locRes.error) setLocalizaciones(locRes.data)
    
    if (transRes.error) toast({ title: "Error", description: transRes.error, variant: "destructive" })
    else setTransacciones(transRes.data)
    
    setLoading(false)
  }

  // Filter localizaciones by selected almacen
  const localizacionesFiltradas = React.useMemo(() => {
    if (!filtroAlmacenId) return localizaciones
    return localizaciones.filter(l => l.almacen_id === parseInt(filtroAlmacenId))
  }, [localizaciones, filtroAlmacenId])

  // Apply filters to transactions
  const transaccionesFiltradas = React.useMemo(() => {
    return transacciones.filter(t => {
      const fecha = t.fecha?.split('T')[0] || ""
      const matchFechaInicio = !filtroFechaInicio || fecha >= filtroFechaInicio
      const matchFechaFin = !filtroFechaFin || fecha <= filtroFechaFin
      const matchProducto = !filtroProductoId || t.producto_id === parseInt(filtroProductoId)
      const matchAlmacen = !filtroAlmacenId || t.almacen_id === parseInt(filtroAlmacenId)
      const matchLocalizacion = !filtroLocalizacionId || t.localizacion_id === parseInt(filtroLocalizacionId)
      const matchTipo = !filtroTipoMovimiento || t.tipo_movimiento === filtroTipoMovimiento
      
      return matchFechaInicio && matchFechaFin && matchProducto && matchAlmacen && matchLocalizacion && matchTipo
    })
  }, [transacciones, filtroFechaInicio, filtroFechaFin, filtroProductoId, filtroAlmacenId, filtroLocalizacionId, filtroTipoMovimiento])

  function getTipoMovimientoBadge(tipo: string) {
    switch (tipo) {
      case 'Entrada Compra':
        return <Badge className="bg-green-500 hover:bg-green-600"><ArrowDownCircle className="h-3 w-3 mr-1" />Entrada Compra</Badge>
      case 'Salida Venta':
        return <Badge className="bg-red-500 hover:bg-red-600"><ArrowUpCircle className="h-3 w-3 mr-1" />Salida Venta</Badge>
      case 'Traslado Entrada':
        return <Badge className="bg-blue-500 hover:bg-blue-600"><ArrowLeftRight className="h-3 w-3 mr-1" />Traslado Entrada</Badge>
      case 'Traslado Salida':
        return <Badge className="bg-orange-500 hover:bg-orange-600"><ArrowLeftRight className="h-3 w-3 mr-1" />Traslado Salida</Badge>
      case 'Ajuste':
        return <Badge variant="outline"><Package className="h-3 w-3 mr-1" />Ajuste</Badge>
      default:
        return <Badge variant="secondary">{tipo}</Badge>
    }
  }

  function exportToExcel() {
    if (transaccionesFiltradas.length === 0) {
      toast({ title: "Sin datos", description: "No hay transacciones para exportar", variant: "destructive" })
      return
    }

    const data = transaccionesFiltradas.map(t => ({
      Fecha: t.fecha?.split('T')[0] || '',
      Hora: t.fecha?.split('T')[1]?.substring(0, 8) || '',
      Producto: t.producto_nombre || '',
      Codigo: t.producto_codigo || '',
      'Tipo Movimiento': t.tipo_movimiento,
      Almacen: t.almacen_nombre || '',
      Localizacion: t.localizacion_nombre || '',
      Cantidad: t.cantidad,
      'Costo/Precio': t.costo_o_precio_unitario
    }))

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, "Transacciones")
  
  const filename = `Historial_Transacciones_${new Date().toISOString().split('T')[0]}.xlsx`
    XLSX.writeFile(wb, filename)
    
    toast({ title: "Exportado", description: "El archivo Excel se descargo correctamente" })
  }

  function clearFilters() {
    setFiltroFechaInicio("")
    setFiltroFechaFin("")
    setFiltroProductoId("")
    setFiltroAlmacenId("")
    setFiltroLocalizacionId("")
    setFiltroTipoMovimiento("")
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
<h1 className="text-xl md:text-2xl font-bold tracking-tight">Historial de Transacciones</h1>
<p className="text-sm md:text-base text-muted-foreground">Movimientos de inventario</p>
        </div>
        <Button onClick={exportToExcel} className="gap-2 w-full sm:w-auto" disabled={transaccionesFiltradas.length === 0}>
          <FileSpreadsheet className="h-4 w-4" />
          <span>Exportar Excel</span>
        </Button>
      </div>

      {/* Filters and Table */}
      <Card className="rounded-2xl shadow-sm border border-stone-200">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-lg">Movimientos</CardTitle>
          <CardDescription>
            {transaccionesFiltradas.length} movimiento(s) {transaccionesFiltradas.length !== transacciones.length && `de ${transacciones.length} total`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0 space-y-4">
          {/* Filters */}
          <div className="p-4 bg-stone-50 rounded-lg border border-stone-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
              {/* Fecha Inicio */}
              <div>
                <Label className="text-xs text-stone-600 mb-1.5 block">Fecha Inicio</Label>
                <Input
                  type="date"
                  value={filtroFechaInicio}
                  onChange={e => setFiltroFechaInicio(e.target.value)}
                  className="bg-white border-stone-200"
                />
              </div>

              {/* Fecha Fin */}
              <div>
                <Label className="text-xs text-stone-600 mb-1.5 block">Fecha Fin</Label>
                <Input
                  type="date"
                  value={filtroFechaFin}
                  onChange={e => setFiltroFechaFin(e.target.value)}
                  className="bg-white border-stone-200"
                />
              </div>

              {/* Producto */}
              <div>
                <Label className="text-xs text-stone-600 mb-1.5 block">Producto</Label>
                <Select 
                  value={filtroProductoId || "all"} 
                  onValueChange={(v) => setFiltroProductoId(v === "all" ? "" : v)}
                >
                  <SelectTrigger className="bg-white border-stone-200">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los productos</SelectItem>
                    {productos.map(p => (
                      <SelectItem key={p.id} value={p.id!.toString()}>
                        {p.codigo_barras ? `[${p.codigo_barras}] ` : ''}{p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tipo Movimiento */}
              <div>
                <Label className="text-xs text-stone-600 mb-1.5 block">Tipo Movimiento</Label>
                <Select 
                  value={filtroTipoMovimiento || "all"} 
                  onValueChange={(v) => setFiltroTipoMovimiento(v === "all" ? "" : v)}
                >
                  <SelectTrigger className="bg-white border-stone-200">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="Ingreso Manual">Ingreso Manual</SelectItem>
                    <SelectItem value="Salida Manual">Salida Manual</SelectItem>
                    <SelectItem value="Salida Venta">Salida Venta</SelectItem>
                    <SelectItem value="Traslado Entrada">Traslado Entrada</SelectItem>
                    <SelectItem value="Traslado Salida">Traslado Salida</SelectItem>
                    <SelectItem value="Ajuste">Ajuste</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
              {/* Almacen */}
              <div>
                <Label className="text-xs text-stone-600 mb-1.5 block">Almacen</Label>
                <Select 
                  value={filtroAlmacenId || "all"} 
                  onValueChange={(v) => {
                    setFiltroAlmacenId(v === "all" ? "" : v)
                    setFiltroLocalizacionId("")
                  }}
                >
                  <SelectTrigger className="bg-white border-stone-200">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los almacenes</SelectItem>
                    {almacenes.map(a => (
                      <SelectItem key={a.id} value={a.id!.toString()}>
                        {a.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Localizacion */}
              <div>
                <Label className="text-xs text-stone-600 mb-1.5 block">Localizacion</Label>
                <Select 
                  value={filtroLocalizacionId || "all"} 
                  onValueChange={(v) => setFiltroLocalizacionId(v === "all" ? "" : v)}
                  disabled={!filtroAlmacenId}
                >
                  <SelectTrigger className="bg-white border-stone-200">
                    <SelectValue placeholder={filtroAlmacenId ? "Todas" : "Seleccione almacen"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las localizaciones</SelectItem>
                    {localizacionesFiltradas.map(l => (
                      <SelectItem key={l.id} value={l.id!.toString()}>
                        {l.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Spacer */}
              <div className="hidden lg:block" />

              {/* Limpiar */}
              <Button
                variant="outline"
                className="border-stone-200 bg-white hover:bg-stone-100"
                onClick={clearFilters}
              >
                Limpiar Filtros
              </Button>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : transaccionesFiltradas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay movimientos {transacciones.length > 0 ? "con los filtros seleccionados" : "registrados"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-stone-50">
                    <TableHead className="font-semibold">Fecha</TableHead>
                    <TableHead className="font-semibold">Producto</TableHead>
                    <TableHead className="font-semibold">Tipo Movimiento</TableHead>
                    <TableHead className="font-semibold">Almacen</TableHead>
                    <TableHead className="font-semibold">Localizacion</TableHead>
                    <TableHead className="font-semibold text-right">Cantidad</TableHead>
                    <TableHead className="font-semibold text-right">Costo/Precio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transaccionesFiltradas.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="whitespace-nowrap">
                        <div>
                          <p className="font-medium">{t.fecha?.split('T')[0]}</p>
                          <p className="text-xs text-muted-foreground">{t.fecha?.split('T')[1]?.substring(0, 8)}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{t.producto_nombre || '-'}</p>
                          <p className="text-xs text-muted-foreground font-mono">{t.producto_codigo || ''}</p>
                        </div>
                      </TableCell>
                      <TableCell>{getTipoMovimientoBadge(t.tipo_movimiento)}</TableCell>
                      <TableCell>{t.almacen_nombre || '-'}</TableCell>
                      <TableCell>{t.localizacion_nombre || '-'}</TableCell>
                      <TableCell className={`text-right font-mono ${t.cantidad >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {t.cantidad >= 0 ? '+' : ''}{t.cantidad}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        L {(t.costo_o_precio_unitario || 0).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
