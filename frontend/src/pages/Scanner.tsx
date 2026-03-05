import React, { useEffect, useState, useRef } from 'react';
import ScannerModal from '../components/ScannerModal';
import { useNavigate } from 'react-router-dom';
import { useSync } from '../services/useSync';

const Scanner: React.FC = () => {
  const navigate = useNavigate();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [result, setResult] = useState<string>('');
  const [showBanner, setShowBanner] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Sincronizador Backend local vs Dexie offline
  const { isOnline, isSyncing, pendingCount, processScan, syncPending } = useSync();

  // UI demo
  const zoneScan = "Almacén Norte";
  const sessionScanOn = "SESIÓN Melissa";

  const inputRef = useRef<HTMLInputElement>(null);

  // Efecto para ocultar el banner después de 3 segundos
  useEffect(() => {
    if (showBanner) {
      const timer = setTimeout(() => {
        setShowBanner(false);
        setResult(''); // Limpia el resultado después del banner
        setErrorMsg('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showBanner]);

  // Mantener foco en el input siempre para el escáner manual (lector láser)
  useEffect(() => {
    const focusInput = () => {
      // No forzar focus si hay un modal abierto o el usuario dio click fuera intencionalmente (lógica opcional)
      if (inputRef.current) {
        inputRef.current.focus();
      }
    };
    
    // Auto-focus the input
    focusInput();

    // Click anywhere in the app tries to preserve focus on the input if not typing elsewhere
    window.addEventListener('click', focusInput);
    return () => window.removeEventListener('click', focusInput);
  }, []);

  const toggleModal = () => setIsModalOpen(v => !v);
  const handleZoneSelect = () => navigate('/location');

  const handleSend = async (code: string) => {
    if (!code.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      console.log("Procesando scan:", code);
      
      // La lógica offline-first decide dónde guardarlo automáticamente
      await processScan(code);

      // UX Enhancement: Haptic & Visual Feedback
      if (navigator.vibrate) navigator.vibrate(200);
      
      setResult(code);
      setShowBanner(true);
      
      if (inputRef.current) {
          inputRef.current.value = '';
          inputRef.current.focus();
      }
    } catch (err: any) {
      console.error("Error al procesar scan local", err);
      // Solo fallará si explota Dexie (poco común)
      setErrorMsg("Error interno. No se pudo guardar la guía localmente.");
      setShowBanner(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend(e.currentTarget.value);
    }
  };

  const handleManualSendBtn = () => {
    if (inputRef.current) {
      handleSend(inputRef.current.value);
    }
  }

  // Force sync btn
  const handleForceSync = (e: React.MouseEvent) => {
    e.stopPropagation();
    syncPending();
  };

  return (
    <div className="bg-background-light dark:bg-background-dark font-display h-screen w-full overflow-hidden select-none relative pt-6 flex flex-col">
      {/* Top Status Bar & Zone Control */}
      <div className="relative z-20 flex flex-col gap-3 p-4 pt-6 shrink-0">
        <div className="mt-2 bg-white dark:bg-[#181811] rounded-full p-2 pl-3 pr-2 shadow-sm flex items-center justify-between border border-gray-100 dark:border-white/10">
          <div className="flex items-center gap-3">
             <button 
                onClick={() => navigate('/dashboard')}
                className="size-10 bg-primary/20 text-primary flex items-center justify-center rounded-full hover:bg-primary/40 transition-colors"
             >
                <span className="material-symbols-outlined">dashboard</span>
             </button>
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
        
        {/* Offline indicator if needed */}
        {!isOnline && (
            <div className="bg-orange-500 text-white text-xs font-bold py-1 px-4 rounded-full text-center mx-auto mt-[-10px] shadow z-30">
                MODO OFFLINE (Backend inaccesible)
            </div>
        )}
      </div>

      {/* Center Input Area (Replaces Camera) */}
      <div className="flex-1 relative z-10 flex flex-col items-center justify-center p-8 w-full max-w-md mx-auto">
        
        {showBanner && (
          <div className={`z-20 absolute top-4 ${errorMsg ? 'bg-red-500' : 'bg-green-500'} text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3 animate-fade-in-down transition-all`}>
            <span className="material-symbols-outlined icon-fill">{errorMsg ? 'error' : 'check_circle'}</span>
            <span className="font-bold text-sm">{errorMsg ? errorMsg : `Guardado: ${result}`}</span>
          </div>
        )}

        <div className="w-full bg-white dark:bg-[#2c2b1f] p-8 rounded-3xl shadow-lg border border-gray-100 dark:border-white/5 flex flex-col items-center gap-6">
          <div className="size-20 bg-primary/20 text-primary rounded-full flex items-center justify-center mb-2">
            <span className="material-symbols-outlined text-[40px]">barcode_scanner</span>
          </div>
          
          <div className="text-center">
            <h3 className="text-xl font-bold dark:text-white text-[#181811] mb-2">Ingreso de Guías</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Escanee el código de barras o digite la guía manualmente.</p>
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
            {isSubmitting ? 'Guardando...' : 'Añadir Guía'} <span className="material-symbols-outlined">{isSubmitting ? 'hourglass_empty' : 'add_circle'}</span>
          </button>
        </div>
      </div>

      {/* Bottom Sheet Controls */}
      <div
        className="relative z-20 bg-white dark:bg-[#181811] rounded-t-[2rem] shadow-[0_-4px_20px_rgba(0,0,0,0.2)] pb-8 pt-6 px-6 cursor-pointer shrink-0"
        onClick={toggleModal}
      >
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full"></div>

        <div className="flex items-end justify-between mb-2">
          <div>
            <p className="text-green-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wide mb-1">{sessionScanOn}</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-4xl font-bold text-dark-text dark:text-white">...</h3>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">sesión</span>
            </div>
            {pendingCount > 0 ? (
                <div className="flex items-center gap-1.5 mt-1 bg-orange-100 dark:bg-orange-900/30 px-3 py-1.5 rounded-lg border border-orange-200 dark:border-orange-800/50 mt-2" onClick={handleForceSync}>
                    <span className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-orange-400 animate-pulse' : 'bg-orange-500'}`}></span>
                    <p className="text-xs text-orange-700 dark:text-orange-400 font-bold">
                        {isSyncing ? 'Sincronizando al backend...' : `${pendingCount} pendientes (Toca para reintentar)`}
                    </p>
                </div>
            ) : (
                <div className="flex items-center gap-1.5 mt-1 px-1">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    <p className="text-xs text-gray-600 dark:text-gray-400 font-bold">Todos sincronizados</p>
                </div>
            )}
          </div>
          
          <div className="text-right pointer-events-none">
            {result && (
              <>
                <p className="text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-wide mb-1">Último</p>
                <div className="bg-gray-100 dark:bg-white/5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10">
                    <p className="font-mono text-sm text-dark-text dark:text-white font-medium">{result}</p>
                </div>
              </>
            )}
            </div>
        </div>
      </div>

      <ScannerModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};

export default Scanner;
