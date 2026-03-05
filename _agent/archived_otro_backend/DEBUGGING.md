## 🔧 DEBUGGING & TROUBLESHOOTING

### Common Issues & Solutions

#### ❌ "Cannot find module 'sql.js'"

**Síntoma:**
```
Error: Cannot find module 'sql.js'
  at require
```

**Solución:**
```bash
cd app/backend
npm install

cd ../worker
npm install

# Verificar instalación
npm list sql.js
# Debe mostrar: sql.js@1.13.x
```

---

#### ❌ "Port 3333 already in use"

**Síntoma:**
```
Error: listen EADDRINUSE: address already in use :::3333
```

**Solución 1: Encontrar qué proceso usa el puerto**
```powershell
netstat -ano | findstr :3333
# Nota el PID, luego:
taskkill /PID <PID> /F
```

**Solución 2: Cambiar puerto (en `app/backend/.env`)**
```dotenv
BACKEND_PORT=3334
```

Luego actualizar `test.http`:
```
POST http://localhost:3334/scan
```

---

#### ❌ "Worker no procesa jobs"

**Síntomas:**
- Backend escanea OK (POST /scan devuelve 201)
- Jobs se crean pero quedan en PENDING indefinidamente
- No hay logs en terminal del worker

**Checklist de debug:**

**1. Verificar que worker está corriendo**
```bash
# Terminal del worker debe mostrar:
✓ Worker iniciando...
Config:
  PAYMENT_API_URL: https://www3.interrapidisimo.com/...
  POLL_INTERVAL: 5000ms
✓ Database initialized
✓ Worker loop started (poll every 5000ms)
```

**2. Verificar jobs pendientes**
```http
GET http://localhost:3333/jobs?status=PENDING
```

Debe devolver array no vacío. Si está vacío: problema en POST /scan.

**3. Ver logs del worker**
Después de escanear, esperar 5-10 segundos y revisar terminal del worker. Debe aparecer:
```
📦 Processing 1 pending job(s)...
✓ FETCH_PAYMENT_API success: 1234567890
```

o

```
✗ FETCH_PAYMENT_API failed: 1234567890 - timeout
```

**4. Revisar estado de internet**
```bash
# Terminal del worker debe mostrar cada 30s:
🌐 Internet conectado
(o)
❌ Internet desconectado
```

Si dice "desconectado" y tienes job WAITING_NET: worker lo saltará.

**5. Verificar .env en app/worker/**
```bash
cat app/worker/.env
# Debe tener:
# PAYMENT_API_URL=https://...
# PAYMENT_API_TIMEOUT=10000
# etc
```

Si el archivo no existe, crear desde `.env.example`:
```bash
copy app/worker/.env.example app/worker/.env
```

---

#### ❌ "POST /scan devuelve 400"

**Síntoma:**
```json
{
  "ok": false,
  "errors": [
    "trackingNumber must be 10-15 digits"
  ]
}
```

**Validaciones implementadas:**
1. `trackingNumber`: 10-15 dígitos (regex: `/^\d{10,15}$/`)
2. `deliveryType`: "LOCAL" o "ZONA" (case-sensitive)
3. `zoneId`: si es "ZONA", debe ser positivo e existir
4. `scannedBy`: no vacío, max 100 caracteres

**Checklist:**
```json
{
  "trackingNumber": "1234567890",     // ✅ 10 dígitos
  "deliveryType": "ZONA",              // ✅ exactamente "ZONA" (no "zona")
  "zoneId": 1,                         // ✅ existe en BD
  "scannedBy": "Juan"                  // ✅ no vacío
}
```

---

#### ❌ "GET /jobs devuelve empty array pero escanee guías"

**Problema**: Jobs no se crearon
**Causa común**: POST /scan devolvió error pero no se notó

**Debug:**
```http
GET http://localhost:3333/shipments
```

Si hay shipments pero no jobs → revisar logs de backend en terminal.

**Solución:**
Si POST /scan fallo por `zoneId`, crear zona primero:
```http
POST http://localhost:3333/zones
Content-Type: application/json

{
  "name": "Zona Default"
}
```

Luego rescannear:
```http
POST http://localhost:3333/scan
Content-Type: application/json

{
  "trackingNumber": "1234567890",
  "deliveryType": "ZONA",
  "zoneId": 1,
  "scannedBy": "Admin"
}
```

---

#### ❌ "FETCH_PAYMENT_API falla con timeout"

**Síntoma en worker log:**
```
✗ FETCH_PAYMENT_API failed: 1234567890 - RequestTimeoutError
```

**Causas posibles:**
1. Conexión lenta a InterRapidísimo
2. API down/lenta
3. Timeout muy bajo en `.env`

**Solución:**
En `app/worker/.env`:
```dotenv
PAYMENT_API_TIMEOUT=15000  # Subir a 15 segundos
```

Luego reiniciar worker.

**Verificar conectividad a API manualmente:**
```powershell
# En PowerShell:
$url = "https://www3.interrapidisimo.com/ApiServInter/api/Mensajeria/ObtenerRastreoGuiasClientePost"
$body = @{NumeroGuia = "9700000000"} | ConvertTo-Json
Invoke-WebRequest -Uri $url -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10
```

Si sale error: problema de conectividad o API.

---

#### ❌ "FETCH_PAYMENT_API devuelve anomaly"

**Síntoma en worker log:**
```
⚠️ FETCH_PAYMENT_API anomaly marked: 1234567890 - Missing Guia field
```

**Causas:**
- `Success=false` en respuesta API
- Tracking number no existe en InterRapidísimo
- Respuesta malformada

**Debug:**
1. Verificar que el número de guía existe en InterRapidísimo (web)
2. Ver log del worker: `result.error` indica por qué
3. Shipment se marca como `office_status = ANOMALIA_DATOS` (correcto)
4. Job se marca como DONE (no reintentará)

**Para relanzar:**
```sql
-- En base de datos (después de arreglado el número):
UPDATE shipments SET office_status = 'INGRESADA', api_success = NULL 
  WHERE tracking_number = '1234567890';
INSERT INTO jobs (type, tracking_number, status, attempts, max_attempts, run_after, created_at, updated_at)
  VALUES ('FETCH_PAYMENT_API', '1234567890', 'PENDING', 0, 3, datetime('now'), datetime('now'), datetime('now'));
```

---

#### ❌ "Base de datos corrupta / no persiste"

**Síntoma:**
- Los datos desaparecen después de reiniciar
- Error al abrir `data/app.db`

**Causa**: sql.js requiere save manual (debounce 500ms)

**Verificar:**
```bash
ls -la data/app.db     # Debe existir y tener tamaño > 0
file data/app.db       # Debe ser "SQLite 3.x database"
```

**Si archivo está vacío:**
- Significa que nunca se guardó (posible crash)
- Reiniciar backend: `npm run dev`
- Escanear una guía (gatilla saveDb)
- Verificar `data/app.db` tamaño

**Inspeccionar BD directamente:**
```bash
# Necesitas sqlite3 CLI
sqlite3 data/app.db
sqlite> SELECT COUNT(*) FROM shipments;
sqlite> .schema jobs
sqlite> .quit
```

---

#### ❌ "Worker consume 100% CPU"

**Síntoma:**
- Terminal congelada
- Windows sluggish

**Causa probable**: Loop infinito en `processPendingJobs()`

**Debug:**
1. Ctrl+C para parar worker
2. Revisar logs últimas líneas
3. Ver si hay error no atrapado

**Reportar**:
```
Cola de reproducción:
1. Escanear X guías
2. Worker procesa Y jobs
3. CPU sube a 100%
```

---

### 📋 DEBUGGING CHECKLIST

Para cualquier problema:

```
☐ Verificar Node.js version: node --version (debe ser 20+)
☐ Verificar archivos .env existen en app/backend y app/worker
☐ Verificar directorios existen: app/backend, app/worker, data/
☐ Backend compila: cd app/backend && npm run build
☐ Worker compila: cd app/worker && npm run build
☐ Base de datos existe: ls -la data/app.db
☐ Puerto 3333 no está en uso: netstat -ano | findstr :3333
☐ Internet funciona: ping google.com
☐ Leer ÚLTIMOS 20 LÍNEAS de logs del backend y worker
☐ Probar POST /scan con JSON válido (ver test.http)
☐ Probar GET /jobs después de escanear
☐ Esperar 5 segundos (poll interval)
☐ Ver logs del worker
```

---

### 🔬 INSPECCIONAR BD MANUALMENTE

**Ver todos los shipments:**
```sql
SELECT tracking_number, delivery_type, office_status, api_success, api_last_fetch_at 
FROM shipments 
ORDER BY created_at DESC 
LIMIT 10;
```

**Ver jobs pendientes:**
```sql
SELECT id, type, tracking_number, status, attempts, run_after 
FROM jobs 
WHERE status IN ('PENDING', 'WAITING_NET') 
ORDER BY run_after ASC;
```

**Ver resumen de jobs:**
```sql
SELECT status, COUNT(*) as count 
FROM jobs 
GROUP BY status;
```

**Ver errores últimos:**
```sql
SELECT id, type, tracking_number, status, last_error, attempts 
FROM jobs 
WHERE last_error IS NOT NULL 
ORDER BY updated_at DESC 
LIMIT 5;
```

**Marcar job para reintento (admin):**
```sql
UPDATE jobs 
SET status = 'PENDING', attempts = 0, run_after = datetime('now') 
WHERE id = 123;
```

---

### 📊 LOGS ÚTILES

**Backend startup OK:**
```
✓ Backend listening on port 3333
✓ Database initialized
✓ Schema loaded (zones, shipments, jobs)
```

**POST /scan OK:**
```
POST /scan → 201 Created
shipment 1234567890 created
jobs [FETCH_PAYMENT_API] created
```

**Worker startup OK:**
```
✓ Worker iniciando...
✓ Database initialized
✓ Worker loop started (poll every 5000ms)
```

**Worker procesa job:**
```
📦 Processing 1 pending job(s)...
✓ FETCH_PAYMENT_API success: 1234567890
shipment updated: amount_to_collect = $50000
```

**Worker reintento:**
```
✗ FETCH_PAYMENT_API failed: 1234567890 - RequestTimeoutError
job marked WAITING_NET, retry in 60 seconds (attempt 1/3)
```

---

### 🆘 Si nada funciona

1. **Parar todo:**
   ```bash
   scripts\stop_all.bat
   ```

2. **Limpiar:**
   ```bash
   rm data/app.db
   rm -r app/backend/node_modules
   rm -r app/worker/node_modules
   ```

3. **Reinstalar:**
   ```bash
   pnpm install
   ```

4. **Restart limpio:**
   ```bash
   scripts\start_all.bat
   ```

5. **Probar desde cero:**
   - POST /zones (crear una)
   - POST /scan (escanear guía)
   - GET /jobs (verificar job creado)
   - Esperar 5s
   - GET /jobs/summary (ver si DONE)
   - GET /shipments/{tracking} (ver datos)

---

**¿Sigue fallando?**
- Revisar ARCHITECTURE.md para entender el flujo
- Ver logs completos en terminal
- Verificar que la API de InterRapidísimo está activa
