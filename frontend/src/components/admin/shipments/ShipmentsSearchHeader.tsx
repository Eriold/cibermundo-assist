interface ShipmentsSearchHeaderProps {
  loading: boolean;
  page: number;
  searchTerm: string;
  totalPages: number;
  onChangeSearchTerm: (value: string) => void;
  onClearSearch: () => void;
  onPageChange: (page: number) => void;
  onSearch: () => void;
}

const ShipmentsSearchHeader = ({
  loading,
  page,
  searchTerm,
  totalPages,
  onChangeSearchTerm,
  onClearSearch,
  onPageChange,
  onSearch,
}: ShipmentsSearchHeaderProps) => (
  <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4 shrink-0 bg-white dark:bg-[#181811] p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-white/10">
    <div className="flex items-center gap-4 w-full md:w-auto">
      <div className="flex items-center gap-2 bg-gray-100 dark:bg-white/5 px-4 py-2 rounded-xl border border-transparent focus-within:border-primary focus-within:bg-white dark:focus-within:bg-[#2c2b1f] transition-all w-full md:w-80">
        <span className="material-symbols-outlined text-gray-400">search</span>
        <input
          type="text"
          placeholder="Buscar por numero de guia..."
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

export default ShipmentsSearchHeader;
