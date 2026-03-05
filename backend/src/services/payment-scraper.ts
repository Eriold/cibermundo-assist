/**
 * Servicio para obtener datos de pago de InterRapidísimo
 * Usa axios para hacer POST directo a ObtenerRastreoGuiasClientePost
 */

import axios, { AxiosError } from "axios";

const PAYMENT_API_URL =
  "https://www3.interrapidisimo.com/ApiServInter/api/Mensajeria/ObtenerRastreoGuiasClientePost";

interface PaymentData {
  trackingNumber: string;
  success: boolean;
  paymentCode?: number;
  paymentDesc?: string;
  amountTotal?: number;
  amountDeclared?: number;
  amountToCollect?: number;
  currentState?: string;
  currentCity?: string;
  currentStateAt?: string;
  error?: string;
}

/**
 * Buscar datos de pago usando POST directo a la API
 */
export async function fetchPaymentDataFromUI(
  trackingNumber: string
): Promise<PaymentData> {
  try {
    console.log(`🔍 Buscando datos para ${trackingNumber}...`);

    // Body típico para InterRapidísimo
    const body = {
      NumeroGuia: trackingNumber,
    };

    const response = await axios.post(PAYMENT_API_URL, body, {
      timeout: 15000,
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    console.log(
      `✅ Datos obtenidos para ${trackingNumber}:`,
      JSON.stringify(response.data).substring(0, 200)
    );

    return parsePaymentResponse(trackingNumber, response.data);
  } catch (error) {
    const message =
      error instanceof AxiosError
        ? `${error.code}: ${error.message}`
        : String(error);
    console.error(`❌ Error buscando ${trackingNumber}:`, message);
    return {
      trackingNumber,
      success: false,
      error: message,
    };
  }
}

/**
 * Cerrar el navegador (sin-op para compatibilidad)
 */
export async function closeBrowser() {
  // Sin-op
}

/**
 * Parsear la respuesta de ObtenerRastreoGuiasClientePost
 */
function parsePaymentResponse(
  trackingNumber: string,
  response: any
): PaymentData {
  try {
    // La estructura puede variar, intentamos extraer los datos disponibles
    const data: PaymentData = {
      trackingNumber,
      success: false,
    };

    // Estructura típica de InterRapidísimo
    if (response.result && Array.isArray(response.result)) {
      const shipment = response.result[0];

      if (shipment) {
        data.success = true;
        data.paymentCode = shipment.payment_code || shipment.codigoEntrega;
        data.paymentDesc =
          shipment.payment_desc || shipment.descripcionPago || "";
        data.amountTotal = shipment.amount_total || shipment.montoTotal;
        data.amountDeclared =
          shipment.amount_declared || shipment.montoDeclarado;
        data.amountToCollect =
          shipment.amount_to_collect || shipment.montoCobrar;
        data.currentState = shipment.current_state || shipment.estadoActual;
        data.currentCity = shipment.current_city || shipment.ciudadActual;
        data.currentStateAt =
          shipment.current_state_at || shipment.fechaEstado;
      }
    }

    // Si success es false pero hay response, intentar estructura alternativa
    if (!data.success && response.data) {
      const shipment = Array.isArray(response.data)
        ? response.data[0]
        : response.data;

      if (shipment) {
        data.success = true;
        data.paymentCode = shipment.paymentCode || shipment.codigoEntrega;
        data.paymentDesc = shipment.paymentDesc || "";
        data.amountTotal = shipment.amountTotal;
        data.amountDeclared = shipment.amountDeclared;
        data.amountToCollect = shipment.amountToCollect;
        data.currentState = shipment.currentState;
        data.currentCity = shipment.currentCity;
        data.currentStateAt = shipment.currentStateAt;
      }
    }

    if (!data.success) {
      data.error = JSON.stringify(response).substring(0, 200);
    }

    return data;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      trackingNumber,
      success: false,
      error: `Parse error: ${message}`,
    };
  }
}
