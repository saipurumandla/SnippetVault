import { useNavigate, Link } from 'react-router';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import AuthForm from './AuthForm';

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();

  return (
    <AuthForm
      title="Create account"
      submitLabel="Create account"
      busyLabel="Creating account…"
      passwordHint="At least 8 characters."
      footer={<>Already have an account? <Link to="/login">Sign in</Link></>}
      onSubmit={async (email, password) => {
        const { token } = await api.post<{ token: string }>('/auth/register', { email, password });
        login(token);
        navigate('/vault');
      }}
    />
  );
}
