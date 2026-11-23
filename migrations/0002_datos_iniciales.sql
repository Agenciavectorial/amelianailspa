-- Datos iniciales tomados de la página pública (public/index.html).
-- Sin PIN (Erika lo crea con CLAVE_INICIAL; ella crea los de las chicas) y sin clientas.
-- Precios en NULL ("a consultar") hasta importar los reales desde Kumbio.

INSERT INTO ajustes (clave, valor) VALUES
  ('anticipacion_min', '120'),
  ('ventana_dias', '60'),
  ('intervalo_min', '15'),
  ('cancelacion_horas', '4'),
  ('max_citas_por_celular', '3'),
  ('whatsapp', '573107027012'),
  ('nombre_spa', 'Amelia Nail Spa'),
  ('direccion', 'Cra 51D #71-125, Local 71-125, C.C. Bosque Plaza, Aranjuez, Medellín'),
  ('politica_texto', 'Puedes cancelar o reprogramar tu cita desde tu enlace privado hasta 4 horas antes. Si vas a llegar tarde, escríbenos por WhatsApp.');

-- 0 = domingo. Lunes a viernes 9:00–19:00, sábado 10:00–19:00, domingo 11:00–17:00.
INSERT INTO horario_spa (dia, abierto, abre, cierra) VALUES
  (0,1,660,1020),(1,1,540,1140),(2,1,540,1140),(3,1,540,1140),(4,1,540,1140),(5,1,540,1140),(6,1,600,1140);

INSERT INTO servicios (slug, nombre, categoria, descripcion, foto, precio, duracion, visible, orden) VALUES
  ('acrilicas', 'Acrílicas', 'Uñas', 'Esculpidas sobre tu uña natural, sin tips. Personaliza largo, forma y diseño. Resistentes y elegantes por semanas.', 'https://res.cloudinary.com/dcuvpsgao/image/upload/q_auto,f_auto,w_640/v1781652160/Acr%C3%ADlicas_1_tuqhnz.jpg', NULL, 120, 1, 1),
  ('poligel', 'Poligel', 'Uñas', 'La fuerza del acrílico + la flexibilidad del gel. Ligero, duradero y natural. Lo mejor de dos mundos.', 'https://res.cloudinary.com/deyyiwil0/image/upload/q_auto,f_auto,w_640/Amelia_Nail_Spa_-_Clientas_Felices_4_v9kchc.webp', NULL, 120, 1, 2),
  ('press-on', 'Press On', 'Uñas', 'Manicura lista en minutos. Duración de 2–3 semanas, aplicación rápida y retiro sencillo.', 'https://res.cloudinary.com/dcuvpsgao/image/upload/q_auto,f_auto,w_640/v1781652164/Press_on_1_lffysf.jpg', NULL, 45, 1, 3),
  ('forrado', 'Forrado', 'Uñas', 'Capa protectora sobre tu uña natural. Previene quiebres, aporta brillo y resistencia sin volumen extra.', 'https://res.cloudinary.com/dcuvpsgao/image/upload/q_auto,f_auto,w_640/v1781652161/Forrado_1_jbkuqc.jpg', NULL, 60, 1, 4),
  ('dipping', 'Dipping', 'Uñas', 'Polvos de color capa a capa, sin lámpara UV/LED. Resistente, natural y ligero con acabado impecable.', 'https://res.cloudinary.com/dcuvpsgao/image/upload/q_auto,f_auto,w_640/v1781652161/Dipping_1_tcibph.jpg', NULL, 90, 1, 5),
  ('semipermanente', 'Semipermanente', 'Uñas', 'Color vibrante y brillo impecable por hasta 3 semanas. Técnica UV/LED profesional.', 'https://res.cloudinary.com/dcuvpsgao/image/upload/q_auto,f_auto,w_640/v1781652162/Manicure_semipermanente_1_r99gn4.jpg', NULL, 75, 1, 6),
  ('tradicional', 'Tradicional Manos/Pies', 'Uñas', 'Manicure y pedicure clásico en un solo tono o francés, con cuidado de cutículas, hidratación y acabado limpio.', 'https://res.cloudinary.com/dcuvpsgao/image/upload/q_auto,f_auto,w_640/v1781652162/Manicure_semipermanente_1_r99gn4.jpg', NULL, 50, 1, 7),
  ('pedi-spa', 'Pedi Spa', 'Uñas', 'Relajación total: Jelly nail, bomba espumosa, sales terapéuticas y batido exfoliante para pies perfectos.', 'https://res.cloudinary.com/deyyiwil0/image/upload/q_auto,f_auto,w_640/Pedicure_utwoq0.png', NULL, 75, 1, 8),
  ('lifting-pestanas', 'Lifting de Pestañas', 'Pestañas & Cejas', 'Eleva tus pestañas naturales desde la raíz. Mayor longitud, curvatura y volumen sin extensiones. Dura 6–8 semanas.', 'https://catalinajaramillo.com/cdn/shop/files/Lifting_de_pestanas_Catalina_Jaramillo_5.png?v=1730397186&width=640', NULL, 75, 1, 9),
  ('pestanas-punto-a-punto', 'Pestañas Punto a Punto', 'Pestañas & Cejas', 'Extensiones individuales colocadas una por una. Look elegante y glamuroso adaptado a tu estilo.', 'https://maquillajeimportadocolombia.com/wp-content/uploads/2024/05/IndividualesClassic01.jpeg', NULL, 120, 1, 10),
  ('laminado-cejas', 'Laminado de Cejas', 'Pestañas & Cejas', 'Peina y fija tus vellos en la dirección ideal. Define y enmarca tu mirada sin maquillaje diario.', 'https://esteticadelamirada.es/wp-content/uploads/2024/11/Laminado-despues.jpg', NULL, 60, 1, 11),
  ('sombreado-cejas', 'Sombreado de Cejas', 'Pestañas & Cejas', 'Técnica semipermanente con acabado suave y difuminado. Más densidad y uniformidad de larga duración.', 'https://static.wixstatic.com/media/96ea06_e129a4dff5de4d648b6aabdbca588daa~mv2.jpg/v1/fill/w_480,h_360,al_c,q_80,enc_avif,quality_auto/96ea06_e129a4dff5de4d648b6aabdbca588daa~mv2.jpg', NULL, 90, 1, 12),
  ('depilacion-cejas-bozo', 'Depilación Cejas/Bozo', 'Pestañas & Cejas', 'Depilación de precisión adaptada a tus facciones. Cejas definidas y bozo con acabado limpio y discreto.', 'https://i.ytimg.com/vi/rN12hTsD12s/hqdefault.jpg', NULL, 20, 1, 13),
  ('limpieza-facial', 'Limpieza Facial Profunda', 'Faciales', 'Elimina impurezas, limpia poros y renueva tu piel para dejarla fresca y equilibrada.', 'https://res.cloudinary.com/deyyiwil0/image/upload/q_auto,f_auto,w_640/v1776808337/Servicios_Nuevos_Amelia_Nail_Spa_3_z8xc98.jpg', NULL, 75, 1, 14),
  ('dermapen', 'Dermapen', 'Faciales', 'Microperforaciones controladas que estimulan colágeno, mejoran textura y dejan tu piel más firme y uniforme.', 'https://res.cloudinary.com/deyyiwil0/image/upload/q_auto,f_auto,w_640/v1776808337/Servicios_Nuevos_Amelia_Nail_Spa_4_eadfsj.jpg', NULL, 75, 1, 15),
  ('hidragloss', 'Hidragloss', 'Faciales', 'Tratamiento hidratante con efecto "piel jugosa". Brillo, suavidad y luminosidad inmediata en tu rostro.', 'https://res.cloudinary.com/dcuvpsgao/image/upload/q_auto,f_auto,w_640/v1781652162/Hidragloss_Despues_vx8pfa.jpg', NULL, 60, 1, 16);

INSERT INTO colaboradoras (slug, nombre, rol, cargo, foto, color, agenda, permisos, orden) VALUES
  ('erika', 'Erika', 'propietaria', 'CEO · Amelia Nail Spa', 'https://res.cloudinary.com/dcuvpsgao/image/upload/q_auto,f_auto,w_400/v1782243576/Erika_xuhltz.jpg', '#7A6494', 0, '{"gestionar_citas":true,"gestionar_bloqueos":true,"editar_horario":false,"ver_agenda_equipo":false,"ver_clientas":false}', 0),
  ('leidy', 'Leidy', 'colaboradora', 'Uñas acrílicas', 'https://res.cloudinary.com/dcuvpsgao/image/upload/q_auto,f_auto,w_400/v1782243581/Leidy.jpg_xdyf10.jpg', '#C2185B', 1, '{"gestionar_citas":true,"gestionar_bloqueos":true,"editar_horario":false,"ver_agenda_equipo":false,"ver_clientas":false}', 1),
  ('karla', 'Karla', 'colaboradora', 'Dipping & nail art', 'https://res.cloudinary.com/dcuvpsgao/image/upload/q_auto,f_auto,w_400/v1782243580/Karla.jpg_ri1j8n.jpg', '#00897B', 1, '{"gestionar_citas":true,"gestionar_bloqueos":true,"editar_horario":false,"ver_agenda_equipo":false,"ver_clientas":false}', 2),
  ('julieth', 'Julieth', 'colaboradora', 'Nail art', 'https://res.cloudinary.com/dcuvpsgao/image/upload/q_auto,f_auto,w_400/v1782243580/Julieth.jpg_lvwfga.jpg', '#F57C00', 1, '{"gestionar_citas":true,"gestionar_bloqueos":true,"editar_horario":false,"ver_agenda_equipo":false,"ver_clientas":false}', 3),
  ('darly', 'Darly', 'colaboradora', 'Manicurista', 'https://res.cloudinary.com/dcuvpsgao/image/upload/q_auto,f_auto,w_400/v1783125605/Chica_Nueva_broknl.jpg', '#3949AB', 1, '{"gestionar_citas":true,"gestionar_bloqueos":true,"editar_horario":false,"ver_agenda_equipo":false,"ver_clientas":false}', 4);

-- Por defecto las cuatro manicuristas hacen todos los servicios (Erika lo ajusta en el panel).
INSERT INTO colaboradora_servicios (colaboradora_id, servicio_id)
  SELECT c.id, s.id FROM colaboradoras c, servicios s WHERE c.agenda = 1;
