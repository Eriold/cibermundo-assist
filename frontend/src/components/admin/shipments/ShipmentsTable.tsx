import { ActionButton, MaterialIcon, TableCard, TableStatusRow, cn } from '../ui/AdminPrimitives';
import type { GestionSummary, Shipment } from './types';
import { formatDateOnly, getGestionBadge, getShipmentSizeBadge } from './utils';

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

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  currency: 'COP',
  maximumFractionDigits: 0,
  style: 'currency',
});

const getShipmentSelectionKey = (shipment: Shipment) =>
  `${shipment.record_source || 'active'}:${shipment.tracking_number}`;

const formatCurrency = (value?: number) => {
  if (typeof value !== 'number') return '-';
  return currencyFormatter.format(value);
};

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
    <TableCard>
      <div className="flex flex-col gap-3 border-b border-gray-200/80 px-5 py-4 dark:border-white/10 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
            Resultados actuales
          </p>
          <h2 className="mt-1 text-lg font-black tracking-tight text-dark-text dark:text-white">
            Guias visibles
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400">
          <span className="rounded-full bg-gray-100 px-3 py-1.5 dark:bg-white/5">
            {visibleShipments.length} visibles
          </span>
          <span className="rounded-full bg-primary/10 px-3 py-1.5 text-primary">
            {shipments.length} en pagina
          </span>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            {formatCurrency(totalCollect)}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-[1040px] w-full border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-gray-50/95 shadow-sm backdrop-blur dark:bg-[#232218]/95">
            <tr className="border-b border-gray-200/80 dark:border-white/10">
              <th className="px-4 py-3 text-sm font-black text-gray-500 dark:text-gray-400">
                <label className="inline-flex items-center gap-3 cursor-pointer">
                  <input
                    checked={allVisibleSelected}
                    className="size-4 rounded border-gray-300 text-primary focus:ring-primary"
                    onChange={onToggleSelectAllVisible}
                    type="checkbox"
                  />
                  <span>Guia</span>
                </label>
              </th>
              <th className="px-4 py-3 text-sm font-black text-gray-500 dark:text-gray-400">Zona</th>
              <th className="px-4 py-3 text-center text-sm font-black text-gray-500 dark:text-gray-400">Tamano</th>
              <th className="px-4 py-3 text-sm font-black text-gray-500 dark:text-gray-400">Fecha ingreso</th>
              <th className="px-4 py-3 text-sm font-black text-gray-500 dark:text-gray-400">Cliente</th>
              <th className="px-4 py-3 text-sm font-black text-gray-500 dark:text-gray-400">Telefono</th>
              <th className="px-4 py-3 text-sm font-black text-gray-500 dark:text-gray-400">Valor</th>
              <th className="px-4 py-3 text-center text-sm font-black text-gray-500 dark:text-gray-400">Gestion</th>
              <th className="px-4 py-3 text-right text-sm font-black text-gray-500 dark:text-gray-400">
                Acciones
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {loading && shipments.length === 0 ? (
              <TableStatusRow
                colSpan={9}
                description="Estamos consultando la pagina actual del historial."
                icon="progress_activity"
                iconClassName="animate-spin"
                title="Cargando guias..."
              />
            ) : visibleShipments.length === 0 ? (
              <TableStatusRow
                colSpan={9}
                description="No encontramos resultados con la combinacion actual de busqueda y filtros."
                icon="filter_alt_off"
                title="Sin coincidencias"
              />
            ) : (
              visibleShipments.map((shipment, index) => {
                const badge = getGestionBadge(shipment.gestion_count);
                const sizeBadge = getShipmentSizeBadge(shipment.shipment_size);
                const isSelected = selectedShipmentKeys.includes(getShipmentSelectionKey(shipment));

                return (
                  <tr
                    className={cn(
                      'transition-colors hover:bg-gray-50 dark:hover:bg-white/5',
                      badge.border,
                      isSelected && 'bg-primary/5 dark:bg-primary/5',
                    )}
                    key={`${shipment.tracking_number}-${index}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <input
                          checked={isSelected}
                          className="size-4 shrink-0 rounded border-gray-300 text-primary focus:ring-primary"
                          onChange={() => onToggleShipmentSelection(shipment)}
                          type="checkbox"
                        />

                        <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          <MaterialIcon className="text-[20px]" name="package" />
                        </div>

                        <div className="min-w-0">
                          <p className="font-mono text-sm font-black text-dark-text dark:text-white">
                            {shipment.tracking_number}
                          </p>
                          <p className="truncate text-xs uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                            {shipment.delivery_type}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-sm font-bold text-gray-600 dark:text-gray-300">
                      {shipment.zone_name || <span className="text-gray-400 italic">Central</span>}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          'inline-flex min-w-16 items-center justify-center rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em]',
                          sizeBadge.className,
                        )}
                      >
                        {sizeBadge.label}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-sm font-bold text-gray-600 dark:text-gray-300">
                      {formatDateOnly(shipment.scanned_at)}
                    </td>

                    <td className="px-4 py-3 text-sm">
                      {shipment.recipient_name || shipment.client_name ? (
                        <p
                          className="max-w-[12rem] truncate font-black text-dark-text dark:text-white"
                          title={shipment.recipient_name || shipment.client_name}
                        >
                          {shipment.recipient_name || shipment.client_name}
                        </p>
                      ) : (
                        <span className="text-gray-400 italic">No disponible</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-sm font-bold text-gray-600 dark:text-gray-300">
                      {shipment.recipient_phone || shipment.client_phone || (
                        <span className="text-gray-400 italic">-</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-sm font-bold text-gray-600 dark:text-gray-300">
                      {shipment.payment_desc ? (
                        <span className="text-dark-text dark:text-white">{formatCurrency(shipment.amount_total)}</span>
                      ) : shipment.office_status === 'ANOMALIA_DATOS' &&
                        (shipment.api_message || '').startsWith('FALLO_RASTREO_FINAL:') ? (
                        <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                          <MaterialIcon className="text-[16px]" name="warning" />
                          Sin rastreo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2 text-sm font-bold text-gray-400">
                          <MaterialIcon className="animate-spin text-[16px]" name="refresh" />
                          Cargando
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          'inline-flex size-9 items-center justify-center rounded-full text-sm font-black',
                          badge.bg,
                          badge.textColor,
                        )}
                      >
                        {shipment.gestion_count ?? 0}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <ActionButton className="px-3 py-2" onClick={() => onOpenEdit(shipment)} variant="subtle">
                          Editar
                        </ActionButton>
                        <ActionButton className="px-3 py-2" onClick={() => onDelete(shipment)} variant="danger">
                          Eliminar
                        </ActionButton>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          <tfoot className="sticky bottom-0 z-10 border-t border-gray-200/80 bg-gray-50/95 shadow-[0_-12px_30px_-24px_rgba(24,24,17,0.4)] backdrop-blur dark:border-white/10 dark:bg-[#1f1e16]/95">
            <tr>
              <td className="px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400" colSpan={6}>
                Total a recolectar ({shipments.length})
              </td>
              <td className="px-4 py-3 text-lg font-black text-primary">{formatCurrency(totalCollect)}</td>
              <td className="px-4 py-3" colSpan={2}>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {[0, 1, 2, 3].map((value) => {
                    const key = `gestion_${value}`;
                    const count = gestionSummary[key] || 0;

                    return (
                      <button
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-black transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                          colors[value],
                          gestionFilter === value ? 'scale-105 ring-2 ring-primary' : 'hover:scale-[1.03]',
                        )}
                        key={value}
                        onClick={() => onToggleGestionFilter(value)}
                        type="button"
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
    </TableCard>
  );
};

export default ShipmentsTable;
