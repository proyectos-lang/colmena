"use client"

import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
  import { Building2, Loader2, ImagePlus, Trash2, UploadCloud, Info } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { useToast } from "@/hooks/use-toast"
import { ConnectionStatusIndicator } from "@/components/connection-status"
import {
  getRazonSocial,
  saveRazonSocial,
  uploadLogo,
  removeLogo,
  validateLogoFile,
  ALLOWED_LOGO_TYPES,
  MAX_LOGO_SIZE_MB,
  type RazonSocial,
} from "@/lib/services/razon-social"
import { useTenant } from "@/lib/hooks/use-tenant"
import { useAuth } from "@/lib/contexts/auth-context"

const razonSocialSchema = z.object({
  nombre_empresa: z.string().min(1, "El nombre de la empresa es requerido"),
  nombre_comercial: z.string().min(1, "El nombre comercial es requerido"),
  documento: z.string().min(1, "El RTN es requerido").regex(
    /^\d{4}-\d{4}-\d{6}$/,
    "El formato del RTN debe ser 0000-0000-000000"
  ),
  direccion: z.string().min(1, "La direccion es requerida"),
  telefono: z.string().min(1, "El telefono es requerido").regex(
    /^[\d\s\-+()]+$/,
    "Formato de telefono invalido"
  ),
  correo: z.string().min(1, "El correo es requerido").email("Correo electronico invalido"),
})

type RazonSocialFormData = z.infer<typeof razonSocialSchema>

function FormSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72 mt-2" />
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid gap-6 md:grid-cols-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
        <Skeleton className="h-9 w-32" />
      </CardContent>
    </Card>
  )
}

export default function RazonSocialPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isNewRecord, setIsNewRecord] = useState(false)

  // Logo state
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [isRemovingLogo, setIsRemovingLogo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { toast } = useToast()
  const { ready, razonSocialId } = useTenant()
  const { refreshProfile } = useAuth()

  const form = useForm<RazonSocialFormData>({
    resolver: zodResolver(razonSocialSchema),
    defaultValues: {
      nombre_empresa: "",
      nombre_comercial: "",
      documento: "",
      direccion: "",
      telefono: "",
      correo: "",
    },
  })

  useEffect(() => {
    if (!ready) return
    if (razonSocialId == null) {
      setIsNewRecord(true)
      setIsLoading(false)
      return
    }

    async function loadData() {
      try {
        const { data, error } = await getRazonSocial()

        if (error) {
          toast({
            title: "No se pudieron cargar los datos",
            description: error,
            variant: "destructive",
          })
          return
        }

        if (data) {
          // El form no incluye logo_url; lo guardamos aparte.
          const { logo_url, ...formData } = data
          form.reset(formData as RazonSocialFormData)
          setLogoUrl(logo_url ?? null)
          setIsNewRecord(false)
        } else {
          setIsNewRecord(true)
        }
      } catch (err: any) {
        toast({
          title: "No se pudieron cargar los datos",
          description: err?.message || "Error de conexion",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, razonSocialId, form, toast])

  // Libera el ObjectURL cuando cambia o se desmonta
  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview)
    }
  }, [localPreview])

  async function onSubmit(data: RazonSocialFormData) {
    setIsSaving(true)

    try {
      const { success, error } = await saveRazonSocial(data as RazonSocial, isNewRecord)

      if (!success) {
        toast({
          title: "Error",
          description: error || "No se pudo guardar la informacion",
          variant: "destructive",
        })
        return
      }

      toast({
        title: isNewRecord ? "Razon Social creada" : "Razon Social actualizada",
        description: "Los datos se han guardado correctamente",
      })

      setIsNewRecord(false)
      // Refrescar el perfil global (nombre de la empresa en sidebar/navbar, etc.)
      await refreshProfile()
    } catch {
      toast({
        title: "Error",
        description: "No se pudo guardar la informacion",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Permitir reseleccionar el mismo archivo en el futuro
    if (fileInputRef.current) fileInputRef.current.value = ""

    if (!file) return

    // Validacion en cliente (feedback inmediato)
    const validation = validateLogoFile(file)
    if (!validation.ok) {
      toast({
        title: "Archivo invalido",
        description: validation.error || "",
        variant: "destructive",
      })
      return
    }

    // Vista previa local
    const objectUrl = URL.createObjectURL(file)
    if (localPreview) URL.revokeObjectURL(localPreview)
    setLocalPreview(objectUrl)

    // Subida
    setIsUploadingLogo(true)
    const { url, error } = await uploadLogo(file)
    setIsUploadingLogo(false)

    if (error || !url) {
      toast({
        title: "No se pudo subir el logo",
        description: error || "Error desconocido",
        variant: "destructive",
      })
      // Si falla, revertimos la preview
      setLocalPreview(null)
      URL.revokeObjectURL(objectUrl)
      return
    }

    setLogoUrl(url)
    setLocalPreview(null)
    URL.revokeObjectURL(objectUrl)

    toast({
      title: "Logo actualizado",
      description: "El nuevo logo ya esta disponible en toda la aplicacion.",
    })

    // Propagar el cambio al AuthContext (sidebar, etc.)
    await refreshProfile()
  }

  async function handleLogoRemove() {
    setIsRemovingLogo(true)
    const { success, error } = await removeLogo()
    setIsRemovingLogo(false)

    if (!success) {
      toast({
        title: "No se pudo eliminar el logo",
        description: error || "",
        variant: "destructive",
      })
      return
    }

    setLogoUrl(null)
    toast({
      title: "Logo eliminado",
      description: "La empresa volvera a mostrar el nombre en la barra lateral.",
    })
    await refreshProfile()
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <FormSkeleton />
      </div>
    )
  }

  const previewSrc = localPreview || logoUrl
  const canUploadLogo = !isNewRecord && razonSocialId != null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Razon Social</h1>
          <p className="text-sm text-muted-foreground">
            Configura la informacion fiscal y legal de tu empresa
          </p>
        </div>
        <ConnectionStatusIndicator className="mt-2 sm:mt-0" />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Informacion de la Empresa</CardTitle>
              <CardDescription>
                {isNewRecord
                  ? "Completa los datos para registrar tu empresa"
                  : "Actualiza los datos de tu empresa cuando sea necesario"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {/* ============================== */}
          {/* Identidad Corporativa - Logo   */}
          {/* ============================== */}
          <section aria-labelledby="logo-heading" className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h2 id="logo-heading" className="text-sm font-medium text-foreground">
                Identidad corporativa
              </h2>
              <p className="text-xs text-muted-foreground">
                El logo aparece en la barra lateral y en los documentos generados (PDFs).
                Formatos permitidos: PNG, JPG, WEBP. Tamano maximo: {MAX_LOGO_SIZE_MB}MB.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-5 rounded-xl border border-border bg-muted/30 p-4">
              {/* Preview */}
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-card">
                {previewSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewSrc || "/placeholder.svg"}
                    alt="Logo de la empresa"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1 text-muted-foreground">
                    <ImagePlus className="h-6 w-6" aria-hidden="true" />
                    <span className="text-[10px] uppercase tracking-wide">Sin logo</span>
                  </div>
                )}
              </div>

              {/* Controles */}
              <div className="flex flex-1 flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  {/* Patron label + htmlFor: el tap en el label nativo abre el
                      file picker sin JS, evitando bloqueos de iOS Safari y
                      algunos navegadores Android que rechazan .click()
                      programatico sobre inputs file ocultos. */}
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    disabled={!canUploadLogo || isUploadingLogo || isRemovingLogo}
                  >
                    <label
                      htmlFor="logo-file-input"
                      className={
                        !canUploadLogo || isUploadingLogo || isRemovingLogo
                          ? "cursor-not-allowed"
                          : "cursor-pointer"
                      }
                    >
                      {isUploadingLogo ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Subiendo...
                        </>
                      ) : (
                        <>
                          <UploadCloud className="mr-2 h-4 w-4" />
                          {logoUrl ? "Cambiar logo" : "Subir logo"}
                        </>
                      )}
                    </label>
                  </Button>
                  {logoUrl && !isUploadingLogo && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleLogoRemove}
                      disabled={isRemovingLogo || !canUploadLogo}
                      className="text-destructive hover:text-destructive"
                    >
                      {isRemovingLogo ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Eliminando...
                        </>
                      ) : (
                        <>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {!canUploadLogo && (
                  <p className="text-xs text-muted-foreground">
                    Guarda los datos de la empresa antes de subir el logo.
                  </p>
                )}

                <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-2.5">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                  <p className="text-xs leading-relaxed text-foreground">
                    <span className="font-medium">Recomendacion:</span> recorta el logo para que
                    no tenga espacios en blanco a los extremos, ya que afectan el tamano con que
                    se muestra el logo en la barra lateral y en los PDFs.
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  id="logo-file-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                  onChange={handleLogoFile}
                  className="hidden"
                  aria-label="Seleccionar archivo de logo"
                  disabled={!canUploadLogo || isUploadingLogo || isRemovingLogo}
                />
              </div>
            </div>
          </section>

          <Separator />

          {/* ============================== */}
          {/* Formulario                      */}
          {/* ============================== */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="nombre_empresa"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre de la Empresa</FormLabel>
                      <FormControl>
                        <Input placeholder="Mi Empresa S.A. de C.V." {...field} />
                      </FormControl>
                      <FormDescription>Nombre legal registrado</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="nombre_comercial"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre Comercial</FormLabel>
                      <FormControl>
                        <Input placeholder="Mi Empresa" {...field} />
                      </FormControl>
                      <FormDescription>Nombre de marca o comercial</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="documento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>RTN</FormLabel>
                      <FormControl>
                        <Input placeholder="0000-0000-000000" {...field} />
                      </FormControl>
                      <FormDescription>Registro Tributario Nacional</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="telefono"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefono</FormLabel>
                      <FormControl>
                        <Input placeholder="+504 0000-0000" {...field} />
                      </FormControl>
                      <FormDescription>Numero de contacto principal</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="correo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Correo Electronico</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="contacto@miempresa.com" {...field} />
                      </FormControl>
                      <FormDescription>Correo oficial de la empresa</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="direccion"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Direccion</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Calle Principal, Colonia Centro, Ciudad"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Direccion fiscal completa</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isNewRecord ? "Crear Razon Social" : "Guardar Cambios"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
