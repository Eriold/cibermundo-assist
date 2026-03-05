import React from 'react';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ScannerModal: React.FC<ScannerModalProps> = ({ isOpen, onClose }) => {
  // We'll use a transform to animate the slide up/down based on isOpen
  const transformClass = isOpen ? 'translate-y-0' : 'translate-y-full';

  return (
    <div className={`absolute bottom-0 left-0 w-full z-30 flex flex-col h-[65vh] transition-transform duration-300 ease-out ${transformClass} bg-background-light dark:bg-background-dark rounded-t-xl shadow-[0_-8px_30px_rgba(0,0,0,0.3)]`}>
      {/* Handle */}
      <div 
        className="w-full flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing touch-none"
        onClick={onClose} // Simple close on click for now
      >
        <div className="h-1.5 w-12 rounded-full bg-gray-300 dark:bg-gray-600"></div>
      </div>

      {/* Header */}
      <div className="px-6 pt-4 pb-2 flex items-center justify-between shrink-0">
        <h2 className="text-[#181811] dark:text-white text-[24px] font-bold leading-tight tracking-tight">
          Historial Reciente
        </h2>
        <button className="text-xs font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors px-3 py-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10">
          Limpiar lista
        </button>
      </div>

      {/* List Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pt-2 pb-8 space-y-3">
        {/* Item 1: Pending (Primary Focus) */}
        <div className="relative group flex items-center gap-3 bg-white dark:bg-[#2f2e1a] p-4 rounded-lg shadow-sm border-l-[6px] border-primary transition-all active:scale-[0.98]">
          <div className="flex-shrink-0 size-10 rounded-full bg-primary flex items-center justify-center text-black">
            <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[#181811] dark:text-white text-lg font-bold font-mono tracking-tight leading-none truncate">...X9902</p>
              <span className="bg-primary text-black text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">Pendiente</span>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">14:32 • Esperando sincronización</p>
          </div>
          <div className="shrink-0 flex gap-1">
            <button aria-label="Reintentar" className="size-9 rounded-full bg-gray-100 dark:bg-black/20 flex items-center justify-center text-gray-700 dark:text-gray-200 hover:bg-primary hover:text-black transition-colors">
              <span className="material-symbols-outlined text-[18px]">sync</span>
            </button>
          </div>
        </div>

        {/* Item 2: Registered (Success) */}
        <div className="relative group flex items-center gap-3 bg-white dark:bg-[#2f2e1a] p-4 rounded-lg shadow-sm border-l-[6px] border-[#181811] dark:border-white/20 opacity-90 transition-all active:scale-[0.98]">
          <div className="flex-shrink-0 size-10 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-[#181811] dark:text-white">
            <span className="material-symbols-outlined text-[20px]">check_circle</span>
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[#181811] dark:text-white text-lg font-semibold font-mono tracking-tight leading-none truncate">...B1123</p>
              <span className="bg-[#181811] dark:bg-white text-white dark:text-black text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">Registrado</span>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">14:30 • Escaneo exitoso</p>
          </div>
          <div className="shrink-0 flex gap-1">
            <button aria-label="Copiar" className="size-9 rounded-full bg-transparent flex items-center justify-center text-gray-400 hover:text-[#181811] dark:hover:text-white transition-colors">
              <span className="material-symbols-outlined text-[18px]">content_copy</span>
            </button>
          </div>
        </div>

        {/* Item 3: Existing (Neutral/Warning) */}
        <div className="relative group flex items-center gap-3 bg-white dark:bg-[#2f2e1a] p-4 rounded-lg shadow-sm border-l-[6px] border-gray-300 dark:border-gray-600 opacity-75 transition-all active:scale-[0.98]">
          <div className="flex-shrink-0 size-10 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center text-gray-400 dark:text-gray-400">
            <span className="material-symbols-outlined text-[20px]">inventory_2</span>
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[#181811] dark:text-gray-300 text-lg font-medium font-mono tracking-tight leading-none truncate">...C5541</p>
              <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">Existente</span>
            </div>
            <p className="text-gray-500 dark:text-gray-500 text-xs font-medium">14:28 • Lote anterior</p>
          </div>
          <div className="shrink-0 flex gap-1">
            <button aria-label="Detalles" className="size-9 rounded-full bg-transparent flex items-center justify-center text-gray-300 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
              <span className="material-symbols-outlined text-[18px]">info</span>
            </button>
          </div>
        </div>

        {/* Item 4: Registered (Success) */}
        <div className="relative group flex items-center gap-3 bg-white dark:bg-[#2f2e1a] p-4 rounded-lg shadow-sm border-l-[6px] border-[#181811] dark:border-white/20 opacity-75 transition-all active:scale-[0.98]">
          <div className="flex-shrink-0 size-10 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-[#181811] dark:text-white">
            <span className="material-symbols-outlined text-[20px]">check_circle</span>
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[#181811] dark:text-white text-lg font-semibold font-mono tracking-tight leading-none truncate">...A8891</p>
              <span className="bg-[#181811] dark:bg-white text-white dark:text-black text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">Registrado</span>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">14:15 • Escaneo exitoso</p>
          </div>
          <div className="shrink-0 flex gap-1">
            <button aria-label="Copiar" className="size-9 rounded-full bg-transparent flex items-center justify-center text-gray-400 hover:text-[#181811] dark:hover:text-white transition-colors">
              <span className="material-symbols-outlined text-[18px]">content_copy</span>
            </button>
          </div>
        </div>

        {/* Item 5: Registered (Success) */}
        <div className="relative group flex items-center gap-3 bg-white dark:bg-[#2f2e1a] p-4 rounded-lg shadow-sm border-l-[6px] border-[#181811] dark:border-white/20 opacity-60 transition-all active:scale-[0.98]">
          <div className="flex-shrink-0 size-10 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-[#181811] dark:text-white">
            <span className="material-symbols-outlined text-[20px]">check_circle</span>
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[#181811] dark:text-white text-lg font-semibold font-mono tracking-tight leading-none truncate">...D2020</p>
              <span className="bg-[#181811] dark:bg-white text-white dark:text-black text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">Registrado</span>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">14:02 • Escaneo exitoso</p>
          </div>
          <div className="shrink-0 flex gap-1">
            <button aria-label="Copiar" className="size-9 rounded-full bg-transparent flex items-center justify-center text-gray-400 hover:text-[#181811] dark:hover:text-white transition-colors">
              <span className="material-symbols-outlined text-[18px]">content_copy</span>
            </button>
          </div>
        </div>

        <div className="h-6 w-full"></div> {/* Bottom Spacer for safe area */}
      </div>
    </div>
  );
};

export default ScannerModal;
