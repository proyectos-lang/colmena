"use client"

import * as React from "react"
import type { EmprendedorSession } from "@/lib/services/emprendedores-auth"

interface EmprendedorAuthContextValue {
  emprendedor: EmprendedorSession | null
  setEmprendedor: (s: EmprendedorSession | null) => void
}

const EmprendedorAuthContext = React.createContext<EmprendedorAuthContextValue | undefined>(undefined)

export function EmprendedorAuthProvider({
  children,
  initialSession,
}: {
  children: React.ReactNode
  initialSession: EmprendedorSession | null
}) {
  const [emprendedor, setEmprendedor] = React.useState<EmprendedorSession | null>(initialSession)

  const value = React.useMemo(() => ({ emprendedor, setEmprendedor }), [emprendedor])

  return (
    <EmprendedorAuthContext.Provider value={value}>
      {children}
    </EmprendedorAuthContext.Provider>
  )
}

export function useEmprendedorAuth(): EmprendedorAuthContextValue {
  const ctx = React.useContext(EmprendedorAuthContext)
  if (!ctx) throw new Error("useEmprendedorAuth debe usarse dentro de EmprendedorAuthProvider")
  return ctx
}
