import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Home from './pages/Home';
import LocationSelection from './pages/LocationSelection';
import Scanner from './pages/Scanner';
import Dashboard from './pages/Dashboard';
import './App.css';

import ShipmentsTab from './components/admin/ShipmentsTab';
import UsersTab from './components/admin/UsersTab';
import ZonesTab from './components/admin/ZonesTab';
import CatalogTab from './components/admin/CatalogTab';
import MonitorTab from './components/admin/MonitorTab';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/home" element={<Home />} />
        <Route path="/location" element={<LocationSelection />} />
        <Route path="/scanner" element={<Scanner />} />

        {/* Dashboard Módulo (Layout + Rutas Anidadas) */}
        <Route path="/dashboard" element={<Dashboard />}>
           {/* Fallback de /dashboard redirige a la tabla principal */}
           <Route index element={<Navigate to="monitor" replace />} />
           <Route path="monitor" element={<MonitorTab />} />
           <Route path="shipments" element={<ShipmentsTab />} />
           <Route path="users" element={<UsersTab />} />
           <Route path="zones" element={<ZonesTab />} />
           <Route path="catalogs" element={<CatalogTab />} />
        </Route>

        {/* Fallback General */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
