import { NextResponse } from "next/server"
import { generateExcelTemplate } from "@/lib/utils/excel-parsers"

export async function GET() {
  const buffer = generateExcelTemplate()
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla_productos.xlsx"',
    },
  })
}
