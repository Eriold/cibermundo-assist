import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getShipments } from '../services/api';

interface Shipment {
  tracking_number: string;
  scanned_at: string;
  scanned_by: string;
  delivery_type: string;
  office_status: string;
  api_current_state_desc?: string;
  payment_desc?: string;
  amount_total?: number;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchShipments = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await getShipments();
      setShipments(data);
    } catch (error: any) {
      console.error("Error al cargar guías", error);
      setErrorMsg("Error cargando guías. Servidor no accesible.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShipments();
  }, []);

  const formatDate = (isoString: string) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleString('es-CO', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="bg-background-light dark:bg-background-dark font-display h-screen w-full flex flex-col pt-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pb-4 border-b border-gray-200 dark:border-white/10 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/scanner')}
            className="size-10 bg-white dark:bg-white/10 flex items-center justify-center rounded-full shadow-sm text-dark-text dark:text-white"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-dark-text dark:text-white">Panel de Guías</h1>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wide">Cibermundo Assist</p>
          </div>
        </div>
        <button 
          onClick={fetchShipments}
          disabled={loading}
          className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-black px-4 py-2 rounded-xl font-bold text-sm shadow-sm transition-transform active:scale-95 disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[18px]">{loading ? 'sync' : 'refresh'}</span>
          Actualizar
        </button>
      </div>

      {/* Main Content (Table) */}
      <div className="flex-1 p-6 overflow-hidden flex flex-col">
        {errorMsg && (
          <div className="bg-red-500 text-white p-4 rounded-xl shadow-md mb-4 flex items-center gap-2 shrink-0">
            <span className="material-symbols-outlined">error</span>
            <p className="font-bold text-sm">{errorMsg}</p>
          </div>
        )}

        <div className="flex-1 bg-white dark:bg-[#181811] rounded-3xl shadow-sm border border-gray-100 dark:border-white/10 overflow-hidden flex flex-col">
            <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse min-w-[800px]">
                <thead className="sticky top-0 bg-gray-50 dark:bg-[#2c2b1f] border-b border-gray-200 dark:border-white/10 z-10 shadow-sm">
                    <tr>
                    <th className="p-4 py-5 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">Guía</th>
                    <th className="p-4 py-5 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">Fecha Scaneo</th>
                    <th className="p-4 py-5 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">Usuario</th>
                    <th className="p-4 py-5 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">Estado Web</th>
                    <th className="p-4 py-5 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">Pago / Recaudo</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5 overflow-y-auto">
                    {loading && shipments.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="p-10 text-center text-gray-400">
                                <span className="material-symbols-outlined animate-spin text-4xl mb-2">progress_activity</span>
                                <p className="font-bold">Cargando...</p>
                            </td>
                        </tr>
                    ) : shipments.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="p-10 text-center text-gray-400">
                                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">inbox</span>
                                <p className="font-bold">No hay guías registradas.</p>
                            </td>
                        </tr>
                    ) : (
                        shipments.map((ship, i) => (
                        <tr key={ship.tracking_number + i} className="hover:bg-gray-50/50 dark:hover:bg-black/20 transition-colors">
                            <td className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0">
                                        <span className="material-symbols-outlined text-[20px]">package</span>
                                    </div>
                                    <div>
                                        <p className="font-mono font-bold text-dark-text dark:text-white text-base">{ship.tracking_number}</p>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{ship.delivery_type}</p>
                                    </div>
                                </div>
                            </td>
                            <td className="p-4 text-sm font-medium text-gray-600 dark:text-gray-300">
                                {formatDate(ship.scanned_at)}
                            </td>
                            <td className="p-4 text-sm">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-lg font-bold">
                                    <span className="material-symbols-outlined text-[14px]">person</span> {ship.scanned_by}
                                </span>
                            </td>
                            <td className="p-4 text-sm font-medium">
                                {ship.api_current_state_desc ? (
                                    <span className="text-orange-600 dark:text-orange-400 font-bold">{ship.api_current_state_desc}</span>
                                ) : (
                                    <span className="text-gray-400 italic">Consultando...</span>
                                )}
                            </td>
                            <td className="p-4 text-sm font-medium text-gray-600 dark:text-gray-300">
                                {ship.payment_desc ? (
                                    <div className="flex flex-col">
                                        <span className="font-bold text-green-600 dark:text-green-400">{ship.payment_desc}</span>
                                        {ship.amount_total! > 0 && <span className="text-xs text-gray-500">${ship.amount_total?.toLocaleString()}</span>}
                                    </div>
                                ) : (
                                    <span className="text-gray-400">-</span>
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
    </div>
  );
};

export default Dashboard;
