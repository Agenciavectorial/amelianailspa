-- Punto de partida tomado de Kumbio (docs/migracion-kumbio/). Todo se puede cambiar después desde el panel.

-- Horario del spa según Kumbio: lun-jue 9-20, vie 10-19, sáb 8-18, dom 11-17 (0 = domingo).
UPDATE horario_spa SET abierto = 1, abre = 540, cierra = 1200 WHERE dia IN (1, 2, 3, 4);
UPDATE horario_spa SET abierto = 1, abre = 600, cierra = 1140 WHERE dia = 5;
UPDATE horario_spa SET abierto = 1, abre = 480, cierra = 1080 WHERE dia = 6;
UPDATE horario_spa SET abierto = 1, abre = 660, cierra = 1020 WHERE dia = 0;

-- Duraciones de Kumbio (Sombreado de cejas no está en Kumbio: conserva 90 min).
UPDATE servicios SET duracion = CASE slug
  WHEN 'acrilicas' THEN 135 WHEN 'poligel' THEN 135 WHEN 'press-on' THEN 105 WHEN 'forrado' THEN 105
  WHEN 'dipping' THEN 105 WHEN 'semipermanente' THEN 75 WHEN 'tradicional' THEN 60 WHEN 'pedi-spa' THEN 30
  WHEN 'lifting-pestanas' THEN 60 WHEN 'pestanas-punto-a-punto' THEN 45 WHEN 'laminado-cejas' THEN 60
  WHEN 'depilacion-cejas-bozo' THEN 60 WHEN 'limpieza-facial' THEN 60 WHEN 'dermapen' THEN 60 WHEN 'hidragloss' THEN 60
  ELSE duracion END;

-- Veloterapia: está en Kumbio y en la página, faltaba en el catálogo.
INSERT INTO servicios (slug, nombre, categoria, descripcion, foto, precio, duracion, visible, orden, ciclo_dias)
SELECT 'veloterapia', 'Veloterapia', 'Uñas',
       'La magia del aceite de vela caliente: hidrata en profundidad y transforma la textura de tus manos en una sola sesión.',
       '', NULL, 60, 1, 9, 30
WHERE NOT EXISTS (SELECT 1 FROM servicios WHERE slug = 'veloterapia');

-- Quién hace qué (Kumbio): Leidy todo; Julieth y Daily uñas; Karla faciales, cejas y pestañas.
DELETE FROM colaboradora_servicios WHERE colaboradora_id IN (SELECT id FROM colaboradoras WHERE slug IN ('leidy', 'julieth', 'daily', 'karla'));
INSERT INTO colaboradora_servicios (colaboradora_id, servicio_id)
  SELECT c.id, s.id FROM colaboradoras c, servicios s WHERE c.slug = 'leidy';
INSERT INTO colaboradora_servicios (colaboradora_id, servicio_id)
  SELECT c.id, s.id FROM colaboradoras c, servicios s WHERE c.slug IN ('julieth', 'daily') AND s.categoria = 'Uñas';
INSERT INTO colaboradora_servicios (colaboradora_id, servicio_id)
  SELECT c.id, s.id FROM colaboradoras c, servicios s WHERE c.slug = 'karla' AND s.categoria IN ('Faciales', 'Pestañas & Cejas');
UPDATE colaboradoras SET cargo = 'Uñas, pestañas, cejas y faciales' WHERE slug = 'leidy';
UPDATE colaboradoras SET cargo = 'Faciales, cejas y pestañas' WHERE slug = 'karla';

-- Enlace directo para dejar reseña en Google (perfil del spa).
UPDATE ajustes SET valor = 'https://search.google.com/local/writereview?placeid=ChIJE1p6ZtApRI4RySgvgmAtowc' WHERE clave = 'resena_url';
