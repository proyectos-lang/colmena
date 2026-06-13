import { NextResponse } from "next/server"
import { generateInventarioExcelTemplate } from "@/lib/utils/excel-parsers"

export async function GET() {
  const buffer = generateInventarioExcelTemplate()
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla_inventario.xlsx"',
    },
  })
}
