"use client"

import { useState, useEffect } from "react"
import { Plus, Users, Pencil, Trash2, Loader2, Cake } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { useToast } from "@/hooks/use-toast"
import {
  Cliente,
  getClientes,
  saveCliente,
  deleteCliente,
} from "@/lib/services/catalogos"
import { useTenant } from "@/lib/hooks/use-tenant"
import { getAlertaCumple } from "@/lib/utils/cumpleanos"

export default function ClientesConfigPage() {
  const { toast } = useToast()
  const { ready, razonSocialId } = useTenant()
  
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null)
  const [saving, setSaving] = useState(false)
  
  const [formData, setFormData] = useState<Partial<Cliente>>({
    nombre: "",
    rtn: "",
    direccion: "",
    telefono: "",
    fecha_nacimiento: "",
  })
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!ready) return
    if (razonSocialId == null) {
      console.log('[v0][Clientes] usuario sin razon_social_id')
      setClientes([])
      setLoading(false)
      return
    }
    loadClientes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, razonSocialId])

  async function loadClientes() {
    setLoading(true)
    try {
      const { data, error } = await getClientes()
      if (error) {
        console.log('[v0][Clientes] error:', error)
        toast({ title: "No se pudieron cargar los datos", description: error, variant: "destructive" })
      } else {
        setClientes(data)
      }
    } catch (err: any) {
      console.log('[v0][Clientes] excepcion:', err)
      toast({ title: "No se pudieron cargar los datos", description: err?.message || "Error de conexion", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  function openNewDialog() {
    setValidationErrors({})
    setEditingCliente(null)
    setFormData({
      nombre: "",
      rtn: "",
      direccion: "",
      telefono: "",
      fecha_nacimiento: "",
    })
    setDialogOpen(true)
  }

  function openEditDialog(cliente: Cliente) {
    setValidationErrors({})
    setEditingCliente(cliente)
    setFormData({ ...cliente })
    setDialogOpen(true)
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    
    if (!formData.nombre?.trim()) {
      errors.nombre = "El nombre es requerido"
    }
    // RTN is optional per schema
    
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSave() {
    if (!validateForm()) {
      toast({ title: "Error de validacion", description: "Complete todos los campos requeridos", variant: "destructive" })
      return
    }

    setSaving(true)

    const clienteData: Cliente = {
      ...editingCliente,
      nombre: formData.nombre!,
      rtn: formData.rtn || undefined,
      direccion: formData.direccion || undefined,
      telefono: formData.telefono || undefined,
      // fecha_nacimiento: cadena vacia -> undefined para no enviar "" a una
      // columna DATE (Postgres lanzaria error de tipo).
      fecha_nacimiento: formData.fecha_nacimiento || undefined,
    }

    const { error } = await saveCliente(clienteData, !editingCliente)
    setSaving(false)

    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" })
    } else {
      toast({ title: "Exito", description: `Cliente ${editingCliente ? "actualizado" : "creado"} correctamente` })
      setDialogOpen(false)
      loadClientes()
    }
  }

  async function handleDelete(cliente: Cliente) {
    if (!cliente.id) return
    
    if (!confirm(`Eliminar cliente "${cliente.nombre}"?`)) {
      return
    }

    const { error } = await deleteCliente(cliente.id)
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" })
    } else {
      toast({ title: "Exito", description: "Cliente eliminado" })
      loadClientes()
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Configuracion de Clientes</h1>
          <p className="text-sm md:text-base text-muted-foreground">Gestiona el catalogo de clientes</p>
        </div>
        <Button onClick={openNewDialog} size="sm" className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-1" />
          Nuevo Cliente
        </Button>
      </div>

      <Card>
        <CardHeader className="p-4 md:p-6 pb-3 md:pb-4">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Users className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            Clientes
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">Lista de clientes registrados</CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : clientes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm md:text-base">No hay clientes registrados</p>
              <p className="text-xs md:text-sm">Crea tu primer cliente</p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block md:hidden space-y-3">
                {clientes.map((cliente) => {
                  const alerta = getAlertaCumple(cliente.fecha_nacimiento)
                  return (
                    <div key={cliente.id} className="border rounded-lg p-3 bg-card">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{cliente.nombre}</p>
                            {alerta.estado !== "none" && (
                              <BirthdayBadge alerta={alerta} compact />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">{cliente.rtn || "Sin RTN"}</p>
                          <p className="text-xs text-muted-foreground truncate mt-1">{cliente.direccion || "Sin direccion"}</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                            {cliente.telefono && <span>Tel: {cliente.telefono}</span>}
                            {cliente.fecha_nacimiento && (
                              <span>Nac: {formatBirthDate(cliente.fecha_nacimiento)}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(cliente)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10" onClick={() => handleDelete(cliente)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Desktop Table View */}
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>RTN</TableHead>
                    <TableHead>Telefono</TableHead>
                    <TableHead>Fecha Nacimiento</TableHead>
                    <TableHead>Direccion</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientes.map((cliente) => {
                    const alerta = getAlertaCumple(cliente.fecha_nacimiento)
                    return (
                      <TableRow key={cliente.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <span>{cliente.nombre}</span>
                            {alerta.estado !== "none" && (
                              <BirthdayBadge alerta={alerta} />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{cliente.rtn || "-"}</TableCell>
                        <TableCell>{cliente.telefono || "-"}</TableCell>
                        <TableCell>
                          {cliente.fecha_nacimiento
                            ? formatBirthDate(cliente.fecha_nacimiento)
                            : "-"}
                        </TableCell>
                        <TableCell>{cliente.direccion || "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEditDialog(cliente)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-destructive/10"
                              onClick={() => handleDelete(cliente)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {/* Cliente Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCliente ? "Editar Cliente" : "Nuevo Cliente"}</DialogTitle>
            <DialogDescription>
              Complete los datos del cliente. Los campos marcados con * son requeridos.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
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
                placeholder="Nombre del cliente"
              />
              {validationErrors.nombre && (
                <p className="text-sm text-destructive">{validationErrors.nombre}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="rtn">RTN</Label>
              <Input
                id="rtn"
                value={formData.rtn || ""}
                onChange={(e) => setFormData({ ...formData, rtn: e.target.value })}
                placeholder="0801-1234-56789"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="direccion">Direccion</Label>
              <Input
                id="direccion"
                value={formData.direccion || ""}
                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                placeholder="Direccion fisica"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="telefono">Telefono</Label>
                <Input
                  id="telefono"
                  type="tel"
                  inputMode="tel"
                  value={formData.telefono || ""}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  placeholder="9999-9999"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="fecha-nacimiento">
                  Fecha de Nacimiento
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    (opcional)
                  </span>
                </Label>
                <Input
                  id="fecha-nacimiento"
                  type="date"
                  value={formData.fecha_nacimiento || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, fecha_nacimiento: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Spinner className="mr-2 h-4 w-4" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  )
}

/**
 * Formatea 'YYYY-MM-DD' a 'DD/MM/YYYY' sin sufrir shifts por timezone
 * (no usamos `new Date(...)` que interpreta UTC).
 */
function formatBirthDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${m[3]}/${m[2]}/${m[1]}`
}

/**
 * Badge visual de cumpleanos. Hoy = rosa fuerte; proximos 1..5 dias = ambar.
 * Envuelto en Tooltip para mostrar el mensaje completo al hover.
 */
function BirthdayBadge({
  alerta,
  compact = false,
}: {
  alerta: ReturnType<typeof getAlertaCumple>
  compact?: boolean
}) {
  const isToday = alerta.estado === "today"
  const colorClasses = isToday
    ? "bg-pink-100 text-pink-700 hover:bg-pink-100 border-pink-200"
    : "bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200"
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={`${colorClasses} gap-1 px-1.5 py-0 h-5 cursor-default`}
          aria-label={alerta.mensaje}
        >
          <Cake className="h-3 w-3" aria-hidden="true" />
          {!compact && (
            <span className="text-[10px] font-semibold leading-none">
              {isToday ? "Hoy" : `${alerta.dias}d`}
            </span>
          )}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top">
        <span>
          {isToday ? "Cumpleanos hoy" : `Cumpleanos en ${alerta.dias} ${alerta.dias === 1 ? "dia" : "dias"}`}
        </span>
      </TooltipContent>
    </Tooltip>
  )
}
