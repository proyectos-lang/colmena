"use client"

import { useState, useEffect } from "react"
import { Plus, Landmark, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import {
  CuentaConfig,
  getCuentas,
  saveCuenta,
  deleteCuenta,
  CUENTAS_FEATURE_PENDING,
} from "@/lib/services/cuentas"
import { useTenant } from "@/lib/hooks/use-tenant"

const TIPOS: ReadonlyArray<CuentaConfig["tipo"]> = ["Banco", "Link_Pago", "Otro"]

function formatCurrency(n: number | undefined | null): string {
  const v = Number(n ?? 0)
  return `L ${v.toLocaleString("en-HN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export default function CuentasBancariasPage() {
  const { toast } = useToast()
  const { ready, razonSocialId } = useTenant()

  const [cuentas, setCuentas] = useState<CuentaConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [featurePending, setFeaturePending] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CuentaConfig | null>(null)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState<Partial<CuentaConfig>>({
    nombre: "",
    tipo: "Banco",
    porcentaje_comision: 0,
    activo: true,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!ready) return
    if (razonSocialId == null) {
      setCuentas([])
      setLoading(false)
      return
    }
    loadCuentas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, razonSocialId])

  async function loadCuentas() {
    setLoading(true)
    const { data, error } = await getCuentas()
    if (error === CUENTAS_FEATURE_PENDING) {
      setFeaturePending(true)
      setCuentas([])
    } else if (error) {
      toast({
        title: "No se pudieron cargar las cuentas",
        description: error,
        variant: "destructive",
      })
    } else {
      setFeaturePending(false)
      setCuentas(data)
    }
    setLoading(false)
  }

  function openNewDialog() {
    setErrors({})
    setEditing(null)
    setFormData({
      nombre: "",
      tipo: "Banco",
      porcentaje_comision: 0,
      activo: true,
    })
    setDialogOpen(true)
  }

  function openEditDialog(c: CuentaConfig) {
    setErrors({})
    setEditing(c)
    setFormData({
      nombre: c.nombre,
      tipo: c.tipo,
      porcentaje_comision: Number(c.porcentaje_comision || 0),
      activo: c.activo ?? true,
    })
    setDialogOpen(true)
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!formData.nombre?.trim()) e.nombre = "El nombre es requerido"
    const com = Number(formData.porcentaje_comision)
    if (Number.isNaN(com) || com < 0 || com > 100) {
      e.porcentaje_comision = "Comision debe estar entre 0 y 100"
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    const payload: CuentaConfig = {
      ...editing,
      nombre: formData.nombre!.trim(),
      tipo: formData.tipo as CuentaConfig["tipo"],
      porcentaje_comision: Number(formData.porcentaje_comision || 0),
      activo: formData.activo ?? true,
    }
    const { error } = await saveCuenta(payload, !editing)
    setSaving(false)
    if (error === CUENTAS_FEATURE_PENDING) {
      setFeaturePending(true)
      toast({
        title: "Migracion pendiente",
        description: "Aplica scripts/011-tesoreria-caja-chica.sql",
        variant: "destructive",
      })
      return
    }
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" })
    } else {
      toast({
        title: "Exito",
        description: `Cuenta ${editing ? "actualizada" : "creada"}`,
      })
      setDialogOpen(false)
      loadCuentas()
    }
  }

  async function toggleActivo(c: CuentaConfig, activo: boolean) {
    // Optimistic update
    setCuentas((prev) =>
      prev.map((x) => (x.id === c.id ? { ...x, activo } : x))
    )
    const { error } = await saveCuenta({ ...c, activo }, false)
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" })
      loadCuentas()
    }
  }

  async function handleDelete(c: CuentaConfig) {
    if (!c.id) return
    if (!confirm(`Eliminar cuenta "${c.nombre}"?`)) return
    const { error } = await deleteCuenta(c.id)
    if (error) {
      toast({ title: "No se pudo eliminar", description: error, variant: "destructive" })
    } else {
      toast({ title: "Exito", description: "Cuenta eliminada" })
      loadCuentas()
    }
  }

  const tipoBadgeClass = (tipo: CuentaConfig["tipo"]) =>
    tipo === "Banco"
      ? "bg-primary/10 text-primary border-primary/20"
      : tipo === "Link_Pago"
      ? "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200"
      : "bg-muted text-muted-foreground border-border"

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Cuentas Bancarias
          </h1>
          <p className="text-sm text-muted-foreground">
            Bancos, links de pago y % de comision asociada.
          </p>
        </div>
        <Button onClick={openNewDialog} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Nueva Cuenta
        </Button>
      </div>

      {featurePending && (
        <Alert>
          <AlertTitle>Migracion pendiente</AlertTitle>
          <AlertDescription>
            Aplica el script{" "}
            <code className="font-mono text-xs">
              scripts/011-tesoreria-caja-chica.sql
            </code>{" "}
            para activar este modulo.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5" />
            Cuentas Configuradas
          </CardTitle>
          <CardDescription>
            La comision se aplica automaticamente al registrar pagos en Nueva Venta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : cuentas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No hay cuentas configuradas. Crea la primera con el boton arriba.
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="block md:hidden space-y-3">
                {cuentas.map((c) => (
                  <div
                    key={c.id}
                    className="border rounded-lg p-3 bg-card"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium truncate">{c.nombre}</p>
                          <Badge
                            variant="outline"
                            className={tipoBadgeClass(c.tipo)}
                          >
                            {c.tipo}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Comision: {Number(c.porcentaje_comision || 0).toFixed(2)}%
                        </p>
                        <p className="text-sm font-mono mt-1">
                          Saldo: {formatCurrency(c.saldo)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Switch
                          checked={c.activo ?? true}
                          onCheckedChange={(v) => toggleActivo(c, v)}
                          aria-label="Activar/desactivar"
                        />
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(c)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-destructive/10"
                            onClick={() => handleDelete(c)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Comision</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-center">Activa</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cuentas.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.nombre}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={tipoBadgeClass(c.tipo)}
                        >
                          {c.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {Number(c.porcentaje_comision || 0).toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(c.saldo)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={c.activo ?? true}
                          onCheckedChange={(v) => toggleActivo(c, v)}
                          aria-label="Activar/desactivar"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(c)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-destructive/10"
                            onClick={() => handleDelete(c)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog: crear / editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar Cuenta" : "Nueva Cuenta"}
            </DialogTitle>
            <DialogDescription>
              Registra un banco, link de pago u otra cuenta para conciliar pagos.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="cb-nombre">Nombre</Label>
              <Input
                id="cb-nombre"
                placeholder="BAC, Banpais, Tigo Money..."
                value={formData.nombre || ""}
                onChange={(e) =>
                  setFormData({ ...formData, nombre: e.target.value })
                }
              />
              {errors.nombre && (
                <p className="text-xs text-destructive">{errors.nombre}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="cb-tipo">Tipo</Label>
                <Select
                  value={formData.tipo as string}
                  onValueChange={(v) =>
                    setFormData({ ...formData, tipo: v as CuentaConfig["tipo"] })
                  }
                >
                  <SelectTrigger id="cb-tipo">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t === "Link_Pago" ? "Link de Pago" : t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="cb-comision">Comision (%)</Label>
                <Input
                  id="cb-comision"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  step={0.01}
                  value={
                    formData.porcentaje_comision == null
                      ? ""
                      : String(formData.porcentaje_comision)
                  }
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      porcentaje_comision:
                        e.target.value === ""
                          ? 0
                          : Number(e.target.value),
                    })
                  }
                />
                {errors.porcentaje_comision && (
                  <p className="text-xs text-destructive">
                    {errors.porcentaje_comision}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <div>
                <Label htmlFor="cb-activo" className="text-sm">
                  Cuenta activa
                </Label>
                <p className="text-xs text-muted-foreground">
                  Solo las activas aparecen en Nueva Venta.
                </p>
              </div>
              <Switch
                id="cb-activo"
                checked={formData.activo ?? true}
                onCheckedChange={(v) => setFormData({ ...formData, activo: v })}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Spinner className="mr-2" /> : null}
              {editing ? "Actualizar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
