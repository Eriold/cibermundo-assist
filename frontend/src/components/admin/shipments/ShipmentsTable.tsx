import type { GestionSummary, Shipment } from './types';
import { formatDate, getGestionBadge } from './utils';

interface ShipmentsTableProps {
  allVisibleSelected: boolean;
  gestionFilter: number | null;
  gestionSummary: GestionSummary;
  loading: boolean;
  onDelete: (shipment: Shipment) => void;
  onOpenEdit: (shipment: Shipment) => void;
  onToggleGestionFilter: (value: number) => void;
  onToggleSelectAllVisible: () => void;
  onToggleShipmentSelection: (shipment: Shipment) => void;
  selectedShipmentKeys: string[];
  shipments: Shipment[];
  visibleShipments: Shipment[];
}

const colors = [
  'bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400',
  'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400',
  'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
  'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
];

const getShipmentSelectionKey = (shipment: Shipment) => `${shipment.record_source || 'active'}:${shipment.tracking_number}`;

const ShipmentsTable = ({
  allVisibleSelected,
  gestionFilter,
  gestionSummary,
  loading,
  onDelete,
  onOpenEdit,
  onToggleGestionFilter,
  onToggleSelectAllVisible,
  onToggleShipmentSelection,
  selectedShipmentKeys,
  shipments,
  visibleShipments,
}: ShipmentsTableProps) => {
  const totalCollect = shipments.reduce((sum, shipment) => sum + (shipment.amount_total || 0), 0);

  return (
    <div className="bg-white dark:bg-[#181811] rounded-3xl shadow-sm border border-gray-100 dark:border-white/10 overflow-visible flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1000px] h-max">
          <thead className="sticky top-0 bg-gray-50 dark:bg-[#2c2b1f] border-b border-gray-200 dark:border-white/10 z-10 shadow-sm">
            <tr>
              <th className="p-4 py-3 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">
                <label className="inline-flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={onToggleSelectAllVisible}
                    className="size-4 rounded border-gray-300 text-red-500 focus:ring-red-500"
                  />
                  <span>N Guia</span>
                </label>
              </th>
              <th className="p-4 py-3 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">Zona</th>
              <th className="p-4 py-3 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">Fecha Ingreso</th>
              <th className="p-4 py-3 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">Cliente</th>
              <th className="p-4 py-3 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">Telefono</th>
              <th className="p-4 py-3 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">Valor</th>
              <th className="p-4 py-3 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap text-center">Gestion</th>
              <th className="p-4 py-3 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {loading && shipments.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-10 text-center text-gray-400 h-64">
                  <div className="flex flex-col items-center justify-center">
                    <span className="material-symbols-outlined animate-spin text-4xl mb-2">progress_activity</span>
                    <p className="font-bold">Cargando...</p>
                  </div>
                </td>
              </tr>
            ) : visibleShipments.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-10 text-center text-gray-400 h-64">
                  <div className="flex flex-col items-center justify-center">
                    <span className="material-symbols-outlined text-4xl mb-2 opacity-50">inbox</span>
                    <p className="font-bold">No hay guias registradas en este apartado.</p>
                  </div>
                </td>
              </tr>
            ) : (
              visibleShipments.map((shipment, index) => {
                const badge = getGestionBadge(shipment.gestion_count);
                const isSelected = selectedShipmentKeys.includes(getShipmentSelectionKey(shipment));

                return (
                  <tr key={shipment.tracking_number + index} className={`hover:bg-gray-50/50 dark:hover:bg-black/20 transition-colors ${badge.border}`}>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleShipmentSelection(shipment)}
                          className="size-4 rounded border-gray-300 text-red-500 focus:ring-red-500 shrink-0"
                        />
                        <div className="size-10 rounded-full bg-primary-light/20 text-primary flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[20px]">package</span>
                        </div>
                        <div>
                          <p className="font-mono font-bold text-dark-text dark:text-white text-base">{shipment.tracking_number}</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{shipment.delivery_type}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm font-medium text-gray-600 dark:text-gray-300">
                      {shipment.zone_name || <span className="text-gray-400 italic">Central</span>}
                    </td>
                    <td className="p-4 text-sm font-medium text-gray-600 dark:text-gray-300">
                      {formatDate(shipment.scanned_at)}
                    </td>
                    <td className="p-4 text-sm">
                      {shipment.recipient_name || shipment.client_name ? (
                        <p className="font-bold text-dark-text dark:text-white w-48 truncate" title={shipment.recipient_name || shipment.client_name}>
                          {shipment.recipient_name || shipment.client_name}
                        </p>
                      ) : (
                        <span className="text-gray-400 italic">No disponible</span>
                      )}
                    </td>
                    <td className="p-4 text-sm">
                      {shipment.recipient_phone || shipment.client_phone ? (
                        <p className="text-gray-700 dark:text-gray-300">{shipment.recipient_phone || shipment.client_phone}</p>
                      ) : (
                        <span className="text-gray-400 italic">-</span>
                      )}
                    </td>
                    <td className="p-4 text-sm font-medium text-gray-600 dark:text-gray-300">
                      {shipment.payment_desc ? (
                        <span className="text-sm font-bold text-gray-900 dark:text-white">${shipment.amount_total?.toLocaleString()}</span>
                      ) : shipment.office_status === 'ANOMALIA_DATOS' && (shipment.api_message || '').startsWith('FALLO_RASTREO_FINAL:') ? (
                        <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-bold">
                          <span className="material-symbols-outlined text-[16px]">warning</span>
                          Sin rastreo
                        </span>
                      ) : (
                        <span className="text-gray-400 italic flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px] animate-spin">refresh</span>
                          Cargando
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center justify-center size-8 rounded-lg font-black text-sm ${badge.bg} ${badge.textColor}`}>
                        {shipment.gestion_count ?? 0}
                      </span>
                    </td>
                    <td className="p-4 text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => onOpenEdit(shipment)}
                          className="size-8 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 flex items-center justify-center transition-colors"
                          title="Editar Guia"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          onClick={() => onDelete(shipment)}
                          className="size-8 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center transition-colors"
                          title="Eliminar Guia"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot className="sticky bottom-0 bg-gray-100 dark:bg-[#1f1e16] border-t border-gray-200 dark:border-white/10 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <tr>
              <td colSpan={5} className="p-4 text-right font-black text-gray-700 dark:text-gray-300 uppercase tracking-widest text-sm">
                Total a Recolectar ({shipments.length}):
              </td>
              <td className="p-4 font-black text-primary text-lg">${totalCollect.toLocaleString()}</td>
              <td colSpan={2} className="p-4">
                <div className="flex items-center gap-2 justify-end">
                  {[0, 1, 2, 3].map((value) => {
                    const key = `gestion_${value}`;
                    const count = gestionSummary[key] || 0;

                    return (
                      <button
                        key={value}
                        onClick={() => onToggleGestionFilter(value)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-all ${colors[value]} ${gestionFilter === value ? 'ring-2 ring-primary scale-105' : 'hover:scale-105'}`}
                      >
                        G{value}: {count}
                      </button>
                    );
                  })}
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default ShipmentsTable;
