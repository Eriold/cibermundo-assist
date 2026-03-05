# Inter Ismael – Sistema offline para envios

Sistema 100% local en Windows: escaneo persistente en SQLite (sql.js), cola de trabajos, worker Playwright y APIs de rastreo. Backend y worker comparten el mismo wrapper de base de datos (parámetros posicionales y guardado inmediato).

## Estructura de carpetas

```
inter-ismael/
├─ app/
│  ├─ backend/
│  │  ├─ src/
│  │  │  ├─ app.ts              # Express
│  │  │  ├─ index.ts            # Bootstrap + init DB
│  │  │  ├─ db/
│  │  │  │  ├─ index.ts         # Wrapper sql.js (named binds, save inmediato)
│  │  │  │  └─ schema.ts        # Definición de tablas
│  │  │  └─ routes/             # Rutas REST (scan, shipments, zones, jobs, test)
│  │  ├─ package.json
│  │  └─ tsconfig.json
│  └─ worker/
│     ├─ src/
│     │  ├─ index.ts            # Loop principal (poll jobs)
│     │  ├─ db/index.ts         # Re-exporta el wrapper del backend
│     │  └─ services/
│     │     ├─ jobs.ts          # Procesamiento de jobs
│     │     ├─ paymentWeb.ts    # Playwright (consultas de pago)
│     │     ├─ payment-api.ts   # HTTP API de pago
│     │     ├─ apx-client.ts    # Cliente portal APX
│     │     └─ internet.ts      # Chequeo de conectividad
│     ├─ package.json
│     └─ tsconfig.json
├─ data/
│  ├─ app.db                    # SQLite persistente (sql.js)
│  └─ app.db-journal            # Journal de SQLite (ignorado en git)
├─ scripts/
│  ├─ start_all.bat             # Arranca backend + worker
│  └─ stop_all.bat              # Detiene backend + worker
├─ .env.example                 # Variables de entorno de referencia
├─ .gitignore
└─ README.md
```

## Requerimientos
- Node.js 20+
- pnpm 10+
- Windows (pensado para entorno local)

## Instalación
```bash
pnpm install
```

## Ejecución
Opción recomendada (batch):
```bash
scripts\\start_all.bat
```

Manual en dos terminales:
```bash
pnpm -C app/backend dev
pnpm -C app/worker dev
```

## Configuración

Backend (`app/backend/.env`):
```
BACKEND_PORT=3333
```

Worker (`app/worker/.env`):
```
PAYMENT_API_URL=https://www3.interrapidisimo.com/ApiServInter/api/Mensajeria/ObtenerRastreoGuiasClientePost
PAYMENT_API_TIMEOUT=10000
POLL_INTERVAL=5000
INTERNET_CHECK_INTERVAL=30000
MAX_JOB_ATTEMPTS=3
PAYMENT_WEB_DELAY_MIN=1500
PAYMENT_WEB_DELAY_MAX=3500
```

Notas de persistencia:
- El wrapper `run()` en `db/index.ts` guarda de inmediato (saveDbImmediate) para asegurar que los cambios de estado de jobs/shipment persistan antes del siguiente poll.
- Worker y backend comparten la misma ruta de DB (`data/app.db`).

## Flujo de jobs
1) El backend encola jobs `FETCH_PAYMENT_API` y `FETCH_PORTAL_APX` cuando escaneas/creas envíos.  
2) El worker selecciona el primer `PENDING` con `run_after <= now`, lo marca `RUNNING` de forma atómica y verifica.  
3) Ejecuta Playwright o la API; si es éxito, marca `DONE`; si hay error, aplica backoff (`WAITING_NET` / `PENDING`) o `FAILED`/`NEEDS_HUMAN`.  
4) Cada UPDATE se verifica con `verifyJobStatus` para detectar si SQLite no persistió.

## Endpoints útiles (backend)
- `POST /scan` – ingresa una guía y encola jobs.  
- `GET /jobs` y `GET /jobs/summary` – monitoreo de la cola.  
- `GET /shipments`, `GET /shipments/:tracking` – consulta de envíos.  
- `POST /test/payment` – endpoint de prueba para encolar múltiples guías de pago.

## API backend (detalle)

Base: `http://localhost:3333`

- **/scan**
  - `POST /scan` Body JSON `{ trackingNumber, deliveryType, zoneId?, scannedBy, officeStatus? }`. Valida tracking (10-15 dígitos), crea/actualiza shipment y encola jobs `FETCH_PAYMENT_API` y `FETCH_PORTAL_APX` si no existen activos.
  - `GET /scan/pending` Lista shipments con jobs pendientes/ejecutándose.

- **/shipments**
  - `GET /shipments` Lista todas las guías (orden por `scanned_at` DESC).
  - `GET /shipments/:trackingNumber` Devuelve una guía; 404 si no existe.
  - `GET /shipments/:trackingNumber/jobs` Jobs asociados a la guía.
  - `GET /shipments/export` Exporta CSV con filtros opcionales: `from` (ISO), `to` (ISO), `status` (office_status), `zoneId`, `deliveryType` (`LOCAL`/`ZONA`).

- **/jobs**
  - `GET /jobs` Parámetros opcionales: `status`, `type`, `q` (like por tracking), `limit` (<=1000), `offset`. Devuelve paginación y lista.
  - `GET /jobs/summary` Conteos por `status`, por `type` y combinados; promedio de intentos y cantidad que alcanzaron `max_attempts`.
  - `GET /jobs/:id` Job específico con shipment asociado.
  - `GET /jobs/tracking/:trackingNumber` Todos los jobs de una guía.

- **/zones**
  - `GET /zones?active=1|0` Lista zonas (filtro opcional `active`).
  - `GET /zones/:id` Zona por id.
  - `POST /zones` Crear zona `{ name }` (valida duplicados).
  - `PATCH /zones/:id` Actualiza `name` y/o `active` (boolean/0-1) con validaciones y conflicto por nombre.

- **/test**
  - `POST /test/payment` Body `{ trackingNumbers: string[] }` Encola shipments/jobs de prueba para `FETCH_PAYMENT_API` (sin llamar API externa).
  - `GET /test/payment/results` Últimos resultados de pago (`payment_desc`, `amount_to_collect`, `api_current_state_desc`, `api_last_fetch_at`), máx 200.

## Debug Playwright (worker)
- Escucha `console`, `pageerror`, `requestfailed`, `framenavigated`.
- Hace screenshot tras `goto`: `app/worker/pw-after-goto.png` (ignorado en git).

## Notas adicionales
- `.venv/` se ignora: algunos scripts opcionales pueden usar Python, pero no es necesario para correr backend/worker.
- `data/app.db-journal` y `pw-after-goto.png` están ignorados para evitar ensuciar el repo.

## Comandos rápidos
- Formato dev (watch): `pnpm -C app/backend dev` / `pnpm -C app/worker dev`
- Producción (ejemplo): `pnpm -C app/backend build && pnpm -C app/worker build`

## Troubleshooting rápido
- Job se repite: verifica que la DB esté compartida (`data/app.db`) y que el estado pase a `RUNNING`/`DONE` (logs de worker).
- Timeout en Playwright: revisa los logs de `paymentWeb` y el screenshot `pw-after-goto.png`.
- “Cannot find module sql.js”: reinstala dependencias en backend y worker con pnpm.
