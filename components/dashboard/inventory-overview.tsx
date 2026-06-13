import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const categories = [
  { name: "Electronica", count: 342, percentage: 28 },
  { name: "Ropa y Accesorios", count: 289, percentage: 23 },
  { name: "Hogar y Jardin", count: 234, percentage: 19 },
  { name: "Deportes", count: 198, percentage: 16 },
  { name: "Otros", count: 171, percentage: 14 },
]

export function InventoryOverview() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventario por Categoria</CardTitle>
        <CardDescription>Distribucion actual de productos</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          {categories.map((category) => (
            <div key={category.name} className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{category.name}</span>
                <span className="text-muted-foreground">
                  {category.count} productos ({category.percentage}%)
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-secondary">
                <div 
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{ width: `${category.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
