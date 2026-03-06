export interface UserRole {
  isAdmin: boolean;
  canScan: boolean;
  canReport: boolean;
}

export interface UserSession {
  id: number;
  name: string;
  username: string;
  roles: UserRole;
}

const STORAGE_KEY = 'cibermundo_session';

export const saveSession = (session: UserSession) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
};

export const getSession = (): UserSession | null => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
};

export const clearSession = () => {
  localStorage.removeItem(STORAGE_KEY);
};

// Zonas
const ZONE_KEY = 'cibermundo_active_zone';

export const saveActiveZone = (zoneName: string) => {
    localStorage.setItem(ZONE_KEY, zoneName);
}

export const getActiveZone = (): string | null => {
    return localStorage.getItem(ZONE_KEY);
}
