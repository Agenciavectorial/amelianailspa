# Cuentas (reemplaza el Excel de Erika)

Panel → **Cuentas**. Los datos viven en la base (D1) y se ven iguales en todos los celulares y computadores.

## Quién ve qué

| | Erika (propietaria) | Cada chica |
|---|---|---|
| Ingresos | Todo el spa, por día/semana/mes, por servicio, por chica y por método de pago | Solo lo suyo: hoy, semana, mes |
| Comisiones | Las define (general y por servicio) y ve las de todas | Ve su % y cuánto gana |
| Gastos, metas, deudas | Sí | No |
| Ventas sin cita | Para cualquier chica y cualquier fecha | Solo a su nombre, de hoy o de los 2 días anteriores |

## Comisiones

- Cada chica tiene un **% general** y, si Erika quiere, un **% por servicio** (ese manda).
- Se calculan en **pesos enteros** al registrar el cobro y quedan guardadas ("congeladas"): si Erika cambia un
  porcentaje, lo ya cobrado no cambia. Para recalcular un mes con los % nuevos: Comisiones → "Recalcular este mes".
- En una cita con varios servicios, el cobro se reparte en proporción al precio de cada uno (sin precios, en partes iguales).
- Las propinas son 100 % de la chica y se muestran aparte.

## Utilidad

`utilidad = ingresos − comisiones − costo de materiales − gastos`

El **costo de materiales** se pone en cada servicio (Servicios y combos → editar). Con eso Cuentas muestra la utilidad por
servicio y el **servicio más rentable**. El **ticket promedio** es ingresos ÷ clientas atendidas (cada cita cobrada o venta).

## Gastos hormiga

Gastos pequeños (por defecto de $20.000 o menos) que juntos pesan. Si en el periodo suman más del tope
(por defecto $150.000) sale un aviso con lo que más se repite (ej. "Tinto 12×"). Ambos valores se cambian en
Reglas y módulos.

## Metas y deudas

- **Metas** de ahorro o inversión (ej. "Máquina de pedicure"): objetivo, fecha opcional, aportes (y retiros en negativo).
  Si tiene fecha, dice cuánto ahorrar al mes.
- **Deudas y préstamos** ("yo debo" o "me deben"): total, número de cuotas, día de pago. Muestra saldo, cuotas pagadas y la
  próxima fecha (avisa 3 días antes). Se cierra sola al pagar el total.

## Sincronización

Cada cambio (cobro, venta, gasto, cita…) queda en el registro; los paneles abiertos preguntan cada 20 s y al volver a la app,
y recargan la pantalla. Antes solo se avisaban citas nuevas/movidas/canceladas de *otras* personas: por eso un cobro hecho en un
celular no aparecía en los demás (ni en el computador de la misma persona). Corregido en `/api/panel/novedades`.
