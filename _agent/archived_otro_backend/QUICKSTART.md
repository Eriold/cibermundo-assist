## 🚀 QUICK START

### Requisitos
- Node.js 20+ (verificar: `node --version`)
- pnpm (`npm install -g pnpm`)
- Windows (sistema operativo)

### 1. Instalar dependencias

```bash
cd inter-ismael
pnpm install
```

### 2. Ejecutar en desarrollo

#### Opción A: Scripts .bat (recomendado)
```bash
scripts\start_all.bat
```

#### Opción B: Terminales separadas

**Terminal 1:**
```bash
cd app/backend
npm run dev
```

**Terminal 2 (nuevas terminal):**
```bash
cd app/worker
npm run dev
```

### 3. Probar el sistema

Abrir REST Client (extensión de VS Code) y usar `app/backend/test.http`:

1. **POST /scan** - Escanear guía nueva
2. **GET /zones** - Ver zonas
3. **POST /zones** - Crear zona si no existe
4. **POST /scan** nuevamente con zoneId válido
5. **GET /jobs/summary** - Ver estado de jobs
6. Esperar 5 segundos...
7. **GET /shipments/{tracking}** - Ver datos actualizados desde API

### 4. Estructura de datos

**Guía → Shipments:**
```
tracking_number (PK)
delivery_type: LOCAL | ZONA
zone_id: null | ID zona
office_status: INGRESADA | EN_ZONA | ENTREGADA | etc
payment_code, payment_desc
amount_declared, amount_total, amount_to_collect
api_current_state_desc (desde InterRapidísimo)
```

**Jobs:**
```
id (PK)
type: FETCH_PAYMENT_API | FETCH_PORTAL_APX
status: PENDING | RUNNING | DONE | FAILED | WAITING_NET
attempts: contador de reintentos
run_after: timestamp para next retry
```

### 5. Logs importantes

**Backend (logs de escaneo/API):**
```
✓ Backend listening on port 3333
✓ Database initialized
POST /scan → shipment created/updated
```

**Worker (logs de jobs):**
```
✓ Worker loop started
🌐 Internet conectado/desconectado
✓ FETCH_PAYMENT_API success: {tracking}
✗ FETCH_PAYMENT_API failed: {tracking} - {error}
⚠️ FETCH_PAYMENT_API anomaly: {tracking} - {error}
```

### 6. Configuración (variables de entorno)

**Backend** (`app/backend/.env`):
```
BACKEND_PORT=3333
```

**Worker** (`app/worker/.env`):
```
PAYMENT_API_URL=https://www3.interrapidisimo.com/ApiServInter/api/Mensajeria/ObtenerRastreoGuiasClientePost
PAYMENT_API_TIMEOUT=10000
MAX_JOB_ATTEMPTS=3
POLL_INTERVAL=5000
INTERNET_CHECK_INTERVAL=30000
# PAYMENT_API_BODY_TEMPLATE=  (opcional)
```

### 7. Troubleshooting

**Error: "Cannot find module sql.js"**
```bash
cd app/backend && npm install
cd ../worker && npm install
```

**Worker no procesa jobs**
- Revisar que `.env` en `app/worker/` existe
- Ver logs de worker → buscar `ERROR` o `✗`
- Verificar conectividad: `ping google.com`

**API devuelve 400 en /scan**
- Validar trackingNumber: 10-15 dígitos
- Validar deliveryType: "LOCAL" o "ZONA"
- Si es ZONA: verificar que zoneId existe → `GET /zones`

### 8. Endpoints principales

```
# Escaneo
POST   /scan

# Monitoreo
GET    /shipments
GET    /shipments/{tracking}
GET    /shipments/export

# Jobs
GET    /jobs
GET    /jobs/summary
GET    /jobs/{id}
GET    /jobs/tracking/{tracking}

# Zonas
GET    /zones
POST   /zones
PATCH  /zones/{id}
```

### 9. Próximos pasos

- [ ] Añadir FETCH_PORTAL_APX (Playwright)
- [ ] Dashboard frontend (React + Vite)
- [ ] Notificaciones por correo
- [ ] Backup automático de BD

---

**¿Preguntas?** Ver README.md para documentación completa.
