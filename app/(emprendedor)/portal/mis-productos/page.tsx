"use client"

import * as React from "react"
import { useEmprendedorAuth } from "@/lib/contexts/emprendedor-auth-context"
import {
  submitProductoPendiente,
  submitProductosPendientesBulk,
  getProductosPendientesByEmprendimiento,
  checkCodigosBarrasDuplicados,
  updateCodigoBarrasProductoPendiente,
  type ProductoPendiente,
} from "@/lib/services/productos-pendientes"
import {
  getMarcasByRazonSocial,
  createMarcaAdmin,
  getCategoriasByRazonSocial,
  createCategoriaAdmin,
  getSubcategoriasByCategoria,
  createSubcategoriaAdmin,
  type MarcaAdmin,
  type CategoriaAdmin,
  type SubcategoriaAdmin,
} from "@/lib/services/catalogos-admin"
import { uploadProductoImage } from "@/lib/services/catalogos"
import { parseExcelUpload, type ExcelProductoRow } from "@/lib/utils/excel-parsers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { Download, Upload, Send, FileSpreadsheet, Plus, ImageIcon, X, Pencil, Check } from "lucide-react"
import { format } from "date-fns"

const EMPTY_FORM = {
  nombre: "",
  codigo_barras: "",
  precio_venta_sugerido: "",
  cantidad_inicial: "",
}

function EstadoBadge({ estado }: { estado?: string }) {
  if (estado === "aprobado") return <Badge className="bg-green-600 text-white">Aprobado</Badge>
  if (estado === "rechazado") return <Badge variant="destructive">Rechazado</Badge>
  return <Badge variant="secondary">Pendiente</Badge>
}

export default function MisProductosPage() {
  const { emprendedor } = useEmprendedorAuth()
  const [form, setForm] = React.useState(EMPTY_FORM)
  const [sending, setSending] = React.useState(false)
  const [historial, setHistorial] = React.useState<ProductoPendiente[]>([])
  const [historialLoading, setHistorialLoading] = React.useState(true)

  // Catálogos
  const [marcas, setMarcas] = React.useState<MarcaAdmin[]>([])
  const [categorias, setCategorias] = React.useState<CategoriaAdmin[]>([])
  const [subcategorias, setSubcategorias] = React.useState<SubcategoriaAdmin[]>([])

  // Selección actual
  const [marcaId, setMarcaId] = React.useState<number | null>(null)
  const [categoriaId, setCategoriaId] = React.useState<number | null>(null)
  const [subcategoriaId, setSubcategoriaId] = React.useState<number | null>(null)

  // Diálogos crear nueva marca / categoría / subcategoría
  const [marcaOpen, setMarcaOpen] = React.useState(false)
  const [categoriaOpen, setCategoriaOpen] = React.useState(false)
  const [subcategoriaOpen, setSubcategoriaOpen] = React.useState(false)
  const [newMarca, setNewMarca] = React.useState("")
  const [newCategoria, setNewCategoria] = React.useState("")
  const [newSubcategoria, setNewSubcategoria] = React.useState("")
  const [savingMarca, setSavingMarca] = React.useState(false)
  const [savingCategoria, setSavingCategoria] = React.useState(false)
  const [savingSubcategoria, setSavingSubcategoria] = React.useState(false)

  // Foto del producto
  const [fotoFile, setFotoFile] = React.useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = React.useState<string | null>(null)
  const fotoRef = React.useRef<HTMLInputElement>(null)

  // Excel
  const [excelRows, setExcelRows] = React.useState<ExcelProductoRow[]>([])
  const [excelErrors, setExcelErrors] = React.useState<string[]>([])
  const [excelSending, setExcelSending] = React.useState(false)
  const [excelFileName, setExcelFileName] = React.useState("")
  const fileRef = React.useRef<HTMLInputElement>(null)

  // Validación de códigos duplicados
  const [barcodesDuplicados, setBarcodesDuplicados] = React.useState<string[]>([])

  // Edición inline de código de barras en historial
  const [editingBarcodeId, setEditingBarcodeId] = React.useState<number | null>(null)
  const [editingBarcodeValue, setEditingBarcodeValue] = React.useState("")
  const [savingBarcode, setSavingBarcode] = React.useState(false)

  // Cargar catálogos al montar
  React.useEffect(() => {
    if (!emprendedor) return
    Promise.all([
      getMarcasByRazonSocial(emprendedor.razonSocialId),
      getCategoriasByRazonSocial(emprendedor.razonSocialId),
    ]).then(([ms, cs]) => {
      setMarcas(ms)
      setCategorias(cs)
    })
  }, [emprendedor])

  // Cargar subcategorías cuando cambia la categoría
  React.useEffect(() => {
    if (!categoriaId) { setSubcategorias([]); setSubcategoriaId(null); return }
    getSubcategoriasByCategoria(categoriaId).then((subs) => {
      setSubcategorias(subs)
      setSubcategoriaId(null)
    })
  }, [categoriaId])

  const cargarHistorial = React.useCallback(async () => {
    if (!emprendedor) return
    setHistorialLoading(true)
    const data = await getProductosPendientesByEmprendimiento(emprendedor.emprendimientoId)
    setHistorial(data.filter((p) => p.estado !== "rechazado"))
    setHistorialLoading(false)
  }, [emprendedor])

  React.useEffect(() => { cargarHistorial() }, [cargarHistorial])

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setMarcaId(null)
    setCategoriaId(null)
    setSubcategoriaId(null)
    setFotoFile(null)
    setFotoPreview(null)
    if (fotoRef.current) fotoRef.current.value = ""
  }

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFotoFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setFotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const quitarFoto = () => {
    setFotoFile(null)
    setFotoPreview(null)
    if (fotoRef.current) fotoRef.current.value = ""
  }

  const enviarIndividual = async () => {
    if (!emprendedor) return
    if (!form.nombre.trim() || !form.codigo_barras.trim() || !form.precio_venta_sugerido) {
      toast.error("Nombre, código de barras y precio son requeridos")
      return
    }
    setSending(true)

    // Verificar código de barras duplicado en catálogo
    const duplicados = await checkCodigosBarrasDuplicados(
      [form.codigo_barras.trim()],
      emprendedor.razonSocialId
    )
    if (duplicados.length > 0) {
      toast.error(`El código de barras "${form.codigo_barras}" ya existe en el catálogo`)
      setSending(false)
      return
    }

    // Subir foto si se seleccionó una
    let fotoUrl: string | null = null
    if (fotoFile) {
      const { url, error: uploadErr } = await uploadProductoImage(fotoFile)
      if (uploadErr) {
        toast.error(`Error al subir foto: ${uploadErr}`)
        setSending(false)
        return
      }
      fotoUrl = url
    }

    const marcaNombre = marcas.find((m) => m.id === marcaId)?.nombre ?? null
    const categoriaNombre = categorias.find((c) => c.id === categoriaId)?.nombre ?? null
    const subcategoriaNombre = subcategorias.find((s) => s.id === subcategoriaId)?.nombre ?? null

    const { error } = await submitProductoPendiente({
      emprendimiento_id: emprendedor.emprendimientoId,
      razon_social_id: emprendedor.razonSocialId,
      nombre: form.nombre,
      codigo_barras: form.codigo_barras,
      precio_venta_sugerido: parseFloat(form.precio_venta_sugerido),
      precio_costo: null,
      cantidad_inicial: form.cantidad_inicial ? parseFloat(form.cantidad_inicial) : 0,
      foto_url: fotoUrl,
      marca_nombre: marcaNombre,
      categoria_nombre: categoriaNombre,
      subcategoria_nombre: subcategoriaNombre,
      usuario: emprendedor.usuario,
    })
    setSending(false)
    if (error) { toast.error(`Error: ${error}`); return }
    toast.success("Producto enviado para aprobación")
    resetForm()
    cargarHistorial()
  }

  const descargarPlantilla = async () => {
    const res = await fetch("/api/emprendedor/plantilla-productos")
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "plantilla_productos.xlsx"
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setExcelFileName(file.name)
    setBarcodesDuplicados([])
    const buffer = Buffer.from(await file.arrayBuffer())
    const { rows, errors } = parseExcelUpload(buffer)
    setExcelRows(rows)
    setExcelErrors(errors)
  }

  const enviarMasivo = async () => {
    if (!emprendedor || excelRows.length === 0) return
    setExcelSending(true)

    // Verificar códigos de barras duplicados en catálogo
    const codigos = excelRows.map((r) => String(r.codigo_barras))
    const duplicados = await checkCodigosBarrasDuplicados(codigos, emprendedor.razonSocialId)
    if (duplicados.length > 0) {
      setBarcodesDuplicados(duplicados)
      toast.error(`${duplicados.length} código(s) de barras ya existen en el catálogo`)
      setExcelSending(false)
      return
    }
    setBarcodesDuplicados([])

    const { error, insertados } = await submitProductosPendientesBulk(
      excelRows,
      emprendedor.emprendimientoId,
      emprendedor.razonSocialId,
      emprendedor.usuario
    )
    setExcelSending(false)
    if (error) { toast.error(`Error: ${error}`); return }
    toast.success(`${insertados} productos enviados para aprobación`)
    setExcelRows([])
    setExcelErrors([])
    setExcelFileName("")
    if (fileRef.current) fileRef.current.value = ""
    cargarHistorial()
  }

  const guardarCodigoBarras = async (id: number) => {
    if (!editingBarcodeValue.trim() || !emprendedor) return
    setSavingBarcode(true)
    const duplicados = await checkCodigosBarrasDuplicados(
      [editingBarcodeValue.trim()],
      emprendedor.razonSocialId
    )
    if (duplicados.length > 0) {
      toast.error(`El código "${editingBarcodeValue}" ya existe en el catálogo`)
      setSavingBarcode(false)
      return
    }
    const { error } = await updateCodigoBarrasProductoPendiente(id, editingBarcodeValue.trim())
    setSavingBarcode(false)
    if (error) { toast.error(`Error: ${error}`); return }
    setEditingBarcodeId(null)
    toast.success("Código de barras actualizado")
    cargarHistorial()
  }

  // Crear marca
  const crearMarca = async () => {
    if (!emprendedor || !newMarca.trim()) return
    setSavingMarca(true)
    const { data, error } = await createMarcaAdmin(newMarca, emprendedor.razonSocialId)
    setSavingMarca(false)
    if (error || !data) { toast.error(error ?? "Error al crear marca"); return }
    setMarcas((prev) => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    setMarcaId(data.id)
    setNewMarca("")
    setMarcaOpen(false)
    toast.success("Marca creada")
  }

  // Crear categoría
  const crearCategoria = async () => {
    if (!emprendedor || !newCategoria.trim()) return
    setSavingCategoria(true)
    const { data, error } = await createCategoriaAdmin(newCategoria, emprendedor.razonSocialId)
    setSavingCategoria(false)
    if (error || !data) { toast.error(error ?? "Error al crear categoría"); return }
    setCategorias((prev) => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    setCategoriaId(data.id)
    setNewCategoria("")
    setCategoriaOpen(false)
    toast.success("Categoría creada")
  }

  // Crear subcategoría
  const crearSubcategoria = async () => {
    if (!emprendedor || !newSubcategoria.trim() || !categoriaId) return
    setSavingSubcategoria(true)
    const { data, error } = await createSubcategoriaAdmin(newSubcategoria, categoriaId, emprendedor.razonSocialId)
    setSavingSubcategoria(false)
    if (error || !data) { toast.error(error ?? "Error al crear subcategoría"); return }
    setSubcategorias((prev) => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    setSubcategoriaId(data.id)
    setNewSubcategoria("")
    setSubcategoriaOpen(false)
    toast.success("Subcategoría creada")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Crear nuevo producto</h1>
        <p className="text-muted-foreground text-sm">
          Envía productos nuevos para que el administrador los apruebe
        </p>
      </div>

      <Tabs defaultValue="individual">
        <TabsList>
          <TabsTrigger value="individual">Crear individual</TabsTrigger>
          <TabsTrigger value="masivo">Carga masiva</TabsTrigger>
        </TabsList>

        {/* ── Tab individual ── */}
        <TabsContent value="individual" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            <div>
              <Label>Nombre *</Label>
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div>
              <Label>Código de barras *</Label>
              <Input value={form.codigo_barras} onChange={(e) => setForm({ ...form, codigo_barras: e.target.value })} />
            </div>
            <div>
              <Label>Precio de venta sugerido *</Label>
              <Input
                type="number"
                min={0}
                value={form.precio_venta_sugerido}
                onChange={(e) => setForm({ ...form, precio_venta_sugerido: e.target.value })}
              />
            </div>
            <div>
              <Label>Cantidad inicial</Label>
              <Input
                type="number"
                min={0}
                value={form.cantidad_inicial}
                onChange={(e) => setForm({ ...form, cantidad_inicial: e.target.value })}
              />
            </div>

            {/* Marca */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Marca</Label>
                <button
                  type="button"
                  onClick={() => { setNewMarca(""); setMarcaOpen(true) }}
                  className="flex items-center gap-0.5 text-xs text-primary hover:underline"
                >
                  <Plus className="h-3 w-3" /> Nueva
                </button>
              </div>
              <Select
                value={marcaId?.toString() ?? "none"}
                onValueChange={(v) => setMarcaId(v === "none" ? null : parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin marca" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin marca</SelectItem>
                  {marcas.map((m) => (
                    <SelectItem key={m.id} value={m.id.toString()}>{m.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Categoría */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Categoría</Label>
                <button
                  type="button"
                  onClick={() => { setNewCategoria(""); setCategoriaOpen(true) }}
                  className="flex items-center gap-0.5 text-xs text-primary hover:underline"
                >
                  <Plus className="h-3 w-3" /> Nueva
                </button>
              </div>
              <Select
                value={categoriaId?.toString() ?? "none"}
                onValueChange={(v) => setCategoriaId(v === "none" ? null : parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin categoría</SelectItem>
                  {categorias.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subcategoría — solo si hay categoría seleccionada */}
            {categoriaId && (
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <Label>Subcategoría</Label>
                  <button
                    type="button"
                    onClick={() => { setNewSubcategoria(""); setSubcategoriaOpen(true) }}
                    className="flex items-center gap-0.5 text-xs text-primary hover:underline"
                  >
                    <Plus className="h-3 w-3" /> Nueva
                  </button>
                </div>
                <Select
                  value={subcategoriaId?.toString() ?? "none"}
                  onValueChange={(v) => setSubcategoriaId(v === "none" ? null : parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin subcategoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin subcategoría</SelectItem>
                    {subcategorias.map((s) => (
                      <SelectItem key={s.id} value={s.id.toString()}>{s.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Foto del producto */}
            <div className="sm:col-span-2">
              <Label className="mb-1 block">Foto del producto</Label>
              <input
                ref={fotoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFotoChange}
              />
              {fotoPreview ? (
                <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-border group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fotoPreview} alt="Vista previa" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => fotoRef.current?.click()}
                      className="rounded-full bg-white/90 p-1.5 text-gray-800 hover:bg-white"
                      title="Cambiar foto"
                    >
                      <Upload className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={quitarFoto}
                      className="rounded-full bg-white/90 p-1.5 text-red-600 hover:bg-white"
                      title="Quitar foto"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fotoRef.current?.click()}
                  className="flex flex-col items-center justify-center w-32 h-32 rounded-lg border-2 border-dashed border-border bg-muted/30 hover:bg-muted/60 hover:border-primary transition-colors text-muted-foreground"
                >
                  <ImageIcon className="h-8 w-8 mb-1.5 opacity-40" />
                  <span className="text-xs text-center leading-tight px-2">Subir foto</span>
                </button>
              )}
            </div>
          </div>

          <Button className="mt-4" onClick={enviarIndividual} disabled={sending}>
            <Send className="h-4 w-4 mr-2" />
            {sending ? "Enviando..." : "Enviar para aprobación"}
          </Button>
        </TabsContent>

        {/* ── Tab masivo ── */}
        <TabsContent value="masivo" className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Descarga la plantilla, llénala con tus productos y súbela. Las columnas de marca, categoría y subcategoría son opcionales (texto libre).
          </p>
          <div className="flex gap-3 flex-wrap">
            <Button variant="outline" onClick={descargarPlantilla}>
              <Download className="h-4 w-4 mr-2" /> Descargar plantilla Excel
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" /> Cargar archivo Excel
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleExcelFile}
            />
          </div>

          {excelFileName && (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <FileSpreadsheet className="h-4 w-4" /> {excelFileName}
            </p>
          )}

          {excelErrors.length > 0 && (
            <div className="bg-destructive/10 rounded p-3 text-sm text-destructive space-y-1">
              {excelErrors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}

          {barcodesDuplicados.length > 0 && (
            <div className="bg-destructive/10 rounded p-3 text-sm text-destructive space-y-1">
              <p className="font-medium">Códigos de barras ya existentes en el catálogo — corrige antes de enviar:</p>
              {barcodesDuplicados.map((c, i) => <p key={i}>• {c}</p>)}
            </div>
          )}

          {excelRows.length > 0 && (
            <>
              <div className="border rounded-md overflow-auto max-h-64">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {excelRows.map((r, i) => {
                      const isDup = barcodesDuplicados.includes(String(r.codigo_barras))
                      return (
                        <TableRow key={i} className={isDup ? "bg-destructive/10" : ""}>
                          <TableCell>{r.nombre}</TableCell>
                          <TableCell className={`font-mono text-sm${isDup ? " text-destructive font-semibold" : ""}`}>
                            {r.codigo_barras}{isDup && <span className="ml-1 text-xs">(duplicado)</span>}
                          </TableCell>
                          <TableCell className="text-right">{r.precio_venta_sugerido.toLocaleString("es")}</TableCell>
                          <TableCell className="text-right">{r.cantidad_inicial ?? 0}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              <Button onClick={enviarMasivo} disabled={excelSending}>
                <Send className="h-4 w-4 mr-2" />
                {excelSending ? "Enviando..." : `Confirmar envío (${excelRows.length} productos)`}
              </Button>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Historial ── */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Historial de envíos</h2>
        {historialLoading ? (
          <p className="text-muted-foreground text-sm">Cargando...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Foto</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Código</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Motivo rechazo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historial.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                    Sin envíos aún
                  </TableCell>
                </TableRow>
              ) : (
                historial.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">
                      {p.created_at ? format(new Date(p.created_at), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell>
                      {p.foto_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.foto_url} alt={p.nombre} className="h-9 w-9 rounded object-cover border" />
                      ) : (
                        <div className="h-9 w-9 rounded bg-muted flex items-center justify-center">
                          <ImageIcon className="h-4 w-4 text-muted-foreground opacity-40" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{p.nombre}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {editingBarcodeId === p.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            className="h-7 w-36 text-sm font-mono px-2"
                            value={editingBarcodeValue}
                            onChange={(e) => setEditingBarcodeValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") guardarCodigoBarras(p.id!)
                              if (e.key === "Escape") setEditingBarcodeId(null)
                            }}
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => guardarCodigoBarras(p.id!)}
                            disabled={savingBarcode}
                            className="rounded p-0.5 text-green-600 hover:bg-green-50 disabled:opacity-40"
                            title="Guardar"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingBarcodeId(null)}
                            className="rounded p-0.5 text-muted-foreground hover:bg-muted"
                            title="Cancelar"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 group">
                          <span>{p.codigo_barras}</span>
                          {p.estado === "pendiente" && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBarcodeId(p.id!)
                                setEditingBarcodeValue(p.codigo_barras)
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted"
                              title="Editar código de barras"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{p.precio_venta_sugerido.toLocaleString("es")}</TableCell>
                    <TableCell><EstadoBadge estado={p.estado} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.motivo_rechazo ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* ── Diálogo nueva marca ── */}
      <Dialog open={marcaOpen} onOpenChange={setMarcaOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nueva marca</DialogTitle></DialogHeader>
          <div>
            <Label>Nombre *</Label>
            <Input
              value={newMarca}
              onChange={(e) => setNewMarca(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && crearMarca()}
              placeholder="Ej: Mi Marca"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarcaOpen(false)}>Cancelar</Button>
            <Button onClick={crearMarca} disabled={savingMarca || !newMarca.trim()}>
              {savingMarca ? "Creando..." : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Diálogo nueva categoría ── */}
      <Dialog open={categoriaOpen} onOpenChange={setCategoriaOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nueva categoría</DialogTitle></DialogHeader>
          <div>
            <Label>Nombre *</Label>
            <Input
              value={newCategoria}
              onChange={(e) => setNewCategoria(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && crearCategoria()}
              placeholder="Ej: Ropa"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoriaOpen(false)}>Cancelar</Button>
            <Button onClick={crearCategoria} disabled={savingCategoria || !newCategoria.trim()}>
              {savingCategoria ? "Creando..." : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Diálogo nueva subcategoría ── */}
      <Dialog open={subcategoriaOpen} onOpenChange={setSubcategoriaOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nueva subcategoría</DialogTitle></DialogHeader>
          <div>
            <Label>Nombre *</Label>
            <Input
              value={newSubcategoria}
              onChange={(e) => setNewSubcategoria(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && crearSubcategoria()}
              placeholder="Ej: Camisetas"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubcategoriaOpen(false)}>Cancelar</Button>
            <Button onClick={crearSubcategoria} disabled={savingSubcategoria || !newSubcategoria.trim()}>
              {savingSubcategoria ? "Creando..." : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
