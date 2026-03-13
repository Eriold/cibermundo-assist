import React, { useEffect, useState } from 'react';
import { getShipments, deleteShipment, getStatuses, getManagements, updateShipmentTracking, loadGestiones, getGestionSummary, getTrackingHistory } from '../../services/api';
import { getSession } from '../../services/auth';

type TabMode = 'open' | 'closed';

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
  gestion_count?: number;
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

  // Filter Tabs
  const [activeTab, setActiveTab] = useState<TabMode>('open');

  // Pagination & Filtering state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    zoneId: '',
    managementId: '',
    dateFrom: '',
    dateTo: ''
  });
  
  // Edit Form Fields
  const [editForm, setEditForm] = useState<Partial<Shipment>>({});
  const [submitting, setSubmitting] = useState(false);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [shipmentToDelete, setShipmentToDelete] = useState<Shipment | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Gestión tracking state
  const [gestionSummary, setGestionSummary] = useState<Record<string, number>>({ gestion_0: 0, gestion_1: 0, gestion_2: 0, gestion_3: 0 });
  const [loadingGestiones, setLoadingGestiones] = useState(false);
  const [gestionFilter, setGestionFilter] = useState<number | null>(null);
  const [trackingHistory, setTrackingHistory] = useState<any[]>([]);
  const [trackingLastUpdated, setTrackingLastUpdated] = useState<string | null>(null);
  const [loadingTracking, setLoadingTracking] = useState(false);

  const fetchCatalogs = async () => {
    try {
      const [sData, mData] = await Promise.all([ getStatuses(), getManagements() ]);
      setStatuses(sData);
      setManagements(mData);
    } catch (e) {
      console.error("Error catálogos", e);
    }
  };

  const fetchShipments = async (silent = false, specificPage = page, query = searchTerm, currentFilters = filters) => {
    if (!silent) setLoading(true);
    if (!silent) setErrorMsg('');
    try {
      // Pedimos datos paginados al backend usando axios param
      const data = await getShipments({ page: specificPage, limit: 20, search: query, ...currentFilters });
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
      fetchShipments(false, page, searchTerm, filters);

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
      fetchShipments(false, page, searchTerm, filters);
    } catch (err: any) {
      alert(err.response?.data?.error || "Error al eliminar");
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    fetchCatalogs();
    fetchShipments(false, 1, '', filters);
    fetchGestionSummary();
  }, []);

  // Poll interval effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchShipments(true, page, searchTerm, filters);
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
      fetchShipments(false, newPage, searchTerm, filters);
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

  // ─── Gestión Tracking Functions ─────────────────────────────

  const fetchGestionSummary = async () => {
    try {
      const data = await getGestionSummary();
      setGestionSummary(data);
    } catch (e) {
      console.error('Error fetching gestion summary', e);
    }
  };

  const handleLoadGestiones = async () => {
    setLoadingGestiones(true);
    try {
      const result = await loadGestiones();
      alert(`${result.message}`);
      // Recargar datos y resumen
      fetchShipments(false, page, searchTerm, filters);
      fetchGestionSummary();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Error al cargar gestiones');
    } finally {
      setLoadingGestiones(false);
    }
  };

  const fetchTrackingForModal = async (trackingNumber: string) => {
    setLoadingTracking(true);
    try {
      const data = await getTrackingHistory(trackingNumber);
      setTrackingHistory(data.flow || []);
      setTrackingLastUpdated(data.last_updated);
    } catch (e) {
      console.error('Error fetching tracking history', e);
      setTrackingHistory([]);
      setTrackingLastUpdated(null);
    } finally {
      setLoadingTracking(false);
    }
  };

  const getGestionBadge = (count: number | undefined | null) => {
    const c = count ?? 0;
    if (c === 0) return { text: '0', bg: 'bg-gray-100 dark:bg-white/5', text_color: 'text-gray-500 dark:text-gray-400', border: '' };
    if (c === 1) return { text: '1', bg: 'bg-yellow-100 dark:bg-yellow-500/20', text_color: 'text-yellow-700 dark:text-yellow-400', border: 'border-l-4 border-yellow-400' };
    if (c === 2) return { text: '2', bg: 'bg-orange-100 dark:bg-orange-500/20', text_color: 'text-orange-700 dark:text-orange-400', border: 'border-l-4 border-orange-400' };
    return { text: String(c), bg: 'bg-red-100 dark:bg-red-500/20', text_color: 'text-red-700 dark:text-red-400', border: 'border-l-4 border-red-500' };
  };

  // Override handleOpenEdit to also fetch tracking
  const handleOpenEditWithTracking = (ship: Shipment) => {
    handleOpenEdit(ship);
    fetchTrackingForModal(ship.tracking_number);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Actions Bar */}
        <div className="flex justify-between items-center mb-4 shrink-0">
            <div>
              <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl w-max">
                  <button onClick={() => setActiveTab('open')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === 'open' ? 'bg-white text-dark-text shadow-sm dark:bg-[#2c2b1f] dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}>Guías Abiertas</button>
                  <button onClick={() => setActiveTab('closed')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === 'closed' ? 'bg-white text-dark-text shadow-sm dark:bg-[#2c2b1f] dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}>Archivadas / Cerradas</button>
              </div>
              <p className="text-sm text-gray-500 mt-2">{activeTab === 'open' ? 'Excluye despachos en estado cerrado o finalizado.' : 'Solo guías con Check-out definitivo (Cerradas).'}</p>
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
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm shadow-sm transition-colors ${showFilters ? 'bg-primary text-black' : 'bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-dark-text dark:text-white'}`}
                >
                    <span className="material-symbols-outlined text-[18px]">tune</span>
                    Filtros
                </button>
                <button 
                    onClick={handleLoadGestiones}
                    disabled={loadingGestiones}
                    className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2 rounded-xl font-bold text-sm shadow-sm transition-all active:scale-95 disabled:opacity-50"
                    title="Scrapear gestiones de paquetes abiertos"
                >
                    <span className={`material-symbols-outlined text-[18px] ${loadingGestiones ? 'animate-spin' : ''}`}>{loadingGestiones ? 'sync' : 'update'}</span>
                    Cargar Gestiones
                </button>
                <button 
                    onClick={() => fetchShipments(false, page, searchTerm, filters)}
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

        {/* Advanced Filters Panel */}
        {showFilters && (
            <div className="bg-white dark:bg-[#181811] rounded-2xl p-5 mb-4 shadow-sm border border-gray-100 dark:border-white/10 animate-fade-in-down shrink-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Zona</label>
                        <input 
                            type="number" 
                            placeholder="ID de Zona"
                            value={filters.zoneId}
                            onChange={(e) => setFilters(prev => ({...prev, zoneId: e.target.value}))}
                            className="w-full bg-gray-50 dark:bg-[#2c2b1f] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-dark-text dark:text-white outline-none focus:border-primary"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Gestión</label>
                        <select 
                            value={filters.managementId}
                            onChange={(e) => setFilters(prev => ({...prev, managementId: e.target.value}))}
                            className="w-full bg-gray-50 dark:bg-[#2c2b1f] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-dark-text dark:text-white outline-none focus:border-primary cursor-pointer"
                        >
                            <option value="">Todas las gestiones</option>
                            {managements.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Desde (Fecha Ingreso)</label>
                        <input 
                            type="date" 
                            value={filters.dateFrom}
                            onChange={(e) => setFilters(prev => ({...prev, dateFrom: e.target.value}))}
                            className="w-full bg-gray-50 dark:bg-[#2c2b1f] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-dark-text dark:text-white outline-none focus:border-primary"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Hasta (Fecha Ingreso)</label>
                        <input 
                            type="date" 
                            value={filters.dateTo}
                            onChange={(e) => setFilters(prev => ({...prev, dateTo: e.target.value}))}
                            className="w-full bg-gray-50 dark:bg-[#2c2b1f] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-dark-text dark:text-white outline-none focus:border-primary"
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-white/10">
                    <button 
                        onClick={() => {
                            const cleared = {zoneId: '', managementId: '', dateFrom: '', dateTo: ''};
                            setFilters(cleared);
                            setPage(1);
                            fetchShipments(false, 1, searchTerm, cleared);
                        }}
                        className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                    >
                        Limpiar Filtros
                    </button>
                    <button 
                        onClick={() => {
                            setPage(1);
                            fetchShipments(false, 1, searchTerm, filters);
                        }}
                        className="px-4 py-2 rounded-xl text-sm font-bold text-black bg-primary hover:bg-primary-dark shadow-sm transition-colors flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[18px]">search</span>
                        Aplicar Filtros
                    </button>
                </div>
            </div>
        )}

        {/* Filters and Pagination Controls Header */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4 shrink-0 bg-white dark:bg-[#181811] p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-white/10">
            <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="flex items-center gap-2 bg-gray-100 dark:bg-white/5 px-4 py-2 rounded-xl border border-transparent focus-within:border-primary focus-within:bg-white dark:focus-within:bg-[#2c2b1f] transition-all w-full md:w-80">
                    <span className="material-symbols-outlined text-gray-400">search</span>
                    <input 
                        type="text" 
                        placeholder="Buscar por número de guía..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                setPage(1);
                                fetchShipments(false, 1, searchTerm, filters);
                            }
                        }}
                        className="bg-transparent border-none outline-none w-full text-sm font-bold text-dark-text dark:text-white placeholder-gray-400"
                    />
                    {searchTerm && (
                        <button onClick={() => { setSearchTerm(''); fetchShipments(false, 1, '', filters); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-full flex items-center justify-center">
                            <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                    )}
                </div>
                <button
                    onClick={() => { setPage(1); fetchShipments(false, 1, searchTerm, filters); }}
                    className="hidden sm:flex items-center justify-center bg-primary text-black font-bold px-4 py-2 rounded-xl shrink-0 transition-transform active:scale-95 hover:bg-primary-dark"
                >
                    Buscar
                </button>
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
                    <th className="p-4 py-3 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap text-center">Gestión</th>
                    <th className="p-4 py-3 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {(() => {
                        const filteredShipments = (shipments as any[]).filter((s: any) => 
                            activeTab === 'open' ? s.status_name !== 'Cerrado' : s.status_name === 'Cerrado'
                        );

                        if (loading && shipments.length === 0) {
                            return (
                                <tr>
                                    <td colSpan={8} className="p-10 text-center text-gray-400 h-64">
                                        <div className="flex flex-col items-center justify-center">
                                            <span className="material-symbols-outlined animate-spin text-4xl mb-2">progress_activity</span>
                                            <p className="font-bold">Cargando...</p>
                                        </div>
                                    </td>
                                </tr>
                            );
                        }

                        if (filteredShipments.length === 0) {
                            return (
                                <tr>
                                    <td colSpan={8} className="p-10 text-center text-gray-400 h-64">
                                        <div className="flex flex-col items-center justify-center">
                                            <span className="material-symbols-outlined text-4xl mb-2 opacity-50">inbox</span>
                                            <p className="font-bold">No hay guías registradas en este apartado.</p>
                                        </div>
                                    </td>
                                </tr>
                            );
                        }

                        return filteredShipments.filter((s: any) => {
                          if (gestionFilter !== null) return (s.gestion_count ?? 0) === gestionFilter;
                          return true;
                        }).map((ship: any, i: number) => {
                        const badge = getGestionBadge(ship.gestion_count);
                        return (
                        <tr key={ship.tracking_number + i} className={`hover:bg-gray-50/50 dark:hover:bg-black/20 transition-colors ${badge.border}`}>
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
                            <td className="p-4 text-center">
                                <span className={`inline-flex items-center justify-center size-8 rounded-lg font-black text-sm ${badge.bg} ${badge.text_color}`}>
                                    {ship.gestion_count ?? 0}
                                </span>
                            </td>
                            <td className="p-4 text-sm font-medium">
                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={() => {
                                            const qs = new URLSearchParams();
                                            if (searchTerm) qs.append('search', searchTerm);
                                            if (filters.zoneId) qs.append('zoneId', filters.zoneId);
                                            if (filters.managementId) qs.append('managementId', filters.managementId);
                                            if (filters.dateFrom) qs.append('dateFrom', filters.dateFrom);
                                            if (filters.dateTo) qs.append('dateTo', filters.dateTo);
                                            window.open(`${import.meta.env.VITE_API_URL || 'http://localhost:3333'}/shipments/export?${qs.toString()}`, '_blank');
                                        }}
                                        className="size-10 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors tooltip shrink-0"
                                        title="Exportar Filtradas a CSV"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">download</span>
                                    </button>
                                    <button
                                        onClick={() => handleOpenEditWithTracking(ship)}
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
                        );
                        });
                    })()}
                </tbody>
                <tfoot className="sticky bottom-0 bg-gray-100 dark:bg-[#1f1e16] border-t border-gray-200 dark:border-white/10 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                    <tr>
                        <td colSpan={5} className="p-4 text-right font-black text-gray-700 dark:text-gray-300 uppercase tracking-widest text-sm">Total a Recolectar ({(shipments as any[]).filter((s: any) => 
                            activeTab === 'open' ? s.status_name !== 'Cerrado' : s.status_name === 'Cerrado'
                        ).length}):</td>
                        <td className="p-4 font-black text-primary text-lg">
                            ${(shipments as any[]).filter((s: any) => activeTab === 'open' ? s.status_name !== 'Cerrado' : s.status_name === 'Cerrado').reduce((sum: number, s: any) => sum + (s.amount_total || 0), 0).toLocaleString()}
                        </td>
                        <td colSpan={2} className="p-4">
                          <div className="flex items-center gap-2 justify-end">
                            {[0, 1, 2, 3].map(n => {
                              const key = `gestion_${n}`;
                              const count = gestionSummary[key] || 0;
                              const colors = [
                                'bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400',
                                'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400',
                                'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
                                'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
                              ];
                              return (
                                <button
                                  key={n}
                                  onClick={() => setGestionFilter(gestionFilter === n ? null : n)}
                                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-all ${colors[n]} ${gestionFilter === n ? 'ring-2 ring-primary scale-105' : 'hover:scale-105'}`}
                                >
                                  G{n}: {count}
                                </button>
                              );
                            })}
                          </div>
                        </td>
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

                        {/* Flujo Guía Tracking Table */}
                        <div className="md:col-span-2 mt-2">
                            <div className="flex items-center justify-between border-b border-gray-200 dark:border-white/10 pb-2 mb-3">
                                <h4 className="font-bold text-dark-text dark:text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[18px] text-primary">route</span>
                                    Flujo de la Guía
                                </h4>
                                {trackingLastUpdated && (
                                    <span className="text-xs text-gray-400 font-bold">
                                        Actualizado: {formatDate(trackingLastUpdated)}
                                    </span>
                                )}
                            </div>
                            
                            {loadingTracking ? (
                                <div className="flex items-center justify-center py-8">
                                    <span className="material-symbols-outlined animate-spin text-2xl text-gray-400">progress_activity</span>
                                </div>
                            ) : trackingHistory.length === 0 ? (
                                <div className="text-center py-6 text-gray-400">
                                    <span className="material-symbols-outlined text-3xl mb-1 block opacity-50">info</span>
                                    <p className="text-sm font-bold">Sin datos de flujo. Presione "Cargar Gestiones" para actualizar.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
                                    <table className="w-full text-left text-xs min-w-[700px]">
                                        <thead className="bg-gray-50 dark:bg-[#2c2b1f]">
                                            <tr>
                                                <th className="px-3 py-2 font-bold text-gray-500">Ciudad</th>
                                                <th className="px-3 py-2 font-bold text-gray-500">Estado</th>
                                                <th className="px-3 py-2 font-bold text-gray-500">Fecha</th>
                                                <th className="px-3 py-2 font-bold text-gray-500">Bodega</th>
                                                <th className="px-3 py-2 font-bold text-gray-500">Motivo</th>
                                                <th className="px-3 py-2 font-bold text-gray-500">Mensajero</th>
                                                <th className="px-3 py-2 font-bold text-gray-500">Observación</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                            {trackingHistory.map((row: any, idx: number) => {
                                                const isGestion = row.ciudad?.toUpperCase().includes('URRAO') 
                                                    && (row.descripcion_estado?.toUpperCase().includes('DEVOLUCIÓN') || row.descripcion_estado?.toUpperCase().includes('DEVOLUCION'));
                                                return (
                                                    <tr key={idx} className={isGestion ? 'bg-red-50 dark:bg-red-500/10' : ''}>
                                                        <td className="px-3 py-2 text-dark-text dark:text-white font-medium">
                                                            {row.has_location_icon ? <span className="material-symbols-outlined text-[12px] text-primary mr-1 align-middle">location_on</span> : null}
                                                            {row.ciudad}
                                                        </td>
                                                        <td className={`px-3 py-2 ${isGestion ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-600 dark:text-gray-300'}`}>
                                                            {row.descripcion_estado}
                                                        </td>
                                                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300 whitespace-nowrap">{row.fecha_cambio_estado}</td>
                                                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{row.bodega}</td>
                                                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{row.motivo}</td>
                                                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{row.mensajero}</td>
                                                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400 max-w-[200px] truncate" title={row.observacion}>{row.observacion}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
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
