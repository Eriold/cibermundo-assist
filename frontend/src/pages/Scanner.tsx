import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getActiveZone, getSession } from '../services/auth';
import type { UserSession } from '../services/auth';
import { useSync } from '../services/useSync';

const Scanner: React.FC = () => {
  const navigate = useNavigate();

  const [result, setResult] = useState<string>('');
  const [showBanner, setShowBanner] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateTracking, setDuplicateTracking] = useState('');

  const [user, setUser] = useState<UserSession | null>(null);
  const [zoneScan, setZoneScan] = useState<string>('Sin Zona');
  const [zoneId, setZoneId] = useState<number | null>(null);

  useEffect(() => {
    const sessionUser = getSession();
    if (sessionUser) setUser(sessionUser);

    const activeZ = getActiveZone();
    if (!activeZ || !activeZ.id) {
      navigate('/location');
      return;
    }

    setZoneScan(activeZ.name);
    setZoneId(activeZ.id);
  }, [navigate]);

  const { isOnline, isSyncing, pendingCount, processScan, syncPending } = useSync();
  const sessionScanOn = user ? `SESION ${user.name}` : 'SESION';
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showBanner) {
      const timer = setTimeout(() => {
        setShowBanner(false);
        setResult('');
        setErrorMsg('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showBanner]);

  useEffect(() => {
    const focusInput = () => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    };

    focusInput();
    window.addEventListener('click', focusInput);

    return () => window.removeEventListener('click', focusInput);
  }, []);

  const handleZoneSelect = () => navigate('/location');

  const handleSend = async (code: string) => {
    if (!code.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const sessionUserName = user ? user.name : 'Operario Anonimo';
      await processScan(code, sessionUserName, zoneId);

      if (navigator.vibrate) navigator.vibrate(200);

      setResult(code);
      setShowBanner(true);

      if (inputRef.current) {
        inputRef.current.value = '';
        inputRef.current.focus();
      }
    } catch (err: any) {
      console.error('Error al procesar scan local', err);

      if (err.response?.status === 409) {
        setDuplicateTracking(err.response?.data?.trackingNumber || code);
        setDuplicateModalOpen(true);
        setErrorMsg('');
        setShowBanner(false);

        if (inputRef.current) {
          inputRef.current.value = '';
          inputRef.current.focus();
        }

        return;
      }

      const validationError = err.response?.data?.details?.join(', ') || err.response?.data?.error;
      setErrorMsg(validationError || 'Error interno. No se pudo guardar la guia.');
      setShowBanner(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleSend(event.currentTarget.value);
    }
  };

  const handleManualSendBtn = () => {
    if (inputRef.current) {
      handleSend(inputRef.current.value);
    }
  };

  const handleForceSync = () => {
    syncPending();
  };

  return (
    <div className="bg-background-light dark:bg-background-dark font-display min-h-screen w-full overflow-hidden select-none relative pt-6 flex flex-col">
      <div className="relative z-20 flex flex-col gap-3 p-4 pt-6 shrink-0">
        <div className="mt-2 bg-white dark:bg-[#181811] rounded-full p-2 pl-3 pr-2 shadow-sm flex items-center justify-between border border-gray-100 dark:border-white/10">
          <div className="flex items-center gap-3">
            {user?.roles?.isAdmin && (
              <button
                onClick={() => navigate('/home')}
                className="size-10 bg-primary-light/20 text-primary flex items-center justify-center rounded-full hover:bg-primary/40 transition-colors"
              >
                <span className="material-symbols-outlined">home</span>
              </button>
            )}
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider font-bold text-orange-500 dark:text-gray-400">Zona Actual</span>
              <h2 className="text-dark-text dark:text-white text-lg font-bold leading-none">{zoneScan}</h2>
            </div>
          </div>
          <button
            className="bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 text-dark-text dark:text-white px-4 py-2 rounded-full text-xs font-bold transition-colors"
            onClick={handleZoneSelect}
          >
            Cambiar
          </button>
        </div>

        {!isOnline && (
          <div className="bg-orange-500 text-white text-xs font-bold py-1 px-4 rounded-full text-center mx-auto mt-[-10px] shadow z-30">
            MODO OFFLINE (Backend inaccesible)
          </div>
        )}
      </div>

      <div className="flex-1 relative z-10 flex flex-col items-center justify-center p-8 w-full max-w-md mx-auto">
        {showBanner && !errorMsg && (
          <div className="z-20 absolute top-4 bg-green-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3 animate-fade-in-down transition-all">
            <span className="material-symbols-outlined icon-fill">check_circle</span>
            <span className="font-bold text-sm">Ultima guia registrada: {result}</span>
          </div>
        )}

        {showBanner && errorMsg && (
          <div className="z-20 absolute top-4 bg-red-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3 animate-fade-in-down transition-all">
            <span className="material-symbols-outlined icon-fill">error</span>
            <span className="font-bold text-sm">{errorMsg}</span>
          </div>
        )}

        <div className="w-full bg-white dark:bg-[#2c2b1f] p-8 rounded-3xl shadow-lg border border-gray-100 dark:border-white/5 flex flex-col items-center gap-6">
          <div className="size-20 bg-primary-light/20 text-primary rounded-full flex items-center justify-center mb-2">
            <span className="material-symbols-outlined text-[40px]">barcode_scanner</span>
          </div>

          <div className="text-center">
            <h3 className="text-xl font-bold dark:text-white text-[#181811] mb-2">Ingreso de Guias</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Escanee el codigo de barras o digite la guia manualmente.</p>
          </div>

          <div className="w-full relative flex items-center mt-2 group">
            <input
              ref={inputRef}
              className="w-full bg-gray-50 dark:bg-black/20 border-2 border-gray-200 dark:border-gray-700 text-center text-2xl font-mono py-4 px-4 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/20 dark:text-white transition-all placeholder:text-gray-400 font-bold disabled:opacity-50"
              placeholder="Ej. 24004..."
              onKeyDown={handleKeyDown}
              disabled={isSubmitting}
              type="text"
              autoFocus
              autoComplete="off"
            />
          </div>

          <button
            className="w-full bg-primary hover:bg-primary-dark text-black font-bold text-lg py-4 rounded-xl flex shadow-sm items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
            onClick={handleManualSendBtn}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Guardando...' : 'Anadir Guia'} <span className="material-symbols-outlined">{isSubmitting ? 'hourglass_empty' : 'add_circle'}</span>
          </button>

          <div className="w-full rounded-2xl bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 px-4 py-3 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wide font-bold text-green-600 dark:text-gray-400">{sessionScanOn}</p>
                <p className="text-sm font-bold text-dark-text dark:text-white">{pendingCount > 0 ? `${pendingCount} pendientes` : 'Todos sincronizados'}</p>
              </div>
              {pendingCount > 0 && (
                <button
                  type="button"
                  onClick={handleForceSync}
                  className="px-4 py-2 rounded-xl font-bold text-xs bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/30 dark:hover:bg-orange-900/50 text-orange-800 dark:text-orange-300 transition-colors"
                >
                  {isSyncing ? 'Sincronizando...' : 'Reintentar'}
                </button>
              )}
            </div>

            {result && (
              <div className="rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide font-bold text-gray-400 mb-1">Ultima guia valida</p>
                <p className="font-mono text-sm font-bold text-dark-text dark:text-white">{result}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {duplicateModalOpen && (
        <div className="absolute inset-0 z-40 bg-black/50 flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#181811] border border-gray-200 dark:border-white/10 shadow-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-2xl bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined">inventory_2</span>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-dark-text dark:text-white">Esta guia ya existe</h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  La guia <span className="font-mono font-bold">{duplicateTracking}</span> ya se encuentra registrada en el sistema.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setDuplicateModalOpen(false);
                  setDuplicateTracking('');
                  inputRef.current?.focus();
                }}
                className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-black font-bold transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Scanner;
