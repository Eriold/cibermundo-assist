import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSession } from '../services/auth';
import type { UserSession } from '../services/auth';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserSession | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      navigate('/');
      return;
    }
    setUser(session);
  }, [navigate]);

  return (
    <div className="bg-background-light dark:bg-background-dark text-[#181811] dark:text-white min-h-screen flex flex-col transition-colors duration-200 font-display">
      {/* App Bar */}
      <header className="px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/20 text-primary p-2.5 rounded-2xl shadow-sm">
            <span className="material-symbols-outlined text-[24px]">box</span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight leading-none text-dark-text dark:text-white">Cibermundo</h1>
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Logística Interna</span>
          </div>
        </div>
        
        <button 
            onClick={() => {
                localStorage.removeItem('cibermundo_session');
                localStorage.removeItem('cibermundo_active_zone');
                navigate('/');
            }}
            className="flex items-center justify-center p-2.5 rounded-full hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-colors"
        >
            <span className="material-symbols-outlined text-[24px]">logout</span>
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col px-6 pt-4 pb-8 max-w-md mx-auto w-full">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-[32px] font-bold leading-[1.1] mb-2 tracking-tight text-dark-text dark:text-white">
            Hola, {user?.name.split(' ')[0] || '...'}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-base font-medium">
            ¿Qué deseas hacer hoy?
          </p>
        </div>

        {/* Access Grid */}
        <div className="grid grid-cols-1 gap-4">
            
            {/* Operator Flow: Scan */}
            {(user?.roles?.canScan || user?.roles?.isAdmin) && (
                <button 
                    onClick={() => navigate('/location')}
                    className="group relative flex flex-col gap-3 bg-white dark:bg-surface-dark p-6 rounded-[2rem] shadow-sm hover:shadow-md active:scale-[0.98] transition-all duration-200 border border-transparent hover:border-primary cursor-pointer text-left overflow-hidden overflow-hidden"
                >
                    <div className="absolute -right-4 -top-4 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/20 transition-colors"></div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center justify-center size-14 rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-black transition-colors">
                            <span className="material-symbols-outlined text-[28px]">qr_code_scanner</span>
                        </div>
                        <span className="material-symbols-outlined text-gray-300 dark:text-gray-600 group-hover:text-primary transition-colors">arrow_forward</span>
                    </div>
                    <div className="mt-2 relative z-10">
                        <h3 className="text-xl font-bold text-dark-text dark:text-white mb-1">Escanear Guías</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed max-w-[85%]">Ingresa al centro de operación para rutear y leer etiquetas en bodega.</p>
                    </div>
                </button>
            )}

            {/* Admin Flow: Dashboard */}
            {(user?.roles?.isAdmin || user?.roles?.canReport) && (
                <button 
                    onClick={() => navigate('/dashboard')}
                    className="group relative flex flex-col gap-3 bg-white dark:bg-surface-dark p-6 rounded-[2rem] shadow-sm hover:shadow-md active:scale-[0.98] transition-all duration-200 border border-transparent hover:border-blue-500 cursor-pointer text-left overflow-hidden"
                >
                    <div className="absolute -right-4 -top-4 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-colors"></div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center justify-center size-14 rounded-2xl bg-blue-500/10 text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                            <span className="material-symbols-outlined text-[28px]">analytics</span>
                        </div>
                        <span className="material-symbols-outlined text-gray-300 dark:text-gray-600 group-hover:text-blue-500 transition-colors">arrow_forward</span>
                    </div>
                    <div className="mt-2 relative z-10">
                        <h3 className="text-xl font-bold text-dark-text dark:text-white mb-1">Panel de Control</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed max-w-[85%]">Administra usuarios, zonas, reportes y visualiza el historial de todos los escaneos.</p>
                    </div>
                </button>
            )}

        </div>
      </main>

    </div>
  );
};

export default Home;
