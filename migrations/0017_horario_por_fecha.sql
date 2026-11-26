-- Horario por fecha: Erika arma el horario de cada chica para todo el mes, día por día.
-- Un renglón aquí manda sobre la semana tipo (horario_colaboradora) solo para esa fecha.
-- Sin renglón = semana tipo; sin semana tipo = horario del spa.
CREATE TABLE IF NOT EXISTS horario_fecha (
  colaboradora_id INTEGER NOT NULL REFERENCES colaboradoras(id) ON DELETE CASCADE,
  fecha TEXT NOT NULL,                     -- 'AAAA-MM-DD'
  trabaja INTEGER NOT NULL DEFAULT 1,
  abre INTEGER NOT NULL DEFAULT 0 CHECK (abre BETWEEN 0 AND 1440),
  cierra INTEGER NOT NULL DEFAULT 0 CHECK (cierra BETWEEN 0 AND 1440),
  actualizado TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (colaboradora_id, fecha)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_horario_fecha ON horario_fecha(fecha);
