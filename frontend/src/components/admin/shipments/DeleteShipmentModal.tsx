import type { Shipment } from './types';

interface DeleteShipmentModalProps {
  deleting: boolean;
  shipment: Shipment | null;
  onCancel: () => void;
  onConfirm: () => void;
}

const DeleteShipmentModal = ({
  deleting,
  shipment,
  onCancel,
  onConfirm,
}: DeleteShipmentModalProps) => {
  if (!shipment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1a1a12] rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col p-6 text-center animate-fade-in-down">
        <div className="size-16 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-3xl">delete_forever</span>
        </div>
        <h3 className="text-xl font-bold dark:text-white mb-2">Eliminar Guía</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
          ¿Deseas eliminar permanentemente la guía <strong>{shipment.tracking_number}</strong>? Su registro se borrará de inmediato del offline DB y de reportes.
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
            className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
            disabled={deleting}
          >
            {deleting ? <span className="material-symbols-outlined animate-spin">sync</span> : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteShipmentModal;
