import axios from 'axios';

// La URL se inyecta por Vite. En desarrollo, apuntará a http://localhost:3333 por defecto,
// o a lo que diga el .env si se configuró VITE_API_URL.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3444';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

export interface ScanPayload {
  trackingNumber: string;
  scannedBy: string; // "Melissa" por ahora
  deliveryType: string; // "LOCAL" o "ZONA"
  zoneId?: number | null;
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

export const updateShipmentTracking = async (oldTracking: string, updateData: any) => {
  const res = await api.patch(`/shipments/${oldTracking}`, updateData);
  return res.data;
};

export const deleteShipment = async (trackingNumber: string) => {
  const res = await api.delete(`/shipments/${trackingNumber}`);
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

// ==========================================
// CATÁLOGOS: ESTADOS Y GESTIONES
// ==========================================
export const getStatuses = async () => {
  const res = await api.get('/statuses');
  return res.data;
};

export const createStatus = async (name: string) => {
  const res = await api.post('/statuses', { name });
  return res.data;
};

export const updateStatus = async (id: number, data: { name?: string, active?: boolean }) => {
  const res = await api.patch(`/statuses/${id}`, data);
  return res.data;
};

export const deleteStatus = async (id: number) => {
  const res = await api.delete(`/statuses/${id}`);
  return res.data;
};

// ---
export const getManagements = async () => {
  const res = await api.get('/managements');
  return res.data;
};

export const createManagement = async (name: string) => {
  const res = await api.post('/managements', { name });
  return res.data;
};

export const updateManagement = async (id: number, data: { name?: string, active?: boolean }) => {
  const res = await api.patch(`/managements/${id}`, data);
  return res.data;
};

export const deleteManagement = async (id: number) => {
  const res = await api.delete(`/managements/${id}`);
  return res.data;
};

export default api;
