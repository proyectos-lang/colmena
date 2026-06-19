"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { LogOut, Loader2 } from "lucide-react"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/lib/contexts/auth-context"
import { CartProvider } from "@/lib/contexts/cart-context"
import { RouteGuard } from "@/components/route-guard"

// Dynamic import with SSR disabled to prevent hydration mismatch from Radix IDs
const ERPSidebar = dynamic(
  () => import("@/components/erp-sidebar").then(mod => ({ default: mod.ERPSidebar })),
  { ssr: false }
)

function getInitials(name: string): string {
  if (!name) return "U"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { user, loading, logout } = useAuth()

  // Proteccion de rutas - redirigir a login si no esta autenticado
  React.useEffect(() => {
    if (!loading && !user) {
      router.replace("/login")
    }
  }, [user, loading, router])

  // Mientras carga la sesion
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 to-amber-50/30">
        <div className="flex flex-col items-center gap-4">
          <span className="font-bold text-3xl tracking-tight text-stone-800">EasyCount</span>
          <div className="flex items-center gap-2 text-stone-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Cargando sesion...</span>
          </div>
        </div>
      </div>
    )
  }

  // Si no hay usuario, no renderizar nada (el useEffect redirige)
  if (!user) return null

  async function handleLogout() {
    await logout()
    router.replace("/login")
  }

  return (
    <CartProvider>
    <SidebarProvider>
      <ERPSidebar />
      <SidebarInset className="bg-stone-50 min-h-screen">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-stone-200/60 bg-white/80 backdrop-blur-sm px-4 md:px-6">
          <SidebarTrigger className="-ml-1 md:-ml-2 rounded-lg hover:bg-stone-100 transition-colors duration-200" />

          {/* Logo / Iniciales de la razon social */}
          <div className="flex items-center gap-3">
            {user.logo_url ? (
              <img
                src={user.logo_url || "/placeholder.svg"}
                alt={user.razon_social_nombre || "EasyCount"}
                className="h-9 w-auto max-w-[140px] object-contain"
              />
            ) : user.razon_social_nombre ? (
              <>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-stone-200 text-stone-700 font-semibold text-sm border border-stone-200">
                  {getInitials(user.razon_social_nombre)}
                </div>
                <span className="hidden md:inline text-sm font-medium text-stone-700 truncate max-w-[200px]">
                  {user.razon_social_nombre}
                </span>
              </>
            ) : (
              <span className="font-bold text-xl tracking-tight text-stone-800">
                EasyCount
              </span>
            )}
          </div>

          {/* Usuario a la derecha */}
          <div className="ml-auto flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 px-3 py-1.5 rounded-xl hover:bg-stone-100 transition-colors">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium text-stone-800 leading-tight">{user.nombre}</p>
                    <p className="text-xs text-stone-500 leading-tight">{user.email}</p>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full text-white text-xs font-semibold shadow-sm" style={{ backgroundColor: "#abcde0" }}>
                    {getInitials(user.nombre)}
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl">
                <DropdownMenuLabel>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{user.nombre}</span>
                    <span className="text-xs text-stone-500 font-normal">{user.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar sesion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 md:p-6">
          <RouteGuard>{children}</RouteGuard>
        </main>
      </SidebarInset>
    </SidebarProvider>
    </CartProvider>
  )
}
