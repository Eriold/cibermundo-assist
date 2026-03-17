import { useEffect, useState } from 'react';
import {
  createManagement,
  createStatus,
  deleteManagement,
  deleteStatus,
  getManagements,
  getStatuses,
  updateManagement,
  updateStatus,
} from '../../services/api';
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
  SegmentedControl,
  StatCard,
  SurfaceCard,
  TableCard,
  TableStatusRow,
  cn,
  fieldClassName,
} from './ui/AdminPrimitives';

interface CatalogItem {
  active: number;
  created_at: string;
  id: number;
  name: string;
}

type CatalogKind = 'managements' | 'statuses';

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const catalogMeta: Record<
  CatalogKind,
  {
    createLabel: string;
    description: string;
    icon: string;
    nameLabel: string;
    placeholder: string;
    title: string;
  }
> = {
  statuses: {
    createLabel: 'Nuevo Estado',
    description: 'Estados internos usados en el flujo administrativo y en la gestion de guias.',
    icon: 'checklist',
    nameLabel: 'Estado',
    placeholder: 'Ej. Abierta o Cerrada',
    title: 'Estados internos',
  },
  managements: {
    createLabel: 'Nueva Gestion',
    description: 'Gestiones o novedades visibles dentro de la modal de administracion de guias.',
    icon: 'support_agent',
    nameLabel: 'Gestion',
    placeholder: 'Ej. Entregado, Devolucion...',
    title: 'Gestiones',
  },
};

const formatDate = (isoString: string) => {
  if (!isoString) return '-';

  const date = new Date(isoString);
  return Number.isNaN(date.getTime()) ? '-' : dateFormatter.format(date);
};

const CatalogTab = () => {
  const [activeCatalog, setActiveCatalog] = useState<CatalogKind>('statuses');
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);

  const [itemToDelete, setItemToDelete] = useState<CatalogItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const activeMeta = catalogMeta[activeCatalog];

  const fetchItems = async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      if (activeCatalog === 'statuses') {
        const response = await getStatuses();
        setItems(response || []);
      } else {
        const response = await getManagements();
        setItems(response || []);
      }
    } catch {
      setErrorMsg(`No se pudieron cargar los registros de ${activeMeta.title.toLowerCase()}.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [activeCatalog]);

  const handleOpenModal = (item?: CatalogItem) => {
    if (item) {
      setEditingItem(item);
      setNewItemName(item.name);
    } else {
      setEditingItem(null);
      setNewItemName('');
    }

    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingItem(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    try {
      if (activeCatalog === 'statuses') {
        if (editingItem) {
          await updateStatus(editingItem.id, { name: newItemName });
        } else {
          await createStatus(newItemName);
        }
      } else if (editingItem) {
        await updateManagement(editingItem.id, { name: newItemName });
      } else {
        await createManagement(newItemName);
      }

      setShowModal(false);
      fetchItems();
    } catch (error: any) {
      setErrorMsg(error.response?.data?.error || 'Error procesando la solicitud.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    setDeleting(true);

    try {
      if (activeCatalog === 'statuses') {
        await deleteStatus(itemToDelete.id);
      } else {
        await deleteManagement(itemToDelete.id);
      }

      setItemToDelete(null);
      fetchItems();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al eliminar.');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: number) => {
    try {
      if (activeCatalog === 'statuses') {
        await updateStatus(id, { active: currentStatus !== 1 });
      } else {
        await updateManagement(id, { active: currentStatus !== 1 });
      }

      fetchItems();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al actualizar.');
    }
  };

  const activeItems = items.filter((item) => item.active === 1).length;
  const inactiveItems = items.length - activeItems;

  return (
    <AdminSection>
      <AdminHeader
        actions={
          <>
            <ActionButton icon="sync" onClick={fetchItems} variant="secondary">
              Actualizar
            </ActionButton>
            <ActionButton icon="add" onClick={() => handleOpenModal()} variant="primary">
              {activeMeta.createLabel}
            </ActionButton>
          </>
        }
        description="Mantiene actualizados los catalogos auxiliares que usa el equipo para clasificar el estado interno y las novedades de las guias."
        eyebrow="Configuracion"
        title="Catalogos Auxiliares"
      >
        <StatCard icon="category" label="Catalogo" tone="primary" value={activeMeta.title} />
        <StatCard icon={activeMeta.icon} label="Registros" value={items.length} />
        <StatCard icon="check_circle" label="Activos" tone="success" value={activeItems} />
        <StatCard icon="pause_circle" label="Inactivos" tone="warning" value={inactiveItems} />
      </AdminHeader>

      <SurfaceCard className="px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
              Vista actual
            </p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-dark-text dark:text-white">
              {activeMeta.title}
            </h2>
            <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">
              {activeMeta.description}
            </p>
          </div>
          <div className="w-full max-w-2xl">
            <SegmentedControl
              ariaLabel="Seleccionar catalogo auxiliar"
              onChange={(value) => setActiveCatalog(value as CatalogKind)}
              options={[
                { label: 'Estados Internos', value: 'statuses' },
                { label: 'Gestiones', value: 'managements' },
              ]}
              value={activeCatalog}
            />
          </div>
        </div>
      </SurfaceCard>

      {errorMsg && !showModal ? <InlineAlert>{errorMsg}</InlineAlert> : null}

      <TableCard>
        <div className="flex flex-col gap-3 border-b border-gray-200/80 px-5 py-4 dark:border-white/10 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
              Base editable
            </p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-dark-text dark:text-white">
              {activeMeta.title}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400">
            <span className="rounded-full bg-gray-100 px-3 py-1.5 dark:bg-white/5">
              {items.length} registros
            </span>
            <span className="rounded-full bg-primary/10 px-3 py-1.5 text-primary">
              {activeItems} visibles
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="min-w-[680px] w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-gray-50/95 shadow-sm backdrop-blur dark:bg-[#232218]/95">
              <tr className="border-b border-gray-200/80 dark:border-white/10">
                <th className="px-4 py-3 text-sm font-black text-gray-500 dark:text-gray-400">
                  Nombre ({activeMeta.nameLabel})
                </th>
                <th className="px-4 py-3 text-sm font-black text-gray-500 dark:text-gray-400">Creado</th>
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
                  description="Estamos consultando la configuracion disponible para este catalogo."
                  icon="progress_activity"
                  iconClassName="animate-spin"
                  title="Cargando registros..."
                />
              ) : items.length === 0 ? (
                <TableStatusRow
                  colSpan={4}
                  description={`Crea el primer registro para ${activeMeta.title.toLowerCase()} y manten el flujo administrativo actualizado.`}
                  icon={activeMeta.icon}
                  title="No hay elementos registrados"
                />
              ) : (
                items.map((item) => {
                  const isActive = item.active === 1;

                  return (
                    <tr
                      className={cn(
                        'transition-colors hover:bg-gray-50 dark:hover:bg-white/5',
                        !isActive && 'bg-gray-50/60 dark:bg-black/20',
                      )}
                      key={item.id}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <MaterialIcon className="text-[20px]" name={activeMeta.icon} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-dark-text dark:text-white">
                              {item.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">ID #{item.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-600 dark:text-gray-300">
                        {formatDate(item.created_at)}
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
                            onClick={() => handleToggleStatus(item.id, item.active)}
                            variant={isActive ? 'secondary' : 'success'}
                          >
                            {isActive ? 'Desactivar' : 'Activar'}
                          </ActionButton>
                          <ActionButton onClick={() => handleOpenModal(item)} variant="subtle">
                            Editar
                          </ActionButton>
                          <ActionButton onClick={() => setItemToDelete(item)} variant="danger">
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
            icon={editingItem ? 'edit_square' : 'add_circle'}
            onClose={handleCloseModal}
            subtitle="Este cambio se reflejara en la modal de gestion de guias."
            title={editingItem ? `Editar ${activeMeta.nameLabel}` : `Nuevo ${activeMeta.nameLabel}`}
          />

          <form className="space-y-5 px-5 py-5 sm:px-6" id="catalog-form" onSubmit={handleSubmit}>
            {errorMsg ? <InlineAlert>{errorMsg}</InlineAlert> : null}

            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300" htmlFor="catalog-name">
                Nombre
              </label>
              <input
                autoComplete="off"
                className={fieldClassName}
                id="catalog-name"
                name="catalogName"
                onChange={(event) => setNewItemName(event.target.value)}
                placeholder={activeMeta.placeholder}
                required
                spellCheck={false}
                type="text"
                value={newItemName}
              />
              <p className="text-sm leading-6 text-gray-500 dark:text-gray-400">
                Usa un nombre corto y entendible para que el equipo lo identifique rapido.
              </p>
            </div>
          </form>

          <DialogFooter>
            <ActionButton onClick={handleCloseModal} variant="secondary">
              Cancelar
            </ActionButton>
            <ActionButton disabled={submitting} form="catalog-form" type="submit" variant="primary">
              {submitting ? 'Guardando...' : editingItem ? 'Guardar Cambios' : 'Crear Registro'}
            </ActionButton>
          </DialogFooter>
        </Dialog>
      ) : null}

      {itemToDelete ? (
        <ConfirmDialog
          confirmLabel={`Eliminar ${activeMeta.nameLabel}`}
          description={
            <p>
              Vas a eliminar <strong>{itemToDelete.name}</strong>. Esta accion no se puede deshacer.
            </p>
          }
          loading={deleting}
          onCancel={() => setItemToDelete(null)}
          onConfirm={handleDelete}
          title={`Eliminar ${activeMeta.nameLabel.toLowerCase()}`}
        />
      ) : null}
    </AdminSection>
  );
};

export default CatalogTab;
