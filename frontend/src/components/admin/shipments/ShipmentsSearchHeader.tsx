import { useState } from 'react';
import {
  ActionButton,
  MaterialIcon,
  SurfaceCard,
  cn,
  fieldClassName,
} from '../ui/AdminPrimitives';
import type { ShipmentFilters, TabMode } from './types';

interface ShipmentsSearchHeaderProps {
  activeTab: TabMode;
  filters: ShipmentFilters;
  gestionFilter: number | null;
  loading: boolean;
  page: number;
  searchTerm: string;
  showOnlyTrackingFailures: boolean;
  totalPages: number;
  onChangeSearchTerm: (value: string) => void;
  onClearSearch: () => void;
  onPageChange: (page: number) => void;
  onSearch: () => void;
}

const buildReportUrl = (
  activeTab: TabMode,
  searchTerm: string,
  filters: ShipmentFilters,
  gestionFilter: number | null,
  showOnlyTrackingFailures: boolean,
  type: 'summary' | 'detailed',
) => {
  const params = new URLSearchParams();

  params.append('scope', activeTab);
  params.append('type', type);

  if (searchTerm) params.append('search', searchTerm);
  if (filters.zoneId) params.append('zoneId', filters.zoneId);
  if (filters.managementId) params.append('managementId', filters.managementId);
  if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.append('dateTo', filters.dateTo);
  if (filters.checkoutDateFrom) params.append('checkoutDateFrom', filters.checkoutDateFrom);
  if (filters.checkoutDateTo) params.append('checkoutDateTo', filters.checkoutDateTo);
  if (gestionFilter !== null) params.append('gestionCount', String(gestionFilter));
  if (showOnlyTrackingFailures) params.append('onlyTrackingFailures', 'true');

  return `${import.meta.env.VITE_API_URL || 'http://localhost:4010'}/shipments/report?${params.toString()}`;
};

const ShipmentsSearchHeader = ({
  activeTab,
  filters,
  gestionFilter,
  loading,
  page,
  searchTerm,
  showOnlyTrackingFailures,
  totalPages,
  onChangeSearchTerm,
  onClearSearch,
  onPageChange,
  onSearch,
}: ShipmentsSearchHeaderProps) => {
  const [showReportOptions, setShowReportOptions] = useState(false);

  const openReport = (type: 'summary' | 'detailed') => {
    const url = buildReportUrl(activeTab, searchTerm, filters, gestionFilter, showOnlyTrackingFailures, type);
    window.open(url, '_blank');
    setShowReportOptions(false);
  };

  return (
    <SurfaceCard className="px-5 py-4 sm:px-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-stretch xl:justify-between">
        <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:items-stretch">
          <div className="relative">
            <ActionButton
              className="h-12 min-w-[10.5rem]"
              icon="table_view"
              onClick={() => setShowReportOptions((current) => !current)}
              variant="success"
            >
              Extraer Reporte
            </ActionButton>

            {showReportOptions ? (
              <div className="absolute left-0 top-[calc(100%+8px)] z-20 min-w-56 rounded-3xl border border-gray-200/80 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[#232218]">
                <button
                  className="w-full rounded-2xl px-3 py-2 text-left text-sm font-bold text-dark-text transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:text-white dark:hover:bg-white/5"
                  onClick={() => openReport('summary')}
                  type="button"
                >
                  Reporte simple
                </button>
                <button
                  className="w-full rounded-2xl px-3 py-2 text-left text-sm font-bold text-dark-text transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:text-white dark:hover:bg-white/5"
                  onClick={() => openReport('detailed')}
                  type="button"
                >
                  Reporte detallado
                </button>
              </div>
            ) : null}
          </div>

          <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-stretch">
            <label className="sr-only" htmlFor="shipments-search">
              Buscar por guia o telefono
            </label>
            <div className="relative flex-1">
              <input
                aria-label="Buscar por guia o telefono"
                autoComplete="off"
                className={cn(fieldClassName, 'h-12 py-0 pr-12')}
                id="shipments-search"
                name="shipmentsSearch"
                onChange={(event) => onChangeSearchTerm(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onSearch();
                }}
                placeholder="Buscar por guia o telefono..."
                spellCheck={false}
                type="text"
                value={searchTerm}
              />
              <div className="absolute inset-y-0 right-3 flex items-center">
                {searchTerm ? (
                  <button
                    aria-label="Limpiar busqueda"
                    className="inline-flex size-9 items-center justify-center rounded-2xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:hover:bg-white/5 dark:hover:text-white"
                    onClick={onClearSearch}
                    type="button"
                  >
                    <MaterialIcon className="text-[16px]" name="close" />
                  </button>
                ) : null}
              </div>
            </div>
            <ActionButton className="h-12 min-w-[8.5rem]" onClick={onSearch} variant="success">
              Buscar
            </ActionButton>
          </div>
        </div>

        <div className="flex h-12 items-center justify-between gap-3 rounded-2xl border border-gray-200/80 bg-gray-50/80 px-3 dark:border-white/10 dark:bg-[#232218] xl:min-w-[250px]">
          <button
            aria-label="Pagina anterior"
            className="inline-flex size-9 items-center justify-center rounded-2xl bg-white text-gray-600 transition-colors hover:bg-gray-100 hover:text-dark-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-40 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(page - 1)}
            type="button"
          >
            <MaterialIcon className="text-[18px]" name="chevron_left" />
          </button>
          <div className="flex-1 text-center font-mono text-sm font-black text-dark-text dark:text-white">
            Pag {page} de {totalPages}
          </div>
          <button
            aria-label="Pagina siguiente"
            className="inline-flex size-9 items-center justify-center rounded-2xl bg-white text-gray-600 transition-colors hover:bg-gray-100 hover:text-dark-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-40 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
            disabled={page >= totalPages || loading}
            onClick={() => onPageChange(page + 1)}
            type="button"
          >
            <MaterialIcon className="text-[18px]" name="chevron_right" />
          </button>
        </div>
      </div>
    </SurfaceCard>
  );
};

export default ShipmentsSearchHeader;
