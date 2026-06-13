"use client"

/**
 * Cierre Diario.
 *
 * Vista de cierre de caja del dia: combina la vista agregada `vista_cierre_diario`
 * con consultas detalladas (bancos, productos, caja chica). Permite cambiar la
 * fecha con un date picker y exportar un reporte tipo ticket A4 con jsPDF.
 *
 * Resiliencia: si las migraciones 011/012 estan pendientes, los detalles
 * relacionados muestran un estado vacio + banner de migracion pendiente.
 */

import * as React from "react"
import Link from "next/link"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import {
  ClipboardCheck,
  CalendarIcon,
  Printer,
  Wallet,
  Banknote,
  Receipt,
  Landmark,
  Package,
  CircleDollarSign,
  AlertTriangle,
  RefreshCw,
  TrendingDown,
  ShoppingBag,
  ArrowDownRight,
  ArrowUpRight,
  ExternalLink,
} from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { useToast } from "@/hooks/use-toast"
import {
  getCierreDiario,
  type CierreDiarioData,
  type CajaMovimientoRow,
  type PagoGastoRow,
  type GastoDelDia,
  type IngresoEfectivoDetalle,
} from "@/lib/services/cierre-diario"
import { getRazonSocialForPdf } from "@/lib/services/ventas"

// ==================== UTIL ====================

function formatCurrency(n: number | undefined | null): string {
  const v = Number(n ?? 0)
  return `L ${v.toLocaleString("en-HN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function todayISO(): string {
  // Construye YYYY-MM-DD en hora local del navegador (la conversion via
  // toISOString() da UTC y mueve la fecha en zonas con offset negativo).
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("es-HN", {
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return "--:--"
  }
}

function formatFechaLarga(iso: string): string {
  // iso = "YYYY-MM-DD". Construimos el Date local SIN timezone shift.
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10))
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString("es-HN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

/**
 * Etiqueta humana para los tipos de movimiento de caja chica. El backend usa
 * snake_case con mayusculas iniciales (formato del CHECK constraint).
 */
const MOV_LABEL: Record<string, string> = {
  Apertura: "Apertura",
  Ingreso_Manual: "Ingreso manual",
  Ingreso_Venta: "Ingreso por venta",
  Salida: "Salida",
  Transferencia_Banco: "Transferencia a banco",
  Cierre: "Cierre",
}

// ==================== COMPONENTE ====================

export default function CierreDiarioPage() {
  const { toast } = useToast()
  const [fecha, setFecha] = React.useState<string>(() => todayISO())
  const [data, setData] = React.useState<CierreDiarioData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)

  const loadData = React.useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true)
      else setLoading(true)
      try {
        const { data: cierre, error } = await getCierreDiario(fecha)
        if (error) throw new Error(error)
        setData(cierre)
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error desconocido"
        toast({
          title: "No se pudo cargar el cierre",
          description: msg,
          variant: "destructive",
        })
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [fecha, toast]
  )

  React.useEffect(() => {
    loadData()
  }, [loadData])

  // ---- Estado de caja derivado del set de sesiones del dia. -------------
  // La sesion mas reciente (ultima abierta o cerrada) refleja el estado.
  const estadoCaja: "Abierta" | "Cerrada" | "Sin actividad" = React.useMemo(() => {
    const sesiones = data?.caja.sesiones ?? []
    if (sesiones.length === 0) return "Sin actividad"
    const ultima = sesiones[sesiones.length - 1]
    return ultima.estado === "Abierta" ? "Abierta" : "Cerrada"
  }, [data])

  // ---- Generador de PDF (formato A4 simple, imprimible) -----------------
  async function imprimirCierre() {
    if (!data) return
    try {
      const pdf = new jsPDF({ unit: "mm", format: "a4" })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const left = 15
      let y = 18

      // Cabecera empresarial (si existe razon social cargada)
      const { data: rs } = await getRazonSocialForPdf().catch(() => ({ data: null }))
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(16)
      pdf.text("CIERRE DIARIO", pageWidth / 2, y, { align: "center" })
      y += 7

      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(10)
      if (rs?.nombre) {
        pdf.text(rs.nombre, pageWidth / 2, y, { align: "center" })
        y += 5
      }
      pdf.text(formatFechaLarga(fecha), pageWidth / 2, y, { align: "center" })
      y += 4
      pdf.setDrawColor(180)
      pdf.line(left, y, pageWidth - left, y)
      y += 6

      // Resumen ejecutivo (2 columnas)
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(11)
      pdf.text("Resumen", left, y)
      y += 5

      const r = data.resumen
      const rows: [string, string][] = [
        ["Estado de caja", estadoCaja],
        ["Cantidad de tickets", String(r.cantidad_tickets)],
        ["Total ventas", formatCurrency(r.total_ventas)],
        ["Ingresos en efectivo", formatCurrency(r.ingresos_efectivo)],
        ["Ingresos en bancos (bruto)", formatCurrency(r.ingresos_banco_bruto)],
        ["Comisiones bancarias", `(${formatCurrency(r.comisiones_total)})`],
        ["Ingresos en bancos (neto)", formatCurrency(r.ingresos_banco_neto)],
        ["Credito otorgado", formatCurrency(r.credito_total)],
        // Las dos lineas siguientes representan la SALIDA real de dinero del
        // dia, separada por canal (caja chica vs cuenta bancaria).
        [
          "Egresos por gastos (efectivo)",
          `(${formatCurrency(r.egresos_gastos_efectivo)})`,
        ],
        [
          "Egresos por gastos (banco)",
          `(${formatCurrency(r.egresos_gastos_banco)})`,
        ],
      ]
      autoTable(pdf, {
        startY: y,
        body: rows,
        theme: "plain",
        styles: { fontSize: 9, cellPadding: 1 },
        columnStyles: {
          0: { cellWidth: 70 },
          1: { halign: "right", fontStyle: "bold" },
        },
        margin: { left, right: left },
      })
      // @ts-expect-error - lastAutoTable es agregado por jspdf-autotable
      y = pdf.lastAutoTable.finalY + 6

      // Bancos: ahora reflejan ingresos/egresos/saldo final de cuenta_movimientos.
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(11)
      pdf.text("Desglose por cuenta bancaria", left, y)
      y += 2
      autoTable(pdf, {
        startY: y + 2,
        head: [["Banco", "Movs", "Ingresos", "Egresos", "Saldo Final"]],
        body:
          data.bancos.length > 0
            ? data.bancos.map((b) => [
                b.banco,
                String(b.cantidad_movimientos),
                formatCurrency(b.total_ingresos),
                formatCurrency(b.total_egresos),
                formatCurrency(b.saldo_final_dia),
              ])
            : [["Sin movimientos bancarios", "", "", "", ""]],
        theme: "striped",
        headStyles: { fillColor: [50, 50, 50], fontSize: 9 },
        styles: { fontSize: 9, cellPadding: 1.5 },
        columnStyles: {
          1: { halign: "right" },
          2: { halign: "right" },
          3: { halign: "right" },
          4: { halign: "right" },
        },
        margin: { left, right: left },
      })
      // @ts-expect-error
      y = pdf.lastAutoTable.finalY + 6

      // Productos
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(11)
      pdf.text("Productos vendidos", left, y)
      y += 2
      autoTable(pdf, {
        startY: y + 2,
        head: [["Codigo", "Producto", "Cantidad", "Total"]],
        body:
          data.productos.length > 0
            ? data.productos.map((p) => [
                p.producto_codigo ?? "-",
                p.producto_nombre,
                String(p.cantidad),
                formatCurrency(p.total_vendido),
              ])
            : [["Sin productos vendidos", "", "", ""]],
        theme: "striped",
        headStyles: { fillColor: [50, 50, 50], fontSize: 9 },
        styles: { fontSize: 9, cellPadding: 1.5 },
        columnStyles: {
          2: { halign: "right" },
          3: { halign: "right" },
        },
        margin: { left, right: left },
      })
      // @ts-expect-error
      y = pdf.lastAutoTable.finalY + 6

      // Caja chica (movimientos)
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(11)
      pdf.text("Movimientos de caja chica", left, y)
      y += 2
      autoTable(pdf, {
        startY: y + 2,
        head: [["Hora", "Tipo", "Concepto", "Monto", "Saldo"]],
        body:
          data.caja.movimientos.length > 0
            ? data.caja.movimientos.map((m) => [
                formatTime(m.fecha),
                MOV_LABEL[m.tipo] ?? m.tipo,
                m.concepto ?? "",
                formatCurrency(m.monto),
                formatCurrency(m.saldo_resultante),
              ])
            : [["Sin movimientos", "", "", "", ""]],
        theme: "striped",
        headStyles: { fillColor: [50, 50, 50], fontSize: 9 },
        styles: { fontSize: 9, cellPadding: 1.5 },
        columnStyles: {
          3: { halign: "right" },
          4: { halign: "right" },
        },
        margin: { left, right: left },
      })
      // @ts-expect-error
      y = pdf.lastAutoTable.finalY + 6

      // Gastos pagados (egresos del dia, agrupado por orden cronologico).
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(11)
      pdf.text("Gastos pagados hoy", left, y)
      y += 2
      autoTable(pdf, {
        startY: y + 2,
        head: [["Hora", "Proveedor / Concepto", "Metodo", "Monto"]],
        body:
          data.pagosGastos.length > 0
            ? data.pagosGastos.map((p) => [
                formatTime(p.fecha_pago),
                `${p.proveedor_nombre ?? "—"}\n${p.concepto_gasto ?? p.concepto ?? ""}`,
                p.cuenta_nombre ? `${p.metodo_pago} (${p.cuenta_nombre})` : p.metodo_pago,
                formatCurrency(p.monto),
              ])
            : [["Sin gastos pagados hoy", "", "", ""]],
        theme: "striped",
        headStyles: { fillColor: [50, 50, 50], fontSize: 9 },
        styles: { fontSize: 9, cellPadding: 1.5 },
        columnStyles: {
          3: { halign: "right" },
        },
        margin: { left, right: left },
      })

      pdf.save(`cierre-diario-${fecha}.pdf`)
      toast({ title: "PDF generado", description: `cierre-diario-${fecha}.pdf` })
    } catch (err) {
      console.error("[cierre-diario] error pdf:", err)
      toast({
        title: "Error al generar PDF",
        description: "No se pudo crear el reporte. Intenta nuevamente.",
        variant: "destructive",
      })
    }
  }

  // ==================== RENDER ====================

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* ----- Cabecera con date picker + acciones ----- */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-stone-900">
            <ClipboardCheck className="h-6 w-6 text-stone-700" />
            Cierre Diario
          </h1>
          <p className="text-sm text-muted-foreground capitalize">
            {formatFechaLarga(fecha)}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="space-y-1">
            <Label htmlFor="cierre-fecha" className="text-xs">
              Fecha
            </Label>
            <div className="relative">
              <CalendarIcon className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="cierre-fecha"
                type="date"
                value={fecha}
                max={todayISO()}
                onChange={(e) => setFecha(e.target.value || todayISO())}
                className="h-9 w-44 pl-8"
              />
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="h-9"
          >
            <RefreshCw className={`mr-1 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refrescar
          </Button>

          <Button
            size="sm"
            onClick={imprimirCierre}
            disabled={!data || loading}
            className="h-9 bg-stone-800 hover:bg-stone-900"
          >
            <Printer className="mr-1 h-4 w-4" />
            Imprimir Cierre
          </Button>
        </div>
      </div>

      {/* ----- Banner de migracion pendiente -----
          Solo se muestra si una TABLA base falta (codigo 42P01 / PGRST205).
          Errores de relacion polimorfica o de columna NO disparan este banner.
      */}
      {data?.featurePending && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle>Tablas de tesoreria no encontradas</AlertTitle>
          <AlertDescription>
            Alguna de estas tablas no esta disponible en tu base de datos:{" "}
            <code className="rounded bg-amber-100 px-1">caja_chica_sesiones</code>,{" "}
            <code className="rounded bg-amber-100 px-1">caja_chica_movimientos</code>,{" "}
            <code className="rounded bg-amber-100 px-1">cuenta_movimientos</code> o{" "}
            <code className="rounded bg-amber-100 px-1">ventas_pagos_detalle</code>.
            Si ya las creaste, revisa la consola para ver el error exacto.
          </AlertDescription>
        </Alert>
      )}

      {/* ----- 5 KPIs (anadimos Egresos del Dia para mostrar la salida real) ----- */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        {/* Estado de caja */}
        <Card className="border-l-4 border-l-stone-700">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Estado de Caja</CardDescription>
              <Wallet className="h-4 w-4 text-stone-500" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="space-y-1">
                <Badge
                  className={
                    estadoCaja === "Abierta"
                      ? "border-emerald-300 bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                      : estadoCaja === "Cerrada"
                        ? "border-stone-300 bg-stone-100 text-stone-700 hover:bg-stone-100"
                        : "border-amber-300 bg-amber-100 text-amber-700 hover:bg-amber-100"
                  }
                >
                  {estadoCaja}
                </Badge>
                {data && data.caja.sesiones.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {data.caja.sesiones.length} sesion
                    {data.caja.sesiones.length === 1 ? "" : "es"} en el dia
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Total ventas + tickets */}
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Total Ventas</CardDescription>
              <Receipt className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <p className="text-2xl font-bold leading-none">
                  {formatCurrency(data?.resumen.total_ventas)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {data?.resumen.cantidad_tickets ?? 0} ticket
                  {data?.resumen.cantidad_tickets === 1 ? "" : "s"}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/*
          Efectivo (Ingresos por Ventas)
          Fuente: caja_chica_movimientos donde tipo='Ingreso_Venta', filtrado
          por razon_social_id y created_at del dia. Las inyecciones manuales
          se muestran como linea secundaria (no se suman al KPI principal
          para no inflar la cifra de ventas).
        */}
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Ingresos en Efectivo</CardDescription>
              <Banknote className="h-4 w-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <p className="text-2xl font-bold leading-none text-emerald-700">
                  {formatCurrency(data?.resumen.ingresos_efectivo)}
                </p>
                {(data?.resumen.ingresos_efectivo_manual ?? 0) > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    + Inyecciones manuales:{" "}
                    <span className="font-medium text-stone-700">
                      {formatCurrency(data?.resumen.ingresos_efectivo_manual)}
                    </span>
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Banco neto */}
        <Card className="border-l-4 border-l-indigo-500">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Ingresos en Bancos (Neto)</CardDescription>
              <Landmark className="h-4 w-4 text-indigo-500" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <p className="text-2xl font-bold leading-none text-indigo-700">
                  {formatCurrency(data?.resumen.ingresos_banco_neto)}
                </p>
                {(data?.resumen.comisiones_total ?? 0) > 0 && (
                  <p className="mt-1 text-xs text-rose-600">
                    -{formatCurrency(data?.resumen.comisiones_total)} comision
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/*
          Egresos del Dia.
          Total de salidas reales de dinero: combina las salidas de caja chica
          (tipo='Salida' del dia) con los pagos a gastos por banco. Esto cubre
          tanto gastos formales como salidas manuales (caja menor).
        */}
        <Card className="border-l-4 border-l-rose-500">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Egresos del Dia</CardDescription>
              <TrendingDown className="h-4 w-4 text-rose-500" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <p className="text-2xl font-bold leading-none text-rose-700">
                  {formatCurrency(
                    (data?.resumen.total_egresos_caja ?? 0) +
                      (data?.resumen.egresos_gastos_banco ?? 0)
                  )}
                </p>
                {((data?.resumen.total_egresos_caja ?? 0) > 0 ||
                  (data?.resumen.egresos_gastos_banco ?? 0) > 0) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ef {formatCurrency(data?.resumen.total_egresos_caja)} ·
                    Bco {formatCurrency(data?.resumen.egresos_gastos_banco)}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ----- 3 Tabs ----- */}
      <Tabs defaultValue="bancos" className="space-y-4">
        <TabsList className="bg-stone-100">
          <TabsTrigger value="bancos" className="gap-1.5">
            <Landmark className="h-3.5 w-3.5" />
            Bancos
          </TabsTrigger>
          <TabsTrigger value="productos" className="gap-1.5">
            <Package className="h-3.5 w-3.5" />
            Productos
          </TabsTrigger>
          <TabsTrigger value="caja" className="gap-1.5">
            <CircleDollarSign className="h-3.5 w-3.5" />
            Caja Chica
          </TabsTrigger>
          <TabsTrigger value="gastos" className="gap-1.5">
            <ShoppingBag className="h-3.5 w-3.5" />
            Gastos Pagados
          </TabsTrigger>
        </TabsList>

        {/* ===== Tab 1: Bancos ===== */}
        <TabsContent value="bancos">
          <BancosCard loading={loading} bancos={data?.bancos ?? []} />
        </TabsContent>

        {/* ===== Tab 2: Productos ===== */}
        <TabsContent value="productos">
          <ProductosCard loading={loading} productos={data?.productos ?? []} />
        </TabsContent>

        {/* ===== Tab 3: Caja Chica ===== */}
        <TabsContent value="caja" className="space-y-4">
          {/*
            Detalle de los ingresos en efectivo del dia (caja_chica_movimientos
            con tipo Ingreso_Venta o Ingreso_Manual). Muestra hora, tipo,
            concepto, cajero y monto. Si es venta, el concepto enlaza al
            historial de ventas.
          */}
          <DetalleEfectivoCard
            loading={loading}
            detalles={data?.detalleEfectivo ?? []}
            totalVenta={data?.resumen.ingresos_efectivo ?? 0}
            totalManual={data?.resumen.ingresos_efectivo_manual ?? 0}
          />
          <CajaCard
            loading={loading}
            sesiones={data?.caja.sesiones ?? []}
            movimientos={data?.caja.movimientos ?? []}
          />
        </TabsContent>

        {/* ===== Tab 4: Gastos pagados hoy ===== */}
        <TabsContent value="gastos" className="space-y-4">
          {/*
            Resumen de gastos cuyo `fecha_gasto` es la fecha del cierre.
            Muestra QUE se gasto, sin importar como/cuando se pago.
          */}
          <GastosDelDiaCard
            loading={loading}
            gastos={data?.gastosDelDia ?? []}
          />
          <GastosPagadosCard
            loading={loading}
            pagos={data?.pagosGastos ?? []}
            totalEfectivo={data?.resumen.egresos_gastos_efectivo ?? 0}
            totalBanco={data?.resumen.egresos_gastos_banco ?? 0}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ==================== SUBCOMPONENTES ====================
// Aislamos las tablas en componentes separados para mantener el page corto y
// los renders especificos faciles de leer/testear.

/**
 * Formato corto para horas (HH:MM) a partir de un timestamptz ISO.
 * Lo usamos en la tabla de detalle dentro de cada cuenta para no
 * duplicar la fecha (que ya es la del cierre).
 */
function formatHora(iso: string): string {
  if (!iso) return "-"
  try {
    return new Date(iso).toLocaleTimeString("es-HN", {
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso.slice(11, 16)
  }
}

function BancosCard({
  loading,
  bancos,
}: {
  loading: boolean
  bancos: CierreDiarioData["bancos"]
}) {
  const totales = React.useMemo(
    () =>
      bancos.reduce(
        (acc, b) => ({
          ingresos: acc.ingresos + b.total_ingresos,
          egresos: acc.egresos + b.total_egresos,
          saldoFinal: acc.saldoFinal + b.saldo_final_dia,
          movimientos: acc.movimientos + b.cantidad_movimientos,
        }),
        { ingresos: 0, egresos: 0, saldoFinal: 0, movimientos: 0 }
      ),
    [bancos]
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Desglose por Cuenta Bancaria</CardTitle>
        <CardDescription>
          Movimientos de cada cuenta en el dia: ingresos, egresos y saldo
          final. Haz clic en una cuenta para ver el detalle de cada
          transaccion con su usuario.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : bancos.length === 0 ? (
          <Empty className="border-0">
            <EmptyHeader>
              <Landmark className="h-8 w-8 text-stone-400" />
              <EmptyTitle>Sin movimientos bancarios</EmptyTitle>
              <EmptyDescription>
                No hubo movimientos en cuentas bancarias en esta fecha.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="p-4 space-y-3">
            {/* Totales agregados arriba */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pb-3 border-b">
              <div>
                <p className="text-xs text-muted-foreground">Movimientos</p>
                <p className="text-lg font-semibold tabular-nums">
                  {totales.movimientos}
                </p>
              </div>
              <div>
                <p className="text-xs text-emerald-700">Total Ingresos</p>
                <p className="text-lg font-semibold tabular-nums text-emerald-700">
                  {formatCurrency(totales.ingresos)}
                </p>
              </div>
              <div>
                <p className="text-xs text-rose-700">Total Egresos</p>
                <p className="text-lg font-semibold tabular-nums text-rose-700">
                  {formatCurrency(totales.egresos)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Saldo Final (suma)
                </p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatCurrency(totales.saldoFinal)}
                </p>
              </div>
            </div>

            {/* Una cuenta por seccion expandible */}
            <Accordion
              type="multiple"
              defaultValue={bancos
                .slice(0, 1)
                .map((b) => `cuenta-${b.cuenta_id ?? "null"}`)}
              className="space-y-2"
            >
              {bancos.map((b) => {
                const itemKey = `cuenta-${b.cuenta_id ?? "null"}`
                return (
                  <AccordionItem
                    key={itemKey}
                    value={itemKey}
                    className="border rounded-lg px-3 data-[state=open]:bg-stone-50/40"
                  >
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex flex-1 items-center justify-between gap-4 pr-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Landmark className="h-4 w-4 text-indigo-500 shrink-0" />
                          <div className="text-left min-w-0">
                            <p className="font-medium truncate">{b.banco}</p>
                            <p className="text-xs text-muted-foreground">
                              {b.cantidad_movimientos}{" "}
                              {b.cantidad_movimientos === 1
                                ? "movimiento"
                                : "movimientos"}
                            </p>
                          </div>
                        </div>
                        <div className="hidden sm:grid grid-cols-3 gap-4 text-right shrink-0">
                          <div>
                            <p className="text-[10px] uppercase text-emerald-700">
                              Ingresos
                            </p>
                            <p className="text-sm font-semibold tabular-nums text-emerald-700">
                              {formatCurrency(b.total_ingresos)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase text-rose-700">
                              Egresos
                            </p>
                            <p className="text-sm font-semibold tabular-nums text-rose-700">
                              {formatCurrency(b.total_egresos)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase text-muted-foreground">
                              Saldo Final
                            </p>
                            <p className="text-sm font-bold tabular-nums">
                              {formatCurrency(b.saldo_final_dia)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-3">
                      {/* Resumen mobile - solo visible <sm */}
                      <div className="grid grid-cols-3 gap-2 sm:hidden mb-3 pb-3 border-b text-center">
                        <div>
                          <p className="text-[10px] uppercase text-emerald-700">
                            Ingresos
                          </p>
                          <p className="text-sm font-semibold tabular-nums text-emerald-700">
                            {formatCurrency(b.total_ingresos)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-rose-700">
                            Egresos
                          </p>
                          <p className="text-sm font-semibold tabular-nums text-rose-700">
                            {formatCurrency(b.total_egresos)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-muted-foreground">
                            Saldo
                          </p>
                          <p className="text-sm font-bold tabular-nums">
                            {formatCurrency(b.saldo_final_dia)}
                          </p>
                        </div>
                      </div>

                      {/* Detalle de movimientos del dia */}
                      <div className="overflow-x-auto rounded border bg-background">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-stone-50">
                              <TableHead className="w-16">Hora</TableHead>
                              <TableHead className="w-20">Tipo</TableHead>
                              <TableHead>Concepto</TableHead>
                              <TableHead className="w-32">Usuario</TableHead>
                              <TableHead className="text-right w-28">
                                Monto
                              </TableHead>
                              <TableHead className="text-right w-28">
                                Saldo
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {b.movimientos.map((m) => {
                              const isIngreso = m.tipo === "Ingreso"
                              const esVenta = m.ref_tipo === "venta" && m.ref_id != null
                              return (
                                <TableRow key={m.id}>
                                  <TableCell className="text-xs tabular-nums whitespace-nowrap">
                                    {formatHora(m.fecha)}
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className={
                                        isIngreso
                                          ? "bg-emerald-50 text-emerald-800 border-emerald-200 gap-1"
                                          : "bg-rose-50 text-rose-800 border-rose-200 gap-1"
                                      }
                                    >
                                      {isIngreso ? (
                                        <ArrowUpRight className="h-3 w-3" />
                                      ) : (
                                        <ArrowDownRight className="h-3 w-3" />
                                      )}
                                      {m.tipo}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="max-w-md">
                                    <div className="flex items-center gap-2">
                                      <span className="truncate text-sm">
                                        {m.concepto || (
                                          <span className="italic text-muted-foreground">
                                            Sin concepto
                                          </span>
                                        )}
                                      </span>
                                      {esVenta && (
                                        <Link
                                          href={`/ventas/historial?venta=${m.ref_id}`}
                                          className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                                          title={`Ver detalle de la venta #${m.ref_id}`}
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                          Venta #{m.ref_id}
                                        </Link>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground truncate">
                                    {m.usuario || "-"}
                                  </TableCell>
                                  <TableCell
                                    className={`text-right tabular-nums font-medium ${
                                      isIngreso
                                        ? "text-emerald-700"
                                        : "text-rose-700"
                                    }`}
                                  >
                                    {isIngreso ? "+" : "-"}
                                    {formatCurrency(m.monto)}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {formatCurrency(m.saldo_resultante)}
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ProductosCard({
  loading,
  productos,
}: {
  loading: boolean
  productos: CierreDiarioData["productos"]
}) {
  const totales = React.useMemo(
    () => ({
      cantidad: productos.reduce((acc, p) => acc + p.cantidad, 0),
      total: productos.reduce((acc, p) => acc + p.total_vendido, 0),
    }),
    [productos]
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Productos Vendidos</CardTitle>
        <CardDescription>
          Agregado por SKU. Util para reposicion inmediata.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : productos.length === 0 ? (
          <Empty className="border-0">
            <EmptyHeader>
              <Package className="h-8 w-8 text-stone-400" />
              <EmptyTitle>Sin productos vendidos</EmptyTitle>
              <EmptyDescription>
                No hay tickets registrados para esta fecha.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-stone-50">
                <TableHead className="w-32">Codigo</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productos.map((p) => (
                <TableRow key={`${p.producto_id ?? "null"}-${p.producto_nombre}`}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {p.producto_codigo || "-"}
                  </TableCell>
                  <TableCell className="font-medium">{p.producto_nombre}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.cantidad}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {formatCurrency(p.total_vendido)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 bg-stone-50 font-semibold">
                <TableCell colSpan={2}>Total</TableCell>
                <TableCell className="text-right tabular-nums">
                  {totales.cantidad}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(totales.total)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function CajaCard({
  loading,
  sesiones,
  movimientos,
}: {
  loading: boolean
  sesiones: CierreDiarioData["caja"]["sesiones"]
  movimientos: CajaMovimientoRow[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Movimientos de Caja Menor</CardTitle>
        <CardDescription>
          Lista cronologica del dia con saldo running. Incluye apertura, cierre,
          ventas en efectivo y transferencias a banco.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ----- Banner de sesiones ------------------------------------- */}
        {!loading && sesiones.length > 0 && (
          <div className="grid gap-2 md:grid-cols-2">
            {sesiones.map((s) => (
              <div
                key={s.id}
                className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">Sesion #{s.id}</span>
                  <Badge
                    variant="outline"
                    className={
                      s.estado === "Abierta"
                        ? "border-emerald-300 text-emerald-700"
                        : "border-stone-300 text-stone-700"
                    }
                  >
                    {s.estado}
                  </Badge>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <dt className="text-muted-foreground">Apertura</dt>
                  <dd className="text-right tabular-nums">
                    {formatTime(s.fecha_apertura)} &middot;{" "}
                    {formatCurrency(s.saldo_inicial)}
                  </dd>
                  <dt className="text-muted-foreground">Cierre</dt>
                  <dd className="text-right tabular-nums">
                    {s.fecha_cierre ? formatTime(s.fecha_cierre) : "-"} &middot;{" "}
                    {s.saldo_final_real != null
                      ? formatCurrency(s.saldo_final_real)
                      : "-"}
                  </dd>
                </dl>
              </div>
            ))}
          </div>
        )}

        {/* ----- Tabla de movimientos --------------------------------- */}
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : movimientos.length === 0 ? (
          <Empty className="border-0">
            <EmptyHeader>
              <CircleDollarSign className="h-8 w-8 text-stone-400" />
              <EmptyTitle>Sin movimientos</EmptyTitle>
              <EmptyDescription>
                Caja chica no tuvo actividad en esta fecha.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-stone-50">
                <TableHead className="w-20">Hora</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimientos.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                    {formatTime(m.fecha)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs font-normal">
                      {MOV_LABEL[m.tipo] ?? m.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {m.concepto || (
                      <span className="text-muted-foreground italic">—</span>
                    )}
                    {m.cuenta_destino_nombre && (
                      <span className="ml-1 text-xs text-indigo-600">
                        → {m.cuenta_destino_nombre}
                      </span>
                    )}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums font-medium ${
                      m.monto >= 0 ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {m.monto >= 0 ? "+" : ""}
                    {formatCurrency(m.monto)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(m.saldo_resultante)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Detalle de Ingresos en Efectivo (caja_chica_movimientos).
 * Card colapsable: el header muestra los totales (ventas + manuales) y al
 * abrirlo despliega la tabla con cada movimiento individual. Cuando un
 * registro tiene `ref_tipo='venta'`, el concepto se vuelve un link al
 * historial de ventas filtrado por `ref_id`.
 */
function DetalleEfectivoCard({
  loading,
  detalles,
  totalVenta,
  totalManual,
}: {
  loading: boolean
  detalles: IngresoEfectivoDetalle[]
  totalVenta: number
  totalManual: number
}) {
  const total = totalVenta + totalManual

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Banknote className="h-4 w-4 text-emerald-600" />
              Detalle de Ingresos en Efectivo
            </CardTitle>
            <CardDescription>
              Movimientos de caja chica del dia (ventas en efectivo +
              inyecciones manuales).
            </CardDescription>
          </div>
          {!loading && total > 0 && (
            <div className="text-right shrink-0">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold tabular-nums text-emerald-700">
                {formatCurrency(total)}
              </p>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : detalles.length === 0 ? (
          <Empty className="border-0">
            <EmptyHeader>
              <Banknote className="h-8 w-8 text-stone-400" />
              <EmptyTitle>Sin ingresos en efectivo registrados</EmptyTitle>
              <EmptyDescription>
                No se encontraron movimientos tipo Ingreso_Venta o
                Ingreso_Manual en caja chica para esta fecha.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Accordion type="single" collapsible defaultValue="detalle-efectivo">
            <AccordionItem
              value="detalle-efectivo"
              className="border rounded-lg px-3 data-[state=open]:bg-stone-50/40"
            >
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex flex-1 items-center justify-between gap-4 pr-2">
                  <div className="text-left">
                    <p className="font-medium text-sm">
                      {detalles.length}{" "}
                      {detalles.length === 1 ? "movimiento" : "movimientos"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Ver detalle por transaccion
                    </p>
                  </div>
                  <div className="hidden sm:flex gap-6 text-right">
                    <div>
                      <p className="text-[10px] uppercase text-emerald-700">
                        Ventas
                      </p>
                      <p className="text-sm font-semibold tabular-nums text-emerald-700">
                        {formatCurrency(totalVenta)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-stone-600">
                        Manuales
                      </p>
                      <p className="text-sm font-semibold tabular-nums text-stone-700">
                        {formatCurrency(totalManual)}
                      </p>
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                {/* Resumen mobile */}
                <div className="grid grid-cols-2 gap-2 sm:hidden mb-3 pb-3 border-b text-center">
                  <div>
                    <p className="text-[10px] uppercase text-emerald-700">
                      Ventas
                    </p>
                    <p className="text-sm font-semibold tabular-nums text-emerald-700">
                      {formatCurrency(totalVenta)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-stone-600">
                      Manuales
                    </p>
                    <p className="text-sm font-semibold tabular-nums text-stone-700">
                      {formatCurrency(totalManual)}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded border bg-background">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-stone-50">
                        <TableHead className="w-16">Hora</TableHead>
                        <TableHead className="w-28">Tipo</TableHead>
                        <TableHead>Concepto</TableHead>
                        <TableHead className="w-32">Cajero</TableHead>
                        <TableHead className="text-right w-28">
                          Monto
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detalles.map((d) => {
                        const esVenta =
                          d.tipo === "Ingreso_Venta" &&
                          d.ref_tipo === "venta" &&
                          d.ref_id != null
                        const conceptoTexto = d.concepto || (
                          <span className="italic text-muted-foreground">
                            Sin concepto
                          </span>
                        )
                        return (
                          <TableRow key={d.id}>
                            <TableCell className="text-xs tabular-nums whitespace-nowrap">
                              {formatHora(d.fecha)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  d.tipo === "Ingreso_Venta"
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                    : "bg-amber-50 text-amber-800 border-amber-200"
                                }
                              >
                                {d.tipo === "Ingreso_Venta"
                                  ? "Venta"
                                  : "Manual"}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-md text-sm">
                              {esVenta ? (
                                <Link
                                  href={`/ventas/historial?venta=${d.ref_id}`}
                                  className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                                  title={`Ver detalle de la venta #${d.ref_id}`}
                                >
                                  <ExternalLink className="h-3 w-3 shrink-0" />
                                  <span className="truncate">
                                    {conceptoTexto}
                                  </span>
                                </Link>
                              ) : (
                                <span className="truncate">
                                  {conceptoTexto}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground truncate">
                              {d.cajero || "-"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium text-emerald-700">
                              +{formatCurrency(d.monto)}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Resumen de gastos cuya `fecha_gasto` coincide con la fecha del cierre.
 * Lista QUE se gasto el dia (concepto + monto + descripcion), sin importar
 * como/cuando se pago. Complementa al card "Pagos a Gastos Hoy" que
 * muestra el flujo de salida real de dinero.
 */
function GastosDelDiaCard({
  loading,
  gastos,
}: {
  loading: boolean
  gastos: GastoDelDia[]
}) {
  const total = gastos.reduce((acc, g) => acc + Number(g.monto || 0), 0)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Gastos del Dia</CardTitle>
            <CardDescription>
              Gastos registrados con fecha {gastos[0]?.fecha_gasto ?? "del cierre"}
            </CardDescription>
          </div>
          {!loading && gastos.length > 0 && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold tabular-nums text-rose-700">
                {formatCurrency(total)}
              </p>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : gastos.length === 0 ? (
          <Empty className="border-0">
            <EmptyHeader>
              <ShoppingBag className="h-8 w-8 text-stone-400" />
              <EmptyTitle>Sin gastos registrados hoy</EmptyTitle>
              <EmptyDescription>
                No se encontraron registros en la tabla de gastos con esta fecha.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-stone-50">
                <TableHead>Concepto</TableHead>
                <TableHead>Descripcion</TableHead>
                <TableHead>Metodo</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gastos.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="text-sm font-medium">
                    {g.concepto_nombre ?? "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-md truncate">
                    {g.descripcion || (
                      <span className="italic">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs font-normal">
                      {g.metodo_pago}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-rose-700">
                    {formatCurrency(g.monto)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Lista los pagos a gastos (gastos_pagos_detalle) realizados en el dia
 * consultado. Cada fila muestra hora, proveedor/concepto, cuenta destino,
 * metodo y monto. Util para conciliar la salida real de dinero contra los
 * movimientos en caja chica y los movimientos bancarios.
 */
function GastosPagadosCard({
  loading,
  pagos,
  totalEfectivo,
  totalBanco,
}: {
  loading: boolean
  pagos: PagoGastoRow[]
  totalEfectivo: number
  totalBanco: number
}) {
  const total = totalEfectivo + totalBanco

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Gastos Pagados Hoy</CardTitle>
            <CardDescription className="text-xs">
              Salidas registradas desde el modulo de Gastos (cuentas por pagar)
            </CardDescription>
          </div>
          {!loading && pagos.length > 0 && (
            <div className="flex items-center gap-3 text-xs">
              <Badge className="border-emerald-300 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 font-normal">
                Efectivo {formatCurrency(totalEfectivo)}
              </Badge>
              <Badge className="border-indigo-300 bg-indigo-100 text-indigo-700 hover:bg-indigo-100 font-normal">
                Banco {formatCurrency(totalBanco)}
              </Badge>
              <Badge className="border-rose-300 bg-rose-100 text-rose-700 hover:bg-rose-100 font-normal">
                Total {formatCurrency(total)}
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : pagos.length === 0 ? (
          <Empty className="border-0">
            <EmptyHeader>
              <EmptyTitle>Sin egresos por gastos hoy</EmptyTitle>
              <EmptyDescription>
                No se registraron pagos a proveedores el dia consultado.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Hora</TableHead>
                <TableHead>Proveedor / Concepto</TableHead>
                <TableHead>Metodo</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagos.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {formatTime(p.fecha_pago)}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="font-medium leading-tight">
                      {p.proveedor_nombre || (
                        <span className="text-muted-foreground italic">
                          Sin proveedor
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground leading-tight">
                      {p.concepto_gasto || p.concepto || "—"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        p.metodo_pago === "Efectivo"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-indigo-300 bg-indigo-50 text-indigo-700"
                      }
                    >
                      {p.metodo_pago}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.cuenta_nombre || (
                      <span className="text-muted-foreground italic">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-rose-700">
                    -{formatCurrency(p.monto)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
