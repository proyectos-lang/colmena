/**
 * Helpers para alertas de cumpleanos del modulo de clientes.
 *
 * Reglas:
 *  - Solo nos importan mes y dia (ignoramos el ano de nacimiento).
 *  - El "proximo cumpleanos" puede caer este ano o el siguiente.
 *  - Comparamos al inicio del dia (00:00 hora local) para evitar drifts
 *    por horas de medianoche.
 *  - Soportamos el caso 29/feb: si el ano actual no es bisiesto, lo
 *    consideramos el 28/feb para no sobrepasar al 1/mar.
 */

/**
 * Devuelve dias restantes hasta el proximo cumpleanos (>= 0).
 * Retorna `null` si la fecha es invalida o vacia.
 */
export function getDaysUntilBirthday(
  fechaNacimientoISO: string | null | undefined,
  today: Date = new Date()
): number | null {
  if (!fechaNacimientoISO) return null

  // Parseamos como YYYY-MM-DD para evitar shift por timezone.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(fechaNacimientoISO)
  if (!match) return null
  const month = Number(match[2])
  const day = Number(match[3])
  if (!month || !day) return null

  // Truncamos hoy a inicio del dia local.
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  // Construye el cumpleanos en un ano dado, ajustando 29/feb si no es bisiesto.
  const buildBirthday = (year: number): Date => {
    let m = month - 1
    let d = day
    if (m === 1 && d === 29 && !isLeapYear(year)) d = 28
    return new Date(year, m, d)
  }

  let next = buildBirthday(startToday.getFullYear())
  if (next.getTime() < startToday.getTime()) {
    next = buildBirthday(startToday.getFullYear() + 1)
  }

  const ms = next.getTime() - startToday.getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/**
 * Estado del cumpleanos para uso en UI:
 *   - `today`:      cumple hoy
 *   - `upcoming`:   cumple en 1..5 dias
 *   - `none`:       fuera del rango (o sin fecha)
 */
export type EstadoCumple = "today" | "upcoming" | "none"

export interface AlertaCumple {
  estado: EstadoCumple
  dias: number | null
  mensaje: string
}

export function getAlertaCumple(
  fechaNacimientoISO: string | null | undefined,
  today: Date = new Date()
): AlertaCumple {
  const dias = getDaysUntilBirthday(fechaNacimientoISO, today)
  if (dias === null) return { estado: "none", dias: null, mensaje: "" }
  if (dias === 0) return { estado: "today", dias: 0, mensaje: "Cumpleanos hoy" }
  if (dias <= 5) return { estado: "upcoming", dias, mensaje: `Cumpleanos en ${dias} ${dias === 1 ? "dia" : "dias"}` }
  return { estado: "none", dias, mensaje: "" }
}
