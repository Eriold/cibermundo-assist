# Cibermundo Assist

Monorepo para operar una oficina de Interrapidisimo con enfoque offline-first. El sistema permite registrar guias rapidamente, consultar su valor y estado, recuperar destinatario y gestiones desde APX, y administrar el historial operativo desde una interfaz web.

## Objetivo

Este proyecto busca quitar el cuello de botella al recibir muchos paquetes en una oficina tipo franquicia o sucursal interna. La aplicacion permite:

- registrar guias por lector o digitacion
- saber quien registro cada paquete y en que zona quedo
- consultar valor, estado, destinatario y flujo de gestiones
- operar aun con intermitencia de red
- administrar guias abiertas, cerradas y archivadas
- dejar la base lista para futuras integraciones, como mensajeria por WhatsApp

## Arquitectura

El repositorio esta dividido en tres modulos principales:

1. `backend`
   API Express con SQLite. Recibe escaneos, guarda shipments, expone catalogos, usuarios, zonas, historial, detalle y operaciones administrativas.

2. `frontend`
   Aplicacion React + Vite. Incluye login, seleccion de zona, flujo de escaneo y panel administrativo con filtros, paginacion, modales y exportacion.

3. `worker`
   Proceso en background que atiende jobs. Consulta primero la web publica de Interrapidisimo para valor y estado del envio, y luego APX autenticado para destinatario, telefono y flujo de guia.

## Flujo operativo

Cuando se escanea una guia:

1. el backend crea o actualiza el shipment
2. se encola el job para consultar valor y estado
3. el worker consulta la web publica
4. luego se procesa APX para traer destinatario, telefono y flujo
5. la informacion queda disponible en historial, tabla administrativa y modal de detalle

## Caracteristicas principales

- operacion offline-first en frontend usando IndexedDB con Dexie
- login de usuarios y seleccion de zona
- CRUD de usuarios, zonas, estados y gestiones
- historial paginado con filtros por contexto operativo
- exportacion CSV
- separacion entre guias abiertas y archivadas/cerradas
- calculo de conteos de gestiones `G0-G3`
- recarga forzada de gestiones desde la UI
- persistencia de flujo de guia y `gestion_count`
- reapertura de guias archivadas si dejan de estar cerradas
- eliminacion administrativa de guias activas o archivadas
- modo local con datos fake cuando `ENABLE_APX_SCRAPER=false`

## Estructura del repositorio

```text
adm-rep/
|- backend/        # API, base de datos y logica de negocio
|- frontend/       # Aplicacion React + Vite
|- worker/         # Procesamiento de jobs y scraping
|- _agent/         # Memoria del proyecto y documentacion de apoyo
|- dist/           # Artefactos generados en raiz
|- src/            # Archivos auxiliares en raiz
|- .env
|- .env.example
|- package.json
`- README.md
```

## Variables operativas importantes

### Worker / integraciones

- `ENABLE_APX_SCRAPER=false|true`
  - `false`: no entra a APX y permite trabajar localmente con datos mock
  - `true`: habilita scraping autenticado para destinatario y gestiones
- `HEADLESS=false|true`
  - `false`: muestra navegador para depuracion
  - `true`: ejecucion normal en segundo plano
- `APX_URL`
- `APX_USER`
- `APX_PASS`
- `APX_SCRAPE_DELAY_MS`
- `PAYMENT_API_URL`

## Desarrollo local

Instalar dependencias del monorepo:

```bash
npm run install:all
```

Ese comando instala primero con `ignore-scripts=true` y luego ejecuta solo la allowlist del proyecto para `esbuild`, `@swc/core`, `better-sqlite3`, `puppeteer` y `playwright`.

Si instalas un modulo por separado, el flujo queda asi:

```bash
npm install --prefix backend
npm run install:trusted --prefix backend

npm install --prefix worker
npm run install:trusted --prefix worker

npm install --prefix frontend
npm run install:trusted --prefix frontend
```

Levantar todo en modo desarrollo:

```bash
npm run dev
```

Levantar todo en modo start:

```bash
npm run start
```

Compilar todos los modulos:

```bash
npm run build:all
```

Tambien puedes ejecutar cada modulo por separado:

```bash
npm run dev:backend
npm run dev:worker
npm run dev:frontend
```

## Entornos recomendados

### PC remoto / operacion real

- `ENABLE_APX_SCRAPER=true`
- `HEADLESS=true`

### PC local de desarrollo

- `ENABLE_APX_SCRAPER=false`
- `HEADLESS=false` si necesitas ver el navegador

Con esta configuracion local se puede trabajar UI, filtros, historial y pruebas operativas sin depender del acceso real a APX.

## Notas

- El `README` describe la idea general y la estructura actual del proyecto.
- La memoria operativa mas detallada esta en `_agent/PROJECT_MEMORY.md`.
- El estado vigente del POC de POS esta en `_agent/ESTADO_POC_POS_WINDOWS_2026-03-30.md` y en `desktop-agent/`.
