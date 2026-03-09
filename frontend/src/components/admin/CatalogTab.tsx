import React, { useEffect, useState } from 'react';
import { 
  getStatuses, createStatus, updateStatus, deleteStatus,
  getManagements, createManagement, updateManagement, deleteManagement
} from '../../services/api';

interface CatalogItem {
  id: number;
  name: string;
  active: number;
  created_at: string;
}

const CatalogTab: React.FC = () => {
  const [activeCatalog, setActiveCatalog] = useState<'statuses'|'managements'>('statuses');
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);

  // Delete Modal State
  const [itemToDelete, setItemToDelete] = useState<CatalogItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      if (activeCatalog === 'statuses') {
        const resp = await getStatuses();
        setItems(resp || []);
      } else {
        const resp = await getManagements();
        setItems(resp || []);
      }
    } catch (e) {
      setErrorMsg('No se pudieron cargar los registros de ' + activeCatalog);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    try {
        if (activeCatalog === 'statuses') {
            if (editingItem) await updateStatus(editingItem.id, { name: newItemName });
            else await createStatus(newItemName);
        } else {
            if (editingItem) await updateManagement(editingItem.id, { name: newItemName });
            else await createManagement(newItemName);
        }
        setShowModal(false);
        fetchItems();
    } catch (err: any) {
        setErrorMsg(err.response?.data?.error || 'Error procesando la solicitud');
    } finally {
        setSubmitting(false);
    }
  };

  const handleDelete = async () => {
      if (!itemToDelete) return;
      setDeleting(true);
      try {
          if (activeCatalog === 'statuses') await deleteStatus(itemToDelete.id);
          else await deleteManagement(itemToDelete.id);
          setItemToDelete(null);
          fetchItems();
      } catch (err: any) {
          alert(err.response?.data?.error || "Error al eliminar");
      } finally {
          setDeleting(false);
      }
  };

  const handleToggleStatus = async (id: number, currentStatus: number) => {
    try {
        const newStatus = currentStatus === 1 ? false : true;
        if (activeCatalog === 'statuses') await updateStatus(id, { active: newStatus });
        else await updateManagement(id, { active: newStatus });
        fetchItems();
    } catch (err: any) {
        alert(err.response?.data?.error || "Error al actualizar");
    }
  };

  const formatDate = (isoString: string) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleString('es-CO', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 shrink-0 gap-4">
        <div>
            <h2 className="text-xl font-bold text-dark-text dark:text-white">Catálogos Auxiliares</h2>
            
            <div className="flex bg-gray-100 dark:bg-black/30 p-1 mt-2 rounded-xl w-max">
                <button 
                    onClick={() => setActiveCatalog('statuses')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${activeCatalog === 'statuses' ? 'bg-white dark:bg-[#2c2b1f] text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                    Estados Internos
                </button>
                <button 
                    onClick={() => setActiveCatalog('managements')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${activeCatalog === 'managements' ? 'bg-white dark:bg-[#2c2b1f] text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                    Gestiones (Novedades)
                </button>
            </div>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={fetchItems}
                className="flex items-center size-10 justify-center bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-dark-text dark:text-white rounded-xl shadow-sm transition-transform active:scale-95"
            >
                <span className="material-symbols-outlined text-[18px]">sync</span>
            </button>
            <button 
                onClick={() => handleOpenModal()}
                className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-black px-4 py-2 rounded-xl font-bold text-sm shadow-sm transition-transform active:scale-95"
            >
                <span className="material-symbols-outlined text-[18px]">add</span>
                {activeCatalog === 'statuses' ? 'Nuevo Estado' : 'Nueva Gestión'}
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
                <th className="p-4 py-5 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">Nombre ({activeCatalog === 'statuses' ? 'Estado' : 'Gestión'})</th>
                <th className="p-4 py-5 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">Fecha de Creación</th>
                <th className="p-4 py-5 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">Activo / Visible</th>
                <th className="p-4 py-5 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">Acciones</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {loading ? (
                    <tr>
                        <td colSpan={4} className="p-10 text-center text-gray-400">
                            <span className="material-symbols-outlined animate-spin text-4xl mb-2">progress_activity</span>
                            <p className="font-bold">Cargando...</p>
                        </td>
                    </tr>
                ) : (
                    items.map(z => (
                        <tr key={z.id} className={`transition-colors ${z.active === 1 ? 'hover:bg-gray-50/50 dark:hover:bg-black/20' : 'bg-gray-50 dark:bg-black/40 opacity-70'}`}>
                            <td className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 rounded-full bg-primary-light/20 text-primary flex items-center justify-center shrink-0">
                                        <span className="material-symbols-outlined text-[20px]">{activeCatalog === 'statuses' ? 'checklist' : 'headset_mic'}</span>
                                    </div>
                                    <div>
                                        <p className="font-bold text-dark-text dark:text-white text-base">{z.name}</p>
                                    </div>
                                </div>
                            </td>
                            <td className="p-4 text-sm font-medium text-gray-600 dark:text-gray-300">
                                {formatDate(z.created_at)}
                            </td>
                            <td className="p-4">
                                {z.active === 1 ? (
                                    <span className="px-3 py-1 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1 w-max">
                                        <span className="size-2 rounded-full bg-green-500 shrink-0"></span> Activa
                                    </span>
                                ) : (
                                    <span className="px-3 py-1 bg-gray-200 dark:bg-gray-500/20 text-gray-600 dark:text-gray-400 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1 w-max">
                                        <span className="size-2 rounded-full bg-gray-500 shrink-0"></span> Inactiva
                                    </span>
                                )}
                            </td>
                            <td className="p-4 text-sm font-medium">
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleToggleStatus(z.id, z.active)} 
                                        className={`px-4 py-2 rounded-lg font-bold text-xs transition-colors ${z.active === 1 ? 'bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-500/10 dark:hover:bg-red-500/20 dark:text-red-400' : 'bg-green-50 hover:bg-green-100 text-green-600 dark:bg-green-500/10 dark:hover:bg-green-500/20 dark:text-green-400'}`}
                                        title={z.active === 1 ? 'Desactivar' : 'Activar'}
                                    >
                                        {z.active === 1 ? 'Desactivar' : 'Activar'}
                                    </button>
                                    
                                    <button
                                        onClick={() => handleOpenModal(z)}
                                        className="size-8 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 flex items-center justify-center transition-colors"
                                        title="Editar nombre"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">edit</span>
                                    </button>
                                    <button
                                        onClick={() => setItemToDelete(z)}
                                        className="size-8 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center transition-colors"
                                        title={`Eliminar ${activeCatalog === 'statuses' ? 'Estado' : 'Gestión'}`}
                                    >
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
            <div className="bg-white dark:bg-[#1a1a12] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
                <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
                    <h3 className="text-xl font-bold dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">{editingItem ? 'edit_square' : 'add_circle'}</span>
                        {editingItem ? 'Editar Nombre' : 'Nuevo Registro'}
                    </h3>
                    <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                
                <div className="p-6">
                    {errorMsg && (
                    <div className="bg-red-500/10 text-red-500 border border-red-500/20 p-3 rounded-lg text-sm font-bold mb-4">
                        {errorMsg}
                    </div>
                    )}
                    
                    <form id="catalogForm" onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Nombre</label>
                            <input 
                                required type="text"
                                value={newItemName} onChange={e => setNewItemName(e.target.value)}
                                className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#2c2b1f] text-dark-text dark:text-white px-4 py-3 outline-none focus:border-primary transition-colors"
                                placeholder={activeCatalog === 'statuses' ? 'Ej. Cerrada o Abierta' : 'Ej. Entregado, Devolución...'}
                            />
                            <p className="text-xs text-gray-500 mt-2">Aparecerá en los desplegables de la Modal de Gestión de Guías.</p>
                        </div>
                    </form>
                </div>
                
                <div className="p-4 border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/5 flex gap-3">
                    <button type="button" onClick={handleCloseModal} className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-600 dark:text-gray-300 bg-white dark:bg-black/20 hover:bg-gray-100 dark:hover:bg-black/40 transition-colors">
                        Cancelar
                    </button>
                    <button type="submit" form="catalogForm" disabled={submitting} className="flex-1 py-3 px-4 rounded-xl font-bold text-black bg-primary hover:bg-primary-dark transition-colors flex items-center justify-center gap-2">
                        {submitting ? <span className="material-symbols-outlined animate-spin text-lg">sync</span> : (editingItem ? 'Guardar Cambios' : 'Crear')}
                    </button>
                </div>
            </div>
          </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#1a1a12] rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col p-6 text-center animate-fade-in-down">
                <div className="size-16 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-outlined text-3xl">delete_forever</span>
                </div>
                <h3 className="text-xl font-bold dark:text-white mb-2">Eliminar {activeCatalog === 'statuses' ? 'Estado' : 'Gestión'}</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
                    ¿Estás seguro de que deseas eliminar permanentemente <strong>{itemToDelete.name}</strong>? Esta acción no se puede deshacer.
                </p>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setItemToDelete(null)}
                        className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                        disabled={deleting}
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleDelete}
                        className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                        disabled={deleting}
                    >
                        {deleting ? <span className="material-symbols-outlined animate-spin">sync</span> : 'Eliminar'}
                    </button>
                </div>
            </div>
          </div>
      )}

    </div>
  );
};

export default CatalogTab;
