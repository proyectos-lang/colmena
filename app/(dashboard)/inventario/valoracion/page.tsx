"use client"

import * as React from "react"
import {
  DollarSign,
  Package,
  Boxes,
  Warehouse,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingDown,
  CalendarClock,
  Download,
  Store,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Skeleton } from "@/components/ui/skeleton"
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useToast } from "@/hooks/use-toast"
import { getValoracionInventarioExtendida, getValoracionPorAlmacen, type ProductoValoracionExtendida } from "@/lib/services/inventario"
import { getAlmacenes, type Almacen } from "@/lib/services/catalogos"
import { getEmprendimientos, type Emprendimiento } from "@/lib/services/emprendimientos"
import { useAuth } from "@/lib/contexts/auth-context"
import * as XLSX from "xlsx"

type EstadoInventario = "todos" | "con_stock" | "sin_stock" | "stock_bajo"
type RotacionFiltro = "todos" | "sin_ventas" | "mas_30_dias" | "mas_60_dias" | "mas_90_dias"

export default function ValoracionPage() {
  const { toast } = useToast()
  const { user } = useAuth()
  const razonSocialId = user?.razon_social_id

  const [productos, setProductos] = React.useState<ProductoValoracionExtendida[]>([])
  const [almacenes, setAlmacenes] = React.useState<Almacen[]>([])
  const [emprendimientos, setEmprendimientos] = React.useState<Emprendimiento[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadingTable, setLoadingTable] = React.useState(false)
  const [searchTerm, setSearchTerm] = React.useState("")
  const [almacenFiltro, setAlmacenFiltro] = React.useState<string>("todos")
  const [estadoFiltro, setEstadoFiltro] = React.useState<EstadoInventario>("todos")
  const [rotacionFiltro, setRotacionFiltro] = React.useState<RotacionFiltro>("todos")
  const [emprendimientoFiltro, setEmprendimientoFiltro] = React.useState<string>("todos")
  const [expandedRows, setExpandedRows] = React.useState<Set<number>>(new Set())
  const [currentPage, setCurrentPage] = React.useState(1)
  const PAGE_SIZE = 100

  React.useEffect(() => {
    loadCatalogos()
  }, [razonSocialId])

  React.useEffect(() => {
    loadProductos()
  }, [almacenFiltro])

  async function loadCatalogos() {
    const [almacenesRes, empsData] = await Promise.all([
      getAlmacenes(),
      razonSocialId ? getEmprendimientos(razonSocialId) : Promise.resolve([]),
    ])
    setAlmacenes(almacenesRes.data)
    setEmprendimientos((empsData as Emprendimiento[]).filter((e) => e.activo !== false))
  }

  async function loadProductos() {
    if (!loading) setLoadingTable(true)

    const valoracionRes = almacenFiltro === "todos"
      ? await getValoracionInventarioExtendida()
      : await getValoracionPorAlmacen(parseInt(almacenFiltro))

    if (valoracionRes.error) {
      toast({ title: "Error", description: valoracionRes.error, variant: "destructive" })
    } else {
      setProductos(valoracionRes.data)
    }

    setLoading(false)
    setLoadingTable(false)
  }

  const productosFiltrados = React.useMemo(() => {
    return productos.filter((p) => {
      const matchesSearch =
        p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.codigo_barras?.toLowerCase().includes(searchTerm.toLowerCase())

      let matchesEstado = true
      if (estadoFiltro === "con_stock") matchesEstado = p.stock_total > 0
      if (estadoFiltro === "sin_stock") matchesEstado = p.stock_total === 0
      if (estadoFiltro === "stock_bajo") matchesEstado = p.stock_total > 0 && p.stock_total <= 10

      let matchesAlmacen = true
      if (almacenFiltro !== "todos") {
        matchesAlmacen = p.stock_por_almacen.some((s) => s.almacen_id === parseInt(almacenFiltro))
      }

      let matchesRotacion = true
      if (rotacionFiltro === "sin_ventas") matchesRotacion = p.dias_sin_venta === null && p.stock_total > 0
      if (rotacionFiltro === "mas_30_dias") matchesRotacion = p.dias_sin_venta !== null && p.dias_sin_venta >= 30
      if (rotacionFiltro === "mas_60_dias") matchesRotacion = p.dias_sin_venta !== null && p.dias_sin_venta >= 60
      if (rotacionFiltro === "mas_90_dias") matchesRotacion = p.dias_sin_venta !== null && p.dias_sin_venta >= 90

      let matchesEmprendimiento = true
      if (emprendimientoFiltro === "tienda") matchesEmprendimiento = !p.emprendimiento_id
      else if (emprendimientoFiltro !== "todos") matchesEmprendimiento = String(p.emprendimiento_id) === emprendimientoFiltro

      return matchesSearch && matchesEstado && matchesAlmacen && matchesRotacion && matchesEmprendimiento
    })
  }, [productos, searchTerm, estadoFiltro, almacenFiltro, rotacionFiltro, emprendimientoFiltro])

  const totales = React.useMemo(() => {
    const totalUnidades = productosFiltrados.reduce((acc, p) => acc + p.stock_total, 0)
    const valorComercial = productosFiltrados.reduce((acc, p) => acc + p.valor_comercial, 0)
    const productosConStock = productosFiltrados.filter((p) => p.stock_total > 0).length
    const productosSinStock = productosFiltrados.filter((p) => p.stock_total === 0).length
    const productosStockBajo = productosFiltrados.filter((p) => p.stock_total > 0 && p.stock_total <= 10).length
    const productosSinVentas = productosFiltrados.filter((p) => p.dias_sin_venta === null && p.stock_total > 0).length
    const productosMas30Dias = productosFiltrados.filter((p) => p.dias_sin_venta !== null && p.dias_sin_venta >= 30).length
    const productosMas60Dias = productosFiltrados.filter((p) => p.dias_sin_venta !== null && p.dias_sin_venta >= 60).length
    const productosMas90Dias = productosFiltrados.filter((p) => p.dias_sin_venta !== null && p.dias_sin_venta >= 90).length

    return {
      totalUnidades,
      valorComercial,
      productosConStock,
      productosSinStock,
      productosStockBajo,
      productosTotal: productosFiltrados.length,
      productosSinVentas,
      productosMas30Dias,
      productosMas60Dias,
      productosMas90Dias,
    }
  }, [productosFiltrados])

  const totalPages = Math.ceil(productosFiltrados.length / PAGE_SIZE)

  const productosPaginados = React.useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return productosFiltrados.slice(start, start + PAGE_SIZE)
  }, [productosFiltrados, currentPage])

  React.useEffect(() => { setCurrentPage(1) }, [searchTerm, estadoFiltro, almacenFiltro, rotacionFiltro, emprendimientoFiltro])

  function toggleRow(id: number) {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function formatCurrency(value: number): string {
    return `L ${value.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  function exportToExcel() {
    if (productosFiltrados.length === 0) {
      toast({ title: "Sin datos", description: "No hay productos para exportar", variant: "destructive" })
      return
    }

    const data = productosFiltrados.map((p) => ({
      Codigo: p.codigo_barras || "",
      Producto: p.nombre,
      Emprendimiento: p.emprendimiento_nombre ?? "Tienda propia",
      "Stock Total": p.stock_total,
      "Precio Venta": p.precio_venta,
      "Valor Comercial": p.valor_comercial,
      "Dias Sin Venta": p.dias_sin_venta ?? "Sin ventas",
      "Ultima Venta": p.ultima_venta ? new Date(p.ultima_venta).toLocaleDateString("es-HN") : "Nunca",
    }))

    data.push({
      Codigo: "",
      Producto: "TOTAL",
      Emprendimiento: "",
      "Stock Total": totales.totalUnidades,
      "Precio Venta": 0,
      "Valor Comercial": totales.valorComercial,
      "Dias Sin Venta": "",
      "Ultima Venta": "",
    })

    const ws = XLSX.utils.json_to_sheet(data)
    ws["!cols"] = [
      { wch: 16 }, { wch: 32 }, { wch: 22 }, { wch: 12 },
      { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 14 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Valoracion")
    XLSX.writeFile(wb, `Valoracion_Inventario_${new Date().toISOString().split("T")[0]}.xlsx`)
    toast({ title: "Exportado", description: "El archivo Excel se descargo correctamente" })
  }

  function getStockBadge(stock: number) {
    if (stock === 0) return <Badge variant="destructive" className="text-xs">Sin Stock</Badge>
    if (stock <= 10) return <Badge className="text-xs bg-amber-500 hover:bg-amber-600">Stock Bajo</Badge>
    return <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700">En Stock</Badge>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="space-y-6 bg-gradient-to-br from-amber-50/30 via-orange-50/20 to-stone-50/40 -m-4 md:-m-6 p-4 md:p-6 min-h-screen">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-stone-800">Valoracion de Inventario</h1>
          <p className="text-stone-600 mt-1">Analisis del patrimonio en existencias</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={almacenFiltro} onValueChange={setAlmacenFiltro}>
            <SelectTrigger className="w-52 bg-white/50 backdrop-blur-sm rounded-full border-stone-200 shadow-sm">
              <Warehouse className="h-4 w-4 mr-2 text-amber-700" />
              <SelectValue placeholder="Ver Almacen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los Almacenes</SelectItem>
              {almacenes.map((a) => (
                <SelectItem key={a.id} value={a.id!.toString()}>{a.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={exportToExcel} variant="outline" className="gap-2 bg-white/50 backdrop-blur-sm rounded-full border-stone-200 shadow-sm">
            <Download className="h-4 w-4" />
            Descargar Reporte
          </Button>
        </div>
      </div>

      {/* KPI Cards — solo unidades y valor comercial */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="relative overflow-hidden bg-white/70 backdrop-blur-sm border-[#abcde0] shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[#0D1821] flex items-center gap-2">
              <Boxes className="h-4 w-4" style={{ color: "#344966" }} />
              Total Unidades
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl md:text-4xl font-bold text-[#0D1821]">
              {totales.totalUnidades.toLocaleString()}
            </div>
            <p className="text-sm text-[#344966]/60 mt-1">En {totales.productosTotal} productos</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-[#BFCC94]/20 to-[#abcde0]/10 backdrop-blur-sm border-[#abcde0] shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[#0D1821] flex items-center gap-2">
              <DollarSign className="h-4 w-4" style={{ color: "#344966" }} />
              Valor Comercial Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl md:text-4xl font-bold text-[#0D1821]">
              {formatCurrency(totales.valorComercial)}
            </div>
            <p className="text-sm text-[#344966]/60 mt-1">A precio de venta sugerido</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card
          className={`cursor-pointer transition-all bg-white/70 backdrop-blur-sm border-[#344966] shadow-sm ${estadoFiltro === "todos" ? "ring-2 ring-[#344966]" : "hover:bg-[#abcde0]/10"}`}
          onClick={() => setEstadoFiltro("todos")}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: "#abcde0" }}>
              <Boxes className="h-5 w-5" style={{ color: "#344966" }} />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#0D1821]">{totales.productosTotal}</p>
              <p className="text-xs text-[#344966]">Total Productos</p>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all bg-white/70 backdrop-blur-sm border-[#344966] shadow-sm ${estadoFiltro === "con_stock" ? "ring-2 ring-green-500" : "hover:bg-green-50/30"}`}
          onClick={() => setEstadoFiltro("con_stock")}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{totales.productosConStock}</p>
              <p className="text-xs text-[#344966]">Con Stock</p>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all bg-white/70 backdrop-blur-sm border-[#344966] shadow-sm ${estadoFiltro === "stock_bajo" ? "ring-2 ring-[#BFCC94]" : "hover:bg-[#BFCC94]/10"}`}
          onClick={() => setEstadoFiltro("stock_bajo")}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: "#BFCC94" }}>
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600">{totales.productosStockBajo}</p>
              <p className="text-xs text-[#344966]">Stock Bajo</p>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all bg-white/70 backdrop-blur-sm border-[#344966] shadow-sm ${estadoFiltro === "sin_stock" ? "ring-2 ring-red-500" : "hover:bg-red-50/30"}`}
          onClick={() => setEstadoFiltro("sin_stock")}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{totales.productosSinStock}</p>
              <p className="text-xs text-[#344966]">Sin Stock</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rotation Analysis */}
      <Card className="border-[#344966] bg-gradient-to-br from-[#abcde0]/10 to-[#BFCC94]/10 backdrop-blur-sm shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2" style={{ color: "#344966" }}>
            <CalendarClock className="h-4 w-4" style={{ color: "#344966" }} />
            Analisis de Rotacion
          </CardTitle>
          <CardDescription style={{ color: "#344966" }}>Identifica productos sin movimiento de venta</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            {[
              { key: "sin_ventas", label: "Sin ventas registradas", count: totales.productosSinVentas, icon: XCircle, color: "red" },
              { key: "mas_30_dias", label: "Mas de 30 dias", count: totales.productosMas30Dias, icon: Clock, color: "orange" },
              { key: "mas_60_dias", label: "Mas de 60 dias", count: totales.productosMas60Dias, icon: TrendingDown, color: "amber" },
              { key: "mas_90_dias", label: "Mas de 90 dias", count: totales.productosMas90Dias, icon: AlertTriangle, color: "stone" },
            ].map(({ key, label, count, icon: Icon, color }) => (
              <div
                key={key}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  rotacionFiltro === key
                    ? `bg-${color}-100 border-${color}-300 ring-2 ring-${color}-200`
                    : `bg-white hover:bg-${color}-50 border-${color}-200`
                }`}
                onClick={() => setRotacionFiltro(rotacionFiltro === key ? "todos" : key as RotacionFiltro)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`h-4 w-4 text-${color}-600`} />
                  <span className={`text-2xl font-bold text-${color}-600`}>{count}</span>
                </div>
                <p className={`text-xs text-${color}-700`}>{label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detalle de Productos — ocupa todo el ancho */}
      <Card className="bg-white/70 backdrop-blur-sm border-stone-200 shadow-sm">
        <CardHeader className="border-b border-stone-200">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div className="flex items-start justify-between gap-3 flex-1">
              <div>
                <CardTitle className="text-lg">Detalle de Productos</CardTitle>
                <CardDescription>Existencias con desglose por almacen — {productosFiltrados.length} productos</CardDescription>
              </div>
              <Button
                onClick={exportToExcel}
                variant="outline"
                size="sm"
                className="gap-2 shrink-0"
                disabled={productosFiltrados.length === 0}
              >
                <Download className="h-4 w-4" />
                Descargar Excel
              </Button>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar producto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-full sm:w-56"
                />
              </div>

              {emprendimientos.length > 0 && (
                <Select value={emprendimientoFiltro} onValueChange={setEmprendimientoFiltro}>
                  <SelectTrigger className="w-52">
                    <Store className="h-4 w-4 mr-2 text-amber-700" />
                    <SelectValue placeholder="Emprendimiento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="tienda">Tienda propia</SelectItem>
                    {emprendimientos.map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>{e.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select value={estadoFiltro} onValueChange={(v) => setEstadoFiltro(v as EstadoInventario)}>
                <SelectTrigger className="w-40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="con_stock">Con Stock</SelectItem>
                  <SelectItem value="stock_bajo">Stock Bajo</SelectItem>
                  <SelectItem value="sin_stock">Sin Stock</SelectItem>
                </SelectContent>
              </Select>

              <Select value={rotacionFiltro} onValueChange={(v) => setRotacionFiltro(v as RotacionFiltro)}>
                <SelectTrigger className="w-44">
                  <CalendarClock className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Rotacion" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Toda Rotacion</SelectItem>
                  <SelectItem value="sin_ventas">Sin Ventas</SelectItem>
                  <SelectItem value="mas_30_dias">+30 dias</SelectItem>
                  <SelectItem value="mas_60_dias">+60 dias</SelectItem>
                  <SelectItem value="mas_90_dias">+90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loadingTable ? (
            <div className="p-4 md:p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex gap-3 p-3 border rounded-lg">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-40 flex-1" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-24" />
                </div>
              ))}
            </div>
          ) : productosFiltrados.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="inline-flex items-center justify-center p-4 rounded-full bg-amber-100/50 mb-4">
                <Package className="h-10 w-10 text-amber-600/70" />
              </div>
              <p className="text-lg font-medium text-stone-600 mb-2">No se encontraron existencias</p>
              <p className="text-sm text-stone-500 max-w-md mx-auto">
                {almacenFiltro !== "todos"
                  ? "No hay productos con stock en este almacen."
                  : "No hay productos que coincidan con los filtros seleccionados."}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile */}
              <div className="block lg:hidden divide-y overflow-y-auto max-h-[70vh]">
                {productosPaginados.map((p) => (
                  <Collapsible key={p.id}>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{p.nombre}</p>
                          <p className="text-xs text-muted-foreground font-mono">{p.codigo_barras || "-"}</p>
                          {p.emprendimiento_nombre && (
                            <p className="text-xs text-amber-700 mt-0.5">{p.emprendimiento_nombre}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {getStockBadge(p.stock_total)}
                          {p.dias_sin_venta === null ? (
                            p.stock_total > 0 && (
                              <Badge variant="outline" className="text-xs border-red-300 text-red-700 bg-red-50">
                                Sin ventas
                              </Badge>
                            )
                          ) : (
                            p.dias_sin_venta >= 30 && (
                              <Badge variant="outline" className={`text-xs ${
                                p.dias_sin_venta >= 90
                                  ? "border-stone-400 text-stone-700 bg-stone-100"
                                  : p.dias_sin_venta >= 60
                                  ? "border-amber-400 text-amber-700 bg-amber-50"
                                  : "border-orange-400 text-orange-700 bg-orange-50"
                              }`}>
                                {p.dias_sin_venta}d sin venta
                              </Badge>
                            )
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 text-sm mt-3">
                        <div>
                          <p className="text-muted-foreground text-xs">Stock</p>
                          <p className="font-bold">{p.stock_total}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Precio Venta</p>
                          <p className="font-medium">{formatCurrency(p.precio_venta)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Val. Comercial</p>
                          <p className="font-medium text-emerald-600">{formatCurrency(p.valor_comercial)}</p>
                        </div>
                      </div>

                      {p.stock_por_almacen.length > 0 && (
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="w-full mt-3 text-xs">
                            <Warehouse className="h-3 w-3 mr-1" />
                            Ver por almacen ({p.stock_por_almacen.length})
                            <ChevronDown className="h-3 w-3 ml-1" />
                          </Button>
                        </CollapsibleTrigger>
                      )}
                    </div>

                    <CollapsibleContent>
                      <div className="px-4 pb-4 space-y-2">
                        {p.stock_por_almacen.map((s, idx) => (
                          <div key={idx} className="p-3 rounded-lg bg-muted/50 text-sm">
                            <p className="font-medium mb-1">{s.almacen_nombre}</p>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <p className="text-muted-foreground">Stock</p>
                                <p className="font-medium">{s.stock}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Val. Comercial</p>
                                <p className="text-emerald-600">{formatCurrency(s.valor_comercial)}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto overflow-y-auto max-h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-amber-50/50">
                      <TableHead className="w-8" />
                      <TableHead>Codigo</TableHead>
                      <TableHead>Producto</TableHead>
                      {emprendimientos.length > 0 && <TableHead>Emprendimiento</TableHead>}
                      <TableHead className="text-center">Estado</TableHead>
                      <TableHead className="text-center">Rotacion</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="text-right">Precio Venta</TableHead>
                      <TableHead className="text-right">Val. Comercial</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingTable && [1, 2, 3, 4, 5].map((i) => (
                      <TableRow key={i}>
                        {[...Array(emprendimientos.length > 0 ? 9 : 8)].map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))}

                    {!loadingTable && productosPaginados.map((p) => (
                      <React.Fragment key={p.id}>
                        <TableRow
                          className={`cursor-pointer hover:bg-orange-50/30 transition-colors ${expandedRows.has(p.id) ? "bg-amber-50/40" : ""}`}
                          onClick={() => p.stock_por_almacen.length > 0 && toggleRow(p.id)}
                        >
                          <TableCell className="w-8">
                            {p.stock_por_almacen.length > 0 && (
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                {expandedRows.has(p.id) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{p.codigo_barras || "-"}</TableCell>
                          <TableCell className="font-medium">{p.nombre}</TableCell>
                          {emprendimientos.length > 0 && (
                            <TableCell className="text-sm text-amber-800">
                              {p.emprendimiento_nombre ?? <span className="text-muted-foreground">Tienda propia</span>}
                            </TableCell>
                          )}
                          <TableCell className="text-center">{getStockBadge(p.stock_total)}</TableCell>
                          <TableCell className="text-center">
                            {p.dias_sin_venta === null ? (
                              p.stock_total > 0 ? (
                                <Badge variant="outline" className="text-xs border-red-300 text-red-700 bg-red-50">Sin ventas</Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )
                            ) : p.dias_sin_venta >= 90 ? (
                              <Badge variant="outline" className="text-xs border-stone-400 text-stone-700 bg-stone-100">{p.dias_sin_venta}d</Badge>
                            ) : p.dias_sin_venta >= 60 ? (
                              <Badge variant="outline" className="text-xs border-amber-400 text-amber-700 bg-amber-50">{p.dias_sin_venta}d</Badge>
                            ) : p.dias_sin_venta >= 30 ? (
                              <Badge variant="outline" className="text-xs border-orange-400 text-orange-700 bg-orange-50">{p.dias_sin_venta}d</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs border-emerald-400 text-emerald-700 bg-emerald-50">{p.dias_sin_venta}d</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono">{p.stock_total}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(p.precio_venta)}</TableCell>
                          <TableCell className="text-right font-mono font-medium text-emerald-600">{formatCurrency(p.valor_comercial)}</TableCell>
                        </TableRow>

                        {expandedRows.has(p.id) && p.stock_por_almacen.length > 0 && (
                          <TableRow className="bg-muted/20">
                            <TableCell colSpan={emprendimientos.length > 0 ? 9 : 8} className="py-3">
                              <div className="pl-10 pr-4">
                                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                  <Warehouse className="h-3 w-3" />
                                  Distribucion por Almacen
                                </p>
                                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                                  {p.stock_por_almacen.map((s, idx) => (
                                    <div key={idx} className="p-3 rounded-lg bg-background border text-sm">
                                      <p className="font-medium mb-2">{s.almacen_nombre}</p>
                                      <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div>
                                          <p className="text-muted-foreground">Stock</p>
                                          <p className="font-medium">{s.stock}</p>
                                        </div>
                                        <div>
                                          <p className="text-muted-foreground">Val. Comercial</p>
                                          <p className="font-medium text-emerald-600">{formatCurrency(s.valor_comercial)}</p>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Footer: totales + paginación */}
              <div className="p-4 md:p-6 border-t bg-muted/20 space-y-3">
                {/* Paginación */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Página {currentPage} de {totalPages} · mostrando {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, productosFiltrados.length)} de {productosFiltrados.length}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Siguiente
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* Totales */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Boxes className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {productosFiltrados.length} productos · {totales.totalUnidades.toLocaleString()} unidades
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Valor Comercial Total</p>
                    <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totales.valorComercial)}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
