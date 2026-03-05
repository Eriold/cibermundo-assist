import { promises as dns } from "node:dns";

/**
 * Detectar disponibilidad de internet simple
 * Intenta resolver DNS de google.com
 */
export async function checkInternet(): Promise<boolean> {
  try {
    // Timeout de 5 segundos
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("DNS timeout")), 5000)
    );

    const result = Promise.race([
      dns.resolve4("google.com"),
      timeout,
    ]);

    await result;
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Backoff exponencial con jitter
 * 1er intento: ~1s
 * 2do intento: ~2s
 * 3er intento: ~4s, etc
 */
export function getBackoffDelay(attempts: number): number {
  const baseDelay = 1000; // 1 segundo
  const exponential = Math.pow(2, Math.min(attempts, 5)); // max 32x
  const jitter = Math.random() * 0.1 * exponential * baseDelay; // 0-10% jitter

  return exponential * baseDelay + jitter;
}

/**
 * Calcular próximo run_after con backoff
 */
export function calculateNextRunAfter(attempts: number): string {
  const delay = getBackoffDelay(attempts);
  const nextTime = new Date(Date.now() + delay);
  return nextTime.toISOString();
}
