-- Pestañas y cejas: fotos de banco con licencia libre (Unsplash) en lugar del arte de la marca.
-- Solo cambia la foto si sigue siendo el arte (no pisa una foto que Erika ya haya subido).
UPDATE servicios SET foto = '/img/lifting-pestanas-480.webp'       WHERE slug = 'lifting-pestanas'       AND foto LIKE '/img/arte/%';
UPDATE servicios SET foto = '/img/pestanas-punto-a-punto-480.webp' WHERE slug = 'pestanas-punto-a-punto' AND foto LIKE '/img/arte/%';
UPDATE servicios SET foto = '/img/laminado-cejas-480.webp'         WHERE slug = 'laminado-cejas'         AND foto LIKE '/img/arte/%';
UPDATE servicios SET foto = '/img/sombreado-cejas-480.webp'        WHERE slug = 'sombreado-cejas'        AND foto LIKE '/img/arte/%';
