-- Galería por servicio (fotos y videos del spa). Erika las agrega, quita y ordena desde el panel.
CREATE TABLE servicio_medios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  servicio_id INTEGER NOT NULL REFERENCES servicios(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'foto' CHECK (tipo IN ('foto','video')),
  url TEXT NOT NULL,
  portada TEXT NOT NULL DEFAULT '',          -- imagen de portada del video
  orden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_medios_servicio ON servicio_medios(servicio_id, orden);

INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/acrilicas-1-720.webp', '', 0 FROM servicios WHERE slug = 'acrilicas';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/acrilicas-2-720.webp', '', 1 FROM servicios WHERE slug = 'acrilicas';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/acrilicas-3-720.webp', '', 2 FROM servicios WHERE slug = 'acrilicas';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/acrilicas-4-720.webp', '', 3 FROM servicios WHERE slug = 'acrilicas';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/clientas-felices-4-720.webp', '', 0 FROM servicios WHERE slug = 'poligel';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'video', 'https://res.cloudinary.com/deyyiwil0/video/upload/q_auto,f_auto/Press_On_-_Amelia_Nail_Spa_vx58n6.mp4', '/img/press-on-portada-720.webp', 0 FROM servicios WHERE slug = 'press-on';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/press-on-1-720.webp', '', 1 FROM servicios WHERE slug = 'press-on';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/press-on-3-720.webp', '', 2 FROM servicios WHERE slug = 'press-on';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/press-on-4-720.webp', '', 3 FROM servicios WHERE slug = 'press-on';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/press-on-5-720.webp', '', 4 FROM servicios WHERE slug = 'press-on';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/press-on-6-720.webp', '', 5 FROM servicios WHERE slug = 'press-on';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/press-on-7-720.webp', '', 6 FROM servicios WHERE slug = 'press-on';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/press-on-8-720.webp', '', 7 FROM servicios WHERE slug = 'press-on';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/press-on-9-720.webp', '', 8 FROM servicios WHERE slug = 'press-on';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/forrado-1-720.webp', '', 0 FROM servicios WHERE slug = 'forrado';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/forrado-2-720.webp', '', 1 FROM servicios WHERE slug = 'forrado';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/forrado-3-720.webp', '', 2 FROM servicios WHERE slug = 'forrado';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/forrado-4-720.webp', '', 3 FROM servicios WHERE slug = 'forrado';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/forrado-5-720.webp', '', 4 FROM servicios WHERE slug = 'forrado';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/dipping-1-720.webp', '', 0 FROM servicios WHERE slug = 'dipping';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/dipping-2-720.webp', '', 1 FROM servicios WHERE slug = 'dipping';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/dipping-3-720.webp', '', 2 FROM servicios WHERE slug = 'dipping';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/dipping-4-720.webp', '', 3 FROM servicios WHERE slug = 'dipping';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/manicure-semipermanente-1-720.webp', '', 0 FROM servicios WHERE slug = 'semipermanente';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/manicure-semipermanente-2-720.webp', '', 1 FROM servicios WHERE slug = 'semipermanente';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/manicure-semipermanente-3-720.webp', '', 2 FROM servicios WHERE slug = 'semipermanente';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/manicure-semipermanente-4-720.webp', '', 3 FROM servicios WHERE slug = 'semipermanente';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/manicure-semipermanente-6-720.webp', '', 4 FROM servicios WHERE slug = 'semipermanente';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/manicure-semipermanente-7-720.webp', '', 5 FROM servicios WHERE slug = 'semipermanente';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/manicure-semipermanente-8-720.webp', '', 6 FROM servicios WHERE slug = 'semipermanente';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/manicure-semipermanente-9-720.webp', '', 7 FROM servicios WHERE slug = 'semipermanente';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/manicure-semipermanente-10-720.webp', '', 8 FROM servicios WHERE slug = 'semipermanente';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/antes-y-despues-2-720.webp', '', 9 FROM servicios WHERE slug = 'semipermanente';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/antes-y-despues-1-720.webp', '', 10 FROM servicios WHERE slug = 'semipermanente';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/antes-y-despues-5-720.webp', '', 0 FROM servicios WHERE slug = 'tradicional';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/antes-y-despues-4-720.webp', '', 1 FROM servicios WHERE slug = 'tradicional';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/pedicure-720.webp', '', 0 FROM servicios WHERE slug = 'pedi-spa';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'video', 'https://res.cloudinary.com/deyyiwil0/video/upload/q_auto,f_auto/Veloterapia_-_Amelia_Nail_Spa_qoa6ui.mp4', '/img/veloterapia-720.webp', 0 FROM servicios WHERE slug = 'veloterapia';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/veloterapia-720.webp', '', 1 FROM servicios WHERE slug = 'veloterapia';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/hidragloss-antes-720.webp', '', 0 FROM servicios WHERE slug = 'hidragloss';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/hidragloss-despues-720.webp', '', 1 FROM servicios WHERE slug = 'hidragloss';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/servicios-nuevos-3-720.webp', '', 0 FROM servicios WHERE slug = 'limpieza-facial';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/servicios-nuevos-4-720.webp', '', 0 FROM servicios WHERE slug = 'dermapen';
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden) SELECT id, 'foto', '/img/depilacion-cejas-480.webp', '', 0 FROM servicios WHERE slug = 'depilacion-cejas-bozo';

-- Apariencia de la reserva (Erika la cambia en Ajustes → Apariencia).
INSERT OR IGNORE INTO ajustes (clave, valor) VALUES
  ('bienvenida_titulo', 'Reserva tu momento'),
  ('bienvenida_texto', 'Elige tu servicio y la hora que te quede mejor. Sin crear cuenta.'),
  ('color_acento', 'lavanda'),
  ('portada_url', '/img/sede-1-1080.webp');
