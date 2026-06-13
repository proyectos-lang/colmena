import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ShoppingCart, PackageCheck, ArrowLeftRight, Package } from "lucide-react"

const activities = [
  {
    id: 1,
    type: "venta",
    description: "Venta #1234 - Cliente ABC",
    amount: "L 15,430",
    time: "Hace 5 min",
    icon: ShoppingCart,
  },
  {
    id: 2,
    type: "recepcion",
    description: "Recepcion de mercaderia - Proveedor XYZ",
    amount: "50 unidades",
    time: "Hace 1 hora",
    icon: PackageCheck,
  },
  {
    id: 3,
    type: "traslado",
    description: "Traslado entre almacenes",
    amount: "25 productos",
    time: "Hace 2 horas",
    icon: ArrowLeftRight,
  },
  {
    id: 4,
    type: "inventario",
    description: "Ajuste de inventario - SKU-001",
    amount: "+10 unidades",
    time: "Hace 3 horas",
    icon: Package,
  },
]

export function RecentActivity() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Actividad Reciente</CardTitle>
        <CardDescription>Ultimos movimientos del sistema</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          {activities.map((activity) => (
            <div 
              key={activity.id} 
              className="flex items-center gap-4 rounded-lg border p-3"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <activity.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{activity.description}</p>
                <p className="text-xs text-muted-foreground">{activity.time}</p>
              </div>
              <div className="text-sm font-medium text-right">
                {activity.amount}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
