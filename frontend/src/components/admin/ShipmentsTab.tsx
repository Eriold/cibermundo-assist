import { useState } from 'react';
import BulkDeleteShipmentsModal from './shipments/BulkDeleteShipmentsModal';
import DeleteShipmentModal from './shipments/DeleteShipmentModal';
import EditShipmentModal from './shipments/EditShipmentModal';
import ShipmentsFiltersPanel from './shipments/ShipmentsFiltersPanel';
import ShipmentsSearchHeader from './shipments/ShipmentsSearchHeader';
import ShipmentsTable from './shipments/ShipmentsTable';
import ShipmentsToolbar from './shipments/ShipmentsToolbar';
import { useShipmentsAdmin } from './shipments/useShipmentsAdmin';
import {
  ActionButton,
  AdminHeader,
  AdminSection,
  InlineAlert,
  StatCard,
  SurfaceCard,
} from './ui/AdminPrimitives';

const ShipmentsTab = () => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const {
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
    showOnlyTrackingFailures,
    shipments,
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
  } = useShipmentsAdmin();

  return (
    <AdminSection>
      <AdminHeader
        description="Consulta, edita y depura el historial operativo sin alterar el comportamiento actual de filtros, busqueda, tracking ni acciones sobre registros."
        eyebrow="Historial"
        title="Gestion de Guias"
      >
        <StatCard
          icon={activeTab === 'open' ? 'folder_open' : 'archive'}
          label="Vista"
          tone="primary"
          value={activeTab === 'open' ? 'Abiertas' : 'Archivadas'}
        />
        <StatCard icon="inventory_2" label="Visibles" value={visibleShipments.length} />
        <StatCard icon="select_all" label="Seleccionadas" tone="success" value={selectedShipmentsCount} />
        <StatCard icon={trackingFailuresCount > 0 ? 'warning' : 'check_circle'} label="Fallos tracking" tone="warning" value={trackingFailuresCount} />
      </AdminHeader>

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

      {errorMsg ? <InlineAlert>{errorMsg}</InlineAlert> : null}

      {activeTab === 'open' && trackingFailuresCount > 0 ? (
        <InlineAlert icon="warning" tone="warning">
          <div className="space-y-3">
            <p>
              Hay <strong>{trackingFailuresCount}</strong> guia(s) con fallo de rastreo luego de 4 intentos.
            </p>
            <div className="flex flex-wrap gap-2">
              <ActionButton
                onClick={() => setShowOnlyTrackingFailures(!showOnlyTrackingFailures)}
                variant={showOnlyTrackingFailures ? 'primary' : 'secondary'}
              >
                {showOnlyTrackingFailures ? 'Ver Todas' : 'Solo Fallos'}
              </ActionButton>
              <ActionButton
                disabled={retryingTrackingFailures}
                onClick={retryTrackingFailures}
                variant="success"
              >
                {retryingTrackingFailures ? 'Reintentando...' : 'Reintentar Fallos'}
              </ActionButton>
            </div>
          </div>
        </InlineAlert>
      ) : null}

      {showFilters ? (
        <ShipmentsFiltersPanel
          filters={filters}
          managements={managements}
          onApply={applyFilters}
          onChange={setFilters}
          onClear={clearFilters}
          zones={zones}
        />
      ) : null}

      <ShipmentsSearchHeader
        activeTab={activeTab}
        filters={filters}
        gestionFilter={gestionFilter}
        loading={loading}
        onChangeSearchTerm={setSearchTerm}
        onClearSearch={clearSearch}
        onPageChange={changePage}
        onSearch={search}
        page={page}
        searchTerm={searchTerm}
        showOnlyTrackingFailures={showOnlyTrackingFailures}
        totalPages={totalPages}
      />

      <ShipmentsTable
        allVisibleSelected={allVisibleSelected}
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
        onToggleSelectAllVisible={toggleSelectAllVisible}
        onToggleShipmentSelection={toggleShipmentSelection}
        selectedShipmentKeys={selectedShipmentKeys}
        shipments={shipments}
        visibleShipments={visibleShipments}
      />

      <SurfaceCard className="px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
              Seleccion masiva
            </p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-dark-text dark:text-white">
              {selectedShipmentsCount} guia(s) seleccionadas
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <ActionButton disabled={selectedShipmentsCount === 0} onClick={clearSelectedShipments} variant="secondary">
              Limpiar Seleccion
            </ActionButton>
            <ActionButton
              disabled={selectedShipmentsCount === 0}
              onClick={() => setShowBulkDeleteModal(true)}
              variant="danger"
            >
              Eliminar Seleccionadas
            </ActionButton>
          </div>
        </div>
      </SurfaceCard>

      {showEditModal ? (
        <EditShipmentModal
          editForm={editForm}
          editingShipment={editingShipment}
          errorMsg={errorMsg}
          loadingTracking={loadingTracking}
          managements={managements}
          onChange={handleFormChange}
          onClose={() => {
            closeEdit();
            setShowEditModal(false);
          }}
          onSubmit={submitEdit}
          statuses={statuses}
          submitting={submitting}
          trackingHistory={trackingHistory}
          trackingLastUpdated={trackingLastUpdated}
          zones={zones}
        />
      ) : null}

      {showDeleteModal ? (
        <DeleteShipmentModal
          deleting={deleting}
          onCancel={() => {
            setShipmentToDelete(null);
            setShowDeleteModal(false);
          }}
          onConfirm={async () => {
            await confirmDelete();
            setShowDeleteModal(false);
          }}
          shipment={shipmentToDelete}
        />
      ) : null}

      {showBulkDeleteModal && selectedShipmentsCount > 0 ? (
        <BulkDeleteShipmentsModal
          count={selectedShipmentsCount}
          deleting={bulkDeleting}
          onCancel={() => setShowBulkDeleteModal(false)}
          onConfirm={async () => {
            await confirmBulkDelete();
            setShowBulkDeleteModal(false);
          }}
        />
      ) : null}
    </AdminSection>
  );
};

export default ShipmentsTab;
