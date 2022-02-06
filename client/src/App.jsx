import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Vault from './pages/Vault';
import SnippetDetail from './pages/SnippetDetail';

function PrivateRoute({ children }) {
  const { isAuthed } = useAuth();
  return isAuthed ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<Navigate to="/vault" replace />} />
      <Route path="/vault" element={<PrivateRoute><Vault /></PrivateRoute>} />
      <Route path="/snippet/:id" element={<PrivateRoute><SnippetDetail /></PrivateRoute>} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
