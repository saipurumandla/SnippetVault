import { useNavigate, Link } from 'react-router';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import AuthForm from './AuthForm';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  return (
    <AuthForm
      title="Sign in"
      submitLabel="Sign in"
      busyLabel="Signing in…"
      footer={<>No account yet? <Link to="/register">Create one</Link></>}
      onSubmit={async (email, password) => {
        const { token } = await api.post<{ token: string }>('/auth/login', { email, password });
        login(token);
        navigate('/vault');
      }}
    />
  );
}
