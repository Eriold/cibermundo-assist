import { useEffect, useState } from 'react';
import { createUser, deleteUser, getUsers, updateUser } from '../../services/api';
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
  checkboxCardClassName,
  cn,
  fieldClassName,
} from './ui/AdminPrimitives';

interface UserRole {
  canReport: boolean;
  canScan: boolean;
  isAdmin: boolean;
}

interface User {
  createdAt: string;
  id: number;
  name: string;
  roles: UserRole;
  username: string;
}

interface UserFormState {
  canReport: boolean;
  canScan: boolean;
  isAdmin: boolean;
  name: string;
  pin: string;
  username: string;
}

const initialFormState: UserFormState = {
  canReport: false,
  canScan: true,
  isAdmin: false,
  name: '',
  pin: '',
  username: '',
};

const roleBadgeClassName =
  'inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em]';

const UsersTab = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<UserFormState>(initialFormState);
  const [submitting, setSubmitting] = useState(false);

  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      const response = await getUsers();
      if (response.ok) setUsers(response.users);
    } catch {
      setErrorMsg('No se pudieron cargar los usuarios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenModal = (user?: User) => {
    if (user) {
      setEditingId(user.id);
      setFormData({
        canReport: user.roles.canReport,
        canScan: user.roles.canScan,
        isAdmin: user.roles.isAdmin,
        name: user.name,
        pin: '',
        username: user.username,
      });
    } else {
      setEditingId(null);
      setFormData(initialFormState);
    }

    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    try {
      const payload = {
        name: formData.name,
        pin: formData.pin || undefined,
        roles: {
          canReport: formData.canReport,
          canScan: formData.canScan,
          isAdmin: formData.isAdmin,
        },
        username: formData.username,
      };

      if (editingId) {
        await updateUser(editingId, payload);
      } else {
        await createUser(payload);
      }

      setShowModal(false);
      fetchUsers();
    } catch (error: any) {
      setErrorMsg(error.response?.data?.error || 'Error procesando la solicitud.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!userToDelete) return;

    setDeleting(true);

    try {
      await deleteUser(userToDelete.id);
      setUserToDelete(null);
      fetchUsers();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al eliminar.');
    } finally {
      setDeleting(false);
    }
  };

  const updateFormField = <Key extends keyof UserFormState>(key: Key, value: UserFormState[Key]) => {
    setFormData((current) => ({ ...current, [key]: value }));
  };

  const adminUsers = users.filter((user) => user.roles.isAdmin).length;
  const scannerUsers = users.filter((user) => user.roles.canScan).length;
  const reportUsers = users.filter((user) => user.roles.canReport).length;

  return (
    <AdminSection>
      <AdminHeader
        actions={
          <>
            <ActionButton icon="sync" onClick={fetchUsers} variant="secondary">
              Actualizar
            </ActionButton>
            <ActionButton icon="person_add" onClick={() => handleOpenModal()} variant="primary">
              Nuevo Usuario
            </ActionButton>
          </>
        }
        description="Gestiona los accesos del personal operativo y administrativo. Los permisos siguen funcionando igual, pero ahora la lectura y edicion son mas claras."
        eyebrow="Accesos"
        title="Gestion de Usuarios"
      >
        <StatCard icon="group" label="Usuarios" value={users.length} />
        <StatCard icon="shield_person" label="Administradores" tone="primary" value={adminUsers} />
        <StatCard icon="qr_code_scanner" label="Escaner" tone="success" value={scannerUsers} />
        <StatCard icon="analytics" label="Reportes" tone="warning" value={reportUsers} />
      </AdminHeader>

      {errorMsg && !showModal ? <InlineAlert>{errorMsg}</InlineAlert> : null}

      <TableCard>
        <div className="flex flex-col gap-3 border-b border-gray-200/80 px-5 py-4 dark:border-white/10 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
              Accesos del equipo
            </p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-dark-text dark:text-white">
              Usuarios y permisos
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400">
            <span className="rounded-full bg-gray-100 px-3 py-1.5 dark:bg-white/5">
              {users.length} usuarios
            </span>
            <span className="rounded-full bg-primary/10 px-3 py-1.5 text-primary">
              {adminUsers} con administracion
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="min-w-[820px] w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-gray-50/95 shadow-sm backdrop-blur dark:bg-[#232218]/95">
              <tr className="border-b border-gray-200/80 dark:border-white/10">
                <th className="px-4 py-3 text-sm font-black text-gray-500 dark:text-gray-400">Usuario</th>
                <th className="px-4 py-3 text-sm font-black text-gray-500 dark:text-gray-400">ID ingreso</th>
                <th className="px-4 py-3 text-sm font-black text-gray-500 dark:text-gray-400">Permisos</th>
                <th className="px-4 py-3 text-right text-sm font-black text-gray-500 dark:text-gray-400">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {loading ? (
                <TableStatusRow
                  colSpan={4}
                  description="Estamos cargando el directorio de usuarios y sus permisos."
                  icon="progress_activity"
                  iconClassName="animate-spin"
                  title="Cargando usuarios..."
                />
              ) : users.length === 0 ? (
                <TableStatusRow
                  colSpan={4}
                  description="Crea el primer usuario para empezar a delegar acceso a scanner y reportes."
                  icon="group"
                  title="No hay usuarios registrados"
                />
              ) : (
                users.map((user) => (
                  <tr className="transition-colors hover:bg-gray-50 dark:hover:bg-white/5" key={user.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'flex size-11 items-center justify-center rounded-2xl',
                            user.roles.isAdmin
                              ? 'bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300'
                              : 'bg-primary/10 text-primary',
                          )}
                        >
                          <MaterialIcon className="text-[20px]" name={user.roles.isAdmin ? 'shield_person' : 'badge'} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-dark-text dark:text-white">{user.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">ID #{user.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-gray-100 px-3 py-1.5 font-mono text-sm font-bold text-gray-700 dark:bg-white/5 dark:text-gray-200">
                        {user.username}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {user.roles.isAdmin ? (
                          <span className={cn(roleBadgeClassName, 'bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300')}>
                            Administrador
                          </span>
                        ) : null}
                        {user.roles.canScan ? (
                          <span className={cn(roleBadgeClassName, 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300')}>
                            Escaner
                          </span>
                        ) : null}
                        {user.roles.canReport ? (
                          <span className={cn(roleBadgeClassName, 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300')}>
                            Reportes
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <ActionButton onClick={() => handleOpenModal(user)} variant="subtle">
                          Editar
                        </ActionButton>
                        <ActionButton
                          disabled={user.id === 1}
                          onClick={() => setUserToDelete(user)}
                          variant="danger"
                        >
                          Eliminar
                        </ActionButton>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </TableCard>

      {showModal ? (
        <Dialog width="md">
          <DialogHeader
            icon={editingId ? 'manage_accounts' : 'person_add'}
            onClose={handleCloseModal}
            subtitle="Configura identificacion y permisos sin alterar el contrato actual del backend."
            title={editingId ? 'Editar Usuario' : 'Nuevo Usuario'}
          />

          <form className="space-y-5 overflow-y-auto px-5 py-5 sm:px-6" id="user-form" onSubmit={handleSubmit}>
            {errorMsg ? <InlineAlert>{errorMsg}</InlineAlert> : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300" htmlFor="user-name">
                  Nombre completo
                </label>
                <input
                  autoComplete="off"
                  className={fieldClassName}
                  id="user-name"
                  name="name"
                  onChange={(event) => updateFormField('name', event.target.value)}
                  placeholder="Ej. Juan Perez"
                  required
                  type="text"
                  value={formData.name}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300" htmlFor="user-username">
                  ID operario
                </label>
                <input
                  autoComplete="off"
                  className={cn(fieldClassName, 'font-mono')}
                  id="user-username"
                  name="username"
                  onChange={(event) => updateFormField('username', event.target.value)}
                  placeholder="Ej. OP-123"
                  required
                  spellCheck={false}
                  type="text"
                  value={formData.username}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300" htmlFor="user-pin">
                  PIN de 4 digitos
                </label>
                <input
                  autoComplete="off"
                  className={cn(fieldClassName, 'text-center font-mono')}
                  id="user-pin"
                  inputMode="numeric"
                  maxLength={4}
                  minLength={4}
                  name="pin"
                  onChange={(event) => updateFormField('pin', event.target.value)}
                  pattern="\d{4}"
                  placeholder={editingId ? 'Dejar vacio para mantener' : '1234'}
                  required={!editingId}
                  spellCheck={false}
                  type="password"
                  value={formData.pin}
                />
              </div>
            </div>

            <div className="space-y-3 border-t border-gray-200/80 pt-5 dark:border-white/10">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                  Permisos
                </p>
                <h3 className="mt-1 text-lg font-black tracking-tight text-dark-text dark:text-white">
                  Que puede hacer este usuario
                </h3>
              </div>

              <label className={checkboxCardClassName} htmlFor="role-admin">
                <input
                  checked={formData.isAdmin}
                  className="mt-1 size-5 rounded border-gray-300 text-primary focus:ring-primary"
                  id="role-admin"
                  name="isAdmin"
                  onChange={(event) => updateFormField('isAdmin', event.target.checked)}
                  type="checkbox"
                />
                <div className="min-w-0">
                  <p className="text-sm font-black text-dark-text dark:text-white">Administrador</p>
                  <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
                    Acceso total al sistema, catalogos y gestion de usuarios.
                  </p>
                </div>
              </label>

              <label className={checkboxCardClassName} htmlFor="role-scan">
                <input
                  checked={formData.canScan}
                  className="mt-1 size-5 rounded border-gray-300 text-primary focus:ring-primary"
                  id="role-scan"
                  name="canScan"
                  onChange={(event) => updateFormField('canScan', event.target.checked)}
                  type="checkbox"
                />
                <div className="min-w-0">
                  <p className="text-sm font-black text-dark-text dark:text-white">Escaner de guias</p>
                  <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
                    Permite escanear, guardar y revisar pendientes en operacion.
                  </p>
                </div>
              </label>

              <label className={checkboxCardClassName} htmlFor="role-report">
                <input
                  checked={formData.canReport}
                  className="mt-1 size-5 rounded border-gray-300 text-primary focus:ring-primary"
                  id="role-report"
                  name="canReport"
                  onChange={(event) => updateFormField('canReport', event.target.checked)}
                  type="checkbox"
                />
                <div className="min-w-0">
                  <p className="text-sm font-black text-dark-text dark:text-white">Reportes</p>
                  <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
                    Da acceso al panel administrativo y al historial general de guias consolidadas.
                  </p>
                </div>
              </label>
            </div>
          </form>

          <DialogFooter>
            <ActionButton onClick={handleCloseModal} variant="secondary">
              Cancelar
            </ActionButton>
            <ActionButton disabled={submitting} form="user-form" type="submit" variant="primary">
              {submitting ? 'Guardando...' : editingId ? 'Guardar Cambios' : 'Crear Usuario'}
            </ActionButton>
          </DialogFooter>
        </Dialog>
      ) : null}

      {userToDelete ? (
        <ConfirmDialog
          confirmLabel="Eliminar Usuario"
          description={
            <p>
              Vas a eliminar a <strong>{userToDelete.name}</strong>. Esta accion no se puede deshacer.
            </p>
          }
          loading={deleting}
          onCancel={() => setUserToDelete(null)}
          onConfirm={handleDelete}
          title="Eliminar usuario"
        />
      ) : null}
    </AdminSection>
  );
};

export default UsersTab;
