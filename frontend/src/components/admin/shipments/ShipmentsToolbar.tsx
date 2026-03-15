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
  <div className="flex justify-between items-center mb-4 shrink-0">
    <div>
      <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl w-max">
        <button
          onClick={() => onChangeTab('open')}
          className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === 'open' ? 'bg-white text-dark-text shadow-sm dark:bg-[#2c2b1f] dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
          type="button"
        >
          Guias Abiertas
        </button>
        <button
          onClick={() => onChangeTab('closed')}
          className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === 'closed' ? 'bg-white text-dark-text shadow-sm dark:bg-[#2c2b1f] dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
          type="button"
        >
          Archivadas / Cerradas
        </button>
      </div>
      <p className="text-sm text-gray-500 mt-2">
        {activeTab === 'open'
          ? 'Excluye despachos en estado cerrado o finalizado.'
          : 'Solo guias con Check-out definitivo (Cerradas).'}
      </p>
    </div>
    <div className="flex items-center gap-4">
      <label className="hidden sm:flex items-center gap-2 cursor-pointer select-none">
        <span className="text-sm font-bold text-gray-500 dark:text-gray-400 mr-1">Auto Update (10s)</span>
        <div className="relative">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={autoRefresh}
            onChange={(event) => onToggleAutoRefresh(event.target.checked)}
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-white/10 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary" />
        </div>
      </label>
      <button
        onClick={onToggleFilters}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm shadow-sm transition-colors ${showFilters ? 'bg-primary text-black' : 'bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-dark-text dark:text-white'}`}
      >
        <span className="material-symbols-outlined text-[18px]">tune</span>
        Filtros
      </button>
      <button
        onClick={onLoadGestiones}
        disabled={loadingGestiones}
        className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2 rounded-xl font-bold text-sm shadow-sm transition-all active:scale-95 disabled:opacity-50"
        title="Scrapear gestiones de paquetes abiertos"
      >
        <span className={`material-symbols-outlined text-[18px] ${loadingGestiones ? 'animate-spin' : ''}`}>
          {loadingGestiones ? 'sync' : 'update'}
        </span>
        Cargar Gestiones
      </button>
      <button
        onClick={onRefresh}
        disabled={loading}
        className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-dark-text dark:text-white px-4 py-2 rounded-xl font-bold text-sm shadow-sm transition-transform active:scale-95 disabled:opacity-50"
      >
        <span className={`material-symbols-outlined text-[18px] ${loading && !autoRefresh ? 'animate-spin' : ''}`}>sync</span>
        Actualizar
      </button>
    </div>
  </div>
);

export default ShipmentsToolbar;
