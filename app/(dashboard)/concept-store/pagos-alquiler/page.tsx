"use client"

import * as React from "react"
import { useAuth } from "@/lib/contexts/auth-context"
import { useTenant } from "@/lib/hooks/use-tenant"
import {
  getPagosAlquilerDelMes,
  registrarPagoAlquiler,
  revertirPagoAlquiler,
  generarRegistrosMensuales,
  type PagoAlquiler,
} from "@/lib/services/pagos-alquiler"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Spinner } from "@/components/ui/spinner"
import { useToast } from "@/hooks/use-toast"
import { CreditCard, RefreshCw, CheckCircle2, Clock, TrendingUp, AlertCircle } from "lucide-react"

const MESES_NOMBRES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

function nombreMes(mes: number) {
  return MESES_NOMBRES[mes - 1] ?? String(mes)
}

function formatLps(n: number) {
  return `L ${n.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function PagosAlquilerPage() {
  const { user } = useAuth()
  const { razonSocialId, ready } = useTenant()
  const { toast } = useToast()

  const now = new Date()
  const [anio, setAnio] = React.useState(now.getFullYear())
  const [mes, setMes] = React.useState(now.getMonth() + 1)
  const [pagos, setPagos] = React.useState<PagoAlquiler[]>([])
  const [loading, setLoading] = React.useState(true)
  const [generando, setGenerando] = React.useState(false)

  // Dialog registrar pago
  const [pagoEditar, setPagoEditar] = React.useState<PagoAlquiler | null>(null)
  const [formMonto, setFormMonto] = React.useState("")
  const [formFecha, setFormFecha] = React.useState("")
  const [formNotas, setFormNotas] = React.useState("")
  const [guardando, setGuardando] = React.useState(false)

  const cargarPagos = React.useCallback(async () => {
    if (razonSocialId == null) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await getPagosAlquilerDelMes(razonSocialId, anio, mes)
      setPagos(data)
    } finally {
      setLoading(false)
    }
  }, [razonSocialId, anio, mes])

  React.useEffect(() => {
    if (!ready) return
    cargarPagos()
  }, [ready, cargarPagos])

  const handleGenerar = async () => {
    if (razonSocialId == null) return
    setGenerando(true)
    try {
      const { insertados, error } = await generarRegistrosMensuales(
        razonSocialId,
        anio,
        mes,
        user?.nombre ?? "admin"
      )
      if (error) {
        toast({ title: "Error", description: error, variant: "destructive" })
      } else {
        toast({
          title: insertados > 0 ? `${insertados} registros generados` : "Sin registros nuevos",
          description: insertados > 0
            ? `Se generaron ${insertados} registros para ${nombreMes(mes)} ${anio}.`
            : "Todos los emprendimientos activos ya tienen registro para este mes.",
        })
        await cargarPagos()
      }
    } finally {
      setGenerando(false)
    }
  }

  const abrirRegistrar = (pago: PagoAlquiler) => {
    setPagoEditar(pago)
    setFormMonto(String(pago.valor_alquiler_esperado ?? pago.monto ?? ""))
    setFormFecha(new Date().toISOString().split("T")[0])
    setFormNotas("")
  }

  const handleRegistrar = async () => {
    if (!pagoEditar?.id) return
    const monto = parseFloat(formMonto)
    if (isNaN(monto) || monto <= 0) {
      toast({ title: "Monto inválido", variant: "destructive" })
      return
    }
    setGuardando(true)
    try {
      const { error } = await registrarPagoAlquiler(
        pagoEditar.id,
        monto,
        formFecha,
        formNotas,
        user?.nombre ?? "admin"
      )
      if (error) {
        toast({ title: "Error al registrar", description: error, variant: "destructive" })
      } else {
        toast({ title: "Pago registrado", description: `${pagoEditar.emprendimiento_nombre} — ${formatLps(monto)}` })
        setPagoEditar(null)
        await cargarPagos()
      }
    } finally {
      setGuardando(false)
    }
  }

  const handleRevertir = async (pago: PagoAlquiler) => {
    if (!pago.id) return
    const { error } = await revertirPagoAlquiler(pago.id, user?.nombre ?? "admin")
    if (error) {
      toast({ title: "Error al revertir", description: error, variant: "destructive" })
    } else {
      toast({ title: "Pago revertido a pendiente" })
      await cargarPagos()
    }
  }

  // KPIs
  const totalEsperado = pagos.reduce((s, p) => s + (p.valor_alquiler_esperado ?? 0), 0)
  const totalPagado = pagos.filter((p) => p.estado === "pagado").reduce((s, p) => s + p.monto, 0)
  const pendientes = pagos.filter((p) => p.estado === "pendiente").length
  const porcentaje = totalEsperado > 0 ? Math.round((totalPagado / totalEsperado) * 100) : 0

  const anios = Array.from({ length: 4 }, (_, i) => now.getFullYear() - 1 + i)

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-blue-600" />
            Pagos de Alquiler
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Control mensual de pagos por emprendimiento
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESES_NOMBRES.map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(anio)} onValueChange={(v) => setAnio(Number(v))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {anios.map((a) => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={cargarPagos} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={handleGenerar} disabled={generando || loading || razonSocialId == null}>
            {generando ? <Spinner className="h-4 w-4 mr-2" /> : null}
            Generar mes
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-stone-500 font-medium uppercase tracking-wide">
              Esperado
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-xl font-bold text-stone-800">{formatLps(totalEsperado)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-stone-500 font-medium uppercase tracking-wide flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" /> Pagado
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-xl font-bold text-green-700">{formatLps(totalPagado)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-stone-500 font-medium uppercase tracking-wide flex items-center gap-1">
              <Clock className="h-3 w-3 text-orange-500" /> Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-xl font-bold text-orange-600">{pendientes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-stone-500 font-medium uppercase tracking-wide flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-blue-500" /> Recaudado
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-xl font-bold text-blue-700">{porcentaje}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner className="h-6 w-6" />
            </div>
          ) : pagos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-stone-400 gap-2">
              <AlertCircle className="h-8 w-8" />
              <p className="text-sm font-medium">Sin registros para {nombreMes(mes)} {anio}</p>
              <p className="text-xs">Haz clic en "Generar mes" para crear los registros pendientes.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Emprendimiento</TableHead>
                  <TableHead className="text-right">Alquiler esperado</TableHead>
                  <TableHead className="text-right">Monto pagado</TableHead>
                  <TableHead>Fecha pago</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagos.map((pago) => (
                  <TableRow key={pago.id ?? pago.emprendimiento_id}>
                    <TableCell className="font-medium">{pago.emprendimiento_nombre}</TableCell>
                    <TableCell className="text-right text-stone-500">
                      {formatLps(pago.valor_alquiler_esperado ?? 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {pago.estado === "pagado" ? (
                        <span className="font-semibold text-green-700">{formatLps(pago.monto)}</span>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-stone-500 text-sm">
                      {pago.fecha_pago ?? "—"}
                    </TableCell>
                    <TableCell>
                      {pago.estado === "pagado" ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                          Pagado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-orange-600 border-orange-300">
                          Pendiente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {pago.estado === "pendiente" ? (
                        pago.id ? (
                          <Button size="sm" onClick={() => abrirRegistrar(pago)}>
                            Registrar
                          </Button>
                        ) : (
                          <span className="text-xs text-stone-400">Sin registro</span>
                        )
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-stone-500 hover:text-red-600"
                          onClick={() => handleRevertir(pago)}
                        >
                          Revertir
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog registrar pago */}
      <Dialog open={!!pagoEditar} onOpenChange={(o) => { if (!o) setPagoEditar(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Registrar pago — {pagoEditar?.emprendimiento_nombre}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="monto-pago">Monto recibido (L)</Label>
              <Input
                id="monto-pago"
                type="number"
                min="0"
                step="0.01"
                value={formMonto}
                onChange={(e) => setFormMonto(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="fecha-pago">Fecha de pago</Label>
              <Input
                id="fecha-pago"
                type="date"
                value={formFecha}
                onChange={(e) => setFormFecha(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="notas-pago">Notas (opcional)</Label>
              <Input
                id="notas-pago"
                value={formNotas}
                onChange={(e) => setFormNotas(e.target.value)}
                placeholder="Referencia, número de recibo..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPagoEditar(null)}>
              Cancelar
            </Button>
            <Button onClick={handleRegistrar} disabled={guardando}>
              {guardando ? <Spinner className="h-4 w-4 mr-2" /> : null}
              Confirmar pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
