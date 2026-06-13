-- =========================================================
-- Script 011: Tesoreria + Caja Chica + Pagos Divididos
-- =========================================================
-- Crea la infraestructura para:
--   1. cuentas_config         -> bancos / links de pago con % de comision
--   2. cuenta_movimientos     -> trazabilidad y saldo running por cuenta
--   3. caja_chica_sesiones    -> sesion unica abierta por razon_social
--   4. caja_chica_movimientos -> movimientos con saldo running
--   5. ventas_pagos_detalle   -> desglose multi-metodo por venta
--   6. modulos                -> agrega 'Cuentas Bancarias' y 'Caja Chica'
--
-- TODO idempotente: usa IF NOT EXISTS / ON CONFLICT.
-- =========================================================

-- =========================================================
-- 1. cuentas_config (bancos / links de pago)
-- =========================================================
CREATE TABLE IF NOT EXISTS cuentas_config (
  id                 SERIAL PRIMARY KEY,
  razon_social_id    INTEGER NOT NULL REFERENCES razon_social(id) ON DELETE CASCADE,
  nombre             TEXT NOT NULL,
  tipo               TEXT NOT NULL CHECK (tipo IN ('Banco','Link_Pago','Otro')),
  porcentaje_comision NUMERIC(5,2) NOT NULL DEFAULT 0
                     CHECK (porcentaje_comision >= 0 AND porcentaje_comision <= 100),
  activo             BOOLEAN NOT NULL DEFAULT TRUE,
  saldo              NUMERIC(14,2) NOT NULL DEFAULT 0,
  usuario            TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cuentas_config_razon_social
  ON cuentas_config(razon_social_id);

COMMENT ON TABLE cuentas_config IS
  'Configuracion de cuentas bancarias / links de pago con comision asociada.';

-- =========================================================
-- 2. cuenta_movimientos (saldo running por cuenta)
-- =========================================================
CREATE TABLE IF NOT EXISTS cuenta_movimientos (
  id                 SERIAL PRIMARY KEY,
  razon_social_id    INTEGER NOT NULL REFERENCES razon_social(id) ON DELETE CASCADE,
  cuenta_id          INTEGER NOT NULL REFERENCES cuentas_config(id) ON DELETE CASCADE,
  fecha              TIMESTAMPTZ NOT NULL DEFAULT now(),
  tipo               TEXT NOT NULL CHECK (tipo IN ('Ingreso','Egreso')),
  monto              NUMERIC(14,2) NOT NULL,
  concepto           TEXT,
  ref_tipo           TEXT,           -- 'venta' | 'transferencia_caja' | etc
  ref_id             INTEGER,
  saldo_resultante   NUMERIC(14,2) NOT NULL,
  usuario            TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cuenta_mov_cuenta
  ON cuenta_movimientos(cuenta_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_cuenta_mov_razon_social
  ON cuenta_movimientos(razon_social_id);

-- =========================================================
-- 3. caja_chica_sesiones (UNA abierta por razon_social a la vez)
-- =========================================================
CREATE TABLE IF NOT EXISTS caja_chica_sesiones (
  id                       SERIAL PRIMARY KEY,
  razon_social_id          INTEGER NOT NULL REFERENCES razon_social(id) ON DELETE CASCADE,
  fecha_apertura           TIMESTAMPTZ NOT NULL DEFAULT now(),
  saldo_inicial            NUMERIC(14,2) NOT NULL DEFAULT 0,
  fecha_cierre             TIMESTAMPTZ,
  saldo_final_real         NUMERIC(14,2),
  saldo_final_calculado    NUMERIC(14,2),
  diferencia               NUMERIC(14,2),
  estado                   TEXT NOT NULL CHECK (estado IN ('Abierta','Cerrada')),
  usuario_apertura         TEXT,
  usuario_cierre           TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index parcial: garantiza una unica sesion 'Abierta' por razon_social.
CREATE UNIQUE INDEX IF NOT EXISTS uq_caja_sesion_abierta_por_razon
  ON caja_chica_sesiones(razon_social_id)
  WHERE estado = 'Abierta';

CREATE INDEX IF NOT EXISTS idx_caja_sesion_razon_social
  ON caja_chica_sesiones(razon_social_id, estado);

-- =========================================================
-- 4. caja_chica_movimientos (saldo running por sesion)
-- =========================================================
CREATE TABLE IF NOT EXISTS caja_chica_movimientos (
  id                 SERIAL PRIMARY KEY,
  razon_social_id    INTEGER NOT NULL REFERENCES razon_social(id) ON DELETE CASCADE,
  sesion_id          INTEGER NOT NULL REFERENCES caja_chica_sesiones(id) ON DELETE CASCADE,
  fecha              TIMESTAMPTZ NOT NULL DEFAULT now(),
  tipo               TEXT NOT NULL CHECK (tipo IN
                       ('Apertura','Ingreso_Manual','Ingreso_Venta',
                        'Salida','Transferencia_Banco','Cierre')),
  monto              NUMERIC(14,2) NOT NULL,  -- positivo entrada, negativo salida
  concepto           TEXT,
  ref_tipo           TEXT,
  ref_id             INTEGER,
  cuenta_destino_id  INTEGER REFERENCES cuentas_config(id),  -- solo Transferencia_Banco
  saldo_resultante   NUMERIC(14,2) NOT NULL,
  usuario            TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_caja_mov_sesion_fecha
  ON caja_chica_movimientos(sesion_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_caja_mov_razon_social
  ON caja_chica_movimientos(razon_social_id);

-- =========================================================
-- 5. ventas_pagos_detalle (desglose multi-metodo)
-- =========================================================
CREATE TABLE IF NOT EXISTS ventas_pagos_detalle (
  id                 SERIAL PRIMARY KEY,
  razon_social_id    INTEGER NOT NULL REFERENCES razon_social(id) ON DELETE CASCADE,
  venta_id           INTEGER NOT NULL REFERENCES ventas_encabezado(id) ON DELETE CASCADE,
  metodo_pago        TEXT NOT NULL CHECK (metodo_pago IN
                       ('Efectivo','Banco','Link_Pago','Credito','Otro')),
  cuenta_id          INTEGER REFERENCES cuentas_config(id),
  monto_bruto        NUMERIC(14,2) NOT NULL CHECK (monto_bruto >= 0),
  porcentaje_comision NUMERIC(5,2) NOT NULL DEFAULT 0,
  monto_neto         NUMERIC(14,2) NOT NULL,
  usuario            TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ventas_pagos_venta
  ON ventas_pagos_detalle(venta_id);
CREATE INDEX IF NOT EXISTS idx_ventas_pagos_razon_social
  ON ventas_pagos_detalle(razon_social_id);
CREATE INDEX IF NOT EXISTS idx_ventas_pagos_cuenta
  ON ventas_pagos_detalle(cuenta_id);

-- =========================================================
-- 6. Permisos: agrega los 2 nuevos modulos granulares
-- =========================================================
INSERT INTO modulos (nombre, descripcion) VALUES
  ('Cuentas Bancarias', 'Gestion de bancos y % de comisiones'),
  ('Caja Chica',        'Sesiones de caja menor y movimientos de efectivo')
ON CONFLICT (nombre) DO NOTHING;
