import axios from 'axios';

// La URL se inyecta por Vite. En desarrollo, apuntará a http://localhost:3333 por defecto,
// o a lo que diga el .env si se configuró VITE_API_URL.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

export interface ScanPayload {
  trackingNumber: string;
  scannedBy: string; // "Melissa" por ahora
  deliveryType: string; // "LOCAL" o "ZONA"
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

// ==========================================
// ZONAS
// ==========================================
// Útil para el selector público (solo activas)
export const getZones = async () => {
  const res = await api.get('/zones', { params: { active: 1 } });
  return res.data;
};

// Útil para el panel de administración (todas)
export const getAllZones = async () => {
  const res = await api.get('/zones');
  return res.data;
};

export const createZone = async (name: string) => {
  const res = await api.post('/zones', { name });
  return res.data;
};

export const updateZone = async (id: number, data: { name?: string, active?: boolean }) => {
  const res = await api.patch(`/zones/${id}`, data);
  return res.data;
};

export const deleteZone = async (id: number) => {
  const res = await api.delete(`/zones/${id}`);
  return res.data;
};

// ==========================================
// USUARIOS Y LOGIN
// ==========================================
export const login = async (username: string, pin: string) => {
  const res = await api.post('/users/login', { username, pin });
  return res.data; // { ok: true, user }
};

export const getUsers = async () => {
  const res = await api.get('/users');
  return res.data; // { ok: true, count, users }
};

export const createUser = async (data: any) => {
  const res = await api.post('/users', data);
  return res.data;
};

export const updateUser = async (id: number, data: any) => {
  const res = await api.patch(`/users/${id}`, data);
  return res.data;
};

export const deleteUser = async (id: number) => {
  const res = await api.delete(`/users/${id}`);
  return res.data;
};

export default api;
