import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Mail } from 'lucide-react';
import { AuthShell } from '../components/layout/AuthShell';
import { Button, Field, Input, Message } from '../components/ui';
import { useAuth } from '../context/useAuth';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email || !password) {
      setError('Enter your email and password to continue.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Those credentials did not work. Check them and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Student sign in"
      title="Welcome back"
      subtitle="Pick up where your mentor left off."
      links={[
        { lead: "Don't have an account?", label: 'Create one free', to: '/register' },
        { lead: 'Supervising a team?', label: 'Faculty sign in', to: '/faculty/login' },
      ]}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Message type="error">{error}</Message>

        <Field label="Email address" htmlFor="login-email">
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            icon={Mail}
            placeholder="you@college.edu"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Field>

        <Field label="Password" htmlFor="login-password">
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Your password"
              className="pr-11"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded-md p-2 text-ink-faint transition-colors hover:bg-subtle hover:text-ink-soft"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
            </button>
          </div>
        </Field>

        <Button type="submit" size="lg" block loading={loading} icon={LogIn} className="mt-1">
          {loading ? 'Signing you in…' : 'Sign in'}
        </Button>
      </form>
    </AuthShell>
  );
}
