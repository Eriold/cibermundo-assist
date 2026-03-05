import { useState, useEffect, useCallback } from 'react';
import { db } from './db';
import { pingApi, registerScan } from './api';
import { useLiveQuery } from 'dexie-react-hooks';

export function useSync() {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Cantidad de escaneos guardados localmente a la espera de ser enviados
  const pendingCount = useLiveQuery(
    () => db.scans.where('status').equals('PENDING').count(),
    []
  ) ?? 0;

  // Evaluar conectividad
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Adicional: verificar salud del back (por si el servidor local Node se cayó pero la red sigue arriba)
    const checkServer = async () => {
      if (navigator.onLine) {
        const ok = await pingApi();
        setIsOnline(ok);
      }
    };
    
    checkServer();
    const interval = setInterval(checkServer, 10000); // Check cada 10s

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  // Función para procesar un scan y manejar si hay red o no
  const processScan = async (tracking_number: string, scanned_by: string = "Melissa", delivery_type: string = "LOCAL") => {
    
    // Primero, guardamos SIEMPRE en local (Offline-first architecture)
    const id = await db.scans.add({
      tracking_number,
      scanned_by,
      delivery_type,
      created_at: new Date().toISOString(),
      status: 'PENDING',
      sync_attempts: 0
    });

    // Intentamos sync si hay red
    if (isOnline) {
      await trySyncScan(id);
    }
    
    return id; 
  };

  // Función interna para sincronizar un registro puntual
  const trySyncScan = async (id: number) => {
    const scan = await db.scans.get(id);
    if (!scan || scan.status !== 'PENDING') return;

    try {
      await registerScan({
        trackingNumber: scan.tracking_number,
        scannedBy: scan.scanned_by,
        deliveryType: scan.delivery_type
      });

      await db.scans.update(id, { status: 'SYNCED' });

    } catch (err: any) {
      console.warn("Fallo sync individual:", err);
      await db.scans.update(id, { 
        sync_attempts: scan.sync_attempts + 1,
        error_message: err.message || "Error desconocido"
      });
    }
  };

  // Función masiva para sincronizar todo lo PENDING
  const syncPending = useCallback(async () => {
    if (!isOnline || isSyncing || pendingCount === 0) return;
    
    setIsSyncing(true);
    
    try {
      const pendingScans = await db.scans.where('status').equals('PENDING').toArray();
      
      for (const scan of pendingScans) {
        if (scan.id) {
          await trySyncScan(scan.id);
        }
      }
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, pendingCount]);

  // Si recuperamos conexión, automágicamente sincronizar todo
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      syncPending();
    }
  }, [isOnline, pendingCount, syncPending]);


  return {
    isOnline,
    isSyncing,
    pendingCount,
    processScan,
    syncPending
  };
}
