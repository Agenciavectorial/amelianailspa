-- Fase 2: cobros, analítica, notas, mensajes con plantillas, fidelización y promociones.

-- Ciclo de retorno: cada cuántos días suele volver una clienta por este servicio (NULL = no aplica).
ALTER TABLE servicios ADD COLUMN ciclo_dias INTEGER;
ALTER TABLE colaboradoras ADD COLUMN celular TEXT NOT NULL DEFAULT '';
ALTER TABLE clientas ADD COLUMN cumpleanos TEXT NOT NULL DEFAULT '';      -- 'MM-DD'
ALTER TABLE clientas ADD COLUMN preferencias TEXT NOT NULL DEFAULT '';

UPDATE servicios SET ciclo_dias = CASE slug
  WHEN 'acrilicas' THEN 21 WHEN 'poligel' THEN 21 WHEN 'press-on' THEN 21 WHEN 'forrado' THEN 21
  WHEN 'dipping' THEN 21 WHEN 'semipermanente' THEN 21 WHEN 'tradicional' THEN 15 WHEN 'pedi-spa' THEN 30
  WHEN 'lifting-pestanas' THEN 45 WHEN 'pestanas-punto-a-punto' THEN 18 WHEN 'laminado-cejas' THEN 45
  WHEN 'sombreado-cejas' THEN 60 WHEN 'depilacion-cejas-bozo' THEN 21 WHEN 'limpieza-facial' THEN 30
  WHEN 'dermapen' THEN 30 WHEN 'hidragloss' THEN 30 ELSE NULL END;

-- Cobros (lo que en Kumbio es "Facturar"). Una cita puede tener varios pagos (abono + saldo).
CREATE TABLE pagos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cita_id INTEGER NOT NULL REFERENCES citas(id) ON DELETE CASCADE,
  fecha TEXT NOT NULL,                    -- fecha de la cita (para reportes por día)
  monto INTEGER NOT NULL CHECK (monto >= 0),
  propina INTEGER NOT NULL DEFAULT 0 CHECK (propina >= 0),
  metodo TEXT NOT NULL CHECK (metodo IN ('efectivo','nequi','daviplata','tarjeta','transferencia','otro')),
  nota TEXT NOT NULL DEFAULT '',
  registrado_por INTEGER,
  creado TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_pagos_fecha ON pagos(fecha);
CREATE INDEX idx_pagos_cita ON pagos(cita_id);

-- Notas rápidas del negocio (pedidos de insumos, recados).
CREATE TABLE notas_negocio (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  texto TEXT NOT NULL,
  autor_id INTEGER,
  fijada INTEGER NOT NULL DEFAULT 0,
  hecha INTEGER NOT NULL DEFAULT 0,
  creado TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Plantillas de mensajes editables por Erika. Variables: {nombre} {servicio} {fecha} {hora}
-- {colaboradora} {codigo} {enlace} {resena} {spa} {direccion}
CREATE TABLE plantillas (
  clave TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  texto TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0
);
INSERT INTO plantillas (clave, titulo, texto, orden) VALUES
  ('confirmacion', 'Confirmación', '¡Hola {nombre}! 💜 Tu cita en {spa} quedó confirmada:

• {servicio}
• {fecha} a las {hora}
• Con {colaboradora}
• Código {codigo}

📍 {direccion}
Si necesitas cambiarla: {enlace}', 1),
  ('recordatorio', 'Recordatorio', '¡Hola {nombre}! ✨ Te recordamos tu cita de {servicio} el {fecha} a las {hora} con {colaboradora}. ¡Te esperamos! Si no puedes venir, avísanos o cámbiala aquí: {enlace}', 2),
  ('cambio', 'Cambio de cita', 'Hola {nombre}, tu cita quedó para el {fecha} a las {hora} con {colaboradora} ({servicio}). Código {codigo}. Cualquier cosa nos escribes 💜', 3),
  ('cancelacion', 'Cancelación', 'Hola {nombre}, tu cita de {servicio} del {fecha} a las {hora} quedó cancelada. Cuando quieras volver a agendar: https://amelianailspa.com/reservar 💜', 4),
  ('gracias', 'Gracias + reseña', '¡Gracias por visitarnos, {nombre}! 💅 Fue un gusto atenderte. Si te encantó, nos ayudas muchísimo con una reseña en Google: {resena}', 5),
  ('vuelve', 'Te toca volver', '¡Hola {nombre}! 💜 Ya va siendo hora de consentirte otra vez con tu {servicio}. ¿Te agendamos con {colaboradora}? Reserva en un toque: {enlace}', 6);

-- Registro de mensajes enviados desde el panel (para contarlos y no repetir).
CREATE TABLE mensajes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clienta_id INTEGER REFERENCES clientas(id) ON DELETE CASCADE,
  cita_id INTEGER,
  tipo TEXT NOT NULL,
  canal TEXT NOT NULL DEFAULT 'whatsapp',
  quien TEXT NOT NULL,
  creado TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_mensajes_clienta ON mensajes(clienta_id, tipo);

-- Promociones visibles en la app de la clienta.
CREATE TABLE promociones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  foto TEXT NOT NULL DEFAULT '',
  servicio_id INTEGER REFERENCES servicios(id) ON DELETE SET NULL,
  precio_promo INTEGER,
  desde TEXT NOT NULL DEFAULT '',          -- '' = desde ya
  hasta TEXT NOT NULL DEFAULT '',          -- '' = sin fin
  activa INTEGER NOT NULL DEFAULT 1,
  orden INTEGER NOT NULL DEFAULT 0
);

INSERT INTO ajustes (clave, valor) VALUES
  ('resena_url', 'https://www.google.com/search?q=Amelia+Nail+Spa+Medell%C3%ADn'),
  ('dias_inactiva', '90');
