import React, { useEffect, useState } from 'react';
import { getShipments } from '../../services/api';

interface Shipment {
  tracking_number: string;
  scanned_at: string;
  scanned_by: string;
  delivery_type: string;
  office_status: string;
  zone_name?: string;
  api_current_state_desc?: string;
  payment_desc?: string;
  amount_total?: number;
}

const MonitorTab: React.FC = () => {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchShipments = async (silent = false) => {
    if (!silent) setLoading(true);
    if (!silent) setErrorMsg('');
    try {
      const data = await getShipments();
      // data.data por la nueva paginacion
      setShipments(data.data || []);
    } catch (error: any) {
      console.error("Error al cargar guías", error);
      if (!silent) setErrorMsg("Error cargando guías en el Monitor. Servidor inaccesible.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchShipments(false);
  }, []);

  // Poll interval effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchShipments(true);
      }, 10000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Actions Bar */}
        <div className="flex justify-between items-center mb-4 shrink-0">
            <div>
              <h2 className="text-xl font-bold text-dark-text dark:text-white flex items-center gap-2">Monitor en Vivo <span className="relative flex size-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full size-3 bg-green-500"></span></span></h2>
              <p className="text-xs text-gray-500 mt-1">Guías procesadas recientemente (Automático)</p>
            </div>
            <div className="flex items-center gap-4">
                <label className="hidden sm:flex items-center gap-2 cursor-pointer select-none">
                    <span className="text-sm font-bold text-gray-500 dark:text-gray-400 mr-1">Auto Update (10s)</span>
                    <div className="relative">
                        <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-white/10 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                    </div>
                </label>
                <button 
                    onClick={() => fetchShipments(false)}
                    disabled={loading}
                    className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-dark-text dark:text-white px-4 py-2 rounded-xl font-bold text-sm shadow-sm transition-transform active:scale-95 disabled:opacity-50"
                >
                    <span className={`material-symbols-outlined text-[18px] ${loading && !autoRefresh ? 'animate-spin' : ''}`}>sync</span>
                    Actualizar
                </button>
            </div>
        </div>

        {errorMsg && (
          <div className="bg-red-500 text-white p-4 rounded-xl shadow-md mb-4 flex items-center gap-2 shrink-0">
            <span className="material-symbols-outlined">error</span>
            <p className="font-bold text-sm">{errorMsg}</p>
          </div>
        )}

        <div className="flex-1 bg-white dark:bg-[#181811] rounded-3xl shadow-sm border border-gray-100 dark:border-white/10 overflow-hidden flex flex-col min-h-0">
            <div className="overflow-x-auto overflow-y-auto flex-1 h-full">
                <table className="w-full text-left border-collapse min-w-[800px] h-max">
                <thead className="sticky top-0 bg-gray-50 dark:bg-[#2c2b1f] border-b border-gray-200 dark:border-white/10 z-10 shadow-sm">
                    <tr>
                    <th className="p-4 py-5 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">N° Guía</th>
                    <th className="p-4 py-5 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">Quién Escaneó</th>
                    <th className="p-4 py-5 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">Zona</th>
                    <th className="p-4 py-5 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">Valor de Guía</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {loading && shipments.length === 0 ? (
                        <tr>
                            <td colSpan={7} className="p-10 text-center text-gray-400 h-64">
                                <div className="flex flex-col items-center justify-center">
                                    <span className="material-symbols-outlined animate-spin text-4xl mb-2">progress_activity</span>
                                    <p className="font-bold">Cargando...</p>
                                </div>
                            </td>
                        </tr>
                    ) : shipments.length === 0 ? (
                        <tr>
                            <td colSpan={7} className="p-10 text-center text-gray-400 h-64">
                                <div className="flex flex-col items-center justify-center">
                                    <span className="material-symbols-outlined text-4xl mb-2 opacity-50">inbox</span>
                                    <p className="font-bold">No hay guías registradas.</p>
                                </div>
                            </td>
                        </tr>
                    ) : (
                        shipments.map((ship, i) => (
                        <tr key={ship.tracking_number + i} className="hover:bg-gray-50/50 dark:hover:bg-black/20 transition-colors">
                            <td className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 rounded-full bg-primary-light/20 text-primary flex items-center justify-center shrink-0">
                                        <span className="material-symbols-outlined text-[20px]">package</span>
                                    </div>
                                    <div>
                                        <p className="font-mono font-bold text-dark-text dark:text-white text-base">{ship.tracking_number}</p>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{ship.delivery_type}</p>
                                    </div>
                                </div>
                            </td>
                            <td className="p-4 text-sm">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-lg font-bold">
                                    <span className="material-symbols-outlined text-[14px]">person</span> {ship.scanned_by}
                                </span>
                            </td>
                            <td className="p-4 text-sm font-medium text-gray-600 dark:text-gray-300">
                                {ship.zone_name || <span className="text-gray-400 italic">Central</span>}
                            </td>
                            <td className="p-4 text-sm font-medium text-gray-600 dark:text-gray-300 text-right pr-10">
                                {ship.payment_desc ? (
                                    <span className="text-sm font-bold text-gray-900 dark:text-white">${ship.amount_total?.toLocaleString()}</span>
                                ) : (
                                    <span className="text-gray-400 italic flex items-center justify-end gap-1"><span className="material-symbols-outlined text-[14px] animate-spin">refresh</span> Cargando</span>
                                )}
                            </td>
                        </tr>
                        ))
                    )}
                </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};

export default MonitorTab;
