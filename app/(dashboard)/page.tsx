"use client"

import Link from "next/link"
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Truck, 
  Package, 
  Wallet, 
  Settings,
  ArrowRight
} from "lucide-react"

const modules = [
  {
    title: "Dashboard",
    description: "El pulso de tu negocio. Visualiza tus ganancias y metricas clave en tiempo real.",
    icon: LayoutDashboard,
    href: "/dashboard",
    color: "#5D7B6F"
  },
  {
    title: "Ventas",
    description: "Cierra tratos y factura. Genera documentos profesionales para tus clientes en segundos.",
    icon: ShoppingCart,
    href: "/ventas/nueva",
    color: "#7C9A92"
  },
  {
    title: "Compras",
    description: "Abastece tu exito. Gestiona proveedores, importaciones y calcula costos reales con precision.",
    icon: Truck,
    href: "/compras/orden",
    color: "#C07A5C"
  },
  {
    title: "Inventario",
    description: "Tu bodega bajo control. Monitorea cada movimiento, traslado y valoracion de tu mercancia.",
    icon: Package,
    href: "/inventario/kardex",
    color: "#D4A574"
  },
  {
    title: "Cartera",
    description: "Cuida tu liquidez. Controla quien te debe y registra pagos de forma sencilla.",
    icon: Wallet,
    href: "/ventas/cuentas-por-cobrar",
    color: "#A1887F"
  },
  {
    title: "Configuracion",
    description: "Tu identidad. Personaliza los datos de tu empresa para que cada factura hable de ti.",
    icon: Settings,
    href: "/configuracion/razon-social",
    color: "#78716C"
  }
]

export default function WelcomePage() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Background with radial gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-stone-50 via-orange-50/20 to-amber-50/30 -z-10" />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 md:px-6 py-6 md:py-12">
        {/* Welcome Header */}
        <div className="text-center max-w-3xl mb-6 md:mb-12">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-3 md:mb-4 leading-tight text-balance" style={{ color: "#0D1821" }}>
            Bienvenido a tu Centro de Gestión
          </h1>
          <p className="text-sm sm:text-base md:text-lg lg:text-xl leading-relaxed text-pretty" style={{ color: "#344966" }}>
            Controla tu inventario, escala tus ventas y gestiona tu negocio con claridad y elegancia.
          </p>
        </div>

        {/* Module Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5 w-full max-w-5xl">
          {modules.map((module) => {
            const Icon = module.icon
            return (
              <Link
                key={module.title}
                href={module.href}
                className="group relative bg-white rounded-xl md:rounded-2xl p-4 md:p-6 border border-stone-200/60 shadow-sm hover:shadow-lg hover:shadow-amber-900/5 transition-all duration-500 active:scale-[0.98] hover:-translate-y-1 hover:border-amber-400/40"
              >
                {/* Glow effect on hover */}
                <div className="absolute inset-0 rounded-xl md:rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-amber-100/20 via-transparent to-orange-100/20" />
                
                <div className="relative">
                  {/* Icon */}
                  <div 
                    className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl flex items-center justify-center mb-3 md:mb-4 transition-transform duration-300 group-hover:scale-110"
                    style={{ backgroundColor: `${module.color}15` }}
                  >
                    <Icon 
                      className="h-5 w-5 md:h-6 md:w-6 transition-colors duration-300"
                      style={{ color: module.color }}
                    />
                  </div>

                  {/* Title */}
                  <h3 className="text-sm md:text-lg font-semibold text-stone-800 mb-1 md:mb-2 flex items-center gap-1 md:gap-2">
                    {module.title}
                    <ArrowRight className="h-3 w-3 md:h-4 md:w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-amber-600 hidden sm:block" />
                  </h3>

                  {/* Description */}
                  <p className="text-xs md:text-sm text-stone-500 leading-relaxed line-clamp-2 md:line-clamp-none">
                    {module.description}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-4 md:py-8">
        <p className="text-xs md:text-sm text-stone-400 font-light tracking-wide">
          Desarrollado para la excelencia operativa
        </p>
      </div>
    </div>
  )
}
