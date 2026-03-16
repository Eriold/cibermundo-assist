import React, { useState } from 'react';
import DeleteShipmentModal from './shipments/DeleteShipmentModal';
import EditShipmentModal from './shipments/EditShipmentModal';
import ShipmentsFiltersPanel from './shipments/ShipmentsFiltersPanel';
import ShipmentsSearchHeader from './shipments/ShipmentsSearchHeader';
import ShipmentsTable from './shipments/ShipmentsTable';
import ShipmentsToolbar from './shipments/ShipmentsToolbar';
import { useShipmentsAdmin } from './shipments/useShipmentsAdmin';

const ShipmentsTab: React.FC = () => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const {
    activeTab,
    applyFilters,
    autoRefresh,
    changePage,
    clearFilters,
    clearSearch,
    closeEdit,
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
    setActiveTab,
    setAutoRefresh,
    setFilters,
    setGestionFilter,
    setSearchTerm,
    setShipmentToDelete,
    setShowOnlyTrackingFailures,
    shipmentToDelete,
    showOnlyTrackingFailures,
    shipments,
    statuses,
    submitEdit,
    submitting,
    totalPages,
    trackingFailuresCount,
    trackingHistory,
    trackingLastUpdated,
    visibleShipments,
  } = useShipmentsAdmin();

  return (
    <div className="flex flex-col overflow-visible">
      <ShipmentsToolbar
        activeTab={activeTab}
        autoRefresh={autoRefresh}
        loading={loading}
        loadingGestiones={loadingGestiones}
        onChangeTab={setActiveTab}
        onLoadGestiones={loadGestionData}
        onRefresh={() => fetchShipments(false, page, searchTerm, filters)}
        onToggleAutoRefresh={setAutoRefresh}
        onToggleFilters={() => setShowFilters((previous) => !previous)}
        showFilters={showFilters}
      />

      {errorMsg && (
        <div className="bg-red-500 text-white p-4 rounded-xl shadow-md mb-4 flex items-center gap-2 shrink-0">
          <span className="material-symbols-outlined">error</span>
          <p className="font-bold text-sm">{errorMsg}</p>
        </div>
      )}

      {activeTab === 'open' && trackingFailuresCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl shadow-sm mb-4 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined">warning</span>
            <p className="font-bold text-sm">
              Fallos en obtener informacion: {trackingFailuresCount} guia(s) no pudieron rastrearse despues de 4 intentos.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowOnlyTrackingFailures(!showOnlyTrackingFailures)}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors ${showOnlyTrackingFailures ? 'bg-amber-900 text-white' : 'bg-amber-100 hover:bg-amber-200 text-amber-900'}`}
            >
              {showOnlyTrackingFailures ? 'Ver Todas' : 'Solo Fallos'}
            </button>
            <button
              type="button"
              onClick={retryTrackingFailures}
              disabled={retryingTrackingFailures}
              className="px-4 py-2 rounded-xl font-bold text-sm bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-50"
            >
              {retryingTrackingFailures ? 'Reintentando...' : 'Reintentar Fallos'}
            </button>
          </div>
        </div>
      )}

      {showFilters && (
        <ShipmentsFiltersPanel
          filters={filters}
          managements={managements}
          onApply={applyFilters}
          onChange={setFilters}
          onClear={clearFilters}
        />
      )}

      <ShipmentsSearchHeader
        loading={loading}
        page={page}
        searchTerm={searchTerm}
        totalPages={totalPages}
        onChangeSearchTerm={setSearchTerm}
        onClearSearch={clearSearch}
        onPageChange={changePage}
        onSearch={search}
      />

      <ShipmentsTable
        filters={filters}
        gestionFilter={gestionFilter}
        gestionSummary={gestionSummary}
        loading={loading}
        onDelete={(shipment) => {
          setShipmentToDelete(shipment);
          setShowDeleteModal(true);
        }}
        onOpenEdit={(shipment) => {
          openEditWithTracking(shipment);
          setShowEditModal(true);
        }}
        onToggleGestionFilter={(value) => setGestionFilter(gestionFilter === value ? null : value)}
        searchTerm={searchTerm}
        shipments={shipments}
        visibleShipments={visibleShipments}
      />

      {showEditModal && (
        <EditShipmentModal
          editForm={editForm}
          editingShipment={editingShipment}
          errorMsg={errorMsg}
          loadingTracking={loadingTracking}
          managements={managements}
          statuses={statuses}
          submitting={submitting}
          trackingHistory={trackingHistory}
          trackingLastUpdated={trackingLastUpdated}
          onChange={handleFormChange}
          onClose={() => {
            closeEdit();
            setShowEditModal(false);
          }}
          onSubmit={submitEdit}
        />
      )}

      {showDeleteModal && (
        <DeleteShipmentModal
          deleting={deleting}
          shipment={shipmentToDelete}
          onCancel={() => {
            setShipmentToDelete(null);
            setShowDeleteModal(false);
          }}
          onConfirm={async () => {
            await confirmDelete();
            setShowDeleteModal(false);
          }}
        />
      )}
    </div>
  );
};

export default ShipmentsTab;
