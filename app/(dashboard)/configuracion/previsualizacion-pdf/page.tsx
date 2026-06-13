"use client"

import * as React from "react"
import { jsPDF } from "jspdf"
import { FileText, Eye, Download, ShoppingCart, Truck, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { getRazonSocial, type RazonSocial } from "@/lib/services/razon-social"
import { useToast } from "@/hooks/use-toast"

// Sample data for preview
const sampleVentaData = {
  encabezado: {
    numero_factura: "001-001-00012345",
    fecha_venta: new Date().toISOString(),
    cliente_nombre: "Juan Perez",
    subtotal: 2500.00,
    impuesto_total: 375.00,
    porcentaje_impuesto: 15,
    total_venta: 2875.00,
  },
  detalles: [
    { producto_nombre: "Bolso Cuero Premium", cantidad: 2, precio_unitario: 850.00 },
    { producto_nombre: "Cartera Ejecutiva", cantidad: 1, precio_unitario: 450.00 },
    { producto_nombre: "Mochila Urbana", cantidad: 1, precio_unitario: 350.00 },
  ],
  cliente: {
    nombre: "Juan Perez",
    rtn: "0801-1990-12345",
  }
}

const sampleCompraData = {
  encabezado: {
    id: 1,
    fecha_orden: new Date().toISOString(),
    fecha_tentativa: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    proveedor_nombre: "Distribuidora ABC",
    moneda: "LPS",
    total: 15750.00,
  },
  detalles: [
    { producto_nombre: "Cuero Italiano Premium", producto_codigo: "CIP-001", cantidad: 50, costo_unitario_moneda_origen: 150.00 },
    { producto_nombre: "Hebillas Metalicas", producto_codigo: "HM-002", cantidad: 100, costo_unitario_moneda_origen: 25.00 },
    { producto_nombre: "Forro Textil", producto_codigo: "FT-003", cantidad: 30, costo_unitario_moneda_origen: 75.00 },
  ],
  proveedor: {
    nombre: "Distribuidora ABC",
    rtn: "0801-2000-54321",
  }
}

export default function PrevisualizacionPDFPage() {
  const { toast } = useToast()
  const [razonSocial, setRazonSocial] = React.useState<RazonSocial | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [ventaPdfUrl, setVentaPdfUrl] = React.useState<string | null>(null)
  const [compraPdfUrl, setCompraPdfUrl] = React.useState<string | null>(null)
  const [activeTab, setActiveTab] = React.useState("venta")

  React.useEffect(() => {
    loadData()
  }, [])

  React.useEffect(() => {
    if (razonSocial !== null || !loading) {
      generatePreviews()
    }
  }, [razonSocial, loading])

  async function loadData() {
    setLoading(true)
    const res = await getRazonSocial()
    setRazonSocial(res.data)
    setLoading(false)
  }

  async function generatePreviews() {
    // Generate Venta PDF
    const ventaBlob = await generateVentaPdf()
    if (ventaBlob) {
      if (ventaPdfUrl) URL.revokeObjectURL(ventaPdfUrl)
      setVentaPdfUrl(URL.createObjectURL(ventaBlob))
    }

    // Generate Compra PDF
    const compraBlob = await generateCompraPdf()
    if (compraBlob) {
      if (compraPdfUrl) URL.revokeObjectURL(compraPdfUrl)
      setCompraPdfUrl(URL.createObjectURL(compraBlob))
    }
  }

  async function generateVentaPdf(): Promise<Blob | null> {
    try {
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      
      // White background
      doc.setFillColor(255, 255, 255)
      doc.rect(0, 0, pageWidth, pageHeight, 'F')
      
      // === LOGO - Top Left ===
      try {
        const logoUrl = razonSocial?.logo_url || ''
      if (!logoUrl) throw new Error("no-logo")
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.src = logoUrl
        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
          setTimeout(resolve, 1000)
        })
        if (img.complete && img.naturalWidth > 0) {
          doc.addImage(img, 'PNG', 20, 12, 50, 12)
        }
      } catch {
        doc.setTextColor(30, 30, 30)
        doc.setFontSize(14)
        doc.setFont("helvetica", "bold")
        doc.text(razonSocial?.nombre_empresa || "Mi Empresa", 20, 20)
      }
      
      // Contact details - left column
      doc.setFontSize(9)
      doc.setTextColor(100, 100, 100)
      let contactY = 32
      
      doc.setFont("helvetica", "normal")
      doc.text("Correo", 20, contactY)
      doc.text("Telefono", 20, contactY + 8)
      doc.text("Direccion", 20, contactY + 16)
      
      doc.setTextColor(30, 30, 30)
      doc.text(razonSocial?.correo || "correo@empresa.com", 20, contactY + 4)
      doc.text(razonSocial?.telefono || "0000-0000", 20, contactY + 12)
      doc.text((razonSocial?.direccion || "Direccion de la empresa").substring(0, 35), 20, contactY + 20)
      
      // Contact details - right column  
      doc.setTextColor(100, 100, 100)
      doc.text("RTN", 80, contactY)
      doc.setTextColor(30, 30, 30)
      doc.text(razonSocial?.documento || "0000-0000-00000", 80, contactY + 4)
      
      // === RIGHT SIDE: FACTURA Title ===
      doc.setTextColor(30, 30, 30)
      doc.setFontSize(28)
      doc.setFont("helvetica", "bold")
      doc.text("FACTURA", pageWidth - 20, 28, { align: "right" })
      
      // Invoice Number
      doc.setFontSize(12)
      doc.setFont("helvetica", "normal")
      doc.text(`#${sampleVentaData.encabezado.numero_factura}`, pageWidth - 20, 38, { align: "right" })
      
      // === CLIENTE Section ===
      const clienteY = 85
      
      // Divider line
      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.5)
      doc.line(20, clienteY - 5, pageWidth - 20, clienteY - 5)
      
      doc.setFontSize(9)
      doc.setTextColor(100, 100, 100)
      doc.text("Cliente", 20, clienteY)
      doc.text("RTN Cliente", 80, clienteY)
      doc.text("Fecha", pageWidth - 60, clienteY)
      
      doc.setTextColor(30, 30, 30)
      doc.setFont("helvetica", "normal")
      doc.text(sampleVentaData.cliente.nombre, 20, clienteY + 6)
      doc.text(sampleVentaData.cliente.rtn, 80, clienteY + 6)
      doc.text(sampleVentaData.encabezado.fecha_venta.split('T')[0], pageWidth - 60, clienteY + 6)
      
      // === DESCRIPCION Header ===
      const descY = 110
      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(30, 30, 30)
      doc.text("Descripcion", 20, descY)
      
      // Line under description
      doc.setDrawColor(30, 30, 30)
      doc.setLineWidth(0.8)
      doc.line(20, descY + 3, pageWidth - 20, descY + 3)
      
      // === ITEMS List ===
      let itemY = descY + 18
      
      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")
      
      sampleVentaData.detalles.forEach((d) => {
        const subtotal = d.cantidad * d.precio_unitario
        
        doc.setTextColor(30, 30, 30)
        doc.text(`${d.producto_nombre} (x${d.cantidad})`, 20, itemY)
        doc.text(`L ${subtotal.toFixed(2)}`, pageWidth - 20, itemY, { align: "right" })
        
        // Dotted line
        doc.setDrawColor(180, 180, 180)
        doc.setLineDashPattern([1, 1], 0)
        doc.line(20, itemY + 4, pageWidth - 20, itemY + 4)
        doc.setLineDashPattern([], 0)
        
        itemY += 12
      })
      
      // === TOTALS Section ===
      const totalsY = Math.max(itemY + 15, 180)
      
      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(100, 100, 100)
      
      // Subtotal
      doc.text("Subtotal", pageWidth - 80, totalsY)
      doc.setTextColor(30, 30, 30)
      doc.text(`L ${sampleVentaData.encabezado.subtotal.toFixed(2)}`, pageWidth - 20, totalsY, { align: "right" })
      
      // Dotted line
      doc.setDrawColor(180, 180, 180)
      doc.setLineDashPattern([1, 1], 0)
      doc.line(pageWidth - 80, totalsY + 3, pageWidth - 20, totalsY + 3)
      doc.setLineDashPattern([], 0)
      
      // ISV
      doc.setTextColor(100, 100, 100)
      doc.text(`ISV (${sampleVentaData.encabezado.porcentaje_impuesto}%)`, pageWidth - 80, totalsY + 12)
      doc.setTextColor(30, 30, 30)
      doc.text(`L ${sampleVentaData.encabezado.impuesto_total.toFixed(2)}`, pageWidth - 20, totalsY + 12, { align: "right" })
      
      // Dotted line
      doc.setDrawColor(180, 180, 180)
      doc.setLineDashPattern([1, 1], 0)
      doc.line(pageWidth - 80, totalsY + 15, pageWidth - 20, totalsY + 15)
      doc.setLineDashPattern([], 0)
      
      // Total
      doc.setFont("helvetica", "bold")
      doc.setTextColor(30, 30, 30)
      doc.text("Total", pageWidth - 80, totalsY + 26)
      doc.setFontSize(12)
      doc.text(`L ${sampleVentaData.encabezado.total_venta.toFixed(2)}`, pageWidth - 20, totalsY + 26, { align: "right" })
      
      // === FOOTER Section ===
      const footerY = pageHeight - 40
      
      // Divider line
      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.5)
      doc.setLineDashPattern([], 0)
      doc.line(20, footerY - 10, pageWidth - 20, footerY - 10)
      
      // Bank Details (left)
      doc.setFontSize(9)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(30, 30, 30)
      doc.text("Detalles de Pago", 20, footerY)
      
      doc.setFont("helvetica", "normal")
      doc.setTextColor(100, 100, 100)
      doc.setFontSize(8)
      doc.text(`RTN: ${razonSocial?.documento || "N/A"}`, 20, footerY + 8)
      doc.text(`Tel: ${razonSocial?.telefono || "N/A"}`, 20, footerY + 14)
      
      // Terms (right)
      doc.setFontSize(9)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(30, 30, 30)
      doc.text("Condiciones", 110, footerY)
      
      doc.setFont("helvetica", "normal")
      doc.setTextColor(100, 100, 100)
      doc.setFontSize(8)
      doc.text("Gracias por su compra. Este documento", 110, footerY + 8)
      doc.text("es valido como comprobante fiscal.", 110, footerY + 14)

      // Watermark EasyCount
      doc.setFontSize(7)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(168, 162, 158)
      doc.text("Generado por EasyCount", pageWidth / 2, pageHeight - 8, { align: "center" })

      return doc.output('blob')
    } catch (err) {
      console.error("Error generating venta PDF:", err)
      return null
    }
  }

  async function generateCompraPdf(): Promise<Blob | null> {
    try {
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      
      // White background
      doc.setFillColor(255, 255, 255)
      doc.rect(0, 0, pageWidth, pageHeight, 'F')
      
      // === LOGO - Top Left ===
      try {
        const logoUrl = razonSocial?.logo_url || ''
      if (!logoUrl) throw new Error("no-logo")
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.src = logoUrl
        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
          setTimeout(resolve, 1000)
        })
        if (img.complete && img.naturalWidth > 0) {
          doc.addImage(img, 'PNG', 20, 12, 50, 12)
        }
      } catch {
        doc.setTextColor(30, 30, 30)
        doc.setFontSize(14)
        doc.setFont("helvetica", "bold")
        doc.text(razonSocial?.nombre_empresa || "Mi Empresa", 20, 20)
      }
      
      // Contact details - left column
      doc.setFontSize(9)
      doc.setTextColor(100, 100, 100)
      let contactY = 32
      
      doc.setFont("helvetica", "normal")
      doc.text("Correo", 20, contactY)
      doc.text("Telefono", 20, contactY + 8)
      doc.text("Direccion", 20, contactY + 16)
      
      doc.setTextColor(30, 30, 30)
      doc.text(razonSocial?.correo || "correo@empresa.com", 20, contactY + 4)
      doc.text(razonSocial?.telefono || "0000-0000", 20, contactY + 12)
      doc.text((razonSocial?.direccion || "Direccion de la empresa").substring(0, 35), 20, contactY + 20)
      
      // Contact details - right column  
      doc.setTextColor(100, 100, 100)
      doc.text("RTN", 80, contactY)
      doc.setTextColor(30, 30, 30)
      doc.text(razonSocial?.documento || "0000-0000-00000", 80, contactY + 4)
      
      // === RIGHT SIDE: ORDEN DE COMPRA Title ===
      doc.setTextColor(30, 30, 30)
      doc.setFontSize(22)
      doc.setFont("helvetica", "bold")
      doc.text("ORDEN DE", pageWidth - 20, 24, { align: "right" })
      doc.text("COMPRA", pageWidth - 20, 34, { align: "right" })
      
      // Order Number
      doc.setFontSize(12)
      doc.setFont("helvetica", "normal")
      const orderNumber = `OC-${String(sampleCompraData.encabezado.id).padStart(5, '0')}`
      doc.text(`#${orderNumber}`, pageWidth - 20, 44, { align: "right" })
      
      // === PROVEEDOR Section ===
      const proveedorY = 85
      
      // Divider line
      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.5)
      doc.line(20, proveedorY - 5, pageWidth - 20, proveedorY - 5)
      
      doc.setFontSize(9)
      doc.setTextColor(100, 100, 100)
      doc.text("Proveedor", 20, proveedorY)
      doc.text("RTN Proveedor", 80, proveedorY)
      doc.text("Fecha Entrega", pageWidth - 60, proveedorY)
      
      doc.setTextColor(30, 30, 30)
      doc.setFont("helvetica", "normal")
      doc.text(sampleCompraData.proveedor.nombre, 20, proveedorY + 6)
      doc.text(sampleCompraData.proveedor.rtn, 80, proveedorY + 6)
      doc.text(sampleCompraData.encabezado.fecha_tentativa, pageWidth - 60, proveedorY + 6)
      
      // === DESCRIPCION Header ===
      const descY = 110
      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(30, 30, 30)
      doc.text("Descripcion", 20, descY)
      
      // Line under description
      doc.setDrawColor(30, 30, 30)
      doc.setLineWidth(0.8)
      doc.line(20, descY + 3, pageWidth - 20, descY + 3)
      
      // === ITEMS List ===
      let itemY = descY + 18
      const currency = sampleCompraData.encabezado.moneda === 'USD' ? '$' : 'L'
      
      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")
      
      sampleCompraData.detalles.forEach((d) => {
        const subtotal = d.cantidad * d.costo_unitario_moneda_origen
        
        doc.setTextColor(30, 30, 30)
        doc.text(`${d.producto_nombre} (x${d.cantidad})`, 20, itemY)
        doc.text(`${currency} ${subtotal.toFixed(2)}`, pageWidth - 20, itemY, { align: "right" })
        
        // Dotted line
        doc.setDrawColor(180, 180, 180)
        doc.setLineDashPattern([1, 1], 0)
        doc.line(20, itemY + 4, pageWidth - 20, itemY + 4)
        doc.setLineDashPattern([], 0)
        
        itemY += 12
      })
      
      // === TOTALS Section ===
      const totalsY = Math.max(itemY + 15, 180)
      
      // Total
      doc.setFont("helvetica", "bold")
      doc.setTextColor(30, 30, 30)
      doc.setFontSize(10)
      doc.text("Total", pageWidth - 80, totalsY)
      doc.setFontSize(12)
      doc.text(`${currency} ${sampleCompraData.encabezado.total.toFixed(2)}`, pageWidth - 20, totalsY, { align: "right" })
      
      // === FOOTER Section ===
      const footerY = pageHeight - 40
      
      // Divider line
      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.5)
      doc.setLineDashPattern([], 0)
      doc.line(20, footerY - 10, pageWidth - 20, footerY - 10)
      
      // Notes (left)
      doc.setFontSize(9)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(30, 30, 30)
      doc.text("Notas", 20, footerY)
      
      doc.setFont("helvetica", "normal")
      doc.setTextColor(100, 100, 100)
      doc.setFontSize(8)
      doc.text("Favor enviar mercancia segun especificaciones.", 20, footerY + 8)
      doc.text("Confirmar entrega con anticipacion.", 20, footerY + 14)
      
      // Authorization (right)
      doc.setFontSize(9)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(30, 30, 30)
      doc.text("Autorizacion", 110, footerY)
      
      doc.setFont("helvetica", "normal")
      doc.setTextColor(100, 100, 100)
      doc.setFontSize(8)
      doc.text("Orden autorizada por el departamento", 110, footerY + 8)
      doc.text("de compras de la empresa.", 110, footerY + 14)

      // Watermark EasyCount
      doc.setFontSize(7)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(168, 162, 158)
      doc.text("Generado por EasyCount", pageWidth / 2, pageHeight - 8, { align: "center" })

      return doc.output('blob')
    } catch (err) {
      console.error("Error generating compra PDF:", err)
      return null
    }
  }

  function downloadPdf(type: 'venta' | 'compra') {
    const url = type === 'venta' ? ventaPdfUrl : compraPdfUrl
    if (!url) return

    const link = document.createElement('a')
    link.href = url
    link.download = type === 'venta' ? 'Factura_Ejemplo.pdf' : 'OrdenCompra_Ejemplo.pdf'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    toast({ title: "PDF Descargado", description: `El PDF de ejemplo se descargo correctamente` })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-orange-50/30 to-amber-50/20 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-stone-800 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100">
                <Eye className="h-6 w-6 text-amber-700" />
              </div>
              Previsualizacion de PDFs
            </h1>
            <p className="text-stone-500 mt-1">
              Visualiza como quedaran tus facturas y ordenes de compra antes de generarlas
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => generatePreviews()}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar Vista
          </Button>
        </div>

        {/* PDF Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 bg-stone-100/80">
            <TabsTrigger value="venta" className="gap-2 data-[state=active]:bg-white">
              <ShoppingCart className="h-4 w-4" />
              Factura de Venta
            </TabsTrigger>
            <TabsTrigger value="compra" className="gap-2 data-[state=active]:bg-white">
              <Truck className="h-4 w-4" />
              Orden de Compra
            </TabsTrigger>
          </TabsList>

          <TabsContent value="venta" className="mt-6">
            <Card className="bg-white/70 backdrop-blur-sm border-stone-200/60">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-amber-600" />
                    Factura de Venta
                  </CardTitle>
                  <CardDescription>
                    Vista previa del formato de factura que se genera al realizar una venta
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">Ejemplo</Badge>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => downloadPdf('venta')}
                    disabled={!ventaPdfUrl}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Descargar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {ventaPdfUrl ? (
                  <div className="border border-stone-200 rounded-lg overflow-hidden bg-stone-100">
                    <iframe
                      src={ventaPdfUrl}
                      className="w-full h-[600px] md:h-[700px]"
                      title="Preview Factura de Venta"
                    />
                  </div>
                ) : (
                  <div className="h-[600px] flex items-center justify-center bg-stone-50 rounded-lg border border-dashed border-stone-300">
                    <div className="text-center text-stone-500">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                      <p>Generando vista previa...</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compra" className="mt-6">
            <Card className="bg-white/70 backdrop-blur-sm border-stone-200/60">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-amber-600" />
                    Orden de Compra
                  </CardTitle>
                  <CardDescription>
                    Vista previa del formato de orden que se genera al crear una compra
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">Ejemplo</Badge>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => downloadPdf('compra')}
                    disabled={!compraPdfUrl}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Descargar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {compraPdfUrl ? (
                  <div className="border border-stone-200 rounded-lg overflow-hidden bg-stone-100">
                    <iframe
                      src={compraPdfUrl}
                      className="w-full h-[600px] md:h-[700px]"
                      title="Preview Orden de Compra"
                    />
                  </div>
                ) : (
                  <div className="h-[600px] flex items-center justify-center bg-stone-50 rounded-lg border border-dashed border-stone-300">
                    <div className="text-center text-stone-500">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                      <p>Generando vista previa...</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Info Card */}
        <Card className="bg-amber-50/50 border-amber-200/60">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-amber-100">
                <Eye className="h-5 w-5 text-amber-700" />
              </div>
              <div className="space-y-1">
                <h3 className="font-medium text-amber-900">Informacion sobre la vista previa</h3>
                <p className="text-sm text-amber-700">
                  Los PDFs mostrados son ejemplos con datos ficticios. La informacion de tu empresa 
                  (logo, nombre, RTN, direccion) se obtiene de la configuracion de Razon Social. 
                  Los cambios que realices ahi se reflejaran automaticamente en todas las facturas y ordenes.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
