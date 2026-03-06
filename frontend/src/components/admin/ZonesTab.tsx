import React, { useEffect, useState } from 'react';
import { getAllZones, createZone, updateZone, deleteZone } from '../../services/api';

interface Zone {
  id: number;
  name: string;
  active: number;
  created_at: string;
}

const ZonesTab: React.FC = () => {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);

  // Delete Modal State
  const [zoneToDelete, setZoneToDelete] = useState<Zone | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchZones = async () => {
    setLoading(true);
    try {
      const resp = await getAllZones();
      if (resp.ok) setZones(resp.zones);
    } catch (e) {
      setErrorMsg('No se pudieron cargar las zonas');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    } catch (err: any) {
        setErrorMsg(err.response?.data?.error || 'Error procesando la solicitud');
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
      } catch (err: any) {
          alert(err.response?.data?.error || "Error al eliminar la zona");
      } finally {
          setDeleting(false);
      }
  };

  const handleToggleStatus = async (id: number, currentStatus: number) => {
    try {
        await updateZone(id, { active: currentStatus === 1 ? false : true });
        fetchZones();
    } catch (err: any) {
        alert(err.response?.data?.error || "Error al actualizar la zona");
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
      <div className="flex justify-between items-center mb-4 shrink-0">
        <h2 className="text-xl font-bold text-dark-text dark:text-white">Gestión de Zonas</h2>
        <div className="flex gap-2">
            <button 
                onClick={fetchZones}
                className="flex items-center size-10 justify-center bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-dark-text dark:text-white rounded-xl shadow-sm transition-transform active:scale-95"
            >
                <span className="material-symbols-outlined text-[18px]">sync</span>
            </button>
            <button 
                onClick={() => handleOpenModal()}
                className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-black px-4 py-2 rounded-xl font-bold text-sm shadow-sm transition-transform active:scale-95"
            >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Nueva Zona
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
                <th className="p-4 py-5 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">Nombre de la Zona</th>
                <th className="p-4 py-5 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">Fecha de Creación</th>
                <th className="p-4 py-5 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">Estado</th>
                <th className="p-4 py-5 text-sm font-bold text-gray-500 dark:text-gray-400 capitalize whitespace-nowrap">Acciones</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {loading ? (
                    <tr>
                        <td colSpan={4} className="p-10 text-center text-gray-400">
                            <span className="material-symbols-outlined animate-spin text-4xl mb-2">progress_activity</span>
                            <p className="font-bold">Cargando zonas...</p>
                        </td>
                    </tr>
                ) : (
                    zones.map(z => (
                        <tr key={z.id} className={`transition-colors ${z.active === 1 ? 'hover:bg-gray-50/50 dark:hover:bg-black/20' : 'bg-gray-50 dark:bg-black/40 opacity-70'}`}>
                            <td className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0">
                                        <span className="material-symbols-outlined text-[20px]">map</span>
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
                                        onClick={() => setZoneToDelete(z)}
                                        className="size-8 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center transition-colors"
                                        title="Eliminar Zona"
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
                        <span className="material-symbols-outlined text-primary">{editingZone ? 'edit_location' : 'add_location_alt'}</span>
                        {editingZone ? 'Editar Zona' : 'Nueva Zona'}
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
                    
                    <form id="zoneForm" onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Nombre de la Zona</label>
                            <input 
                                required type="text"
                                value={newZoneName} onChange={e => setNewZoneName(e.target.value)}
                                className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#2c2b1f] text-dark-text dark:text-white px-4 py-3 outline-none focus:border-primary transition-colors"
                                placeholder="Ej. Zona Norte o Bodega 2"
                            />
                            <p className="text-xs text-gray-500 mt-2">Esta zona aparecerá inmediatamente en la vista de Login de los operarios para que puedan seleccionarla.</p>
                        </div>
                    </form>
                </div>
                
                <div className="p-4 border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/5 flex gap-3">
                    <button type="button" onClick={handleCloseModal} className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-600 dark:text-gray-300 bg-white dark:bg-black/20 hover:bg-gray-100 dark:hover:bg-black/40 transition-colors">
                        Cancelar
                    </button>
                    <button type="submit" form="zoneForm" disabled={submitting} className="flex-1 py-3 px-4 rounded-xl font-bold text-black bg-primary hover:bg-primary-dark transition-colors flex items-center justify-center gap-2">
                        {submitting ? <span className="material-symbols-outlined animate-spin text-lg">sync</span> : (editingZone ? 'Guardar Cambios' : 'Crear Zona')}
                    </button>
                </div>
            </div>
          </div>
      )}

      {/* Delete Confirmation Modal */}
      {zoneToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#1a1a12] rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col p-6 text-center animate-fade-in-down">
                <div className="size-16 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-outlined text-3xl">delete_forever</span>
                </div>
                <h3 className="text-xl font-bold dark:text-white mb-2">Eliminar Zona</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
                    ¿Estás seguro de que deseas eliminar permanentemente la zona <strong>{zoneToDelete.name}</strong>? Esta acción no se puede deshacer.
                </p>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setZoneToDelete(null)}
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

export default ZonesTab;
