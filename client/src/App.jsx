import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Header from './components/Header';
import CommandPalette from './components/CommandPalette';
import Login from './pages/Login';
import Register from './pages/Register';
import Vault from './pages/Vault';
import SnippetDetail from './pages/SnippetDetail';
import SnippetEditor from './components/SnippetEditor';

function PrivateRoute({ children }) {
  const { isAuthed } = useAuth();
  return isAuthed ? children : <Navigate to="/login" replace />;
}

function Layout({ children }) {
  const { isAuthed } = useAuth();
  return (
    <>
      {isAuthed && <Header />}
      {isAuthed && <CommandPalette />}
      {children}
    </>
  );
}

function AppRoutes() {
  return (
    <Layout>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<Navigate to="/vault" replace />} />
        <Route path="/vault" element={<PrivateRoute><Vault /></PrivateRoute>} />
        <Route path="/snippet/new" element={<PrivateRoute><SnippetEditor /></PrivateRoute>} />
        <Route path="/snippet/:id" element={<PrivateRoute><SnippetDetail /></PrivateRoute>} />
        <Route path="/snippet/:id/edit" element={<PrivateRoute><SnippetEditor /></PrivateRoute>} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
