import React, { useEffect, useState } from 'react';
import { getShipments, deleteShipment, getStatuses, getManagements, updateShipmentTracking } from '../../services/api';
import { getSession } from '../../services/auth';

interface Shipment {
  tracking_number: string;
  scanned_at: string;
  scanned_by: string;
  delivery_type: string;
  office_status: string;
  zone_name?: string;
  zone_id?: number | null;
  api_current_state_desc?: string;
  payment_desc?: string;
  amount_total?: number;
  // Nuevos campos Fase 7
  status_id?: number | null;
  status_name?: string;
  management_id?: number | null;
  management_name?: string;
  client_name?: string;
  client_phone?: string;
  obs_1?: string;
  obs_2?: string;
  obs_3?: string;
  checkout_date?: string;
  checkout_by?: string;
  message_sent?: number;
}

interface CatalogItem {
  id: number;
  name: string;
}

const ShipmentsTab: React.FC = () => {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false); // Apagado por defecto aquí

  // Catalogos
  const [statuses, setStatuses] = useState<CatalogItem[]>([]);
  const [managements, setManagements] = useState<CatalogItem[]>([]);

  // Modals state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);

  // Pagination & Filtering state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Edit Form Fields
  const [editForm, setEditForm] = useState<Partial<Shipment>>({});
  const [submitting, setSubmitting] = useState(false);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [shipmentToDelete, setShipmentToDelete] = useState<Shipment | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCatalogs = async () => {
    try {
      const [sData, mData] = await Promise.all([ getStatuses(), getManagements() ]);
      setStatuses(sData);
      setManagements(mData);
    } catch (e) {
      console.error("Error catálogos", e);
    }
  };

  const fetchShipments = async (silent = false, specificPage = page) => {
    if (!silent) setLoading(true);
    if (!silent) setErrorMsg('');
    try {
      // Pedimos datos paginados al backend usando axios param
      const data = await getShipments({ page: specificPage, limit: 20 });
      setShipments(data.data || []);
      
      // Actualizamos metadatos de paginacion retornados del backend expr
      if (data.pagination) {
          setTotalPages(data.pagination.totalPages || 1);
          setPage(data.pagination.page || 1);
      }
    } catch (error: any) {
      console.error("Error al cargar guías", error);
      if (!silent) setErrorMsg("Error cargando guías. Servidor no accesible.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleOpenEdit = (ship: Shipment) => {
    setEditingShipment(ship);
    setEditForm({ ...ship }); // Clonar estado
    setShowEditModal(true);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShipment) return;
    
    // Validación de Cierre: Si el estatus seleccionado es Cerrado, se requiere fecha
    const isEditingStatusCerrado = statuses.find(s => s.id === Number(editForm.status_id))?.name === 'Cerrado';
    if (isEditingStatusCerrado && !editForm.checkout_date) {
        setErrorMsg('Para marcar como "Cerrado" es obligatorio registrar la Fecha de Salida (Check-Out).');
        return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      
      const session = getSession();
      const payload: any = {
        ...editForm,
        newTrackingNumber: editForm.tracking_number
      };
      
      // Auto-completar checkout_by si lo acaban de cerrar en esta edición
      if (isEditingStatusCerrado && !(editingShipment as any).checkout_by && session) {
          payload.checkout_by = session.id;
      }

      // Peticion PATCH a backend con todos los campos modificados de Fase 7
      await updateShipmentTracking(editingShipment.tracking_number, payload);
      
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
    fetchCatalogs();
    fetchShipments(false, 1);
  }, []);

  // Poll interval effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchShipments(true, page);
      }, 10000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, page]);

  // Page Handler
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      fetchShipments(false, newPage);
    }
  };

  const formatDate = (isoString: string) => {
    if (!isoString) return '-';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '-';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // el 0 debe ser 12
    const strHours = String(hours).padStart(2, '0');
    return `${day}/${month}/${year} ${strHours}:${minutes}${ampm}`;
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Actions Bar */}
        <div className="flex justify-between items-center mb-4 shrink-0">
            <div>
              <h2 className="text-xl font-bold text-dark-text dark:text-white">Gestión de Guías (Abiertas)</h2>
              <p className="text-sm text-gray-500">Panel detallado. Excluye despachos en estado cerrado.</p>
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

        {/* Filters and Pagination Controls Header */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4 shrink-0 bg-white dark:bg-[#181811] p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-white/10">
            <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-gray-400">filter_alt</span>
                <span className="text-sm font-bold text-gray-500">Paginación Activa</span>
            </div>
            <div className="flex items-center gap-3">
                <button 
                  onClick={() => handlePageChange(page - 1)} 
                  disabled={page <= 1 || loading}
                  className="size-8 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 flex items-center justify-center text-gray-600 dark:text-gray-300 disabled:opacity-30 transition-colors"
                >
                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                <span className="text-sm font-bold text-dark-text dark:text-white font-mono">
                  Pág {page} de {totalPages}
                </span>
                <button 
                  onClick={() => handlePageChange(page + 1)} 
                  disabled={page >= totalPages || loading}
                  className="size-8 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 flex items-center justify-center text-gray-600 dark:text-gray-300 disabled:opacity-30 transition-colors"
                >
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
            </div>
        </div>

        <div className="flex-1 bg-white dark:bg-[#181811] rounded-3xl shadow-sm border border-gray-100 dark:border-white/10 overflow-hidden flex flex-col min-h-0">
            <div className="overflow-x-auto overflow-y-auto flex-1 h-full">
                <table className="w-full text-left border-collapse min-w-[1000px] h-max">
                <thead className="sticky top-0 bg-gray-50 dark:bg-[#2c2b1f] border-b border-gray-200 dark:border-white/10 z-10 shadow-sm">
                    <tr>
                    <th className="p-4 py-3 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">N° Guía</th>
                    <th className="p-4 py-3 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">Zona</th>
                    <th className="p-4 py-3 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">Fecha Ingreso</th>
                    <th className="p-4 py-3 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">Cliente</th>
                    <th className="p-4 py-3 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">Teléfono</th>
                    <th className="p-4 py-3 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">Valor</th>
                    <th className="p-4 py-3 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {loading && shipments.length === 0 ? (
                        <tr>
                            <td colSpan={8} className="p-10 text-center text-gray-400 h-64">
                                <div className="flex flex-col items-center justify-center">
                                    <span className="material-symbols-outlined animate-spin text-4xl mb-2">progress_activity</span>
                                    <p className="font-bold">Cargando...</p>
                                </div>
                            </td>
                        </tr>
                    ) : (shipments as any[]).filter((s: any) => s.status_name !== 'Cerrado').length === 0 ? (
                        <tr>
                            <td colSpan={8} className="p-10 text-center text-gray-400 h-64">
                                <div className="flex flex-col items-center justify-center">
                                    <span className="material-symbols-outlined text-4xl mb-2 opacity-50">inbox</span>
                                    <p className="font-bold">No hay guías registradas.</p>
                                </div>
                            </td>
                        </tr>
                    ) : (
                        (shipments as any[]).filter((s: any) => s.status_name !== 'Cerrado').map((ship: any, i: number) => (
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
                                {ship.client_name ? (
                                    <p className="font-bold text-dark-text dark:text-white w-48 truncate" title={ship.client_name}>{ship.client_name}</p>
                                ) : (
                                    <span className="text-gray-400 italic">No digitado</span>
                                )}
                            </td>
                            <td className="p-4 text-sm">
                                {ship.client_phone ? (
                                    <p className="text-gray-700 dark:text-gray-300">{ship.client_phone}</p>
                                ) : (
                                    <span className="text-gray-400 italic">-</span>
                                )}
                            </td>
                            <td className="p-4 text-sm font-medium text-gray-600 dark:text-gray-300">
                                {ship.payment_desc ? (
                                    <span className="text-sm font-bold text-gray-900 dark:text-white">${ship.amount_total?.toLocaleString()}</span>
                                ) : (
                                    <span className="text-gray-400 italic flex items-center gap-1"><span className="material-symbols-outlined text-[14px] animate-spin">refresh</span> Cargando</span>
                                )}
                            </td>
                            <td className="p-4 text-sm font-medium">
                                <div className="flex justify-end gap-2">
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
                <tfoot className="sticky bottom-0 bg-gray-100 dark:bg-[#1f1e16] border-t border-gray-200 dark:border-white/10 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                    <tr>
                        <td colSpan={5} className="p-4 text-right font-black text-gray-700 dark:text-gray-300 uppercase tracking-widest text-sm">Total Abierto:</td>
                        <td className="p-4 font-black text-primary text-lg">
                            ${(shipments as any[]).filter((s: any) => s.status_name !== 'Cerrado').reduce((sum: number, s: any) => sum + (s.amount_total || 0), 0).toLocaleString()}
                        </td>
                        <td></td>
                    </tr>
                </tfoot>
                </table>
            </div>
        </div>

        {/* Large Edit Modal (Fase 7) */}
        {showEditModal && editingShipment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white dark:bg-[#1a1a12] rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col my-auto max-h-[90vh]">
                <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-white/5 shrink-0 rounded-t-2xl">
                    <h3 className="text-2xl font-black dark:text-white flex items-center gap-2">
                        <span className="text-primary font-mono bg-primary/10 px-3 py-1 rounded-lg">#{editingShipment.tracking_number}</span>
                    </h3>
                    <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors size-8 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-white/10">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                    {errorMsg && (
                    <div className="bg-red-500/10 text-red-500 border border-red-500/20 p-3 rounded-lg text-sm font-bold mb-6">
                        {errorMsg}
                    </div>
                    )}
                    
                    <form id="editForm" onSubmit={submitEdit} className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                        {/* Status & Financials Panel */}
                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-4 border border-gray-200 dark:border-white/10 rounded-xl p-4 bg-gray-50 dark:bg-black/20">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ingresado Por / Fecha</label>
                                <div className="text-sm font-bold text-dark-text dark:text-white mt-1">
                                  <span className="material-symbols-outlined text-[14px] align-middle mr-1 text-gray-400">person</span>
                                  {editingShipment.scanned_by} <br/>
                                  <span className="text-gray-500 font-normal">{formatDate(editingShipment.scanned_at)}</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Valor ($)</label>
                                <input 
                                    type="number" 
                                    name="amount_total" 
                                    value={editForm.amount_total || ''} 
                                    onChange={handleFormChange}
                                    className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#2c2b1f] text-dark-text dark:text-white px-3 py-2 outline-none focus:border-primary font-bold"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Estado Interno</label>
                                <select 
                                    name="status_id" 
                                    value={editForm.status_id || ''} 
                                    onChange={handleFormChange}
                                    className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#2c2b1f] text-dark-text dark:text-white px-3 py-2 cursor-pointer outline-none focus:border-primary transition-colors font-bold"
                                >
                                    <option value="">-- Sin Definir --</option>
                                    {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Gestión de Novedad</label>
                                <select 
                                    name="management_id" 
                                    value={editForm.management_id || ''} 
                                    onChange={handleFormChange}
                                    className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#2c2b1f] text-dark-text dark:text-white px-3 py-2 cursor-pointer outline-none focus:border-primary transition-colors font-bold"
                                >
                                    <option value="">-- Sin Gestión --</option>
                                    {managements.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>

                            {/* Fechas y Cierre (Nueva fila) */}
                            <div className="md:col-span-4 border-t border-gray-200 dark:border-white/10 mt-2 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Cerrado Por</label>
                                    <div className="text-sm font-bold text-dark-text dark:text-white mt-1 pt-1">
                                        <span className="material-symbols-outlined text-[14px] align-middle mr-1 text-gray-400">check_circle</span>
                                        {(editingShipment as any).checkout_by_name || <span className="text-gray-400 italic">Sin Asignar (Siga el check-out manual)</span>}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Fecha Check-Out (Salida/Cierre)</label>
                                    <input 
                                        type="datetime-local"
                                        name="checkout_date"
                                        value={editForm.checkout_date ? editForm.checkout_date.substring(0, 16) : ''}
                                        onChange={handleFormChange}
                                        className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#2c2b1f] text-dark-text dark:text-white px-3 py-2 outline-none focus:border-primary transition-colors"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Customer Info */}
                        <div className="space-y-4">
                            <h4 className="font-bold text-dark-text dark:text-white border-b border-gray-200 dark:border-white/10 pb-2">Información del Destinatario</h4>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Nombre del Cliente</label>
                                <input 
                                    type="text" name="client_name"
                                    value={editForm.client_name || ''} onChange={handleFormChange}
                                    className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#2c2b1f] text-dark-text dark:text-white px-4 py-3 outline-none focus:border-primary transition-colors"
                                    placeholder="Ej. Juan Pérez"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Teléfono Móvil</label>
                                <input 
                                    type="tel" name="client_phone"
                                    value={editForm.client_phone || ''} onChange={handleFormChange}
                                    className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#2c2b1f] text-dark-text dark:text-white px-4 py-3 outline-none focus:border-primary transition-colors"
                                    placeholder="Ej. 3001234567"
                                />
                            </div>
                        </div>

                        {/* Note Blocks */}
                        <div className="space-y-4">
                            <h4 className="font-bold text-dark-text dark:text-white border-b border-gray-200 dark:border-white/10 pb-2">Bitácora de Notas</h4>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Nota 1 / Observación General</label>
                                <textarea 
                                    name="obs_1" rows={2}
                                    value={editForm.obs_1 || ''} onChange={handleFormChange}
                                    className="w-full resize-none rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#2c2b1f] text-dark-text dark:text-white px-4 py-2 outline-none focus:border-primary transition-colors"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Nota 2 (Opcional)</label>
                                    <textarea 
                                        name="obs_2" rows={2}
                                        value={editForm.obs_2 || ''} onChange={handleFormChange}
                                        className="w-full resize-none rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#2c2b1f] text-dark-text dark:text-white px-4 py-2 outline-none focus:border-primary transition-colors text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Nota 3 (Opcional)</label>
                                    <textarea 
                                        name="obs_3" rows={2}
                                        value={editForm.obs_3 || ''} onChange={handleFormChange}
                                        className="w-full resize-none rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#2c2b1f] text-dark-text dark:text-white px-4 py-2 outline-none focus:border-primary transition-colors text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                    </form>
                </div>
                
                <div className="p-4 border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/5 flex gap-3 shrink-0 rounded-b-2xl">
                    <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-600 dark:text-gray-300 bg-white dark:border border-white/10 dark:bg-black/20 hover:bg-gray-100 dark:hover:bg-black/40 transition-colors">
                        Ignorar Cambios
                    </button>
                    <button type="submit" form="editForm" disabled={submitting} className="flex-1 py-3 px-4 rounded-xl font-bold text-black bg-primary hover:bg-primary-dark transition-colors flex items-center justify-center gap-2">
                        {submitting ? <span className="material-symbols-outlined animate-spin text-lg">sync</span> : 'Registrar y Guardar'}
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
