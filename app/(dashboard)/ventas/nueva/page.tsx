"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Plus, Minus, Trash2, Printer, FileText, ShoppingCart, User, Receipt, Warehouse, MapPin, AlertTriangle, UserPlus, Wallet, X, Landmark, Store } from "lucide-react"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import { getClientes, getAlmacenes, getLocalizaciones, getMarcas, getCategorias, buscarProductos, saveCliente, type Cliente, type Producto, type Almacen, type Localizacion, type Marca, type Categoria } from "@/lib/services/catalogos"
import { getEmprendimientos, type Emprendimiento } from "@/lib/services/emprendimientos"
import { ProductCatalog } from "./product-catalog"
import { getStockMultipleProducts } from "@/lib/services/inventario"
import { 
  getNextCorrelativo, 
  crearVenta, 
  getRazonSocialForPdf,
  type VentaEncabezado,
  type VentaDetalle,
  type PagoVentaDetalleInput,
} from "@/lib/services/ventas"
import { useTenant } from "@/lib/hooks/use-tenant"
import { getCuentas, type CuentaConfig } from "@/lib/services/cuentas"
import { useCajaSesion } from "@/lib/hooks/use-caja-sesion"

interface LineaVenta {
  producto_id: number
  producto_nombre: string
  producto_codigo: string
  cantidad: number
  precio_unitario: number
  costo_promedio: number
  subtotal: number
  utilidad_linea: number
  stock_disponible: number
}

// ── Número a letras (lempiras hondureños) ──────────────────────────────────
function numberToWordsHN(amount: number): string {
  const ones = ['','UNO','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE',
                 'DIEZ','ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISÉIS','DIECISIETE','DIECIOCHO','DIECINUEVE']
  const tens = ['','','VEINTE','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA']
  const hundreds = ['','CIEN','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS','SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS']

  function chunk(n: number): string {
    if (n === 0) return ''
    let r = ''
    if (n >= 100) {
      if (n === 100) { r += 'CIEN'; n = 0 }
      else { r += hundreds[Math.floor(n / 100)] + ' '; n %= 100 }
    }
    if (n >= 20) {
      r += tens[Math.floor(n / 10)]
      if (n % 10) r += ' Y ' + ones[n % 10]
    } else if (n > 0) {
      r += ones[n]
    }
    return r.trim()
  }

  const intPart = Math.floor(amount)
  const decPart = Math.round((amount - intPart) * 100)
  let result = ''

  if (intPart === 0) { result = 'CERO' }
  else if (intPart < 1000) { result = chunk(intPart) }
  else {
    const miles = Math.floor(intPart / 1000)
    const resto = intPart % 1000
    result = miles === 1 ? 'MIL' : chunk(miles) + ' MIL'
    if (resto > 0) result += ' ' + chunk(resto)
  }

  return `${result.trim()} CON ${decPart.toString().padStart(2, '0')}/100 LEMPIRAS`
}

// ── Impresión de recibo térmico 80 mm ─────────────────────────────────────
type RazonSocialPdf = { nombre_empresa: string; nombre_comercial: string; documento: string; direccion: string; telefono: string; correo: string } | null

// Ancho imprimible = 80mm - 6mm márgenes laterales (3mm c/lado)
const RECEIPT_WIDTH_PX = 283 // 74mm a 96 dpi
const MM_PER_PX = 25.4 / 96  // factor de conversión CSS-px → mm

function printReciboTermico(
  ventaData: { encabezado: VentaEncabezado; detalles: (VentaDetalle & { producto_nombre?: string })[] },
  cliente: { nombre?: string; rtn?: string } | undefined,
  razonSocial: RazonSocialPdf,
  pagosDetalle: { metodo_pago: string; monto_bruto: number }[],
  operador?: string
): void {
  const enc      = ventaData.encabezado
  const fechaV   = enc.fecha_venta ? new Date(enc.fecha_venta) : new Date()
  const DIAS     = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
  const MESES    = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  const fechaStr = `${DIAS[fechaV.getDay()]} ${fechaV.getDate()} de ${MESES[fechaV.getMonth()]} de ${fechaV.getFullYear()}`

  const subtotal   = enc.subtotal ?? 0
  const descPct    = enc.descuento ?? 0
  const descMonto  = subtotal * (descPct / 100)
  // La factura siempre muestra el valor que paga el cliente (bruto).
  // enc.total_venta tiene la comisión bancaria deducida — no se imprime.
  const total      = +(subtotal - descMonto).toFixed(2)
  const sumaPagos  = pagosDetalle.reduce((s, p) => s + (Number(p.monto_bruto) || 0), 0)
  const cambio     = Math.max(0, sumaPagos - total)
  const metodoPago = pagosDetalle.length > 0
    ? pagosDetalle.map(p => p.metodo_pago).join(' + ')
    : 'Efectivo'

  const lineasHtml = ventaData.detalles.map(d => {
    const nombre   = (d.producto_nombre || '').toUpperCase()
    const cant     = d.cantidad ?? 0
    const precio   = d.precio_unitario ?? 0
    const linTotal = cant * precio
    return `
      <div class="prod-name">${nombre}</div>
      <div class="prod-line">
        <span>${cant} X ${precio.toFixed(2)} &nbsp;-&nbsp; 0.00 =</span>
        <span>${linTotal.toFixed(2)}</span>
      </div>`
  }).join('<div class="line-dash"></div>')

  const empresa = (razonSocial?.nombre_empresa || 'COLMENA').toUpperCase()

  // El @page-size se inyecta dinámicamente después de medir el alto real del contenido.
  // Así el papel solo tiene el largo exacto del ticket, sin espacio en blanco final.
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style id="page-size-style">
  /* placeholder — se sobreescribe dinámicamente tras medir scrollHeight */
  @page { size: 80mm 400mm; margin: 0; }
</style>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 74mm;
    height: auto;
    margin: 0;
    padding: 2mm 3mm 4mm 3mm;
    font-family: 'Courier New', Courier, monospace;
    font-size: 10.5px;
    color: #000;
    overflow: hidden;
  }
  .emp-title  { font-size: 17px; font-weight: 900; text-align: center; letter-spacing: 1px; }
  .emp-sub    { font-size: 9.5px; text-align: center; line-height: 1.4; }
  .line-solid  { border-top: 1px solid #000; margin: 4px 0; }
  .line-dash   { border-top: 1px dashed #000; margin: 3px 0; }
  .line-double { border-top: 3px double #000; margin: 4px 0; }
  .factura-num { font-size: 13px; font-weight: 900; text-align: center; padding: 3px 0; }
  .info-row   { display: flex; justify-content: space-between; font-size: 10px; margin: 1.5px 0; gap: 4px; }
  .info-row strong { white-space: nowrap; }
  .info-row .val { text-align: right; }
  .contado    { font-size: 10px; text-align: center; margin: 2px 0; }
  .col-hdr    { display: flex; justify-content: space-between; font-size: 9px; font-weight: bold; padding: 2px 0; }
  .prod-name  { font-weight: bold; font-size: 10px; margin-top: 4px; }
  .prod-line  { display: flex; justify-content: space-between; font-size: 10px; padding-left: 8px; margin-bottom: 3px; }
  .tot-row    { display: flex; justify-content: space-between; font-size: 10.5px; margin: 2px 0; }
  .tot-final  { font-size: 14px; font-weight: 900; }
  .monto-letras { font-size: 9px; text-align: center; font-style: italic; margin: 4px 2px; }
  .firma-wrap { text-align: center; margin-top: 12px; }
  .firma-line { border-top: 1px solid #000; width: 50mm; margin: 0 auto 3px; }
  .firma-lbl  { font-size: 10px; }
  .footer     { text-align: center; font-size: 9px; margin-top: 8px; font-style: italic; }
</style>
</head>
<body>
  <div class="emp-title">${empresa}</div>
  ${razonSocial?.nombre_empresa ? `<div class="emp-sub">${razonSocial.nombre_empresa}</div>` : ''}
  ${razonSocial?.direccion ? `<div class="emp-sub">${razonSocial.direccion}</div>` : ''}
  ${razonSocial?.telefono ? `<div class="emp-sub">Tel.${razonSocial.telefono}</div>` : ''}
  ${razonSocial?.correo ? `<div class="emp-sub">Email. ${razonSocial.correo}</div>` : ''}
  ${razonSocial?.documento ? `<div class="emp-sub">RTN: ${razonSocial.documento}</div>` : ''}

  <div class="line-solid"></div>
  <div class="factura-num">ORDEN DE PEDIDO #*${enc.numero_factura}</div>
  <div class="line-solid"></div>

  <div class="info-row"><strong>FECHA:</strong><span class="val">${fechaStr}</span></div>
  <div class="info-row"><strong>CLIENTE:</strong><span class="val">${(cliente?.nombre || enc.cliente_nombre || 'CONSUMIDOR FINAL').toUpperCase()}</span></div>
  <div class="info-row"><strong>R.T.N.</strong><span class="val">${cliente?.rtn || '0000000000000'}</span></div>
  ${operador ? `<div class="info-row"><strong>ATENDIDO POR:</strong><span class="val">${operador.toUpperCase()}</span></div>` : ''}
  <div class="info-row"><strong>Forma de Pago:</strong><span class="val">${metodoPago}</span></div>
  <div class="contado">Transaccion al CONTADO</div>

  <div class="line-solid"></div>
  <div class="col-hdr"><span>Cuenta #</span><span>DESCRIPCION</span></div>
  <div class="col-hdr"><span>CANT</span><span>PRECIO UNIT</span><span>DESCTO UNIT</span><span>TOTAL</span></div>
  <div class="line-solid"></div>

  ${lineasHtml}

  <div class="line-double"></div>

  <div class="tot-row"><span>SUB TOTAL</span><span>L. &nbsp;${subtotal.toFixed(2)}</span></div>
  <div class="tot-row"><span>(-) DESCUENTOS Y REBAJAS<br><small>&nbsp;&nbsp;&nbsp;&nbsp;OTORGADOS</small></span><span>L. &nbsp;${descMonto.toFixed(2)}</span></div>

  <div class="line-solid"></div>
  <div class="tot-row tot-final"><span>TOTAL</span><span>L. &nbsp;${total.toFixed(2)}</span></div>
  <div class="line-double"></div>

  <div class="tot-row"><span>CAMBIO:</span><span>L. &nbsp;${cambio.toFixed(2)}</span></div>

  <div class="line-dash"></div>
  <div class="monto-letras">Son: ${numberToWordsHN(total)}</div>
  <div class="line-dash"></div>

  <div class="firma-wrap">
    <div class="firma-line"></div>
    <div class="firma-lbl">Aceptacion del Cliente</div>
  </div>

  <div class="line-dash"></div>
  <div class="footer">** Generado por EasyCount **</div>
</body>
</html>`

  // Iframe posicionado fuera de pantalla con ancho real (74mm) para que el
  // navegador calcule correctamente el scrollHeight del contenido.
  const iframe = document.createElement('iframe')
  iframe.style.cssText = `position:fixed;left:-400px;top:0;width:${RECEIPT_WIDTH_PX}px;height:2000px;border:0;visibility:hidden;pointer-events:none;z-index:-9999;`
  document.body.appendChild(iframe)

  const iDoc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document)
  if (!iDoc) { document.body.removeChild(iframe); return }

  iDoc.open()
  iDoc.write(html)
  iDoc.close()

  // Esperar a que el DOM renderice y luego medir la altura real del contenido.
  // Con esa medida se sobreescribe el @page size para que el papel tenga
  // exactamente el largo del ticket sin espacio en blanco al final.
  setTimeout(() => {
    const scrollH   = iDoc.body?.scrollHeight || 500
    const heightMm  = Math.ceil(scrollH * MM_PER_PX) + 4  // +4 mm de margen inferior
    const pageStyle = iDoc.getElementById('page-size-style')
    if (pageStyle) pageStyle.textContent = `@page { size: 80mm ${heightMm}mm; margin: 0; }`

    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()

    setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe) }, 3000)
  }, 700)
}

export default function NuevaVentaPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { ready, razonSocialId } = useTenant()
  
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [clientes, setClientes] = React.useState<Cliente[]>([])
  const [productos, setProductos] = React.useState<Producto[]>([])
  const [marcas, setMarcas] = React.useState<Marca[]>([])
  const [categorias, setCategorias] = React.useState<Categoria[]>([])
  const [almacenes, setAlmacenes] = React.useState<Almacen[]>([])
  const [emprendimientos, setEmprendimientos] = React.useState<Emprendimiento[]>([])
  const [emprendimientoFiltro, setEmprendimientoFiltro] = React.useState<string>("todos")
  const [localizaciones, setLocalizaciones] = React.useState<Localizacion[]>([])
  const [localizacionesFiltradas, setLocalizacionesFiltradas] = React.useState<Localizacion[]>([])
  
  const [clienteId, setClienteId] = React.useState<string>("")
  const [numeroFactura, setNumeroFactura] = React.useState("")
  const [fecha, setFecha] = React.useState(new Date().toISOString().split("T")[0])
  const [aplicaIsv, setAplicaIsv] = React.useState(true)
  const [almacenId, setAlmacenId] = React.useState<string>("")
  const [localizacionId, setLocalizacionId] = React.useState<string>("")
  const [descuentoPct, setDescuentoPct] = React.useState<number>(0)

  // Desglose multi-metodo de pago. Cada linea representa un instrumento
  // de pago distinto (Efectivo, Banco, Link de Pago, Credito). La suma de
  // `monto_bruto` define el `valorpago` y, derivado, el `estado_pago`:
  //   suma === 0       -> Pendiente
  //   suma >= total    -> Pagado
  //   0 < suma < total -> Parcial
  // Se permite explicitamente que la suma sea < total: el saldo restante
  // queda como cuenta por cobrar (CXC).
  type PagoLinea = PagoVentaDetalleInput & { _id: string }
  const [pagosDetalle, setPagosDetalle] = React.useState<PagoLinea[]>([])
  const [cuentas, setCuentas] = React.useState<CuentaConfig[]>([])
  const { sesion: cajaSesion, featurePending: cajaFeaturePending } = useCajaSesion()
  
  const [lineas, setLineas] = React.useState<LineaVenta[]>([])

  const [stockPorLocalizacion, setStockPorLocalizacion] = React.useState<Record<number, number>>({})
  const [loadingStock, setLoadingStock] = React.useState(false)
  // Stock de TODO el catalogo en la localizacion seleccionada. Se usa para
  // filtrar el catalogo y mostrar solo referencias disponibles (stock > 0)
  // con su cantidad exacta en esa localizacion. Vacio = sin localizacion.
  const [stockCatalogo, setStockCatalogo] = React.useState<Record<number, number>>({})
  const [loadingCatalogo, setLoadingCatalogo] = React.useState(false)
  
  const [lastVenta, setLastVenta] = React.useState<{
    encabezado: VentaEncabezado
    detalles: VentaDetalle[]
  } | null>(null)
  const [showPdfDialog, setShowPdfDialog] = React.useState(false)
  const [pdfBlobUrl, setPdfBlobUrl] = React.useState<string | null>(null)
  
  // Quick client creation
  const [showClienteDialog, setShowClienteDialog] = React.useState(false)
  const [savingCliente, setSavingCliente] = React.useState(false)
  const [nuevoCliente, setNuevoCliente] = React.useState<Partial<Cliente>>({
    nombre: "",
    rtn: "",
    direccion: "",
    telefono: "",
    fecha_nacimiento: "",
  })

  React.useEffect(() => {
    if (!ready) {
      console.log("[v0][NuevaVenta] esperando sesion...")
      return
    }
    if (razonSocialId == null) {
      console.log("[v0][NuevaVenta] usuario sin razon_social_id; mostrando formulario vacio")
      setLoading(false)
      return
    }
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, razonSocialId])

  async function loadData() {
    setLoading(true)
    try {
      console.log("[v0][NuevaVenta] cargando datos...")
      const [clientesRes, productosRes, almacenesRes, localizacionesRes, correlativo, cuentasRes, marcasRes, categoriasRes, empsData] = await Promise.all([
        getClientes(),
        buscarProductos('', { limit: 100 }),
        getAlmacenes(),
        getLocalizaciones(),
        getNextCorrelativo(),
        getCuentas(),
        getMarcas(),
        getCategorias(),
        getEmprendimientos(razonSocialId!),
      ])

      console.log("[v0][NuevaVenta] datos recibidos:", {
        clientes: clientesRes.data?.length,
        productos: productosRes.data?.length,
        almacenes: almacenesRes.data?.length,
        localizaciones: localizacionesRes.data?.length,
        correlativo,
        errores: {
          clientes: clientesRes.error,
          productos: productosRes.error,
          almacenes: almacenesRes.error,
          localizaciones: localizacionesRes.error,
        },
      })
      
      setClientes(clientesRes.data || [])
      setProductos(productosRes.data || [])
      setMarcas(marcasRes.data || [])
      setCategorias(categoriasRes.data || [])
      setAlmacenes(almacenesRes.data || [])
      setEmprendimientos(empsData.filter((e) => e.activo !== false))
      setLocalizaciones(localizacionesRes.data || [])
      setNumeroFactura(correlativo)
      // Solo cuentas activas se ofrecen para nuevos pagos. Si la migracion 011
      // aun no se aplico, cuentasRes.data viene vacio y el desglose ofrecera
      // solo Efectivo / Credito (modo degradado).
      setCuentas((cuentasRes.data || []).filter((c) => c.activo ?? true))
      
      // Set default almacen if only one exists
      if (almacenesRes.data && almacenesRes.data.length === 1) {
        const defaultAlmacenId = String(almacenesRes.data[0].id)
        setAlmacenId(defaultAlmacenId)
        const filtradas = (localizacionesRes.data || []).filter(l => l.almacen_id === almacenesRes.data[0].id)
        setLocalizacionesFiltradas(filtradas)
        if (filtradas.length === 1) {
          const defaultLocId = filtradas[0].id!
          setLocalizacionId(String(defaultLocId))
          // Auto-selected location: fetch stock catalog using fresh product data
          // (can't use `productos` state yet — React state updates are async)
          const prodIds = (productosRes.data || []).map((p: any) => p.id!).filter(Boolean)
          if (prodIds.length > 0) {
            setLoadingCatalogo(true)
            getStockMultipleProducts(prodIds, defaultLocId)
              .then(({ data: stockMap }) => setStockCatalogo(stockMap || {}))
              .catch(() => setStockCatalogo({}))
              .finally(() => setLoadingCatalogo(false))
          }
        }
      }
    } catch (err: any) {
      console.log("[v0][NuevaVenta] excepcion cargando datos:", err)
      toast({
        title: "No se pudieron cargar los datos",
        description: err?.message || "Error de conexion",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  function handleAlmacenChange(newAlmacenId: string) {
    setAlmacenId(newAlmacenId)
    setLocalizacionId("")
    setStockPorLocalizacion({})
    setStockCatalogo({})
    // Reset stock disponible in lineas
    setLineas(prev => prev.map(l => ({ ...l, stock_disponible: 0 })))
    const filtradas = localizaciones.filter(l => l.almacen_id === Number(newAlmacenId))
    setLocalizacionesFiltradas(filtradas)
    // Auto-select if only one localization
    if (filtradas.length === 1) {
      const locId = String(filtradas[0].id)
      setLocalizacionId(locId)
      // Fetch stock for this localization
      fetchStockForLineas(Number(locId))
      fetchStockCatalogo(Number(locId))
    }
  }

  async function handleLocalizacionChange(newLocalizacionId: string) {
    setLocalizacionId(newLocalizacionId)
    if (newLocalizacionId) {
      await Promise.all([
        fetchStockForLineas(Number(newLocalizacionId)),
        fetchStockCatalogo(Number(newLocalizacionId)),
      ])
    } else {
      setStockPorLocalizacion({})
      setStockCatalogo({})
      setLineas(prev => prev.map(l => ({ ...l, stock_disponible: 0 })))
    }
  }

  /**
   * Carga el stock de TODOS los productos del catalogo en una localizacion.
   * El catalogo usara este mapa para mostrar unicamente las referencias con
   * existencias (> 0) y su cantidad real en esa localizacion.
   */
  async function fetchStockCatalogo(locId: number) {
    if (productos.length === 0) return
    setLoadingCatalogo(true)
    try {
      const productoIds = productos.map(p => p.id!).filter(Boolean)
      const { data: stockMap } = await getStockMultipleProducts(productoIds, locId)
      setStockCatalogo(stockMap || {})
    } catch (err) {
      console.error('[v0] Error cargando stock del catalogo:', err)
      setStockCatalogo({})
    } finally {
      setLoadingCatalogo(false)
    }
  }

  async function fetchStockForLineas(locId: number) {
    if (lineas.length === 0) return
    
    setLoadingStock(true)
    const productoIds = lineas.map(l => l.producto_id)
    const { data: stockMap } = await getStockMultipleProducts(productoIds, locId)
    setStockPorLocalizacion(stockMap)
    
    // Update lineas with stock disponible
    setLineas(prev => prev.map(l => ({
      ...l,
      stock_disponible: stockMap[l.producto_id] || 0
    })))
    setLoadingStock(false)
  }

  function calculateUtilidadLinea(cantidad: number, precio: number, costo: number): number {
    return (precio - costo) * cantidad
  }

  async function addProducto(producto: Producto) {
    const existing = lineas.findIndex(l => l.producto_id === producto.id)
    if (existing >= 0) {
      updateCantidad(existing, 1)
    } else {
      // Get stock for this product in selected localization
      let stockDisponible = stockPorLocalizacion[producto.id!] || 0
      
      if (localizacionId && !stockPorLocalizacion[producto.id!]) {
        const { data: stockMap } = await getStockMultipleProducts([producto.id!], Number(localizacionId))
        stockDisponible = stockMap[producto.id!] || 0
        setStockPorLocalizacion(prev => ({ ...prev, [producto.id!]: stockDisponible }))
      }
      
      setLineas(prev => [...prev, {
        producto_id: producto.id!,
        producto_nombre: producto.nombre,
        producto_codigo: producto.codigo_barras,
        cantidad: 1,
        precio_unitario: producto.precio_venta_sugerido,
        costo_promedio: producto.costo_promedio || 0,
        subtotal: producto.precio_venta_sugerido,
        utilidad_linea: calculateUtilidadLinea(1, producto.precio_venta_sugerido, producto.costo_promedio || 0),
        stock_disponible: stockDisponible
      }])
    }
  }

  function updateCantidad(index: number, delta: number) {
    setLineas(lineas.map((l, i) => {
      if (i === index) {
        const newCantidad = Math.max(1, l.cantidad + delta)
        const newSubtotal = newCantidad * l.precio_unitario
        const newUtilidad = calculateUtilidadLinea(newCantidad, l.precio_unitario, l.costo_promedio)
        return { ...l, cantidad: newCantidad, subtotal: newSubtotal, utilidad_linea: newUtilidad }
      }
      return l
    }))
  }

  function updatePrecio(index: number, precio: number) {
    setLineas(lineas.map((l, i) => {
      if (i === index) {
        const newSubtotal = l.cantidad * precio
        const newUtilidad = calculateUtilidadLinea(l.cantidad, precio, l.costo_promedio)
        return { ...l, precio_unitario: precio, subtotal: newSubtotal, utilidad_linea: newUtilidad }
      }
      return l
    }))
  }

  function removeLinea(index: number) {
    setLineas(lineas.filter((_, i) => i !== index))
  }

  // ---------- Handlers del Desglose de Pago -------------------------------
  // Generamos un id local con crypto.randomUUID() (fallback a Math.random
  // por si el navegador es muy viejo). Sirve solo para keys de React; no
  // se persiste.
  function nextPagoId() {
    return typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `p_${Math.random().toString(36).slice(2, 10)}`
  }

  function agregarPagoLinea() {
    // Default Banco si hay cuentas configuradas; sino Efectivo (si la caja
    // esta abierta o la migracion esta pendiente). Como ultimo recurso, Otro.
    let metodo: PagoVentaDetalleInput["metodo_pago"] = "Otro"
    let cuentaIdDefault: number | null = null
    let comisionDefault = 0
    if (cuentas.length > 0) {
      metodo = "Banco"
      cuentaIdDefault = cuentas[0].id ?? null
      comisionDefault = cuentas[0].porcentaje_comision ?? 0
    } else if (cajaFeaturePending || cajaSesion) {
      metodo = "Efectivo"
    }
    // Pre-completar con el saldo restante para acelerar el flujo comun
    // de "un solo metodo cubre todo el total".
    const sumaActual = pagosDetalle.reduce(
      (acc, p) => acc + (Number(p.monto_bruto) || 0),
      0
    )
    const sugerido = Math.max(0, +(total - sumaActual).toFixed(2))
    setPagosDetalle((prev) => [
      ...prev,
      {
        _id: nextPagoId(),
        metodo_pago: metodo,
        cuenta_id: cuentaIdDefault,
        porcentaje_comision: comisionDefault,
        monto_bruto: sugerido,
      },
    ])
  }

  function actualizarPagoLinea(
    id: string,
    patch: Partial<Omit<PagoVentaDetalleInput, never>>
  ) {
    setPagosDetalle((prev) =>
      prev.map((p) => (p._id === id ? { ...p, ...patch } : p))
    )
  }

  function eliminarPagoLinea(id: string) {
    setPagosDetalle((prev) => prev.filter((p) => p._id !== id))
  }

  async function handleCreateCliente() {
    if (!nuevoCliente.nombre?.trim()) {
      toast({ title: "Error", description: "El nombre del cliente es requerido", variant: "destructive" })
      return
    }
    
    setSavingCliente(true)
    try {
      const { data, error } = await saveCliente(nuevoCliente as Cliente, true)
      
      if (error) {
        toast({ title: "Error", description: error, variant: "destructive" })
        return
      }
      
      if (data) {
        // Add to local list and select it
        setClientes(prev => [...prev, data])
        setClienteId(String(data.id))
        
        toast({ title: "Cliente creado", description: `${data.nombre} agregado correctamente` })
        
        // Reset form and close dialog
        setNuevoCliente({
          nombre: "",
          rtn: "",
          direccion: "",
          telefono: "",
          fecha_nacimiento: "",
        })
        setShowClienteDialog(false)
      }
    } catch (err) {
      toast({ title: "Error", description: "Error al crear el cliente", variant: "destructive" })
    } finally {
      setSavingCliente(false)
    }
  }

  const subtotal = lineas.reduce((acc, l) => acc + l.subtotal, 0)
  // Normalizamos el descuento a un rango seguro [0, 100].
  const descuentoPctSafe = Math.min(100, Math.max(0, Number.isFinite(descuentoPct) ? descuentoPct : 0))
  const montoDescuento = subtotal * (descuentoPctSafe / 100)
  const subtotalNeto = subtotal - montoDescuento
  // ISV INCLUIDO en precio: se extrae del precio (no se suma encima).
  // El precio de venta ya contiene el 15%; isv = subtotalNeto * 0.15/1.15.
  const isv = aplicaIsv ? subtotalNeto * (0.15 / 1.15) : 0
  // `total` = lo que paga el cliente (= subtotalNeto, el ISV ya está incluido).
  const total = subtotalNeto
  const totalItems = lineas.reduce((acc, l) => acc + l.cantidad, 0)

  // --- Comisiones bancarias y total NETO -----------------------------------
  // Cuando una linea de pago tiene `porcentaje_comision` > 0 (tarjetas,
  // link de pago, etc.), el banco retiene esa comision: el cliente paga el
  // bruto pero al comercio le llega el neto. Sumamos todas las comisiones
  // del desglose para mostrarlas como linea separada en los totales y para
  // calcular `totalNeto`, que es:
  //   - el valor que ve el usuario como "Total" (lo que efectivamente
  //     recibira el comercio)
  //   - lo que se persiste en `ventas_encabezado.total_venta`
  // Para registros sin comision (efectivo, otros), `totalComisiones = 0`
  // y `totalNeto === total`, asi el comportamiento legacy se conserva.
  const totalComisiones = pagosDetalle.reduce((acc, p) => {
    const monto = Number(p.monto_bruto || 0)
    const comisionPct = Number(p.porcentaje_comision ?? 0)
    if (monto <= 0 || comisionPct <= 0) return acc
    return acc + monto * (comisionPct / 100)
  }, 0)
  const totalComisionesR = +totalComisiones.toFixed(2)
  const totalNeto = +(total - totalComisionesR).toFixed(2)
  // Suma de lo que efectivamente netea el comercio (monto_bruto * (1 - c%)).
  // Se usa para derivar `valorpago`/`estado_pago` contra `totalNeto`.
  const sumaPagosNeto = pagosDetalle.reduce((acc, p) => {
    const monto = Number(p.monto_bruto || 0)
    const comisionPct = Number(p.porcentaje_comision ?? 0)
    return acc + monto * (1 - comisionPct / 100)
  }, 0)
  const sumaPagosNetoR = +sumaPagosNeto.toFixed(2)

  // --- Auto-sincronizacion del desglose de pago con el total ---------------
  // Cuando el usuario activa/desactiva ISV o cambia el porcentaje de
  // descuento, el `total` se recalcula automaticamente. Sin embargo,
  // los `monto_bruto` de cada linea de `pagosDetalle` son estaticos:
  // se setean al agregar la linea y no se reajustan solos. Para evitar
  // que el desglose quede desfasado (sobrepago o pago insuficiente),
  // detectamos cualquier cambio en `total` y aplicamos el delta a la
  // ULTIMA linea de pago, que es la que el flujo "agregar pago" pre-
  // completa con el residuo. Asi el sumatorio del desglose siempre
  // coincide con el total mostrado.
  //
  // Si el usuario edito manualmente los pagos, el cambio se aplica solo
  // sobre la ultima linea (clamp a 0) para no destruir su intencion en
  // las anteriores.
  const prevTotalRef = React.useRef(total)
  React.useEffect(() => {
    const prev = prevTotalRef.current
    if (prev === total) return
    const delta = +(total - prev).toFixed(2)
    prevTotalRef.current = total
    if (delta === 0) return
    setPagosDetalle((arr) => {
      if (arr.length === 0) return arr
      const last = arr[arr.length - 1]
      const montoActual = Number(last.monto_bruto) || 0
      const nuevoMonto = Math.max(0, +(montoActual + delta).toFixed(2))
      if (nuevoMonto === montoActual) return arr
      return [
        ...arr.slice(0, -1),
        { ...last, monto_bruto: nuevoMonto },
      ]
    })
  }, [total])

  // Filtro cliente del catálogo sobre la carga inicial (100 items, siempre rápido)
  const productosFiltrados = React.useMemo(() => {
    if (emprendimientoFiltro === "todos") return productos
    if (emprendimientoFiltro === "tienda") return productos.filter((p) => !p.emprendimiento_id)
    return productos.filter((p) => String(p.emprendimiento_id) === emprendimientoFiltro)
  }, [productos, emprendimientoFiltro])

  // Búsqueda server-side para el catálogo (soporta 6000+ artículos)
  const buscarFnCatalogo = React.useCallback(
    async (q: string, catId: string, marcaId: string): Promise<Producto[]> => {
      const opts: Parameters<typeof buscarProductos>[1] = { limit: 80 }
      if (catId && catId !== "__todos__") opts!.categoriaId = parseInt(catId)
      if (marcaId && marcaId !== "__todos__") opts!.marcaId = parseInt(marcaId)
      if (emprendimientoFiltro === "tienda") opts!.soloTiendaPropia = true
      else if (emprendimientoFiltro !== "todos") opts!.emprendimientoId = parseInt(emprendimientoFiltro)
      const { data } = await buscarProductos(q, opts)
      return data || []
    },
    [emprendimientoFiltro]
  )

  const selectedCliente = clientes.find(c => c.id?.toString() === clienteId)

  // Stock validation
  const lineasConStockInsuficiente = lineas.filter(l => l.cantidad > l.stock_disponible)
  const hayStockInsuficiente = lineasConStockInsuficiente.length > 0 && localizacionId !== ""
  const lineasQueAgotan = lineas.filter(l => l.stock_disponible > 0 && l.cantidad === l.stock_disponible)

  async function handleSubmit() {
    if (!clienteId) {
      toast({ title: "Error", description: "Seleccione un cliente", variant: "destructive" })
      return
    }
    if (!almacenId) {
      toast({ title: "Error", description: "Seleccione un almacen", variant: "destructive" })
      return
    }
    if (!localizacionId) {
      toast({ title: "Error", description: "Seleccione una localizacion", variant: "destructive" })
      return
    }
    if (lineas.length === 0) {
      toast({ title: "Error", description: "Agregue al menos un producto", variant: "destructive" })
      return
    }

    // ----- Validacion del Desglose de Pago -------------------------------
    // Reglas:
    //  - Cada linea debe tener monto_bruto > 0.
    //  - Lineas Banco / Link_Pago requieren cuenta_id.
    //  - La suma de monto_bruto NO puede exceder el total de la venta
    //    (sobrepago no permitido). Puede ser menor: el saldo restante
    //    queda como cuenta por cobrar.
    //  - Si hay efectivo en el desglose y la sesion de Caja Chica no
    //    esta abierta, bloqueamos. Si la migracion 011 aun no se aplico
    //    (cajaFeaturePending=true), permitimos seguir en modo degradado.
    const sumaPagos = pagosDetalle.reduce((acc, p) => acc + (Number(p.monto_bruto) || 0), 0)
    const sumaPagosRound = +sumaPagos.toFixed(2)

    for (const p of pagosDetalle) {
      if (!(Number(p.monto_bruto) > 0)) {
        toast({
          title: "Pago invalido",
          description: "Cada linea de pago debe tener un monto mayor a 0",
          variant: "destructive",
        })
        return
      }
      if ((p.metodo_pago === "Banco" || p.metodo_pago === "Link_Pago") && !p.cuenta_id) {
        toast({
          title: "Cuenta requerida",
          description: `Seleccione la cuenta para el pago de tipo ${p.metodo_pago === "Link_Pago" ? "Link de Pago" : "Banco"}`,
          variant: "destructive",
        })
        return
      }
    }

    if (sumaPagosRound > +total.toFixed(2)) {
      toast({
        title: "Sobrepago no permitido",
        description: `La suma de pagos (L ${sumaPagosRound.toFixed(2)}) excede el total de la venta (L ${total.toFixed(2)})`,
        variant: "destructive",
      })
      return
    }

    const tieneEfectivo = pagosDetalle.some(
      (p) => p.metodo_pago === "Efectivo" && Number(p.monto_bruto) > 0
    )
    if (tieneEfectivo && !cajaFeaturePending && !cajaSesion) {
      toast({
        title: "Caja Chica cerrada",
        description: "No hay sesion de Caja Chica abierta. Imposible registrar pagos en efectivo.",
        variant: "destructive",
      })
      return
    }

    // Derivamos `valorpago` y `estado_pago` desde el NETO (lo que netea
    // el comercio). `total_venta` tambien se persiste como neto. Asi el
    // estado_pago refleja la cobertura real del valor recibido vs el
    // valor registrado de la venta. Para pagos sin comision (efectivo),
    // monto_neto === monto_bruto y el resultado es identico al legacy.
    const valorpago = sumaPagosNetoR
    const estadoPago: "Pendiente" | "Parcial" | "Pagado" =
      valorpago <= 0
        ? "Pendiente"
        : valorpago >= totalNeto - 0.005
          ? "Pagado"
          : "Parcial"

    setSaving(true)
    try {
      const encabezado = {
        numero_factura: numeroFactura,
        cliente_id: parseInt(clienteId),
        // fecha_venta defaults to now() in database
        aplica_impuesto: aplicaIsv,
        porcentaje_impuesto: 15,
        descuento: descuentoPctSafe,
        subtotal,
        impuesto_total: isv,
        // Persistimos el NETO: lo que efectivamente recibe el comercio
        // despues de comisiones bancarias del desglose de pagos. Asi los
        // reportes financieros (utilidad, cierre diario, etc.) reflejan
        // el ingreso real, no el cobro bruto al cliente.
        total_venta: totalNeto,
        estado_pago: estadoPago,
        valorpago,
      }

      const detalles = lineas.map(l => ({
        producto_id: l.producto_id,
        cantidad: l.cantidad,
        precio_unitario: l.precio_unitario,
        costo_promedio_momento: l.costo_promedio,
        utilidad_linea: l.utilidad_linea
      }))

      const { data, error } = await crearVenta({
        encabezado,
        detalles,
        almacen_id: parseInt(almacenId),
        localizacion_id: parseInt(localizacionId),
        // Convertimos las lineas locales (con _id) al payload del servicio.
        pagos_detalle: pagosDetalle.map(({ _id: _omit, ...rest }) => rest),
      })

      if (error) {
        toast({ title: "Error", description: error, variant: "destructive" })
        return
      }

      toast({ title: "Venta creada", description: `Factura ${numeroFactura} generada correctamente` })
      
      const ventaData = {
        encabezado: { 
          ...encabezado, 
          id: data?.id,
          cliente_nombre: selectedCliente?.nombre || "",
          fecha_venta: new Date().toISOString()
        },
        detalles: lineas.map((l, i) => ({ 
          id: i + 1, 
          venta_id: data?.id || 0,
          producto_id: l.producto_id,
          producto_nombre: l.producto_nombre,
          producto_codigo: l.producto_codigo,
          cantidad: l.cantidad,
          precio_unitario: l.precio_unitario,
          costo_promedio_momento: l.costo_promedio,
          utilidad_linea: l.utilidad_linea
        }))
      }
      
      setLastVenta(ventaData)
      
      // Generar PDF A4 (guarda blob para descarga manual) e imprimir recibo térmico
      await generatePdfFromData(ventaData, selectedCliente)
      
      setShowPdfDialog(true)
    } catch (err) {
      toast({ title: "Error", description: "Error al guardar la venta", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function generatePdfFromData(
    ventaData: { encabezado: VentaEncabezado; detalles: VentaDetalle[] },
    cliente: Cliente | undefined
  ) {
    const razonSocial = await getRazonSocialForPdf()
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    
    // Light gray background
    doc.setFillColor(245, 245, 245)
    doc.rect(0, 0, pageWidth, pageHeight, 'F')
    
    // === LOGO - Top Left ===
    try {
      const logoUrl = razonSocial?.logo_url || ''
      if (!logoUrl) throw new Error("no-logo")
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = logoUrl
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        setTimeout(resolve, 1000) // Fallback timeout
      })
      if (img.complete && img.naturalWidth > 0) {
        doc.addImage(img, 'PNG', 20, 12, 50, 12)
      }
    } catch {
      // If logo fails, just show company name as fallback
      doc.setTextColor(30, 30, 30)
      doc.setFontSize(14)
      doc.setFont("helvetica", "bold")
      doc.text(razonSocial?.nombre_empresa || "Mi Empresa", 20, 20)
    }
    
    // Contact details - left column
    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    let contactY = 32
    
    doc.setFont("helvetica", "normal")
    doc.text("Correo", 20, contactY)
    doc.text("Telefono", 20, contactY + 8)
    doc.text("Direccion", 20, contactY + 16)
    
    doc.setTextColor(30, 30, 30)
    doc.text(razonSocial?.correo || "", 20, contactY + 4)
    doc.text(razonSocial?.telefono || "", 20, contactY + 12)
    doc.text((razonSocial?.direccion || "").substring(0, 35), 20, contactY + 20)
    
    // Contact details - right column  
    doc.setTextColor(100, 100, 100)
    doc.text("RTN", 80, contactY)
    doc.setTextColor(30, 30, 30)
    doc.text(razonSocial?.documento || "N/A", 80, contactY + 4)
    
    // === RIGHT SIDE: FACTURA Title ===
    doc.setTextColor(30, 30, 30)
    doc.setFontSize(28)
    doc.setFont("helvetica", "bold")
    doc.text("FACTURA", pageWidth - 20, 28, { align: "right" })
    
    // Invoice Number
    doc.setFontSize(12)
    doc.setFont("helvetica", "normal")
    doc.text(`#${ventaData.encabezado.numero_factura}`, pageWidth - 20, 38, { align: "right" })
    
    // === CLIENTE Section ===
    const clienteY = 85
    
    // Divider line
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.5)
    doc.line(20, clienteY - 5, pageWidth - 20, clienteY - 5)
    
    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    doc.text("Cliente", 20, clienteY)
    doc.text("RTN Cliente", 80, clienteY)
    doc.text("Fecha", pageWidth - 60, clienteY)
    
    doc.setTextColor(30, 30, 30)
    doc.setFont("helvetica", "normal")
    doc.text(cliente?.nombre || ventaData.encabezado.cliente_nombre || "N/A", 20, clienteY + 6)
    doc.text(cliente?.rtn || "N/A", 80, clienteY + 6)
    doc.text(ventaData.encabezado.fecha_venta?.split('T')[0] || new Date().toISOString().split('T')[0], pageWidth - 60, clienteY + 6)
    
    // === DESCRIPCION Header ===
    const descY = 110
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(30, 30, 30)
    doc.text("Descripcion", 20, descY)
    
    // Line under description
    doc.setDrawColor(30, 30, 30)
    doc.setLineWidth(0.8)
    doc.line(20, descY + 3, pageWidth - 20, descY + 3)
    
    // === ITEMS List ===
    let itemY = descY + 18
    const lineSubtotal = (cantidad: number, precio: number) => cantidad * precio
    
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    
    ventaData.detalles.forEach((d, index) => {
      const subtotal = lineSubtotal(d.cantidad ?? 0, d.precio_unitario ?? 0)
      
      // Item name with quantity
      doc.setTextColor(30, 30, 30)
      doc.text(`${d.producto_nombre || ""} (x${d.cantidad})`, 20, itemY)
      
      // Price aligned right
      doc.text(`L ${subtotal.toFixed(2)}`, pageWidth - 20, itemY, { align: "right" })
      
      // Dotted line
      doc.setDrawColor(180, 180, 180)
      doc.setLineDashPattern([1, 1], 0)
      doc.line(20, itemY + 4, pageWidth - 20, itemY + 4)
      doc.setLineDashPattern([], 0)
      
      itemY += 12
    })
    
    // === TOTALS Section ===
    const totalsY = Math.max(itemY + 15, 180)
    
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(100, 100, 100)
    
    // Subtotal
    doc.text("Subtotal", pageWidth - 80, totalsY)
    doc.setTextColor(30, 30, 30)
    doc.text(`L ${(ventaData.encabezado.subtotal ?? 0).toFixed(2)}`, pageWidth - 20, totalsY, { align: "right" })
    
    // Dotted line
    doc.setDrawColor(180, 180, 180)
    doc.setLineDashPattern([1, 1], 0)
    doc.line(pageWidth - 80, totalsY + 3, pageWidth - 20, totalsY + 3)
    doc.setLineDashPattern([], 0)
    
    // Descuento (opcional): solo se imprime si hay porcentaje > 0
    const descuentoPctPdf = Number(ventaData.encabezado.descuento ?? 0)
    const hasDescuento = descuentoPctPdf > 0
    const descuentoMonto = (ventaData.encabezado.subtotal ?? 0) * (descuentoPctPdf / 100)
    // Total bruto que paga el cliente (sin deducir comisiones bancarias).
    // enc.total_venta almacena el neto tras comisiones — no se imprime en factura.
    const totalFactura = +((ventaData.encabezado.subtotal ?? 0) - descuentoMonto).toFixed(2)
    let rowOffset = 12
    if (hasDescuento) {
      doc.setTextColor(100, 100, 100)
      doc.setFont("helvetica", "normal")
      const pctLabel = descuentoPctPdf % 1 === 0
        ? `${descuentoPctPdf.toFixed(0)}%`
        : `${descuentoPctPdf.toFixed(2)}%`
      doc.text(`Descuento (${pctLabel})`, pageWidth - 80, totalsY + rowOffset)
      doc.setTextColor(30, 30, 30)
      doc.text(`- L ${descuentoMonto.toFixed(2)}`, pageWidth - 20, totalsY + rowOffset, { align: "right" })
      // Dotted line
      doc.setDrawColor(180, 180, 180)
      doc.setLineDashPattern([1, 1], 0)
      doc.line(pageWidth - 80, totalsY + rowOffset + 3, pageWidth - 20, totalsY + rowOffset + 3)
      doc.setLineDashPattern([], 0)
      rowOffset += 12
    }

    // ISV
    doc.setTextColor(100, 100, 100)
    doc.setFont("helvetica", "normal")
    doc.text(`ISV incluido (${ventaData.encabezado.porcentaje_impuesto || 15}%)`, pageWidth - 80, totalsY + rowOffset)
    doc.setTextColor(30, 30, 30)
    doc.text(`L ${(ventaData.encabezado.impuesto_total ?? 0).toFixed(2)}`, pageWidth - 20, totalsY + rowOffset, { align: "right" })

    // Dotted line
    doc.setDrawColor(180, 180, 180)
    doc.setLineDashPattern([1, 1], 0)
    doc.line(pageWidth - 80, totalsY + rowOffset + 3, pageWidth - 20, totalsY + rowOffset + 3)
    doc.setLineDashPattern([], 0)

    // Total (valor bruto que pagó el cliente)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(30, 30, 30)
    doc.text("Total", pageWidth - 80, totalsY + rowOffset + 14)
    doc.setFontSize(12)
    doc.text(`L ${totalFactura.toFixed(2)}`, pageWidth - 20, totalsY + rowOffset + 14, { align: "right" })
    
    // === FOOTER Section ===
    const footerY = pageHeight - 40
    
    // Divider line
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.5)
    doc.setLineDashPattern([], 0)
    doc.line(20, footerY - 10, pageWidth - 20, footerY - 10)
    
    // Bank Details (left)
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(30, 30, 30)
    doc.text("Detalles de Pago", 20, footerY)
    
    doc.setFont("helvetica", "normal")
    doc.setTextColor(100, 100, 100)
    doc.setFontSize(8)
    doc.text(`RTN: ${razonSocial?.documento || "N/A"}`, 20, footerY + 8)
    doc.text(`Tel: ${razonSocial?.telefono || "N/A"}`, 20, footerY + 14)
    
    // Terms (right)
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(30, 30, 30)
    doc.text("Condiciones", 110, footerY)
    
    doc.setFont("helvetica", "normal")
    doc.setTextColor(100, 100, 100)
    doc.setFontSize(8)
    doc.text("Gracias por su compra. Este documento", 110, footerY + 8)
    doc.text("es valido como comprobante fiscal.", 110, footerY + 14)

    // Watermark EasyCount
    doc.setFontSize(7)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(168, 162, 158)
    doc.text("Generado por EasyCount", pageWidth / 2, pageHeight - 8, { align: "center" })

    // Guardar blob del PDF A4 en estado (sin descarga automática)
    try {
      const pdfBlob = doc.output('blob')
      const blobUrl = URL.createObjectURL(pdfBlob)
      setPdfBlobUrl(blobUrl)
    } catch {
      // Si falla la generación A4, continuamos igual con el recibo
    }

    // Imprimir recibo térmico 80 mm directamente
    printReciboTermico(
      ventaData,
      cliente,
      razonSocial,
      pagosDetalle.map(({ _id: _omit, ...rest }) => rest)
    )
  }

  // Limpia completamente el formulario y obtiene un nuevo correlativo + datos
  // frescos de catalogos. Se llama siempre que el usuario sale del dialog de
  // factura generada (boton "Nueva Venta" o al cerrar el dialog con X).
  function resetForm() {
    setLineas([])
    setClienteId("")
    setPagosDetalle([])
    setDescuentoPct(0)
    setFecha(new Date().toISOString().split("T")[0])
    setStockPorLocalizacion({})
    setLastVenta(null)
    if (pdfBlobUrl) { URL.revokeObjectURL(pdfBlobUrl); setPdfBlobUrl(null) }
    // Recarga el correlativo y los catalogos para reflejar altas recientes
    // (nuevos clientes, productos, correlativo incrementado).
    loadData()
  }

  async function generatePdf() {
    if (!lastVenta) return
    // Si ya hay un blob guardado, descargarlo directamente
    if (pdfBlobUrl) {
      const link = document.createElement('a')
      link.href = pdfBlobUrl
      link.download = `Factura_${lastVenta.encabezado.numero_factura}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } else {
      // Fallback: regenerar el PDF A4 (por si el blob expiró)
      await generatePdfFromData(lastVenta, selectedCliente)
    }
    setShowPdfDialog(false)
    resetForm()
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col lg:flex-row">
        <div className="flex-1 p-4 md:p-6">
          <Skeleton className="h-10 w-full mb-4" />
          <Skeleton className="h-64 md:h-[calc(100%-6rem)] w-full" />
        </div>
        <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l p-4 md:p-6">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)] lg:overflow-hidden flex flex-col lg:flex-row bg-muted/30">
      {/* Main Content - Products */}
      <div className="flex-1 flex flex-col p-3 md:p-4 lg:min-h-0 lg:overflow-hidden">
        {/* Header with Warehouse Selection */}
        <div className="space-y-3 mb-4">
          {/* Row 1: Invoice info */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 md:gap-4">
              <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 md:px-4 py-1.5 md:py-2 rounded-lg">
                <Receipt className="h-4 w-4 md:h-5 md:w-5" />
                <span className="font-mono font-bold text-base md:text-lg">{numeroFactura}</span>
              </div>
              <Input 
                type="date" 
                value={fecha} 
                onChange={(e) => setFecha(e.target.value)} 
                className="w-36 md:w-40 bg-background text-sm"
              />
            </div>
          </div>
          
          {/* Row 2: Warehouse + Emprendimiento Selection */}
          <Card className="bg-amber-50/50 border-amber-200">
            <CardContent className="p-3 md:p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs uppercase tracking-wide text-amber-800 mb-1.5 flex items-center gap-1.5">
                    <Warehouse className="h-3.5 w-3.5" />
                    Almacen de Despacho
                  </Label>
                  <Select value={almacenId} onValueChange={handleAlmacenChange}>
                    <SelectTrigger className="h-10 bg-white border-amber-200">
                      <SelectValue placeholder="Seleccionar almacen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {almacenes.map(a => (
                        <SelectItem key={a.id} value={a.id!.toString()}>
                          {a.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs uppercase tracking-wide text-amber-800 mb-1.5 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    Localizacion
                  </Label>
                  <Select
                    value={localizacionId}
                    onValueChange={handleLocalizacionChange}
                    disabled={!almacenId}
                  >
                    <SelectTrigger className="h-10 bg-white border-amber-200">
                      <SelectValue placeholder={almacenId ? "Seleccionar..." : "Seleccione almacen"} />
                    </SelectTrigger>
                    <SelectContent>
                      {localizacionesFiltradas.map(l => (
                        <SelectItem key={l.id} value={l.id!.toString()}>
                          {l.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {emprendimientos.length > 0 && (
                <div>
                  <Label className="text-xs uppercase tracking-wide text-amber-800 mb-1.5 flex items-center gap-1.5">
                    <Store className="h-3.5 w-3.5" />
                    Emprendimiento (catálogo)
                  </Label>
                  <Select value={emprendimientoFiltro} onValueChange={setEmprendimientoFiltro}>
                    <SelectTrigger className="h-10 bg-white border-amber-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos los productos</SelectItem>
                      <SelectItem value="tienda">Tienda propia</SelectItem>
                      {emprendimientos.map((e) => (
                        <SelectItem key={e.id} value={String(e.id)}>
                          {e.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {!almacenId && (
                <p className="text-xs text-amber-700 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Seleccione un almacen para poder agregar productos
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Catalogo de Productos - siempre visible, ocupa toda la columna */}
        <Card className="flex-1 overflow-hidden min-h-[280px] lg:min-h-0">
          <CardContent className="p-3 md:p-4 h-full">
            <ProductCatalog
              productos={productosFiltrados}
              marcas={marcas}
              categorias={categorias}
              idsEnVenta={lineas.map((l) => l.producto_id)}
              onAdd={(producto) => addProducto(producto)}
              disabled={!almacenId}
              localizacionSeleccionada={!!localizacionId}
              stockPorLocalizacion={stockCatalogo}
              loadingStock={loadingCatalogo}
              buscarFn={buscarFnCatalogo}
            />
          </CardContent>
        </Card>
      </div>

      {/* Sidebar - Productos seleccionados + Resumen */}
      <div className="w-full lg:w-[26rem] xl:w-[28rem] border-t lg:border-t-0 lg:border-l bg-background flex flex-col lg:min-h-0 lg:overflow-y-auto">
        <div className="px-4 py-3 border-b flex items-center gap-2 shrink-0">
          <ShoppingCart className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Productos en la venta</span>
          {lineas.length > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {lineas.length}
            </Badge>
          )}
        </div>
        <div className="overflow-auto lg:max-h-[38vh] border-b shrink-0">
            {lineas.length === 0 ? (
              <div className="min-h-[140px] flex flex-col items-center justify-center text-muted-foreground p-4">
                <ShoppingCart className="h-10 w-10 md:h-12 md:w-12 mb-3 opacity-20" />
                <p className="text-sm md:text-base text-center">No hay productos en la venta</p>
                <p className="text-xs md:text-sm text-center">Seleccione productos del catalogo de la izquierda</p>
              </div>
            ) : (
              <div className="divide-y">
                {lineas.map((linea, index) => {
                  const stockInsuficiente = localizacionId && linea.cantidad > linea.stock_disponible
                  const seAgotara = localizacionId && linea.stock_disponible > 0 && linea.cantidad === linea.stock_disponible
                  
                  return (
                  <div 
                    key={linea.producto_id} 
                    className={`p-3 transition-colors ${
                      stockInsuficiente ? "bg-amber-50/80 border-l-4 border-l-amber-600" : "hover:bg-muted/50"
                    }`}
                  >
                    {/* Top row: product name + delete */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground text-sm leading-snug line-clamp-2">{linea.producto_nombre}</p>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{linea.producto_codigo}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLinea(index)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7 shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Stock badge + warnings */}
                    {localizacionId && (
                      <div className="mt-1.5">
                        <Badge 
                          variant={stockInsuficiente ? "destructive" : "secondary"}
                          className={`text-xs ${
                            stockInsuficiente 
                              ? "bg-amber-600 hover:bg-amber-700" 
                              : seAgotara 
                                ? "bg-yellow-500 text-yellow-950 hover:bg-yellow-600"
                                : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                          }`}
                        >
                          Disp: {linea.stock_disponible}
                        </Badge>
                        {stockInsuficiente && (
                          <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            <span>Stock insuficiente</span>
                          </p>
                        )}
                        {seAgotara && !stockInsuficiente && (
                          <p className="text-xs text-yellow-700 mt-1 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            <span>Quedara agotado</span>
                          </p>
                        )}
                      </div>
                    )}

                    {/* Bottom row: quantity controls + price + subtotal */}
                    <div className="flex items-center justify-between gap-2 mt-2">
                      {/* Quantity Controls */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-7 w-7"
                          onClick={() => updateCantidad(index, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-7 text-center font-bold text-sm">{linea.cantidad}</span>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-7 w-7"
                          onClick={() => updateCantidad(index, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Price input */}
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="text-xs text-muted-foreground shrink-0">L</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={linea.precio_unitario}
                          onChange={(e) => updatePrecio(index, parseFloat(e.target.value) || 0)}
                          className="text-right font-medium text-sm h-7 w-20 px-2"
                        />
                      </div>

                      {/* Line Subtotal */}
                      <div className="text-right shrink-0 min-w-[64px]">
                        <p className="font-bold text-sm">L {(linea.subtotal ?? 0).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                  )
                })}
              </div>
            )}
        </div>

        {/* Client Selection */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Cliente</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10"
                    onClick={() => setShowClienteDialog(true)}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Nuevo
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Crear cliente rapido</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Select value={clienteId} onValueChange={setClienteId}>
            <SelectTrigger className="h-12 text-base">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Seleccionar cliente..." />
              </div>
            </SelectTrigger>
            <SelectContent>
              {clientes.map(c => (
                <SelectItem key={c.id} value={c.id!.toString()}>
                  {c.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedCliente && (
            <p className="text-xs text-muted-foreground mt-2">
              RTN: {selectedCliente.rtn || "N/A"}
            </p>
          )}
        </div>

        {/* Stock Warning */}
        {hayStockInsuficiente && (
          <div className="mx-4 mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <p className="text-sm text-amber-800 font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Stock Insuficiente
            </p>
            <p className="text-xs text-amber-700 mt-1">
              {lineasConStockInsuficiente.length} producto(s) exceden el stock disponible en esta ubicacion
            </p>
          </div>
        )}

        {/* ISV Toggle */}
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <Label htmlFor="isv-switch" className="text-sm">Precio incluye ISV (15%)</Label>
          <Switch
            id="isv-switch"
            checked={aplicaIsv}
            onCheckedChange={setAplicaIsv}
          />
        </div>

        {/* Descuento */}
        <div className="px-4 py-3 border-b flex items-center justify-between gap-3">
          <Label htmlFor="descuento-input" className="text-sm">Descuento (%)</Label>
          <div className="relative w-28">
            <Input
              id="descuento-input"
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step={0.01}
              value={descuentoPct === 0 ? "" : descuentoPct}
              placeholder="0"
              onChange={(e) => {
                const raw = e.target.value
                if (raw === "") {
                  setDescuentoPct(0)
                  return
                }
                const parsed = Number(raw)
                if (!Number.isFinite(parsed)) return
                setDescuentoPct(Math.min(100, Math.max(0, parsed)))
              }}
              className="pr-7 text-right"
            />
            <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-muted-foreground">
              %
            </span>
          </div>
        </div>

        {/* Desglose de Pago (multi-metodo) */}
        <div className="px-4 py-3 border-b space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Desglose de Pago</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => agregarPagoLinea()}
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar pago
            </Button>
          </div>

          {/* Aviso si no hay caja abierta */}
          {!cajaFeaturePending && !cajaSesion && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 leading-tight">
              <Wallet className="h-3 w-3 inline mr-1" />
              Caja Chica cerrada. Los pagos en efectivo estaran deshabilitados.
            </p>
          )}

          {/* Lineas de pago */}
          {pagosDetalle.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">
              Sin pagos registrados. La venta quedara como{" "}
              <span className="text-red-700 font-medium">Pendiente</span> (credito).
            </p>
          ) : (
            <div className="space-y-2">
              {pagosDetalle.map((linea) => {
                const cuenta = cuentas.find((c) => c.id === linea.cuenta_id)
                const requiereCuenta =
                  linea.metodo_pago === "Banco" || linea.metodo_pago === "Link_Pago"
                const comision = linea.porcentaje_comision ?? cuenta?.porcentaje_comision ?? 0
                const monto = Number(linea.monto_bruto || 0)
                const neto = +(monto * (1 - comision / 100)).toFixed(2)
                return (
                  <div
                    key={linea._id}
                    className="rounded-md border border-stone-200 bg-stone-50/40 p-2 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <Select
                        value={linea.metodo_pago}
                        onValueChange={(v) => actualizarPagoLinea(linea._id, { metodo_pago: v as PagoVentaDetalleInput["metodo_pago"], cuenta_id: null, porcentaje_comision: 0 })}
                      >
                        <SelectTrigger className="h-8 flex-1 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Efectivo" disabled={!cajaFeaturePending && !cajaSesion}>
                            Efectivo
                          </SelectItem>
                          <SelectItem value="Banco">Banco</SelectItem>
                          <SelectItem value="Link_Pago">Link de Pago</SelectItem>
                          <SelectItem value="Otro">Otro</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => eliminarPagoLinea(linea._id)}
                        aria-label="Eliminar pago"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {requiereCuenta && (
                      <Select
                        value={linea.cuenta_id?.toString() ?? ""}
                        onValueChange={(v) => {
                          const cId = parseInt(v)
                          const c = cuentas.find((x) => x.id === cId)
                          actualizarPagoLinea(linea._id, {
                            cuenta_id: cId,
                            porcentaje_comision: c?.porcentaje_comision ?? 0,
                          })
                        }}
                      >
                        <SelectTrigger className="h-8 w-full text-xs">
                          <SelectValue placeholder="Seleccione cuenta..." />
                        </SelectTrigger>
                        <SelectContent>
                          {cuentas.length === 0 && (
                            <div className="px-2 py-1.5 text-xs text-muted-foreground">
                              No hay cuentas configuradas
                            </div>
                          )}
                          {cuentas.map((c) => (
                            <SelectItem key={c.id} value={c.id!.toString()}>
                              <span className="flex items-center gap-1.5">
                                <Landmark className="h-3 w-3" />
                                {/*
                                  La columna real es `nombre`. Mantenemos
                                  fallbacks a `banco`/`alias` por si en el
                                  futuro se reincorporan, pero hoy bastara
                                  con `nombre` para que el SelectItem se
                                  vea poblado.
                                */}
                                {c.nombre || ""}
                                {(c.porcentaje_comision ?? 0) > 0 && (
                                  <span className="text-[10px] text-muted-foreground">
                                    ({c.porcentaje_comision}%)
                                  </span>
                                )}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-xs text-muted-foreground">
                        L
                      </span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.01}
                        value={monto === 0 ? "" : monto}
                        placeholder="0.00"
                        onChange={(e) => {
                          const raw = e.target.value
                          const parsed = raw === "" ? 0 : Number(raw)
                          if (!Number.isFinite(parsed)) return
                          actualizarPagoLinea(linea._id, { monto_bruto: Math.max(0, parsed) })
                        }}
                        className="pl-6 h-8 text-right text-sm"
                      />
                    </div>

                    {requiereCuenta && monto > 0 && comision > 0 && (
                      <p className="text-[10px] text-muted-foreground flex justify-between leading-none">
                        <span>Comision {comision}%</span>
                        <span>Neto: <span className="font-medium text-foreground">L {neto.toFixed(2)}</span></span>
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Resumen del desglose
              `Total pagado (bruto)` = lo que el cliente entrega.
              `Neto a recibir`     = lo que llega al comercio (descontando
                                     comisiones bancarias de las lineas).
              El sobrepago se valida a nivel BRUTO (el cliente no puede
              entregar mas que el total cobrado). El estado_pago se valida
              a nivel NETO contra `totalNeto`, que es el valor registrado
              de la venta.
          */}
          {pagosDetalle.length > 0 && (
            <div className="rounded-md bg-stone-50 border border-stone-200 px-2 py-1.5 text-[11px] space-y-0.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total pagado (bruto)</span>
                <span className="font-medium">
                  L {pagosDetalle.reduce((a, p) => a + (Number(p.monto_bruto) || 0), 0).toFixed(2)}
                </span>
              </div>
              {totalComisionesR > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Neto a recibir</span>
                  <span className="font-medium">L {sumaPagosNetoR.toFixed(2)}</span>
                </div>
              )}
              {(() => {
                const sumBrutoR = +pagosDetalle
                  .reduce((a, p) => a + (Number(p.monto_bruto) || 0), 0)
                  .toFixed(2)
                const totalBrutoR = +total.toFixed(2)
                if (sumBrutoR > totalBrutoR) {
                  return (
                    <p className="text-destructive font-medium">
                      Sobrepago: L {(sumBrutoR - totalBrutoR).toFixed(2)} excede el total
                    </p>
                  )
                }
                if (sumaPagosNetoR === 0) {
                  return <p className="text-red-700 font-medium">Estado: Pendiente</p>
                }
                if (sumaPagosNetoR >= totalNeto - 0.005) {
                  return <p className="text-emerald-700 font-medium">Estado: Pagado</p>
                }
                return (
                  <p className="text-amber-700 font-medium">
                    Estado: Parcial - Saldo L {(totalNeto - sumaPagosNetoR).toFixed(2)}
                  </p>
                )
              })()}
            </div>
          )}
        </div>

        {/* Totals
            El "Total" prominente representa el NETO (lo que recibe el
            comercio despues de comisiones bancarias del desglose de pago).
            Si no hay comisiones, totalNeto === total y se conserva el
            comportamiento legacy. Cuando hay comisiones, mostramos como
            lineas separadas el subtotal bruto (lo que paga el cliente)
            y la deduccion por comisiones, para transparencia.
        */}
        <div className="flex-1 p-3 md:p-4 flex flex-col justify-end">
          <div className="space-y-2 md:space-y-3">
            <div className="flex justify-between text-xs md:text-sm">
              <span className="text-muted-foreground">Articulos ({totalItems})</span>
              <span>L {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs md:text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>L {subtotal.toFixed(2)}</span>
            </div>
            {descuentoPctSafe > 0 && (
              <div className="flex justify-between text-xs md:text-sm">
                <span className="text-muted-foreground">
                  Descuento ({descuentoPctSafe.toFixed(descuentoPctSafe % 1 === 0 ? 0 : 2)}%)
                </span>
                <span className="text-primary">- L {montoDescuento.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs md:text-sm">
              <span className="text-muted-foreground">ISV incluido (15%)</span>
              <span>L {isv.toFixed(2)}</span>
            </div>
            {totalComisionesR > 0 && (
              <>
                <div className="flex justify-between text-xs md:text-sm">
                  <span className="text-muted-foreground">Total cobrado</span>
                  <span>L {total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs md:text-sm">
                  <span className="text-muted-foreground">Comision bancaria</span>
                  <span className="text-destructive">- L {totalComisionesR.toFixed(2)}</span>
                </div>
              </>
            )}
            <Separator />
            <div className="flex justify-between items-baseline">
              <span className="text-base md:text-lg font-semibold">
                Total{totalComisionesR > 0 ? " neto" : ""}
              </span>
              <span className="text-2xl md:text-3xl font-bold text-primary">
                L {totalNeto.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-4 md:mt-6 space-y-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-full">
                    <Button 
                      size="lg" 
                      className="w-full h-12 md:h-14 text-base md:text-lg gap-2"
                      onClick={handleSubmit}
                      disabled={
                        saving ||
                        lineas.length === 0 ||
                        !clienteId ||
                        !almacenId ||
                        !localizacionId ||
                        hayStockInsuficiente ||
                        // Desglose: rechazamos sobrepago. Otras validaciones
                        // (cuenta requerida, caja cerrada, monto <=0 por linea)
                        // se muestran como toasts en handleSubmit.
                        pagosDetalle.reduce(
                          (a, p) => a + (Number(p.monto_bruto) || 0),
                          0
                        ) > +total.toFixed(2)
                      }
                    >
                      {saving ? (
                        "Procesando..."
                      ) : (
                        <>
                          <FileText className="h-4 w-4 md:h-5 md:w-5" />
                          Generar Factura
                        </>
                      )}
                    </Button>
                  </div>
                </TooltipTrigger>
                {hayStockInsuficiente && (
                  <TooltipContent side="top" className="bg-amber-800 text-amber-50">
                    <p>No se puede facturar: hay productos con stock insuficiente</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>

      {/* Quick Client Creation Dialog */}
      <Dialog open={showClienteDialog} onOpenChange={setShowClienteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Crear Cliente Rapido
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cliente-nombre">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cliente-nombre"
                placeholder="Nombre del cliente"
                value={nuevoCliente.nombre || ""}
                onChange={(e) => setNuevoCliente(prev => ({ ...prev, nombre: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cliente-rtn">RTN</Label>
              <Input
                id="cliente-rtn"
                placeholder="RTN (opcional)"
                value={nuevoCliente.rtn || ""}
                onChange={(e) => setNuevoCliente(prev => ({ ...prev, rtn: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cliente-direccion">Direccion</Label>
              <Input
                id="cliente-direccion"
                placeholder="Direccion (opcional)"
                value={nuevoCliente.direccion || ""}
                onChange={(e) => setNuevoCliente(prev => ({ ...prev, direccion: e.target.value }))}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cliente-telefono">Telefono</Label>
                <Input
                  id="cliente-telefono"
                  type="tel"
                  inputMode="tel"
                  placeholder="9999-9999"
                  value={nuevoCliente.telefono || ""}
                  onChange={(e) =>
                    setNuevoCliente((prev) => ({ ...prev, telefono: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cliente-fecha-nac">
                  Fecha de Nacimiento
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    (opcional)
                  </span>
                </Label>
                <Input
                  id="cliente-fecha-nac"
                  type="date"
                  value={nuevoCliente.fecha_nacimiento || ""}
                  onChange={(e) =>
                    setNuevoCliente((prev) => ({ ...prev, fecha_nacimiento: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowClienteDialog(false)
                setNuevoCliente({
                  nombre: "",
                  rtn: "",
                  direccion: "",
                  telefono: "",
                  fecha_nacimiento: "",
                })
              }}
              disabled={savingCliente}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateCliente} 
              disabled={savingCliente || !nuevoCliente.nombre?.trim()}
              className="gap-2"
            >
              {savingCliente ? "Guardando..." : "Crear y Seleccionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF Generation Dialog */}
      <Dialog
        open={showPdfDialog}
        onOpenChange={(open) => {
          // Al cerrar el dialog por cualquier via (X, ESC, clic fuera),
          // limpiamos el formulario para dejar todo listo para una nueva venta.
          if (!open) {
            setShowPdfDialog(false)
            resetForm()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Factura Generada</DialogTitle>
          </DialogHeader>
          <div className="py-6 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <FileText className="h-8 w-8 text-green-600" />
            </div>
            <p className="text-xl font-semibold">
              Factura {lastVenta?.encabezado.numero_factura}
            </p>
            <p className="text-muted-foreground mt-1">
              Venta registrada exitosamente
            </p>
            <p className="text-2xl font-bold text-primary mt-4">
              L {(lastVenta?.encabezado.total_venta ?? 0).toFixed(2)}
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" size="lg" onClick={() => {
              setShowPdfDialog(false)
              resetForm()
            }}>
              Nueva Venta
            </Button>
            <Button size="lg" onClick={generatePdf} className="gap-2">
              <FileText className="h-4 w-4" />
              Descargar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
