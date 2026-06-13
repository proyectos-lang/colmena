"use client"

import { useEffect, useState, useCallback } from "react"
import { 
  PackageCheck, 
  Upload,
  DollarSign,
  Warehouse,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Trash2,
  ChevronsUpDown,
  Check,
  FileImage,
  FileText,
  X,
  PackagePlus,
  Plus
} from "lucide-react"
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
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { 
  procesarRecepcion,
  calcularProrrateo,
  type CompraDetalle
} from "@/lib/services/compras"
import { type Proveedor, type Producto, getProveedores, getProductos } from "@/lib/services/catalogos"
import { type Almacen, type Localizacion, getAlmacenes, getLocalizaciones } from "@/lib/services/catalogos"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { QuickCreateProductoDialog } from "@/components/recepcion/quick-create-producto-dialog"

// Interface for AI extracted data
interface ExtractedItem {
  nombre_extraido: string
  cantidad: number
  costo_unitario_original: number
}

// Interface for mapped line item
interface LineaFactura {
  id: number
  nombreExtraido: string
  productoId: number | null
  productoNombre: string
  productoCodigo: string
  cantidad: number
  costoOriginal: number
  costoFinalLocal: number
  comboboxOpen: boolean
}

export default function RecepcionIAPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [localizaciones, setLocalizaciones] = useState<Localizacion[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  
  // AI Processing
  const [processingAI, setProcessingAI] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string>("")
  
  // Extracted & Mapped Data
  const [lineas, setLineas] = useState<LineaFactura[]>([])
  
  // Quick create de producto desde una linea de la factura. Guardamos el
  // id de la linea activa para auto-mapear el producto recien creado.
  const [quickCreateLineaId, setQuickCreateLineaId] = useState<number | null>(null)
  const quickCreateLinea = lineas.find((l) => l.id === quickCreateLineaId) || null

  // Reception form
  const [proveedorId, setProveedorId] = useState<string>("")
  const [moneda, setMoneda] = useState<'LPS' | 'USD'>('USD')
  const [tasaCambio, setTasaCambio] = useState(24.5)
  const [costosImportacion, setCostosImportacion] = useState(0)
  const [impuestosCompra, setImpuestosCompra] = useState(0)
  const [otrosCostos, setOtrosCostos] = useState(0)
  const [almacenId, setAlmacenId] = useState(0)
  const [localizacionId, setLocalizacionId] = useState(0)
  
  const { toast } = useToast()

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [prodRes, almRes, provRes] = await Promise.all([
      getProductos(),
      getAlmacenes(),
      getProveedores()
    ])
    
    setProductos(prodRes.data)
    setAlmacenes(almRes.data)
    setProveedores(provRes.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Fetch locations when warehouse changes
  useEffect(() => {
    if (almacenId) {
      getLocalizaciones(almacenId).then(res => {
        setLocalizaciones(res.data)
        setLocalizacionId(0)
      })
    } else {
      setLocalizaciones([])
    }
  }, [almacenId])

  // Recalculate costs when values change
  useEffect(() => {
    if (lineas.length > 0) {
      const costosAdicionales = costosImportacion + impuestosCompra + otrosCostos
      const tasa = moneda === 'USD' ? tasaCambio : 1
      
      // Calculate subtotal
      const subtotal = lineas.reduce((acc, l) => acc + (l.cantidad * l.costoOriginal), 0)
      const subtotalLPS = moneda === 'USD' ? subtotal * tasa : subtotal
      
      // Update each line with prorated costs
      setLineas(prev => prev.map(l => {
        const valorItemOriginal = l.cantidad * l.costoOriginal
        const valorItemLPS = moneda === 'USD' ? valorItemOriginal * tasa : valorItemOriginal
        const proporcion = subtotalLPS > 0 ? valorItemLPS / subtotalLPS : 0
        const costosProrrateados = costosAdicionales * proporcion
        const costoFinalTotal = valorItemLPS + costosProrrateados
        const costoFinalLocal = l.cantidad > 0 ? costoFinalTotal / l.cantidad : 0
        
        return {
          ...l,
          costoFinalLocal: Math.round(costoFinalLocal * 100) / 100
        }
      }))
    }
  }, [costosImportacion, impuestosCompra, otrosCostos, tasaCambio, moneda])

  // Handle file drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    
    const file = e.dataTransfer.files[0]
    if (file) {
      processFile(file)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processFile(file)
    }
  }

  const processFile = (file: File) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      toast({ title: "Error", description: "Solo se aceptan imagenes JPG, PNG o PDF", variant: "destructive" })
      return
    }
    
    setUploadedFile(file)
    
    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setFilePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    } else {
      setFilePreview("")
    }
  }

  const removeFile = () => {
    setUploadedFile(null)
    setFilePreview("")
    setLineas([])
  }

  // Process invoice with Gemini AI
  const processWithAI = async () => {
    if (!uploadedFile) return
    
    setProcessingAI(true)
    
    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(',')[1]
          resolve(base64String)
        }
        reader.readAsDataURL(uploadedFile)
      })
      
      // Initialize Gemini 2.5 Flash
      const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || "")
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" })
      
      const prompt = `Eres un experto en contabilidad y procesamiento de facturas. Analiza esta imagen de factura de proveedor y extrae TODOS los productos/items listados.

INSTRUCCIONES ESTRICTAS:
1. Tu respuesta debe ser UNICAMENTE un JSON valido
2. NO incluyas markdown, comillas triples, ni texto adicional
3. NO expliques nada, solo devuelve el JSON puro

FORMATO DE RESPUESTA REQUERIDO:
[
  {"nombre_extraido": "nombre exacto del producto como aparece", "cantidad": numero, "costo_unitario_original": numero}
]

REGLAS DE EXTRACCION:
- nombre_extraido: El nombre del producto TAL COMO aparece en la factura
- cantidad: Numero entero de unidades (si no es claro, usa 1)
- costo_unitario_original: Precio unitario como numero decimal (sin simbolos de moneda)
- Si hay codigos de producto, incluyelos en el nombre
- Si no puedes leer un valor numerico claramente, usa 0
- Extrae TODOS los items de la factura, no omitas ninguno`

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: uploadedFile.type,
            data: base64
          }
        }
      ])
      
      const response = await result.response
      let text = response.text()
      
      // Clean the response - remove markdown code blocks if present
      text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      
      // Parse JSON
      const extractedData: ExtractedItem[] = JSON.parse(text)
      
      if (!Array.isArray(extractedData) || extractedData.length === 0) {
        toast({ title: "Sin resultados", description: "No se encontraron productos en la factura", variant: "destructive" })
        setProcessingAI(false)
        return
      }
      
      // Convert to LineaFactura format
      const newLineas: LineaFactura[] = extractedData.map((item, idx) => ({
        id: Date.now() + idx,
        nombreExtraido: item.nombre_extraido,
        productoId: null,
        productoNombre: "",
        productoCodigo: "",
        cantidad: item.cantidad || 1,
        costoOriginal: item.costo_unitario_original || 0,
        costoFinalLocal: 0,
        comboboxOpen: false
      }))
      
      setLineas(newLineas)
      
      toast({ 
        title: "Factura procesada", 
        description: `Se extrajeron ${extractedData.length} productos. Mapee cada uno con su producto correspondiente.` 
      })
      
    } catch (err) {
      console.error("[AI] Error processing invoice:", err)
      toast({ 
        title: "Error de IA", 
        description: "No se pudo procesar la factura. Verifique la imagen e intente de nuevo.", 
        variant: "destructive" 
      })
    } finally {
      setProcessingAI(false)
    }
  }

  // Handler que se dispara despues de crear un producto via el dialogo
  // Quick Create. Lo agrega al catalogo local (para que aparezca en el
  // combobox del resto de las lineas) y lo asocia automaticamente a la
  // linea activa.
  const handleProductoCreated = (producto: Producto) => {
    setProductos((prev) => {
      // Evitar duplicados si por alguna razon ya estuviera.
      if (producto.id != null && prev.some((p) => p.id === producto.id)) {
        return prev
      }
      return [...prev, producto]
    })
    if (quickCreateLineaId != null) {
      mapProducto(quickCreateLineaId, producto)
    }
    setQuickCreateLineaId(null)
  }

  // Map extracted product to system product
  const mapProducto = (lineaId: number, producto: Producto) => {
    setLineas(prev => prev.map(l => 
      l.id === lineaId 
        ? { 
            ...l, 
            productoId: producto.id!, 
            productoNombre: producto.nombre,
            productoCodigo: producto.codigo_barras || "",
            comboboxOpen: false
          }
        : l
    ))
  }

  // Update line values
  const updateLinea = (lineaId: number, field: 'cantidad' | 'costoOriginal', value: number) => {
    setLineas(prev => prev.map(l => 
      l.id === lineaId ? { ...l, [field]: value } : l
    ))
  }

  // Remove line
  const removeLinea = (lineaId: number) => {
    setLineas(prev => prev.filter(l => l.id !== lineaId))
  }

  // Toggle combobox
  const toggleCombobox = (lineaId: number, open: boolean) => {
    setLineas(prev => prev.map(l => 
      l.id === lineaId ? { ...l, comboboxOpen: open } : l
    ))
  }

  // Process reception
  const handleProcessRecepcion = async () => {
    // Validations
    if (lineas.length === 0) {
      toast({ title: "Error", description: "No hay productos para procesar", variant: "destructive" })
      return
    }
    
    const unmappedLines = lineas.filter(l => !l.productoId)
    if (unmappedLines.length > 0) {
      toast({ title: "Error", description: `Hay ${unmappedLines.length} productos sin mapear`, variant: "destructive" })
      return
    }
    
    if (!almacenId || !localizacionId) {
      toast({ title: "Error", description: "Seleccione almacen y localizacion de destino", variant: "destructive" })
      return
    }
    
    if (moneda === 'USD' && tasaCambio <= 0) {
      toast({ title: "Error", description: "Ingrese una tasa de cambio valida", variant: "destructive" })
      return
    }

    setProcessing(true)
    
    try {
      // Create a "virtual" compra for the reception
      // In a real scenario, you might want to create the compra first
      // For now, we'll directly process the inventory transactions
      
      const recepcionData = {
        compraId: Date.now(), // Virtual ID since we're not creating a formal order
        costos_importacion: costosImportacion,
        impuestos_compra: impuestosCompra,
        otros_costos: otrosCostos,
        tasa_cambio: tasaCambio,
        almacen_id: almacenId,
        localizacion_id: localizacionId,
        detalles: lineas.map(l => ({
          detalle_id: l.id,
          producto_id: l.productoId!,
          cantidad_recibida: l.cantidad,
          costo_final_local: l.costoFinalLocal
        }))
      }

      const { success, error } = await procesarRecepcion(recepcionData)
      
      if (error) {
        toast({ title: "Error", description: error, variant: "destructive" })
      } else if (success) {
        toast({ 
          title: "Recepcion Exitosa", 
          description: "La mercancia ha sido ingresada al inventario y los costos actualizados" 
        })
        
        // Reset form
        setLineas([])
        setUploadedFile(null)
        setFilePreview("")
        setCostosImportacion(0)
        setImpuestosCompra(0)
        setOtrosCostos(0)
      }
    } catch (err) {
      toast({ title: "Error", description: "Error procesando la recepcion", variant: "destructive" })
    } finally {
      setProcessing(false)
    }
  }

  const formatCurrency = (value: number, mon: string = "LPS") => {
    const prefix = mon === "USD" ? "$ " : "L "
    return prefix + value.toLocaleString("es-HN", { minimumFractionDigits: 2 })
  }

  const calcularTotales = () => {
    const subtotalOriginal = lineas.reduce((acc, l) => acc + (l.cantidad * l.costoOriginal), 0)
    const subtotalLPS = moneda === 'USD' ? subtotalOriginal * tasaCambio : subtotalOriginal
    const costosAdicionales = costosImportacion + impuestosCompra + otrosCostos
    const totalFinal = subtotalLPS + costosAdicionales
    
    return { subtotalOriginal, subtotalLPS, costosAdicionales, totalFinal }
  }

  const allProductsMapped = lineas.length > 0 && lineas.every(l => l.productoId !== null)
  const totales = calcularTotales()

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
        <h1 className="text-xl md:text-2xl font-semibold text-foreground">Recepcion por Factura</h1>
        <p className="text-sm md:text-base text-muted-foreground">Suba una imagen de factura para extraer los productos automaticamente</p>
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
        {/* Upload Zone */}
        <Card className="lg:col-span-1 bg-gradient-to-br from-amber-50/50 to-orange-50/30 border-amber-200/60">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-base flex items-center gap-2 text-amber-900">
              <FileImage className="h-4 w-4 text-amber-600" />
              Cargar Factura
            </CardTitle>
            <CardDescription className="text-xs md:text-sm text-amber-700">
              Arrastre una imagen o PDF de la factura
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0 space-y-4">
            {!uploadedFile ? (
              <div
                className={cn(
                  "border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer",
                  dragOver 
                    ? "border-amber-500 bg-amber-100/50" 
                    : "border-amber-300 hover:border-amber-400 hover:bg-amber-50/50"
                )}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <Upload className="h-10 w-10 mx-auto mb-3 text-amber-400" />
                <p className="text-sm font-medium text-amber-800">Arrastra tu factura aqui</p>
                <p className="text-xs text-amber-600 mt-1">o haz clic para seleccionar</p>
                <p className="text-xs text-amber-500 mt-3">JPG, PNG o PDF</p>
                <input
                  id="file-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="space-y-4">
                {/* File preview */}
                <div className="relative rounded-lg border border-amber-200 overflow-hidden bg-white">
                  {filePreview ? (
                    <img src={filePreview} alt="Preview" className="w-full h-48 object-contain" />
                  ) : (
                    <div className="h-48 flex items-center justify-center bg-amber-50">
                      <FileText className="h-16 w-16 text-amber-300" />
                    </div>
                  )}
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8"
                    onClick={removeFile}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-amber-800">
                  <FileImage className="h-4 w-4" />
                  <span className="truncate">{uploadedFile.name}</span>
                </div>
                
                <Button
                  className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={processWithAI}
                  disabled={processingAI}
                >
                  {processingAI ? (
                    <>
                      <Spinner className="h-4 w-4" />
                      Procesando factura...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Extraer Productos
                    </>
                  )}
                </Button>
              </div>
            )}
            
            {/* Proveedor Selection */}
            <div className="pt-4 border-t border-amber-200">
              <Label className="text-xs text-amber-800">Proveedor</Label>
              <Select value={proveedorId} onValueChange={setProveedorId}>
                <SelectTrigger className="mt-1.5 bg-white border-amber-200">
                  <SelectValue placeholder="Seleccionar proveedor..." />
                </SelectTrigger>
                <SelectContent>
                  {proveedores.map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Currency */}
            <div>
              <Label className="text-xs text-amber-800">Moneda de Factura</Label>
              <Select value={moneda} onValueChange={(v) => setMoneda(v as 'LPS' | 'USD')}>
                <SelectTrigger className="mt-1.5 bg-white border-amber-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">Dolares (USD)</SelectItem>
                  <SelectItem value="LPS">Lempiras (LPS)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {moneda === 'USD' && (
              <div>
                <Label className="text-xs text-amber-800">Tasa de Cambio (LPS por USD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={tasaCambio}
                  onChange={(e) => setTasaCambio(parseFloat(e.target.value) || 0)}
                  className="mt-1.5 bg-white border-amber-200"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Verification Table & Costs */}
        <Card className="lg:col-span-2">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-base flex items-center gap-2">
              <PackageCheck className="h-4 w-4" />
              Verificacion y Mapeo de Productos
            </CardTitle>
            <CardDescription className="text-xs md:text-sm">
              Revise y corrija los datos extraidos, luego mapee cada producto
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            {lineas.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-xl border-muted">
                <AlertCircle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Suba una factura y procesela con IA</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Los productos extraidos apareceran aqui</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Products Table */}
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[200px]">Extraido por IA</TableHead>
                        <TableHead>Mapear a Producto</TableHead>
                        <TableHead className="text-center w-20">Cant.</TableHead>
                        <TableHead className="text-right w-28">Costo Orig.</TableHead>
                        <TableHead className="text-right w-28">Costo Final</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineas.map((linea) => (
                        <TableRow key={linea.id} className={!linea.productoId ? "bg-amber-50/50" : ""}>
                          <TableCell>
                            <p className="text-sm font-medium truncate">{linea.nombreExtraido}</p>
                            {/*
                              Atajo visible solo mientras la linea NO esta
                              mapeada: deja crear el producto con un solo
                              clic, prefilled con el nombre extraido y el
                              costo de la factura.
                            */}
                            {!linea.productoId && (
                              <button
                                type="button"
                                onClick={() => setQuickCreateLineaId(linea.id)}
                                className="mt-1 inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 hover:underline"
                              >
                                <PackagePlus className="h-3 w-3" />
                                Crear producto
                              </button>
                            )}
                          </TableCell>
                          <TableCell>
                            <Popover 
                              open={linea.comboboxOpen} 
                              onOpenChange={(open) => toggleCombobox(linea.id, open)}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className={cn(
                                    "w-full justify-between text-left font-normal",
                                    !linea.productoId && "text-muted-foreground border-amber-300"
                                  )}
                                >
                                  {linea.productoId ? (
                                    <span className="truncate">{linea.productoNombre}</span>
                                  ) : (
                                    <span>Seleccionar producto...</span>
                                  )}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[320px] p-0" align="start">
                                <Command>
                                  <CommandInput placeholder="Buscar producto..." />
                                  <CommandList>
                                    <CommandEmpty>
                                      <div className="px-2 py-3 text-center">
                                        <p className="text-sm text-muted-foreground mb-2">
                                          No se encontro producto.
                                        </p>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="gap-2 border-amber-300 text-amber-800 hover:bg-amber-50"
                                          onClick={() => {
                                            toggleCombobox(linea.id, false)
                                            setQuickCreateLineaId(linea.id)
                                          }}
                                        >
                                          <PackagePlus className="h-4 w-4" />
                                          Crear este producto
                                        </Button>
                                      </div>
                                    </CommandEmpty>
                                    <CommandGroup>
                                      {productos.map((producto) => (
                                        <CommandItem
                                          key={producto.id}
                                          value={`${producto.nombre} ${producto.codigo_barras}`}
                                          onSelect={() => mapProducto(linea.id, producto)}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              linea.productoId === producto.id ? "opacity-100" : "opacity-0"
                                            )}
                                          />
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm truncate">{producto.nombre}</p>
                                            <p className="text-xs text-muted-foreground font-mono">
                                              {producto.codigo_barras}
                                            </p>
                                          </div>
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                  {/* Footer permanente: quick create siempre visible */}
                                  <div className="border-t p-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="w-full justify-start gap-2 text-amber-800 hover:bg-amber-50 hover:text-amber-900"
                                      onClick={() => {
                                        toggleCombobox(linea.id, false)
                                        setQuickCreateLineaId(linea.id)
                                      }}
                                    >
                                      <Plus className="h-4 w-4" />
                                      Crear nuevo producto
                                    </Button>
                                  </div>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              value={linea.cantidad}
                              onChange={(e) => updateLinea(linea.id, 'cantidad', parseInt(e.target.value) || 0)}
                              className="w-16 text-center"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={linea.costoOriginal}
                              onChange={(e) => updateLinea(linea.id, 'costoOriginal', parseFloat(e.target.value) || 0)}
                              className="w-24 text-right"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary" className="font-mono">
                              L {linea.costoFinalLocal.toFixed(2)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => removeLinea(linea.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Additional Costs */}
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label className="text-xs">Costos de Importacion (LPS)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={costosImportacion}
                      onChange={(e) => setCostosImportacion(parseFloat(e.target.value) || 0)}
                      className="mt-1.5"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Impuestos de Compra (LPS)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={impuestosCompra}
                      onChange={(e) => setImpuestosCompra(parseFloat(e.target.value) || 0)}
                      className="mt-1.5"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Otros Gastos (LPS)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={otrosCostos}
                      onChange={(e) => setOtrosCostos(parseFloat(e.target.value) || 0)}
                      className="mt-1.5"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Destination */}
                <Separator />
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-xs flex items-center gap-1">
                      <Warehouse className="h-3 w-3" />
                      Almacen de Destino
                    </Label>
                    <Select value={String(almacenId || "")} onValueChange={(v) => setAlmacenId(parseInt(v))}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Seleccionar almacen..." />
                      </SelectTrigger>
                      <SelectContent>
                        {almacenes.map(a => (
                          <SelectItem key={a.id} value={String(a.id)}>{a.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Localizacion
                    </Label>
                    <Select 
                      value={String(localizacionId || "")} 
                      onValueChange={(v) => setLocalizacionId(parseInt(v))}
                      disabled={!almacenId}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Seleccionar localizacion..." />
                      </SelectTrigger>
                      <SelectContent>
                        {localizaciones.map(l => (
                          <SelectItem key={l.id} value={String(l.id)}>{l.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Totals */}
                <div className="bg-gradient-to-r from-stone-50 to-amber-50/50 rounded-lg p-4">
                  <div className="grid gap-2 md:grid-cols-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Subtotal ({moneda})</p>
                      <p className="font-medium">{formatCurrency(totales.subtotalOriginal, moneda)}</p>
                    </div>
                    {moneda === 'USD' && (
                      <div>
                        <p className="text-muted-foreground">Subtotal (LPS)</p>
                        <p className="font-medium">{formatCurrency(totales.subtotalLPS, 'LPS')}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground">Costos Adicionales</p>
                      <p className="font-medium">{formatCurrency(totales.costosAdicionales, 'LPS')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground font-medium">Total Final (LPS)</p>
                      <p className="text-lg font-bold text-amber-700">{formatCurrency(totales.totalFinal, 'LPS')}</p>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <Button
                  className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
                  size="lg"
                  onClick={handleProcessRecepcion}
                  disabled={processing || !allProductsMapped || !almacenId || !localizacionId}
                >
                  {processing ? (
                    <>
                      <Spinner className="h-4 w-4" />
                      Procesando Recepcion...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Confirmar Recepcion ({lineas.length} productos)
                    </>
                  )}
                </Button>
                
                {!allProductsMapped && lineas.length > 0 && (
                  <p className="text-sm text-amber-600 text-center flex items-center justify-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Todos los productos deben estar mapeados para continuar
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/*
        Modal de creacion rapida de producto. Se abre desde el boton
        "Crear producto" en cada linea y desde el footer del combobox.
        El producto recien creado se asocia automaticamente a la linea
        activa (`quickCreateLineaId`).
      */}
      <QuickCreateProductoDialog
        open={quickCreateLineaId !== null}
        onOpenChange={(open) => {
          if (!open) setQuickCreateLineaId(null)
        }}
        defaultNombre={quickCreateLinea?.nombreExtraido ?? ""}
        // Pasamos el costo CALCULADO (`costoFinalLocal`) que ya tiene
        // el prorrateo de costos extra (importacion, impuestos, otros)
        // y la conversion a LPS si la factura era en USD. Si la linea
        // todavia no tiene calculo (recien extraida), caemos al costo
        // original como fallback.
        defaultCosto={
          quickCreateLinea
            ? quickCreateLinea.costoFinalLocal > 0
              ? quickCreateLinea.costoFinalLocal
              : quickCreateLinea.costoOriginal
            : 0
        }
        onCreated={handleProductoCreated}
      />
    </div>
  )
}
