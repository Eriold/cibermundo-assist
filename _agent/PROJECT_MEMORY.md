# Cibermundo-assist: Memoria del Proyecto

Este archivo documenta el contexto, decisiones y arquitectura del proyecto para que la IA y futuros desarrolladores entiendan el núcleo del negocio.

## El Problema de Negocio
**Cibermundo** es una oficina tipo franquicia/sucursal interna de **Interrapidísimo** (empresa de mensajería). 
El problema actual es el cuello de botella físico al recibir muchos paquetes: se pierde tiempo descargando, clasificando, escaneando e indicando el destino/estado (si es para reclamar en oficina, si debe pagar, etc.).
A nivel de sistema de Interrapidísimo los procesos son lentos y la oficina necesita un **control interno rápido** para:
- Registrar ágilmente qué entró a la oficina.
- Saber quién lo registró y en qué "zona" de la oficina está.
- Generar reportes semanales precisos.
- (Futuro) Notificar a clientes por WhatsApp que su paquete ya llegó a la oficina.

## La Solución ("Cibermundo-assist")
Un sistema **100% Offline-First** diseñado para correr localmente en la red de la oficina, para que si no hay internet general, el trabajo de recepción de recarga de camiones no se frene.

### Arquitectura Seleccionada
Decidimos utilizar **Node.js + React (JS/TS)** dado el dominio técnico y facilidad de mantenimiento.

1.  **Backend (Node.js + Express + SQLite):** Se ejecuta en una PC "Servidor" dentro del local. Recibe llamadas para guardar guías escaneadas.
2.  **Frontend (React + Vite):** Interfaces limpias y rápidas accedidas por los operarios desde sus PCs a través de la IP local del Servidor. Encola lecturas en IndexedDB si falla el WiFi local. No usará cámara, sino inputs de texto enfocados para lectores de código de barras físicos.
3.  **Worker (Node.js Cron):** Sistema en background en el Servidor que toma las guías locales almacenadas y va recuperando su información asíncronamente desde las APIs públicas de Interrapidísimo (Valor, Estado, Nombre) manejando caída de internet sin frenar al operario.

## Notas Técnicas y Reglas Clave
- **Sin Cámara Web:** El input de guía será puramente numérico digitado o inyectado por un lector láser en un campo de texto en el frontend.
- **`.env` Remotos:** No subir archivos `.env` al repositorio. Solo se usará `.env.example`. Esto permite a los desarrolladores bajar el repo en PCs remotos y configurar apuntes de IP de forma limpia.
- **Depuración (Limpieza):** Datos mayores a 30 días deben archivarse en otra tabla (`shipments_archive`) en SQLite para no degradar el rendimiento del modelo principal.
- **Control de Estados:** Un paquete se escanea y arranca como "Pendiente". El Worker obtiene sus datos. Luego alguien manualmente podrá pasarlo a "Entregado".

---
*Última actualización: Fase de Arquitectura Inicial*
