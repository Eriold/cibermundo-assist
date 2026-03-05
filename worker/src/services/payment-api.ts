/**
 * Servicio para fetch a API pública de guías (InterRapidísimo)
 * POST a: https://www3.interrapidisimo.com/ApiServInter/api/Mensajeria/ObtenerRastreoGuiasClientePost
 */

export interface PaymentApiResponse {
  Success: boolean;
  Message?: string;
  Guia?: {
    FormasPago?: Array<{
      IdFormaPago: number;
      Descripcion: string;
    }>;
    ValorTotal: number;
    ValorDeclarado: number;
  };
  TrazaGuia?: {
    IdEstadoGuia?: number;
    DescripcionEstadoGuia?: string;
    Ciudad?: string;
    FechaGrabacion?: string;
  };
}

// Mapeo de IdFormaPago a descripción
const FORMA_PAGO_MAP: Record<number, string> = {
  1: "PAGADO",
  2: "COBRO_DECLARADO",
  3: "COBRO_TOTAL",
};

// Mapeo de estados (aproximado, ajustar según API real)
const STATE_MAP: Record<string, string> = {
  ENTREGADO: "DEVUELTO",
  EN_TRANSITO: "EN_TRANSITO",
  RECIBIDO: "PAQUETE_INGRESADO",
  PROCESADO: "PAQUETE_CARGADO",
  DEVUELTO: "DEVUELTO",
};

/**
 * Calcular amount_to_collect según IdFormaPago
 */
function calculateAmountToCollect(
  idFormaPago: number,
  valorDeclarado: number,
  valorTotal: number
): number {
  switch (idFormaPago) {
    case 1:
      return 0; // Pagado
    case 2:
      return valorDeclarado; // Cobrar declarado
    case 3:
      return valorTotal; // Cobrar total
    default:
      return 0;
  }
}

/**
 * Construir body por defecto o desde template
 */
export function buildRequestBody(trackingNumber: string, bodyTemplate?: string): Record<string, any> {
  // Si hay template, usarlo (debe contener {trackingNumber})
  if (bodyTemplate && bodyTemplate.trim().length > 0) {
    try {
      const jsonStr = bodyTemplate.replace("{trackingNumber}", trackingNumber);
      return JSON.parse(jsonStr);
    } catch (e) {
      console.warn("Invalid PAYMENT_API_BODY_TEMPLATE, using default");
    }
  }

  // Body por defecto mínimo
  return {
    NumeroGuia: trackingNumber,
  };
}

/**
 * Fetch a API pública de InterRapidísimo
 */
export async function fetchPaymentInfo(
  trackingNumber: string,
  apiUrl: string,
  bodyTemplate: string | undefined,
  timeout: number = 10000
): Promise<{
  success: boolean;
  data?: {
    payment_code: number;
    payment_desc: string;
    amount_declared: number;
    amount_total: number;
    amount_to_collect: number;
    api_current_state_id: number;
    api_current_state_desc: string;
    api_current_city: string;
    api_current_state_at: string;
    api_success: 1 | 0;
    api_message: string;
    api_last_fetch_at: string;
  };
  error?: string;
  isDataAnomaly?: boolean;
}> {
  try {
    // Construir body
    const body = buildRequestBody(trackingNumber, bodyTemplate);

    console.log(`🔗 POST ${apiUrl} with tracking: ${trackingNumber}`);

    // Hacer fetch con timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "InterRPA/1.0",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const apiData: PaymentApiResponse = await response.json();

    console.log(`[FETCH_PAYMENT_API] Response for ${trackingNumber}:`, {
      status: response.status,
      success: apiData.Success,
      message: apiData.Message,
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    // Validar respuesta
    if (!apiData.Success) {
      return {
        success: false,
        error: apiData.Message || "API returned Success=false",
        isDataAnomaly: true, // Es un error de datos
      };
    }

    // Validar estructura de Guia
    if (!apiData.Guia) {
      return {
        success: false,
        error: "Missing Guia in response",
        isDataAnomaly: true,
      };
    }

    const { Guia, TrazaGuia } = apiData;

    // Obtener forma de pago
    const formaPago = Guia.FormasPago?.[0];
    if (!formaPago) {
      return {
        success: false,
        error: "No FormasPago in Guia",
        isDataAnomaly: true,
      };
    }

    // Calcular amount_to_collect
    const amountToCollect = calculateAmountToCollect(
      formaPago.IdFormaPago,
      Guia.ValorDeclarado,
      Guia.ValorTotal
    );

    // Procesar estado actual
    const estadoDesc = TrazaGuia?.DescripcionEstadoGuia || "PENDIENTE_CONSULTA";
    const estadoMapeado = STATE_MAP[estadoDesc] || estadoDesc;

    return {
      success: true,
      data: {
        payment_code: formaPago.IdFormaPago,
        payment_desc: FORMA_PAGO_MAP[formaPago.IdFormaPago] || "DESCONOCIDO",
        amount_declared: Guia.ValorDeclarado,
        amount_total: Guia.ValorTotal,
        amount_to_collect: amountToCollect,
        api_current_state_id: TrazaGuia?.IdEstadoGuia || 0,
        api_current_state_desc: estadoMapeado,
        api_current_city: TrazaGuia?.Ciudad || "",
        api_current_state_at: TrazaGuia?.FechaGrabacion || new Date().toISOString(),
        api_success: 1,
        api_message: apiData.Message || "OK",
        api_last_fetch_at: new Date().toISOString(),
      },
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Detectar errores de timeout o red
    if (errorMsg.includes("abort") || errorMsg.includes("timeout")) {
      return {
        success: false,
        error: "Network timeout or connection error",
      };
    }

    return {
      success: false,
      error: errorMsg,
    };
  }
}
