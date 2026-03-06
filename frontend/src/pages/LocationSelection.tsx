import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getZones } from '../services/api';
import { getSession, saveActiveZone } from '../services/auth';
import type { UserSession } from '../services/auth';

interface Zone {
  id: number;
  name: string;
}

const LocationSelection: React.FC = () => {
  const navigate = useNavigate();
  const [zones, setZones] = useState<Zone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [user, setUser] = useState<UserSession | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      navigate('/');
      return;
    }
    setUser(session);

    const fetchZones = async () => {
      try {
        const resp = await getZones();
        if (resp.ok && resp.zones) {
          setZones(resp.zones);
        }
      } catch (err: any) {
        console.error("Error fetching zones", err);
        setErrorMsg('No se pudieron cargar las zonas. Verifique su conexión al servidor local.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchZones();
  }, [navigate]);

  const handleZoneSelect = (zone: string) => {
    saveActiveZone(zone);
    navigate('/scanner');
  };

  const getIconForZone = (name: string) => {
      const lower = name.toLowerCase();
      if (lower.includes('local') || lower.includes('tienda')) return 'storefront';
      if (lower.includes('almacén') || lower.includes('almacen')) return 'inventory_2';
      if (lower.includes('recep')) return 'shelves';
      if (lower.includes('logística') || lower.includes('extern')) return 'forklift';
      return 'place';
  }

  return (
    <div className="bg-background-light dark:bg-background-dark text-[#181811] dark:text-white min-h-screen flex flex-col transition-colors duration-200 font-display">
      {/* Top App Bar */}
      <header className="sticky top-0 z-50 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm px-4 py-3 flex items-center justify-between border-b border-gray-200 dark:border-white/10">
        <div className="flex items-center gap-3">
          <button 
             onClick={() => navigate('/home')}
             className="bg-surface-light dark:bg-surface-dark p-2 rounded-full shadow-sm border border-gray-100 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            <span className="material-symbols-outlined text-[#181811] dark:text-primary">arrow_back</span>
          </button>
          <h2 className="text-lg font-bold tracking-tight">Scanner Pro</h2>
        </div>
        
        <div className="flex items-center gap-2">
            <div className="flex flex-col items-end hidden sm:flex pr-2">
                <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Operario</span>
                <span className="text-sm font-bold truncate max-w-[120px]">{user?.name || '...'}</span>
            </div>
            <button className="flex items-center justify-center size-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors bg-primary-light/20 text-primary">
                <span className="material-symbols-outlined">person</span>
            </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col px-4 pt-6 pb-8 max-w-md mx-auto w-full">
        {/* Headline Section */}
        <div className="mb-8">
          <h1 className="text-[32px] font-bold leading-[1.1] mb-2 tracking-tight">Seleccione su Zona</h1>
          <p className="text-gray-600 dark:text-gray-300 text-base font-normal leading-relaxed">
            Indique donde está operando para iniciar la sesión de escaneo.
          </p>
        </div>

        {/* Status / Errors */}
        {isLoading && (
             <div className="flex justify-center items-center py-10">
                 <span className="material-symbols-outlined animate-spin text-primary text-4xl">refresh</span>
             </div>
        )}

        {errorMsg && !isLoading && (
             <div className="bg-red-500/10 text-red-500 border border-red-500/20 px-4 py-4 rounded-xl text-sm font-bold flex items-center gap-3">
                 <span className="material-symbols-outlined">wifi_off</span>
                 {errorMsg}
             </div>
        )}

        {/* Zone Selection List */}
        {!isLoading && !errorMsg && (
            <div className="flex flex-col gap-4 w-full">
            {zones.length === 0 ? (
                <div className="text-center py-10 text-gray-500">No hay zonas activas configuradas. Solicite soporte al Administrador.</div>
            ) : (
                zones.map(zone => (
                    <button 
                        key={zone.id}
                        onClick={() => handleZoneSelect(zone.name)}
                        className="group w-full relative flex items-center gap-4 bg-surface-light dark:bg-surface-dark p-2 pr-6 rounded-full shadow-sm hover:shadow-md active:scale-[0.98] transition-all duration-200 border border-transparent hover:border-primary cursor-pointer text-left"
                    >
                        <div className="flex items-center justify-center shrink-0 size-16 rounded-full bg-surface-light dark:bg-white/5 border-2 border-primary/20 dark:border-primary/10 text-[#181811] dark:text-white group-hover:border-primary transition-colors">
                            <span className="material-symbols-outlined text-[28px]">{getIconForZone(zone.name)}</span>
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                            <span className="text-lg font-bold text-[#181811] dark:text-white group-hover:text-primary-dark dark:group-hover:text-primary transition-colors truncate">{zone.name}</span>
                        </div>
                        <div className="shrink-0 flex items-center justify-center size-8 rounded-full bg-gray-100 dark:bg-white/5 group-hover:bg-primary-light/20">
                            <span className="material-symbols-outlined text-gray-400 group-hover:text-black dark:text-gray-500">chevron_right</span>
                        </div>
                    </button>
                ))
            )}
            </div>
        )}
      </main>

      {/* Footer Status & Admin Link */}
      <footer className="p-4 flex flex-col items-center justify-center pb-8 mt-auto gap-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-surface-dark rounded-full shadow-sm border border-gray-100 dark:border-white/5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
          </span>
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sistema en línea</span>
        </div>
      </footer>
    </div>
  );
};

export default LocationSelection;
