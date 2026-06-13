"use client"

import * as React from "react"
import { 
  DollarSign, 
  FileText, 
  Clock, 
  CreditCard,
  Search,
  Eye,
  Plus
} from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { useToast } from "@/hooks/use-toast"

import {
  getCuentasPorCobrar,
  getAllPagos,
  getDetallesVenta,
  registrarPago,
  type CuentaPorCobrar,
  type PagoVenta,
  type VentaDetalle
} from "@/lib/services/ventas"

export default function CuentasPorCobrarPage() {
  const [cuentas, setCuentas] = React.useState<CuentaPorCobrar[]>([])
  const [pagos, setPagos] = React.useState<(PagoVenta & { numero_factura?: string; cliente_nombre?: string })[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searchTerm, setSearchTerm] = React.useState("")
  
  // Payment dialog state
  const [selectedCuenta, setSelectedCuenta] = React.useState<CuentaPorCobrar | null>(null)
  const [showPagoDialog, setShowPagoDialog] = React.useState(false)
  const [pagoMonto, setPagoMonto] = React.useState("")
  const [pagoMetodo, setPagoMetodo] = React.useState("Efectivo")
  const [savingPago, setSavingPago] = React.useState(false)
  
  // Detail dialog state
  const [showDetalleDialog, setShowDetalleDialog] = React.useState(false)
  const [detalles, setDetalles] = React.useState<VentaDetalle[]>([])
  const [loadingDetalles, setLoadingDetalles] = React.useState(false)
  
  const { toast } = useToast()

  async function loadData() {
    setLoading(true)
    const [cuentasRes, pagosRes] = await Promise.all([
      getCuentasPorCobrar(),
      getAllPagos()
    ])
    
    if (!cuentasRes.error) setCuentas(cuentasRes.data)
    if (!pagosRes.error) setPagos(pagosRes.data)
    setLoading(false)
  }

  React.useEffect(() => {
    loadData()
  }, [])

  // KPI calculations
  const totalPorCobrar = cuentas.reduce((acc, c) => acc + c.saldo_pendiente, 0)
  const ventasPendientes = cuentas.length
  const totalAbonado = cuentas.reduce((acc, c) => acc + c.total_abonado, 0)
  const totalFacturado = cuentas.reduce((acc, c) => acc + c.total_venta, 0)

  // Filtered cuentas
  const filteredCuentas = cuentas.filter(c => 
    c.numero_factura.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.cliente_nombre.toLowerCase().includes(searchTerm.toLowerCase())
  )

  function openPagoDialog(cuenta: CuentaPorCobrar) {
    setSelectedCuenta(cuenta)
    setPagoMonto(cuenta.saldo_pendiente.toFixed(2))
    setPagoMetodo("Efectivo")
    setShowPagoDialog(true)
  }

  async function openDetalleDialog(cuenta: CuentaPorCobrar) {
    setSelectedCuenta(cuenta)
    setLoadingDetalles(true)
    setShowDetalleDialog(true)
    
    const { data } = await getDetallesVenta(cuenta.id)
    setDetalles(data)
    setLoadingDetalles(false)
  }

  async function handleRegistrarPago() {
    if (!selectedCuenta || !pagoMonto) return
    
    const monto = parseFloat(pagoMonto)
    if (isNaN(monto) || monto <= 0) {
      toast({ title: "Error", description: "Ingrese un monto valido", variant: "destructive" })
      return
    }
    
    if (monto > selectedCuenta.saldo_pendiente) {
      toast({ title: "Error", description: "El monto no puede ser mayor al saldo pendiente", variant: "destructive" })
      return
    }
    
    setSavingPago(true)
    const { error } = await registrarPago({
      venta_id: selectedCuenta.id,
      monto: monto,
      metodo_pago: pagoMetodo
    })
    setSavingPago(false)
    
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" })
    } else {
      toast({ title: "Pago registrado", description: `Se registro un abono de L ${monto.toFixed(2)}` })
      setShowPagoDialog(false)
      loadData()
    }
  }

  function getEstadoBadge(estado: string) {
    switch (estado) {
      case 'Pendiente':
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Pendiente</Badge>
      case 'Parcial':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Parcial</Badge>
      default:
        return <Badge variant="outline">{estado}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Cuentas por Cobrar</h1>
        <p className="text-sm md:text-base text-muted-foreground">Gestion de cartera y registro de pagos</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="p-3 md:p-6 pb-1 md:pb-2">
            <CardDescription className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm">
              <DollarSign className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Total</span> Por Cobrar
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            <p className="text-lg md:text-2xl font-bold text-red-600">L {totalPorCobrar.toFixed(2)}</p>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1 hidden sm:block">Saldo pendiente total</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="p-3 md:p-6 pb-1 md:pb-2">
            <CardDescription className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm">
              <FileText className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Facturas</span> Pendientes
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            <p className="text-lg md:text-2xl font-bold text-orange-600">{ventasPendientes}</p>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1 hidden sm:block">Con saldo por cobrar</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="p-3 md:p-6 pb-1 md:pb-2">
            <CardDescription className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm">
              <CreditCard className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Total</span> Abonado
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            <p className="text-lg md:text-2xl font-bold text-green-600">L {totalAbonado.toFixed(2)}</p>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1 hidden sm:block">Pagos parciales recibidos</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="p-3 md:p-6 pb-1 md:pb-2">
            <CardDescription className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm">
              <Clock className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Total</span> Facturado
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0">
            <p className="text-lg md:text-2xl font-bold text-blue-600">L {totalFacturado.toFixed(2)}</p>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1 hidden sm:block">Valor original facturas</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="cartera" className="space-y-4">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="cartera" className="flex-1 sm:flex-none text-xs sm:text-sm">Cartera</TabsTrigger>
          <TabsTrigger value="historial" className="flex-1 sm:flex-none text-xs sm:text-sm">Historial Pagos</TabsTrigger>
        </TabsList>

        <TabsContent value="cartera" className="space-y-4">
          {/* Search */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 md:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar factura o cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 text-sm"
              />
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden space-y-3">
            {filteredCuentas.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                No hay cuentas por cobrar pendientes
              </Card>
            ) : (
              filteredCuentas.map((cuenta) => (
                <Card key={cuenta.id} className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-mono font-medium text-primary">{cuenta.numero_factura}</p>
                      <p className="text-xs text-muted-foreground">{cuenta.fecha_venta?.split('T')[0] || ''}</p>
                    </div>
                    <Badge variant={cuenta.estado_pago === 'PAGADO' ? 'default' : cuenta.estado_pago === 'PARCIAL' ? 'secondary' : 'destructive'} className="text-xs">
                      {cuenta.estado_pago}
                    </Badge>
                  </div>
                  <p className="text-sm truncate mb-3">{cuenta.cliente_nombre}</p>
                  <div className="space-y-2 mb-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total:</span>
                      <span>L {cuenta.total_venta.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Abonado:</span>
                      <span className="text-green-600">L {cuenta.total_abonado.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-muted-foreground">Saldo:</span>
                      <span className="text-red-600">L {cuenta.saldo_pendiente.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={cuenta.porcentaje_pagado} className="flex-1 h-2" />
                      <span className="text-xs text-muted-foreground w-10">{cuenta.porcentaje_pagado.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" onClick={() => openPagoDialog(cuenta)}>
                      <Plus className="h-4 w-4 mr-1" /> Pago
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => viewPagos(cuenta)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Desktop Table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Factura</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Abonado</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead>Progreso</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-32">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCuentas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No hay cuentas por cobrar pendientes
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCuentas.map((cuenta) => (
                      <TableRow key={cuenta.id}>
                        <TableCell className="font-mono font-medium">{cuenta.numero_factura}</TableCell>
                        <TableCell>{cuenta.cliente_nombre}</TableCell>
                        <TableCell>{cuenta.fecha_venta?.split('T')[0] || ''}</TableCell>
                        <TableCell className="text-right">L {cuenta.total_venta.toFixed(2)}</TableCell>
                        <TableCell className="text-right text-green-600">L {cuenta.total_abonado.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-medium text-red-600">L {cuenta.saldo_pendiente.toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={cuenta.porcentaje_pagado} className="w-20 h-2" />
                            <span className="text-xs text-muted-foreground w-10">
                              {cuenta.porcentaje_pagado.toFixed(0)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{getEstadoBadge(cuenta.estado_pago)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDetalleDialog(cuenta)}
                              title="Ver detalle"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openPagoDialog(cuenta)}
                              title="Registrar pago"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historial" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Pagos Recibidos</CardTitle>
              <CardDescription>Registro cronologico de todos los abonos</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Factura</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Metodo</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No hay pagos registrados
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagos.map((pago) => (
                      <TableRow key={pago.id}>
                        <TableCell>{pago.fecha_pago?.split('T')[0] || ''}</TableCell>
                        <TableCell className="font-mono">{pago.numero_factura}</TableCell>
                        <TableCell>{pago.cliente_nombre}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{pago.metodo_pago}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          L {(pago.monto ?? 0).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Payment Dialog */}
      <Dialog open={showPagoDialog} onOpenChange={setShowPagoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Abono</DialogTitle>
            <DialogDescription>
              Factura: {selectedCuenta?.numero_factura} - {selectedCuenta?.cliente_nombre}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Current balance info */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Total Factura</p>
                <p className="font-semibold">L {(selectedCuenta?.total_venta ?? 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Saldo Pendiente</p>
                <p className="font-semibold text-red-600">L {(selectedCuenta?.saldo_pendiente ?? 0).toFixed(2)}</p>
              </div>
            </div>

            {/* Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progreso de pago</span>
                <span>{(selectedCuenta?.porcentaje_pagado ?? 0).toFixed(0)}%</span>
              </div>
              <Progress value={selectedCuenta?.porcentaje_pagado ?? 0} className="h-3" />
            </div>

            {/* Amount input */}
            <div className="space-y-2">
              <Label htmlFor="monto">Monto del Abono (L)</Label>
              <Input
                id="monto"
                type="number"
                step="0.01"
                min="0"
                max={selectedCuenta?.saldo_pendiente || 0}
                value={pagoMonto}
                onChange={(e) => setPagoMonto(e.target.value)}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                Maximo: L {(selectedCuenta?.saldo_pendiente ?? 0).toFixed(2)}
              </p>
            </div>

            {/* Payment method */}
            <div className="space-y-2">
              <Label>Metodo de Pago</Label>
              <Select value={pagoMetodo} onValueChange={setPagoMetodo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Efectivo">Efectivo</SelectItem>
                  <SelectItem value="Transferencia">Transferencia</SelectItem>
                  <SelectItem value="Tarjeta">Tarjeta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPagoDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRegistrarPago} disabled={savingPago}>
              {savingPago && <Spinner className="mr-2 h-4 w-4" />}
              Registrar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={showDetalleDialog} onOpenChange={setShowDetalleDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle de Factura</DialogTitle>
            <DialogDescription>
              {selectedCuenta?.numero_factura} - {selectedCuenta?.cliente_nombre}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Invoice info */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Total Factura</p>
                <p className="font-semibold">L {(selectedCuenta?.total_venta ?? 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Abonado</p>
                <p className="font-semibold text-green-600">L {(selectedCuenta?.total_abonado ?? 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Saldo</p>
                <p className="font-semibold text-red-600">L {(selectedCuenta?.saldo_pendiente ?? 0).toFixed(2)}</p>
              </div>
            </div>

            {/* Products table */}
            {loadingDetalles ? (
              <div className="flex justify-center py-8">
                <Spinner className="h-6 w-6" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Precio Unit.</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detalles.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>{d.producto_nombre}</TableCell>
                      <TableCell className="text-right">{d.cantidad}</TableCell>
                      <TableCell className="text-right">L {(d.precio_unitario ?? 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        L {((d.cantidad ?? 0) * (d.precio_unitario ?? 0)).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetalleDialog(false)}>
              Cerrar
            </Button>
            <Button onClick={() => {
              setShowDetalleDialog(false)
              if (selectedCuenta) openPagoDialog(selectedCuenta)
            }}>
              Registrar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
