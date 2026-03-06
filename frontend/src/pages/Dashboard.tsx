import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ShipmentsTab from '../components/admin/ShipmentsTab';
import UsersTab from '../components/admin/UsersTab';
import ZonesTab from '../components/admin/ZonesTab';

type TabType = 'shipments' | 'users' | 'zones';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('shipments');

  return (
    <div className="bg-background-light dark:bg-background-dark font-display h-screen w-full flex flex-col pt-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pb-4 border-b border-gray-200 dark:border-white/10 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/scanner')}
            className="size-10 bg-white dark:bg-white/10 flex items-center justify-center rounded-full shadow-sm text-dark-text dark:text-white transition-colors hover:bg-gray-100 dark:hover:bg-white/20"
          >
            <span className="material-symbols-outlined">arrow_back</span>
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
          <button
            onClick={() => setActiveTab('shipments')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'shipments' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">inventory</span>
            Historial de Guías
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'users' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">group</span>
            Usuarios y Roles
          </button>
          <button
            onClick={() => setActiveTab('zones')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'zones' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">map</span>
            Gestión de Zonas
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 overflow-hidden flex flex-col min-h-0 bg-[#f8f9fa] dark:bg-transparent">
        {activeTab === 'shipments' && <ShipmentsTab />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'zones' && <ZonesTab />}
      </div>
    </div>
  );
};

export default Dashboard;
