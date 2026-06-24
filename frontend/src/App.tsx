import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminBoard } from './pages/AdminBoard/AdminBoard';
import { Login } from './pages/Login/Login';
import { StaffView } from './pages/StaffView/StaffView';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<AdminBoard />} />
        <Route path="/my-calendar" element={<StaffView />} />
        <Route path="/" element={<Navigate to="/admin" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
