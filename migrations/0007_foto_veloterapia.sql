-- Veloterapia: foto propia (cuadro del video del spa) si todavía no tiene foto.
UPDATE servicios SET foto = '/img/veloterapia-480.webp' WHERE slug = 'veloterapia' AND (foto IS NULL OR foto = '');
