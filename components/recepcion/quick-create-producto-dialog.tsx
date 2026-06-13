"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import {
  type Marca,
  type Categoria,
  type Subcategoria,
  type Producto,
  saveProducto,
  getMarcas,
  getCategorias,
  getSubcategorias,
  createMarca,
  createCategoria,
} from "@/lib/services/catalogos"

/**
 * Dialogo "Crear Producto Rapido" enfocado al flujo de Recepcion por
 * Factura. Recibe un nombre sugerido (extraido por IA) y un costo
 * sugerido (costo unitario de la factura). Al guardar, devuelve el
 * `Producto` recien creado para que el llamador lo auto-asocie a la
 * linea de factura activa.
 *
 * Es un subset del formulario completo de `/configuracion/productos`:
 * solo los campos esenciales para no romper el flujo. Los campos
 * avanzados (foto, multimoneda, etc.) se editan despues desde el
 * modulo de productos.
 */
export interface QuickCreateProductoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Nombre sugerido (texto extraido por IA de la factura). */
  defaultNombre?: string
  /** Costo unitario sugerido (de la linea de factura). */
  defaultCosto?: number
  /** Callback con el producto recien guardado en BD. */
  onCreated: (producto: Producto) => void
}

export function QuickCreateProductoDialog({
  open,
  onOpenChange,
  defaultNombre = "",
  defaultCosto = 0,
  onCreated,
}: QuickCreateProductoDialogProps) {
  const { toast } = useToast()

  // Catalogos auxiliares.
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([])
  const [loadingCatalogs, setLoadingCatalogs] = useState(false)

  // Form principal.
  const [nombre, setNombre] = useState(defaultNombre)
  const [codigoBarras, setCodigoBarras] = useState("")
  // Precio de venta y % utilidad estan sincronizados bidireccionalmente:
  // - Si el usuario ingresa precio: recalcula utilidad.
  // - Si el usuario ingresa utilidad: recalcula precio.
  // - Si el usuario cambia el costo: actualiza el lado opuesto al
  //   "ultimo editado" para preservar la intencion del usuario.
  const [precioVenta, setPrecioVenta] = useState(0)
  const [utilidadPct, setUtilidadPct] = useState(0)
  // Tracker del ultimo campo editado por el usuario. Sirve para que al
  // cambiar el costo sepamos si recalcular precio (si fijo utilidad) o
  // utilidad (si fijo precio).
  const [lastEdited, setLastEdited] = useState<"precio" | "utilidad" | null>(null)
  const [costo, setCosto] = useState(defaultCosto)
  const [marcaId, setMarcaId] = useState<number | null>(null)
  const [categoriaId, setCategoriaId] = useState<number | null>(null)
  const [subcategoriaId, setSubcategoriaId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  // Quick-create de Marca / Categoria desde aqui mismo.
  const [creatingMarca, setCreatingMarca] = useState(false)
  const [creatingCategoria, setCreatingCategoria] = useState(false)
  const [showMarcaInput, setShowMarcaInput] = useState(false)
  const [showCategoriaInput, setShowCategoriaInput] = useState(false)
  const [nuevaMarca, setNuevaMarca] = useState("")
  const [nuevaCategoria, setNuevaCategoria] = useState("")

  // Carga de catalogos cuando se abre el modal. Solo recargamos al abrir
  // para evitar fetches innecesarios mientras el modal esta cerrado.
  useEffect(() => {
    if (!open) return
    let cancelled = false

    async function loadCatalogs() {
      setLoadingCatalogs(true)
      const [mRes, cRes, sRes] = await Promise.all([
        getMarcas(),
        getCategorias(),
        getSubcategorias(),
      ])
      if (cancelled) return
      if (mRes.data) setMarcas(mRes.data)
      if (cRes.data) setCategorias(cRes.data)
      if (sRes.data) setSubcategorias(sRes.data)
      setLoadingCatalogs(false)
    }

    loadCatalogs()
    return () => {
      cancelled = true
    }
  }, [open])

  // Cuando se abre o cambian los defaults, sembramos el form. NO
  // sobreescribimos si el usuario ya empezo a editar (open => false => true).
  useEffect(() => {
    if (open) {
      setNombre(defaultNombre)
      setCodigoBarras("")
      setPrecioVenta(0)
      setUtilidadPct(0)
      setLastEdited(null)
      setCosto(defaultCosto)
      setMarcaId(null)
      setCategoriaId(null)
      setSubcategoriaId(null)
      setShowMarcaInput(false)
      setShowCategoriaInput(false)
      setNuevaMarca("")
      setNuevaCategoria("")
    }
    // Eslint-disable: queremos resetear unicamente al abrir/cambiar fuente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Subcategorias filtradas por la categoria seleccionada (cascada).
  const subcategoriasFiltradas = useMemo(() => {
    if (!categoriaId) return []
    return subcategorias.filter((s) => s.categoria_id === categoriaId)
  }, [subcategorias, categoriaId])

  // ─── Sincronizacion Precio <-> % Utilidad ───────────────────────────
  // Convencion: utilidad como markup sobre costo.
  //   precio  = costo * (1 + utilidad/100)
  //   utilidad= (precio / costo - 1) * 100
  // Redondeamos a 2 decimales para evitar drift visual.
  const round2 = (n: number) => Math.round(n * 100) / 100

  function handleCostoChange(nuevoCosto: number) {
    setCosto(nuevoCosto)
    if (nuevoCosto <= 0) return
    // Mantenemos lo que el usuario fijo manualmente: si fijo precio,
    // recalculamos utilidad; si fijo utilidad, recalculamos precio.
    if (lastEdited === "precio" && precioVenta > 0) {
      setUtilidadPct(round2((precioVenta / nuevoCosto - 1) * 100))
    } else if (lastEdited === "utilidad") {
      setPrecioVenta(round2(nuevoCosto * (1 + utilidadPct / 100)))
    }
  }

  function handlePrecioChange(nuevoPrecio: number) {
    setPrecioVenta(nuevoPrecio)
    setLastEdited("precio")
    if (costo > 0 && nuevoPrecio > 0) {
      setUtilidadPct(round2((nuevoPrecio / costo - 1) * 100))
    } else if (nuevoPrecio === 0) {
      setUtilidadPct(0)
    }
  }

  function handleUtilidadChange(nuevaUtilidad: number) {
    setUtilidadPct(nuevaUtilidad)
    setLastEdited("utilidad")
    if (costo > 0) {
      setPrecioVenta(round2(costo * (1 + nuevaUtilidad / 100)))
    }
  }

  async function handleQuickMarca() {
    const trimmed = nuevaMarca.trim()
    if (!trimmed) return
    setCreatingMarca(true)
    const { data, error } = await createMarca(trimmed)
    setCreatingMarca(false)
    if (error || !data) {
      toast({
        title: "Error",
        description: error || "No se pudo crear la marca",
        variant: "destructive",
      })
      return
    }
    setMarcas((prev) =>
      [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre))
    )
    if (data.id) setMarcaId(data.id)
    setShowMarcaInput(false)
    setNuevaMarca("")
  }

  async function handleQuickCategoria() {
    const trimmed = nuevaCategoria.trim()
    if (!trimmed) return
    setCreatingCategoria(true)
    const { data, error } = await createCategoria(trimmed)
    setCreatingCategoria(false)
    if (error || !data) {
      toast({
        title: "Error",
        description: error || "No se pudo crear la categoria",
        variant: "destructive",
      })
      return
    }
    setCategorias((prev) =>
      [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre))
    )
    if (data.id) setCategoriaId(data.id)
    setShowCategoriaInput(false)
    setNuevaCategoria("")
  }

  async function handleSave() {
    const nombreTrim = nombre.trim()
    if (!nombreTrim) {
      toast({
        title: "Falta el nombre",
        description: "Ingrese un nombre para el producto",
        variant: "destructive",
      })
      return
    }

    setSaving(true)

    // Si no se ingreso codigo de barras generamos uno tipo AUTO-<timestamp>
    // para satisfacer el campo (que el modulo de productos requiere) sin
    // bloquear el flujo de recepcion. El usuario puede editarlo despues.
    const codigoFinal =
      codigoBarras.trim() ||
      `AUTO-${Date.now().toString(36).toUpperCase()}`

    const payload: Producto = {
      nombre: nombreTrim,
      codigo_barras: codigoFinal,
      precio_venta_sugerido: Number(precioVenta) || 0,
      costo_promedio: Number(costo) || 0,
      stock_total: 0,
      foto_url: "",
      marca_id: marcaId,
      categoria_id: categoriaId,
      subcategoria_id: categoriaId ? subcategoriaId : null,
    }

    const { data, error } = await saveProducto(payload, true)
    setSaving(false)

    if (error || !data) {
      toast({
        title: "Error",
        description: error || "No se pudo crear el producto",
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Producto creado",
      description: `${nombreTrim} se asocio a la linea de la factura`,
    })

    // Enriquecemos `data` con los nombres flat para que la UI lo muestre
    // sin tener que recargar todo el catalogo de productos.
    const enriched: Producto = {
      ...data,
      marca_nombre:
        marcas.find((m) => m.id === marcaId)?.nombre ?? data.marca_nombre ?? null,
      categoria_nombre:
        categorias.find((c) => c.id === categoriaId)?.nombre ??
        data.categoria_nombre ??
        null,
      subcategoria_nombre:
        subcategorias.find((s) => s.id === subcategoriaId)?.nombre ??
        data.subcategoria_nombre ??
        null,
    }

    onCreated(enriched)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Crear Producto Rapido</DialogTitle>
          <DialogDescription>
            Crea el producto y se asociara automaticamente a esta linea de
            la factura
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Nombre */}
          <div className="grid gap-1.5">
            <Label htmlFor="qc-nombre">
              Nombre <span className="text-destructive">*</span>
            </Label>
            <Input
              id="qc-nombre"
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del producto"
              className="border-stone-200"
            />
          </div>

          {/* Codigo */}
          <div className="grid gap-1.5">
            <Label htmlFor="qc-codigo">Codigo de Barras</Label>
            <Input
              id="qc-codigo"
              value={codigoBarras}
              onChange={(e) => setCodigoBarras(e.target.value)}
              placeholder="Auto-generado si se deja vacio"
              className="border-stone-200"
            />
          </div>

          {/*
            ─── Bloque destacado: Costo + Utilidad + Precio ─────────
            El costo viene precargado desde el costo final calculado
            de la linea (incluye prorrateo). El usuario puede:
            (a) escribir el precio de venta directo, y la utilidad se
                calcula sola, o
            (b) escribir un % de utilidad y el precio se calcula solo.
            Cambiar el costo recalcula el lado opuesto al ultimo
            editado por el usuario.
          */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-amber-900">
                Costo y Precio de Venta
              </Label>
              {costo > 0 && precioVenta > 0 && (
                <span className="text-[11px] text-amber-700">
                  Ganancia por unidad:{" "}
                  <span className="font-semibold">
                    L {round2(precioVenta - costo).toFixed(2)}
                  </span>
                </span>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="qc-costo" className="text-xs text-stone-600">
                Costo unitario
                {defaultCosto > 0 && (
                  <span className="ml-1 text-[10px] text-amber-700">
                    (calculado de la factura)
                  </span>
                )}
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-stone-500">
                  L
                </span>
                <Input
                  id="qc-costo"
                  type="number"
                  step="0.01"
                  min="0"
                  value={costo || ""}
                  onChange={(e) =>
                    handleCostoChange(parseFloat(e.target.value) || 0)
                  }
                  placeholder="0.00"
                  className="pl-7 border-stone-200 bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="qc-utilidad" className="text-xs text-stone-600">
                  % Utilidad
                </Label>
                <div className="relative">
                  <Input
                    id="qc-utilidad"
                    type="number"
                    step="0.01"
                    min="0"
                    value={utilidadPct || ""}
                    onChange={(e) =>
                      handleUtilidadChange(parseFloat(e.target.value) || 0)
                    }
                    placeholder="0"
                    className="pr-7 border-stone-200 bg-white"
                    disabled={costo <= 0}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-500">
                    %
                  </span>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="qc-precio" className="text-xs text-stone-600">
                  Precio venta
                </Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-stone-500">
                    L
                  </span>
                  <Input
                    id="qc-precio"
                    type="number"
                    step="0.01"
                    min="0"
                    value={precioVenta || ""}
                    onChange={(e) =>
                      handlePrecioChange(parseFloat(e.target.value) || 0)
                    }
                    placeholder="0.00"
                    className="pl-7 border-stone-200 bg-white font-semibold"
                  />
                </div>
              </div>
            </div>

            {costo <= 0 && (
              <p className="text-[11px] text-stone-500">
                Ingresa un costo para calcular el % de utilidad
              </p>
            )}
          </div>

          {/* Marca */}
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label>Marca</Label>
              <button
                type="button"
                onClick={() => setShowMarcaInput((v) => !v)}
                className="text-xs text-amber-700 hover:underline"
              >
                {showMarcaInput ? "Cancelar" : "+ Nueva"}
              </button>
            </div>
            {showMarcaInput ? (
              <div className="flex gap-2">
                <Input
                  autoFocus
                  value={nuevaMarca}
                  onChange={(e) => setNuevaMarca(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleQuickMarca()
                  }}
                  placeholder="Nombre de la nueva marca"
                  className="border-stone-200"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleQuickMarca}
                  disabled={creatingMarca || !nuevaMarca.trim()}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  {creatingMarca ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
            ) : (
              <Select
                value={marcaId?.toString() || "none"}
                onValueChange={(v) => setMarcaId(v === "none" ? null : parseInt(v))}
                disabled={loadingCatalogs}
              >
                <SelectTrigger className="border-stone-200">
                  <SelectValue placeholder="Sin marca" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin marca</SelectItem>
                  {marcas.map((m) => (
                    <SelectItem key={m.id} value={m.id!.toString()}>
                      {m.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Categoria + Subcategoria */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label>Categoria</Label>
                <button
                  type="button"
                  onClick={() => setShowCategoriaInput((v) => !v)}
                  className="text-xs text-amber-700 hover:underline"
                >
                  {showCategoriaInput ? "Cancelar" : "+ Nueva"}
                </button>
              </div>
              {showCategoriaInput ? (
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    value={nuevaCategoria}
                    onChange={(e) => setNuevaCategoria(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleQuickCategoria()
                    }}
                    placeholder="Categoria"
                    className="border-stone-200"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleQuickCategoria}
                    disabled={creatingCategoria || !nuevaCategoria.trim()}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    {creatingCategoria ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  </Button>
                </div>
              ) : (
                <Select
                  value={categoriaId?.toString() || "none"}
                  onValueChange={(v) => {
                    setCategoriaId(v === "none" ? null : parseInt(v))
                    setSubcategoriaId(null)
                  }}
                  disabled={loadingCatalogs}
                >
                  <SelectTrigger className="border-stone-200">
                    <SelectValue placeholder="Sin categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin categoria</SelectItem>
                    {categorias.map((c) => (
                      <SelectItem key={c.id} value={c.id!.toString()}>
                        {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label>
                Subcategoria{" "}
                <span className="text-stone-400 text-xs font-normal">
                  (opcional)
                </span>
              </Label>
              <Select
                value={subcategoriaId?.toString() || "none"}
                onValueChange={(v) =>
                  setSubcategoriaId(v === "none" ? null : parseInt(v))
                }
                disabled={!categoriaId}
              >
                <SelectTrigger className="border-stone-200">
                  <SelectValue
                    placeholder={
                      categoriaId
                        ? "Sin subcategoria"
                        : "Selecciona categoria"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin subcategoria</SelectItem>
                  {subcategoriasFiltradas.map((s) => (
                    <SelectItem key={s.id} value={s.id!.toString()}>
                      {s.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || !nombre.trim()}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear y Asociar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
