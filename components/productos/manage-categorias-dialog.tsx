"use client"

/**
 * ManageCategoriasDialog
 * ----------------------
 * Vista en acordeon para administrar Categorias y sus Subcategorias.
 *
 * Cada AccordionItem representa una categoria principal. Al expandirlo:
 *   - Se listan las subcategorias existentes con acciones de editar/eliminar.
 *   - Aparece un formulario inline "Agregar Subcategoria" que llama al
 *     servicio createSubcategoria. El servicio inyecta automaticamente
 *     razon_social_id (tenant stamp) y aqui pasamos categoria_id.
 *
 * Notas:
 *   - El padre controla el estado open/onOpenChange para encadenar el
 *     refresh del listado de productos al cerrar.
 *   - onSubcategoriasChanged() recarga la lista plana en el padre tras
 *     cualquier mutacion (crear / editar / eliminar).
 *   - El boton "Agregar Categoria" delega en el modal existente del padre
 *     (onCreateCategoria) para no duplicar la logica de createCategoria.
 */

import { useMemo, useState } from "react"
import {
  Plus,
  Pencil,
  Trash2,
  Layers,
  FolderTree,
  Check,
  X,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import {
  Categoria,
  Subcategoria,
  createSubcategoria,
  updateSubcategoria,
  deleteSubcategoria,
} from "@/lib/services/catalogos"

interface ManageCategoriasDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categorias: Categoria[]
  subcategorias: Subcategoria[]
  /** Recarga la lista plana de subcategorias en el padre. */
  onSubcategoriasChanged: () => void | Promise<void>
  /** Abre el modal de "Crear Categoria" del padre. */
  onCreateCategoria: () => void
}

export function ManageCategoriasDialog({
  open,
  onOpenChange,
  categorias,
  subcategorias,
  onSubcategoriasChanged,
  onCreateCategoria,
}: ManageCategoriasDialogProps) {
  const { toast } = useToast()

  // Indice por categoria_id para no recalcular en cada render.
  const subsByCategoria = useMemo(() => {
    const map = new Map<number, Subcategoria[]>()
    for (const s of subcategorias) {
      const arr = map.get(s.categoria_id) ?? []
      arr.push(s)
      map.set(s.categoria_id, arr)
    }
    return map
  }, [subcategorias])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderTree className="h-5 w-5 text-stone-700" />
            Gestionar Categorias y Subcategorias
          </DialogTitle>
          <DialogDescription>
            Expande una categoria para ver y administrar sus subcategorias.
            Las subcategorias son opcionales por producto.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between py-2">
          <p className="text-sm text-stone-600">
            {categorias.length} categoria{categorias.length !== 1 ? "s" : ""}
            {" "}/ {subcategorias.length} subcategoria{subcategorias.length !== 1 ? "s" : ""}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-stone-300 bg-stone-50 hover:bg-stone-100 text-stone-700 rounded-xl"
            onClick={onCreateCategoria}
          >
            <Plus className="h-4 w-4 mr-1" />
            Nueva Categoria
          </Button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {categorias.length === 0 ? (
            <div className="text-center py-10 text-stone-500">
              <Layers className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No hay categorias todavia.</p>
              <p className="text-xs">Crea la primera para empezar.</p>
            </div>
          ) : (
            <Accordion type="multiple" className="w-full">
              {categorias.map((cat) => (
                <CategoriaAccordionItem
                  key={cat.id}
                  categoria={cat}
                  subcategorias={subsByCategoria.get(cat.id!) ?? []}
                  onChanged={onSubcategoriasChanged}
                />
              ))}
            </Accordion>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =============================================================================
// CategoriaAccordionItem
// =============================================================================

interface CategoriaAccordionItemProps {
  categoria: Categoria
  subcategorias: Subcategoria[]
  onChanged: () => void | Promise<void>
}

function CategoriaAccordionItem({
  categoria,
  subcategorias,
  onChanged,
}: CategoriaAccordionItemProps) {
  const { toast } = useToast()

  // Estados locales para crear / editar dentro de esta categoria.
  const [newSubName, setNewSubName] = useState("")
  const [creating, setCreating] = useState(false)
  // editingId: id de la subcategoria en modo edicion (null = ninguna)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  async function handleCreate() {
    const nombre = newSubName.trim()
    if (!nombre) {
      toast({
        title: "Nombre requerido",
        description: "Ingresa un nombre para la subcategoria",
        variant: "destructive",
      })
      return
    }
    if (!categoria.id) return

    setCreating(true)
    const { error } = await createSubcategoria(nombre, categoria.id)
    setCreating(false)

    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" })
      return
    }

    toast({
      title: "Subcategoria creada",
      description: `"${nombre}" agregada en ${categoria.nombre}`,
    })
    setNewSubName("")
    await onChanged()
  }

  function startEdit(sub: Subcategoria) {
    setEditingId(sub.id!)
    setEditingName(sub.nombre)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingName("")
  }

  async function saveEdit(sub: Subcategoria) {
    const nombre = editingName.trim()
    if (!nombre) {
      toast({
        title: "Nombre requerido",
        variant: "destructive",
      })
      return
    }
    if (!sub.id) return
    setSavingEdit(true)
    const { error } = await updateSubcategoria(sub.id, nombre)
    setSavingEdit(false)
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" })
      return
    }
    toast({ title: "Subcategoria actualizada" })
    cancelEdit()
    await onChanged()
  }

  async function handleDelete(sub: Subcategoria) {
    if (!sub.id) return
    if (
      !confirm(
        `Eliminar subcategoria "${sub.nombre}"?\n\nLos productos que la usaban quedaran solo con la categoria principal.`,
      )
    ) {
      return
    }
    setDeletingId(sub.id)
    const { error } = await deleteSubcategoria(sub.id)
    setDeletingId(null)
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" })
      return
    }
    toast({ title: "Subcategoria eliminada" })
    await onChanged()
  }

  return (
    <AccordionItem value={`cat-${categoria.id}`} className="border-stone-200">
      <AccordionTrigger className="hover:no-underline px-2 rounded-lg hover:bg-stone-50">
        <div className="flex items-center gap-2 text-left">
          <Layers className="h-4 w-4 text-stone-500" />
          <span className="font-medium text-stone-800">{categoria.nombre}</span>
          <Badge
            variant="outline"
            className="ml-1 text-xs bg-stone-50 border-stone-200 text-stone-600 rounded-full font-normal"
          >
            {subcategorias.length} sub
          </Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-2 pb-3">
        <div className="space-y-3 pl-6">
          {/* Lista de subcategorias */}
          {subcategorias.length === 0 ? (
            <p className="text-xs text-stone-500 italic">
              Sin subcategorias todavia.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {subcategorias.map((sub) => (
                <li
                  key={sub.id}
                  className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-1.5"
                >
                  {editingId === sub.id ? (
                    <>
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !savingEdit) saveEdit(sub)
                          if (e.key === "Escape") cancelEdit()
                        }}
                        className="h-8 text-sm rounded-lg border-stone-200"
                        autoFocus
                        disabled={savingEdit}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-emerald-600 hover:bg-emerald-50"
                        onClick={() => saveEdit(sub)}
                        disabled={savingEdit}
                        title="Guardar"
                      >
                        {savingEdit ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-stone-500 hover:bg-stone-100"
                        onClick={cancelEdit}
                        disabled={savingEdit}
                        title="Cancelar"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-stone-700">
                        {sub.nombre}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => startEdit(sub)}
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(sub)}
                        disabled={deletingId === sub.id}
                        title="Eliminar"
                      >
                        {deletingId === sub.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Formulario inline para agregar */}
          <div className="flex gap-2 pt-1">
            <Input
              value={newSubName}
              onChange={(e) => setNewSubName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !creating) handleCreate()
              }}
              placeholder={`Nueva subcategoria de ${categoria.nombre}`}
              className="h-9 text-sm rounded-lg border-stone-200"
              disabled={creating}
            />
            <Button
              type="button"
              size="sm"
              onClick={handleCreate}
              disabled={creating || !newSubName.trim()}
              className="bg-stone-700 hover:bg-stone-800 text-white shrink-0"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar
                </>
              )}
            </Button>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
