"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Receipt, 
  Users, 
  Package,
  Warehouse,
  BarChart3,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Crown,
  ShoppingCart,
  Percent,
  Calendar,
  RefreshCw,
  Banknote,
  CreditCard
} from "lucide-react"
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts"
import { getVentasDashboard, type VentasDashboardData } from "@/lib/services/ventas"
import { getPagosResumen, type PagosResumen } from "@/lib/services/ventas-analytics"


function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL' }).format(value)
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-HN').format(value)
}

// Alias: formatCompact ya no abrevia; siempre muestra el numero completo.
// Se mantiene el nombre para no tener que reemplazar cada llamada.
function formatCompact(value: number): string {
  return formatCurrency(value)
}

const CHART_COLORS = ['#78716c', '#a8a29e', '#d6d3d1', '#e7e5e4', '#fafaf9']
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export default function VentasDashboardPage() {
  const { toast } = useToast()
  const [data, setData] = React.useState<VentasDashboardData | null>(null)
  // `pagos` alimenta dos KPIs ("Ventas Netas" descontando comisiones y
  // "Comisiones Pagadas"). La tarjeta grande de Ingresos por Metodo de
  // Pago se elimino, pero estas metricas se mantienen.
  const [pagos, setPagos] = React.useState<PagosResumen | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [anioFiltro, setAnioFiltro] = React.useState<string>("todos")
  const [mesFiltro, setMesFiltro] = React.useState<string>("todos")
  const [refreshing, setRefreshing] = React.useState(false)

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  async function loadData() {
    setLoading(true)
    try {
      const anio = anioFiltro !== "todos" ? parseInt(anioFiltro) : undefined
      const mes = mesFiltro !== "todos" ? parseInt(mesFiltro) : undefined

      // Ambos servicios consultan la misma ventana temporal y razon_social.
      const [dashRes, pagosRes] = await Promise.all([
        getVentasDashboard(anio, mes),
        getPagosResumen(anio, mes),
      ])

      if (dashRes.error) throw new Error(dashRes.error)
      setData(dashRes.data)
      setPagos(pagosRes.data)
    } catch (err) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos del dashboard",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  React.useEffect(() => {
    loadData()
  }, [anioFiltro, mesFiltro])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    )
  }

  const crecimientoPositivo = (data?.crecimientoMensual || 0) >= 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-800">Dashboard de Ventas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Analisis comercial y metricas de rendimiento
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <Select value={anioFiltro} onValueChange={(v) => { setAnioFiltro(v); if (v === "todos") setMesFiltro("todos") }}>
            <SelectTrigger className="w-32">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Anio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {years.map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select 
            value={mesFiltro} 
            onValueChange={setMesFiltro}
            disabled={anioFiltro === "todos"}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Mes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todo el anio</SelectItem>
              {MESES.map((m, i) => (
                <SelectItem key={i} value={(i + 1).toString()}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Main KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Ventas Totales: Bruta vs Neta */}
        {/*
          Bruta = lo facturado al cliente (data.ventasTotales).
          Neta  = bruta - comisiones bancarias (pagos.totalComisiones).
          Si la migracion 011 esta pendiente (featurePending) Neta == Bruta y
          comisiones = 0, asi que la UI se degrada elegantemente.
        */}
        <Card className="bg-gradient-to-br from-stone-800 to-stone-900 text-white border-0">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-stone-300">Ventas Totales</CardDescription>
              <DollarSign className="h-5 w-5 text-stone-400" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-stone-400">Bruta</p>
              <p className="text-2xl font-bold leading-tight">{formatCompact(data?.ventasTotales || 0)}</p>
            </div>
            <div className="border-t border-stone-700 pt-2">
              <p className="text-[10px] uppercase tracking-wider text-emerald-300/80">Neta</p>
              <p className="text-xl font-semibold leading-tight text-emerald-300">
                {formatCompact(
                  pagos && pagos.totalBruto > 0
                    ? (data?.ventasTotales || 0) - pagos.totalComisiones
                    : (data?.ventasTotales || 0)
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {crecimientoPositivo ? (
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 gap-1">
                  <ArrowUpRight className="h-3 w-3" />
                  {data?.crecimientoMensual.toFixed(1)}%
                </Badge>
              ) : (
                <Badge className="bg-red-500/20 text-red-300 border-red-500/30 gap-1">
                  <ArrowDownRight className="h-3 w-3" />
                  {Math.abs(data?.crecimientoMensual || 0).toFixed(1)}%
                </Badge>
              )}
              <span className="text-xs text-stone-400">vs mes anterior</span>
            </div>
          </CardContent>
        </Card>

        {/* Ganancia Bruta */}
        <Card className="bg-gradient-to-br from-emerald-600 to-emerald-700 text-white border-0">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-emerald-100">Ganancia Bruta</CardDescription>
              <TrendingUp className="h-5 w-5 text-emerald-200" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCompact(data?.gananciaBruta || 0)}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge className="bg-white/20 text-white border-white/30">
                {data?.margenPromedio.toFixed(1)}% margen
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Facturas */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Facturas Emitidas</CardDescription>
              <Receipt className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-stone-800">{formatNumber(data?.cantidadFacturas || 0)}</p>
            <p className="text-sm text-muted-foreground mt-2">
              Ticket promedio: <span className="font-medium text-stone-700">{formatCurrency(data?.ticketPromedio || 0)}</span>
            </p>
          </CardContent>
        </Card>

        {/* Unidades */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Unidades Vendidas</CardDescription>
              <Package className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-stone-800">{formatNumber(data?.unidadesVendidas || 0)}</p>
            <p className="text-sm text-muted-foreground mt-2">
              <span className="font-medium text-stone-700">{data?.productosVendidos}</span> productos diferentes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Clientes Activos</p>
                <p className="text-2xl font-bold">{data?.clientesActivos || 0}</p>
              </div>
              <Users className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        {/*
          Total Comisiones Pagadas: suma de (monto_bruto - monto_neto) de
          ventas_pagos_detalle en el periodo seleccionado. Es el "costo" oculto
          que se le paga a la red bancaria por cobrar con tarjeta/link.
        */}
        <Card className="border-l-4 border-l-rose-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Comisiones Pagadas</p>
                <p className="text-2xl font-bold text-rose-700">
                  {formatCompact(pagos?.totalComisiones || 0)}
                </p>
                {pagos && pagos.totalBruto > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {((pagos.totalComisiones / pagos.totalBruto) * 100).toFixed(2)}% sobre bruto
                  </p>
                )}
                {pagos?.featurePending && (
                  <p className="text-xs text-amber-600 mt-0.5">Pendiente migracion 011</p>
                )}
              </div>
              <CreditCard className="h-8 w-8 text-rose-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ventas Este Mes</p>
                <p className="text-2xl font-bold">{formatCompact(data?.ventasMesActual || 0)}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Margen Promedio</p>
                <p className="text-2xl font-bold">{data?.margenPromedio.toFixed(1)}%</p>
              </div>
              <Percent className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Ventas por Mes - Area Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Tendencia de Ventas
            </CardTitle>
            <CardDescription>Ventas y ganancia mensual</CardDescription>
          </CardHeader>
          <CardContent>
            {(data?.ventasPorMes || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={data?.ventasPorMes}>
                  <defs>
                    <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#78716c" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#78716c" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorGanancia" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis dataKey="mes" tick={{ fill: '#78716c', fontSize: 12 }} />
                  <YAxis 
                    tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} 
                    tick={{ fill: '#78716c', fontSize: 12 }}
                  />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ backgroundColor: '#fafaf9', borderColor: '#e7e5e4' }}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="ventas" 
                    name="Ventas"
                    stroke="#78716c" 
                    fillOpacity={1} 
                    fill="url(#colorVentas)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="ganancia" 
                    name="Ganancia"
                    stroke="#10b981" 
                    fillOpacity={1} 
                    fill="url(#colorGanancia)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                No hay datos para mostrar
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ventas por Anio - Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Comparativa Anual
            </CardTitle>
            <CardDescription>Ventas totales por año</CardDescription>
          </CardHeader>
          <CardContent>
            {(data?.ventasPorAnio || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data?.ventasPorAnio}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis dataKey="anio" tick={{ fill: '#78716c', fontSize: 12 }} />
                  <YAxis 
                    tickFormatter={(v) => `${(v/1000).toFixed(0)}K`}
                    tick={{ fill: '#78716c', fontSize: 12 }}
                  />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ backgroundColor: '#fafaf9', borderColor: '#e7e5e4' }}
                  />
                  <Legend />
                  <Bar dataKey="ventas" name="Ventas" fill="#78716c" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="ganancia" name="Ganancia" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                No hay datos para mostrar
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rankings Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Top Clientes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-500" />
              Top 10 Clientes
            </CardTitle>
            <CardDescription>Clientes con mayores ventas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.topClientes || []).length > 0 ? (
              data?.topClientes.slice(0, 5).map((cliente, index) => {
                const maxVentas = data.topClientes[0].ventas
                const percentage = (cliente.ventas / maxVentas) * 100
                
                return (
                  <div key={cliente.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-amber-100 text-amber-700' :
                          index === 1 ? 'bg-stone-200 text-stone-700' :
                          index === 2 ? 'bg-orange-100 text-orange-700' :
                          'bg-stone-100 text-stone-600'
                        }`}>
                          {index + 1}
                        </span>
                        <span className="font-medium text-sm truncate max-w-[120px]">{cliente.nombre}</span>
                      </div>
                      <span className="text-sm font-semibold">{formatCompact(cliente.ventas)}</span>
                    </div>
                    <Progress value={percentage} className="h-1.5" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{cliente.facturas} facturas</span>
                      <span className="text-emerald-600">+{formatCompact(cliente.ganancia)}</span>
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Sin datos</p>
            )}
          </CardContent>
        </Card>

        {/* Top Productos */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-blue-500" />
              Top 10 Productos
            </CardTitle>
            <CardDescription>Productos mas vendidos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.topProductos || []).length > 0 ? (
              data?.topProductos.slice(0, 5).map((producto, index) => {
                const maxVentas = data.topProductos[0].ventas
                const percentage = (producto.ventas / maxVentas) * 100
                
                return (
                  <div key={producto.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-blue-100 text-blue-700' :
                          index === 1 ? 'bg-stone-200 text-stone-700' :
                          index === 2 ? 'bg-sky-100 text-sky-700' :
                          'bg-stone-100 text-stone-600'
                        }`}>
                          {index + 1}
                        </span>
                        <span className="font-medium text-sm truncate max-w-[120px]">{producto.nombre}</span>
                      </div>
                      <span className="text-sm font-semibold">{formatCompact(producto.ventas)}</span>
                    </div>
                    <Progress value={percentage} className="h-1.5" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatNumber(producto.cantidad)} uds</span>
                      <span className="text-emerald-600">+{formatCompact(producto.ganancia)}</span>
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Sin datos</p>
            )}
          </CardContent>
        </Card>

        {/* Top Almacenes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Warehouse className="h-4 w-4 text-purple-500" />
              Ventas por Emprendedor
            </CardTitle>
            <CardDescription>Distribución de ventas por emprendedor</CardDescription>
          </CardHeader>
          <CardContent>
            {(data?.topAlmacenes || []).length > 0 ? (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie
                      data={data?.topAlmacenes}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={55}
                      paddingAngle={3}
                      dataKey="ventas"
                      nameKey="nombre"
                    >
                      {data?.topAlmacenes.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
                
                <div className="space-y-2">
                  {data?.topAlmacenes.map((almacen, index) => (
                    <div key={almacen.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                        />
                        <span className="text-sm">{almacen.nombre}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{formatCompact(almacen.ventas)}</p>
                        <p className="text-xs text-muted-foreground">{almacen.facturas} facturas</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Sin datos</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Performance Indicators */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Indicadores de Rendimiento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="text-center p-4 rounded-lg bg-stone-50">
              <p className="text-3xl font-bold text-stone-800">
                {formatCurrency(data?.ticketPromedio || 0)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Ticket Promedio</p>
              <p className="text-xs text-muted-foreground">por factura</p>
            </div>
            
            <div className="text-center p-4 rounded-lg bg-emerald-50">
              <p className="text-3xl font-bold text-emerald-700">
                {data?.margenPromedio.toFixed(1)}%
              </p>
              <p className="text-sm text-muted-foreground mt-1">Margen Bruto</p>
              <p className="text-xs text-muted-foreground">promedio</p>
            </div>
            
            <div className="text-center p-4 rounded-lg bg-blue-50">
              <p className="text-3xl font-bold text-blue-700">
                {data?.cantidadFacturas && data?.clientesActivos 
                  ? (data.cantidadFacturas / data.clientesActivos).toFixed(1)
                  : '0'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Facturas/Cliente</p>
              <p className="text-xs text-muted-foreground">frecuencia de compra</p>
            </div>
            
            <div className="text-center p-4 rounded-lg bg-amber-50">
              <p className="text-3xl font-bold text-amber-700">
                {data?.unidadesVendidas && data?.cantidadFacturas
                  ? (data.unidadesVendidas / data.cantidadFacturas).toFixed(1)
                  : '0'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Uds/Factura</p>
              <p className="text-xs text-muted-foreground">items promedio</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
