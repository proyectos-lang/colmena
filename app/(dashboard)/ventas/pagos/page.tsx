"use client"

import * as React from "react"
import { CreditCard, DollarSign, Clock, CheckCircle } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { 
  getVentas,
  type VentaEncabezado
} from "@/lib/services/ventas"

export default function PagosPage() {
  const { toast } = useToast()
  
  const [loading, setLoading] = React.useState(true)
  const [ventas, setVentas] = React.useState<VentaEncabezado[]>([])

  React.useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const { data } = await getVentas()
      setVentas(data)
    } catch (err) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const ventasPendientes = ventas.filter(v => v.estado_pago === "Pendiente")
  const ventasParciales = ventas.filter(v => v.estado_pago === "Parcial")
  const ventasPagadas = ventas.filter(v => v.estado_pago === "Pagado")

  const totalPendiente = ventasPendientes.reduce((acc, v) => acc + (v.total_venta ?? 0), 0)
  const totalParcial = ventasParciales.reduce((acc, v) => acc + (v.total_venta ?? 0), 0)
  const totalPagado = ventasPagadas.reduce((acc, v) => acc + (v.total_venta ?? 0), 0)

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case "Pagado":
        return <Badge className="bg-green-500 hover:bg-green-600">Pagado</Badge>
      case "Parcial":
        return <Badge className="bg-amber-500 hover:bg-amber-600">Parcial</Badge>
      default:
        return <Badge variant="secondary">Pendiente</Badge>
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Estado de Pagos</h1>
        <p className="text-muted-foreground">Resumen de cuentas por cobrar</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">L {totalPendiente.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{ventasPendientes.length} facturas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pagos Parciales</CardTitle>
            <CreditCard className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">L {totalParcial.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{ventasParciales.length} facturas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completados</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">L {totalPagado.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{ventasPagadas.length} facturas</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cuentas por Cobrar</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Factura</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...ventasPendientes, ...ventasParciales].length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No hay cuentas pendientes
                  </TableCell>
                </TableRow>
              ) : (
                [...ventasPendientes, ...ventasParciales].map(venta => (
                  <TableRow key={venta.id}>
                    <TableCell className="font-mono font-medium">{venta.numero_factura}</TableCell>
                    <TableCell>{venta.fecha_venta?.split('T')[0] || ''}</TableCell>
                    <TableCell>{venta.cliente_nombre}</TableCell>
                    <TableCell className="text-right font-medium">L {(venta.total_venta ?? 0).toFixed(2)}</TableCell>
                    <TableCell>{getEstadoBadge(venta.estado_pago)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
