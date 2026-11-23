# Formato de importación (Kumbio → plataforma de citas)

El Agente 3 (escritorio) extrae de Kumbio y entrega estos CSV (UTF-8, separados por coma, con encabezado).
El importador del panel de Erika (Agente 2) los acepta tal cual. Columnas que no se conozcan van vacías.

**Los archivos con datos de clientas NO se suben a GitHub.** Se guardan en el Drive del spa y se cargan
directamente en el panel (`/panel` → Importar) cuando la plataforma esté en línea.
`servicios.csv` y `colaboradoras.csv` sí se pueden compartir con los agentes (no tienen datos privados de clientas).

## servicios.csv
`categoria,nombre,precio,duracion_min,descripcion,colaboradoras,foto_url`
- `precio`: número en pesos, sin puntos ni signo (ej. `65000`). Si es "desde", poner el mínimo y anotarlo en `descripcion`.
- `colaboradoras`: nombres separados por `|` (ej. `Erika|Laura`).

## colaboradoras.csv
`nombre,celular,rol,servicios,horario`
- `rol`: `propietaria` o `colaboradora`.
- `horario`: ej. `lun-sab 09:00-19:00; dom cerrado`.

## clientas.csv  (privado)
`nombre,celular,email,notas,ultima_visita`

## citas.csv  (privado; solo citas futuras y, si se puede, el historial)
`fecha,hora_inicio,duracion_min,colaboradora,servicio,clienta_nombre,clienta_celular,estado,notas`
- `fecha`: `AAAA-MM-DD`; `hora_inicio`: `HH:MM` (24 h); `estado`: `confirmada`, `cancelada`, `asistio`, `no_asistio`.
