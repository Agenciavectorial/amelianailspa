-- Galerías de pestañas y cejas: agrega su foto (licencia libre, ver docs/creditos-fotos.md) si aún no está.
-- No toca galerías que Erika ya haya armado con otras fotos: solo agrega esta como primera si falta.
INSERT INTO servicio_medios (servicio_id, tipo, url, portada, orden)
SELECT s.id, 'foto', '/img/' || s.slug || '-720.webp', '', -1
FROM servicios s
WHERE s.slug IN ('lifting-pestanas', 'pestanas-punto-a-punto', 'laminado-cejas', 'sombreado-cejas')
  AND NOT EXISTS (SELECT 1 FROM servicio_medios m WHERE m.servicio_id = s.id AND m.url LIKE '/img/' || s.slug || '-%');
