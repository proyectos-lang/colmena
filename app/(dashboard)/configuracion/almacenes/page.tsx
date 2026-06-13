"use client"

import { useState, useEffect } from "react"
import { Plus, Warehouse, MapPin, Pencil, Trash2, Loader2 } from "lucide-react"
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
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import {
  Almacen,
  Localizacion,
  getAlmacenes,
  saveAlmacen,
  deleteAlmacen,
  getLocalizaciones,
  saveLocalizacion,
  deleteLocalizacion,
} from "@/lib/services/catalogos"

export default function AlmacenesConfigPage() {
  const { toast } = useToast()
  
  // State for warehouses
  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [selectedAlmacen, setSelectedAlmacen] = useState<Almacen | null>(null)
  const [loadingAlmacenes, setLoadingAlmacenes] = useState(true)
  
  // State for locations
  const [localizaciones, setLocalizaciones] = useState<Localizacion[]>([])
  const [loadingLocalizaciones, setLoadingLocalizaciones] = useState(false)
  
  // Dialog states
  const [almacenDialogOpen, setAlmacenDialogOpen] = useState(false)
  const [localizacionDialogOpen, setLocalizacionDialogOpen] = useState(false)
  const [editingAlmacen, setEditingAlmacen] = useState<Almacen | null>(null)
  const [editingLocalizacion, setEditingLocalizacion] = useState<Localizacion | null>(null)
  
  // Form states
  const [almacenForm, setAlmacenForm] = useState({ nombre: "", ubicacion: "" })
  const [localizacionForm, setLocalizacionForm] = useState({ nombre: "", descripcion: "" })
  const [saving, setSaving] = useState(false)

  // Load warehouses on mount
  useEffect(() => {
    loadAlmacenes()
  }, [])

  // Load locations when selected warehouse changes
  useEffect(() => {
    if (selectedAlmacen?.id) {
      loadLocalizaciones(selectedAlmacen.id)
    } else {
      setLocalizaciones([])
    }
  }, [selectedAlmacen?.id])

  async function loadAlmacenes() {
    setLoadingAlmacenes(true)
    const { data, error } = await getAlmacenes()
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" })
    } else {
      setAlmacenes(data)
      // Auto-select first warehouse if available
      if (data.length > 0 && !selectedAlmacen) {
        setSelectedAlmacen(data[0])
      }
    }
    setLoadingAlmacenes(false)
  }

  async function loadLocalizaciones(almacenId: number) {
    setLoadingLocalizaciones(true)
    const { data, error } = await getLocalizaciones(almacenId)
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" })
    } else {
      setLocalizaciones(data)
    }
    setLoadingLocalizaciones(false)
  }

  // Warehouse handlers
  function openNewAlmacenDialog() {
    setEditingAlmacen(null)
    setAlmacenForm({ nombre: "", ubicacion: "" })
    setAlmacenDialogOpen(true)
  }

  function openEditAlmacenDialog(almacen: Almacen) {
    setEditingAlmacen(almacen)
    setAlmacenForm({ nombre: almacen.nombre, ubicacion: almacen.ubicacion })
    setAlmacenDialogOpen(true)
  }

  async function handleSaveAlmacen() {
    if (!almacenForm.nombre.trim()) {
      toast({ title: "Error", description: "El nombre es requerido", variant: "destructive" })
      return
    }

    setSaving(true)
    const almacenData: Almacen = {
      ...(editingAlmacen && { id: editingAlmacen.id }),
      nombre: almacenForm.nombre.trim(),
      ubicacion: almacenForm.ubicacion.trim(),
    }

    const { data, error } = await saveAlmacen(almacenData, !editingAlmacen)
    setSaving(false)

    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" })
    } else {
      toast({ title: "Exito", description: editingAlmacen ? "Almacen actualizado" : "Almacen creado" })
      setAlmacenDialogOpen(false)
      await loadAlmacenes()
      if (data) {
        setSelectedAlmacen(data)
      }
    }
  }

  async function handleDeleteAlmacen(almacen: Almacen) {
    if (!almacen.id) return
    
    if (!confirm(`Eliminar almacen "${almacen.nombre}"? Esto tambien eliminara todas sus localizaciones.`)) {
      return
    }

    const { success, error } = await deleteAlmacen(almacen.id)
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" })
    } else if (success) {
      toast({ title: "Exito", description: "Almacen eliminado" })
      if (selectedAlmacen?.id === almacen.id) {
        setSelectedAlmacen(null)
      }
      await loadAlmacenes()
    }
  }

  // Location handlers
  function openNewLocalizacionDialog() {
    if (!selectedAlmacen?.id) return
    setEditingLocalizacion(null)
    setLocalizacionForm({ nombre: "", descripcion: "" })
    setLocalizacionDialogOpen(true)
  }

  function openEditLocalizacionDialog(localizacion: Localizacion) {
    setEditingLocalizacion(localizacion)
    setLocalizacionForm({ 
      nombre: localizacion.nombre, 
      descripcion: localizacion.descripcion || "" 
    })
    setLocalizacionDialogOpen(true)
  }

  async function handleSaveLocalizacion() {
    if (!localizacionForm.nombre.trim() || !selectedAlmacen?.id) {
      toast({ title: "Error", description: "El nombre es requerido", variant: "destructive" })
      return
    }

    setSaving(true)
    const localizacionData: Localizacion = {
      ...(editingLocalizacion && { id: editingLocalizacion.id }),
      almacen_id: selectedAlmacen.id,
      nombre: localizacionForm.nombre.trim(),
      descripcion: localizacionForm.descripcion.trim() || undefined,
    }

    const { error } = await saveLocalizacion(localizacionData, !editingLocalizacion)
    setSaving(false)

    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" })
    } else {
      toast({ title: "Exito", description: editingLocalizacion ? "Localizacion actualizada" : "Localizacion creada" })
      setLocalizacionDialogOpen(false)
      await loadLocalizaciones(selectedAlmacen.id)
    }
  }

  async function handleDeleteLocalizacion(localizacion: Localizacion) {
    if (!localizacion.id || !selectedAlmacen?.id) return
    
    if (!confirm(`Eliminar localizacion "${localizacion.nombre}"?`)) {
      return
    }

    const { success, error } = await deleteLocalizacion(localizacion.id)
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" })
    } else if (success) {
      toast({ title: "Exito", description: "Localizacion eliminada" })
      await loadLocalizaciones(selectedAlmacen.id)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Configuracion de Almacenes</h1>
        <p className="text-muted-foreground">Gestiona tus almacenes y sus localizaciones internas</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Warehouses Panel */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Warehouse className="h-5 w-5 text-primary" />
                Almacenes
              </CardTitle>
              <CardDescription>Lista de almacenes registrados</CardDescription>
            </div>
            <Button onClick={openNewAlmacenDialog} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Nuevo
            </Button>
          </CardHeader>
          <CardContent>
            {loadingAlmacenes ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : almacenes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Warehouse className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No hay almacenes registrados</p>
                <p className="text-sm">Crea tu primer almacen</p>
              </div>
            ) : (
              <div className="space-y-2">
                {almacenes.map((almacen) => (
                  <div
                    key={almacen.id}
                    onClick={() => setSelectedAlmacen(almacen)}
                    className={`
                      group flex items-center justify-between p-3 rounded-lg cursor-pointer
                      transition-colors duration-150
                      ${selectedAlmacen?.id === almacen.id 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted/50 hover:bg-muted"
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <Warehouse className={`h-5 w-5 ${selectedAlmacen?.id === almacen.id ? "" : "text-muted-foreground"}`} />
                      <div>
                        <p className="font-medium">{almacen.nombre}</p>
                        <p className={`text-sm ${selectedAlmacen?.id === almacen.id ? "opacity-80" : "text-muted-foreground"}`}>
                          {almacen.ubicacion || "Sin ubicacion"}
                        </p>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1 ${selectedAlmacen?.id === almacen.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 ${selectedAlmacen?.id === almacen.id ? "hover:bg-primary-foreground/20" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditAlmacenDialog(almacen)
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 ${selectedAlmacen?.id === almacen.id ? "hover:bg-destructive/20" : "hover:bg-destructive/10"}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteAlmacen(almacen)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Locations Panel */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Localizaciones
              </CardTitle>
              <CardDescription>
                {selectedAlmacen 
                  ? `Localizaciones en: ${selectedAlmacen.nombre}`
                  : "Selecciona un almacen para ver sus localizaciones"
                }
              </CardDescription>
            </div>
            <Button 
              onClick={openNewLocalizacionDialog} 
              size="sm"
              disabled={!selectedAlmacen}
            >
              <Plus className="h-4 w-4 mr-1" />
              Agregar
            </Button>
          </CardHeader>
          <CardContent>
            {!selectedAlmacen ? (
              <div className="text-center py-8 text-muted-foreground">
                <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Selecciona un almacen</p>
                <p className="text-sm">para gestionar sus localizaciones</p>
              </div>
            ) : loadingLocalizaciones ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : localizaciones.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No hay localizaciones</p>
                <p className="text-sm">Agrega estantes, filas o areas</p>
              </div>
            ) : (
              <div className="space-y-2">
                {localizaciones.map((loc) => (
                  <div
                    key={loc.id}
                    className="group flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{loc.nombre}</p>
                        {loc.descripcion && (
                          <p className="text-sm text-muted-foreground">{loc.descripcion}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditLocalizacionDialog(loc)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-destructive/10"
                        onClick={() => handleDeleteLocalizacion(loc)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Warehouse Dialog */}
      <Dialog open={almacenDialogOpen} onOpenChange={setAlmacenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAlmacen ? "Editar Almacen" : "Nuevo Almacen"}
            </DialogTitle>
            <DialogDescription>
              {editingAlmacen 
                ? "Modifica los datos del almacen"
                : "Crea un nuevo almacen para organizar tu inventario"
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="almacen-nombre">Nombre *</Label>
              <Input
                id="almacen-nombre"
                placeholder="Ej: Bodega Central, Sucursal Norte"
                value={almacenForm.nombre}
                onChange={(e) => setAlmacenForm({ ...almacenForm, nombre: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="almacen-ubicacion">Ubicacion</Label>
              <Input
                id="almacen-ubicacion"
                placeholder="Direccion fisica del almacen"
                value={almacenForm.ubicacion}
                onChange={(e) => setAlmacenForm({ ...almacenForm, ubicacion: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAlmacenDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveAlmacen} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingAlmacen ? "Actualizar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Location Dialog */}
      <Dialog open={localizacionDialogOpen} onOpenChange={setLocalizacionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingLocalizacion ? "Editar Localizacion" : "Nueva Localizacion"}
            </DialogTitle>
            <DialogDescription>
              {selectedAlmacen && (
                <span>Para el almacen: <strong>{selectedAlmacen.nombre}</strong></span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="loc-nombre">Nombre *</Label>
              <Input
                id="loc-nombre"
                placeholder="Ej: Estante A-1, Fila 4, Area de Refrigeracion"
                value={localizacionForm.nombre}
                onChange={(e) => setLocalizacionForm({ ...localizacionForm, nombre: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loc-descripcion">Descripcion</Label>
              <Input
                id="loc-descripcion"
                placeholder="Descripcion opcional"
                value={localizacionForm.descripcion}
                onChange={(e) => setLocalizacionForm({ ...localizacionForm, descripcion: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLocalizacionDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveLocalizacion} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingLocalizacion ? "Actualizar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
