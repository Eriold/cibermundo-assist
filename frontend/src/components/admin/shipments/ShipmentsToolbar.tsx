import {
  ActionButton,
  MaterialIcon,
  SegmentedControl,
  SurfaceCard,
} from '../ui/AdminPrimitives';
import type { TabMode } from './types';

interface ShipmentsToolbarProps {
  activeTab: TabMode;
  autoRefresh: boolean;
  loading: boolean;
  loadingGestiones: boolean;
  onChangeTab: (tab: TabMode) => void;
  onLoadGestiones: () => void;
  onRefresh: () => void;
  onToggleAutoRefresh: (value: boolean) => void;
  onToggleFilters: () => void;
  showFilters: boolean;
}

const ShipmentsToolbar = ({
  activeTab,
  autoRefresh,
  loading,
  loadingGestiones,
  onChangeTab,
  onLoadGestiones,
  onRefresh,
  onToggleAutoRefresh,
  onToggleFilters,
  showFilters,
}: ShipmentsToolbarProps) => (
  <SurfaceCard className="px-5 py-4 sm:px-6">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="space-y-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
            Vista de trabajo
          </p>
          <h2 className="mt-1 text-lg font-black tracking-tight text-dark-text dark:text-white">
            Estado del historial
          </h2>
        </div>

        <div className="max-w-xl">
          <SegmentedControl
            ariaLabel="Seleccionar vista de guias"
            onChange={(value) => onChangeTab(value as TabMode)}
            options={[
              { label: 'Guias Abiertas', value: 'open' },
              { label: 'Archivadas / Cerradas', value: 'closed' },
            ]}
            value={activeTab}
          />
        </div>

        <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
          {activeTab === 'open'
            ? 'Incluye guias en seguimiento activo y excluye registros con cierre definitivo.'
            : 'Muestra solo guias con check-out finalizado y consolidadas en historial.'}
        </p>
      </div>

      <div className="flex flex-col gap-3 xl:items-end">
        <label className="inline-flex items-center gap-3 rounded-2xl border border-gray-200/80 bg-white px-4 py-2.5 text-sm font-bold text-dark-text dark:border-white/10 dark:bg-[#232218] dark:text-white">
          <span className="text-xs uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
            Auto Update 10s
          </span>
          <span className="relative inline-flex items-center">
            <input
              checked={autoRefresh}
              className="peer sr-only"
              onChange={(event) => onToggleAutoRefresh(event.target.checked)}
              type="checkbox"
            />
            <span className="block h-7 w-12 rounded-full bg-gray-200 transition-colors peer-checked:bg-primary dark:bg-white/10" />
            <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <ActionButton icon="tune" onClick={onToggleFilters} variant={showFilters ? 'primary' : 'secondary'}>
            {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
          </ActionButton>
          <ActionButton
            icon={loadingGestiones ? 'sync' : 'update'}
            iconClassName={loadingGestiones ? 'animate-spin' : undefined}
            onClick={onLoadGestiones}
            variant="subtle"
          >
            Cargar Gestiones
          </ActionButton>
          <ActionButton
            disabled={loading}
            icon="sync"
            iconClassName={loading ? 'animate-spin' : undefined}
            onClick={onRefresh}
            variant="secondary"
          >
            Actualizar
          </ActionButton>
        </div>

        <div className="flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400">
          <MaterialIcon className="text-[16px]" name="bolt" />
          Acciones rapidas para consulta y mantenimiento.
        </div>
      </div>
    </div>
  </SurfaceCard>
);

export default ShipmentsToolbar;
