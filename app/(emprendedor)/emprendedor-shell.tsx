"use client"

import * as React from "react"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { EmprendedorSidebar } from "@/components/emprendedor-sidebar"
import { Toaster } from "sonner"

export function EmprendedorShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <EmprendedorSidebar />
      <SidebarInset className="bg-stone-50 min-h-screen">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-stone-200/60 bg-white/80 backdrop-blur-sm px-4 md:px-6">
          <SidebarTrigger className="-ml-1 md:-ml-2 rounded-lg hover:bg-stone-100 transition-colors duration-200" />
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
      <Toaster richColors position="top-right" />
    </SidebarProvider>
  )
}
