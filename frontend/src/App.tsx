import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import LocationSelection from './pages/LocationSelection';
import Scanner from './pages/Scanner';
import Dashboard from './pages/Dashboard';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/location" element={<LocationSelection />} />
        <Route path="/scanner" element={<Scanner />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
