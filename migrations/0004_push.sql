-- Notificaciones push web (VAPID). Una fila por navegador/celular suscrito.
CREATE TABLE push_suscripciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('clienta','equipo')),
  colaboradora_id INTEGER REFERENCES colaboradoras(id) ON DELETE CASCADE,
  clienta_id INTEGER REFERENCES clientas(id) ON DELETE CASCADE,
  creado TEXT NOT NULL DEFAULT (datetime('now')),
  ultimo_envio TEXT,
  fallos INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_push_colab ON push_suscripciones(colaboradora_id);
CREATE INDEX idx_push_clienta ON push_suscripciones(clienta_id);

-- Evita repetir recordatorios (clave como 'r24:15', 'r2:15', 'vuelve:8:2026-11-02').
CREATE TABLE push_enviados (
  clave TEXT PRIMARY KEY,
  creado TEXT NOT NULL DEFAULT (datetime('now'))
);
