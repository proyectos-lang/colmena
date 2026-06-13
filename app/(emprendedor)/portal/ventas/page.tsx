"use client"

import * as React from "react"
import { useEmprendedorAuth } from "@/lib/contexts/emprendedor-auth-context"
import { getVentasByEmprendimiento, type VentaEmprendedor } from "@/lib/services/ventas"
import { Button } from "@/components/ui/button"
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import { Download, DollarSign, Package, ShoppingBag, TrendingUp } from "lucide-react"
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns"
import { es } from "date-fns/locale"
import * as XLSX from "xlsx"
import { Skeleton } from "@/components/ui/skeleton"

type Periodo = "este_mes" | "mes_pasado" | "personalizado"

function fmoney(n: number) {
  return "L " + new Intl.NumberFormat("es-HN", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

/* ─── Tooltip personalizado ─── */
function TooltipDia({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl px-3 py-2 shadow-md text-sm"
      style={{ background: "#fff", border: "1px solid rgba(212,165,116,0.3)", boxShadow: "0 4px 16px rgba(120,53,15,0.1)" }}>
      <p className="text-stone-400 text-xs mb-0.5">{label}</p>
      <p className="font-bold text-stone-800">{fmoney(payload[0].value)}</p>
    </div>
  )
}

function TooltipProducto({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl px-3 py-2.5 shadow-md text-sm"
      style={{ background: "#fff", border: "1px solid rgba(212,165,116,0.3)", boxShadow: "0 4px 16px rgba(120,53,15,0.1)" }}>
      <p className="font-medium text-stone-700 mb-1 max-w-[180px] text-xs">{label}</p>
      <p className="font-bold text-stone-800">{fmoney(payload[0].value)}</p>
      {payload[1] && (
        <p className="text-stone-500 text-xs">{payload[1].value} unidades</p>
      )}
    </div>
  )
}

/* Paleta de barras por rango */
const BAR_COLORS = [
  "#C07A5C", "#D4A574", "#A1887F", "#7C9A92", "#BFCC94",
  "#c2793e", "#b8956a", "#8d7b72", "#6b8f87", "#a8b882",
]

export default function VentasEmprendedorPage() {
  const { emprendedor } = useEmprendedorAuth()
  const [periodo, setPeriodo] = React.useState<Periodo>("este_mes")
  const [desde, setDesde] = React.useState(format(startOfMonth(new Date()), "yyyy-MM-dd"))
  const [hasta, setHasta] = React.useState(format(endOfMonth(new Date()), "yyyy-MM-dd"))
  const [ventas, setVentas] = React.useState<VentaEmprendedor[]>([])
  const [loading, setLoading] = React.useState(true)

  const aplicarPeriodo = React.useCallback((p: Periodo) => {
    const hoy = new Date()
    if (p === "este_mes") {
      setDesde(format(startOfMonth(hoy), "yyyy-MM-dd"))
      setHasta(format(endOfMonth(hoy), "yyyy-MM-dd"))
    } else if (p === "mes_pasado") {
      const mes = subMonths(hoy, 1)
      setDesde(format(startOfMonth(mes), "yyyy-MM-dd"))
      setHasta(format(endOfMonth(mes), "yyyy-MM-dd"))
    }
  }, [])

  React.useEffect(() => { aplicarPeriodo(periodo) }, [periodo, aplicarPeriodo])

  React.useEffect(() => {
    if (!emprendedor || !desde || !hasta) return
    setLoading(true)
    getVentasByEmprendimiento(emprendedor.emprendimientoId, desde + "T00:00:00", hasta + "T23:59:59")
      .then((data) => { setVentas(data); setLoading(false) })
  }, [emprendedor, desde, hasta])

  /* ─── Datos derivados ─── */
  const totalVendido = ventas.reduce((s, v) => s + v.subtotal, 0)
  const unidadesVendidas = ventas.reduce((s, v) => s + v.cantidad, 0)
  const productosDistintos = new Set(ventas.map((v) => v.producto_id)).size

  const ventasPorDia = React.useMemo(() => {
    const map: Record<string, number> = {}
    ventas.forEach((v) => {
      const dia = format(new Date(v.fecha_venta), "dd/MM")
      map[dia] = (map[dia] ?? 0) + v.subtotal
    })
    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([fecha, total]) => ({ fecha, total }))
  }, [ventas])

  const ventasPorProducto = React.useMemo(() => {
    const map: Record<number, { nombre: string; total: number; cantidad: number }> = {}
    ventas.forEach((v) => {
      if (!map[v.producto_id]) map[v.producto_id] = { nombre: v.producto_nombre, total: 0, cantidad: 0 }
      map[v.producto_id].total    += v.subtotal
      map[v.producto_id].cantidad += v.cantidad
    })
    return Object.values(map)
      .sort((a, b) => b.total - a.total)
      .slice(0, 12)
      .map((p) => ({
        ...p,
        nombreCorto: p.nombre.length > 22 ? p.nombre.slice(0, 22) + "…" : p.nombre,
      }))
  }, [ventas])

  const exportarExcel = () => {
    const rows = ventas.map((v) => ({
      Fecha: format(new Date(v.fecha_venta), "dd/MM/yyyy HH:mm"),
      Factura: v.numero_factura,
      Producto: v.producto_nombre,
      Codigo: v.codigo_barras,
      Cantidad: v.cantidad,
      "Precio Unitario": v.precio_unitario,
      Subtotal: v.subtotal,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Ventas")
    XLSX.writeFile(wb, `ventas_${desde}_${hasta}.xlsx`)
  }

  /* ─── Altura dinámica del gráfico horizontal ─── */
  const chartHeight = Math.max(220, ventasPorProducto.length * 42)

  return (
    <div className="space-y-6 -m-4 md:-m-6 p-4 md:p-6 min-h-screen bg-gradient-to-br from-stone-50 via-amber-50/20 to-orange-50/30">

      {/* Encabezado */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Mis Ventas</h1>
          <p className="text-stone-500 text-sm">Consulta las ventas de tus productos</p>
        </div>
        <Button variant="outline" onClick={exportarExcel} disabled={ventas.length === 0}
          className="border-stone-200 bg-white hover:bg-stone-50 text-stone-700">
          <Download className="h-4 w-4 mr-2" /> Exportar Excel
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap items-end">
        {(["este_mes", "mes_pasado", "personalizado"] as Periodo[]).map((p) => (
          <button key={p} onClick={() => setPeriodo(p)}
            className="rounded-xl px-4 py-1.5 text-sm font-medium border transition-all"
            style={{
              background:   periodo === p ? "#78350f"         : "#fff",
              color:        periodo === p ? "#fff"            : "#57534e",
              borderColor:  periodo === p ? "#78350f"         : "#e7e5e4",
            }}>
            {p === "este_mes" ? "Este mes" : p === "mes_pasado" ? "Mes pasado" : "Personalizado"}
          </button>
        ))}
        {periodo === "personalizado" && (
          <div className="flex gap-2 items-end">
            <div>
              <Label className="text-xs text-stone-500">Desde</Label>
              <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-stone-500">Hasta</Label>
              <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total vendido",       value: loading ? null : fmoney(totalVendido),              icon: DollarSign,  color: "#D4A574" },
          { label: "Unidades vendidas",   value: loading ? null : unidadesVendidas.toLocaleString(), icon: Package,     color: "#7C9A92" },
          { label: "Productos distintos", value: loading ? null : String(productosDistintos),        icon: ShoppingBag, color: "#BFCC94" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl bg-white border border-stone-200/60 p-5 shadow-sm border-l-4"
            style={{ borderLeftColor: color, boxShadow: "0 1px 3px rgba(120,53,15,0.08)" }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">{label}</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl"
                style={{ background: `${color}18` }}>
                <Icon className="h-4 w-4" style={{ color }} />
              </div>
            </div>
            {value === null
              ? <Skeleton className="h-7 w-28" />
              : <p className="text-2xl font-extrabold text-stone-800 tracking-tight">{value}</p>
            }
          </div>
        ))}
      </div>

      {/* Gráficos en grid */}
      {!loading && ventas.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Ventas por día */}
          <div className="rounded-2xl bg-white border border-stone-200/60 shadow-sm overflow-hidden"
            style={{ boxShadow: "0 1px 3px rgba(120,53,15,0.08)" }}>
            <div className="px-5 pt-5 pb-2">
              <h2 className="font-semibold text-stone-800 text-sm">Ventas por día</h2>
              <p className="text-xs text-stone-400 mt-0.5">
                {format(new Date(desde + "T12:00:00"), "d MMM", { locale: es })} –{" "}
                {format(new Date(hasta  + "T12:00:00"), "d MMM yyyy", { locale: es })}
              </p>
            </div>
            <div className="px-3 pb-4" style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ventasPorDia} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(168,162,158,0.15)" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: "#a8a29e" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#a8a29e" }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `L${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<TooltipDia />} cursor={{ fill: "rgba(120,53,15,0.04)" }} />
                  <Bar dataKey="total" fill="#C07A5C" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Ventas por producto — barras horizontales */}
          <div className="rounded-2xl bg-white border border-stone-200/60 shadow-sm overflow-hidden"
            style={{ boxShadow: "0 1px 3px rgba(120,53,15,0.08)" }}>
            <div className="px-5 pt-5 pb-2 flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-stone-800 text-sm flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4" style={{ color: "#C07A5C" }} />
                  Ventas por producto
                </h2>
                <p className="text-xs text-stone-400 mt-0.5">Ordenado por total vendido</p>
              </div>
              <span className="text-xs text-stone-400 bg-stone-100 rounded-full px-2 py-0.5">
                {ventasPorProducto.length} productos
              </span>
            </div>
            <div className="px-3 pb-4 overflow-auto" style={{ height: Math.min(chartHeight + 32, 340) }}>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart
                  layout="vertical"
                  data={ventasPorProducto}
                  margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(168,162,158,0.15)" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#a8a29e" }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `L${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="nombreCorto" width={130}
                    tick={{ fontSize: 10, fill: "#57534e" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<TooltipProducto />} cursor={{ fill: "rgba(120,53,15,0.04)" }} />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={22}>
                    {ventasPorProducto.map((_, i) => (
                      <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Tabla detalle */}
      <div className="rounded-2xl bg-white border border-stone-200/60 shadow-sm overflow-hidden"
        style={{ boxShadow: "0 1px 3px rgba(120,53,15,0.08)" }}>
        <div className="px-5 pt-4 pb-3 border-b border-stone-100">
          <h2 className="font-semibold text-stone-800 text-sm">Detalle de transacciones</h2>
        </div>
        {loading ? (
          <div className="p-5 space-y-2">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-stone-50/60">
                <TableHead className="text-stone-500">Fecha</TableHead>
                <TableHead className="text-stone-500">Factura</TableHead>
                <TableHead className="text-stone-500">Producto</TableHead>
                <TableHead className="text-right text-stone-500">Cant.</TableHead>
                <TableHead className="text-right text-stone-500">Precio unit.</TableHead>
                <TableHead className="text-right text-stone-500">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ventas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-stone-400 py-10">
                    Sin ventas en el período seleccionado
                  </TableCell>
                </TableRow>
              ) : (
                ventas.map((v, i) => (
                  <TableRow key={i} className="hover:bg-stone-50/60">
                    <TableCell className="text-sm text-stone-600">
                      {format(new Date(v.fecha_venta), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-stone-500">{v.numero_factura}</TableCell>
                    <TableCell className="font-medium text-stone-700">{v.producto_nombre}</TableCell>
                    <TableCell className="text-right text-stone-600">{v.cantidad}</TableCell>
                    <TableCell className="text-right text-stone-600">{fmoney(v.precio_unitario)}</TableCell>
                    <TableCell className="text-right font-semibold text-stone-800">{fmoney(v.subtotal)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
