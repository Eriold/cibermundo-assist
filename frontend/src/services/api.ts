import axios from 'axios';

// La URL se inyecta por Vite. En desarrollo, apuntará a http://localhost:3333 por defecto,
// o a lo que diga el .env si se configuró VITE_API_URL.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

export interface ScanPayload {
  tracking_number: string;
  scanned_by: string; // "Melissa" por ahora
  delivery_type: string; // Tipo de paquete (Domi, Oficina)
}

/**
 * Registra un nuevo paquete o actualiza uno existente al ser escaneado.
 */
export const registerScan = async (payload: ScanPayload) => {
  const res = await api.post('/scan', payload);
  return res.data;
};

/**
 * Obtener listado de guías (con soporte de filtros opcional backend)
 */
export const getShipments = async (params = {}) => {
  const res = await api.get('/shipments', { params });
  return res.data;
};

/**
 * Chequea la salud del API general
 */
export const pingApi = async () => {
    try {
        const res = await api.get('/health', { timeout: 3000 });
        return res.data?.ok === true;
    } catch (e) {
        return false;
    }
}

export default api;
