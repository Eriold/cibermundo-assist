import React from 'react';
import { useNavigate, NavLink, Outlet, useLocation } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const getTabClass = (isActive: boolean, path: string) => {
    return `flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
      isActive || (location.pathname === '/dashboard' && path === 'monitor')
        ? 'border-primary text-primary' 
        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
    }`;
  };

  return (
    <div className="bg-background-light dark:bg-background-dark font-display min-h-screen w-full flex flex-col pt-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pb-4 border-b border-gray-200 dark:border-white/10 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/home')}
            className="size-10 bg-white dark:bg-white/10 flex items-center justify-center rounded-full shadow-sm text-dark-text dark:text-white transition-colors hover:bg-gray-100 dark:hover:bg-white/20"
          >
            <span className="material-symbols-outlined">home</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-dark-text dark:text-white tracking-tight">Panel Administrativo</h1>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wide">Cibermundo Assist</p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="px-6 pt-4 shrink-0 overflow-x-auto hide-scrollbar">
        <div className="flex gap-2 border-b border-gray-200 dark:border-white/5 pb-0">
          <NavLink to="/dashboard/monitor" className={({ isActive }) => getTabClass(isActive, 'monitor')}>
            <span className="material-symbols-outlined text-[18px]">visibility</span>
            Monitor
          </NavLink>
          <NavLink to="/dashboard/shipments" className={({ isActive }) => getTabClass(isActive, 'shipments')}>
            <span className="material-symbols-outlined text-[18px]">inventory</span>
            Historial de Guías
          </NavLink>
          <NavLink to="/dashboard/users" className={({ isActive }) => getTabClass(isActive, 'users')}>
            <span className="material-symbols-outlined text-[18px]">group</span>
            Usuarios y Roles
          </NavLink>
          <NavLink to="/dashboard/zones" className={({ isActive }) => getTabClass(isActive, 'zones')}>
            <span className="material-symbols-outlined text-[18px]">map</span>
            Gestión de Zonas
          </NavLink>
          <NavLink to="/dashboard/catalogs" className={({ isActive }) => getTabClass(isActive, 'catalogs')}>
            <span className="material-symbols-outlined text-[18px]">category</span>
            Catálogos y Estados
          </NavLink>
        </div>
      </div>

      {/* Main Content Area (Layout Body) */}
      <div className="flex-1 p-6 overflow-visible flex flex-col bg-[#f8f9fa] dark:bg-transparent">
         {/* Sub-componentes inyectados aquí */}
         <Outlet />
      </div>
    </div>
  );
};

export default Dashboard;
