import { useEffect, useState } from 'react';
import { getShipments } from '../../services/api';
import { getShipmentSizeBadge } from './shipments/utils';
import {
  ActionButton,
  AdminHeader,
  AdminSection,
  InlineAlert,
  MaterialIcon,
  StatCard,
  SurfaceCard,
  TableCard,
  TableStatusRow,
  cn,
} from './ui/AdminPrimitives';

interface Shipment {
  amount_total?: number;
  api_current_state_desc?: string;
  delivery_type: string;
  office_status: string;
  payment_desc?: string;
  scanned_at: string;
  scanned_by: string;
  shipment_size?: 'L' | 'M' | 'S' | 'XL' | null;
  tracking_number: string;
  zone_name?: string;
}

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  currency: 'COP',
  maximumFractionDigits: 0,
  style: 'currency',
});

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const formatDate = (value: string) => {
  if (!value) return '-';

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : dateFormatter.format(date);
};

const formatCurrency = (value?: number) => {
  if (typeof value !== 'number') return '-';
  return currencyFormatter.format(value);
};

const MonitorTab = () => {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchShipments = async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setErrorMsg('');
    }

    try {
      const data = await getShipments();
      setShipments(data.data || []);
    } catch (error) {
      console.error('Error al cargar guias', error);
      if (!silent) setErrorMsg('No se pudo cargar el monitor en vivo. Verifica la conexion con el servidor.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchShipments(false);
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    if (autoRefresh) {
      interval = setInterval(() => {
        fetchShipments(true);
      }, 10000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const withValue = shipments.filter((shipment) => shipment.payment_desc).length;

  return (
    <AdminSection>
      <AdminHeader
        actions={
          <>
            <label className="inline-flex items-center gap-3 rounded-2xl border border-gray-200/80 bg-white px-4 py-2.5 text-sm font-bold text-dark-text dark:border-white/10 dark:bg-[#232218] dark:text-white">
              <span className="text-xs uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                Auto Update 10s
              </span>
              <span className="relative inline-flex items-center">
                <input
                  checked={autoRefresh}
                  className="peer sr-only"
                  onChange={(event) => setAutoRefresh(event.target.checked)}
                  type="checkbox"
                />
                <span className="block h-7 w-12 rounded-full bg-gray-200 transition-colors peer-checked:bg-primary dark:bg-white/10" />
                <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
              </span>
            </label>
            <ActionButton icon="sync" onClick={() => fetchShipments(false)} variant="secondary">
              Actualizar
            </ActionButton>
          </>
        }
        description="Seguimiento inmediato de las guias procesadas recientemente. La recarga automatica sigue activa cada 10 segundos cuando esta habilitada."
        eyebrow="Tiempo real"
        title="Monitor en Vivo"
      >
        <StatCard icon="inventory_2" label="Registros" value={shipments.length} />
        <StatCard icon="payments" label="Con valor" tone="success" value={withValue} />
        <StatCard icon={autoRefresh ? 'autorenew' : 'pause_circle'} label="Auto update" tone="primary" value={autoRefresh ? 'Activo' : 'Pausado'} />
      </AdminHeader>

      {errorMsg ? <InlineAlert>{errorMsg}</InlineAlert> : null}

      <SurfaceCard className="px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
              Estado del feed
            </p>
            <h2 className="mt-1 flex items-center gap-2 text-lg font-black tracking-tight text-dark-text dark:text-white">
              Actividad reciente
              <span className="relative flex size-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-3 rounded-full bg-emerald-500" />
              </span>
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400">
            <span className="rounded-full bg-gray-100 px-3 py-1.5 dark:bg-white/5">
              {shipments.length} guias visibles
            </span>
            <span className="rounded-full bg-primary/10 px-3 py-1.5 text-primary">
              {autoRefresh ? 'Actualizacion automatica encendida' : 'Actualizacion manual'}
            </span>
          </div>
        </div>
      </SurfaceCard>

      <TableCard>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="min-w-[980px] w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-gray-50/95 shadow-sm backdrop-blur dark:bg-[#232218]/95">
              <tr className="border-b border-gray-200/80 dark:border-white/10">
                <th className="px-4 py-3 text-sm font-black text-gray-500 dark:text-gray-400">Guia</th>
                <th className="px-4 py-3 text-sm font-black text-gray-500 dark:text-gray-400">Escaneada por</th>
                <th className="px-4 py-3 text-sm font-black text-gray-500 dark:text-gray-400">Zona</th>
                <th className="px-4 py-3 text-sm font-black text-gray-500 dark:text-gray-400">Fecha</th>
                <th className="px-4 py-3 text-center text-sm font-black text-gray-500 dark:text-gray-400">Tamano</th>
                <th className="px-4 py-3 text-right text-sm font-black text-gray-500 dark:text-gray-400">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {loading && shipments.length === 0 ? (
                <TableStatusRow
                  colSpan={6}
                  description="Estamos consultando las guias procesadas mas recientes."
                  icon="progress_activity"
                  iconClassName="animate-spin"
                  title="Cargando monitor..."
                />
              ) : shipments.length === 0 ? (
                <TableStatusRow
                  colSpan={6}
                  description="Todavia no hay guias recientes para mostrar en este monitor."
                  icon="inbox"
                  title="Sin actividad reciente"
                />
              ) : (
                shipments.map((shipment, index) => {
                  const sizeBadge = getShipmentSizeBadge(shipment.shipment_size);

                  return (
                    <tr className="transition-colors hover:bg-gray-50 dark:hover:bg-white/5" key={`${shipment.tracking_number}-${index}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
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
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 text-sm font-bold text-gray-700 dark:bg-white/5 dark:text-gray-200">
                          <MaterialIcon className="text-[16px]" name="person" />
                          {shipment.scanned_by}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-600 dark:text-gray-300">
                        {shipment.zone_name || <span className="text-gray-400 italic">Central</span>}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-600 dark:text-gray-300">
                        {formatDate(shipment.scanned_at)}
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
                      <td className="px-4 py-3 text-right">
                        {shipment.payment_desc ? (
                          <span className="font-bold text-dark-text dark:text-white">
                            {formatCurrency(shipment.amount_total)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 text-sm font-bold text-gray-400">
                            <MaterialIcon className={loading ? 'animate-spin text-[16px]' : 'text-[16px]'} name="schedule" />
                            Pendiente
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </TableCard>
    </AdminSection>
  );
};

export default MonitorTab;
