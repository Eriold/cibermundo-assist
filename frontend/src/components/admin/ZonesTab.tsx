import { useEffect, useState } from 'react';
import { createZone, deleteZone, getAllZones, updateZone } from '../../services/api';
import {
  ActionButton,
  AdminHeader,
  AdminSection,
  ConfirmDialog,
  Dialog,
  DialogFooter,
  DialogHeader,
  InlineAlert,
  MaterialIcon,
  StatCard,
  TableCard,
  TableStatusRow,
  cn,
  fieldClassName,
} from './ui/AdminPrimitives';

interface Zone {
  active: number;
  created_at: string;
  id: number;
  name: string;
}

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const formatDate = (isoString: string) => {
  if (!isoString) return '-';

  const date = new Date(isoString);
  return Number.isNaN(date.getTime()) ? '-' : dateFormatter.format(date);
};

const ZonesTab = () => {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);

  const [zoneToDelete, setZoneToDelete] = useState<Zone | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchZones = async () => {
    setLoading(true);

    try {
      const resp = await getAllZones();
      if (resp.ok) setZones(resp.zones);
    } catch {
      setErrorMsg('No se pudieron cargar las zonas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchZones();
  }, []);

  const handleOpenModal = (zone?: Zone) => {
    if (zone) {
      setEditingZone(zone);
      setNewZoneName(zone.name);
    } else {
      setEditingZone(null);
      setNewZoneName('');
    }

    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingZone(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    try {
      if (editingZone) {
        await updateZone(editingZone.id, { name: newZoneName });
      } else {
        await createZone(newZoneName);
      }

      setShowModal(false);
      fetchZones();
    } catch (error: any) {
      setErrorMsg(error.response?.data?.error || 'Error procesando la solicitud.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!zoneToDelete) return;

    setDeleting(true);

    try {
      await deleteZone(zoneToDelete.id);
      setZoneToDelete(null);
      fetchZones();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al eliminar la zona.');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: number) => {
    try {
      await updateZone(id, { active: currentStatus !== 1 });
      fetchZones();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al actualizar la zona.');
    }
  };

  const activeZones = zones.filter((zone) => zone.active === 1).length;
  const inactiveZones = zones.length - activeZones;

  return (
    <AdminSection>
      <AdminHeader
        actions={
          <>
            <ActionButton icon="sync" onClick={fetchZones} variant="secondary">
              Actualizar
            </ActionButton>
            <ActionButton icon="add" onClick={() => handleOpenModal()} variant="primary">
              Nueva Zona
            </ActionButton>
          </>
        }
        description="Administra las zonas disponibles para la operacion. Los cambios se reflejan en la seleccion que usan los operarios al iniciar escaneo."
        eyebrow="Operacion"
        title="Gestion de Zonas"
      >
        <StatCard icon="map" label="Total" value={zones.length} />
        <StatCard icon="check_circle" label="Activas" tone="success" value={activeZones} />
        <StatCard icon="pause_circle" label="Inactivas" tone="warning" value={inactiveZones} />
      </AdminHeader>

      {errorMsg && !showModal ? <InlineAlert>{errorMsg}</InlineAlert> : null}

      <TableCard>
        <div className="flex flex-col gap-3 border-b border-gray-200/80 px-5 py-4 dark:border-white/10 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
              Catalogo operativo
            </p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-dark-text dark:text-white">
              Zonas registradas
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400">
            <span className="rounded-full bg-gray-100 px-3 py-1.5 dark:bg-white/5">
              {zones.length} registros
            </span>
            <span className="rounded-full bg-primary/10 px-3 py-1.5 text-primary">
              {activeZones} disponibles
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="min-w-[680px] w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-gray-50/95 shadow-sm backdrop-blur dark:bg-[#232218]/95">
              <tr className="border-b border-gray-200/80 dark:border-white/10">
                <th className="px-4 py-3 text-sm font-black text-gray-500 dark:text-gray-400">Zona</th>
                <th className="px-4 py-3 text-sm font-black text-gray-500 dark:text-gray-400">Creada</th>
                <th className="px-4 py-3 text-sm font-black text-gray-500 dark:text-gray-400">Estado</th>
                <th className="px-4 py-3 text-right text-sm font-black text-gray-500 dark:text-gray-400">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {loading ? (
                <TableStatusRow
                  colSpan={4}
                  description="Estamos trayendo la configuracion actual desde el servidor."
                  icon="progress_activity"
                  iconClassName="animate-spin"
                  title="Cargando zonas..."
                />
              ) : zones.length === 0 ? (
                <TableStatusRow
                  colSpan={4}
                  description="Crea la primera zona para que los operarios puedan seleccionarla al iniciar sesion."
                  icon="map"
                  title="No hay zonas registradas"
                />
              ) : (
                zones.map((zone) => {
                  const isActive = zone.active === 1;

                  return (
                    <tr
                      className={cn(
                        'transition-colors hover:bg-gray-50 dark:hover:bg-white/5',
                        !isActive && 'bg-gray-50/60 dark:bg-black/20',
                      )}
                      key={zone.id}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <MaterialIcon className="text-[20px]" name="map" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-dark-text dark:text-white">
                              {zone.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">ID #{zone.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-600 dark:text-gray-300">
                        {formatDate(zone.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em]',
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                              : 'bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400',
                          )}
                        >
                          <span
                            className={cn(
                              'size-2 rounded-full',
                              isActive ? 'bg-emerald-500' : 'bg-gray-400 dark:bg-gray-500',
                            )}
                          />
                          {isActive ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <ActionButton
                            onClick={() => handleToggleStatus(zone.id, zone.active)}
                            variant={isActive ? 'secondary' : 'success'}
                          >
                            {isActive ? 'Desactivar' : 'Activar'}
                          </ActionButton>
                          <ActionButton onClick={() => handleOpenModal(zone)} variant="subtle">
                            Editar
                          </ActionButton>
                          <ActionButton onClick={() => setZoneToDelete(zone)} variant="danger">
                            Eliminar
                          </ActionButton>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </TableCard>

      {showModal ? (
        <Dialog width="md">
          <DialogHeader
            icon={editingZone ? 'edit_location' : 'add_location_alt'}
            onClose={handleCloseModal}
            subtitle="La zona quedara disponible de inmediato en la seleccion operativa."
            title={editingZone ? 'Editar Zona' : 'Nueva Zona'}
          />

          <form className="space-y-5 px-5 py-5 sm:px-6" id="zone-form" onSubmit={handleSubmit}>
            {errorMsg ? <InlineAlert>{errorMsg}</InlineAlert> : null}

            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300" htmlFor="zone-name">
                Nombre de la zona
              </label>
              <input
                autoComplete="off"
                className={fieldClassName}
                id="zone-name"
                name="zoneName"
                onChange={(event) => setNewZoneName(event.target.value)}
                placeholder="Ej. Zona Norte o Bodega 2"
                required
                spellCheck={false}
                type="text"
                value={newZoneName}
              />
              <p className="text-sm leading-6 text-gray-500 dark:text-gray-400">
                Usa un nombre claro y reconocible para evitar errores en la seleccion de los operarios.
              </p>
            </div>
          </form>

          <DialogFooter>
            <ActionButton onClick={handleCloseModal} variant="secondary">
              Cancelar
            </ActionButton>
            <ActionButton disabled={submitting} form="zone-form" type="submit" variant="primary">
              {submitting ? 'Guardando...' : editingZone ? 'Guardar Cambios' : 'Crear Zona'}
            </ActionButton>
          </DialogFooter>
        </Dialog>
      ) : null}

      {zoneToDelete ? (
        <ConfirmDialog
          confirmLabel="Eliminar Zona"
          description={
            <p>
              Vas a eliminar <strong>{zoneToDelete.name}</strong>. Esta accion no se puede deshacer.
            </p>
          }
          loading={deleting}
          onCancel={() => setZoneToDelete(null)}
          onConfirm={handleDelete}
          title="Eliminar zona"
        />
      ) : null}
    </AdminSection>
  );
};

export default ZonesTab;
