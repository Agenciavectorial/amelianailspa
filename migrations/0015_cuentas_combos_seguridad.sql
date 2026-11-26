-- Combos y costos de servicios, etiquetas de clientas, Cuentas (comisiones, ventas, gastos, metas, deudas)
-- y piezas de seguridad (pausa de reservas, sesiones por dispositivo, respaldos).

-- ---------- servicios: combos, precio "antes", costo de materiales ----------
ALTER TABLE servicios ADD COLUMN tipo TEXT NOT NULL DEFAULT 'servicio';      -- 'servicio' | 'combo'
ALTER TABLE servicios ADD COLUMN incluye TEXT NOT NULL DEFAULT '';           -- lo que trae el combo, un ítem por línea
ALTER TABLE servicios ADD COLUMN precio_antes INTEGER;                       -- precio tachado (lo que costaría por separado)
ALTER TABLE servicios ADD COLUMN costo INTEGER NOT NULL DEFAULT 0;           -- costo de materiales por servicio (utilidad)
ALTER TABLE servicios ADD COLUMN destacado INTEGER NOT NULL DEFAULT 0;

-- ---------- clientas: etiquetas personalizables ----------
CREATE TABLE etiquetas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#A98BBE',
  orden INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE clienta_etiquetas (
  clienta_id INTEGER NOT NULL REFERENCES clientas(id) ON DELETE CASCADE,
  etiqueta_id INTEGER NOT NULL REFERENCES etiquetas(id) ON DELETE CASCADE,
  PRIMARY KEY (clienta_id, etiqueta_id)
) WITHOUT ROWID;
INSERT INTO etiquetas (nombre, color, orden) VALUES
  ('Buena clienta', '#2E7D5B', 1), ('VIP', '#7A6494', 2), ('Llega tarde', '#B4581D', 3),
  ('Mala paga', '#B3261E', 4), ('Grosera', '#8E2C48', 5);

-- ---------- comisiones ----------
ALTER TABLE colaboradoras ADD COLUMN comision_pct REAL NOT NULL DEFAULT 0;   -- % general de la chica
CREATE TABLE comisiones (                                                    -- % por servicio (manda sobre el general)
  colaboradora_id INTEGER NOT NULL REFERENCES colaboradoras(id) ON DELETE CASCADE,
  servicio_id INTEGER NOT NULL REFERENCES servicios(id) ON DELETE CASCADE,
  pct REAL NOT NULL CHECK (pct >= 0 AND pct <= 100),
  PRIMARY KEY (colaboradora_id, servicio_id)
) WITHOUT ROWID;
-- Al cobrar se congela la comisión en pesos: cambiar el % después no reescribe lo ya pagado.
ALTER TABLE pagos ADD COLUMN comision INTEGER;
ALTER TABLE pagos ADD COLUMN colaboradora_id INTEGER;
UPDATE pagos SET colaboradora_id = (SELECT colaboradora_id FROM citas WHERE citas.id = pagos.cita_id);

-- Ventas sin cita (llegó sin agendar, un producto, un retoque).
-- La base real ya tenía una tabla `ventas` vacía (creada el 24 nov por 0014_contabilidad): se conserva y se le
-- agregan las columnas que faltan. En una base nueva se crea con la misma forma y luego se completa igual.
CREATE TABLE IF NOT EXISTS ventas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  colaboradora_id INTEGER REFERENCES colaboradoras(id) ON DELETE SET NULL,
  concepto TEXT NOT NULL,
  monto INTEGER NOT NULL CHECK (monto >= 0),
  propina INTEGER NOT NULL DEFAULT 0 CHECK (propina >= 0),
  metodo TEXT NOT NULL DEFAULT 'efectivo',
  fecha TEXT NOT NULL,
  registrado_por INTEGER,
  creado TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha);
ALTER TABLE ventas ADD COLUMN servicio_id INTEGER REFERENCES servicios(id) ON DELETE SET NULL;
ALTER TABLE ventas ADD COLUMN clienta_id INTEGER REFERENCES clientas(id) ON DELETE SET NULL;
ALTER TABLE ventas ADD COLUMN comision INTEGER;
ALTER TABLE ventas ADD COLUMN costo INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ventas ADD COLUMN nota TEXT NOT NULL DEFAULT '';

-- ---------- gastos ----------
CREATE TABLE gasto_categorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#A98BBE',
  orden INTEGER NOT NULL DEFAULT 0,
  activa INTEGER NOT NULL DEFAULT 1
);
INSERT INTO gasto_categorias (nombre, color, orden) VALUES
  ('Insumos y materiales', '#7A6494', 1), ('Arriendo', '#5E4570', 2), ('Servicios públicos', '#2F6F8F', 3),
  ('Nómina y pagos', '#2E7D5B', 4), ('Publicidad', '#C4628F', 5), ('Transporte', '#8A6C82', 6),
  ('Cafetería y antojos', '#B4581D', 7), ('Mantenimiento', '#6E6776', 8), ('Otros', '#9C8FA8', 9);
-- `gastos` también existía vacía en la base real (misma situación que `ventas`): se conserva y se completa.
CREATE TABLE IF NOT EXISTS gastos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL CHECK (tipo IN ('fijo','variable')),
  categoria TEXT NOT NULL DEFAULT 'Otro',
  descripcion TEXT NOT NULL DEFAULT '',
  monto INTEGER NOT NULL CHECK (monto > 0),
  metodo TEXT NOT NULL DEFAULT 'efectivo',
  fecha TEXT NOT NULL,
  gasto_fijo_id INTEGER,
  registrado_por INTEGER,
  creado TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON gastos(fecha);
ALTER TABLE gastos ADD COLUMN categoria_id INTEGER REFERENCES gasto_categorias(id) ON DELETE SET NULL;
ALTER TABLE gastos ADD COLUMN nota TEXT NOT NULL DEFAULT '';

-- ---------- metas de ahorro / inversión ----------
CREATE TABLE metas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'ahorro' CHECK (tipo IN ('ahorro','inversion')),
  objetivo INTEGER NOT NULL CHECK (objetivo > 0),
  fecha_meta TEXT NOT NULL DEFAULT '',
  cerrada INTEGER NOT NULL DEFAULT 0,
  creado TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE meta_aportes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meta_id INTEGER NOT NULL REFERENCES metas(id) ON DELETE CASCADE,
  fecha TEXT NOT NULL,
  monto INTEGER NOT NULL,                  -- negativo = retiro
  nota TEXT NOT NULL DEFAULT ''
);

-- ---------- deudas y préstamos con cuotas ----------
CREATE TABLE deudas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'debo' CHECK (tipo IN ('debo','me_deben')),
  persona TEXT NOT NULL DEFAULT '',
  total INTEGER NOT NULL CHECK (total > 0),
  cuotas INTEGER NOT NULL DEFAULT 1 CHECK (cuotas BETWEEN 1 AND 360),
  dia_pago INTEGER,                        -- día del mes en que se paga la cuota
  inicio TEXT NOT NULL,
  nota TEXT NOT NULL DEFAULT '',
  cerrada INTEGER NOT NULL DEFAULT 0,
  creado TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE deuda_pagos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deuda_id INTEGER NOT NULL REFERENCES deudas(id) ON DELETE CASCADE,
  fecha TEXT NOT NULL,
  monto INTEGER NOT NULL CHECK (monto > 0),
  nota TEXT NOT NULL DEFAULT ''
);

-- ---------- seguridad ----------
ALTER TABLE citas ADD COLUMN ip_hash TEXT NOT NULL DEFAULT '';               -- huella de la IP (no la IP) de reservas en línea
CREATE INDEX idx_citas_creado ON citas(creado);
ALTER TABLE sesiones ADD COLUMN dispositivo TEXT NOT NULL DEFAULT '';
ALTER TABLE sesiones ADD COLUMN ultimo_uso INTEGER NOT NULL DEFAULT 0;
-- 1 = el PIN ya tiene 6 dígitos. Los de 4 se siguen aceptando pero piden cambiarlo al entrar.
ALTER TABLE colaboradoras ADD COLUMN pin_seis INTEGER NOT NULL DEFAULT 0;

-- Respaldos diarios guardados en la misma base (además del Time Travel de D1 y, si existe, R2).
CREATE TABLE respaldos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL,
  destino TEXT NOT NULL DEFAULT 'd1',      -- 'd1' | 'r2'
  clave TEXT NOT NULL DEFAULT '',
  bytes INTEGER NOT NULL DEFAULT 0,
  filas INTEGER NOT NULL DEFAULT 0,
  datos BLOB,                              -- JSON comprimido (solo destino d1)
  creado TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Fotos subidas desde el panel cuando no hay R2 ni Cloudinary configurados (ya comprimidas en el celular: WebP ~1600 px).
CREATE TABLE medios_archivos (
  clave TEXT PRIMARY KEY,
  tipo TEXT NOT NULL,
  datos BLOB NOT NULL,
  bytes INTEGER NOT NULL,
  subido_por INTEGER,
  creado TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO ajustes (clave, valor) VALUES
  ('reservas_pausadas', '0'),
  ('pausa_mensaje', 'Por ahora estamos agendando solo por WhatsApp. ¡Escríbenos y te atendemos!'),
  ('max_reservas_celular_dia', '3'),
  ('modulos', '{"cuentas":true,"fidelizacion":true,"promociones":true,"notas":true,"analitica":true}'),
  ('hormiga_umbral', '20000'),
  ('hormiga_alerta', '150000');
