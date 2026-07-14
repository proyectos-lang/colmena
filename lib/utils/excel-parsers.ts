import * as XLSX from "xlsx"

export interface ExcelProductoRow {
  nombre: string
  codigo_barras: string
  precio_venta_sugerido: number
  cantidad_inicial?: number
  marca?: string
  categoria?: string
  subcategoria?: string
}

export interface RawInventarioRow {
  codigo_barras: string
  cantidad: number
}

export function generateExcelTemplate(): Buffer {
  const headers = [
    "nombre",
    "codigo_barras",
    "precio_venta_sugerido",
    "cantidad_inicial",
    "marca",
    "categoria",
    "subcategoria",
  ]
  const example = ["Camiseta Estampada", "COD-001", 25000, 10, "Mi Marca", "Ropa", "Camisetas"]

  const ws = XLSX.utils.aoa_to_sheet([headers, example])
  ws["!cols"] = headers.map(() => ({ wch: 22 }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Productos")

  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }))
}

export function parseExcelUpload(buffer: Buffer): { rows: ExcelProductoRow[]; errors: string[] } {
  const wb = XLSX.read(buffer, { type: "buffer" })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" })

  const rows: ExcelProductoRow[] = []
  const errors: string[] = []

  raw.forEach((row, idx) => {
    const lineNum = idx + 2
    const nombre = String(row["nombre"] ?? "").trim()
    const codigoBarras = String(row["codigo_barras"] ?? "").trim()
    const precioVenta = parseFloat(row["precio_venta_sugerido"])

    if (!nombre) { errors.push(`Fila ${lineNum}: nombre es requerido`); return }
    if (!codigoBarras) { errors.push(`Fila ${lineNum}: codigo_barras es requerido`); return }
    if (isNaN(precioVenta) || precioVenta < 0) { errors.push(`Fila ${lineNum}: precio_venta_sugerido inválido`); return }

    rows.push({
      nombre,
      codigo_barras: codigoBarras,
      precio_venta_sugerido: precioVenta,
      cantidad_inicial: row["cantidad_inicial"] !== "" ? parseFloat(row["cantidad_inicial"]) : 0,
      marca: String(row["marca"] ?? "").trim() || undefined,
      categoria: String(row["categoria"] ?? "").trim() || undefined,
      subcategoria: String(row["subcategoria"] ?? "").trim() || undefined,
    })
  })

  return { rows, errors }
}

export function generateInventarioExcelTemplate(): Buffer {
  const headers = ["codigo_barras", "cantidad"]
  const example = ["COD-001", 5]

  const ws = XLSX.utils.aoa_to_sheet([headers, example])
  ws["!cols"] = [{ wch: 20 }, { wch: 12 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Inventario")

  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }))
}

export function parseInventarioExcelRaw(buffer: Buffer): { rows: RawInventarioRow[]; errors: string[] } {
  const wb = XLSX.read(buffer, { type: "buffer" })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" })

  const rows: RawInventarioRow[] = []
  const errors: string[] = []

  raw.forEach((row, idx) => {
    const lineNum = idx + 2
    const codigoBarras = String(row["codigo_barras"] ?? "").trim()
    const cantidad = parseFloat(row["cantidad"])

    if (!codigoBarras) { errors.push(`Fila ${lineNum}: codigo_barras es requerido`); return }
    if (isNaN(cantidad) || cantidad <= 0) { errors.push(`Fila ${lineNum}: cantidad inválida`); return }

    rows.push({
      codigo_barras: codigoBarras,
      cantidad,
    })
  })

  return { rows, errors }
}
