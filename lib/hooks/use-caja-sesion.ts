"use client"

import * as React from "react"
import {
  getSesionAbierta,
  getSaldoActualSesionAbierta,
  type CajaSesion,
  CAJA_FEATURE_PENDING,
} from "@/lib/services/caja-chica"
import { useTenant } from "@/lib/hooks/use-tenant"

export interface UseCajaSesionResult {
  sesion: CajaSesion | null
  saldoActual: number
  loading: boolean
  /** true si la migracion 011 aun no se aplico */
  featurePending: boolean
  /**
   * Refresca sesion + saldo. Devuelve la sesion fresca para que los
   * consumidores puedan encadenar lecturas dependientes sin depender del
   * estado de React (que aun no se ha re-renderizado).
   */
  refetch: () => Promise<CajaSesion | null>
}

/**
 * Hook reutilizable que expone la sesion de caja abierta + el saldo running
 * actual. Se refresca al montar y cuando cambia `razonSocialId`. Las paginas
 * que mutan la caja deben llamar `refetch()` despues de cada operacion.
 *
 * No hace polling: las consumidoras que necesiten ver cambios de otros
 * usuarios deben llamar `refetch()` manualmente o tras cada submit.
 */
export function useCajaSesion(): UseCajaSesionResult {
  const { ready, razonSocialId } = useTenant()
  const [sesion, setSesion] = React.useState<CajaSesion | null>(null)
  const [saldoActual, setSaldoActual] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [featurePending, setFeaturePending] = React.useState(false)

  const refetch = React.useCallback(async (): Promise<CajaSesion | null> => {
    setLoading(true)
    const { data, error } = await getSesionAbierta()
    if (error === CAJA_FEATURE_PENDING) {
      setFeaturePending(true)
      setSesion(null)
      setSaldoActual(0)
      setLoading(false)
      return null
    }
    setFeaturePending(false)
    setSesion(data)
    if (data?.id) {
      const saldo = await getSaldoActualSesionAbierta()
      setSaldoActual(saldo)
    } else {
      setSaldoActual(0)
    }
    setLoading(false)
    return data
  }, [])

  React.useEffect(() => {
    if (!ready) return
    if (razonSocialId == null) {
      setLoading(false)
      return
    }
    refetch()
  }, [ready, razonSocialId, refetch])

  return { sesion, saldoActual, loading, featurePending, refetch }
}
