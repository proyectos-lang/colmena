"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import {
  Plus,
  Package,
  Pencil,
  Trash2,
  Loader2,
  Upload,
  ImageIcon,
  Calculator,
  Percent,
  DollarSign,
  Tag,
  Layers,
  Search,
  Settings2,
  FileSpreadsheet,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { useToast } from "@/hooks/use-toast"
import {
  Producto,
  Marca,
  Categoria,
  Subcategoria,
  getProductos,
  saveProducto,
  deleteProducto,
  uploadProductoImage,
  getMarcas,
  createMarca,
  getCategorias,
  createCategoria,
  getSubcategorias,
} from "@/lib/services/catalogos"
import { getEmprendimientos, type Emprendimiento } from "@/lib/services/emprendimientos"
import { useTenant } from "@/lib/hooks/use-tenant"
import { ManageCategoriasDialog } from "@/components/productos/manage-categorias-dialog"
import { insertProductosMasivoAdmin } from "@/lib/services/productos-pendientes"
import { parseExcelUpload, type ExcelProductoRow } from "@/lib/utils/excel-parsers"
import * as XLSX from "xlsx"

export default function ProductosConfigPage() {
  const { toast } = useToast()
  const { ready, razonSocialId } = useTenant()
  
  const [productos, setProductos] = useState<Producto[]>([])
  const [totalProductos, setTotalProductos] = useState(0)
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [emprendimientos, setEmprendimientos] = useState<Emprendimiento[]>([])
  /**
   * Lista plana de TODAS las subcategorias del tenant. La filtramos por
   * `categoria_id` en memoria para alimentar el selector cascada del form
   * y la columna de la tabla. Se recarga cada vez que se crea/edita/elimina
   * una subcategoria desde el modal de Gestion.
   */
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProducto, setEditingProducto] = useState<Producto | null>(null)
  const [saving, setSaving] = useState(false)

  // Paginación
  const PAGE_SIZE = 50
  const [currentPage, setCurrentPage] = useState(1)

  // Filter state
  const [filterMarca, setFilterMarca] = useState<string>("all")
  const [filterCategoria, setFilterCategoria] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  
  // Quick-create modals state
  const [marcaDialogOpen, setMarcaDialogOpen] = useState(false)
  const [categoriaDialogOpen, setCategoriaDialogOpen] = useState(false)
  const [newMarcaName, setNewMarcaName] = useState("")
  const [newCategoriaName, setNewCategoriaName] = useState("")
  const [creatingMarca, setCreatingMarca] = useState(false)
  const [creatingCategoria, setCreatingCategoria] = useState(false)

  // Modal de gestion completa de Categorias / Subcategorias.
  // Abre un acordeon donde cada fila es una categoria que se expande para
  // mostrar/agregar sus subcategorias.
  const [manageDialogOpen, setManageDialogOpen] = useState(false)

  // Carga masiva de productos
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [bulkEmpId, setBulkEmpId] = useState<string>("")
  const [bulkRows, setBulkRows] = useState<ExcelProductoRow[]>([])
  const [bulkErrors, setBulkErrors] = useState<string[]>([])
  const [bulkFileName, setBulkFileName] = useState("")
  const [bulkSending, setBulkSending] = useState(false)
  const bulkFileRef = useRef<HTMLInputElement>(null)

  function descargarPlantilla() {
    const ws = XLSX.utils.aoa_to_sheet([
      ["nombre", "codigo_barras", "precio_venta_sugerido", "cantidad_inicial", "marca", "categoria", "subcategoria"],
      ["Ejemplo Producto", "COD-001", 25000, 10, "Mi Marca", "Ropa", "Camisetas"],
    ])
    ws["!cols"] = [{ wch: 28 }, { wch: 16 }, { wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 18 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Productos")
    XLSX.writeFile(wb, "plantilla_productos.xlsx")
  }

  function handleBulkFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBulkFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const buffer = Buffer.from(ev.target?.result as ArrayBuffer)
      const { rows, errors } = parseExcelUpload(buffer)
      setBulkRows(rows)
      setBulkErrors(errors)
    }
    reader.readAsArrayBuffer(file)
  }

  async function handleBulkProcess() {
    if (!bulkEmpId) {
      toast({ title: "Selecciona un emprendedor", variant: "destructive" })
      return
    }
    if (bulkRows.length === 0) {
      toast({ title: "Carga un archivo Excel primero", variant: "destructive" })
      return
    }
    const emp = emprendimientos.find((e) => e.id?.toString() === bulkEmpId)
    if (!emp || !razonSocialId) return

    setBulkSending(true)
    const { insertados, errores } = await insertProductosMasivoAdmin(
      bulkRows,
      emp.id!,
      razonSocialId,
      "admin"
    )
    setBulkSending(false)

    if (insertados > 0) {
      toast({ title: `${insertados} producto(s) creados correctamente` })
      loadProductos()
    }
    if (errores.length > 0) {
      setBulkErrors(errores)
    } else {
      setBulkDialogOpen(false)
      setBulkRows([])
      setBulkErrors([])
      setBulkFileName("")
      setBulkEmpId("")
    }
  }

  const [formData, setFormData] = useState<Partial<Producto>>({
    nombre: "",
    codigo_barras: "",
    precio_venta_sugerido: 0,
    foto_url: "",
    costo_promedio: 0,
    stock_total: 0,
    marca_id: null,
    categoria_id: null,
    subcategoria_id: null,
    emprendimiento_id: null,
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>("")
  const [uploadingImage, setUploadingImage] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  
  // Price calculator state
  const [showCalculator, setShowCalculator] = useState(false)
  const [calcCosto, setCalcCosto] = useState<number>(0)
  const [calcMargen, setCalcMargen] = useState<number>(30) // Default 30%

  // Debounce del buscador: 350ms después de que el usuario deje de escribir
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 350)
    return () => clearTimeout(t)
  }, [searchTerm])

  // Resetear a página 1 cuando cambien los filtros o la búsqueda
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearch, filterMarca, filterCategoria])

  // Cargar metadatos una sola vez al montar
  useEffect(() => {
    if (!ready) return
    if (razonSocialId == null) { setLoading(false); return }
    loadMetadatos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, razonSocialId])

  // Recargar productos cuando cambie la página o los filtros (después de debounce)
  useEffect(() => {
    if (!ready || razonSocialId == null) return
    loadProductos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, razonSocialId, currentPage, debouncedSearch, filterMarca, filterCategoria])

  async function loadMetadatos() {
    setLoading(true)
    try {
      const [marcaRes, catRes, subRes, empsData] = await Promise.all([
        getMarcas(),
        getCategorias(),
        getSubcategorias(),
        getEmprendimientos(razonSocialId!),
      ])
      if (!marcaRes.error) setMarcas(marcaRes.data)
      if (!catRes.error) setCategorias(catRes.data)
      if (!subRes.error) setSubcategorias(subRes.data)
      setEmprendimientos(empsData)
    } catch (err: any) {
      toast({ title: "No se pudieron cargar los datos", description: err?.message || "Error de conexion", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  async function loadSubcategorias() {
    const { data } = await getSubcategorias()
    setSubcategorias(data)
  }

  async function loadProductos() {
    setLoading(true)
    try {
      const opts = {
        page: currentPage,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        marcaId: filterMarca !== "all" ? parseInt(filterMarca) : undefined,
        categoriaId: filterCategoria !== "all" ? parseInt(filterCategoria) : undefined,
      }
      const { data, total, error } = await getProductos(opts)
      if (error) {
        toast({ title: "Error", description: error, variant: "destructive" })
      } else {
        setProductos(data)
        setTotalProductos(total)
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Error de conexion", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  async function loadMarcas() {
    const { data } = await getMarcas()
    setMarcas(data)
  }

  async function loadCategorias() {
    const { data } = await getCategorias()
    setCategorias(data)
  }

  // Subcategorias disponibles para la categoria seleccionada en el form.
  // Cuando no hay categoria activa devolvemos lista vacia para que el
  // selector quede deshabilitado (ver UI mas abajo).
  const subcategoriasFiltradas = useMemo(() => {
    if (!formData.categoria_id) return []
    return subcategorias.filter((s) => s.categoria_id === formData.categoria_id)
  }, [subcategorias, formData.categoria_id])

  const totalPages = Math.ceil(totalProductos / PAGE_SIZE)

  async function handleCreateMarca() {
    if (!newMarcaName.trim()) {
      toast({ title: "Error", description: "El nombre es requerido", variant: "destructive" })
      return
    }
    setCreatingMarca(true)
    const { data, error } = await createMarca(newMarcaName.trim())
    setCreatingMarca(false)
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" })
      return
    }
    toast({ title: "Marca creada", description: `"${newMarcaName}" agregada correctamente` })
    await loadMarcas()
    if (data?.id) setFormData(prev => ({ ...prev, marca_id: data.id }))
    setNewMarcaName("")
    setMarcaDialogOpen(false)
  }

  async function handleCreateCategoria() {
    if (!newCategoriaName.trim()) {
      toast({ title: "Error", description: "El nombre es requerido", variant: "destructive" })
      return
    }
    setCreatingCategoria(true)
    const { data, error } = await createCategoria(newCategoriaName.trim())
    setCreatingCategoria(false)
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" })
      return
    }
    toast({ title: "Categoria creada", description: `"${newCategoriaName}" agregada correctamente` })
    await loadCategorias()
    if (data?.id) setFormData(prev => ({ ...prev, categoria_id: data.id }))
    setNewCategoriaName("")
    setCategoriaDialogOpen(false)
  }

  function openNewDialog() {
    setValidationErrors({})
    setEditingProducto(null)
    setFormData({
      nombre: "",
      codigo_barras: "",
      precio_venta_sugerido: 0,
      foto_url: "",
      costo_promedio: 0,
      stock_total: 0,
      marca_id: null,
      categoria_id: null,
      subcategoria_id: null,
      emprendimiento_id: null,
    })
    setImagePreview("")
    setImageFile(null)
    setShowCalculator(false)
    setCalcCosto(0)
    setCalcMargen(30)
    setDialogOpen(true)
  }

  function openEditDialog(producto: Producto) {
    setValidationErrors({})
    setEditingProducto(producto)
    setFormData({
      ...producto,
      costo_promedio: producto.costo_promedio ?? 0,
      stock_total: producto.stock_total ?? 0,
    })
    setImagePreview(producto.foto_url || "")
    setImageFile(null)
    setShowCalculator(false)
    setCalcCosto(producto.costo_promedio || 0)
    setCalcMargen(30)
    setDialogOpen(true)
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({ title: "Error", description: "Solo se permiten archivos de imagen", variant: "destructive" })
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "Error", description: "La imagen no debe exceder 5MB", variant: "destructive" })
        return
      }
      
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
      
      setUploadingImage(true)
      const { url, error } = await uploadProductoImage(file)
      setUploadingImage(false)
      
      if (error) {
        toast({ title: "Error al subir imagen", description: error, variant: "destructive" })
      } else if (url) {
        setFormData(prev => ({ ...prev, foto_url: url }))
        setImagePreview(url)
        setValidationErrors(prev => ({ ...prev, foto_url: "" }))
        toast({ title: "Imagen subida", description: "La imagen se ha subido correctamente" })
      }
    }
  }

  // Calculate suggested price based on cost and margin
  // Formula: Margen = (Precio - Costo) / Precio
  // Solving for Precio: Precio = Costo / (1 - Margen)
  const calcPrecioSugerido = calcCosto > 0 && calcMargen < 100 
    ? calcCosto / (1 - (calcMargen / 100)) 
    : 0

  function applyCalculatedPrice() {
    if (calcPrecioSugerido > 0) {
      setFormData(prev => ({ ...prev, precio_venta_sugerido: Math.round(calcPrecioSugerido * 100) / 100 }))
      setValidationErrors(prev => ({ ...prev, precio_venta_sugerido: "" }))
      setShowCalculator(false)
      toast({ title: "Precio aplicado", description: `Precio sugerido: L ${calcPrecioSugerido.toFixed(2)}` })
    }
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    
    if (!formData.nombre?.trim()) {
      errors.nombre = "El nombre es requerido"
    }
    if (!formData.codigo_barras?.trim()) {
      errors.codigo_barras = "El codigo de barras es requerido"
    }
    // La imagen es opcional: un producto puede crearse/editarse sin foto.
    if (!formData.precio_venta_sugerido || formData.precio_venta_sugerido <= 0) {
      errors.precio_venta_sugerido = "El precio de venta debe ser mayor a 0"
    }
    if (!formData.marca_id) {
      errors.marca_id = "La marca es requerida"
    }
    if (!formData.categoria_id) {
      errors.categoria_id = "La categoria es requerida"
    }
    
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSave() {
    if (!validateForm()) {
      toast({ title: "Error de validacion", description: "Complete todos los campos requeridos", variant: "destructive" })
      return
    }

    setSaving(true)

    const productoData: Producto = {
      ...editingProducto,
      nombre: formData.nombre!,
      codigo_barras: formData.codigo_barras!,
      precio_venta_sugerido: Number(formData.precio_venta_sugerido) || 0,
      foto_url: formData.foto_url || "",
      marca_id: formData.marca_id ?? null,
      categoria_id: formData.categoria_id ?? null,
      subcategoria_id: formData.categoria_id ? formData.subcategoria_id ?? null : null,
      emprendimiento_id: formData.emprendimiento_id ?? null,
    }

    const { error } = await saveProducto(productoData, !editingProducto)
    setSaving(false)

    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" })
    } else {
      toast({ title: "Exito", description: `Producto ${editingProducto ? "actualizado" : "creado"} correctamente` })
      setDialogOpen(false)
      loadProductos()
    }
  }

  async function handleDelete(producto: Producto) {
    if (!producto.id) return
    
    if (!confirm(`Eliminar producto "${producto.nombre}"?`)) {
      return
    }

    const { error } = await deleteProducto(producto.id)
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" })
    } else {
      toast({ title: "Exito", description: "Producto eliminado" })
      loadProductos()
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Configuracion de Productos</h1>
          <p className="text-sm md:text-base text-muted-foreground">Gestiona el catalogo de productos</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={() => setBulkDialogOpen(true)} className="flex-1 sm:flex-none">
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            Carga Masiva
          </Button>
          <Button onClick={openNewDialog} size="sm" className="flex-1 sm:flex-none">
            <Plus className="h-4 w-4 mr-1" />
            Nuevo Producto
          </Button>
        </div>
      </div>

      {/* Filtros superiores */}
      <Card className="rounded-xl border-stone-200 bg-stone-50/60 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* Busqueda */}
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
              <Input
                placeholder="Buscar por nombre o codigo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white border-stone-200 rounded-xl"
              />
            </div>

            {/* Filtro Marca */}
            <Select value={filterMarca} onValueChange={setFilterMarca}>
              <SelectTrigger className="bg-white border-stone-200 rounded-xl">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-stone-500" />
                  <SelectValue placeholder="Todas las marcas" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las marcas</SelectItem>
                {marcas.map((m) => (
                  <SelectItem key={m.id} value={m.id!.toString()}>{m.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtro Categoria */}
            <Select value={filterCategoria} onValueChange={setFilterCategoria}>
              <SelectTrigger className="bg-white border-stone-200 rounded-xl">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-stone-500" />
                  <SelectValue placeholder="Todas las categorias" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorias</SelectItem>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id!.toString()}>{c.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-stone-200 shadow-sm">
        <CardHeader className="p-4 md:p-6 pb-3 md:pb-4">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Package className="h-4 w-4 md:h-5 md:w-5 text-amber-700" />
            Productos
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">
            {totalProductos.toLocaleString()} producto{totalProductos !== 1 ? "s" : ""}
            {(debouncedSearch || filterMarca !== "all" || filterCategoria !== "all") && " encontrados"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
            </div>
          ) : productos.length === 0 ? (
            <div className="text-center py-8 text-stone-500">
              <Package className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm md:text-base">
                {totalProductos === 0 && !debouncedSearch && filterMarca === "all" && filterCategoria === "all"
                  ? "No hay productos registrados"
                  : "No se encontraron productos con estos filtros"}
              </p>
              <p className="text-xs md:text-sm">
                {totalProductos === 0 && !debouncedSearch && filterMarca === "all" && filterCategoria === "all"
                  ? "Crea tu primer producto"
                  : "Prueba ajustando los filtros"}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block md:hidden space-y-3">
                {productos.map((producto) => (
                  <div key={producto.id} className="border border-stone-200 rounded-xl p-3 bg-white flex items-center gap-3">
                    {producto.foto_url ? (
                      <img src={producto.foto_url} alt={producto.nombre} className="h-14 w-14 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="h-14 w-14 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                        <ImageIcon className="h-5 w-5 text-stone-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-sm">{producto.nombre}</p>
                      <p className="text-xs text-stone-500 font-mono">{producto.codigo_barras}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {producto.marca_nombre && (
                          <Badge variant="outline" className="text-xs bg-amber-50 border-amber-200 text-amber-800 rounded-full">
                            {producto.marca_nombre}
                          </Badge>
                        )}
                        {producto.categoria_nombre && (
                          <Badge variant="outline" className="text-xs bg-stone-50 border-stone-200 text-stone-700 rounded-full">
                            {producto.categoria_nombre}
                          </Badge>
                        )}
                        {producto.subcategoria_nombre && (
                          <Badge variant="outline" className="text-xs bg-stone-100 border-stone-300 text-stone-600 rounded-full">
                            {producto.subcategoria_nombre}
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-3 mt-1 text-xs">
                        <span className="text-emerald-700 font-medium">L {(producto.precio_venta_sugerido || 0).toFixed(2)}</span>
                        <span className="text-stone-500">Stock: {producto.stock_total || 0}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(producto)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10" onClick={() => handleDelete(producto)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block rounded-xl border border-stone-200 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-stone-50/80 hover:bg-stone-50/80">
                      <TableHead className="w-16">Imagen</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Codigo</TableHead>
                      <TableHead>Emprendimiento</TableHead>
                      <TableHead>Marca</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Subcategoria</TableHead>
                      <TableHead className="text-right">Precio Venta</TableHead>
                      <TableHead className="text-right">Costo Prom.</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productos.map((producto) => (
                      <TableRow key={producto.id}>
                        <TableCell>
                          {producto.foto_url ? (
                            <img src={producto.foto_url} alt={producto.nombre} className="h-10 w-10 rounded-lg object-cover" />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-stone-100 flex items-center justify-center">
                              <ImageIcon className="h-5 w-5 text-stone-400" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{producto.nombre}</TableCell>
                        <TableCell className="font-mono text-sm text-stone-600">{producto.codigo_barras}</TableCell>
                        <TableCell>
                          {(producto as any).emprendimiento_nombre ? (
                            <Badge variant="outline" className="bg-purple-50 border-purple-200 text-purple-800 rounded-full font-normal">
                              {(producto as any).emprendimiento_nombre}
                            </Badge>
                          ) : (
                            <span className="text-stone-400 text-xs">Tienda</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {producto.marca_nombre ? (
                            <Badge variant="outline" className="bg-amber-50 border-amber-200 text-amber-800 rounded-full font-normal">
                              {producto.marca_nombre}
                            </Badge>
                          ) : (
                            <span className="text-stone-400 text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {producto.categoria_nombre ? (
                            <Badge variant="outline" className="bg-stone-50 border-stone-200 text-stone-700 rounded-full font-normal">
                              {producto.categoria_nombre}
                            </Badge>
                          ) : (
                            <span className="text-stone-400 text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {producto.subcategoria_nombre ? (
                            <Badge variant="outline" className="bg-stone-100 border-stone-300 text-stone-600 rounded-full font-normal">
                              {producto.subcategoria_nombre}
                            </Badge>
                          ) : (
                            <span className="text-stone-400 text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium text-emerald-700">L {(producto.precio_venta_sugerido || 0).toFixed(2)}</TableCell>
                        <TableCell className="text-right text-stone-600">L {(producto.costo_promedio || 0).toFixed(2)}</TableCell>
                        <TableCell className="text-right">{producto.stock_total || 0}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(producto)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10" onClick={() => handleDelete(producto)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-stone-200">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    disabled={currentPage === 1 || loading}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <span className="text-xs text-stone-500">
                    Página {currentPage} de {totalPages} · mostrando {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, totalProductos)} de {totalProductos.toLocaleString()}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    disabled={currentPage >= totalPages || loading}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Product Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProducto ? "Editar Producto" : "Nuevo Producto"}</DialogTitle>
            <DialogDescription>
              Complete los datos del producto. Los campos marcados con * son requeridos.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
            {/* Image Upload Section */}
            <div className="grid gap-2">
              <Label htmlFor="imagen">
                Imagen del Producto{" "}
                <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <div className="flex flex-col items-center gap-4 rounded-lg border-2 border-dashed p-4">
                {imagePreview ? (
                  <div className="relative">
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      className="h-32 w-32 rounded-lg object-cover shadow-md" 
                    />
                    {uploadingImage && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/80">
                        <Spinner className="h-8 w-8" />
                      </div>
                    )}
                    {formData.foto_url && !uploadingImage && (
                      <div className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-green-500 flex items-center justify-center">
                        <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex h-32 w-32 items-center justify-center rounded-lg bg-muted">
                    <ImageIcon className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
                <label className="cursor-pointer">
                  <Input
                    id="imagen"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                    disabled={uploadingImage}
                  />
                  <Button type="button" variant="outline" asChild disabled={uploadingImage}>
                    <span>
                      {uploadingImage ? (
                        <>
                          <Spinner className="mr-2 h-4 w-4" />
                          Subiendo...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          {imagePreview ? "Cambiar Imagen" : "Subir Imagen"}
                        </>
                      )}
                    </span>
                  </Button>
                </label>
                <p className="text-xs text-muted-foreground">PNG, JPG o GIF. Maximo 5MB.</p>
              </div>
              {validationErrors.foto_url && (
                <p className="text-sm text-destructive">{validationErrors.foto_url}</p>
              )}
            </div>

            {/* Product Name */}
            <div className="grid gap-2">
              <Label htmlFor="nombre">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nombre"
                value={formData.nombre || ""}
                onChange={(e) => {
                  setFormData({ ...formData, nombre: e.target.value })
                  if (validationErrors.nombre) setValidationErrors(prev => ({ ...prev, nombre: "" }))
                }}
                className={validationErrors.nombre ? "border-destructive" : ""}
                placeholder="Ej: Laptop HP ProBook 450"
              />
              {validationErrors.nombre && (
                <p className="text-sm text-destructive">{validationErrors.nombre}</p>
              )}
            </div>

            {/* Barcode */}
            <div className="grid gap-2">
              <Label htmlFor="codigo">
                Codigo de Barras <span className="text-destructive">*</span>
              </Label>
              <Input
                id="codigo"
                value={formData.codigo_barras || ""}
                onChange={(e) => {
                  setFormData({ ...formData, codigo_barras: e.target.value })
                  if (validationErrors.codigo_barras) setValidationErrors(prev => ({ ...prev, codigo_barras: "" }))
                }}
                className={validationErrors.codigo_barras ? "border-destructive" : ""}
                placeholder="Ej: 7501234567890"
              />
              {validationErrors.codigo_barras && (
                <p className="text-sm text-destructive">{validationErrors.codigo_barras}</p>
              )}
            </div>

            {/* Marca */}
            <div className="grid gap-2">
              <Label htmlFor="marca">
                Marca <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Select
                  value={formData.marca_id?.toString() || ""}
                  onValueChange={(v) => {
                    setFormData({ ...formData, marca_id: parseInt(v) })
                    if (validationErrors.marca_id) setValidationErrors(prev => ({ ...prev, marca_id: "" }))
                  }}
                >
                  <SelectTrigger className={`flex-1 rounded-xl ${validationErrors.marca_id ? "border-destructive" : "border-stone-200"}`}>
                    <SelectValue placeholder="Seleccione una marca" />
                  </SelectTrigger>
                  <SelectContent>
                    {marcas.length === 0 ? (
                      <div className="px-2 py-3 text-sm text-stone-500 text-center">
                        Sin marcas. Agregue una nueva.
                      </div>
                    ) : (
                      marcas.map((m) => (
                        <SelectItem key={m.id} value={m.id!.toString()}>{m.nombre}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl"
                  onClick={() => { setNewMarcaName(""); setMarcaDialogOpen(true); }}
                  title="Agregar nueva marca"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {validationErrors.marca_id && (
                <p className="text-sm text-destructive">{validationErrors.marca_id}</p>
              )}
            </div>

            {/* Categoria */}
            <div className="grid gap-2">
              <Label htmlFor="categoria">
                Categoria <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Select
                  value={formData.categoria_id?.toString() || ""}
                  onValueChange={(v) => {
                    // Cambiar categoria invalida cualquier subcategoria previa
                    // (no tiene sentido mantenerla si pertenece a otra rama).
                    setFormData({
                      ...formData,
                      categoria_id: parseInt(v),
                      subcategoria_id: null,
                    })
                    if (validationErrors.categoria_id) setValidationErrors(prev => ({ ...prev, categoria_id: "" }))
                  }}
                >
                  <SelectTrigger className={`flex-1 rounded-xl ${validationErrors.categoria_id ? "border-destructive" : "border-stone-200"}`}>
                    <SelectValue placeholder="Seleccione una categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.length === 0 ? (
                      <div className="px-2 py-3 text-sm text-stone-500 text-center">
                        Sin categorias. Agregue una nueva.
                      </div>
                    ) : (
                      categorias.map((c) => (
                        <SelectItem key={c.id} value={c.id!.toString()}>{c.nombre}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 border-stone-300 bg-stone-50 hover:bg-stone-100 text-stone-700 rounded-xl"
                  onClick={() => { setNewCategoriaName(""); setCategoriaDialogOpen(true); }}
                  title="Agregar nueva categoria"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 border-stone-300 bg-stone-50 hover:bg-stone-100 text-stone-700 rounded-xl"
                  onClick={() => setManageDialogOpen(true)}
                  title="Gestionar categorias y subcategorias"
                >
                  <Settings2 className="h-4 w-4" />
                </Button>
              </div>
              {validationErrors.categoria_id && (
                <p className="text-sm text-destructive">{validationErrors.categoria_id}</p>
              )}
            </div>

            {/*
              Subcategoria (selector cascada).
              - Deshabilitado si no hay categoria seleccionada.
              - Si hay categoria pero ninguna subcategoria registrada para
                esa rama, se sigue mostrando habilitado pero con un
                placeholder informativo.
              - Es OPCIONAL: el usuario puede dejarlo vacio.
              - Se resetea automaticamente al cambiar categoria.
            */}
            <div className="grid gap-2">
              <Label htmlFor="subcategoria">Subcategoria <span className="text-stone-400 text-xs font-normal">(opcional)</span></Label>
              <div className="flex gap-2">
                <Select
                  value={formData.subcategoria_id?.toString() || "none"}
                  onValueChange={(v) =>
                    setFormData({
                      ...formData,
                      subcategoria_id: v === "none" ? null : parseInt(v),
                    })
                  }
                  disabled={!formData.categoria_id}
                >
                  <SelectTrigger className="flex-1 rounded-xl border-stone-200 disabled:opacity-60">
                    <SelectValue
                      placeholder={
                        !formData.categoria_id
                          ? "Selecciona una categoria primero"
                          : "Sin subcategoria"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin subcategoria</SelectItem>
                    {subcategoriasFiltradas.length === 0 && formData.categoria_id ? (
                      <div className="px-2 py-3 text-xs text-stone-500 text-center">
                        No hay subcategorias en esta rama.
                        <br />
                        Crealas desde el boton de gestion.
                      </div>
                    ) : (
                      subcategoriasFiltradas.map((s) => (
                        <SelectItem key={s.id} value={s.id!.toString()}>
                          {s.nombre}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Emprendimiento */}
            <div className="grid gap-2">
              <Label htmlFor="emprendimiento">Emprendimiento <span className="text-stone-400 text-xs font-normal">(opcional — dejar vacío para producto de tienda)</span></Label>
              <Select
                value={formData.emprendimiento_id?.toString() ?? "none"}
                onValueChange={(v) =>
                  setFormData({ ...formData, emprendimiento_id: v === "none" ? null : parseInt(v) })
                }
              >
                <SelectTrigger className="rounded-xl border-stone-200">
                  <SelectValue placeholder="Tienda (sin emprendimiento)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tienda (sin emprendimiento)</SelectItem>
                  {emprendimientos.map((e) => (
                    <SelectItem key={e.id} value={e.id!.toString()}>
                      {e.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Suggested Sale Price */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="precio">
                  Precio de Venta Sugerido (LPS) <span className="text-destructive">*</span>
                </Label>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs gap-1 text-amber-700 hover:text-amber-800 hover:bg-amber-50"
                  onClick={() => setShowCalculator(!showCalculator)}
                >
                  <Calculator className="h-3.5 w-3.5" />
                  {showCalculator ? "Ocultar calculadora" : "Calcular precio"}
                </Button>
              </div>
              
              {/* Price Calculator Panel */}
              {showCalculator && (
                <div className="rounded-lg border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 space-y-4">
                  <div className="flex items-center gap-2 text-amber-800">
                    <Calculator className="h-4 w-4" />
                    <span className="text-sm font-medium">Calculadora de Precio por Margen</span>
                  </div>
                  
                  <p className="text-xs text-amber-700">
                    Formula: Margen = (Precio - Costo) / Precio
                  </p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {/* Cost Input */}
                    <div className="space-y-1.5">
                      <Label htmlFor="calc-costo" className="text-xs text-amber-800 flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        Costo del Producto
                      </Label>
                      <Input
                        id="calc-costo"
                        type="number"
                        step="0.01"
                        min="0"
                        value={calcCosto || ""}
                        onChange={(e) => setCalcCosto(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="bg-white/70 border-amber-200 focus:border-amber-400"
                      />
                    </div>
                    
                    {/* Margin Input */}
                    <div className="space-y-1.5">
                      <Label htmlFor="calc-margen" className="text-xs text-amber-800 flex items-center gap-1">
                        <Percent className="h-3 w-3" />
                        Margen Esperado (%)
                      </Label>
                      <Input
                        id="calc-margen"
                        type="number"
                        step="1"
                        min="0"
                        max="99"
                        value={calcMargen || ""}
                        onChange={(e) => setCalcMargen(parseFloat(e.target.value) || 0)}
                        placeholder="30"
                        className="bg-white/70 border-amber-200 focus:border-amber-400"
                      />
                    </div>
                  </div>
                  
                  {/* Result Preview */}
                  <div className="flex items-center justify-between rounded-lg bg-white/80 border border-amber-200 p-3">
                    <div>
                      <p className="text-xs text-amber-700">Precio Sugerido</p>
                      <p className="text-xl font-bold text-amber-800">
                        L {calcPrecioSugerido > 0 ? calcPrecioSugerido.toFixed(2) : "0.00"}
                      </p>
                    </div>
                    <Button 
                      type="button"
                      size="sm"
                      disabled={calcPrecioSugerido <= 0}
                      onClick={applyCalculatedPrice}
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      Aplicar Precio
                    </Button>
                  </div>
                  
                  {calcCosto > 0 && calcPrecioSugerido > 0 && (
                    <p className="text-xs text-amber-600 text-center">
                      Ganancia por unidad: L {(calcPrecioSugerido - calcCosto).toFixed(2)}
                    </p>
                  )}
                </div>
              )}
              
              <Input
                id="precio"
                type="number"
                step="0.01"
                min="0"
                value={formData.precio_venta_sugerido || ""}
                onChange={(e) => {
                  setFormData({ ...formData, precio_venta_sugerido: parseFloat(e.target.value) || 0 })
                  if (validationErrors.precio_venta_sugerido) setValidationErrors(prev => ({ ...prev, precio_venta_sugerido: "" }))
                }}
                className={validationErrors.precio_venta_sugerido ? "border-destructive" : ""}
                placeholder="0.00"
              />
              {validationErrors.precio_venta_sugerido && (
                <p className="text-sm text-destructive">{validationErrors.precio_venta_sugerido}</p>
              )}
            </div>

            {/* Read-only Fields Section */}
            {editingProducto && (
              <div className="rounded-lg border bg-muted/50 p-4 space-y-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Campos de solo lectura (controlados por Compras/Ventas)
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="costo_promedio" className="text-muted-foreground">
                      Costo Promedio (LPS)
                    </Label>
                    <Input
                      id="costo_promedio"
                      type="number"
                      value={formData.costo_promedio ?? 0}
                      disabled
                      className="bg-muted cursor-not-allowed"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="stock_total" className="text-muted-foreground">
                      Stock Total
                    </Label>
                    <Input
                      id="stock_total"
                      type="number"
                      value={formData.stock_total ?? 0}
                      disabled
                      className="bg-muted cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || uploadingImage}>
              {saving && <Spinner className="mr-2 h-4 w-4" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick-create Marca Modal */}
      <Dialog open={marcaDialogOpen} onOpenChange={setMarcaDialogOpen}>
        <DialogContent className="max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-amber-700" />
              Nueva Marca
            </DialogTitle>
            <DialogDescription>
              Agrega una nueva marca al catalogo
            </DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <Label htmlFor="marca-nombre">Nombre</Label>
            <Input
              id="marca-nombre"
              value={newMarcaName}
              onChange={(e) => setNewMarcaName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !creatingMarca) handleCreateMarca() }}
              placeholder="Ej: Samsung"
              className="mt-2 rounded-xl border-stone-200"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarcaDialogOpen(false)} disabled={creatingMarca}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateMarca}
              disabled={creatingMarca || !newMarcaName.trim()}
              className="bg-amber-700 hover:bg-amber-800 text-white"
            >
              {creatingMarca && <Spinner className="mr-2 h-4 w-4" />}
              Crear Marca
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/*
        Modal de Gestion de Categorias y Subcategorias.
        Estructura: acordeon donde cada item es una categoria. Al expandirla
        se ven sus subcategorias y un formulario inline para agregar nuevas.
        Al cerrar refrescamos productos por si las subcategorias cambiaron
        mientras el modal estaba abierto.
      */}
      <ManageCategoriasDialog
        open={manageDialogOpen}
        onOpenChange={(o) => {
          setManageDialogOpen(o)
          if (!o) {
            // Refrescamos productos para que la columna "Subcategoria"
            // refleje borrados que hayan ocurrido en cascada.
            loadProductos()
          }
        }}
        categorias={categorias}
        subcategorias={subcategorias}
        onSubcategoriasChanged={loadSubcategorias}
        onCreateCategoria={() => {
          setNewCategoriaName("")
          setCategoriaDialogOpen(true)
        }}
      />

      {/* Quick-create Categoria Modal */}
      <Dialog open={categoriaDialogOpen} onOpenChange={setCategoriaDialogOpen}>
        <DialogContent className="max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-stone-700" />
              Nueva Categoria
            </DialogTitle>
            <DialogDescription>
              Agrega una nueva categoria al catalogo
            </DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <Label htmlFor="categoria-nombre">Nombre</Label>
            <Input
              id="categoria-nombre"
              value={newCategoriaName}
              onChange={(e) => setNewCategoriaName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !creatingCategoria) handleCreateCategoria() }}
              placeholder="Ej: Electronica"
              className="mt-2 rounded-xl border-stone-200"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoriaDialogOpen(false)} disabled={creatingCategoria}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateCategoria}
              disabled={creatingCategoria || !newCategoriaName.trim()}
              className="bg-stone-700 hover:bg-stone-800 text-white"
            >
              {creatingCategoria && <Spinner className="mr-2 h-4 w-4" />}
              Crear Categoria
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Carga masiva de productos ── */}
      <Dialog open={bulkDialogOpen} onOpenChange={(o) => {
        setBulkDialogOpen(o)
        if (!o) { setBulkRows([]); setBulkErrors([]); setBulkFileName(""); setBulkEmpId("") }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Carga masiva de productos</DialogTitle>
            <DialogDescription>
              Selecciona el emprendedor, descarga la plantilla, llénala y súbela.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Selector de emprendedor */}
            <div className="space-y-1.5">
              <Label>Emprendedor *</Label>
              <Select value={bulkEmpId} onValueChange={setBulkEmpId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un emprendedor" />
                </SelectTrigger>
                <SelectContent>
                  {emprendimientos.map((e) => (
                    <SelectItem key={e.id} value={e.id!.toString()}>
                      {e.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Acciones de archivo */}
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={descargarPlantilla}>
                <Download className="h-4 w-4 mr-1" /> Descargar plantilla
              </Button>
              <Button variant="outline" size="sm" onClick={() => bulkFileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1" /> Cargar Excel
              </Button>
              <input
                ref={bulkFileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleBulkFile}
              />
            </div>

            {bulkFileName && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <FileSpreadsheet className="h-4 w-4" /> {bulkFileName}
              </p>
            )}

            {/* Errores de parseo */}
            {bulkErrors.length > 0 && (
              <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive space-y-0.5 max-h-36 overflow-y-auto">
                {bulkErrors.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            )}

            {/* Preview de filas */}
            {bulkRows.length > 0 && (
              <div className="rounded-md border overflow-auto max-h-56">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead className="text-right">Cant. ini.</TableHead>
                      <TableHead>Marca</TableHead>
                      <TableHead>Categoría</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bulkRows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{r.nombre}</TableCell>
                        <TableCell className="font-mono text-sm">{r.codigo_barras}</TableCell>
                        <TableCell className="text-right">{r.precio_venta_sugerido.toLocaleString("es")}</TableCell>
                        <TableCell className="text-right">{r.cantidad_inicial ?? 0}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.marca ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.categoria ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleBulkProcess}
              disabled={bulkSending || bulkRows.length === 0 || !bulkEmpId}
            >
              {bulkSending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {bulkSending ? "Procesando..." : `Crear ${bulkRows.length} producto(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
