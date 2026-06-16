"use client"

import * as React from "react"
import Image from "next/image"
import {
  Search,
  LayoutGrid,
  List as ListIcon,
  Plus,
  Check,
  ImageIcon,
  Loader2,
} from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { Producto, Marca, Categoria } from "@/lib/services/catalogos"

const VIEW_STORAGE_KEY = "pos.catalogo.view"
const STOCK_BAJO = 5
export const TODOS = "__todos__"

interface ProductCatalogProps {
  productos: Producto[]
  marcas: Marca[]
  categorias: Categoria[]
  idsEnVenta: number[]
  onAdd: (producto: Producto) => void
  disabled?: boolean
  localizacionSeleccionada?: boolean
  stockPorLocalizacion?: Record<number, number>
  loadingStock?: boolean
  /**
   * Cuando se provee esta función el catálogo hace búsquedas server-side con
   * debounce de 300 ms en lugar de filtrar los `productos` en cliente.
   * Ideal para catálogos con 1 000+ artículos.
   */
  buscarFn?: (q: string, catId: string, marcaId: string) => Promise<Producto[]>
  /** Número total de productos en el sistema (para la leyenda de carga inicial). */
  totalProductos?: number
}

export function ProductCatalog({
  productos,
  marcas,
  categorias,
  idsEnVenta,
  onAdd,
  disabled,
  localizacionSeleccionada = false,
  stockPorLocalizacion,
  loadingStock = false,
  buscarFn,
  totalProductos,
}: ProductCatalogProps) {
  const [view, setView] = React.useState<"grid" | "list">("grid")
  const [search, setSearch] = React.useState("")
  const [categoriaFiltro, setCategoriaFiltro] = React.useState<string>(TODOS)
  const [marcaFiltro, setMarcaFiltro] = React.useState<string>(TODOS)

  // Server-side search state
  const [resultadosServer, setResultadosServer] = React.useState<Producto[] | null>(null)
  const [buscando, setBuscando] = React.useState(false)

  const getStock = React.useCallback(
    (p: Producto): number => {
      if (localizacionSeleccionada) return stockPorLocalizacion?.[p.id!] ?? 0
      return p.stock_total ?? 0
    },
    [localizacionSeleccionada, stockPorLocalizacion]
  )

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_STORAGE_KEY)
      if (saved === "grid" || saved === "list") setView(saved)
    } catch { /* no-op */ }
  }, [])

  function cambiarVista(next: "grid" | "list") {
    setView(next)
    try { localStorage.setItem(VIEW_STORAGE_KEY, next) } catch { /* no-op */ }
  }

  // Cuando cambia buscarFn (contexto padre cambió, ej. emprendimiento) resetear resultados
  React.useEffect(() => {
    setResultadosServer(null)
  }, [buscarFn])

  // Búsqueda server-side con debounce
  React.useEffect(() => {
    if (!buscarFn) return

    const isActive = search.trim() || categoriaFiltro !== TODOS || marcaFiltro !== TODOS
    if (!isActive) {
      setResultadosServer(null)
      return
    }

    setBuscando(true)
    const timer = setTimeout(async () => {
      try {
        const results = await buscarFn(search, categoriaFiltro, marcaFiltro)
        setResultadosServer(results)
      } finally {
        setBuscando(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [buscarFn, search, categoriaFiltro, marcaFiltro])

  // Filtrado: usa resultados del servidor si están disponibles, si no filtra la lista inicial
  const filtrados = React.useMemo(() => {
    const fuente = resultadosServer !== null ? resultadosServer : productos
    if (resultadosServer !== null) {
      // El servidor ya filtró por texto/cat/marca; solo aplicamos disponibilidad local
      return fuente.filter(p =>
        !localizacionSeleccionada || (stockPorLocalizacion?.[p.id!] ?? 0) > 0
      )
    }
    // Filtrado local (lista inicial o sin buscarFn)
    const q = search.toLowerCase().trim()
    return fuente.filter(p => {
      const matchTexto = !q ||
        (p.nombre ?? "").toLowerCase().includes(q) ||
        (p.codigo_barras ?? "").toLowerCase().includes(q)
      const matchCat = categoriaFiltro === TODOS || String(p.categoria_id ?? "") === categoriaFiltro
      const matchMarca = marcaFiltro === TODOS || String(p.marca_id ?? "") === marcaFiltro
      const matchDisp = !localizacionSeleccionada || (stockPorLocalizacion?.[p.id!] ?? 0) > 0
      return matchTexto && matchCat && matchMarca && matchDisp
    })
  }, [resultadosServer, productos, search, categoriaFiltro, marcaFiltro, localizacionSeleccionada, stockPorLocalizacion])

  const mostrandoInicial = buscarFn && resultadosServer === null && !buscando
  const sinFiltrosActivos = !search.trim() && categoriaFiltro === TODOS && marcaFiltro === TODOS

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* Barra de búsqueda + filtros + toggle de vista */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o código de barras..."
              className="pl-9"
            />
            {buscando && (
              <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <div className="flex items-center rounded-md border bg-muted/40 p-0.5 shrink-0">
            <Button
              type="button"
              variant={view === "grid" ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => cambiarVista("grid")}
              title="Vista de mosaico"
              aria-pressed={view === "grid"}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={view === "list" ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => cambiarVista("list")}
              title="Vista de lista"
              aria-pressed={view === "list"}
            >
              <ListIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todas las categorias</SelectItem>
              {categorias.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={marcaFiltro} onValueChange={setMarcaFiltro}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Marca" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todas las marcas</SelectItem>
              {marcas.map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>{m.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Leyenda de resultados */}
        {buscarFn && (
          <p className="text-[11px] text-muted-foreground px-0.5">
            {buscando ? (
              "Buscando..."
            ) : mostrandoInicial && sinFiltrosActivos ? (
              <>
                Mostrando los primeros {productos.length} productos
                {totalProductos && totalProductos > productos.length
                  ? ` de ${totalProductos.toLocaleString()} — escribe para buscar entre todos`
                  : ""}
              </>
            ) : (
              `${filtrados.length} resultado${filtrados.length !== 1 ? "s" : ""}`
            )}
          </p>
        )}
      </div>

      {/* Resultados */}
      <div className="flex-1 overflow-auto min-h-0">
        {loadingStock ? (
          <div className="h-full min-h-40 flex flex-col items-center justify-center text-muted-foreground gap-2 py-10">
            <Loader2 className="h-8 w-8 animate-spin opacity-40" />
            <p className="text-sm">Cargando disponibilidad...</p>
          </div>
        ) : buscando ? (
          <div className="h-full min-h-40 flex flex-col items-center justify-center text-muted-foreground gap-2 py-10">
            <Loader2 className="h-8 w-8 animate-spin opacity-40" />
            <p className="text-sm">Buscando productos...</p>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="h-full min-h-40 flex flex-col items-center justify-center text-muted-foreground gap-2 py-10">
            <ImageIcon className="h-10 w-10 opacity-20" />
            <p className="text-sm">
              {localizacionSeleccionada
                ? "No hay productos disponibles en esta localizacion."
                : "No se encontraron productos."}
            </p>
          </div>
        ) : view === "grid" ? (
          <ProductGrid
            productos={filtrados}
            idsEnVenta={idsEnVenta}
            onAdd={onAdd}
            disabled={disabled}
            getStock={getStock}
          />
        ) : (
          <ProductTable
            productos={filtrados}
            idsEnVenta={idsEnVenta}
            onAdd={onAdd}
            disabled={disabled}
            getStock={getStock}
          />
        )}
      </div>
    </div>
  )
}

function stockClass(stock: number): string {
  return stock <= STOCK_BAJO ? "text-red-600" : "text-emerald-600"
}

function ProductImage({ url, nombre, className }: { url?: string; nombre: string; className?: string }) {
  const [errored, setErrored] = React.useState(false)
  if (!url || errored) {
    return (
      <div className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)}>
        <ImageIcon className="h-1/3 w-1/3 opacity-40" />
      </div>
    )
  }
  return (
    <Image
      src={url || "/placeholder.svg"}
      alt={nombre}
      width={160}
      height={160}
      unoptimized
      onError={() => setErrored(true)}
      className={cn("object-cover", className)}
    />
  )
}

interface ListProps {
  productos: Producto[]
  idsEnVenta: number[]
  onAdd: (p: Producto) => void
  disabled?: boolean
  getStock: (p: Producto) => number
}

function ProductGrid({ productos, idsEnVenta, onAdd, disabled, getStock }: ListProps) {
  return (
    <div className="grid grid-cols-2 min-[480px]:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3">
      {productos.map((p) => {
        const enVenta = idsEnVenta.includes(p.id!)
        const stock = getStock(p)
        return (
          <button
            key={p.id}
            type="button"
            disabled={disabled}
            onClick={() => onAdd(p)}
            className={cn(
              "group relative flex flex-col rounded-lg border bg-card text-left overflow-hidden transition-colors",
              "hover:border-primary hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              enVenta && "border-primary"
            )}
          >
            <div className="relative aspect-square w-full">
              <ProductImage url={p.foto_url} nombre={p.nombre} className="h-full w-full" />
              {enVenta && (
                <span className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                  <Check className="h-3.5 w-3.5" />
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1 p-2 sm:p-2.5 min-w-0">
              <p className="text-[13px] sm:text-sm font-medium leading-tight line-clamp-2 break-words">{p.nombre}</p>
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 mt-0.5">
                <span className="text-[13px] sm:text-sm font-bold text-primary whitespace-nowrap">
                  L {(p.precio_venta_sugerido ?? 0).toFixed(2)}
                </span>
                <span className={cn("text-[11px] sm:text-xs font-medium whitespace-nowrap", stockClass(stock))}>
                  Stock: {stock}
                </span>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function ProductTable({ productos, idsEnVenta, onAdd, disabled, getStock }: ListProps) {
  return (
    <div className="rounded-lg border overflow-x-auto">
      <table className="w-full min-w-[34rem] text-sm">
        <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="text-left font-medium px-2 sm:px-3 py-2 w-12">Foto</th>
            <th className="text-left font-medium px-2 sm:px-3 py-2">Nombre</th>
            <th className="text-left font-medium px-3 py-2 hidden md:table-cell">Codigo</th>
            <th className="text-left font-medium px-3 py-2 hidden lg:table-cell">Marca</th>
            <th className="text-left font-medium px-3 py-2 hidden lg:table-cell">Categoria</th>
            <th className="text-right font-medium px-2 sm:px-3 py-2">Stock</th>
            <th className="text-right font-medium px-2 sm:px-3 py-2">Precio</th>
            <th className="px-2 sm:px-3 py-2 w-12" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {productos.map((p) => {
            const enVenta = idsEnVenta.includes(p.id!)
            const stock = getStock(p)
            return (
              <tr key={p.id} className="hover:bg-muted/40">
                <td className="px-2 sm:px-3 py-2">
                  <ProductImage url={p.foto_url} nombre={p.nombre} className="h-9 w-9 rounded-md shrink-0" />
                </td>
                <td className="px-2 sm:px-3 py-2 max-w-[10rem]">
                  <span className="font-medium line-clamp-2 break-words">{p.nombre}</span>
                  {enVenta && <Badge variant="secondary" className="mt-1 text-[10px]">En venta</Badge>}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground hidden md:table-cell whitespace-nowrap">
                  {p.codigo_barras || "-"}
                </td>
                <td className="px-3 py-2 text-muted-foreground hidden lg:table-cell">{p.marca_nombre || "-"}</td>
                <td className="px-3 py-2 text-muted-foreground hidden lg:table-cell">{p.categoria_nombre || "-"}</td>
                <td className={cn("px-2 sm:px-3 py-2 text-right font-medium whitespace-nowrap", stockClass(stock))}>
                  {stock}
                </td>
                <td className="px-2 sm:px-3 py-2 text-right font-bold text-primary whitespace-nowrap">
                  L {(p.precio_venta_sugerido ?? 0).toFixed(2)}
                </td>
                <td className="px-2 sm:px-3 py-2 text-right">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    disabled={disabled}
                    onClick={() => onAdd(p)}
                    title="Agregar al carrito"
                    aria-label={`Agregar ${p.nombre} al carrito`}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
