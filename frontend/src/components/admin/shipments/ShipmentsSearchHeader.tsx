import { useState } from 'react';
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

  return `${import.meta.env.VITE_API_URL || 'http://localhost:3333'}/shipments/report?${params.toString()}`;
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
    <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4 shrink-0 bg-white dark:bg-[#181811] p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-white/10">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowReportOptions((previous) => !previous)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded-xl shrink-0 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">table_view</span>
            Extraer Reporte
          </button>
          {showReportOptions && (
            <div className="absolute left-0 top-[calc(100%+8px)] z-20 min-w-56 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#232218] shadow-xl p-2">
              <button
                type="button"
                onClick={() => openReport('summary')}
                className="w-full text-left px-3 py-2 rounded-xl text-sm font-bold text-dark-text dark:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
              >
                Reporte simple
              </button>
              <button
                type="button"
                onClick={() => openReport('detailed')}
                className="w-full text-left px-3 py-2 rounded-xl text-sm font-bold text-dark-text dark:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
              >
                Reporte detallado
              </button>
            </div>
          )}
        </div>

      <div className="flex items-center gap-2 bg-gray-100 dark:bg-white/5 px-4 py-2 rounded-xl border border-transparent focus-within:border-primary focus-within:bg-white dark:focus-within:bg-[#2c2b1f] transition-all w-full md:w-80">
        <span className="material-symbols-outlined text-gray-400">search</span>
        <input
          type="text"
          placeholder="Buscar por guia o telefono..."
          value={searchTerm}
          onChange={(event) => onChangeSearchTerm(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onSearch();
          }}
          className="bg-transparent border-none outline-none w-full text-sm font-bold text-dark-text dark:text-white placeholder-gray-400"
        />
        {searchTerm && (
          <button onClick={onClearSearch} className="text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        )}
      </div>
      <button
        onClick={onSearch}
        className="hidden sm:flex items-center justify-center bg-primary text-black font-bold px-4 py-2 rounded-xl shrink-0 transition-transform active:scale-95 hover:bg-primary-dark"
      >
        Buscar
      </button>
    </div>
    <div className="flex items-center gap-3">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1 || loading}
        className="size-8 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 flex items-center justify-center text-gray-600 dark:text-gray-300 disabled:opacity-30 transition-colors"
      >
        <span className="material-symbols-outlined text-[18px]">chevron_left</span>
      </button>
      <span className="text-sm font-bold text-dark-text dark:text-white font-mono">
        Pag {page} de {totalPages}
      </span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages || loading}
        className="size-8 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 flex items-center justify-center text-gray-600 dark:text-gray-300 disabled:opacity-30 transition-colors"
      >
        <span className="material-symbols-outlined text-[18px]">chevron_right</span>
      </button>
    </div>
  </div>
  );
};

export default ShipmentsSearchHeader;
