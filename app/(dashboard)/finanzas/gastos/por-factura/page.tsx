"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { 
  Upload, 
  Receipt, 
  X, 
  CheckCircle2,
  ImageIcon,
  ArrowLeft
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { useToast } from "@/hooks/use-toast"
import { 
  getConceptosGasto, 
  createGasto,
  uploadComprobante,
  type ConceptoGasto,
} from "@/lib/services/gastos"

export default function RegistrarGastoPorFacturaPage() {
  const router = useRouter()
  const { toast } = useToast()
  
  // State
  const [loading, setLoading] = React.useState(true)
  const [conceptos, setConceptos] = React.useState<ConceptoGasto[]>([])
  
  // Form states
  const [iaFile, setIaFile] = React.useState<File | null>(null)
  const [iaFilePreview, setIaFilePreview] = React.useState<string | null>(null)
  const [processingIA, setProcessingIA] = React.useState(false)
  const [iaExtractedData, setIaExtractedData] = React.useState<{
    fecha: string
    monto_total: number
    items: string[]
  } | null>(null)
  const [iaConceptoId, setIaConceptoId] = React.useState<number | null>(null)
  const [iaFecha, setIaFecha] = React.useState("")
  const [iaMonto, setIaMonto] = React.useState<number>(0)
  const [iaDescripcion, setIaDescripcion] = React.useState("")
  const [iaMetodo, setIaMetodo] = React.useState<'Efectivo' | 'Transferencia' | 'Tarjeta'>('Efectivo')
  const [savingIaGasto, setSavingIaGasto] = React.useState(false)
  const [uploadingFile, setUploadingFile] = React.useState(false)

  // Load conceptos
  React.useEffect(() => {
    loadConceptos()
  }, [])

  async function loadConceptos() {
    setLoading(true)
    const res = await getConceptosGasto()
    if (res.data) setConceptos(res.data)
    setLoading(false)
  }

  // Handle file selection
  function handleIaFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setIaFile(file)
      const reader = new FileReader()
      reader.onload = (ev) => {
        setIaFilePreview(ev.target?.result as string)
      }
      reader.readAsDataURL(file)
      setIaExtractedData(null)
      setIaConceptoId(null)
      setIaFecha("")
      setIaMonto(0)
      setIaDescripcion("")
    }
  }

  // Handle drag and drop
  function handleIaDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      setIaFile(file)
      const reader = new FileReader()
      reader.onload = (ev) => {
        setIaFilePreview(ev.target?.result as string)
      }
      reader.readAsDataURL(file)
      setIaExtractedData(null)
      setIaConceptoId(null)
      setIaFecha("")
      setIaMonto(0)
      setIaDescripcion("")
    }
  }

  // Process invoice with Gemini AI
  async function processInvoiceWithAI() {
    if (!iaFile || !iaFilePreview) {
      toast({ title: "Error", description: "Seleccione una imagen de factura", variant: "destructive" })
      return
    }

    setProcessingIA(true)
    
    try {
      const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || "")
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" })
      
      const prompt = `Eres un experto en contabilidad. Analiza esta imagen de factura o recibo de gasto y extrae la informacion.

INSTRUCCIONES ESTRICTAS:
1. Tu respuesta debe ser UNICAMENTE un JSON valido
2. NO incluyas markdown, comillas triples, ni texto adicional
3. NO expliques nada, solo devuelve el JSON puro

FORMATO DE RESPUESTA REQUERIDO:
{"fecha": "YYYY-MM-DD", "monto_total": number, "items": ["item1", "item2", ...]}

REGLAS DE EXTRACCION:
- fecha: Fecha del documento en formato YYYY-MM-DD. Si no es clara, usa la fecha de hoy.
- monto_total: El total a pagar como numero decimal (sin simbolos de moneda)
- items: Lista de todos los productos o servicios listados en la factura como strings
- Si no puedes leer un valor, haz tu mejor estimacion`

      // Convert image to base64
      const base64Data = iaFilePreview.split(',')[1]
      const mimeType = iaFile.type || 'image/jpeg'

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        }
      ])

      const responseText = result.response.text()
      
      // Clean response - remove markdown if present
      let cleanedResponse = responseText.trim()
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.slice(7)
      }
      if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.slice(3)
      }
      if (cleanedResponse.endsWith('```')) {
        cleanedResponse = cleanedResponse.slice(0, -3)
      }
      cleanedResponse = cleanedResponse.trim()

      const extractedData = JSON.parse(cleanedResponse)
      
      setIaExtractedData(extractedData)
      setIaFecha(extractedData.fecha || new Date().toISOString().split('T')[0])
      setIaMonto(extractedData.monto_total || 0)
      setIaDescripcion(extractedData.items?.join(', ') || '')
      
      toast({ title: "Factura procesada", description: "Datos extraidos correctamente. Verifique y complete el formulario." })
      
    } catch (err) {
      console.error("[v0] AI processing error:", err)
      toast({ title: "Error", description: "No se pudo procesar la factura. Intente de nuevo.", variant: "destructive" })
    } finally {
      setProcessingIA(false)
    }
  }

  // Save gasto from AI extraction
  async function handleSaveIaGasto() {
    if (!iaConceptoId) {
      toast({ title: "Error", description: "Seleccione un concepto de gasto", variant: "destructive" })
      return
    }
    if (iaMonto <= 0) {
      toast({ title: "Error", description: "Ingrese un monto valido", variant: "destructive" })
      return
    }

    setSavingIaGasto(true)

    let comprobanteUrl: string | undefined = undefined

    // Upload comprobante
    if (iaFile) {
      setUploadingFile(true)
      const uploadRes = await uploadComprobante(iaFile)
      setUploadingFile(false)
      if (uploadRes.url) {
        comprobanteUrl = uploadRes.url
      }
    }

    const { error } = await createGasto({
      concepto_id: iaConceptoId,
      fecha_gasto: iaFecha,
      monto: iaMonto,
      metodo_pago: iaMetodo,
      descripcion: iaDescripcion || undefined,
      comprobante_url: comprobanteUrl
    })

    setSavingIaGasto(false)

    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" })
      return
    }

    toast({ title: "Gasto registrado", description: `L ${iaMonto.toFixed(2)} guardado correctamente` })

    // Reset and return
    router.push('/finanzas/gastos')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner className="h-8 w-8 text-amber-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 bg-stone-50 min-h-screen">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="h-10 w-10 rounded-lg hover:bg-white border border-stone-200"
        >
          <ArrowLeft className="h-5 w-5 text-stone-600" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-stone-800">Registrar Gasto por Factura</h1>
          <p className="text-stone-500 text-sm mt-1">Sube una factura para extraer automaticamente los datos</p>
        </div>
      </div>

      {/* Main content area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Dropzone & Preview */}
        <Card className="rounded-2xl border-stone-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-amber-600" />
              Subir Factura
            </CardTitle>
            <CardDescription>
              Arrastra o sube una imagen de tu factura o recibo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Dropzone */}
            {!iaFilePreview ? (
              <div
                onDrop={handleIaDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-amber-300 rounded-xl p-12 text-center bg-amber-50/50 hover:bg-amber-50 transition-colors cursor-pointer"
                onClick={() => document.getElementById('ia-file-input')?.click()}
              >
                <Upload className="h-16 w-16 mx-auto text-amber-400 mb-4" />
                <p className="text-stone-700 font-bold mb-2 text-lg">Arrastra tu factura aqui</p>
                <p className="text-sm text-stone-500 mb-4">o haz clic para seleccionar desde tu computadora</p>
                <p className="text-xs text-stone-400">Formatos: JPG, PNG, PDF</p>
                <p className="text-xs text-stone-400 mt-2">Tamaño maximo: 10MB</p>
                <input
                  id="ia-file-input"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleIaFileSelect}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden border border-stone-200 bg-stone-50">
                  <img
                    src={iaFilePreview}
                    alt="Factura"
                    className="w-full max-h-[600px] object-contain"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 bg-white/80 hover:bg-white h-8 w-8 rounded-lg"
                    onClick={() => { setIaFile(null); setIaFilePreview(null); setIaExtractedData(null); }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                {!iaExtractedData && (
                  <Button
                    className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white h-11"
                    onClick={processInvoiceWithAI}
                    disabled={processingIA}
                  >
                    {processingIA ? (
                      <>
                        <Spinner className="h-4 w-4" />
                        Procesando factura...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Extraer Datos Automaticamente
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}

            {/* Extracted items preview */}
            {iaExtractedData && iaExtractedData.items && iaExtractedData.items.length > 0 && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <p className="text-sm font-semibold text-emerald-800 mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Items Detectados
                </p>
                <ul className="text-sm text-emerald-700 space-y-2">
                  {iaExtractedData.items.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Form */}
        <div className="space-y-6">
          {!iaExtractedData ? (
            <Card className="rounded-2xl border-stone-200 bg-white shadow-sm h-full flex items-center justify-center min-h-[400px]">
              <CardContent className="text-center p-8">
                <ImageIcon className="h-20 w-20 text-stone-300 mx-auto mb-4" />
                <p className="text-stone-500 font-medium mb-2">Sube una factura y extrae los datos</p>
                <p className="text-sm text-stone-400">Los campos se llenaran automaticamente con la informacion de tu factura</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-2xl border-stone-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" />
                  Datos Extraidos
                </CardTitle>
                <CardDescription>
                  Verifique y complete la siguiente informacion
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Concepto - Required Manual Selection */}
                <div className="space-y-2">
                  <Label htmlFor="concepto">Concepto de Gasto <span className="text-red-500">*</span></Label>
                  <Select
                    value={iaConceptoId?.toString() || ""}
                    onValueChange={(v) => setIaConceptoId(parseInt(v))}
                  >
                    <SelectTrigger className="border-stone-200 h-10">
                      <SelectValue placeholder="Seleccione un concepto" />
                    </SelectTrigger>
                    <SelectContent>
                      {conceptos.length === 0 ? (
                        <div className="p-2 text-sm text-stone-500 text-center">
                          No hay conceptos disponibles
                        </div>
                      ) : (
                        conceptos.map(c => (
                          <SelectItem key={c.id} value={c.id!.toString()}>
                            <span className="font-medium">{c.nombre}</span>
                            <span className="text-stone-500 ml-2">({c.categoria_macro})</span>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {conceptos.length === 0 && (
                    <p className="text-xs text-amber-600 font-medium">Configure conceptos de gasto primero en el panel de Gastos</p>
                  )}
                </div>

                {/* Fecha y Monto */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fecha">Fecha</Label>
                    <Input
                      id="fecha"
                      type="date"
                      value={iaFecha}
                      onChange={(e) => setIaFecha(e.target.value)}
                      className="border-stone-200 h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="monto">Monto (L) <span className="text-red-500">*</span></Label>
                    <Input
                      id="monto"
                      type="number"
                      step="0.01"
                      min="0"
                      value={iaMonto || ""}
                      onChange={(e) => setIaMonto(parseFloat(e.target.value) || 0)}
                      className="border-stone-200 font-semibold text-orange-700 h-10"
                    />
                  </div>
                </div>

                {/* Metodo de Pago */}
                <div className="space-y-2">
                  <Label htmlFor="metodo">Metodo de Pago</Label>
                  <Select value={iaMetodo} onValueChange={(v) => setIaMetodo(v as 'Efectivo' | 'Transferencia' | 'Tarjeta')}>
                    <SelectTrigger className="border-stone-200 h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Efectivo">
                        <span className="font-medium">Efectivo</span>
                      </SelectItem>
                      <SelectItem value="Transferencia">
                        <span className="font-medium">Transferencia Bancaria</span>
                      </SelectItem>
                      <SelectItem value="Tarjeta">
                        <span className="font-medium">Tarjeta de Credito/Debito</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Descripcion - Auto-filled with items */}
                <div className="space-y-2">
                  <Label htmlFor="desc">Descripcion</Label>
                  <Textarea
                    id="desc"
                    value={iaDescripcion}
                    onChange={(e) => setIaDescripcion(e.target.value)}
                    className="border-stone-200 min-h-[100px] resize-none"
                    placeholder="Detalles del gasto..."
                  />
                  <p className="text-xs text-stone-400">Los items se auto-generaron del analisis de la factura</p>
                </div>

                {/* Save Button */}
                <Button
                  className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white h-11 font-semibold"
                  onClick={handleSaveIaGasto}
                  disabled={savingIaGasto || uploadingFile || !iaConceptoId}
                >
                  {(savingIaGasto || uploadingFile) && <Spinner className="h-4 w-4" />}
                  {uploadingFile ? 'Subiendo comprobante...' : savingIaGasto ? 'Guardando gasto...' : 'Guardar Gasto'}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
