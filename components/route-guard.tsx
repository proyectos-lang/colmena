"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/lib/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import { findModuloByPath } from "@/lib/constants/modulos"

/**
 * Protege rutas segun los permisos granulares del usuario.
 *
 * - Si el pathname actual matchea un modulo (via prefijo) y el usuario NO
 *   tiene `puede_ver === true` para ese modulo, se redirige al Dashboard
 *   y se muestra un toast rojo "Acceso restringido".
 * - Rutas no protegidas (ej. "/") siempre pasan.
 * - Admins bypasean todo (por contrato de `hasModulo`).
 *
 * Debe montarse DENTRO del dashboard layout, despues de que la sesion
 * este cargada (`!loading && user`) para no disparar falsos positivos
 * en el primer render.
 */
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading, hasModulo } = useAuth()
  const { toast } = useToast()

  // Evita que el hijo se pinte durante la redireccion.
  const [blocked, setBlocked] = React.useState(false)

  // Evita spamear toasts si el usuario navega rapidamente a varias
  // rutas restringidas. Recordamos la ultima ruta bloqueada.
  const lastBlockedRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (loading || !user) return

    const modulo = findModuloByPath(pathname)

    // Ruta no protegida (ej. "/"): siempre pasar.
    if (!modulo) {
      setBlocked(false)
      lastBlockedRef.current = null
      return
    }

    // Usuario tiene permiso: pasar.
    if (hasModulo(modulo.nombre)) {
      setBlocked(false)
      lastBlockedRef.current = null
      return
    }

    // Sin permiso: bloquear, mostrar toast y redirigir.
    setBlocked(true)

    if (lastBlockedRef.current !== pathname) {
      lastBlockedRef.current = pathname
      toast({
        title: "Acceso restringido",
        description: `No tienes permiso para acceder a "${modulo.nombre}". Contacta a un administrador.`,
        variant: "destructive",
      })
    }

    router.replace("/")
  }, [pathname, user, loading, hasModulo, router, toast])

  if (blocked) return null
  return <>{children}</>
}
