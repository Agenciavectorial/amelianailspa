-- Horario real del spa (confirmado por la dueña): lunes a viernes 9:00 a. m. – 7:00 p. m.,
-- sábados 10:00 a. m. – 7:00 p. m., domingos 11:00 a. m. – 5:00 p. m. Los festivos no se trabaja.
UPDATE horario_spa SET abierto = 1, abre = 540, cierra = 1140 WHERE dia IN (1, 2, 3, 4, 5);
UPDATE horario_spa SET abierto = 1, abre = 600, cierra = 1140 WHERE dia = 6;
UPDATE horario_spa SET abierto = 1, abre = 660, cierra = 1020 WHERE dia = 0;

-- Festivos de Colombia (Ley Emiliani). Erika puede agregar o quitar días en Horario y festivos.
INSERT OR IGNORE INTO festivos (fecha, motivo) VALUES
  ('2026-12-08', 'Inmaculada Concepción'),
  ('2026-12-25', 'Navidad'),
  ('2027-01-01', 'Año Nuevo'),
  ('2027-01-11', 'Reyes Magos'),
  ('2027-03-22', 'San José'),
  ('2027-03-25', 'Jueves Santo'),
  ('2027-03-26', 'Viernes Santo'),
  ('2027-05-01', 'Día del Trabajo'),
  ('2027-05-10', 'Ascensión del Señor'),
  ('2027-05-31', 'Corpus Christi'),
  ('2027-06-07', 'Sagrado Corazón'),
  ('2027-07-05', 'San Pedro y San Pablo'),
  ('2027-07-20', 'Independencia de Colombia'),
  ('2027-08-07', 'Batalla de Boyacá'),
  ('2027-08-16', 'Asunción de la Virgen'),
  ('2027-10-18', 'Día de la Raza'),
  ('2027-11-01', 'Todos los Santos'),
  ('2027-11-15', 'Independencia de Cartagena'),
  ('2027-12-08', 'Inmaculada Concepción'),
  ('2027-12-25', 'Navidad');
UPDATE festivos SET motivo = 'Inmaculada Concepción' WHERE fecha = '2026-12-08' AND motivo = '';
