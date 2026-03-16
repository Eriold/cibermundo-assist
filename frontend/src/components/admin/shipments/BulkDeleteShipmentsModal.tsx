import { useEffect, useState } from 'react';

interface BulkDeleteShipmentsModalProps {
  count: number;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const BulkDeleteShipmentsModal = ({
  count,
  deleting,
  onCancel,
  onConfirm,
}: BulkDeleteShipmentsModalProps) => {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    setCountdown(5);

    const interval = setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          clearInterval(interval);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [count]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1a1a12] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col p-6 animate-fade-in-down">
        <div className="size-16 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-3xl">delete_sweep</span>
        </div>
        <h3 className="text-xl font-bold dark:text-white mb-2 text-center">Eliminar Guias Seleccionadas</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-2 text-sm text-center">
          Vas a eliminar permanentemente <strong>{count}</strong> guia{count === 1 ? '' : 's'}.
        </p>
        <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm text-center">
          Esta accion no se puede deshacer y borrara los registros, tracking y jobs relacionados.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
            disabled={deleting}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={deleting || countdown > 0}
          >
            {deleting ? (
              <span className="material-symbols-outlined animate-spin">sync</span>
            ) : countdown > 0 ? (
              `Eliminar en ${countdown}s`
            ) : (
              'Eliminar Seleccionadas'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkDeleteShipmentsModal;
