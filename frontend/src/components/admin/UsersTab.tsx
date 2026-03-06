import React, { useEffect, useState } from 'react';
import { getUsers, createUser, updateUser, deleteUser } from '../../services/api';

interface UserRole {
  isAdmin: boolean;
  canScan: boolean;
  canReport: boolean;
}

interface User {
  id: number;
  name: string;
  username: string;
  roles: UserRole;
  createdAt: string;
}

const UsersTab: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    pin: '',
    isAdmin: false,
    canScan: false,
    canReport: false
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const resp = await getUsers();
      if (resp.ok) setUsers(resp.users);
    } catch (e) {
      setErrorMsg('No se pudieron cargar los usuarios');
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
            name: user.name,
            username: user.username,
            pin: '', // Oculto al editar, solo se rellena si quiere cambiarlo
            isAdmin: user.roles.isAdmin,
            canScan: user.roles.canScan,
            canReport: user.roles.canReport
        });
    } else {
        setEditingId(null);
        setFormData({ name: '', username: '', pin: '', isAdmin: false, canScan: true, canReport: false });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    try {
        const payload = {
            name: formData.name,
            username: formData.username,
            pin: formData.pin || undefined,
            roles: {
                isAdmin: formData.isAdmin,
                canScan: formData.canScan,
                canReport: formData.canReport
            }
        };

        if (editingId) {
            await updateUser(editingId, payload);
        } else {
            await createUser(payload);
        }

        setShowModal(false);
        fetchUsers();
    } catch (err: any) {
        setErrorMsg(err.response?.data?.error || 'Error procesando la solicitud');
    } finally {
        setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("¿Seguro que deseas eliminar este usuario?")) return;
    try {
        await deleteUser(id);
        fetchUsers();
    } catch (err: any) {
        alert(err.response?.data?.error || "Error al eliminar");
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
      <div className="flex justify-between items-center mb-4 shrink-0">
        <h2 className="text-xl font-bold text-dark-text dark:text-white">Gestión de Usuarios</h2>
        <div className="flex gap-2">
            <button 
                onClick={fetchUsers}
                className="flex items-center size-10 justify-center bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-dark-text dark:text-white rounded-xl shadow-sm transition-transform active:scale-95"
            >
                <span className="material-symbols-outlined text-[18px]">sync</span>
            </button>
            <button 
                onClick={() => handleOpenModal()}
                className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-black px-4 py-2 rounded-xl font-bold text-sm shadow-sm transition-transform active:scale-95"
            >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Nuevo Usuario
            </button>
        </div>
      </div>

      {errorMsg && !showModal && (
        <div className="bg-red-500 text-white p-4 rounded-xl shadow-md mb-4 flex items-center gap-2 shrink-0">
          <span className="material-symbols-outlined">error</span>
          <p className="font-bold text-sm">{errorMsg}</p>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 bg-white dark:bg-[#181811] rounded-3xl shadow-sm border border-gray-100 dark:border-white/10 overflow-hidden flex flex-col min-h-0">
        <div className="overflow-x-auto overflow-y-auto flex-1 h-full">
            <table className="w-full text-left border-collapse min-w-[800px] h-max">
            <thead className="sticky top-0 bg-gray-50 dark:bg-[#2c2b1f] border-b border-gray-200 dark:border-white/10 z-10 shadow-sm">
                <tr>
                <th className="p-4 py-5 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">Usuario</th>
                <th className="p-4 py-5 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">ID Ingreso</th>
                <th className="p-4 py-5 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">Roles</th>
                <th className="p-4 py-5 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">Acciones</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {loading ? (
                    <tr>
                        <td colSpan={4} className="p-10 text-center text-gray-400">
                            <span className="material-symbols-outlined animate-spin text-4xl mb-2">progress_activity</span>
                            <p className="font-bold">Cargando usuarios...</p>
                        </td>
                    </tr>
                ) : (
                    users.map(u => (
                        <tr key={u.id} className="hover:bg-gray-50/50 dark:hover:bg-black/20 transition-colors">
                            <td className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className={`size-10 rounded-full flex items-center justify-center shrink-0 ${u.roles.isAdmin ? 'bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400' : 'bg-primary-light/20 text-primary'}`}>
                                        <span className="material-symbols-outlined text-[20px]">{u.roles.isAdmin ? 'shield_person' : 'badge'}</span>
                                    </div>
                                    <div>
                                        <p className="font-bold text-dark-text dark:text-white text-base">{u.name}</p>
                                    </div>
                                </div>
                            </td>
                            <td className="p-4 text-sm font-bold font-mono text-gray-600 dark:text-gray-300">
                                {u.username}
                            </td>
                            <td className="p-4 flex gap-1 flex-wrap">
                                {u.roles.isAdmin && <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded text-xs font-bold uppercase tracking-wider">Admin</span>}
                                {u.roles.canScan && <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded text-xs font-bold uppercase tracking-wider">Escáner</span>}
                                {u.roles.canReport && <span className="px-2 py-0.5 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 rounded text-xs font-bold uppercase tracking-wider">Reportes</span>}
                            </td>
                            <td className="p-4 text-sm font-medium">
                                <div className="flex gap-2">
                                    <button onClick={() => handleOpenModal(u)} className="p-2 text-gray-500 hover:text-primary transition-colors bg-gray-100 hover:bg-white dark:bg-white/5 dark:hover:bg-white/10 rounded-lg">
                                        <span className="material-symbols-outlined text-[18px]">edit</span>
                                    </button>
                                    <button onClick={() => handleDelete(u.id)} disabled={u.id === 1} className="p-2 text-gray-500 hover:text-red-500 transition-colors bg-gray-100 hover:bg-white dark:bg-white/5 dark:hover:bg-white/10 rounded-lg disabled:opacity-30 disabled:hover:text-gray-500">
                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
            </table>
        </div>
      </div>

      {/* Editor Modal */}
      {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#1a1a12] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
                    <h3 className="text-xl font-bold dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">{editingId ? 'manage_accounts' : 'person_add'}</span>
                        {editingId ? 'Editar Usuario' : 'Nuevo Usuario'}
                    </h3>
                    <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto">
                    {errorMsg && (
                    <div className="bg-red-500/10 text-red-500 border border-red-500/20 p-3 rounded-lg text-sm font-bold mb-4">
                        {errorMsg}
                    </div>
                    )}
                    
                    <form id="userForm" onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Nombre Completo</label>
                            <input 
                                required type="text"
                                value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                                className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#2c2b1f] text-dark-text dark:text-white px-4 py-3 outline-none focus:border-primary transition-colors"
                                placeholder="Ej. Juan Pérez"
                            />
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">ID Operario</label>
                                <input 
                                    required type="text"
                                    value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})}
                                    className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#2c2b1f] text-dark-text dark:text-white px-4 py-3 outline-none focus:border-primary transition-colors font-mono"
                                    placeholder="Ej. OP-123"
                                />
                            </div>
                            <div className="w-32">
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">PIN (4 dig)</label>
                                <input 
                                    required={!editingId} type="password" maxLength={4} minLength={4} pattern="\d{4}"
                                    value={formData.pin} onChange={e => setFormData({...formData, pin: e.target.value})}
                                    className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#2c2b1f] text-dark-text dark:text-white px-4 py-3 outline-none focus:border-primary transition-colors text-center font-mono placeholder-gray-400"
                                    placeholder={editingId ? '****' : '1234'}
                                />
                            </div>
                        </div>

                        <div className="pt-4 mt-4 border-t border-gray-100 dark:border-white/5 space-y-3">
                            <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3">Permisos</h4>
                            
                            <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-colors group">
                                <input type="checkbox" checked={formData.isAdmin} onChange={e => setFormData({...formData, isAdmin: e.target.checked})} className="size-5 rounded border-gray-300 text-primary focus:ring-primary accent-primary" />
                                <div className="flex flex-col">
                                    <span className="font-bold text-dark-text dark:text-white">Administrador</span>
                                    <span className="text-xs text-gray-500">Acceso total al sistema y usuarios.</span>
                                </div>
                            </label>

                            <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-colors group">
                                <input type="checkbox" checked={formData.canScan} onChange={e => setFormData({...formData, canScan: e.target.checked})} className="size-5 rounded border-gray-300 text-primary focus:ring-primary accent-primary" />
                                <div className="flex flex-col">
                                    <span className="font-bold text-dark-text dark:text-white">Escáner de Guías</span>
                                    <span className="text-xs text-gray-500">Puedes escanear, guardar y ver pendientes.</span>
                                </div>
                            </label>

                            <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-colors group">
                                <input type="checkbox" checked={formData.canReport} onChange={e => setFormData({...formData, canReport: e.target.checked})} className="size-5 rounded border-gray-300 text-primary focus:ring-primary accent-primary" />
                                <div className="flex flex-col">
                                    <span className="font-bold text-dark-text dark:text-white">Reportes</span>
                                    <span className="text-xs text-gray-500">Acceso al Dashboard e historial general de guías consolidadas.</span>
                                </div>
                            </label>
                        </div>
                    </form>
                </div>
                
                <div className="p-4 border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/5 flex gap-3">
                    <button type="button" onClick={handleCloseModal} className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-600 dark:text-gray-300 bg-white dark:bg-black/20 hover:bg-gray-100 dark:hover:bg-black/40 transition-colors">
                        Cancelar
                    </button>
                    <button type="submit" form="userForm" disabled={submitting} className="flex-1 py-3 px-4 rounded-xl font-bold text-black bg-primary hover:bg-primary-dark transition-colors flex items-center justify-center gap-2">
                        {submitting ? <span className="material-symbols-outlined animate-spin text-lg">sync</span> : 'Guardar'}
                    </button>
                </div>
            </div>
          </div>
      )}

    </div>
  );
};

export default UsersTab;
