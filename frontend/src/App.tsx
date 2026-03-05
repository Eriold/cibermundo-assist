import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import LocationSelection from './pages/LocationSelection';
import Scanner from './pages/Scanner';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/location" element={<LocationSelection />} />
        <Route path="/scanner" element={<Scanner />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
