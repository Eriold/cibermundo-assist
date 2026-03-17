import type React from 'react';
import { formatDate } from './utils';
import type { CatalogItem, Shipment, TrackingRow } from './types';

interface EditShipmentModalProps {
  editForm: Partial<Shipment>;
  editingShipment: Shipment | null;
  errorMsg: string;
  loadingTracking: boolean;
  managements: CatalogItem[];
  statuses: CatalogItem[];
  zones: CatalogItem[];
  submitting: boolean;
  trackingHistory: TrackingRow[];
  trackingLastUpdated: string | null;
  onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
}

const EditShipmentModal = ({
  editForm,
  editingShipment,
  errorMsg,
  loadingTracking,
  managements,
  statuses,
  zones,
  submitting,
  trackingHistory,
  trackingLastUpdated,
  onChange,
  onClose,
  onSubmit,
}: EditShipmentModalProps) => {
  if (!editingShipment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-[#1a1a12] rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col my-auto max-h-[90vh]">
        <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-white/5 shrink-0 rounded-t-2xl">
          <h3 className="text-2xl font-black dark:text-white flex items-center gap-2">
            <span className="text-primary font-mono bg-primary/10 px-3 py-1 rounded-lg">#{editingShipment.tracking_number}</span>
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors size-8 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-white/10">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {errorMsg && (
            <div className="bg-red-500/10 text-red-500 border border-red-500/20 p-3 rounded-lg text-sm font-bold mb-6">
              {errorMsg}
            </div>
          )}

          <form id="editForm" onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-4 border border-gray-200 dark:border-white/10 rounded-xl p-4 bg-gray-50 dark:bg-black/20">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ingresado Por / Fecha</label>
                <div className="text-sm font-bold text-dark-text dark:text-white mt-1">
                  <span className="material-symbols-outlined text-[14px] align-middle mr-1 text-gray-400">person</span>
                  {editingShipment.scanned_by} <br />
                  <span className="text-gray-500 font-normal">{formatDate(editingShipment.scanned_at)}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Valor ($)</label>
                <input
                  type="number"
                  name="amount_total"
                  value={editForm.amount_total || ''}
                  onChange={onChange}
                  className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#2c2b1f] text-dark-text dark:text-white px-3 py-2 outline-none focus:border-primary font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Estado Interno</label>
                <select
                  name="status_id"
                  value={editForm.status_id || ''}
                  onChange={onChange}
                  className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#2c2b1f] text-dark-text dark:text-white px-3 py-2 cursor-pointer outline-none focus:border-primary transition-colors font-bold"
                >
                  <option value="">-- Sin Definir --</option>
                  {statuses.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Gestion de Novedad</label>
                <select
                  name="management_id"
                  value={editForm.management_id || ''}
                  onChange={onChange}
                  className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#2c2b1f] text-dark-text dark:text-white px-3 py-2 cursor-pointer outline-none focus:border-primary transition-colors font-bold"
                >
                  <option value="">-- Sin Gestion --</option>
                  {managements.map((management) => (
                    <option key={management.id} value={management.id}>
                      {management.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Tamaño</label>
                <select
                  name="shipment_size"
                  value={editForm.shipment_size || ''}
                  onChange={onChange}
                  className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#2c2b1f] text-dark-text dark:text-white px-3 py-2 cursor-pointer outline-none focus:border-primary transition-colors font-bold"
                >
                  <option value="">-- Sin Tamaño --</option>
                  <option value="S">S</option>
                  <option value="M">M</option>
                  <option value="L">L</option>
                  <option value="XL">XL</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Zona</label>
                <select
                  name="zone_id"
                  value={editForm.zone_id || ''}
                  onChange={onChange}
                  className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#2c2b1f] text-dark-text dark:text-white px-3 py-2 cursor-pointer outline-none focus:border-primary transition-colors font-bold"
                >
                  <option value="">-- Sin Zona --</option>
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-4 border-t border-gray-200 dark:border-white/10 mt-2 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Cerrado Por</label>
                  <div className="text-sm font-bold text-dark-text dark:text-white mt-1 pt-1">
                    <span className="material-symbols-outlined text-[14px] align-middle mr-1 text-gray-400">check_circle</span>
                    {editingShipment.checkout_by_name || <span className="text-gray-400 italic">Sin asignar (siga el cierre manual)</span>}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Fecha de Cierre (Salida)</label>
                  <input
                    type="datetime-local"
                    name="checkout_date"
                    value={editForm.checkout_date ? editForm.checkout_date.substring(0, 16) : ''}
                    onChange={onChange}
                    className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#2c2b1f] text-dark-text dark:text-white px-3 py-2 outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-bold text-dark-text dark:text-white border-b border-gray-200 dark:border-white/10 pb-2">Informacion del Destinatario</h4>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Nombre del Cliente</label>
                <input
                  type="text"
                  name="recipient_name"
                  value={editForm.recipient_name || editForm.client_name || ''}
                  onChange={onChange}
                  className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#2c2b1f] text-dark-text dark:text-white px-4 py-3 outline-none focus:border-primary transition-colors"
                  placeholder="Ej. Juan Perez"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Telefono Movil</label>
                <input
                  type="tel"
                  name="recipient_phone"
                  value={editForm.recipient_phone || editForm.client_phone || ''}
                  onChange={onChange}
                  className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#2c2b1f] text-dark-text dark:text-white px-4 py-3 outline-none focus:border-primary transition-colors"
                  placeholder="Ej. 3001234567"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-bold text-dark-text dark:text-white border-b border-gray-200 dark:border-white/10 pb-2">Bitacora de Notas</h4>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Nota 1 / Observacion General</label>
                <textarea
                  name="obs_1"
                  rows={2}
                  value={editForm.obs_1 || ''}
                  onChange={onChange}
                  className="w-full resize-none rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#2c2b1f] text-dark-text dark:text-white px-4 py-2 outline-none focus:border-primary transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Nota 2 (Opcional)</label>
                  <textarea
                    name="obs_2"
                    rows={2}
                    value={editForm.obs_2 || ''}
                    onChange={onChange}
                    className="w-full resize-none rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#2c2b1f] text-dark-text dark:text-white px-4 py-2 outline-none focus:border-primary transition-colors text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Nota 3 (Opcional)</label>
                  <textarea
                    name="obs_3"
                    rows={2}
                    value={editForm.obs_3 || ''}
                    onChange={onChange}
                    className="w-full resize-none rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#2c2b1f] text-dark-text dark:text-white px-4 py-2 outline-none focus:border-primary transition-colors text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="md:col-span-2 mt-2">
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-white/10 pb-2 mb-3">
                <h4 className="font-bold text-dark-text dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-primary">route</span>
                  Flujo de la Guia
                </h4>
                {trackingLastUpdated && (
                  <span className="text-xs text-gray-400 font-bold">
                    Actualizado: {formatDate(trackingLastUpdated)}
                  </span>
                )}
              </div>

              {loadingTracking ? (
                <div className="flex items-center justify-center py-8">
                  <span className="material-symbols-outlined animate-spin text-2xl text-gray-400">progress_activity</span>
                </div>
              ) : trackingHistory.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <span className="material-symbols-outlined text-3xl mb-1 block opacity-50">info</span>
                  <p className="text-sm font-bold">Sin datos de flujo. Presione "Cargar Gestiones" para actualizar.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-gray-200 dark:border-white/10">
                  <table className="w-full text-left text-xs min-w-[700px]">
                    <thead className="bg-gray-50 dark:bg-[#2c2b1f]">
                      <tr>
                        <th className="px-3 py-2 font-bold text-gray-500">Ciudad</th>
                        <th className="px-3 py-2 font-bold text-gray-500">Estado</th>
                        <th className="px-3 py-2 font-bold text-gray-500">Fecha</th>
                        <th className="px-3 py-2 font-bold text-gray-500">Bodega</th>
                        <th className="px-3 py-2 font-bold text-gray-500">Motivo</th>
                        <th className="px-3 py-2 font-bold text-gray-500">Mensajero</th>
                        <th className="px-3 py-2 font-bold text-gray-500">Observacion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                      {trackingHistory.map((row, index) => {
                        const isGestion =
                          row.ciudad?.toUpperCase().includes('URRAO') &&
                          (row.descripcion_estado?.toUpperCase().includes('DEVOLUCION') ||
                            row.descripcion_estado?.toUpperCase().includes('DEVOLUCIÃ“N'));

                        return (
                          <tr key={index} className={isGestion ? 'bg-red-50 dark:bg-red-500/10' : ''}>
                            <td className="px-3 py-2 text-dark-text dark:text-white font-medium">
                              {row.has_location_icon ? <span className="material-symbols-outlined text-[12px] text-primary mr-1 align-middle">location_on</span> : null}
                              {row.ciudad}
                            </td>
                            <td className={`px-3 py-2 ${isGestion ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-600 dark:text-gray-300'}`}>
                              {row.descripcion_estado}
                            </td>
                            <td className="px-3 py-2 text-gray-600 dark:text-gray-300 whitespace-nowrap">{row.fecha_cambio_estado}</td>
                            <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{row.bodega}</td>
                            <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{row.motivo}</td>
                            <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{row.mensajero}</td>
                            <td className="px-3 py-2 text-gray-500 dark:text-gray-400 max-w-[200px] truncate" title={row.observacion}>
                              {row.observacion}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </form>
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/5 flex gap-3 shrink-0 rounded-b-2xl">
          <button type="button" onClick={onClose} className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-600 dark:text-gray-300 bg-white dark:border border-white/10 dark:bg-black/20 hover:bg-gray-100 dark:hover:bg-black/40 transition-colors">
            Ignorar Cambios
          </button>
          <button type="submit" form="editForm" disabled={submitting} className="flex-1 py-3 px-4 rounded-xl font-bold text-black bg-primary hover:bg-primary-dark transition-colors flex items-center justify-center gap-2">
            {submitting ? <span className="material-symbols-outlined animate-spin text-lg">sync</span> : 'Registrar y Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditShipmentModal;
