"use client"

import { useEffect, useState, useCallback } from "react"
import { 
  PackageCheck, 
  Truck,
  DollarSign,
  ArrowRight,
  Calculator,
  Warehouse,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Download,
  Trash2
} from "lucide-react"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
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
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  type CompraEncabezado, 
  type CompraDetalle,
  getCompras,
  getDetallesCompra,
  procesarRecepcion,
  calcularProrrateo,
  deleteCompra,
  getCompraById
} from "@/lib/services/compras"
import { type Proveedor, getProveedores } from "@/lib/services/catalogos"
import { getRazonSocialForPdf } from "@/lib/services/ventas"
import { type Almacen, type Localizacion, getAlmacenes, getLocalizaciones } from "@/lib/services/catalogos"

export default function RecepcionPage() {
  const [comprasPendientes, setComprasPendientes] = useState<CompraEncabezado[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [localizaciones, setLocalizaciones] = useState<Localizacion[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  
  // Selected purchase
  const [selectedCompra, setSelectedCompra] = useState<CompraEncabezado | null>(null)
  const [detalles, setDetalles] = useState<CompraDetalle[]>([])
  const [loadingDetalles, setLoadingDetalles] = useState(false)
  
  // Reception form
  const [formData, setFormData] = useState({
    costos_importacion: 0,
    impuestos_compra: 0,
    otros_costos: 0,
    tasa_cambio: 1,
    almacen_id: 0,
    localizacion_id: 0
  })
  
  // Calculated costs
  const [costosCalculados, setCostosCalculados] = useState<{
    detalle_id: number
    producto_id: number
    cantidad: number
    costo_final_local: number
  }[]>([])
  
  const { toast } = useToast()

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [comprasRes, almRes, provRes] = await Promise.all([
      getCompras('Pendiente'),
      getAlmacenes(),
      getProveedores()
    ])
    
    if (comprasRes.error) {
      toast({ title: "Error", description: comprasRes.error, variant: "destructive" })
    }
    setComprasPendientes(comprasRes.data)
    setAlmacenes(almRes.data)
    setProveedores(provRes.data)
    setLoading(false)
  }, [toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Fetch locations when warehouse changes
  useEffect(() => {
    if (formData.almacen_id) {
      getLocalizaciones(formData.almacen_id).then(res => {
        setLocalizaciones(res.data)
        setFormData(prev => ({ ...prev, localizacion_id: 0 }))
      })
    } else {
      setLocalizaciones([])
    }
  }, [formData.almacen_id])

  // Recalculate costs when values change
  useEffect(() => {
    if (detalles.length > 0 && selectedCompra) {
      const costosAdicionales = formData.costos_importacion + formData.impuestos_compra + formData.otros_costos
      const tasa = selectedCompra.moneda === 'USD' ? formData.tasa_cambio : 1
      
      const calculados = calcularProrrateo(
        detalles,
        costosAdicionales,
        selectedCompra.moneda,
        tasa
      )
      setCostosCalculados(calculados)
    }
  }, [detalles, formData.costos_importacion, formData.impuestos_compra, formData.otros_costos, formData.tasa_cambio, selectedCompra])

  const handleSelectCompra = async (compra: CompraEncabezado) => {
    setSelectedCompra(compra)
    setLoadingDetalles(true)
    
    // Reset form
    setFormData({
      costos_importacion: 0,
      impuestos_compra: 0,
      otros_costos: 0,
      tasa_cambio: compra.moneda === 'USD' ? 24.5 : 1,
      almacen_id: 0,
      localizacion_id: 0
    })
    
    const { data, error } = await getDetallesCompra(compra.id!)
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" })
    }
    setDetalles(data)
    setLoadingDetalles(false)
  }

  const handleProcessRecepcion = async () => {
    if (!selectedCompra) return
    
    if (!formData.almacen_id || !formData.localizacion_id) {
      toast({ title: "Error", description: "Seleccione almacen y localizacion", variant: "destructive" })
      return
    }
    
    if (selectedCompra.moneda === 'USD' && formData.tasa_cambio <= 0) {
      toast({ title: "Error", description: "Ingrese una tasa de cambio valida", variant: "destructive" })
      return
    }

    setProcessing(true)
    
    const recepcionData = {
      compraId: selectedCompra.id!,
      costos_importacion: formData.costos_importacion,
      impuestos_compra: formData.impuestos_compra,
      otros_costos: formData.otros_costos,
      tasa_cambio: formData.tasa_cambio,
      almacen_id: formData.almacen_id,
      localizacion_id: formData.localizacion_id,
      detalles: costosCalculados.map(c => ({
        detalle_id: c.detalle_id,
        producto_id: c.producto_id,
        cantidad_recibida: c.cantidad,
        costo_final_local: c.costo_final_local
      }))
    }

    const { success, error } = await procesarRecepcion(recepcionData)
    setProcessing(false)

    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" })
    } else if (success) {
      toast({ 
        title: "Recepcion Exitosa", 
        description: "La mercancia ha sido ingresada al inventario y los costos actualizados" 
      })
      setSelectedCompra(null)
      setDetalles([])
      setCostosCalculados([])
      fetchData()
    }
  }

  // PDF Generation for Purchase Order
  const generateOrdenCompraPDF = async (compraId: number, e?: React.MouseEvent) => {
    e?.stopPropagation()
    
    const [compraRes, detallesRes, razonSocial] = await Promise.all([
      getCompraById(compraId),
      getDetallesCompra(compraId),
      getRazonSocialForPdf()
    ])
    
    if (compraRes.error || !compraRes.data) {
      toast({ title: "Error", description: "No se pudo cargar la orden", variant: "destructive" })
      return
    }
    
    const compra = compraRes.data
    const detallesCompra = detallesRes.data
    const proveedor = proveedores.find(p => p.id === compra.proveedor_id)
    
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    
    // Header
    doc.setFontSize(16)
    doc.setFont("helvetica", "bold")
    doc.text(razonSocial?.nombre_empresa || "Mi Empresa", pageWidth / 2, 18, { align: "center" })
    
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    if (razonSocial?.nombre_comercial) {
      doc.text(razonSocial.nombre_comercial, pageWidth / 2, 24, { align: "center" })
    }
    doc.text(`RTN: ${razonSocial?.documento || "N/A"}`, pageWidth / 2, 30, { align: "center" })
    doc.text(razonSocial?.direccion || "", pageWidth / 2, 36, { align: "center" })
    doc.text(`Tel: ${razonSocial?.telefono || ""} | ${razonSocial?.correo || ""}`, pageWidth / 2, 42, { align: "center" })
    
    // Title
    doc.setFillColor(192, 122, 92)
    doc.rect(0, 48, pageWidth, 10, "F")
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text("ORDEN DE COMPRA", pageWidth / 2, 55, { align: "center" })
    
    // Order Info
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    const orderNumber = `OC-${String(compra.id).padStart(5, '0')}`
    doc.text(`No: ${orderNumber}`, 15, 68)
    doc.setFont("helvetica", "normal")
    doc.text(`Fecha: ${compra.fecha_orden?.split('T')[0] || new Date().toISOString().split('T')[0]}`, pageWidth - 15, 68, { align: "right" })
    
    // Supplier Info
    doc.setDrawColor(200, 200, 200)
    doc.roundedRect(15, 74, pageWidth - 30, 24, 2, 2, "S")
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.text("Proveedor:", 20, 82)
    doc.setFont("helvetica", "normal")
    doc.text(proveedor?.nombre || compra.proveedor_nombre || "N/A", 48, 82)
    doc.setFont("helvetica", "bold")
    doc.text("RTN:", 20, 89)
    doc.setFont("helvetica", "normal")
    doc.text(proveedor?.rtn || "N/A", 32, 89)
    doc.setFont("helvetica", "bold")
    doc.text("Fecha Entrega:", 100, 89)
    doc.setFont("helvetica", "normal")
    doc.text(compra.fecha_tentativa || "N/A", 134, 89)
    doc.setFont("helvetica", "bold")
    doc.text("Moneda:", 20, 95)
    doc.setFont("helvetica", "normal")
    doc.text(compra.moneda === 'USD' ? 'Dolares (USD)' : 'Lempiras (LPS)', 42, 95)
    
    // Products Table
    const tableData = detallesCompra.map(d => [
      d.cantidad.toString(),
      d.producto_codigo || "",
      (d.producto_nombre || "").substring(0, 35),
      `${compra.moneda === 'USD' ? '$' : 'L'} ${(d.costo_unitario_moneda_origen ?? 0).toFixed(2)}`,
      `${compra.moneda === 'USD' ? '$' : 'L'} ${(d.cantidad * d.costo_unitario_moneda_origen).toFixed(2)}`
    ])
    
    autoTable(doc, {
      startY: 104,
      head: [["Cant.", "Codigo", "Descripcion", "Costo Unit.", "Subtotal"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [192, 122, 92], textColor: 255, fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { halign: "center", cellWidth: 15 },
        1: { cellWidth: 25 },
        2: { cellWidth: "auto" },
        3: { halign: "right", cellWidth: 28 },
        4: { halign: "right", cellWidth: 28 }
      },
      margin: { left: 15, right: 15 }
    })
    
    const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
    doc.setDrawColor(200, 200, 200)
    doc.line(pageWidth - 80, finalY - 5, pageWidth - 15, finalY - 5)
    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.text("TOTAL:", pageWidth - 70, finalY)
    doc.text(`${compra.moneda === 'USD' ? '$' : 'L'} ${(compra.total ?? 0).toFixed(2)}`, pageWidth - 15, finalY, { align: "right" })
    
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(100, 100, 100)
    doc.text("Nota: Favor enviar mercancia segun especificaciones", 15, finalY + 20)
    doc.text("Confirmar entrega con anticipacion", 15, finalY + 26)
    
    // Watermark EasyCount
    const pageHeight = doc.internal.pageSize.getHeight()
    doc.setFontSize(7)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(168, 162, 158)
    doc.text("Generado por EasyCount", pageWidth / 2, pageHeight - 8, { align: "center" })
    
    const filename = `OrdenCompra_${orderNumber}.pdf`
    try {
      const pdfBlob = doc.output('blob')
      const blobUrl = URL.createObjectURL(pdfBlob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100)
    } catch {
      doc.save(filename)
    }
  }

  const handleDeleteCompra = async (compraId: number, e?: React.MouseEvent) => {
    e?.stopPropagation()
    
    if (!confirm("¿Esta seguro de eliminar esta orden de compra? Esta accion no se puede deshacer.")) {
      return
    }
    
    setDeleting(compraId)
    const { success, error } = await deleteCompra(compraId)
    setDeleting(null)
    
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" })
    } else if (success) {
      toast({ title: "Eliminada", description: "La orden de compra ha sido eliminada" })
      if (selectedCompra?.id === compraId) {
        setSelectedCompra(null)
        setDetalles([])
        setCostosCalculados([])
      }
      fetchData()
    }
  }

  const formatCurrency = (value: number, moneda: string = "LPS") => {
    const prefix = moneda === "USD" ? "$ " : "L "
    return prefix + value.toLocaleString("es-HN", { minimumFractionDigits: 2 })
  }

  const formatDate = (date?: string | null) => {
    if (!date) return "—"
    const d = new Date(date)
    if (isNaN(d.getTime())) return "—"
    return d.toLocaleDateString("es-HN", {
      year: "numeric",
      month: "short",
      day: "numeric"
    })
  }

  const calcularTotales = () => {
    const subtotalOriginal = detalles.reduce((acc, d) => acc + (d.cantidad * d.costo_unitario_moneda_origen), 0)
    const subtotalLPS = selectedCompra?.moneda === 'USD' 
      ? subtotalOriginal * formData.tasa_cambio 
      : subtotalOriginal
    const costosAdicionales = formData.costos_importacion + formData.impuestos_compra + formData.otros_costos
    const totalFinal = subtotalLPS + costosAdicionales
    
    return { subtotalOriginal, subtotalLPS, costosAdicionales, totalFinal }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold text-foreground">Recepcion de Mercancia</h1>
        <p className="text-sm md:text-base text-muted-foreground">Procese la recepcion de compras pendientes y calcule el prorrateo de costos</p>
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
        {/* Pending Orders List */}
        <Card className="lg:col-span-1">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Compras Pendientes
            </CardTitle>
            <CardDescription className="text-xs md:text-sm">Seleccione una orden para procesar</CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0 space-y-2">
            {comprasPendientes.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No hay compras pendientes</p>
              </div>
            ) : (
              comprasPendientes.map((compra) => (
                <div
                  key={compra.id}
                  className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                    selectedCompra?.id === compra.id 
                      ? "bg-primary/10 border-primary" 
                      : "hover:bg-muted"
                  }`}
                  onClick={() => handleSelectCompra(compra)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">OC-{String(compra.id).padStart(5, '0')}</span>
                    <Badge variant="secondary">{compra.moneda}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{compra.proveedor_nombre}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">{formatDate(compra.fecha_orden)}</span>
                    <span className="text-sm font-medium">{formatCurrency(compra.total || 0, compra.moneda)}</span>
                  </div>
                  {/* Action buttons */}
                  <div className="flex items-center gap-1 mt-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-xs gap-1"
                      onClick={(e) => generateOrdenCompraPDF(compra.id!, e)}
                    >
                      <Download className="h-3.5 w-3.5" />
                      PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-xs gap-1 text-destructive hover:bg-destructive/10"
                      onClick={(e) => handleDeleteCompra(compra.id!, e)}
                      disabled={deleting === compra.id}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {deleting === compra.id ? "..." : "Eliminar"}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Reception Panel */}
        <Card className="lg:col-span-2">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-base flex items-center gap-2">
              <PackageCheck className="h-4 w-4" />
              Procesar Recepcion
            </CardTitle>
            <CardDescription className="text-xs md:text-sm">
              {selectedCompra 
                ? `Orden OC-${String(selectedCompra.id).padStart(5, '0')} - ${selectedCompra.proveedor_nombre}`
                : "Seleccione una orden de compra"
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            {!selectedCompra ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Seleccione una orden de compra de la lista</p>
              </div>
            ) : loadingDetalles ? (
              <div className="flex items-center justify-center py-12">
                <Spinner className="h-8 w-8" />
              </div>
            ) : (
              <div className="space-y-4 md:space-y-6">
                {/* Products — mobile cards + desktop table */}
                <div>
                  <h4 className="text-sm font-medium mb-3">Productos a Recibir</h4>

                  {/* Mobile */}
                  <div className="block md:hidden space-y-2">
                    {detalles.map((d, idx) => (
                      <div key={d.id} className="border rounded-lg p-3 bg-card text-sm">
                        <p className="font-medium">{d.producto_nombre}</p>
                        <p className="text-xs text-muted-foreground font-mono mb-2">{d.producto_codigo}</p>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <p className="text-muted-foreground">Cant.</p>
                            <p className="font-medium">{d.cantidad}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Costo orig.</p>
                            <p className="font-medium">{formatCurrency(d.costo_unitario_moneda_origen, selectedCompra!.moneda)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Costo final</p>
                            <p className="font-medium text-primary">
                              {costosCalculados[idx] ? formatCurrency(costosCalculados[idx].costo_final_local, 'LPS') : '-'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop */}
                  <Table className="hidden md:table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Cant.</TableHead>
                        <TableHead className="text-right">Costo Original</TableHead>
                        <TableHead className="text-right">Costo Final (LPS)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detalles.map((d, idx) => (
                        <TableRow key={d.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{d.producto_nombre}</p>
                              <p className="text-xs text-muted-foreground">{d.producto_codigo}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{d.cantidad}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(d.costo_unitario_moneda_origen, selectedCompra!.moneda)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {costosCalculados[idx]
                              ? formatCurrency(costosCalculados[idx].costo_final_local, 'LPS')
                              : '-'
                            }
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <Separator />

                {/* Additional Costs */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Calculator className="h-4 w-4" />
                    Costos Adicionales y Prorrateo
                  </h4>
                  
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {selectedCompra.moneda === 'USD' && (
                      <div className="grid gap-2">
                        <Label className="text-xs">Tasa de Cambio (USD a LPS)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.tasa_cambio}
                          onChange={(e) => setFormData({ ...formData, tasa_cambio: Number(e.target.value) })}
                        />
                      </div>
                    )}
                    <div className="grid gap-2">
                      <Label className="text-xs">Costos Importacion (LPS)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.costos_importacion}
                        onChange={(e) => setFormData({ ...formData, costos_importacion: Number(e.target.value) })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-xs">Impuestos Compra (LPS)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.impuestos_compra}
                        onChange={(e) => setFormData({ ...formData, impuestos_compra: Number(e.target.value) })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-xs">Otros Costos (LPS)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.otros_costos}
                        onChange={(e) => setFormData({ ...formData, otros_costos: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Warehouse Selection */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Warehouse className="h-4 w-4" />
                    Destino de Mercancia
                  </h4>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label className="text-xs flex items-center gap-1">
                        <Warehouse className="h-3 w-3" />
                        Almacen
                      </Label>
                      <Select 
                        value={formData.almacen_id ? String(formData.almacen_id) : ""} 
                        onValueChange={(v) => setFormData({ ...formData, almacen_id: Number(v) })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione almacen" />
                        </SelectTrigger>
                        <SelectContent>
                          {almacenes.map(a => (
                            <SelectItem key={a.id} value={String(a.id)}>{a.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-xs flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Localizacion
                      </Label>
                      <Select 
                        value={formData.localizacion_id ? String(formData.localizacion_id) : ""} 
                        onValueChange={(v) => setFormData({ ...formData, localizacion_id: Number(v) })}
                        disabled={!formData.almacen_id}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={formData.almacen_id ? "Seleccione localizacion" : "Primero seleccione almacen"} />
                        </SelectTrigger>
                        <SelectContent>
                          {localizaciones.map(l => (
                            <SelectItem key={l.id} value={String(l.id)}>{l.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Cost Summary */}
                <div className="rounded-lg bg-muted/50 p-4">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Resumen de Costos
                  </h4>
                  
                  {(() => {
                    const totales = calcularTotales()
                    return (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal ({selectedCompra.moneda})</span>
                          <span>{formatCurrency(totales.subtotalOriginal, selectedCompra.moneda)}</span>
                        </div>
                        {selectedCompra.moneda === 'USD' && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              Subtotal en LPS (x {formData.tasa_cambio})
                            </span>
                            <span>{formatCurrency(totales.subtotalLPS, 'LPS')}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">+ Costos Adicionales</span>
                          <span>{formatCurrency(totales.costosAdicionales, 'LPS')}</span>
                        </div>
                        <Separator className="my-2" />
                        <div className="flex justify-between font-semibold">
                          <span>Total Final (LPS)</span>
                          <span className="text-lg">{formatCurrency(totales.totalFinal, 'LPS')}</span>
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {/* Action Button */}
                <div className="flex justify-end">
                  <Button 
                    size="lg" 
                    onClick={handleProcessRecepcion}
                    disabled={processing || !formData.almacen_id || !formData.localizacion_id}
                  >
                    {processing && <Spinner className="mr-2 h-4 w-4" />}
                    <PackageCheck className="mr-2 h-4 w-4" />
                    Confirmar Recepcion
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
