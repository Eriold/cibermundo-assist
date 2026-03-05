## 🔍 APX Client - Portal APX Integration

### Overview

`apx-client.ts` proporciona acceso a datos de destinatarios desde el portal APX de InterRapidísimo. En producción usaría Playwright o una API directa, pero por ahora ofrece una estructura mock-ready.

### Funciones

#### `fetchApxData(trackingNumber: string): Promise<ApxResult>`

Obtiene datos del destinatario para una guía.

**Parámetros:**
- `trackingNumber`: Número de guía (10-15 dígitos)

**Retorna:**
```typescript
{
  success: boolean;
  data?: {
    recipient_name?: string;      // Nombre del destinatario
    recipient_phone?: string;      // Teléfono
    recipient_id?: string;         // Cédula/ID
    status?: string;               // Estado de la guía
  };
  error?: string;                  // Mensaje de error
  needsHuman?: boolean;            // Si requiere revisión manual
}
```

**Estados de error:**
- `needsHuman: true` → Guía no encontrada, datos inválidos, etc. No se reintenta.
- `needsHuman: false` → Error de red, timeout, conexión. Se reintenta con backoff.

### Implementación Mock Actual

```typescript
// Tracking numbers que no comienzan con "9999" retornan datos
fetchApxData("1234567890")
→ { success: true, data: { recipient_name: "Juan Pérez", ... } }

// Tracking numbers que comienzan con "9999" requieren human
fetchApxData("9999123456")
→ { success: false, needsHuman: true, error: "..." }
```

### Integración en Production

Para integrar Playwright:

```typescript
import { chromium } from 'playwright';

export async function fetchApxData(trackingNumber: string): Promise<ApxResult> {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Navegar al portal APX
    await page.goto('https://apx-portal.interrapidisimo.com/...');
    
    // Llenar formulario
    await page.fill('[name="tracking"]', trackingNumber);
    await page.click('[type="submit"]');
    
    // Extraer datos
    const data = {
      recipient_name: await page.textContent('.recipient-name'),
      recipient_phone: await page.textContent('.recipient-phone'),
      ...
    };
    
    return { success: true, data };
  } catch (error) {
    // Clasificar error
    return { success: false, error: error.message, needsHuman: true };
  } finally {
    await browser.close();
  }
}
```

### Error Handling

| Error | needsHuman | Acción |
|-------|-----------|--------|
| Timeout | false | Retry con backoff |
| Connection refused | false | Retry con backoff |
| Tracking no encontrado | true | Marcar NEEDS_HUMAN |
| Datos inválidos | true | Marcar NEEDS_HUMAN |
| Parsing error | true | Marcar NEEDS_HUMAN |

### Testing

```bash
# Test con tracking válido
curl -X POST http://localhost:3333/scan \
  -H "Content-Type: application/json" \
  -d '{"trackingNumber":"1234567890", "deliveryType":"LOCAL", "scannedBy":"Admin"}'

# Ver job FETCH_PORTAL_APX
curl http://localhost:3333/jobs?type=FETCH_PORTAL_APX

# Esperar a que worker procese...
# Ver datos en shipment
curl http://localhost:3333/shipments/1234567890
# recipient_name, recipient_phone, apx_last_fetch_at deben estar poblados
```

### Performance

- **Mock actual**: ~500ms por request (simula latencia de red)
- **Con Playwright real**: ~2-5s por request (navegar, extraer, cerrar)
- **Worker poll**: 5 segundos (configurable)

### Variables de Entorno

Actualmente ninguna. En producción podrían agregarse:

```
APX_PORTAL_URL=https://apx-portal.interrapidisimo.com/...
APX_TIMEOUT=10000
APX_USER=... (si requiere auth)
APX_PASSWORD=...
```
