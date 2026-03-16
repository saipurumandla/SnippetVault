import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import NavSidebar from './components/NavSidebar';
import CommandPalette from './components/CommandPalette';
import ToastContainer from './components/Toast';
import Login from './pages/Login';
import Register from './pages/Register';
import Vault from './pages/Vault';
import SnippetDetail from './pages/SnippetDetail';
import SnippetEditor from './components/SnippetEditor';
import ProjectsPage from './pages/ProjectsPage';
import ExpiredSnippets from './pages/ExpiredSnippets';
import SecurityEvents from './pages/SecurityEvents';
import BackupRestore from './pages/BackupRestore';
import Settings from './pages/Settings';
import Docs from './pages/Docs';

function PrivateRoute({ children }) {
  const { isAuthed } = useAuth();
  return isAuthed ? children : <Navigate to="/login" replace />;
}

function AppShell({ children }) {
  const { isAuthed } = useAuth();
  if (!isAuthed) return children;
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <NavSidebar />
      <div style={{ marginLeft: 'var(--sidebar-w)', flex: 1, minHeight: '100vh' }}>
        {children}
      </div>
      <CommandPalette />
      <ToastContainer />
    </div>
  );
}

function AppRoutes() {
  return (
    <AppShell>
      <Routes>
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<Navigate to="/vault" replace />} />
        <Route path="/vault"          element={<PrivateRoute><Vault /></PrivateRoute>} />
        <Route path="/snippet/new"    element={<PrivateRoute><SnippetEditor /></PrivateRoute>} />
        <Route path="/snippet/:id"    element={<PrivateRoute><SnippetDetail /></PrivateRoute>} />
        <Route path="/snippet/:id/edit" element={<PrivateRoute><SnippetEditor /></PrivateRoute>} />
        <Route path="/projects"       element={<PrivateRoute><ProjectsPage /></PrivateRoute>} />
        <Route path="/expired"        element={<PrivateRoute><ExpiredSnippets /></PrivateRoute>} />
        <Route path="/security"       element={<PrivateRoute><SecurityEvents /></PrivateRoute>} />
        <Route path="/backup"         element={<PrivateRoute><BackupRestore /></PrivateRoute>} />
        <Route path="/settings"       element={<PrivateRoute><Settings /></PrivateRoute>} />
        <Route path="/docs"           element={<PrivateRoute><Docs /></PrivateRoute>} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  useEffect(() => {
    const handler = async (e) => {
      const btn = e.target.closest('.md-code-copy');
      if (!btn) return;
      const code = btn.closest('.md-code-block')?.querySelector('pre code');
      if (!code) return;
      try {
        await navigator.clipboard.writeText(code.textContent);
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
      } catch {
        btn.textContent = 'Failed';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
