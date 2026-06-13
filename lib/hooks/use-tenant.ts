"use client"

import { useAuth } from "@/lib/contexts/auth-context"

/**
 * Hook unificado que expone el razon_social_id del tenant activo y un flag `ready`.
 *
 * Patron de uso estandar en cualquier pagina:
 *
 *   const { razonSocialId, ready } = useTenant()
 *
 *   React.useEffect(() => {
 *     if (!ready) return               // sesion aun cargando
 *     if (razonSocialId == null) {     // usuario sin razon social asignada
 *       setLoading(false)
 *       return
 *     }
 *     loadData(razonSocialId)
 *   }, [ready, razonSocialId])
 *
 * RLS en Supabase ya protege a nivel servidor. Este hook evita disparar
 * consultas antes de que el perfil este cargado (lo que causa 401 / spinner infinito).
 */
export function useTenant() {
  const { user, loading } = useAuth()

  const ready = !loading && !!user
  const razonSocialId = user?.razon_social_id ?? null

  return {
    razonSocialId,
    ready,
    loading,
    hasRazonSocial: razonSocialId != null,
    user,
  }
}
