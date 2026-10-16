import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Mail } from 'lucide-react';
import { AuthShell } from '../../components/layout/AuthShell';
import { Button, Field, Input, Message } from '../../components/ui';
import { useFacultyAuth } from '../../context/useFacultyAuth';

export default function FacultyLogin() {
  const navigate = useNavigate();
  const { login } = useFacultyAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email || !password) {
      setError('Enter your faculty email and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/faculty/dashboard');
    } catch (requestError) {
      setError(requestError.message || 'Those credentials did not work. Check them and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Faculty sign in"
      title="Supervisor sign in"
      subtitle="Review student blueprints, milestone progress and plan changes."
      links={[
        { lead: 'Need an account?', label: 'Request faculty access', to: '/faculty/register' },
        { lead: 'Are you a student?', label: 'Student sign in', to: '/login' },
      ]}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Message type="error">{error}</Message>
        <Field label="Faculty email" htmlFor="fac-login-email">
          <Input
            id="fac-login-email"
            type="email"
            icon={Mail}
            autoComplete="username"
            placeholder="you@college.edu"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Field>
        <Field
          label="Password"
          htmlFor="fac-login-password"
          hint="Approved accounts only — new requests wait for an administrator."
        >
          <Input
            id="fac-login-password"
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </Field>
        <Button type="submit" size="lg" block loading={loading} icon={LogIn}>
          {loading ? 'Signing you in…' : 'Sign in'}
        </Button>
      </form>
    </AuthShell>
  );
}
