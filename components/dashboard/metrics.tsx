import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, ShoppingCart, DollarSign, AlertTriangle } from "lucide-react"

const metrics = [
  {
    title: "Total Productos",
    value: "1,234",
    description: "+12% desde el mes pasado",
    icon: Package,
    trend: "up" as const,
  },
  {
    title: "Ventas del Mes",
    value: "L 245,890",
    description: "+8.2% desde el mes pasado",
    icon: ShoppingCart,
    trend: "up" as const,
  },
  {
    title: "Valor Inventario",
    value: "L 1,432,500",
    description: "Valoracion actual",
    icon: DollarSign,
    trend: "neutral" as const,
  },
  {
    title: "Stock Bajo",
    value: "23",
    description: "Productos requieren atencion",
    icon: AlertTriangle,
    trend: "warning" as const,
  },
]

export function DashboardMetrics() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {metric.title}
            </CardTitle>
            <metric.icon 
              className={`h-4 w-4 ${
                metric.trend === "warning" 
                  ? "text-amber-500" 
                  : "text-muted-foreground"
              }`} 
            />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metric.value}</div>
            <p 
              className={`text-xs ${
                metric.trend === "up" 
                  ? "text-emerald-600" 
                  : metric.trend === "warning"
                  ? "text-amber-600"
                  : "text-muted-foreground"
              }`}
            >
              {metric.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
