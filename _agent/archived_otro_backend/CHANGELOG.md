## 📝 CHANGELOG - Implementación Completa Worker

### ✅ Sesión Actual - Database Persistence Fix

#### 1. Worker: services/jobs.ts - Database Verification Fix 🔧 CRÍTICO
- **Problema**: Job status verification queries returning `undefined` después de UPDATE
- **Causa raíz**: Named parameter binding (`{ id }`) con placeholders `?` no funcionaba en sql.js
- **Solución implementada**:
  1. ✅ Creada función helper `verifyJobStatus(jobId, expectedStatus)` robusta:
     - Usa `all()` con concatenación SQL: `WHERE id = ${Number(jobId)}` (evita binding)
     - Retorna `false` si row no encontrado o status no coincide
     - Añade debug logging: snapshot de jobs table cuando falla
     - Wrapper try-catch para evitar crashes
  
  2. ✅ Reemplazadas TODAS las verificaciones de jobs:
     - Success case (DONE status): Utiliza `verifyJobStatus(id, "DONE")`
     - Data anomaly case (DONE status): Utiliza `verifyJobStatus(id, "DONE")`
     - Error case - Max retries (FAILED status): Utiliza `verifyJobStatus(id, "FAILED")`
     - Error case - Retry pending (PENDING status): Utiliza `verifyJobStatus(id, "PENDING")`
  
  3. ✅ Asegurado `saveDbImmediate()` después de CADA UPDATE crítico:
     - UPDATE → DONE (2 lugares: success + anomaly)
     - UPDATE → FAILED (error with max retries)
     - UPDATE → PENDING (error with retry)

- **Resultado**: Logs now show actual DB state via `[DEBUG] jobs snapshot:` cuando verificación falla
- **Testing**: Pronto - queue tracking numbers via /test/payment y verificar DB state en DB Browser

---

### ✅ Sesión Previa - Slow Network Optimization

#### 1. Worker: services/paymentWeb.ts 🚀 OPTIMIZADO
- **Cambio**: Aumentadas timeouts de Playwright para conexiones lentas
  - Default timeout: 20 segundos (fue 10s)
  - Navigation timeout: 30 segundos (fue 15s)
  - Retry logic: 2 intentos máximo on timeout
  - Logs: "[PAYMENT_PW] waiting response (slow network mode)"
  - Logs: "[PAYMENT_PW] retry due to slow connection"

#### 2. Worker: src/index.ts 🌍 DELAYS AUMENTADOS
- **PAYMENT_WEB_DELAY_MIN**: 1000ms (fue 300ms)
- **PAYMENT_WEB_DELAY_MAX**: 2000ms (fue 600ms)
- **Justificación**: Ping > 300ms, conexión inestable de cliente
- **Startup log**: Incluye "(SLOW NETWORK MODE)" + timeouts config

---

### ✅ Completado en sesión anterior

#### PARTE 1: FETCH_PAYMENT_API ✅ (sesión anterior)

- Implementar POST a InterRapidísimo API
- Soportar body templates via ENV
- Calcular amount_to_collect
- Distinguir anomalías vs errores de red
- Reintentos con backoff lineal

#### PARTE 2: FETCH_PORTAL_APX ✅ (sesión actual)

### ✅ Completado en esta sesión

#### 1. Worker: services/payment-api.ts ⭐ NUEVO
- **Archivo**: `app/worker/src/services/payment-api.ts`
- **Cambio principal**: Implementar POST (no GET) a InterRapidísimo API
- **Features**:
  - `buildRequestBody()`: Soporta custom body templates vía ENV var
  - `fetchPaymentInfo()`: POST con timeout configurable
  - Parseo completo de respuesta JSON: Guia.FormasPago[0], TrazaGuia.*, etc
  - `calculateAmountToCollect()`: Lógica de pago según IdFormaPago (1→0, 2→decl, 3→total)
  - Distingue **anomalía de datos** (Success=false) vs **error de red** (timeout)
  - Retorna objeto normalizado con `success`, `data`, `error`, `isDataAnomaly`

**URL API**: https://www3.interrapidisimo.com/ApiServInter/api/Mensajeria/ObtenerRastreoGuiasClientePost

**Body default**: `{"NumeroGuia": "{trackingNumber}"}`

**Custom body**: Vía `PAYMENT_API_BODY_TEMPLATE` env var (ej: `{"numeroGuia": "{trackingNumber}", "incluir": true}`)

---

#### 2. Worker: services/jobs.ts 🔄 ACTUALIZADO
- **Cambios**:
  - ❌ Removida importación de `calculateNextRunAfter` desde `internet.ts`
  - ✅ Implementada función `calculateNextRunAfter(attempts)` local con backoff lineal
  - ✅ Actualizada firma `processFetchPaymentApi()`: ahora recibe `(job, apiUrl, bodyTemplate, apiTimeout)`
  - ✅ Actualizada llamada a `fetchPaymentInfo()` con parámetro `bodyTemplate`
  - ✅ Mejorado manejo de respuesta: diferencia anomalías de errores de red
  - ✅ Actualizada función `processJob()`: config tiene `{apiUrl, bodyTemplate, apiTimeout}`

**Backoff formula**: `delay = min(60 * attempts, 600) segundos`
- Intento 1: 60s
- Intento 2: 120s
- Intento 3: 180s
- MAX: 600s (10 minutos)

---

#### 3. Worker: index.ts 🔄 ACTUALIZADO
- ❌ Removida importación de `calculateNextRunAfter`
- ✅ Cambio de env vars:
  - `PAYMENT_API_URL_TEMPLATE` → `PAYMENT_API_URL`
  - ✅ Agregada `PAYMENT_API_BODY_TEMPLATE` (opcional)
- ✅ Actualizada llamada a `processJob()` con nuevos parámetros

**Config mostrada al iniciar:**
```
PAYMENT_API_URL: https://...
PAYMENT_API_BODY_TEMPLATE: (default)
PAYMENT_API_TIMEOUT: 10000ms
```

---

#### 4. Worker: .env.example 📋 ACTUALIZADO
- ✅ Documentación clara de variables
- ✅ Default para InterRapidísimo API
- ✅ Explicación de `PAYMENT_API_BODY_TEMPLATE`
- ✅ Valores recomendados para timeout/reintentos

---

#### 5. Worker: .env 🆕 NUEVO
- Archivo de configuración local (dev)
- Preconfigurado con valores default

---

#### 6. Backend: .env.example 🆕 NUEVO
- Mínima configuración (BACKEND_PORT)

---

#### 7. Backend: .env 🆕 NUEVO
- Archivo de configuración local (dev)

---

#### 8. README.md 📖 REESCRITO COMPLETAMENTE
- ✅ Arquitectura clara con diagrama
- ✅ Flujo de trabajo paso a paso
- ✅ Stack actualizado (sql.js, Node 20+, ESM)
- ✅ Estructura de directorios detallada
- ✅ Ejemplos de endpoints con curl/REST Client
- ✅ Configuración por componente
- ✅ Tabla de reglas de pago
- ✅ Sección de troubleshooting
- ✅ Próximos pasos

---

#### 9. QUICKSTART.md 🆕 NUEVO
- 9 secciones paso-a-paso para novatos
- Cómo instalar, ejecutar, testear
- Mapeo de datos (shipments vs jobs)
- Logs importantes a buscar
- Endpoints principales

---

#### 10. ARCHITECTURE.md 🆕 NUEVO
- Diagrama completo del sistema
- Flujo de datos 4 pasos
- Esquema SQL detallado
- Descripción de módulos
- Decisiones técnicas justificadas
- Performance benchmarks
- Escalabilidad futura

---

#### 11. DEBUGGING.md 🆕 NUEVO
- Soluciones a 10+ problemas comunes
- Checklist de debug
- Queries SQL útiles
- Cómo inspeccionar BD manualmente
- Logs esperados en cada caso
- "Reset limpio" si todo falla

---

#### 12. scripts/start_all.bat 🔄 MEJORADO
- ✅ Lógica robusta
- ✅ Inicia backend y worker en ventanas separadas
- ✅ Espera 2 segundos entre procesos
- ✅ Mostrar mensajes de éxito
- ✅ Instrucciones finales al usuario

---

#### 13. scripts/stop_all.bat 🔄 MEJORADO
- ✅ Cierra ventanas por nombre ("Inter Ismael")
- ✅ Fallback a taskkill node.exe
- ✅ Mensaje de confirmación

---

#### 14. app/backend/test.http 📝 REESCRITO
- ✅ 7 secciones organizadas
- ✅ 50+ ejemplos de requests/responses
- ✅ Ejemplos de error (validación)
- ✅ Filtros y paginación
- ✅ Flujo completo de prueba paso a paso
- ✅ Comentarios explicativos

---

### 🎯 Funcionalidad Implementada

#### Estado FETCH_PAYMENT_API
```
PENDING
  ↓ (worker poll, c/5s)
POST a https://www3.interrapidisimo.com/...
  ├─ SUCCESS
  │  └─→ DONE (shipment actualizado)
  │
  ├─ DATA ANOMALY (Success=false)
  │  └─→ DONE (shipment marcado ANOMALIA_DATOS)
  │
  └─ NETWORK ERROR
     └─→ WAITING_NET (retry con backoff)
```

#### Estados de Job
- `PENDING`: Listo para procesar
- `WAITING_NET`: Esperando retry (internet o delay)
- `DONE`: Completado exitosamente
- `FAILED`: Máximo de reintentos alcanzado

#### Campos Actualizados en Shipment
Cuando `FETCH_PAYMENT_API` SUCCESS:
```sql
payment_code              -- Código forma de pago
payment_desc              -- Descripción
amount_declared           -- Valor declarado
amount_total              -- Valor total
amount_to_collect         -- Amount a cobrar (cálculo)
api_current_state_desc    -- Estado desde API
api_current_city          -- Ciudad actual
api_current_state_at      -- Fecha/hora estado
api_success               -- 1
api_message               -- Mensaje
api_last_fetch_at         -- Timestamp último fetch
```

---

### 🔧 Variables de Entorno Nuevas

#### Backend (app/backend/.env)
```
BACKEND_PORT=3333
```

#### Worker (app/worker/.env)
```
PAYMENT_API_URL=https://www3.interrapidisimo.com/ApiServInter/api/Mensajeria/ObtenerRastreoGuiasClientePost
PAYMENT_API_BODY_TEMPLATE=                    # Opcional
PAYMENT_API_TIMEOUT=10000
MAX_JOB_ATTEMPTS=3
POLL_INTERVAL=5000
INTERNET_CHECK_INTERVAL=30000
```

---

### ✅ Testing Checklist

Para verificar que todo funciona:

```
☐ Backend compila: npm run build (en app/backend)
☐ Worker compila: npm run build (en app/worker)
☐ Backend inicia: npm run dev (en app/backend)
  → Debe mostrar: ✓ Backend listening on port 3333
☐ Worker inicia: npm run dev (en app/worker)
  → Debe mostrar: ✓ Worker loop started (poll every 5000ms)
☐ POST /scan exitoso
  → Debe devolver: 201 Created, action: "created"
☐ GET /jobs muestra job PENDING
☐ Esperar 5 segundos
☐ Worker log muestra: ✓ FETCH_PAYMENT_API success: ...
  O: ✗ FETCH_PAYMENT_API failed: ... (si API está offline)
☐ GET /jobs muestra job DONE
☐ GET /shipments/{tracking} muestra amount_to_collect
```

---

### 📊 Diferencias vs Versión Anterior

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| API Method | GET (template) | POST |
| Body template | N/A | Soportado |
| Timeout configurable | Hardcoded | Via ENV |
| Backoff | Exponencial? | Lineal min(60*a, 600) |
| Anomalía vs error | No diferenciaba | Diferencia clara |
| Signature processFetchPaymentApi | (job, template, timeout) | (job, url, template, timeout) |
| calculateNextRunAfter | internet.ts | jobs.ts local |

---

### 🚀 Próximas Features (Out of scope)

- [ ] FETCH_PORTAL_APX (Playwright)
- [ ] Dashboard Frontend (React + Vite)
- [ ] Notificaciones por email
- [ ] Backup automático de BD
- [ ] Múltiples workers en paralelo

---

### 🎓 Arquitectura Resultante

```
┌─────────────────────────────────────┐
│     Usuario (REST Client/Postman)   │
└──────────────┬──────────────────────┘
               │ HTTP
┌──────────────▼──────────────────────┐
│         BACKEND                     │
│  Express on :3333                   │
│  - POST /scan (validate)            │
│  - GET /shipments (list)            │
│  - POST /zones (CRUD)               │
│  - GET /jobs (monitor)              │
└──────────────┬──────────────────────┘
               │ Read/Write
┌──────────────▼──────────────────────┐
│      SQLite via sql.js              │
│      (data/app.db)                  │
│  - shipments table                  │
│  - jobs table                       │
│  - zones table                      │
└──────────────┬──────────────────────┘
               │ Read/Write
┌──────────────▼──────────────────────┐
│         WORKER DAEMON               │
│  Node.js process                    │
│  - Poll jobs c/5s                   │
│  - Check internet c/30s             │
│  - POST to InterRapidísimo API      │
│  - Update shipments                 │
│  - Handle retries (backoff)         │
└─────────────────────────────────────┘
```

---

### 💡 Notas Técnicas

1. **sql.js Debounce**: 500ms para batch writes, no soporte nativo para transactions
2. **Worker Async**: fetch a API es async, pero update a BD es sync (bottleneck)
3. **Polling vs Events**: Polling es simple, pero Event-based con Redis sería mejor para scale
4. **Error Handling**: Diferencia clara entre anomalías de datos vs fallos de red
5. **Offline-first**: Funciona 100% offline, sincroniza cuando hay internet

---

**Fecha completación**: 2024
**Status**: ✅ FETCH_PAYMENT_API Completa
**Próximo**: FETCH_PORTAL_APX o Frontend
