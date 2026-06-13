"use client"

import * as React from "react"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { 
  ArrowLeftRight, 
  Package, 
  Warehouse, 
  MapPin, 
  Save, 
  Search, 
  Trash2, 
  Plus,
  AlertTriangle,
  CheckCircle2,
  Boxes,
  ChevronsUpDown,
  Check,
  FileText
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { getProductos, getAlmacenes, getLocalizaciones, type Producto, type Almacen, type Localizacion } from "@/lib/services/catalogos"
import { getStockMultipleProducts, procesarTrasladosMultiples, type TrasladoLineaData } from "@/lib/services/inventario"
import { getRazonSocial } from "@/lib/services/razon-social"
import { Spinner } from "@/components/ui/spinner"

interface LineaTraslado {
  producto_id: number
  producto_nombre: string
  producto_codigo: string
  cantidad: number
  stock_origen: number
  costo_unitario: number
  precio_venta: number
  hasError: boolean
}

export default function TrasladosPage() {
  const { toast } = useToast()
  const [productos, setProductos] = React.useState<Producto[]>([])
  const [almacenes, setAlmacenes] = React.useState<Almacen[]>([])
  const [localizacionesOrigen, setLocalizacionesOrigen] = React.useState<Localizacion[]>([])
  const [localizacionesDestino, setLocalizacionesDestino] = React.useState<Localizacion[]>([])
  const [saving, setSaving] = React.useState(false)
  const [loadingStock, setLoadingStock] = React.useState(false)
  const [comboboxOpen, setComboboxOpen] = React.useState(false)

  // Fixed origin/destination for all transfers
  const [origenAlmacenId, setOrigenAlmacenId] = React.useState("")
  const [origenLocalizacionId, setOrigenLocalizacionId] = React.useState("")
  const [destinoAlmacenId, setDestinoAlmacenId] = React.useState("")
  const [destinoLocalizacionId, setDestinoLocalizacionId] = React.useState("")

  // Preparation list
  const [lineas, setLineas] = React.useState<LineaTraslado[]>([])
  const [stockCache, setStockCache] = React.useState<Record<number, number>>({})

  React.useEffect(() => {
    loadData()
  }, [])

  // Load stock when origin changes
  React.useEffect(() => {
    if (origenLocalizacionId && lineas.length > 0) {
      loadStockForProducts(lineas.map(l => l.producto_id))
    }
  }, [origenLocalizacionId])

  async function loadData() {
    const [prodRes, almRes] = await Promise.all([
      getProductos(),
      getAlmacenes()
    ])
    
    if (prodRes.error) toast({ title: "Error", description: prodRes.error, variant: "destructive" })
    if (almRes.error) toast({ title: "Error", description: almRes.error, variant: "destructive" })
    
    setProductos(prodRes.data)
    setAlmacenes(almRes.data)
  }

  async function loadStockForProducts(productoIds: number[]) {
    if (!origenLocalizacionId || productoIds.length === 0) return
    
    setLoadingStock(true)
    const { data, error } = await getStockMultipleProducts(productoIds, parseInt(origenLocalizacionId))
    setLoadingStock(false)
    
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" })
      return
    }
    
    setStockCache(prev => ({ ...prev, ...data }))
    
    // Update lineas with new stock
    setLineas(prev => prev.map(l => ({
      ...l,
      stock_origen: data[l.producto_id] ?? l.stock_origen,
      hasError: l.cantidad > (data[l.producto_id] ?? 0)
    })))
  }

  async function loadLocalizacionesOrigen(almacenId: string) {
    if (!almacenId) {
      setLocalizacionesOrigen([])
      return
    }
    const { data, error } = await getLocalizaciones(parseInt(almacenId))
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" })
      return
    }
    setLocalizacionesOrigen(data)
  }

  async function loadLocalizacionesDestino(almacenId: string) {
    if (!almacenId) {
      setLocalizacionesDestino([])
      return
    }
    const { data, error } = await getLocalizaciones(parseInt(almacenId))
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" })
      return
    }
    setLocalizacionesDestino(data)
  }

  function handleOrigenAlmacenChange(value: string) {
    setOrigenAlmacenId(value)
    setOrigenLocalizacionId("")
    setStockCache({})
    loadLocalizacionesOrigen(value)
  }

  function handleOrigenLocalizacionChange(value: string) {
    setOrigenLocalizacionId(value)
    // Load stock for all products in the list
    if (lineas.length > 0) {
      loadStockForProducts(lineas.map(l => l.producto_id))
    }
  }

  function handleDestinoAlmacenChange(value: string) {
    setDestinoAlmacenId(value)
    setDestinoLocalizacionId("")
    loadLocalizacionesDestino(value)
  }

  async function addProductToList(producto: Producto) {
    // Check if already in list
    if (lineas.some(l => l.producto_id === producto.id)) {
      toast({ title: "Producto ya agregado", description: "Este producto ya esta en la lista de traslado", variant: "destructive" })
      return
    }

    // Get stock for this product in origin location
    let stockOrigen = 0
    if (origenLocalizacionId) {
      const cached = stockCache[producto.id!]
      if (cached !== undefined) {
        stockOrigen = cached
      } else {
        setLoadingStock(true)
        const { data } = await getStockMultipleProducts([producto.id!], parseInt(origenLocalizacionId))
        setLoadingStock(false)
        stockOrigen = data[producto.id!] ?? 0
        setStockCache(prev => ({ ...prev, ...data }))
      }
    }

    const newLinea: LineaTraslado = {
      producto_id: producto.id!,
      producto_nombre: producto.nombre,
      producto_codigo: producto.codigo_barras || '',
      cantidad: 1,
      stock_origen: stockOrigen,
      costo_unitario: producto.costo_promedio || 0,
      precio_venta: producto.precio_venta_sugerido || 0,
      hasError: 1 > stockOrigen
    }

    setLineas(prev => [...prev, newLinea])
    setComboboxOpen(false)
  }

  function updateCantidad(productoId: number, cantidad: number) {
    setLineas(prev => prev.map(l => {
      if (l.producto_id === productoId) {
        const hasError = cantidad > l.stock_origen
        return { ...l, cantidad, hasError }
      }
      return l
    }))
  }

  function removeLinea(productoId: number) {
    setLineas(prev => prev.filter(l => l.producto_id !== productoId))
  }

  async function generatePDF() {
    const razonSocialRes = await getRazonSocial()
    const razonSocial = razonSocialRes.data
    
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    
    // Header - Company Info (beige accent)
    doc.setFillColor(245, 240, 230) // Soft beige
    doc.rect(0, 0, pageWidth, 45, 'F')
    
    // Company name
    doc.setFontSize(18)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(60, 55, 50)
    doc.text(razonSocial?.nombre_empresa || "Mi Empresa", 14, 20)
    
    // Company details
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(100, 95, 90)
    doc.text(`RTN: ${razonSocial?.documento || "N/A"}`, 14, 28)
    doc.text(razonSocial?.direccion || "Direccion no configurada", 14, 34)
    doc.text(`Tel: ${razonSocial?.telefono || "N/A"}`, 14, 40)
    
    // Document title
    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(180, 130, 80) // Amber accent
    doc.text("COMPROBANTE DE TRASLADO", pageWidth - 14, 20, { align: "right" })
    
    // Date
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(100, 95, 90)
    const fecha = new Date().toLocaleDateString('es-HN', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
    doc.text(`Fecha: ${fecha}`, pageWidth - 14, 28, { align: "right" })
    
    // Route Info Box
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(220, 210, 200)
    doc.roundedRect(14, 52, pageWidth - 28, 32, 3, 3, 'FD')
    
    // Origin
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(200, 120, 60) // Orange
    doc.text("ORIGEN (SALIDA)", 20, 62)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(60, 55, 50)
    doc.text(`Almacen: ${origenAlmacenNombre}`, 20, 69)
    doc.text(`Localizacion: ${origenLocalizacionNombre}`, 20, 76)
    
    // Arrow
    doc.setFontSize(16)
    doc.setTextColor(150, 145, 140)
    doc.text("→", pageWidth / 2, 68, { align: "center" })
    
    // Destination
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(80, 160, 120) // Green
    doc.text("DESTINO (ENTRADA)", pageWidth - 80, 62)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(60, 55, 50)
    doc.text(`Almacen: ${destinoAlmacenNombre}`, pageWidth - 80, 69)
    doc.text(`Localizacion: ${destinoLocalizacionNombre}`, pageWidth - 80, 76)
    
    // Products Table
    const tableData = lineas.map(l => [
      l.producto_codigo || '-',
      l.producto_nombre,
      l.cantidad.toString(),
      `L ${l.precio_venta.toFixed(2)}`,
      `L ${(l.cantidad * l.precio_venta).toFixed(2)}`
    ])
    
    autoTable(doc, {
      startY: 92,
      head: [["Codigo", "Producto", "Cant.", "P. Venta", "Subtotal"]],
      body: tableData,
      theme: 'striped',
      headStyles: { 
        fillColor: [180, 130, 80], // Amber
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9
      },
      bodyStyles: {
        textColor: [60, 55, 50],
        fontSize: 9
      },
      alternateRowStyles: {
        fillColor: [250, 248, 245] // Very light beige
      },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 35, halign: 'right' }
      },
      margin: { left: 14, right: 14 }
    })
    
    // Get final Y position after table
    const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 150
    
    // Totals Box
    doc.setFillColor(245, 240, 230)
    doc.roundedRect(pageWidth - 90, finalY + 10, 76, 28, 2, 2, 'F')
    
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(100, 95, 90)
    doc.text("Total Unidades:", pageWidth - 85, finalY + 20)
    doc.text("Valor Comercial:", pageWidth - 85, finalY + 32)
    
    doc.setFont("helvetica", "bold")
    doc.setTextColor(60, 55, 50)
    doc.text(totalUnidades.toString(), pageWidth - 18, finalY + 20, { align: "right" })
    doc.setTextColor(180, 130, 80)
    doc.text(`L ${totalValorComercial.toFixed(2)}`, pageWidth - 18, finalY + 32, { align: "right" })
    
    // Signature spaces
    const signatureY = finalY + 55
    
    // Left signature
    doc.setDrawColor(200, 195, 190)
    doc.line(20, signatureY, 90, signatureY)
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(120, 115, 110)
    doc.text("Entregado por", 55, signatureY + 6, { align: "center" })
    
    // Right signature
    doc.line(pageWidth - 90, signatureY, pageWidth - 20, signatureY)
    doc.text("Recibido por", pageWidth - 55, signatureY + 6, { align: "center" })
    
    // Footer
    doc.setFontSize(8)
    doc.setTextColor(150, 145, 140)
    doc.text("Este documento es un comprobante interno de traslado de inventario", pageWidth / 2, 285, { align: "center" })
    
    // Watermark EasyCount
    doc.setFontSize(7)
    doc.setTextColor(168, 162, 158)
    doc.text("Generado por EasyCount", pageWidth / 2, 291, { align: "center" })
    
    // Save PDF
    doc.save(`Traslado_${new Date().toISOString().split('T')[0]}_${Date.now()}.pdf`)
  }

  async function handleSubmit() {
    // Validations
    if (!origenAlmacenId || !origenLocalizacionId) {
      toast({ title: "Error", description: "Seleccione almacen y localizacion de origen", variant: "destructive" })
      return
    }
    if (!destinoAlmacenId || !destinoLocalizacionId) {
      toast({ title: "Error", description: "Seleccione almacen y localizacion de destino", variant: "destructive" })
      return
    }
    if (origenAlmacenId === destinoAlmacenId && origenLocalizacionId === destinoLocalizacionId) {
      toast({ title: "Error", description: "El origen y destino no pueden ser iguales", variant: "destructive" })
      return
    }
    if (lineas.length === 0) {
      toast({ title: "Error", description: "Agregue al menos un producto a la lista", variant: "destructive" })
      return
    }

    // Check for errors in any line
    const lineasConError = lineas.filter(l => l.hasError || l.cantidad <= 0)
    if (lineasConError.length > 0) {
      toast({ 
        title: "Error de validacion", 
        description: `Hay ${lineasConError.length} linea(s) con stock insuficiente o cantidad invalida`, 
        variant: "destructive" 
      })
      return
    }

    setSaving(true)
    
    const trasladoData: TrasladoLineaData[] = lineas.map(l => ({
      producto_id: l.producto_id,
      producto_nombre: l.producto_nombre,
      cantidad: l.cantidad,
      costo_unitario: l.costo_unitario
    }))

    const { success, error, procesados } = await procesarTrasladosMultiples(
      trasladoData,
      parseInt(origenAlmacenId),
      parseInt(origenLocalizacionId),
      parseInt(destinoAlmacenId),
      parseInt(destinoLocalizacionId)
    )

    setSaving(false)

    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" })
      return
    }

    // Generate PDF receipt
    await generatePDF()

    toast({ 
      title: "Traslado completado", 
      description: `Se procesaron ${procesados} productos (${totalUnidades} unidades) correctamente. PDF descargado.` 
    })
    
    // Reset form
    setLineas([])
    setStockCache({})
  }

  // Filter out products already in the list
  const productosDisponibles = productos.filter(p => !lineas.some(l => l.producto_id === p.id))

  const totalUnidades = lineas.reduce((acc, l) => acc + l.cantidad, 0)
  const totalValorCosto = lineas.reduce((acc, l) => acc + (l.cantidad * l.costo_unitario), 0)
  const totalValorComercial = lineas.reduce((acc, l) => acc + (l.cantidad * l.precio_venta), 0)
  const hasErrors = lineas.some(l => l.hasError)

  const origenAlmacenNombre = almacenes.find(a => a.id?.toString() === origenAlmacenId)?.nombre || ''
  const origenLocalizacionNombre = localizacionesOrigen.find(l => l.id?.toString() === origenLocalizacionId)?.nombre || ''
  const destinoAlmacenNombre = almacenes.find(a => a.id?.toString() === destinoAlmacenId)?.nombre || ''
  const destinoLocalizacionNombre = localizacionesDestino.find(l => l.id?.toString() === destinoLocalizacionId)?.nombre || ''

  return (
    <div className="space-y-6 bg-gradient-to-br from-amber-50/30 via-orange-50/20 to-stone-50/40 -m-4 md:-m-6 p-4 md:p-6 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-stone-800">Traslados entre Localizaciones</h1>
          <p className="text-sm md:text-base text-stone-600">Preparar y mover multiples productos en una sola operacion</p>
        </div>
        {lineas.length > 0 && (
          <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-sm px-3 py-1">
            {lineas.length} producto{lineas.length !== 1 ? 's' : ''} en lista
          </Badge>
        )}
      </div>

      {/* Origin and Destination Selection - Fixed for all transfers */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Origin */}
        <Card className="bg-white/70 backdrop-blur-sm border-stone-200/60 rounded-xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-stone-800">
              <div className="p-2 rounded-lg bg-orange-100">
                <Warehouse className="h-4 w-4 text-orange-600" />
              </div>
              Origen (Salida)
            </CardTitle>
            <CardDescription className="text-stone-500">De donde saldran los productos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label className="text-sm text-stone-600">Almacen</Label>
              <Select value={origenAlmacenId} onValueChange={handleOrigenAlmacenChange}>
                <SelectTrigger className="bg-white/50 border-stone-200">
                  <SelectValue placeholder="Seleccione almacen" />
                </SelectTrigger>
                <SelectContent>
                  {almacenes.map((a) => (
                    <SelectItem key={a.id} value={a.id!.toString()}>
                      {a.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm text-stone-600">Localizacion / Estante</Label>
              <Select 
                value={origenLocalizacionId} 
                onValueChange={handleOrigenLocalizacionChange}
                disabled={!origenAlmacenId}
              >
                <SelectTrigger className="bg-white/50 border-stone-200">
                  <SelectValue placeholder="Seleccione localizacion" />
                </SelectTrigger>
                <SelectContent>
                  {localizacionesOrigen.map((l) => (
                    <SelectItem key={l.id} value={l.id!.toString()}>
                      {l.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Destination */}
        <Card className="bg-white/70 backdrop-blur-sm border-stone-200/60 rounded-xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-stone-800">
              <div className="p-2 rounded-lg bg-emerald-100">
                <MapPin className="h-4 w-4 text-emerald-600" />
              </div>
              Destino (Entrada)
            </CardTitle>
            <CardDescription className="text-stone-500">A donde llegaran los productos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label className="text-sm text-stone-600">Almacen</Label>
              <Select value={destinoAlmacenId} onValueChange={handleDestinoAlmacenChange}>
                <SelectTrigger className="bg-white/50 border-stone-200">
                  <SelectValue placeholder="Seleccione almacen" />
                </SelectTrigger>
                <SelectContent>
                  {almacenes.map((a) => (
                    <SelectItem key={a.id} value={a.id!.toString()}>
                      {a.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm text-stone-600">Localizacion / Estante</Label>
              <Select 
                value={destinoLocalizacionId} 
                onValueChange={(v) => setDestinoLocalizacionId(v)}
                disabled={!destinoAlmacenId}
              >
                <SelectTrigger className="bg-white/50 border-stone-200">
                  <SelectValue placeholder="Seleccione localizacion" />
                </SelectTrigger>
                <SelectContent>
                  {localizacionesDestino.map((l) => (
                    <SelectItem key={l.id} value={l.id!.toString()}>
                      {l.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Product Combobox */}
      <Card className="bg-white/70 backdrop-blur-sm border-stone-200/60 rounded-xl shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-stone-800">
            <Package className="h-4 w-4 text-amber-700" />
            Agregar Productos
          </CardTitle>
          <CardDescription className="text-stone-500">
            Seleccione productos del listado o escriba para filtrar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={comboboxOpen}
                  className="w-full justify-between bg-white/50 border-stone-200 hover:bg-orange-50/30 h-11 text-left font-normal"
                  disabled={!origenLocalizacionId}
                >
                  <span className="flex items-center gap-2 text-stone-500">
                    <Search className="h-4 w-4" />
                    Buscar producto por nombre o codigo...
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Escriba para filtrar productos..." className="h-10" />
                  <CommandList className="max-h-72">
                    <CommandEmpty>No se encontraron productos.</CommandEmpty>
                    <CommandGroup>
                      {productosDisponibles.map((producto) => (
                        <CommandItem
                          key={producto.id}
                          value={`${producto.nombre} ${producto.codigo_barras || ''}`}
                          onSelect={() => addProductToList(producto)}
                          className="cursor-pointer py-3"
                        >
                          <div className="flex items-center justify-between w-full gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-stone-800 truncate">{producto.nombre}</p>
                              <p className="text-xs text-stone-500 font-mono">{producto.codigo_barras || 'Sin codigo'}</p>
                            </div>
                            <Badge variant="outline" className="text-xs shrink-0 border-stone-300">
                              Stock: {producto.stock_total || 0}
                            </Badge>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            
            {loadingStock && <Spinner className="h-5 w-5 text-amber-600 shrink-0" />}
          </div>
          
          {!origenLocalizacionId && (
            <p className="text-sm text-amber-600 mt-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Seleccione primero el origen para agregar productos
            </p>
          )}
        </CardContent>
      </Card>

      {/* Preparation Table */}
      {lineas.length > 0 && (
        <Card className="bg-white/70 backdrop-blur-sm border-stone-200/60 rounded-xl shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-stone-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2 text-stone-800">
                  <Boxes className="h-4 w-4 text-amber-700" />
                  Lista de Preparacion
                </CardTitle>
                <CardDescription className="text-stone-500 mt-1">
                  {origenAlmacenNombre && origenLocalizacionNombre && (
                    <span className="text-orange-600">{origenAlmacenNombre} / {origenLocalizacionNombre}</span>
                  )}
                  {destinoAlmacenNombre && destinoLocalizacionNombre && (
                    <>
                      <ArrowLeftRight className="inline h-3 w-3 mx-2 text-stone-400" />
                      <span className="text-emerald-600">{destinoAlmacenNombre} / {destinoLocalizacionNombre}</span>
                    </>
                  )}
                </CardDescription>
              </div>
              {hasErrors && (
                <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Stock insuficiente
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-amber-50/50">
                    <TableHead>Referencia</TableHead>
                    <TableHead className="text-center">Stock</TableHead>
                    <TableHead className="text-center w-24">Cantidad</TableHead>
                    <TableHead className="text-right">PVP</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineas.map((linea) => (
                    <TableRow 
                      key={linea.producto_id}
                      className={`transition-colors ${linea.hasError ? 'bg-red-50/60' : 'hover:bg-orange-50/30'}`}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium text-stone-800">{linea.producto_nombre}</p>
                          <p className="text-xs text-stone-500 font-mono">{linea.producto_codigo || 'Sin codigo'}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant="outline" 
                          className={linea.stock_origen > 0 ? 'border-emerald-300 text-emerald-700' : 'border-red-300 text-red-700'}
                        >
                          {linea.stock_origen}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          max={linea.stock_origen}
                          value={linea.cantidad}
                          onChange={(e) => updateCantidad(linea.producto_id, parseInt(e.target.value) || 0)}
                          className={`w-20 mx-auto text-center ${linea.hasError ? 'border-red-300 bg-red-50' : 'bg-white/50'}`}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="border-amber-300 text-amber-700 font-mono">
                          L {linea.precio_venta.toFixed(2)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-amber-800">
                        L {(linea.cantidad * linea.precio_venta).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLinea(linea.producto_id)}
                          className="h-8 w-8 p-0 text-stone-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="block md:hidden divide-y divide-stone-100">
              {lineas.map((linea) => (
                <div 
                  key={linea.producto_id} 
                  className={`p-4 ${linea.hasError ? 'bg-red-50/60' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-stone-800 truncate">{linea.producto_nombre}</p>
                      <p className="text-xs text-stone-500 font-mono">{linea.producto_codigo || 'Sin codigo'}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLinea(linea.producto_id)}
                      className="h-8 w-8 p-0 text-stone-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <p className="text-xs text-stone-500 mb-1">Stock</p>
                      <Badge 
                        variant="outline" 
                        className={linea.stock_origen > 0 ? 'border-emerald-300 text-emerald-700' : 'border-red-300 text-red-700'}
                      >
                        {linea.stock_origen}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-stone-500 mb-1">Cantidad</p>
                      <Input
                        type="number"
                        min="1"
                        max={linea.stock_origen}
                        value={linea.cantidad}
                        onChange={(e) => updateCantidad(linea.producto_id, parseInt(e.target.value) || 0)}
                        className={`w-16 text-center ${linea.hasError ? 'border-red-300 bg-red-50' : 'bg-white/50'}`}
                      />
                    </div>
                    <div>
                      <p className="text-xs text-stone-500 mb-1">PVP</p>
                      <Badge variant="outline" className="border-amber-300 text-amber-700 font-mono text-xs">
                        L {linea.precio_venta.toFixed(2)}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-stone-500 mb-1">Subtotal</p>
                      <p className="font-semibold text-amber-800">L {(linea.cantidad * linea.precio_venta).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer with totals */}
            <div className="border-t border-stone-200 bg-gradient-to-r from-stone-50/80 to-amber-50/50 p-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-xs text-stone-500">Total Unidades</p>
                    <p className="text-xl font-bold text-stone-800">{totalUnidades}</p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-500">Valor Costo</p>
                    <p className="text-lg font-medium text-stone-600">L {totalValorCosto.toFixed(2)}</p>
                  </div>
                  <div className="pl-4 border-l border-stone-300">
                    <p className="text-xs text-amber-700 font-medium">Valor Comercial Total</p>
                    <p className="text-2xl font-bold text-amber-800">L {totalValorComercial.toFixed(2)}</p>
                  </div>
                </div>
                <Button 
                  onClick={handleSubmit} 
                  disabled={saving || hasErrors || lineas.length === 0}
                  size="lg"
                  className="gap-2 bg-amber-600 hover:bg-amber-700 text-white shadow-md"
                >
                  {saving ? (
                    <>
                      <Spinner className="h-4 w-4" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4" />
                      Procesar y Generar PDF
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {lineas.length === 0 && origenLocalizacionId && destinoLocalizacionId && (
        <Card className="bg-white/70 backdrop-blur-sm border-stone-200/60 rounded-xl shadow-sm">
          <CardContent className="py-12 text-center">
            <div className="inline-flex items-center justify-center p-4 rounded-full bg-amber-100/50 mb-4">
              <ArrowLeftRight className="h-8 w-8 text-amber-600/70" />
            </div>
            <p className="text-lg font-medium text-stone-600 mb-2">Lista de traslado vacia</p>
            <p className="text-sm text-stone-500 max-w-md mx-auto">
              Use el buscador de arriba para agregar productos a la lista de preparacion
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
