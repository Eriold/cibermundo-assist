## 🏗️ ARQUITECTURA

### Visión General

Sistema de gestión de envíos 100% offline-first, diseñado para una pequeña oficina (Windows local) con:
- Persistencia local en SQLite
- Cola de trabajos automática
- Sincronización asincrónica con APIs públicas
- Detección de conectividad y reintentos inteligentes

### Componentes

```
┌──────────────────────────────────────────────────────────────┐
│                     CLIENT (REST Client)                     │
└──────────────┬───────────────────────────────┬───────────────┘
               │                               │
        ┌──────▼──────┐              ┌─────────▼────────┐
        │   Backend    │              │    Worker        │
        │ (Port 3333)  │              │   (Daemon)       │
        └──────┬──────┘              └─────────┬────────┘
               │                               │
               └───────────┬───────────────────┘
                           │
                    ┌──────▼──────┐
                    │  data/      │
                    │  app.db     │
                    │  (SQLite)   │
                    └─────────────┘
```

### Flujo de Datos

```
1. ESCANEO (Backend)
   POST /scan {trackingNumber, deliveryType, zoneId, scannedBy}
   └─→ INSERT shipments (office_status = INGRESADA)
   └─→ CREATE jobs (type = FETCH_PAYMENT_API, FETCH_PORTAL_APX)
       status = PENDING, attempts = 0, run_after = now()

2. POLLING (Worker - cada 5 segundos)
   getPendingJobs()
   └─→ SELECT * FROM jobs WHERE status IN (PENDING, WAITING_NET) AND run_after <= now

3. PROCESAMIENTO (Worker)
   processFetchPaymentApi()
   ├─→ POST a API (https://www3.interrapidisimo.com/...)
   ├─→ SUCCESS → UPDATE shipments (payment_code, amount_to_collect, api_current_state_*)
   │            UPDATE jobs (status = DONE)
   ├─→ DATA ANOMALY → UPDATE shipments (office_status = ANOMALIA_DATOS)
   │                  UPDATE jobs (status = DONE)
   └─→ NETWORK ERROR → UPDATE jobs (status = WAITING_NET, run_after = now + delay)
                       attempts++, delay = min(60*attempts, 600)s

4. REINTENTOS
   Si WAITING_NET y hay internet:
   ├─→ Intento 1 falla → delay = 60s (1 min)
   ├─→ Intento 2 falla → delay = 120s (2 min)
   └─→ Intento 3 falla → status = FAILED (no más reintentos)
   
   Si WAITING_NET y SIN internet:
   └─→ SKIP (esperar conectividad)
       check cada 30 segundos
```

### Base de Datos (SQLite)

#### Tabla: zones
```sql
CREATE TABLE zones (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL
);
```

#### Tabla: shipments
```sql
CREATE TABLE shipments (
  tracking_number TEXT PRIMARY KEY,
  
  -- Metadata escaneo
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  scanned_at TEXT,
  scanned_by TEXT,
  
  -- Clasificación
  delivery_type TEXT CHECK(delivery_type IN ('LOCAL', 'ZONA')),
  zone_id INTEGER,
  office_status TEXT DEFAULT 'INGRESADA',
  
  -- Datos de pago (desde API InterRapidísimo)
  payment_code TEXT,
  payment_desc TEXT,
  amount_declared REAL,
  amount_total REAL,
  amount_to_collect REAL,
  
  -- Estado desde API
  api_current_state_desc TEXT,
  api_current_city TEXT,
  api_current_state_at TEXT,
  api_success INTEGER,
  api_message TEXT,
  api_last_fetch_at TEXT,
  
  FOREIGN KEY (zone_id) REFERENCES zones(id)
);

CREATE INDEX idx_shipments_office_status ON shipments(office_status);
CREATE INDEX idx_shipments_tracking ON shipments(tracking_number);
```

#### Tabla: jobs
```sql
CREATE TABLE jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL, -- FETCH_PAYMENT_API, FETCH_PORTAL_APX
  tracking_number TEXT NOT NULL,
  status TEXT DEFAULT 'PENDING',
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  run_after TEXT NOT NULL, -- timestamp ISO
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  
  UNIQUE(type, tracking_number, status),
  FOREIGN KEY (tracking_number) REFERENCES shipments(tracking_number)
);

CREATE INDEX idx_jobs_status_run_after ON jobs(status, run_after);
CREATE INDEX idx_jobs_tracking ON jobs(tracking_number);
```

### Módulos Clave

#### Backend

**src/db/index.ts** - Wrapper sql.js
```typescript
initDb()      // Carga/crea BD, ejecuta schema
getDb()       // Retorna singleton
saveDb()      // Debounced 500ms, persiste a data/app.db
run(sql, params)   // Execute
get(sql, params)   // SELECT 1 row
all(sql, params)   // SELECT * rows
```

**src/routes/scan.routes.ts** - POST /scan
- Validación: trackingNumber 10-15 dígitos
- Detección duplicados: si existe → UPDATE, si no → INSERT
- Creación idempotente de jobs: CHECK UNIQUE(type, tracking_number, status)

**src/routes/shipments.routes.ts** - Guías
- GET /: Listar
- GET /:tracking: Detalle
- GET /export: CSV RFC 4180 con filtros

**src/routes/zones.routes.ts** - Zonas
- CRUD completo
- Validación: nombre único, max 100 chars

**src/routes/jobs.routes.ts** - Monitoreo
- GET /: lista con paginación
- GET /summary: estadísticas por status/type

#### Worker

**src/index.ts** - Main loop
```typescript
checkInternetPeriodically()  // DNS a google.com c/30s
processPendingJobs()         // getPendingJobs() + processJob()
```

**src/services/jobs.ts** - Dispatcher
```typescript
getPendingJobs()             // WHERE status IN (PENDING, WAITING_NET) AND run_after <= now
processFetchPaymentApi()     // Llamar payment-api.ts y actualizar shipment/job
processJob()                 // Switch en type
calculateNextRunAfter()      // min(60*attempts, 600)s
markJobDone/Failed()         // Update job status + run_after
```

**src/services/payment-api.ts** - API client
```typescript
buildRequestBody()           // Template support: {trackingNumber} placeholder
fetchPaymentInfo()           // POST, JSON parse, error handling
calculateAmountToCollect()   // Switch IdFormaPago → amount
```

**src/services/internet.ts** - Network
```typescript
checkInternet()              // dns.resolve4("google.com")
```

### Decisiones Técnicas

#### 1. sql.js en lugar de sqlite3
**Problema**: sqlite3 requiere compilación nativa (falla en Windows sin Visual Studio)
**Solución**: sql.js (WebAssembly) - sin dependencias nativas, pero load/save manual
**Trade-off**: Debounce 500ms para batch writes, no soporte para transacciones SQL

#### 2. Node.js + Express en lugar de otros frameworks
**Razón**: Simpleza, estabilidad, fácil testing
**Alternativas rechazadas**: Fastify (overkill), Flask (requiere Python), .NET (más pesado)

#### 3. Worker como daemon separado
**Razón**: Desacople de backend, permite múltiples workers (future)
**Comunicación**: Shared SQLite DB (file-based)
**Ventaja**: Si backend cae, worker sigue procesando jobs

#### 4. Backoff lineal (60*attempts) en lugar de exponencial
**Razón**: Más predecible, máximo 10 minutos
**Fórmula**: delay = min(60*attempts, 600) segundos
**Alternativa rechazada**: 2^attempts (demasiado exponencial, 8+ minutos al 3er intento)

#### 5. Detección de anomalía vs error de red
**Anomalía**: Success=false en API → no retry (datos inválidos)
**Red**: timeout/connection → retry con backoff
```typescript
if (result.isDataAnomaly) {
  markShipmentAnomaly();    // office_status = ANOMALIA_DATOS
  markJobDone(job.id);      // No volver a procesar
} else {
  markJobFailed(job.id);    // Retry con backoff
}
```

#### 6. Env vars en lugar de archivos config
**Razón**: Simple, portátil, sin secrets en código
**Archivos**: `.env` para dev, CI/CD provider para prod

### Configuración de Environment

```
Backend:
  BACKEND_PORT=3333

Worker:
  PAYMENT_API_URL=https://www3.interrapidisimo.com/...
  PAYMENT_API_BODY_TEMPLATE=             (opcional)
  PAYMENT_API_TIMEOUT=10000
  MAX_JOB_ATTEMPTS=3
  POLL_INTERVAL=5000
  INTERNET_CHECK_INTERVAL=30000
```

### Seguridad

✅ **Implementado:**
- Input validation en /scan
- SQL injection prevention (prepared statements con :named params)
- Error handling sin exposición de stack traces

❌ **NO implementado (por diseño - sistema local):**
- Autenticación (sistema local, una máquina)
- Encriptación (datos locales, no públicos)
- HTTPS (localhost)

### Performance

**Benchmarks estimados** (máquina Windows modesta):
- `POST /scan`: ~10-50ms (SQLite write + job creation)
- `GET /jobs`: ~100ms (10 jobs, sin índices sería 1000ms)
- `Worker loop`: 5s poll + 1s per job (API call ~500-2000ms)

**Bottleneck**: API call a InterRapidísimo (~500ms-2000ms por guía)

### Escalabilidad

**Limitaciones actuales:**
- BD SQLite con debounce: OK para < 100k guías
- Worker single-threaded: procesa 1 job a la vez
- Polling: vs event-based (requería messaging queue)

**Para crecer:**
- Múltiples workers en paralelo
- Cambiar a PostgreSQL
- Job queue con Redis/BullMQ
- API Gateway + rate limiting

---

**Diseñado para**: Oficina pequeña (< 1000 guías/día)
**Mantenibilidad**: Alta (código simple, bien documentado)
**Facilidad de debug**: Alta (logs claros, BD inspectable)
