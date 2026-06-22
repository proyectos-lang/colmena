"use client"

import * as React from "react"
import { useAuth } from "@/lib/contexts/auth-context"
import {
  getProductosPendientes,
  aprobarProductoPendiente,
  rechazarProductoPendiente,
  type ProductoPendiente,
} from "@/lib/services/productos-pendientes"
import {
  getIngresosPendientes,
  aprobarIngresoPendiente,
  rechazarIngresoPendiente,
  type IngresoPendiente,
} from "@/lib/services/inventario-pendiente"
import { getAlmacenes, getLocalizaciones } from "@/lib/services/catalogos"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { CheckCircle, XCircle, ImageIcon, CheckSquare, Loader2 } from "lucide-react"
import { format } from "date-fns"

function EstadoBadge({ estado }: { estado: string }) {
  if (estado === "aprobado") return <Badge variant="default" className="bg-green-600">Aprobado</Badge>
  if (estado === "rechazado") return <Badge variant="destructive">Rechazado</Badge>
  return <Badge variant="secondary">Pendiente</Badge>
}

export default function AprobacionesPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const razonSocialId = user?.razon_social_id ?? 0

  const [productosPendientes, setProductosPendientes] = React.useState<ProductoPendiente[]>([])
  const [ingresosPendientes, setIngresosPendientes] = React.useState<IngresoPendiente[]>([])
  const [loading, setLoading] = React.useState(true)
  const [almacenes, setAlmacenes] = React.useState<any[]>([])
  const [localizaciones, setLocalizaciones] = React.useState<any[]>([])

  // Selección individual
  const [rechazoOpen, setRechazoOpen] = React.useState(false)
  const [rechazoMotivo, setRechazoMotivo] = React.useState("")
  const [rechazoTarget, setRechazoTarget] = React.useState<{ tipo: "producto" | "ingreso"; id: number } | null>(null)

  const [aprobarOpen, setAprobarOpen] = React.useState(false)
  const [aprobarTarget, setAprobarTarget] = React.useState<{ tipo: "producto" | "ingreso"; id: number; tieneCantidad: boolean } | null>(null)
  const [almacenSeleccionado, setAlmacenSeleccionado] = React.useState("")
  const [localizacionSeleccionada, setLocalizacionSeleccionada] = React.useState("")

  // Selección masiva — IDs de filas pendientes seleccionadas
  const [selProductos, setSelProductos] = React.useState<Set<number>>(new Set())
  const [selIngresos, setSelIngresos] = React.useState<Set<number>>(new Set())

  // Modal aprobación masiva
  const [masivoOpen, setMasivoOpen] = React.useState(false)
  const [masivoTipo, setMasivoTipo] = React.useState<"producto" | "ingreso">("producto")
  const [masivoAlmacen, setMasivoAlmacen] = React.useState("")
  const [masivoLocalizacion, setMasivoLocalizacion] = React.useState("")
  const [masivoLocalizaciones, setMasivoLocalizaciones] = React.useState<any[]>([])
  const [aprobando, setAprobando] = React.useState(false)

  const cargar = React.useCallback(async () => {
    if (!razonSocialId) return
    setLoading(true)
    const [prods, ingresos, alms] = await Promise.all([
      getProductosPendientes(razonSocialId),
      getIngresosPendientes(razonSocialId),
      getAlmacenes(),
    ])
    setProductosPendientes(prods)
    setIngresosPendientes(ingresos)
    setAlmacenes(alms.data ?? [])
    setLoading(false)
  }, [razonSocialId])

  React.useEffect(() => { cargar() }, [cargar])

  // Limpiar selección al recargar
  React.useEffect(() => {
    setSelProductos(new Set())
    setSelIngresos(new Set())
  }, [productosPendientes, ingresosPendientes])

  // Localizaciones para el modal individual
  React.useEffect(() => {
    if (almacenSeleccionado) {
      getLocalizaciones(Number(almacenSeleccionado)).then((res) =>
        setLocalizaciones(res.data ?? [])
      )
    } else {
      setLocalizaciones([])
      setLocalizacionSeleccionada("")
    }
  }, [almacenSeleccionado])

  // Localizaciones para el modal masivo
  React.useEffect(() => {
    if (masivoAlmacen) {
      getLocalizaciones(Number(masivoAlmacen)).then((res) =>
        setMasivoLocalizaciones(res.data ?? [])
      )
    } else {
      setMasivoLocalizaciones([])
      setMasivoLocalizacion("")
    }
  }, [masivoAlmacen])

  // ── Helpers de selección ──────────────────────────────────────────────────

  const pendientesProductos = productosPendientes.filter((p) => p.estado === "pendiente")
  const pendientesIngresos  = ingresosPendientes.filter((i) => i.estado === "pendiente")

  const todosProductosSeleccionados =
    pendientesProductos.length > 0 && pendientesProductos.every((p) => selProductos.has(p.id!))
  const todosIngresosSeleccionados =
    pendientesIngresos.length > 0 && pendientesIngresos.every((i) => selIngresos.has(i.id!))

  function toggleProducto(id: number) {
    setSelProductos((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleIngreso(id: number) {
    setSelIngresos((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleTodosProductos(checked: boolean) {
    setSelProductos(checked ? new Set(pendientesProductos.map((p) => p.id!)) : new Set())
  }

  function toggleTodosIngresos(checked: boolean) {
    setSelIngresos(checked ? new Set(pendientesIngresos.map((i) => i.id!)) : new Set())
  }

  // ── Aprobación individual ────────────────────────────────────────────────

  const abrirAprobar = (tipo: "producto" | "ingreso", id: number, tieneCantidad: boolean) => {
    setAprobarTarget({ tipo, id, tieneCantidad })
    setAlmacenSeleccionado("")
    setLocalizacionSeleccionada("")
    setAprobarOpen(true)
  }

  const confirmarAprobar = async () => {
    if (!aprobarTarget) return

    // Validar almacén y localización obligatorios
    const necesitaUbicacion = aprobarTarget.tieneCantidad || aprobarTarget.tipo === "ingreso"
    if (necesitaUbicacion) {
      if (!almacenSeleccionado) { toast({ title: "Campo requerido", description: "El almacén destino es obligatorio", variant: "destructive" }); return }
      if (!localizacionSeleccionada) { toast({ title: "Campo requerido", description: "La localización es obligatoria", variant: "destructive" }); return }
    }

    const almacenId = almacenSeleccionado ? Number(almacenSeleccionado) : undefined
    const localizacionId = localizacionSeleccionada ? Number(localizacionSeleccionada) : undefined

    try {
      let error: string | null = null
      if (aprobarTarget.tipo === "producto") {
        const res = await aprobarProductoPendiente(
          aprobarTarget.id,
          user?.nombre ?? "admin",
          razonSocialId,
          almacenId,
          localizacionId
        )
        error = res.error
      } else {
        const res = await aprobarIngresoPendiente(
          aprobarTarget.id,
          user?.nombre ?? "admin",
          Number(almacenSeleccionado),
          Number(localizacionSeleccionada)
        )
        error = res.error
      }

      if (error) { toast({ title: "Error al aprobar", description: error, variant: "destructive" }); return }
      toast({ title: "Aprobado", description: "El registro fue aprobado correctamente" })
      setAprobarOpen(false)
      cargar()
    } catch (err: any) {
      toast({ title: "Error inesperado", description: err?.message ?? "Intente de nuevo", variant: "destructive" })
    }
  }

  // ── Aprobación masiva ────────────────────────────────────────────────────

  const abrirMasivo = (tipo: "producto" | "ingreso") => {
    setMasivoTipo(tipo)
    setMasivoAlmacen("")
    setMasivoLocalizacion("")
    setMasivoLocalizaciones([])
    setMasivoOpen(true)
  }

  const confirmarMasivo = async () => {
    // Almacén y localización siempre obligatorios
    if (!masivoAlmacen) {
      toast({ title: "Campo requerido", description: "El almacén destino es obligatorio", variant: "destructive" })
      return
    }
    if (!masivoLocalizacion) {
      toast({ title: "Campo requerido", description: "La localización es obligatoria", variant: "destructive" })
      return
    }

    const almacenId = Number(masivoAlmacen)
    const localizacionId = Number(masivoLocalizacion)
    const ids = masivoTipo === "producto"
      ? Array.from(selProductos)
      : Array.from(selIngresos)

    setAprobando(true)
    let ok = 0
    let errores = 0

    try {
      for (const id of ids) {
        let error: string | null = null
        if (masivoTipo === "producto") {
          const res = await aprobarProductoPendiente(
            id,
            user?.nombre ?? "admin",
            razonSocialId,
            almacenId,
            localizacionId
          )
          error = res.error
        } else {
          const res = await aprobarIngresoPendiente(
            id,
            user?.nombre ?? "admin",
            almacenId,
            localizacionId
          )
          error = res.error
        }
        error ? errores++ : ok++
      }
    } catch (err: any) {
      setAprobando(false)
      toast({ title: "Error inesperado", description: err?.message ?? "Intente de nuevo", variant: "destructive" })
      return
    }

    setAprobando(false)
    setMasivoOpen(false)

    if (errores === 0) {
      toast({ title: "Aprobación completada", description: `${ok} ${masivoTipo === "producto" ? "productos aprobados" : "cargas aprobadas"} correctamente` })
    } else {
      toast({ title: `${ok} aprobados, ${errores} con error`, description: "Revise los registros con error e intente nuevamente", variant: "destructive" })
    }
    cargar()
  }

  // ── Rechazo ──────────────────────────────────────────────────────────────

  const abrirRechazo = (tipo: "producto" | "ingreso", id: number) => {
    setRechazoTarget({ tipo, id })
    setRechazoMotivo("")
    setRechazoOpen(true)
  }

  const confirmarRechazo = async () => {
    if (!rechazoTarget || !rechazoMotivo.trim()) {
      toast({ title: "Campo requerido", description: "El motivo de rechazo es requerido", variant: "destructive" })
      return
    }
    if (rechazoTarget.tipo === "producto") {
      await rechazarProductoPendiente(rechazoTarget.id, rechazoMotivo)
    } else {
      await rechazarIngresoPendiente(rechazoTarget.id, rechazoMotivo)
    }
    toast({ title: "Rechazado", description: "El registro fue rechazado" })
    setRechazoOpen(false)
    cargar()
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Aprobaciones</h1>
        <p className="text-muted-foreground text-sm">
          Revisa y aprueba los productos e inventarios enviados por los emprendedores
        </p>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : (
        <Tabs defaultValue="productos">
          <TabsList>
            <TabsTrigger value="productos">
              Productos Nuevos
              {pendientesProductos.length > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 min-w-5 text-xs">
                  {pendientesProductos.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="inventario">
              Cargas de Inventario
              {pendientesIngresos.length > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 min-w-5 text-xs">
                  {pendientesIngresos.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── TAB PRODUCTOS ── */}
          <TabsContent value="productos" className="mt-4 space-y-3">
            {/* Barra de acciones masivas */}
            {selProductos.size > 0 && (
              <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5">
                <CheckSquare className="h-4 w-4 text-green-700 shrink-0" />
                <span className="text-sm font-medium text-green-800">
                  {selProductos.size} {selProductos.size === 1 ? "producto seleccionado" : "productos seleccionados"}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => setSelProductos(new Set())}
                  >
                    Deseleccionar
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-green-600 hover:bg-green-700"
                    onClick={() => abrirMasivo("producto")}
                  >
                    <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                    Aprobar {selProductos.size} seleccionados
                  </Button>
                </div>
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={todosProductosSeleccionados}
                      onCheckedChange={(v) => toggleTodosProductos(Boolean(v))}
                      disabled={pendientesProductos.length === 0}
                      aria-label="Seleccionar todos los pendientes"
                    />
                  </TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Foto</TableHead>
                  <TableHead>Emprendimiento</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">Cant. Inicial</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendientesProductos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      No hay productos pendientes de aprobación
                    </TableCell>
                  </TableRow>
                ) : (
                  pendientesProductos.map((p) => (
                    <TableRow
                      key={p.id}
                      className={selProductos.has(p.id!) ? "bg-green-50/60" : undefined}
                    >
                      <TableCell>
                        {p.estado === "pendiente" && (
                          <Checkbox
                            checked={selProductos.has(p.id!)}
                            onCheckedChange={() => toggleProducto(p.id!)}
                            aria-label={`Seleccionar ${p.nombre}`}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.created_at ? format(new Date(p.created_at), "dd/MM/yyyy") : "—"}
                      </TableCell>
                      <TableCell>
                        {p.foto_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.foto_url} alt={p.nombre} className="h-10 w-10 rounded object-cover border" />
                        ) : (
                          <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                            <ImageIcon className="h-4 w-4 text-muted-foreground opacity-40" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{p.emprendimiento_nombre ?? "—"}</TableCell>
                      <TableCell>{p.nombre}</TableCell>
                      <TableCell className="font-mono text-sm">{p.codigo_barras}</TableCell>
                      <TableCell className="text-right">
                        {p.precio_venta_sugerido.toLocaleString("es")}
                      </TableCell>
                      <TableCell className="text-right">{p.cantidad_inicial ?? 0}</TableCell>
                      <TableCell><EstadoBadge estado={p.estado ?? "pendiente"} /></TableCell>
                      <TableCell className="text-right space-x-1">
                        {p.estado === "pendiente" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-green-600"
                              onClick={() => abrirAprobar("producto", p.id!, (p.cantidad_inicial ?? 0) > 0)}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => abrirRechazo("producto", p.id!)}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {p.estado === "rechazado" && p.motivo_rechazo && (
                          <span className="text-xs text-muted-foreground">{p.motivo_rechazo}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TabsContent>

          {/* ── TAB INVENTARIO ── */}
          <TabsContent value="inventario" className="mt-4 space-y-3">
            {/* Barra de acciones masivas */}
            {selIngresos.size > 0 && (
              <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5">
                <CheckSquare className="h-4 w-4 text-green-700 shrink-0" />
                <span className="text-sm font-medium text-green-800">
                  {selIngresos.size} {selIngresos.size === 1 ? "carga seleccionada" : "cargas seleccionadas"}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => setSelIngresos(new Set())}
                  >
                    Deseleccionar
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-green-600 hover:bg-green-700"
                    onClick={() => abrirMasivo("ingreso")}
                  >
                    <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                    Aprobar {selIngresos.size} seleccionadas
                  </Button>
                </div>
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={todosIngresosSeleccionados}
                      onCheckedChange={(v) => toggleTodosIngresos(Boolean(v))}
                      disabled={pendientesIngresos.length === 0}
                      aria-label="Seleccionar todas las cargas pendientes"
                    />
                  </TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Emprendimiento</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Precio unit.</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendientesIngresos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      No hay cargas de inventario pendientes de aprobación
                    </TableCell>
                  </TableRow>
                ) : (
                  pendientesIngresos.map((i) => (
                    <TableRow
                      key={i.id}
                      className={selIngresos.has(i.id!) ? "bg-green-50/60" : undefined}
                    >
                      <TableCell>
                        {i.estado === "pendiente" && (
                          <Checkbox
                            checked={selIngresos.has(i.id!)}
                            onCheckedChange={() => toggleIngreso(i.id!)}
                            aria-label={`Seleccionar ${i.producto_nombre}`}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {i.created_at ? format(new Date(i.created_at), "dd/MM/yyyy") : "—"}
                      </TableCell>
                      <TableCell className="font-medium">{i.emprendimiento_nombre ?? "—"}</TableCell>
                      <TableCell>{i.producto_nombre ?? "—"}</TableCell>
                      <TableCell className="font-mono text-sm">{i.producto_codigo ?? "—"}</TableCell>
                      <TableCell className="text-right">{i.cantidad}</TableCell>
                      <TableCell className="text-right">
                        {i.costo_unitario != null ? i.costo_unitario.toLocaleString("es") : "—"}
                      </TableCell>
                      <TableCell><EstadoBadge estado={i.estado ?? "pendiente"} /></TableCell>
                      <TableCell className="text-right space-x-1">
                        {i.estado === "pendiente" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-green-600"
                              onClick={() => abrirAprobar("ingreso", i.id!, true)}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => abrirRechazo("ingreso", i.id!)}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      )}

      {/* ── Modal aprobar individual ── */}
      <Dialog open={aprobarOpen} onOpenChange={setAprobarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprobar {aprobarTarget?.tipo === "producto" ? "producto" : "carga de inventario"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {(aprobarTarget?.tieneCantidad || aprobarTarget?.tipo === "ingreso") ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Selecciona el almacén y localización donde se registrará el ingreso de inventario. Ambos son obligatorios.
                </p>
                <div className="space-y-1">
                  <Label>Almacén destino <span className="text-red-500">*</span></Label>
                  <Select value={almacenSeleccionado} onValueChange={setAlmacenSeleccionado}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar almacén" />
                    </SelectTrigger>
                    <SelectContent>
                      {almacenes.map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>{a.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Localización <span className="text-red-500">*</span></Label>
                  <Select
                    value={localizacionSeleccionada}
                    onValueChange={setLocalizacionSeleccionada}
                    disabled={!almacenSeleccionado}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={almacenSeleccionado ? (localizaciones.length === 0 ? "Sin localizaciones disponibles" : "Seleccionar localización") : "Primero seleccione un almacén"} />
                    </SelectTrigger>
                    <SelectContent>
                      {localizaciones.map((l) => (
                        <SelectItem key={l.id} value={String(l.id)}>{l.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Este producto no tiene cantidad inicial. Se creará en el catálogo con stock 0.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAprobarOpen(false)}>Cancelar</Button>
            <Button onClick={confirmarAprobar} className="bg-green-600 hover:bg-green-700">Aprobar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal aprobación masiva ── */}
      <Dialog open={masivoOpen} onOpenChange={(v) => { if (!aprobando) setMasivoOpen(v) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Aprobar {masivoTipo === "producto" ? `${selProductos.size} productos` : `${selIngresos.size} cargas de inventario`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {masivoTipo === "producto"
                ? "Los productos seleccionados se aprobarán. El stock se registrará en el almacén y localización indicados."
                : "Las cargas seleccionadas se registrarán en el almacén y localización indicados."}
            </p>
            <div className="space-y-1">
              <Label>Almacén destino <span className="text-red-500">*</span></Label>
              <Select value={masivoAlmacen} onValueChange={setMasivoAlmacen}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar almacén" />
                </SelectTrigger>
                <SelectContent>
                  {almacenes.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Localización <span className="text-red-500">*</span></Label>
              <Select
                value={masivoLocalizacion}
                onValueChange={setMasivoLocalizacion}
                disabled={!masivoAlmacen}
              >
                <SelectTrigger>
                  <SelectValue placeholder={masivoAlmacen ? (masivoLocalizaciones.length === 0 ? "Sin localizaciones disponibles" : "Seleccionar localización") : "Primero seleccione un almacén"} />
                </SelectTrigger>
                <SelectContent>
                  {masivoLocalizaciones.map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>{l.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMasivoOpen(false)} disabled={aprobando}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarMasivo}
              className="bg-green-600 hover:bg-green-700"
              disabled={aprobando}
            >
              {aprobando ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Aprobando...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirmar aprobación
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal rechazo ── */}
      <Dialog open={rechazoOpen} onOpenChange={setRechazoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Motivo del rechazo *</Label>
            <Input
              value={rechazoMotivo}
              onChange={(e) => setRechazoMotivo(e.target.value)}
              placeholder="Ej: Código de barras duplicado"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRechazoOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmarRechazo}>Rechazar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
