-- =============================================================================
-- 016 - Vista de historico de Caja Chica
-- =============================================================================
-- Objetivo:
--   Devolver una fila por cada sesion (abierta o cerrada) con un resumen
--   listo para consumir desde la pestana "Historial de Sesiones":
--     - Saldo Inicial
--     - Total Ingresos (+)   -> Ingreso_Manual + Ingreso_Venta
--     - Total Egresos  (-)   -> Salida + Transferencia_Banco
--     - Saldo Final Calculado (saldo_resultante del ultimo movimiento real)
--     - Saldo Final Real (lo que el usuario conto al cerrar)
--     - Diferencia
--
-- Adaptacion al esquema real:
--   La tabla `caja_chica_sesiones` NO tiene `fecha_apertura` ni `fecha_cierre`.
--   Solo tiene `created_at` (timestamptz) y `fecha` (date). Por eso:
--     * `fecha_apertura` se expone como ALIAS de `s.created_at`.
--     * `fecha_cierre` se DERIVA del `fecha` (timestamp) del ultimo
--       movimiento de tipo 'Cierre' de cada sesion. Para sesiones aun
--       abiertas es NULL.
--
-- Notas:
--   * Excluimos los movimientos tipo 'Apertura' y 'Cierre' del calculo de
--     ingresos/egresos para que reflejen "lo que entro/salio durante el dia".
--   * Usamos ABS(m.monto) porque los egresos en BD vienen con signo negativo.
--   * Multi-tenant: la vista expone `razon_social_id` y la pagina filtra
--     por el de la razon social actual antes de leer.
-- =============================================================================

CREATE OR REPLACE VIEW vista_historico_caja_chica AS
WITH cierre_por_sesion AS (
  -- Ultimo movimiento de cierre por sesion (deriva fecha_cierre).
  SELECT
    sesion_id,
    MAX(fecha) AS fecha_cierre
  FROM caja_chica_movimientos
  WHERE tipo = 'Cierre'
  GROUP BY sesion_id
)
SELECT
  s.id                                         AS sesion_id,
  s.razon_social_id,
  s.created_at                                 AS fecha_apertura,
  c.fecha_cierre                               AS fecha_cierre,
  s.usuario_apertura,
  s.usuario_cierre,
  s.estado,
  s.saldo_inicial,
  COALESCE(SUM(
    CASE
      WHEN m.tipo IN ('Ingreso_Manual', 'Ingreso_Venta') THEN ABS(m.monto)
      ELSE 0
    END
  ), 0)                                        AS total_ingresos,
  COALESCE(SUM(
    CASE
      WHEN m.tipo IN ('Salida', 'Transferencia_Banco') THEN ABS(m.monto)
      ELSE 0
    END
  ), 0)                                        AS total_egresos,
  s.saldo_final_calculado,
  s.saldo_final_real,
  s.diferencia
FROM caja_chica_sesiones s
LEFT JOIN caja_chica_movimientos m
  ON m.sesion_id = s.id
 AND m.tipo NOT IN ('Apertura', 'Cierre')
LEFT JOIN cierre_por_sesion c
  ON c.sesion_id = s.id
GROUP BY
  s.id, s.razon_social_id, s.created_at, c.fecha_cierre,
  s.usuario_apertura, s.usuario_cierre, s.estado, s.saldo_inicial,
  s.saldo_final_calculado, s.saldo_final_real, s.diferencia;

COMMENT ON VIEW vista_historico_caja_chica IS
  'Resumen por sesion: saldo inicial, ingresos, egresos, saldo final y diferencia. fecha_cierre se deriva del ultimo movimiento Cierre.';
