"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/lib/contexts/auth-context"
import { Home, ChevronRight, LayoutDashboard, ShoppingCart, FileText, ClipboardList, CreditCard, Settings, Store } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarFooter,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { MODULOS, CATEGORIAS_ORDEN, type Categoria, type ModuloGranular } from "@/lib/constants/modulos"
import { countAprobacionesPendientes } from "@/lib/services/productos-pendientes"

// Iconos por categoria (el contenedor del collapsible)
const CATEGORIA_ICON: Record<Categoria, React.ComponentType<{ className?: string }>> = {
  Dashboard: LayoutDashboard,
  Ventas: ShoppingCart,
  Inventario: ClipboardList,
  Finanzas: CreditCard,
  Configuracion: Settings,
  "Concept Store": Store,
}

function getInitials(name: string): string {
  if (!name) return "U"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function ERPSidebar() {
  const pathname = usePathname()
  const { user, hasModulo } = useAuth()
  const [pendingCount, setPendingCount] = React.useState(0)

  React.useEffect(() => {
    const id = user?.razon_social_id
    if (!id) return
    countAprobacionesPendientes(id).then(setPendingCount).catch(() => {})
  }, [user?.razon_social_id])

  // Agrupa los modulos granulares por categoria, filtrando por permiso
  // en CADA HOJA (no en el contenedor). Si una categoria queda vacia,
  // no se renderiza.
  const grupos = React.useMemo(() => {
    const out: Array<{ categoria: Categoria; modulos: ModuloGranular[] }> = []
    for (const categoria of CATEGORIAS_ORDEN) {
      const modulos = MODULOS.filter(
        (m) => m.categoria === categoria && hasModulo(m.nombre)
      )
      if (modulos.length > 0) out.push({ categoria, modulos })
    }
    return out
  }, [hasModulo])

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-5">
        <Link href="/" className="flex items-center justify-center group">
          {user?.logo_url ? (
            <img
              src={user.logo_url || "/placeholder.svg"}
              alt={user.razon_social_nombre || "EasyCount"}
              className="h-12 w-auto max-w-[160px] object-contain transition-opacity duration-300 group-hover:opacity-80"
            />
          ) : (
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/WhatsApp%20Image%202026-04-22%20at%208.57.20%20PM-RKsyYHvftfuejI9wKhhcuYBQcQXMWp.jpeg"
              alt="EasyCount"
              className="h-12 w-auto max-w-[160px] object-contain transition-opacity duration-300 group-hover:opacity-80"
            />
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-stone-500 uppercase text-xs tracking-wider font-medium">
            Menu Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Inicio: siempre visible */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Inicio" isActive={pathname === "/"}>
                  <Link href="/">
                    <Home className="h-4 w-4" />
                    <span>Inicio</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {grupos.map(({ categoria, modulos }) => {
                const Icon = CATEGORIA_ICON[categoria]
                const isActive = modulos.some((m) => pathname === m.href || pathname.startsWith(m.href + "/"))

                // Si la categoria tiene un solo modulo, lo mostramos plano
                // (sin collapsible) para simplificar la navegacion.
                if (modulos.length === 1) {
                  const m = modulos[0]
                  const isAprobaciones = m.nombre === "Aprobaciones"
                  return (
                    <SidebarMenuItem key={m.nombre}>
                      <SidebarMenuButton
                        asChild
                        tooltip={m.nombre}
                        isActive={pathname === m.href || pathname.startsWith(m.href + "/")}
                      >
                        <Link href={m.href}>
                          <m.icon className="h-4 w-4" />
                          <span>{m.nombre}</span>
                          {isAprobaciones && pendingCount > 0 && (
                            <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                              {pendingCount > 99 ? "99+" : pendingCount}
                            </span>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                }

                return (
                  <Collapsible key={categoria} asChild defaultOpen={isActive}>
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip={categoria} isActive={isActive}>
                          <Icon className="h-4 w-4" />
                          <span>{categoria}</span>
                          <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {modulos.map((m) => {
                            const isAprobaciones = m.nombre === "Aprobaciones"
                            return (
                              <SidebarMenuSubItem key={m.nombre}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={pathname === m.href || pathname.startsWith(m.href + "/")}
                                >
                                  <Link href={m.href}>
                                    <m.icon className="h-3.5 w-3.5" />
                                    <span>{m.nombre}</span>
                                    {isAprobaciones && pendingCount > 0 && (
                                      <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                                        {pendingCount > 99 ? "99+" : pendingCount}
                                      </span>
                                    )}
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            )
                          })}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-sidebar-accent transition-all duration-300">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white text-sm font-medium shadow-sm"
            style={{ backgroundColor: "#abcde0" }}
          >
            {getInitials(user?.nombre || "Usuario")}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-stone-700 truncate">{user?.nombre || "Usuario"}</span>
            <span className="text-xs text-stone-500 truncate">{user?.email || "-"}</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
