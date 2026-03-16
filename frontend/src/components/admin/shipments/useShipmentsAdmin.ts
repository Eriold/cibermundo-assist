import { useEffect, useState } from 'react';
import {
  deleteShipment,
  deleteShipmentsBulk,
  getAllZones,
  getGestionSummary,
  getManagements,
  getShipments,
  getStatuses,
  getTrackingHistory,
  loadGestiones,
  retryPaymentFailures,
  updateShipmentTracking,
} from '../../../services/api';
import { getSession } from '../../../services/auth';
import type {
  CatalogItem,
  GestionSummary,
  Shipment,
  ShipmentFilters,
  TabMode,
  TrackingRow,
} from './types';

const EMPTY_FILTERS: ShipmentFilters = {
  zoneId: '',
  managementId: '',
  dateFrom: '',
  dateTo: '',
  checkoutDateFrom: '',
  checkoutDateTo: '',
};

const getShipmentSelectionKey = (shipment: Shipment) => `${shipment.record_source || 'active'}:${shipment.tracking_number}`;

export const useShipmentsAdmin = () => {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);

  const [statuses, setStatuses] = useState<CatalogItem[]>([]);
  const [managements, setManagements] = useState<CatalogItem[]>([]);
  const [zones, setZones] = useState<CatalogItem[]>([]);

  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);
  const [activeTab, setActiveTab] = useState<TabMode>('open');

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<ShipmentFilters>(EMPTY_FILTERS);

  const [editForm, setEditForm] = useState<Partial<Shipment>>({});
  const [submitting, setSubmitting] = useState(false);

  const [shipmentToDelete, setShipmentToDelete] = useState<Shipment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedShipmentKeys, setSelectedShipmentKeys] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [gestionSummary, setGestionSummary] = useState<GestionSummary>({
    gestion_0: 0,
    gestion_1: 0,
    gestion_2: 0,
    gestion_3: 0,
  });
  const [loadingGestiones, setLoadingGestiones] = useState(false);
  const [gestionFilter, setGestionFilter] = useState<number | null>(null);
  const [trackingHistory, setTrackingHistory] = useState<TrackingRow[]>([]);
  const [trackingLastUpdated, setTrackingLastUpdated] = useState<string | null>(null);
  const [loadingTracking, setLoadingTracking] = useState(false);
  const [showOnlyTrackingFailures, setShowOnlyTrackingFailures] = useState(false);
  const [retryingTrackingFailures, setRetryingTrackingFailures] = useState(false);

  const fetchGestionSummary = async (scope: TabMode = activeTab) => {
    try {
      const data = await getGestionSummary(scope);
      setGestionSummary(data);
    } catch (error) {
      console.error('Error fetching gestion summary', error);
    }
  };

  const fetchCatalogs = async () => {
    try {
      const [statusesData, managementsData, zonesResponse] = await Promise.all([
        getStatuses(),
        getManagements(),
        getAllZones(),
      ]);
      setStatuses(statusesData);
      setManagements(managementsData);
      setZones(zonesResponse?.zones || []);
    } catch (error) {
      console.error('Error catalogos', error);
    }
  };

  const fetchShipments = async (
    silent = false,
    specificPage = page,
    query = searchTerm,
    currentFilters = filters,
    scope = activeTab,
  ) => {
    if (!silent) {
      setLoading(true);
      setErrorMsg('');
    }

    try {
      const data = await getShipments({
        page: specificPage,
        limit: 20,
        scope,
        search: query,
        ...currentFilters,
      });

      setShipments(data.data || []);
      setSelectedShipmentKeys([]);
      fetchGestionSummary(scope);

      if (data.pagination) {
        setTotalPages(data.pagination.totalPages || 1);
        setPage(data.pagination.page || 1);
      }
    } catch (error: any) {
      console.error('Error al cargar guias', error);
      if (!silent) setErrorMsg('Error cargando guias. Servidor no accesible.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchTrackingForModal = async (trackingNumber: string) => {
    setLoadingTracking(true);
    try {
      const data = await getTrackingHistory(trackingNumber);
      setTrackingHistory(data.flow || []);
      setTrackingLastUpdated(data.last_updated);
    } catch (error) {
      console.error('Error fetching tracking history', error);
      setTrackingHistory([]);
      setTrackingLastUpdated(null);
    } finally {
      setLoadingTracking(false);
    }
  };

  const openEdit = (shipment: Shipment) => {
    setEditingShipment(shipment);
    setEditForm({ ...shipment });
  };

  const openEditWithTracking = (shipment: Shipment) => {
    openEdit(shipment);
    fetchTrackingForModal(shipment.tracking_number);
  };

  const closeEdit = () => {
    setEditingShipment(null);
  };

  const handleFormChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setEditForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const applyFilters = () => {
    setPage(1);
    fetchShipments(false, 1, searchTerm, filters);
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
    fetchShipments(false, 1, searchTerm, EMPTY_FILTERS);
  };

  const search = () => {
    setPage(1);
    fetchShipments(false, 1, searchTerm, filters);
  };

  const clearSearch = () => {
    setSearchTerm('');
    fetchShipments(false, 1, '', filters);
  };

  const changePage = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      fetchShipments(false, newPage, searchTerm, filters);
    }
  };

  const loadGestionData = async () => {
    setLoadingGestiones(true);
    try {
      const result = await loadGestiones(true);
      alert(`${result.message}`);
      fetchShipments(false, page, searchTerm, filters);
      fetchGestionSummary(activeTab);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al cargar gestiones');
    } finally {
      setLoadingGestiones(false);
    }
  };

  const retryTrackingFailures = async () => {
    setRetryingTrackingFailures(true);
    try {
      const result = await retryPaymentFailures();
      alert(result.message);
      fetchShipments(false, page, searchTerm, filters);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al reintentar fallos de rastreo');
    } finally {
      setRetryingTrackingFailures(false);
    }
  };

  const confirmDelete = async () => {
    if (!shipmentToDelete) return;

    setDeleting(true);
    try {
      await deleteShipment(shipmentToDelete.tracking_number, shipmentToDelete.record_source || 'active');
      setShipmentToDelete(null);
      fetchShipments(false, page, searchTerm, filters);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  const submitEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingShipment) return;

    const isEditingStatusCerrado = statuses.find((status) => status.id === Number(editForm.status_id))?.name === 'Cerrado';
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
        record_source: editingShipment.record_source || 'active',
        newTrackingNumber: editForm.tracking_number,
      };

      if (isEditingStatusCerrado && !editingShipment.checkout_by && session) {
        payload.checkout_by = session.id;
      }

      await updateShipmentTracking(editingShipment.tracking_number, payload);
      closeEdit();
      fetchShipments(false, page, searchTerm, filters);
    } catch (error: any) {
      setErrorMsg(error.response?.data?.error || 'Error al actualizar');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchCatalogs();
    fetchShipments(false, 1, '', EMPTY_FILTERS);
  }, []);

  useEffect(() => {
    setGestionFilter(null);
    fetchShipments(false, 1, searchTerm, filters, activeTab);
    fetchGestionSummary(activeTab);
  }, [activeTab]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    if (autoRefresh) {
      interval = setInterval(() => {
        fetchShipments(true, page, searchTerm, filters);
      }, 10000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, page, searchTerm, filters, activeTab]);

  const isTrackingFailure = (shipment: Shipment) =>
    shipment.office_status === 'ANOMALIA_DATOS' &&
    (shipment.api_message || '').startsWith('FALLO_RASTREO_FINAL:');

  const visibleShipments = shipments.filter((shipment) => {
    if (showOnlyTrackingFailures && !isTrackingFailure(shipment)) return false;
    if (gestionFilter !== null) return (shipment.gestion_count ?? 0) === gestionFilter;
    return true;
  });

  useEffect(() => {
    const visibleKeys = visibleShipments.map(getShipmentSelectionKey);
    setSelectedShipmentKeys((current) => current.filter((key) => visibleKeys.includes(key)));
  }, [shipments, showOnlyTrackingFailures, gestionFilter]);

  const toggleShipmentSelection = (shipment: Shipment) => {
    const key = getShipmentSelectionKey(shipment);
    setSelectedShipmentKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
  };

  const toggleSelectAllVisible = () => {
    const visibleKeys = visibleShipments.map(getShipmentSelectionKey);
    const allSelected = visibleKeys.length > 0 && visibleKeys.every((key) => selectedShipmentKeys.includes(key));

    setSelectedShipmentKeys((current) => {
      if (allSelected) {
        return current.filter((key) => !visibleKeys.includes(key));
      }

      return Array.from(new Set([...current, ...visibleKeys]));
    });
  };

  const clearSelectedShipments = () => {
    setSelectedShipmentKeys([]);
  };

  const selectedShipments = visibleShipments.filter((shipment) => selectedShipmentKeys.includes(getShipmentSelectionKey(shipment)));
  const selectedShipmentsCount = selectedShipments.length;
  const allVisibleSelected = visibleShipments.length > 0 && visibleShipments.every((shipment) => selectedShipmentKeys.includes(getShipmentSelectionKey(shipment)));
  const trackingFailuresCount = shipments.filter(isTrackingFailure).length;

  const confirmBulkDelete = async () => {
    if (selectedShipments.length === 0) return;

    setBulkDeleting(true);
    try {
      await deleteShipmentsBulk(
        selectedShipments.map((shipment) => ({
          trackingNumber: shipment.tracking_number,
          recordSource: shipment.record_source || 'active',
        }))
      );
      setSelectedShipmentKeys([]);
      fetchShipments(false, page, searchTerm, filters);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al eliminar guias');
    } finally {
      setBulkDeleting(false);
    }
  };

  return {
    activeTab,
    allVisibleSelected,
    applyFilters,
    autoRefresh,
    bulkDeleting,
    changePage,
    clearFilters,
    clearSearch,
    clearSelectedShipments,
    closeEdit,
    confirmBulkDelete,
    confirmDelete,
    deleting,
    editForm,
    editingShipment,
    errorMsg,
    fetchShipments,
    filters,
    gestionFilter,
    gestionSummary,
    handleFormChange,
    loadGestionData,
    loading,
    loadingGestiones,
    loadingTracking,
    managements,
    openEditWithTracking,
    page,
    retryTrackingFailures,
    retryingTrackingFailures,
    search,
    searchTerm,
    selectedShipmentKeys,
    selectedShipmentsCount,
    setActiveTab,
    setAutoRefresh,
    setFilters,
    setGestionFilter,
    setSearchTerm,
    setShipmentToDelete,
    setShowOnlyTrackingFailures,
    shipmentToDelete,
    shipments,
    showOnlyTrackingFailures,
    statuses,
    submitEdit,
    submitting,
    toggleSelectAllVisible,
    toggleShipmentSelection,
    totalPages,
    trackingFailuresCount,
    trackingHistory,
    trackingLastUpdated,
    visibleShipments,
    zones,
  };
};

export { EMPTY_FILTERS };
