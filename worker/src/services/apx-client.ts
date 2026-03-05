/**
 * APX Client - Fetch shipment data from APX portal
 * Simulates web scraping/API call to APX (InterRapidísimo's internal system)
 */

interface ApxData {
  recipient_name?: string;
  recipient_phone?: string;
  recipient_id?: string;
  status?: string;
}

interface ApxResult {
  success: boolean;
  data?: ApxData;
  error?: string;
  needsHuman?: boolean; // true if human intervention required
}

/**
 * Fetch data from APX portal
 * In production, this would use Playwright or direct API call
 * For now, returns mock data or structured errors
 */
export async function fetchApxData(trackingNumber: string): Promise<ApxResult> {
  try {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Validate input
    if (!trackingNumber || trackingNumber.trim().length === 0) {
      return {
        success: false,
        error: "Invalid tracking number",
        needsHuman: true,
      };
    }

    // Mock API call - in production would use Playwright or real API
    // For now, we'll assume success for valid tracking numbers
    const mockSuccess = !trackingNumber.startsWith("9999");

    if (!mockSuccess) {
      // Simulated tracking number that requires human intervention
      return {
        success: false,
        error: "Tracking number not found in APX (requires manual check)",
        needsHuman: true,
      };
    }

    // Return mock data for now
    const apxData: ApxData = {
      recipient_name: "Juan Pérez García",
      recipient_phone: "+57 312 1234567",
      recipient_id: "1234567890",
      status: "En camino",
    };

    return {
      success: true,
      data: apxData,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Classify error type
    const isNetworkError =
      errorMsg.includes("timeout") ||
      errorMsg.includes("ECONNREFUSED") ||
      errorMsg.includes("ETIMEDOUT") ||
      errorMsg.includes("connection");

    if (isNetworkError) {
      // Network errors are retryable
      return {
        success: false,
        error: `Network error: ${errorMsg}`,
        needsHuman: false,
      };
    }

    // Other errors (parsing, invalid response, etc) may need human review
    return {
      success: false,
      error: `APX error: ${errorMsg}`,
      needsHuman: true,
    };
  }
}

/**
 * Validate APX response structure
 */
export function validateApxResponse(data: any): boolean {
  return (
    data &&
    typeof data === "object" &&
    (data.recipient_name || data.recipient_phone || data.recipient_id)
  );
}
