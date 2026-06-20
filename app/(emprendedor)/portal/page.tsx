"use client"

import * as React from "react"
import Link from "next/link"
import { useEmprendedorAuth } from "@/lib/contexts/emprendedor-auth-context"
import { getVentasByEmprendimiento, type VentaEmprendedor } from "@/lib/services/ventas"
import {
  getStockByEmprendimiento,
  getIngresosPendientesByEmprendimiento,
  type StockEmprendedor,
  type IngresoPendiente,
} from "@/lib/services/inventario-pendiente"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts"
import {
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
  eachDayOfInterval,
  subDays,
  parseISO,
} from "date-fns"
import { es } from "date-fns/locale"
import {
  TrendingUp,
  Package,
  ShoppingCart,
  Clock,
  ArrowRight,
  Boxes,
  AlertCircle,
  Medal,
  BarChart2,
  Star,
  Trophy,
  Bell,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/* ─── Animated counter ───────────────────────────────────────── */
function useCountUp(target: number, duration = 1300, trigger = true) {
  const [value, setValue] = React.useState(0)
  React.useEffect(() => {
    if (!trigger) return
    if (target === 0) { setValue(0); return }
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1)
      setValue(Math.round((1 - Math.pow(1 - p, 3)) * target))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration, trigger])
  return value
}

/* ─── Helpers ────────────────────────────────────────────────── */
function fmoney(n: number) {
  return "L " + new Intl.NumberFormat("es-HN", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return "Buenos días"
  if (h < 19) return "Buenas tardes"
  return "Buenas noches"
}

function stockStatus(n: number): { label: string; bg: string; text: string; dot: string } {
  if (n === 0) return { label: "Agotado", bg: "#fee2e2", text: "#dc2626", dot: "#ef4444" }
  if (n <= 5)  return { label: "Crítico", bg: "#ffedd5", text: "#c2410c", dot: "#f97316" }
  if (n <= 15) return { label: "Bajo",    bg: "#fef9c3", text: "#a16207", dot: "#eab308" }
  return              { label: "OK",      bg: "#dcfce7", text: "#15803d", dot: "#22c55e" }
}

const MEDAL = ["#D4A574", "#A1887F", "#78716C"]

/* ─── Tooltip ─────────────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl px-4 py-2.5 shadow-lg" style={{
      background: "#fff",
      border: "1px solid rgba(212,165,116,0.3)",
      boxShadow: "0 4px 20px rgba(120,53,15,0.12)",
    }}>
      <p className="text-xs text-stone-400 mb-1">{label}</p>
      <p className="text-sm font-bold text-stone-800">{fmoney(payload[0].value)}</p>
    </div>
  )
}

/* ═══ Page ═══════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const { emprendedor } = useEmprendedorAuth()

  const [ventas, setVentas]       = React.useState<VentaEmprendedor[]>([])
  const [stock, setStock]         = React.useState<StockEmprendedor[]>([])
  const [pendientes, setPendientes] = React.useState<IngresoPendiente[]>([])
  const [loading, setLoading]     = React.useState(true)
  const [chartMode, setChartMode] = React.useState<"dia" | "mes">("dia")
  const [ready, setReady]         = React.useState(false)
  const [ventasNuevas, setVentasNuevas] = React.useState<VentaEmprendedor[]>([])
  const [showVentasModal, setShowVentasModal] = React.useState(false)

  React.useEffect(() => {
    if (!emprendedor) return
    const hoy   = new Date()
    const desde = format(subDays(hoy, 29), "yyyy-MM-dd") + "T00:00:00"
    const hasta = format(hoy, "yyyy-MM-dd") + "T23:59:59"
    const storageKey = `emprendedor_last_visit_${emprendedor.emprendimientoId}`

    Promise.all([
      getVentasByEmprendimiento(emprendedor.emprendimientoId, desde, hasta),
      getStockByEmprendimiento(emprendedor.emprendimientoId, emprendedor.razonSocialId),
      getIngresosPendientesByEmprendimiento(emprendedor.emprendimientoId),
    ]).then(([v, s, p]) => {
      setVentas(v)
      setStock(s)
      setPendientes(p.filter((x) => x.estado === "pendiente"))
      setLoading(false)
      setTimeout(() => setReady(true), 80)

      // Detectar ventas nuevas desde la última visita
      const lastVisit = localStorage.getItem(storageKey)
      if (lastVisit) {
        const nuevas = v.filter((venta) => venta.fecha_venta > lastVisit)
        if (nuevas.length > 0) {
          setVentasNuevas(nuevas)
          setShowVentasModal(true)
        }
      }
      localStorage.setItem(storageKey, new Date().toISOString())
    })
  }, [emprendedor])

  /* ─── Derived ──────────────────────────────────────────────── */
  const totalVentas   = ventas.reduce((s, v) => s + v.subtotal_neto, 0)
  const totalUnidades = ventas.reduce((s, v) => s + v.cantidad, 0)
  const totalStock    = stock.reduce((s, p) => s + p.stock_total, 0)

  const chartDataDia = React.useMemo(() => {
    const hoy  = new Date()
    const days = eachDayOfInterval({ start: subDays(hoy, 29), end: hoy })
    const map: Record<string, number> = {}
    ventas.forEach((v) => {
      const k = format(parseISO(v.fecha_venta), "dd/MM")
      map[k] = (map[k] ?? 0) + v.subtotal_neto
    })
    return days.map((d) => ({ label: format(d, "dd/MM"), total: map[format(d, "dd/MM")] ?? 0 }))
  }, [ventas])

  const chartDataMes = React.useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const mes = subMonths(new Date(), 11 - i)
      return { label: format(mes, "MMM", { locale: es }), total: 0 }
    })
  }, [])

  const chartData = chartMode === "dia" ? chartDataDia : chartDataMes

  const topProductos = React.useMemo(() => {
    const map: Record<number, { nombre: string; cantidad: number; total: number }> = {}
    ventas.forEach((v) => {
      if (!map[v.producto_id]) map[v.producto_id] = { nombre: v.producto_nombre, cantidad: 0, total: 0 }
      map[v.producto_id].cantidad += v.cantidad
      map[v.producto_id].total   += v.subtotal_neto
    })
    return Object.values(map).sort((a, b) => b.cantidad - a.cantidad).slice(0, 5)
  }, [ventas])

  const maxQty        = topProductos[0]?.cantidad || 1
  const stockOrdenado = [...stock].sort((a, b) => a.stock_total - b.stock_total).slice(0, 10)

  /* ─── Modal ventas nuevas ──────────────────────────────────── */
  const facturasNuevas = React.useMemo(() => {
    const map: Record<string, { numero: string; fecha: string; items: VentaEmprendedor[]; total: number }> = {}
    ventasNuevas.forEach((v) => {
      if (!map[v.numero_factura]) {
        map[v.numero_factura] = { numero: v.numero_factura, fecha: v.fecha_venta, items: [], total: 0 }
      }
      map[v.numero_factura].items.push(v)
      map[v.numero_factura].total += v.subtotal_neto
    })
    return Object.values(map).sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [ventasNuevas])

  const totalNuevas   = ventasNuevas.reduce((s, v) => s + v.subtotal_neto, 0)
  const unidadesNuevas = ventasNuevas.reduce((s, v) => s + v.cantidad, 0)

  /* ─── Counters ─────────────────────────────────────────────── */
  const cV = useCountUp(Math.round(totalVentas),   1400, ready)
  const cU = useCountUp(totalUnidades,             1200, ready)
  const cS = useCountUp(totalStock,                1000, ready)
  const cP = useCountUp(pendientes.length,          800, ready)

  /* ═══ Render ════════════════════════════════════════════════ */
  return (
    <>
      {/* ── Modal: ventas nuevas ──────────────────────────────── */}
      <Dialog open={showVentasModal} onOpenChange={setShowVentasModal}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: "rgba(212,165,116,0.15)" }}>
                <Bell className="h-5 w-5" style={{ color: "#C07A5C" }} />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-stone-800">
                  ¡Ventas nuevas registradas!
                </DialogTitle>
                <p className="text-xs text-stone-500 mt-0.5">
                  Desde tu última visita · {facturasNuevas.length} {facturasNuevas.length === 1 ? "factura" : "facturas"}
                </p>
              </div>
            </div>
          </DialogHeader>

          {/* Resumen KPIs */}
          <div className="shrink-0 grid grid-cols-2 gap-3 py-3 border-y border-stone-100">
            <div className="rounded-xl p-3 text-center" style={{ background: "rgba(212,165,116,0.08)" }}>
              <p className="text-xs text-stone-500 mb-1">Total vendido</p>
              <p className="text-lg font-extrabold text-stone-800">{fmoney(totalNuevas)}</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: "rgba(191,204,148,0.12)" }}>
              <p className="text-xs text-stone-500 mb-1">Unidades</p>
              <p className="text-lg font-extrabold text-stone-800">{unidadesNuevas.toLocaleString()}</p>
            </div>
          </div>

          {/* Lista de facturas */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {facturasNuevas.slice(0, 20).map((f) => (
              <div key={f.numero} className="rounded-xl border border-stone-100 bg-stone-50/60 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-stone-700 font-mono">
                    {f.numero || "—"}
                  </span>
                  <span className="text-xs text-stone-400">
                    {f.fecha ? format(parseISO(f.fecha), "d MMM, HH:mm", { locale: es }) : "—"}
                  </span>
                </div>
                <div className="space-y-1">
                  {f.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="text-stone-600 truncate max-w-[180px]">{item.producto_nombre}</span>
                      <span className="shrink-0 ml-2 text-stone-500">
                        {item.cantidad}× <span className="font-semibold text-stone-700">{fmoney(item.subtotal)}</span>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-end">
                  <span className="text-xs font-bold" style={{ color: "#C07A5C" }}>Total: {fmoney(f.total)}</span>
                </div>
              </div>
            ))}
            {facturasNuevas.length > 20 && (
              <p className="text-center text-xs text-stone-400 py-1">
                +{facturasNuevas.length - 20} facturas más — ve a Ventas para el detalle completo
              </p>
            )}
          </div>

          {/* Acciones */}
          <div className="shrink-0 pt-3 flex gap-2">
            <button
              onClick={() => setShowVentasModal(false)}
              className="flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors"
              style={{ background: "rgba(146,64,14,0.08)", color: "#92400e" }}
            >
              Entendido
            </button>
            <Link href="/portal/ventas" className="flex-1" onClick={() => setShowVentasModal(false)}>
              <button className="w-full rounded-xl py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ background: "#C07A5C" }}>
                Ver en Ventas →
              </button>
            </Link>
          </div>
        </DialogContent>
      </Dialog>

      <style>{`
        @keyframes orb-drift {
          0%,100% { transform: translate(0,0) scale(1); }
          40%      { transform: translate(28px,-18px) scale(1.06); }
          70%      { transform: translate(-16px,12px) scale(0.95); }
        }
        @keyframes fade-up {
          from { opacity:0; transform:translateY(18px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes bar-grow {
          from { width: 0%; }
        }
        .fade-up        { animation: fade-up .5s ease-out both; }
        .d1 { animation-delay:.05s; } .d2 { animation-delay:.12s; }
        .d3 { animation-delay:.19s; } .d4 { animation-delay:.26s; }
        .d5 { animation-delay:.32s; } .d6 { animation-delay:.40s; }
        .d7 { animation-delay:.48s; } .d8 { animation-delay:.56s; }
      `}</style>

      <div className="space-y-5 -m-4 md:-m-6 p-4 md:p-6 min-h-screen bg-gradient-to-br from-stone-50 via-amber-50/20 to-orange-50/30">

        {/* ── HERO ─────────────────────────────────────────── */}
        <div
          className="relative overflow-hidden rounded-2xl px-6 py-8 md:px-10 md:py-10 border border-amber-100/80"
          style={{ background: "linear-gradient(135deg, #fdf8f2 0%, #f8eedf 40%, #f2e4cc 75%, #eddfc4 100%)" }}
        >
          {/* orbs suaves */}
          <div className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full"
            style={{ background: "radial-gradient(circle,rgba(191,204,148,0.35) 0%,transparent 65%)", animation: "orb-drift 9s ease-in-out infinite" }} />
          <div className="pointer-events-none absolute -bottom-12 left-1/4 h-48 w-48 rounded-full"
            style={{ background: "radial-gradient(circle,rgba(212,165,116,0.25) 0%,transparent 65%)", animation: "orb-drift 13s ease-in-out infinite reverse" }} />
          <div className="pointer-events-none absolute top-4 right-1/3 h-32 w-32 rounded-full"
            style={{ background: "radial-gradient(circle,rgba(253,230,138,0.3) 0%,transparent 65%)", animation: "orb-drift 16s ease-in-out infinite 2s" }} />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: "#a16207" }}>
                {format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: es })}
              </p>
              <h1 className="text-2xl md:text-3xl font-bold" style={{ color: "#1c1917", letterSpacing: "-0.02em" }}>
                {greeting()}, <span style={{ color: "#92400e" }}>{emprendedor?.nombre ?? "—"}</span> 👋
              </h1>
              <p className="mt-1 text-base font-semibold" style={{ color: "#57534e" }}>
                {emprendedor?.emprendimientoNombre ?? "Portal Emprendedor"}
              </p>
              <p className="mt-0.5 text-sm" style={{ color: "#a8a29e" }}>
                Resumen de tu negocio — últimos 30 días
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/portal/ventas">
                <button className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-all hover:shadow-sm"
                  style={{ background: "rgba(146,64,14,0.08)", color: "#92400e", border: "1px solid rgba(146,64,14,0.18)" }}>
                  <BarChart2 className="h-3.5 w-3.5" /> Ver ventas
                </button>
              </Link>
              <Link href="/portal/inventario">
                <button className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-all hover:shadow-sm"
                  style={{ background: "rgba(146,64,14,0.08)", color: "#92400e", border: "1px solid rgba(146,64,14,0.18)" }}>
                  <Boxes className="h-3.5 w-3.5" /> Inventario
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* ── KPIs ──────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="rounded-2xl bg-white border border-stone-200/60 p-5 shadow-sm">
                <Skeleton className="h-3 w-24 mb-4" /><Skeleton className="h-7 w-32 mb-2" /><Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Ventas */}
            <div className="fade-up d1 relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm border-l-4 border-stone-200/60"
              style={{ borderLeftColor: "#D4A574", boxShadow: "0 1px 3px rgba(120,53,15,0.08)" }}>
              <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-5" style={{ background: "#D4A574" }} />
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Ventas 30d</p>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: "rgba(212,165,116,0.12)" }}>
                  <TrendingUp className="h-4 w-4" style={{ color: "#D4A574" }} />
                </div>
              </div>
              <p className="text-2xl md:text-3xl font-extrabold text-stone-800 tracking-tight">
                L {cV.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-stone-400">{totalUnidades} unidades</p>
            </div>

            {/* Unidades */}
            <div className="fade-up d2 relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm border-l-4 border-stone-200/60"
              style={{ borderLeftColor: "#7C9A92", boxShadow: "0 1px 3px rgba(120,53,15,0.08)" }}>
              <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-5" style={{ background: "#7C9A92" }} />
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Unidades</p>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: "rgba(124,154,146,0.12)" }}>
                  <ShoppingCart className="h-4 w-4" style={{ color: "#7C9A92" }} />
                </div>
              </div>
              <p className="text-2xl md:text-3xl font-extrabold text-stone-800 tracking-tight">
                {cU.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-stone-400">{new Set(ventas.map(v => v.producto_id)).size} productos distintos</p>
            </div>

            {/* Stock */}
            <div className="fade-up d3 relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm border-l-4 border-stone-200/60"
              style={{ borderLeftColor: "#BFCC94", boxShadow: "0 1px 3px rgba(120,53,15,0.08)" }}>
              <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-5" style={{ background: "#BFCC94" }} />
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">En Stock</p>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: "rgba(191,204,148,0.15)" }}>
                  <Package className="h-4 w-4" style={{ color: "#7a9050" }} />
                </div>
              </div>
              <p className="text-2xl md:text-3xl font-extrabold text-stone-800 tracking-tight">
                {cS.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-stone-400">en {stock.length} productos</p>
            </div>

            {/* Pendientes */}
            <div className="fade-up d4 relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm border-l-4 border-stone-200/60"
              style={{
                borderLeftColor: pendientes.length > 0 ? "#C07A5C" : "#e5e7eb",
                boxShadow: "0 1px 3px rgba(120,53,15,0.08)",
              }}>
              <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-5" style={{ background: "#C07A5C" }} />
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Pendientes</p>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: pendientes.length > 0 ? "rgba(192,122,92,0.12)" : "rgba(0,0,0,0.04)" }}>
                  <Clock className="h-4 w-4" style={{ color: pendientes.length > 0 ? "#C07A5C" : "#9ca3af" }} />
                </div>
              </div>
              <p className="text-2xl md:text-3xl font-extrabold tracking-tight"
                style={{ color: pendientes.length > 0 ? "#C07A5C" : "#1c1917" }}>
                {cP}
              </p>
              <p className="mt-1 text-xs text-stone-400">
                {pendientes.length > 0 ? "cargas por aprobar" : "todo aprobado"}
              </p>
            </div>
          </div>
        )}

        {/* ── CHART + TOP ────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Area chart */}
          <div className="fade-up d5 lg:col-span-2 rounded-2xl bg-white shadow-sm overflow-hidden border border-stone-200/60"
            style={{ boxShadow: "0 1px 3px rgba(120,53,15,0.08)" }}>
            <div className="flex items-center justify-between px-5 pt-5 pb-2">
              <div>
                <h2 className="font-semibold text-stone-800">Evolución de Ventas</h2>
                <p className="text-xs text-stone-400 mt-0.5">
                  {chartMode === "dia" ? "Últimos 30 días" : "Últimos 12 meses"}
                </p>
              </div>
              <div className="flex rounded-lg overflow-hidden border border-stone-200">
                {(["dia", "mes"] as const).map((m) => (
                  <button key={m} onClick={() => setChartMode(m)}
                    className="px-3 py-1.5 text-xs font-medium transition-all"
                    style={{
                      background: chartMode === m ? "#78350f" : "transparent",
                      color:      chartMode === m ? "#fff"    : "#78716c",
                    }}>
                    {m === "dia" ? "Por día" : "Por mes"}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-56">
                <div className="h-6 w-6 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
              </div>
            ) : (
              <div className="px-2 pb-4" style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#D4A574" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#D4A574" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(168,162,158,0.15)" vertical={false} />
                    <XAxis dataKey="label"
                      tick={{ fill: "#a8a29e", fontSize: 10 }}
                      axisLine={false} tickLine={false}
                      interval={chartMode === "dia" ? 4 : 0} />
                    <YAxis
                      tick={{ fill: "#a8a29e", fontSize: 10 }}
                      axisLine={false} tickLine={false}
                      tickFormatter={v => `L${(v/1000).toFixed(0)}k`} />
                    <RechartsTooltip content={<ChartTooltip />}
                      cursor={{ stroke: "rgba(120,53,15,0.12)", strokeWidth: 1 }} />
                    <Area type="monotone" dataKey="total"
                      stroke="#C07A5C" strokeWidth={2.5}
                      fill="url(#areaGrad)" dot={false}
                      activeDot={{ r: 5, fill: "#C07A5C", stroke: "#fff", strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Top productos */}
          <div className="fade-up d6 rounded-2xl bg-white shadow-sm p-5 border border-stone-200/60"
            style={{ boxShadow: "0 1px 3px rgba(120,53,15,0.08)" }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl" style={{ background: "rgba(212,165,116,0.15)" }}>
                <Trophy className="h-4 w-4" style={{ color: "#C07A5C" }} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-stone-800">Top Productos</h2>
                <p className="text-xs text-stone-400">Últimos 30 días · por unidades</p>
              </div>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 rounded-xl" />)}
              </div>
            ) : topProductos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <Star className="h-8 w-8 text-stone-200 mb-2" />
                <p className="text-sm text-stone-400">Sin ventas en el período</p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {topProductos.map((p, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold"
                          style={{ background: i < 3 ? MEDAL[i] : "#d6d3d1" }}>
                          {i < 3 ? <Medal className="h-3 w-3" /> : i + 1}
                        </span>
                        <span className="text-xs font-medium text-stone-700 truncate max-w-[120px]">{p.nombre}</span>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <span className="text-xs font-bold text-stone-700">{p.cantidad} uds</span>
                        <span className="block text-xs text-stone-400">{fmoney(p.total)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-stone-100 overflow-hidden">
                      <div className="h-full rounded-full"
                        style={{
                          width: ready ? `${(p.cantidad / maxQty) * 100}%` : "0%",
                          transition: ready ? "width 1s cubic-bezier(0.34,1.56,0.64,1)" : "none",
                          background: i === 0 ? "#D4A574" : i === 1 ? "#A1887F" : i === 2 ? "#78716C" : "#BFCC94",
                        }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── INVENTARIO + PENDIENTES ─────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* Inventario */}
          <div className="fade-up d7 lg:col-span-3 rounded-2xl bg-white shadow-sm overflow-hidden border border-stone-200/60"
            style={{ boxShadow: "0 1px 3px rgba(120,53,15,0.08)" }}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-xl" style={{ background: "rgba(191,204,148,0.18)" }}>
                  <Boxes className="h-4 w-4" style={{ color: "#7a9050" }} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-stone-800">Inventario Actual</h2>
                  <p className="text-xs text-stone-400">Menor stock primero</p>
                </div>
              </div>
              <Link href="/portal/inventario" className="flex items-center gap-1 text-xs font-medium text-amber-800 hover:text-amber-600 transition-colors">
                Ver todo <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="px-5 pb-5 space-y-2">
                {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 rounded-xl" />)}
              </div>
            ) : stockOrdenado.length === 0 ? (
              <div className="flex flex-col items-center py-12 px-5">
                <Package className="h-8 w-8 text-stone-200 mb-2" />
                <p className="text-sm text-stone-400">Sin productos en inventario</p>
              </div>
            ) : (
              <div className="divide-y divide-stone-50">
                {stockOrdenado.map((p) => {
                  const s = stockStatus(p.stock_total)
                  return (
                    <div key={p.producto_id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-stone-50/70 transition-colors">
                      <div className="h-2 w-2 rounded-full shrink-0" style={{ background: s.dot }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-stone-700 truncate">{p.nombre}</p>
                        {p.codigo_barras && <p className="text-xs text-stone-400 font-mono">{p.codigo_barras}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-bold" style={{ color: s.dot }}>{p.stock_total}</span>
                        <p className="text-xs text-stone-400">{fmoney(p.precio_venta_sugerido)}</p>
                      </div>
                      <span className="ml-1 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ background: s.bg, color: s.text }}>
                        {s.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Cargas pendientes */}
          <div className="fade-up d8 lg:col-span-2 rounded-2xl bg-white shadow-sm overflow-hidden border border-stone-200/60"
            style={{ boxShadow: "0 1px 3px rgba(120,53,15,0.08)" }}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-xl"
                  style={{ background: pendientes.length > 0 ? "rgba(192,122,92,0.12)" : "rgba(0,0,0,0.04)" }}>
                  <AlertCircle className="h-4 w-4" style={{ color: pendientes.length > 0 ? "#C07A5C" : "#9ca3af" }} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-stone-800">Cargas Pendientes</h2>
                  <p className="text-xs text-stone-400">Esperando aprobación</p>
                </div>
              </div>
              {pendientes.length > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(192,122,92,0.12)", color: "#C07A5C" }}>
                  {pendientes.length}
                </span>
              )}
            </div>

            {loading ? (
              <div className="px-5 pb-5 space-y-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
              </div>
            ) : pendientes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 px-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl mb-3"
                  style={{ background: "rgba(191,204,148,0.18)" }}>
                  <Package className="h-6 w-6" style={{ color: "#BFCC94" }} />
                </div>
                <p className="text-sm font-semibold text-stone-700">Todo al día</p>
                <p className="text-xs text-stone-400 mt-0.5 text-center">No hay cargas esperando aprobación</p>
              </div>
            ) : (
              <div className="px-5 pb-5 space-y-2">
                {pendientes.slice(0, 6).map((p) => (
                  <div key={p.id} className="rounded-xl p-3 border"
                    style={{ background: "rgba(192,122,92,0.04)", borderColor: "rgba(192,122,92,0.18)" }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-stone-700 truncate">
                          {p.producto_nombre ?? `Producto #${p.producto_id}`}
                        </p>
                        {p.producto_codigo && <p className="text-xs text-stone-400 font-mono">{p.producto_codigo}</p>}
                      </div>
                      <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(192,122,92,0.12)", color: "#C07A5C" }}>
                        +{p.cantidad}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <p className="text-xs text-stone-400">
                        {p.created_at ? format(parseISO(p.created_at), "d MMM yyyy", { locale: es }) : "—"}
                      </p>
                      <span className="flex items-center gap-1 text-xs" style={{ color: "#C07A5C" }}>
                        <Clock className="h-3 w-3" /> Pendiente
                      </span>
                    </div>
                  </div>
                ))}
                {pendientes.length > 6 && (
                  <p className="text-xs text-center text-stone-400 pt-1">+{pendientes.length - 6} más</p>
                )}
                <Link href="/portal/inventario" className="block mt-1">
                  <button className="w-full rounded-xl py-2 text-xs font-medium transition-colors hover:opacity-80"
                    style={{ color: "#92400e", background: "rgba(146,64,14,0.06)" }}>
                    Ver todas las cargas →
                  </button>
                </Link>
              </div>
            )}
          </div>
        </div>

      </div>
    </>
  )
}
