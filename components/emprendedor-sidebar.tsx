"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEmprendedorAuth } from "@/lib/contexts/emprendedor-auth-context"
import { logoutAction } from "@/app/login-emprendedor/actions"
import { LayoutDashboard, Package, Boxes, BarChart3, LogOut } from "lucide-react"
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
  SidebarFooter,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"

const NAV_ITEMS = [
  { href: "/portal", label: "Inicio", icon: LayoutDashboard },
  { href: "/portal/mis-productos", label: "Mis Productos", icon: Package },
  { href: "/portal/inventario", label: "Inventario", icon: Boxes },
  { href: "/portal/ventas", label: "Ventas", icon: BarChart3 },
]

function getInitials(name: string) {
  if (!name) return "E"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function EmprendedorSidebar() {
  const { emprendedor } = useEmprendedorAuth()
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-5">
        <Link href="/portal/mis-productos" className="flex items-center justify-center group">
          <img
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/WhatsApp%20Image%202026-04-22%20at%208.57.20%20PM-RKsyYHvftfuejI9wKhhcuYBQcQXMWp.jpeg"
            alt="EasyCount"
            className="h-12 w-auto max-w-[160px] object-contain transition-opacity duration-300 group-hover:opacity-80"
          />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-stone-500 uppercase text-xs tracking-wider font-medium">
            {emprendedor?.emprendimientoNombre ?? "Portal Emprendedor"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    asChild
                    tooltip={label}
                    isActive={href === "/portal" ? pathname === "/portal" : pathname === href || pathname.startsWith(href + "/")}
                  >
                    <Link href={href}>
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white text-sm font-medium shadow-sm shrink-0"
            style={{ backgroundColor: "#abcde0" }}
          >
            {getInitials(emprendedor?.nombre ?? "E")}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-medium text-stone-700 truncate">{emprendedor?.nombre}</span>
            <span className="text-xs text-stone-500 truncate">{emprendedor?.emprendimientoNombre}</span>
          </div>
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" size="icon" className="shrink-0">
              <LogOut className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
