-- Plataforma de citas Amelia Nail Spa: esquema inicial (Cloudflare D1 / SQLite).
-- Horas: hora local de Colombia (UTC-5). Fechas 'AAAA-MM-DD', horas en minutos desde medianoche.

CREATE TABLE ajustes (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

CREATE TABLE horario_spa (
  dia INTEGER PRIMARY KEY CHECK (dia BETWEEN 0 AND 6),   -- 0 = domingo
  abierto INTEGER NOT NULL DEFAULT 1,
  abre INTEGER NOT NULL CHECK (abre BETWEEN 0 AND 1440),
  cierra INTEGER NOT NULL CHECK (cierra BETWEEN 0 AND 1440)
);

CREATE TABLE festivos (
  fecha TEXT PRIMARY KEY,
  motivo TEXT NOT NULL DEFAULT ''
);

CREATE TABLE servicios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Uñas',
  descripcion TEXT NOT NULL DEFAULT '',
  foto TEXT NOT NULL DEFAULT '',
  precio INTEGER,                       -- pesos colombianos; NULL = a consultar
  precio_desde INTEGER NOT NULL DEFAULT 0,
  duracion INTEGER NOT NULL CHECK (duracion > 0 AND duracion % 5 = 0),
  visible INTEGER NOT NULL DEFAULT 1,
  orden INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE colaboradoras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'colaboradora' CHECK (rol IN ('propietaria','colaboradora')),
  cargo TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  foto TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#A98BBE',
  pin_hash TEXT,
  activa INTEGER NOT NULL DEFAULT 1,
  agenda INTEGER NOT NULL DEFAULT 1,     -- 1 = recibe citas
  permisos TEXT NOT NULL DEFAULT '{}',
  ics_token TEXT UNIQUE,
  orden INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE colaboradora_servicios (
  colaboradora_id INTEGER NOT NULL REFERENCES colaboradoras(id) ON DELETE CASCADE,
  servicio_id INTEGER NOT NULL REFERENCES servicios(id) ON DELETE CASCADE,
  PRIMARY KEY (colaboradora_id, servicio_id)
);

CREATE TABLE horario_colaboradora (
  colaboradora_id INTEGER NOT NULL REFERENCES colaboradoras(id) ON DELETE CASCADE,
  dia INTEGER NOT NULL CHECK (dia BETWEEN 0 AND 6),
  trabaja INTEGER NOT NULL DEFAULT 1,
  abre INTEGER NOT NULL CHECK (abre BETWEEN 0 AND 1440),
  cierra INTEGER NOT NULL CHECK (cierra BETWEEN 0 AND 1440),
  PRIMARY KEY (colaboradora_id, dia)
);

CREATE TABLE bloqueos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  colaboradora_id INTEGER REFERENCES colaboradoras(id) ON DELETE CASCADE,  -- NULL = todo el spa
  fecha TEXT NOT NULL,
  inicio INTEGER NOT NULL,
  fin INTEGER NOT NULL CHECK (fin > inicio),
  motivo TEXT NOT NULL DEFAULT '',
  creado_por INTEGER,
  creado TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_bloqueos_fecha ON bloqueos(fecha);

CREATE TABLE clientas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  celular TEXT NOT NULL UNIQUE,          -- solo dígitos, con indicativo (57...)
  email TEXT NOT NULL DEFAULT '',
  notas TEXT NOT NULL DEFAULT '',
  creado TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE citas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,
  token TEXT NOT NULL UNIQUE,
  clienta_id INTEGER NOT NULL REFERENCES clientas(id),
  colaboradora_id INTEGER NOT NULL REFERENCES colaboradoras(id),
  fecha TEXT NOT NULL,
  inicio INTEGER NOT NULL,
  fin INTEGER NOT NULL CHECK (fin > inicio),
  estado TEXT NOT NULL DEFAULT 'confirmada' CHECK (estado IN ('confirmada','cancelada','asistio','no_asistio')),
  origen TEXT NOT NULL DEFAULT 'web' CHECK (origen IN ('web','panel','importada')),
  notas TEXT NOT NULL DEFAULT '',
  precio_total INTEGER,
  creado TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_citas_fecha ON citas(fecha, colaboradora_id);
CREATE INDEX idx_citas_clienta ON citas(clienta_id);

CREATE TABLE cita_servicios (
  cita_id INTEGER NOT NULL REFERENCES citas(id) ON DELETE CASCADE,
  servicio_id INTEGER,
  nombre TEXT NOT NULL,
  precio INTEGER,
  duracion INTEGER NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_cita_servicios ON cita_servicios(cita_id);

-- Anti doble reserva: cada cita activa ocupa un renglón por bloque de 5 minutos.
-- La clave primaria impide que dos citas de la misma colaboradora compartan un bloque.
CREATE TABLE cita_slots (
  colaboradora_id INTEGER NOT NULL,
  fecha TEXT NOT NULL,
  minuto INTEGER NOT NULL,
  cita_id INTEGER NOT NULL REFERENCES citas(id) ON DELETE CASCADE,
  PRIMARY KEY (colaboradora_id, fecha, minuto)
) WITHOUT ROWID;
CREATE INDEX idx_slots_cita ON cita_slots(cita_id);

CREATE TABLE sesiones (
  token_hash TEXT PRIMARY KEY,
  colaboradora_id INTEGER NOT NULL REFERENCES colaboradoras(id) ON DELETE CASCADE,
  creado TEXT NOT NULL DEFAULT (datetime('now')),
  expira INTEGER NOT NULL                 -- epoch ms
);

CREATE TABLE intentos (
  clave TEXT PRIMARY KEY,
  conteo INTEGER NOT NULL DEFAULT 0,
  ventana INTEGER NOT NULL,               -- epoch ms de inicio de la ventana
  bloqueado_hasta INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE registro (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL DEFAULT (datetime('now')),
  quien TEXT NOT NULL,
  accion TEXT NOT NULL,
  cita_id INTEGER,
  detalle TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_registro_cita ON registro(cita_id);
