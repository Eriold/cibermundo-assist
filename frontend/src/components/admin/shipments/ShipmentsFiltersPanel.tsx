import {
  ActionButton,
  SurfaceCard,
  fieldClassName,
  selectClassName,
} from '../ui/AdminPrimitives';
import type { CatalogItem, ShipmentFilters } from './types';

interface ShipmentsFiltersPanelProps {
  filters: ShipmentFilters;
  managements: CatalogItem[];
  zones: CatalogItem[];
  onApply: () => void;
  onChange: (filters: ShipmentFilters) => void;
  onClear: () => void;
}

const ShipmentsFiltersPanel = ({
  filters,
  managements,
  zones,
  onApply,
  onChange,
  onClear,
}: ShipmentsFiltersPanelProps) => (
  <SurfaceCard className="px-5 py-5 sm:px-6">
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
          Filtros avanzados
        </p>
        <h2 className="mt-1 text-lg font-black tracking-tight text-dark-text dark:text-white">
          Refina la lista visible
        </h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="space-y-2">
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300" htmlFor="filter-zone">
            Zona
          </label>
          <select
            className={selectClassName}
            id="filter-zone"
            name="zoneId"
            onChange={(event) => onChange({ ...filters, zoneId: event.target.value })}
            value={filters.zoneId}
          >
            <option value="">Todas las zonas</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300" htmlFor="filter-management">
            Gestion
          </label>
          <select
            className={selectClassName}
            id="filter-management"
            name="managementId"
            onChange={(event) => onChange({ ...filters, managementId: event.target.value })}
            value={filters.managementId}
          >
            <option value="">Todas las gestiones</option>
            {managements.map((management) => (
              <option key={management.id} value={management.id}>
                {management.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300" htmlFor="filter-date-from">
            Desde ingreso
          </label>
          <input
            autoComplete="off"
            className={fieldClassName}
            id="filter-date-from"
            name="dateFrom"
            onChange={(event) => onChange({ ...filters, dateFrom: event.target.value })}
            type="date"
            value={filters.dateFrom}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300" htmlFor="filter-date-to">
            Hasta ingreso
          </label>
          <input
            autoComplete="off"
            className={fieldClassName}
            id="filter-date-to"
            name="dateTo"
            onChange={(event) => onChange({ ...filters, dateTo: event.target.value })}
            type="date"
            value={filters.dateTo}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300" htmlFor="filter-checkout-from">
            Desde salida
          </label>
          <input
            autoComplete="off"
            className={fieldClassName}
            id="filter-checkout-from"
            name="checkoutDateFrom"
            onChange={(event) => onChange({ ...filters, checkoutDateFrom: event.target.value })}
            type="date"
            value={filters.checkoutDateFrom}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300" htmlFor="filter-checkout-to">
            Hasta salida
          </label>
          <input
            autoComplete="off"
            className={fieldClassName}
            id="filter-checkout-to"
            name="checkoutDateTo"
            onChange={(event) => onChange({ ...filters, checkoutDateTo: event.target.value })}
            type="date"
            value={filters.checkoutDateTo}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-gray-200/80 pt-4 dark:border-white/10 sm:flex-row sm:justify-end">
        <ActionButton onClick={onClear} variant="secondary">
          Limpiar Filtros
        </ActionButton>
        <ActionButton icon="search" onClick={onApply} variant="primary">
          Aplicar Filtros
        </ActionButton>
      </div>
    </div>
  </SurfaceCard>
);

export default ShipmentsFiltersPanel;
