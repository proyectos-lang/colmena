"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { type ConnectionStatus, checkConnection } from "@/lib/services/razon-social"

interface ConnectionStatusIndicatorProps {
  className?: string
}

export function ConnectionStatusIndicator({ className }: ConnectionStatusIndicatorProps) {
  const [status, setStatus] = useState<ConnectionStatus | "checking">("checking")

  useEffect(() => {
    async function check() {
      const result = await checkConnection()
      setStatus(result)
    }
    check()
  }, [])

  const statusConfig = {
    checking: {
      color: "bg-muted-foreground",
      label: "Verificando conexion...",
      pulse: true,
    },
    connected: {
      color: "bg-emerald-500",
      label: "Conectado a Supabase",
      pulse: false,
    },
    disconnected: {
      color: "bg-destructive",
      label: "Sin conexion a la base de datos",
      pulse: false,
    },
    not_configured: {
      color: "bg-amber-500",
      label: "Supabase no configurado (usando almacenamiento local)",
      pulse: false,
    },
  }

  const config = statusConfig[status]

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="relative flex h-2.5 w-2.5">
        {config.pulse && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              config.color
            )}
          />
        )}
        <span
          className={cn(
            "relative inline-flex h-2.5 w-2.5 rounded-full",
            config.color
          )}
        />
      </span>
      <span className="text-xs text-muted-foreground">{config.label}</span>
    </div>
  )
}
