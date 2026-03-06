import React, { useEffect, useState } from 'react';
import { getShipments, updateShipmentTracking, deleteShipment } from '../../services/api';

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

const ShipmentsTab: React.FC = () => {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Modals state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);
  const [newTracking, setNewTracking] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [shipmentToDelete, setShipmentToDelete] = useState<Shipment | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchShipments = async (silent = false) => {
    if (!silent) setLoading(true);
    if (!silent) setErrorMsg('');
    try {
      const data = await getShipments();
      setShipments(data);
    } catch (error: any) {
      console.error("Error al cargar guías", error);
      if (!silent) setErrorMsg("Error cargando guías. Servidor no accesible.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleOpenEdit = (ship: Shipment) => {
    setEditingShipment(ship);
    setNewTracking(ship.tracking_number);
    setShowEditModal(true);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShipment) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      await updateShipmentTracking(editingShipment.tracking_number, newTracking);
      setShowEditModal(false);
      fetchShipments(false);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Error al actualizar');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!shipmentToDelete) return;
    setDeleting(true);
    try {
      await deleteShipment(shipmentToDelete.tracking_number);
      setShowDeleteModal(false);
      fetchShipments(false);
    } catch (err: any) {
      alert(err.response?.data?.error || "Error al eliminar");
    } finally {
      setDeleting(false);
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

  const formatDate = (isoString: string) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleString('es-CO', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Actions Bar */}
        <div className="flex justify-between items-center mb-4 shrink-0">
            <h2 className="text-xl font-bold text-dark-text dark:text-white">Últimas Guías</h2>
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
                    <th className="p-4 py-5 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">Guía</th>
                    <th className="p-4 py-5 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">Zona</th>
                    <th className="p-4 py-5 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">Fecha Scaneo</th>
                    <th className="p-4 py-5 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">Usuario</th>
                    <th className="p-4 py-5 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">Estado Web</th>
                    <th className="p-4 py-5 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">Pago / Recaudo</th>
                    <th className="p-4 py-5 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">Acciones</th>
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
                            <td className="p-4 text-sm font-medium text-gray-600 dark:text-gray-300">
                                {ship.zone_name || <span className="text-gray-400 italic">Central</span>}
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
                            <td className="p-4 text-sm font-medium">
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleOpenEdit(ship)}
                                        className="size-8 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 flex items-center justify-center transition-colors"
                                        title="Editar Guía"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">edit</span>
                                    </button>
                                    <button
                                        onClick={() => { setShipmentToDelete(ship); setShowDeleteModal(true); }}
                                        className="size-8 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center transition-colors"
                                        title="Eliminar Guía"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                    </button>
                                </div>
                            </td>
                        </tr>
                        ))
                    )}
                </tbody>
                </table>
            </div>
        </div>

        {/* Edit Modal */}
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#1a1a12] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
                <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
                    <h3 className="text-xl font-bold dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">edit_square</span>
                        Editar Guía
                    </h3>
                    <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                
                <div className="p-6">
                    {errorMsg && (
                    <div className="bg-red-500/10 text-red-500 border border-red-500/20 p-3 rounded-lg text-sm font-bold mb-4">
                        {errorMsg}
                    </div>
                    )}
                    
                    <form id="editForm" onSubmit={submitEdit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Nuevo Número de Guía</label>
                            <input 
                                required type="text"
                                value={newTracking} onChange={e => setNewTracking(e.target.value)}
                                className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#2c2b1f] text-dark-text dark:text-white px-4 py-3 outline-none focus:border-primary transition-colors font-mono font-bold"
                            />
                            <p className="text-xs text-gray-500 mt-2">Corrija el número si fue escaneado o digitado incorrectamente. El sistema impedirá cambiar a una guía ya existente para proteger contra duplicados.</p>
                        </div>
                    </form>
                </div>
                
                <div className="p-4 border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/5 flex gap-3">
                    <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-600 dark:text-gray-300 bg-white dark:bg-black/20 hover:bg-gray-100 dark:hover:bg-black/40 transition-colors">
                        Cancelar
                    </button>
                    <button type="submit" form="editForm" disabled={submitting} className="flex-1 py-3 px-4 rounded-xl font-bold text-black bg-primary hover:bg-primary-dark transition-colors flex items-center justify-center gap-2">
                        {submitting ? <span className="material-symbols-outlined animate-spin text-lg">sync</span> : 'Guardar Cambios'}
                    </button>
                </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && shipmentToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#1a1a12] rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col p-6 text-center animate-fade-in-down">
                <div className="size-16 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-outlined text-3xl">delete_forever</span>
                </div>
                <h3 className="text-xl font-bold dark:text-white mb-2">Eliminar Guía</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
                    ¿Deseas eliminar permanentemente la guía <strong>{shipmentToDelete.tracking_number}</strong>? Su registro se borrará de inmediato del offline DB y de reportes.
                </p>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setShowDeleteModal(false)}
                        className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                        disabled={deleting}
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleDelete}
                        className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                        disabled={deleting}
                    >
                        {deleting ? <span className="material-symbols-outlined animate-spin">sync</span> : 'Eliminar'}
                    </button>
                </div>
            </div>
          </div>
        )}
    </div>
  );
};

export default ShipmentsTab;
