import type { CatalogItem, ShipmentFilters } from './types';

interface ShipmentsFiltersPanelProps {
  filters: ShipmentFilters;
  managements: CatalogItem[];
  onApply: () => void;
  onChange: (filters: ShipmentFilters) => void;
  onClear: () => void;
}

const ShipmentsFiltersPanel = ({
  filters,
  managements,
  onApply,
  onChange,
  onClear,
}: ShipmentsFiltersPanelProps) => (
  <div className="bg-white dark:bg-[#181811] rounded-2xl p-5 mb-4 shadow-sm border border-gray-100 dark:border-white/10 animate-fade-in-down shrink-0">
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Zona</label>
        <input
          type="number"
          placeholder="ID de Zona"
          value={filters.zoneId}
          onChange={(event) => onChange({ ...filters, zoneId: event.target.value })}
          className="w-full bg-gray-50 dark:bg-[#2c2b1f] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-dark-text dark:text-white outline-none focus:border-primary"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Gestion</label>
        <select
          value={filters.managementId}
          onChange={(event) => onChange({ ...filters, managementId: event.target.value })}
          className="w-full bg-gray-50 dark:bg-[#2c2b1f] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-dark-text dark:text-white outline-none focus:border-primary cursor-pointer"
        >
          <option value="">Todas las gestiones</option>
          {managements.map((management) => (
            <option key={management.id} value={management.id}>
              {management.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Desde (Fecha Ingreso)</label>
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(event) => onChange({ ...filters, dateFrom: event.target.value })}
          className="w-full bg-gray-50 dark:bg-[#2c2b1f] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-dark-text dark:text-white outline-none focus:border-primary"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Hasta (Fecha Ingreso)</label>
        <input
          type="date"
          value={filters.dateTo}
          onChange={(event) => onChange({ ...filters, dateTo: event.target.value })}
          className="w-full bg-gray-50 dark:bg-[#2c2b1f] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-dark-text dark:text-white outline-none focus:border-primary"
        />
      </div>
    </div>
    <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-white/10">
      <button
        onClick={onClear}
        className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
      >
        Limpiar Filtros
      </button>
      <button
        onClick={onApply}
        className="px-4 py-2 rounded-xl text-sm font-bold text-black bg-primary hover:bg-primary-dark shadow-sm transition-colors flex items-center gap-2"
      >
        <span className="material-symbols-outlined text-[18px]">search</span>
        Aplicar Filtros
      </button>
    </div>
  </div>
);

export default ShipmentsFiltersPanel;
