/**
 * Utilidades de zona horaria para Honduras (UTC-6, sin DST).
 *
 * CONVENCION DEL PROYECTO
 * -----------------------
 * Para los modulos de caja chica / cierre diario almacenamos los TIMESTAMPTZ
 * como "hora local de Honduras codificada como UTC". Esto significa que si
 * en HN son las 14:00, el valor guardado en la BD es `2026-05-10T14:00:00Z`
 * (aunque ese instante UTC real seria realmente las 20:00 UTC).
 *
 * Trade-off conocido:
 *   - PROS: al inspeccionar la BD directamente (Supabase SQL editor, psql)
 *           el usuario ve la fecha/hora que corresponde al dia operativo.
 *   - CONS: el valor NO representa el instante real UTC, asi que NUNCA se
 *           debe comparar con `now()` de la BD ni convertir a otra TZ.
 *
 * Por eso TODA escritura de fecha desde la app a estas tablas debe pasar
 * por `getHondurasNowISO()` y TODO display debe usar `formatHondurasDateTime`
 * o equivalente con `timeZone: "UTC"`.
 */

const HONDURAS_OFFSET_MS = 6 * 60 * 60 * 1000 // UTC -6

/**
 * Devuelve la hora actual de Honduras como ISO string. La hora "se ve" como
 * Honduras cuando la BD almacena el valor (porque la codificamos a UTC
 * restando 6 horas al instante real).
 *
 * Ejemplo: si en HN son las 14:00 (= 20:00 UTC real), devuelve
 *   "2026-05-10T14:00:00.000Z"
 */
export function getHondurasNowISO(): string {
  const nowUtc = Date.now()
  return new Date(nowUtc - HONDURAS_OFFSET_MS).toISOString()
}

/**
 * Construye el rango [start, end) que representa un dia completo en Honduras,
 * codificado como UTC para coincidir con los timestamps guardados via
 * `getHondurasNowISO()`. Util para filtros `.gte("fecha", start).lt("fecha", end)`.
 *
 * @param fechaISO formato YYYY-MM-DD (sin TZ)
 */
export function getHondurasDayRange(fechaISO: string): {
  start: string
  end: string
} {
  // Tratamos `fechaISO` como si fuera la fecha en Honduras y construimos
  // ISO directamente (sin TZ shift). El "+T00:00:00.000Z" es solo
  // notacion: lo que importa es que coincida con como se guardan los
  // timestamps de la app.
  const start = `${fechaISO}T00:00:00.000Z`

  // Para `end` sumamos 1 dia manualmente.
  const [y, m, d] = fechaISO.split("-").map((n) => parseInt(n, 10))
  const nextDay = new Date(Date.UTC(y, m - 1, d + 1))
  const yy = nextDay.getUTCFullYear()
  const mm = String(nextDay.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(nextDay.getUTCDate()).padStart(2, "0")
  const end = `${yy}-${mm}-${dd}T00:00:00.000Z`

  return { start, end }
}

/**
 * Formatea un timestamp HN-as-UTC para display. Usa `timeZone: "UTC"` para
 * leer los componentes tal cual (sin re-aplicar offset), porque el valor
 * almacenado ya representa la hora local de Honduras.
 */
export function formatHondurasDateTime(iso?: string | null): string {
  if (!iso) return "-"
  try {
    return new Date(iso).toLocaleString("es-HN", {
      timeZone: "UTC",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

/**
 * Variante solo-fecha (sin hora).
 */
export function formatHondurasDate(iso?: string | null): string {
  if (!iso) return "-"
  try {
    return new Date(iso).toLocaleDateString("es-HN", {
      timeZone: "UTC",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  } catch {
    return iso
  }
}

/**
 * Devuelve la fecha de Honduras de HOY en formato YYYY-MM-DD.
 * Util como default de filtros / inputs type=date.
 */
export function getHondurasTodayISODate(): string {
  return getHondurasNowISO().slice(0, 10)
}
