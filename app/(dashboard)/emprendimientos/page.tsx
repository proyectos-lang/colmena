"use client"

import * as React from "react"
import { useAuth } from "@/lib/contexts/auth-context"
import {
  getEmprendimientos,
  saveEmprendimiento,
  deleteEmprendimiento,
  type Emprendimiento,
} from "@/lib/services/emprendimientos"
import {
  getUsuariosByEmprendimiento,
  createEmprendedorUsuario,
  changePassword,
  toggleEmprendedorUsuarioActivo,
  deleteEmprendedorUsuario,
  type EmprendedorUsuario,
} from "@/lib/services/emprendedores-auth"
import {
  getPagosAlquilerByEmprendimiento,
  registrarPagoAlquiler,
  revertirPagoAlquiler,
  generarRegistrosMensuales,
  type PagoAlquiler,
} from "@/lib/services/pagos-alquiler"

const MESES_NOMBRES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]
function nombreMes(mes: number): string {
  return MESES_NOMBRES[mes - 1] ?? String(mes)
}
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  KeyRound,
  UserPlus,
  Link2,
  Copy,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  RotateCcw,
  Sparkles,
} from "lucide-react"

const EMPTY_EMP: Emprendimiento = {
  nombre: "",
  descripcion: "",
  email_contacto: "",
  telefono: "",
  zona: "",
  valor_alquiler_mensual: 0,
  activo: true,
}

const AÑO_ACTUAL = new Date().getFullYear()
const MES_ACTUAL = new Date().getMonth() + 1

function formatLps(n: number) {
  return `L ${n.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function EmprendimientosPage() {
  const { user } = useAuth()
  const [emprendimientos, setEmprendimientos] = React.useState<Emprendimiento[]>([])
  const [loading, setLoading] = React.useState(true)

  // ── Modal crear/editar emprendimiento ───────────────────────
  const [modalOpen, setModalOpen] = React.useState(false)
  const [editando, setEditando] = React.useState<Emprendimiento>(EMPTY_EMP)
  const [isNew, setIsNew] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  // ── Panel de usuarios ───────────────────────────────────────
  const [usuariosModalOpen, setUsuariosModalOpen] = React.useState(false)
  const [empSeleccionado, setEmpSeleccionado] = React.useState<Emprendimiento | null>(null)
  const [usuarios, setUsuarios] = React.useState<EmprendedorUsuario[]>([])
  const [usuariosLoading, setUsuariosLoading] = React.useState(false)
  const [nuevoUsuarioOpen, setNuevoUsuarioOpen] = React.useState(false)
  const [nuevoUsuario, setNuevoUsuario] = React.useState({ nombre: "", usuario: "", password: "" })
  const [savingUsuario, setSavingUsuario] = React.useState(false)
  const [cambiarPassOpen, setCambiarPassOpen] = React.useState(false)
  const [usuarioParaPass, setUsuarioParaPass] = React.useState<EmprendedorUsuario | null>(null)
  const [nuevaPass, setNuevaPass] = React.useState("")

  // ── Panel de pagos de alquiler ──────────────────────────────
  const [pagosSheetOpen, setPagosSheetOpen] = React.useState(false)
  const [empPagos, setEmpPagos] = React.useState<Emprendimiento | null>(null)
  const [anoPagos, setAnoPagos] = React.useState(AÑO_ACTUAL)
  const [pagos, setPagos] = React.useState<PagoAlquiler[]>([])
  const [pagosLoading, setPagosLoading] = React.useState(false)
  const [generando, setGenerando] = React.useState(false)

  const [pagoModalOpen, setPagoModalOpen] = React.useState(false)
  const [pagoEditar, setPagoEditar] = React.useState<PagoAlquiler | null>(null)
  const [pagoForm, setPagoForm] = React.useState({ monto: "", fecha: "", notas: "" })
  const [savingPago, setSavingPago] = React.useState(false)

  const razonSocialId = user?.razon_social_id ?? 0

  // ── Carga principal ─────────────────────────────────────────
  const cargarEmprendimientos = React.useCallback(async () => {
    if (!razonSocialId) return
    setLoading(true)
    const data = await getEmprendimientos(razonSocialId)
    setEmprendimientos(data)
    setLoading(false)
  }, [razonSocialId])

  React.useEffect(() => { cargarEmprendimientos() }, [cargarEmprendimientos])

  // ── Emprendimiento CRUD ─────────────────────────────────────
  const abrirNuevo = () => { setEditando(EMPTY_EMP); setIsNew(true); setModalOpen(true) }
  const abrirEditar = (emp: Emprendimiento) => { setEditando({ ...emp }); setIsNew(false); setModalOpen(true) }

  const guardar = async () => {
    if (!editando.nombre.trim()) { toast.error("El nombre es requerido"); return }
    setSaving(true)
    const { error } = await saveEmprendimiento(editando, isNew, razonSocialId, user?.nombre ?? "admin")
    setSaving(false)
    if (error) { toast.error(`Error: ${error}`); return }
    toast.success(isNew ? "Emprendimiento creado" : "Emprendimiento actualizado")
    setModalOpen(false)
    cargarEmprendimientos()
  }

  const eliminar = async (emp: Emprendimiento) => {
    if (!confirm(`¿Eliminar "${emp.nombre}"? Esta acción no se puede deshacer.`)) return
    const { error } = await deleteEmprendimiento(emp.id!)
    if (error) { toast.error(`Error: ${error}`); return }
    toast.success("Emprendimiento eliminado")
    cargarEmprendimientos()
  }

  // ── Usuarios ────────────────────────────────────────────────
  const abrirUsuarios = async (emp: Emprendimiento) => {
    setEmpSeleccionado(emp)
    setUsuariosModalOpen(true)
    setUsuariosLoading(true)
    const data = await getUsuariosByEmprendimiento(emp.id!)
    setUsuarios(data)
    setUsuariosLoading(false)
  }

  const crearUsuario = async () => {
    if (!nuevoUsuario.nombre.trim() || !nuevoUsuario.usuario.trim() || !nuevoUsuario.password.trim()) {
      toast.error("Todos los campos son requeridos"); return
    }
    setSavingUsuario(true)
    const { error } = await createEmprendedorUsuario(empSeleccionado!.id!, nuevoUsuario.nombre, nuevoUsuario.usuario, nuevoUsuario.password)
    setSavingUsuario(false)
    if (error) { toast.error(`Error: ${error}`); return }
    toast.success("Usuario creado")
    setNuevoUsuarioOpen(false)
    setNuevoUsuario({ nombre: "", usuario: "", password: "" })
    setUsuarios(await getUsuariosByEmprendimiento(empSeleccionado!.id!))
  }

  const toggleActivo = async (u: EmprendedorUsuario) => {
    await toggleEmprendedorUsuarioActivo(u.id, !u.activo)
    setUsuarios(await getUsuariosByEmprendimiento(empSeleccionado!.id!))
  }

  const confirmarCambioPass = async () => {
    if (!nuevaPass.trim()) { toast.error("La contraseña no puede estar vacía"); return }
    const { error } = await changePassword(usuarioParaPass!.id, nuevaPass)
    if (error) { toast.error(`Error: ${error}`); return }
    toast.success("Contraseña actualizada")
    setCambiarPassOpen(false)
    setNuevaPass("")
  }

  const eliminarUsuario = async (u: EmprendedorUsuario) => {
    if (!confirm(`¿Eliminar usuario "${u.usuario}"?`)) return
    await deleteEmprendedorUsuario(u.id)
    setUsuarios(await getUsuariosByEmprendimiento(empSeleccionado!.id!))
  }

  // ── Pagos de alquiler ───────────────────────────────────────
  const cargarPagos = React.useCallback(async (empId: number, anio: number) => {
    setPagosLoading(true)
    const data = await getPagosAlquilerByEmprendimiento(empId, anio)
    setPagos(data)
    setPagosLoading(false)
  }, [])

  const abrirPagos = async (emp: Emprendimiento) => {
    setEmpPagos(emp)
    setAnoPagos(AÑO_ACTUAL)
    setPagosSheetOpen(true)
    await cargarPagos(emp.id!, AÑO_ACTUAL)
  }

  const cambiarAno = async (delta: number) => {
    const nuevoAno = anoPagos + delta
    setAnoPagos(nuevoAno)
    await cargarPagos(empPagos!.id!, nuevoAno)
  }

  const generarMesActual = async () => {
    setGenerando(true)
    const { insertados, error } = await generarRegistrosMensuales(
      razonSocialId, AÑO_ACTUAL, MES_ACTUAL, user?.nombre ?? "admin"
    )
    setGenerando(false)
    if (error) { toast.error(`Error: ${error}`); return }
    toast.success(insertados > 0 ? `${insertados} registros generados` : "Los registros ya existían")
    await cargarPagos(empPagos!.id!, anoPagos)
  }

  const abrirRegistrarPago = (pago: PagoAlquiler) => {
    setPagoEditar(pago)
    setPagoForm({
      monto: String(pago.monto || empPagos?.valor_alquiler_mensual || ""),
      fecha: new Date().toISOString().split("T")[0],
      notas: "",
    })
    setPagoModalOpen(true)
  }

  const confirmarPago = async () => {
    if (!pagoEditar) return
    const monto = parseFloat(pagoForm.monto)
    if (!pagoForm.fecha || isNaN(monto) || monto <= 0) {
      toast.error("Ingresa monto y fecha válidos"); return
    }
    setSavingPago(true)
    if (pagoEditar.id) {
      const { error } = await registrarPagoAlquiler(pagoEditar.id, monto, pagoForm.fecha, pagoForm.notas, user?.nombre ?? "admin")
      setSavingPago(false)
      if (error) { toast.error(`Error: ${error}`); return }
    } else {
      // Pago no existe aún en DB — necesita generarse primero
      toast.error("Genera los registros del mes primero usando el botón \"Generar mes actual\"")
      setSavingPago(false)
      return
    }
    toast.success("Pago registrado")
    setPagoModalOpen(false)
    await cargarPagos(empPagos!.id!, anoPagos)
  }

  const revertirPago = async (pago: PagoAlquiler) => {
    if (!confirm("¿Revertir este pago a pendiente?")) return
    if (!pago.id) return
    const { error } = await revertirPagoAlquiler(pago.id, user?.nombre ?? "admin")
    if (error) { toast.error(`Error: ${error}`); return }
    toast.success("Pago revertido a pendiente")
    await cargarPagos(empPagos!.id!, anoPagos)
  }

  // Construir la grilla de 12 meses con datos reales o vacíos
  const mesesGrid = React.useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1
      const pago = pagos.find((p) => p.mes === mes) ?? null
      return { mes, nombre: nombreMes(mes), pago }
    })
  }, [pagos])

  const totalPagado = pagos.filter((p) => p.estado === "pagado").reduce((acc, p) => acc + p.monto, 0)
  const totalEsperado = 12 * (empPagos?.valor_alquiler_mensual ?? 0)

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Emprendimientos</h1>
          <p className="text-muted-foreground text-sm">Gestiona los emprendedores y sus accesos al portal</p>
        </div>
        <Button onClick={abrirNuevo}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo Emprendimiento
        </Button>
      </div>

      {/* Link de acceso al portal */}
      <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
        <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">Link de acceso para emprendedores</p>
          <p className="text-sm font-mono truncate">
            {typeof window !== "undefined" ? `${window.location.origin}/login-emprendedor` : "/login-emprendedor"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => {
            const url = `${window.location.origin}/login-emprendedor`
            navigator.clipboard.writeText(url).then(() => toast.success("Link copiado al portapapeles"))
          }}
        >
          <Copy className="h-4 w-4 mr-2" />
          Copiar link
        </Button>
      </div>

      {/* Tabla de emprendimientos */}
      {loading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Zona</TableHead>
              <TableHead>Alquiler mensual</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {emprendimientos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No hay emprendimientos registrados
                </TableCell>
              </TableRow>
            ) : (
              emprendimientos.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell className="font-medium">{emp.nombre}</TableCell>
                  <TableCell>{emp.zona ?? "—"}</TableCell>
                  <TableCell>{emp.valor_alquiler_mensual ? formatLps(emp.valor_alquiler_mensual) : "—"}</TableCell>
                  <TableCell>{emp.email_contacto ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={emp.activo ? "default" : "secondary"}>
                      {emp.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" title="Pagos de alquiler" onClick={() => abrirPagos(emp)}>
                      <CreditCard className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Usuarios" onClick={() => abrirUsuarios(emp)}>
                      <Users className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Editar" onClick={() => abrirEditar(emp)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Eliminar" onClick={() => eliminar(emp)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {/* ── Modal crear/editar emprendimiento ── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isNew ? "Nuevo Emprendimiento" : "Editar Emprendimiento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre *</Label>
              <Input value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} />
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea value={editando.descripcion ?? ""} onChange={(e) => setEditando({ ...editando, descripcion: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Zona de la tienda</Label>
                <Input
                  placeholder="Ej. Vitrina A, Estante 3"
                  value={editando.zona ?? ""}
                  onChange={(e) => setEditando({ ...editando, zona: e.target.value })}
                />
              </div>
              <div>
                <Label>Alquiler mensual (L)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editando.valor_alquiler_mensual ?? ""}
                  onChange={(e) => setEditando({ ...editando, valor_alquiler_mensual: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email de contacto</Label>
                <Input value={editando.email_contacto ?? ""} onChange={(e) => setEditando({ ...editando, email_contacto: e.target.value })} />
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input value={editando.telefono ?? ""} onChange={(e) => setEditando({ ...editando, telefono: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={editando.activo ?? true} onCheckedChange={(v) => setEditando({ ...editando, activo: v })} />
              <Label>Activo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={guardar} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Sheet: pagos de alquiler ── */}
      <Sheet open={pagosSheetOpen} onOpenChange={setPagosSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Pagos de Alquiler — {empPagos?.nombre}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            {/* Año + resumen */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => cambiarAno(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-lg font-semibold w-16 text-center">{anoPagos}</span>
                <Button variant="outline" size="icon" onClick={() => cambiarAno(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={generarMesActual} disabled={generando}>
                <Sparkles className="h-4 w-4 mr-2" />
                {generando ? "Generando..." : "Generar mes actual"}
              </Button>
            </div>

            {/* KPIs del año */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Pagado {anoPagos}</p>
                <p className="text-lg font-bold text-green-600">{formatLps(totalPagado)}</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Esperado {anoPagos}</p>
                <p className="text-lg font-bold">{formatLps(totalEsperado)}</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Pendientes</p>
                <p className="text-lg font-bold text-amber-600">
                  {pagos.filter((p) => p.estado === "pendiente").length}
                </p>
              </div>
            </div>

            {/* Grilla de 12 meses */}
            {pagosLoading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Cargando pagos...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mes</TableHead>
                    <TableHead>Monto esperado</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha pago</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mesesGrid.map(({ mes, nombre, pago }) => (
                    <TableRow key={mes} className={mes === MES_ACTUAL && anoPagos === AÑO_ACTUAL ? "bg-amber-50/50" : ""}>
                      <TableCell className="font-medium">
                        {nombre}
                        {mes === MES_ACTUAL && anoPagos === AÑO_ACTUAL && (
                          <span className="ml-2 text-xs text-amber-600">(actual)</span>
                        )}
                      </TableCell>
                      <TableCell>{formatLps(empPagos?.valor_alquiler_mensual ?? 0)}</TableCell>
                      <TableCell>
                        {pago ? (
                          <Badge variant={pago.estado === "pagado" ? "default" : "secondary"} className={pago.estado === "pagado" ? "bg-green-100 text-green-700 border-green-200" : ""}>
                            {pago.estado === "pagado" ? "Pagado" : "Pendiente"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Sin registro</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {pago?.fecha_pago ? new Date(pago.fecha_pago + "T12:00:00").toLocaleDateString("es-HN") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {!pago || pago.estado === "pendiente" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-700 border-green-300 hover:bg-green-50"
                            onClick={() => abrirRegistrarPago(pago ?? { emprendimiento_id: empPagos!.id!, anio: anoPagos, mes, monto: empPagos?.valor_alquiler_mensual ?? 0, estado: "pendiente" })}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Registrar
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => revertirPago(pago)}>
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Revertir
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Modal registrar pago */}
      <Dialog open={pagoModalOpen} onOpenChange={setPagoModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Registrar pago — {pagoEditar ? nombreMes(pagoEditar.mes) : ""} {anoPagos}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Monto pagado (L) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={pagoForm.monto}
                onChange={(e) => setPagoForm({ ...pagoForm, monto: e.target.value })}
              />
            </div>
            <div>
              <Label>Fecha de pago *</Label>
              <Input
                type="date"
                value={pagoForm.fecha}
                onChange={(e) => setPagoForm({ ...pagoForm, fecha: e.target.value })}
              />
            </div>
            <div>
              <Label>Notas (opcional)</Label>
              <Textarea
                value={pagoForm.notas}
                onChange={(e) => setPagoForm({ ...pagoForm, notas: e.target.value })}
                rows={2}
                placeholder="Referencia de transferencia, observaciones..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPagoModalOpen(false)}>Cancelar</Button>
            <Button onClick={confirmarPago} disabled={savingPago} className="bg-green-600 hover:bg-green-700">
              {savingPago ? "Registrando..." : "Confirmar pago"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal usuarios del emprendimiento ── */}
      <Dialog open={usuariosModalOpen} onOpenChange={setUsuariosModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Usuarios — {empSeleccionado?.nombre}</DialogTitle>
          </DialogHeader>
          {usuariosLoading ? (
            <p className="text-muted-foreground text-sm">Cargando usuarios...</p>
          ) : (
            <div className="space-y-4">
              <Button size="sm" onClick={() => setNuevoUsuarioOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" /> Crear usuario
              </Button>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Activo</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuarios.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-4">Sin usuarios</TableCell>
                    </TableRow>
                  ) : (
                    usuarios.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>{u.nombre}</TableCell>
                        <TableCell className="font-mono text-sm">{u.usuario}</TableCell>
                        <TableCell>
                          <Switch checked={u.activo} onCheckedChange={() => toggleActivo(u)} />
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="icon" onClick={() => { setUsuarioParaPass(u); setNuevaPass(""); setCambiarPassOpen(true) }}>
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => eliminarUsuario(u)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal crear usuario */}
      <Dialog open={nuevoUsuarioOpen} onOpenChange={setNuevoUsuarioOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear usuario emprendedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre completo *</Label>
              <Input value={nuevoUsuario.nombre} onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, nombre: e.target.value })} />
            </div>
            <div>
              <Label>Nombre de usuario *</Label>
              <Input value={nuevoUsuario.usuario} onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, usuario: e.target.value })} />
            </div>
            <div>
              <Label>Contraseña *</Label>
              <Input type="password" value={nuevoUsuario.password} onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, password: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNuevoUsuarioOpen(false)}>Cancelar</Button>
            <Button onClick={crearUsuario} disabled={savingUsuario}>{savingUsuario ? "Creando..." : "Crear usuario"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal cambiar contraseña */}
      <Dialog open={cambiarPassOpen} onOpenChange={setCambiarPassOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar contraseña — {usuarioParaPass?.usuario}</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Nueva contraseña *</Label>
            <Input type="password" value={nuevaPass} onChange={(e) => setNuevaPass(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCambiarPassOpen(false)}>Cancelar</Button>
            <Button onClick={confirmarCambioPass}>Guardar contraseña</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
