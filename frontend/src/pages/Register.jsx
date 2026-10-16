import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AtSign, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { AuthShell } from '../components/layout/AuthShell';
import { Button, Field, Input, Message, Select } from '../components/ui';
import { authApi } from '../lib/api/auth';

const DEPARTMENTS = [
  'Computer Science',
  'Information Technology',
  'Electronics',
  'Mechanical',
  'Civil',
  'Electrical',
  'Other',
];

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    department: 'Computer Science',
    semester: '6',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (event) => {
    setForm((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  };

  const passwordStrength = (() => {
    const p = form.password;
    if (!p) return null;
    let score = 0;
    if (p.length >= 8) score += 1;
    if (p.length >= 12) score += 1;
    if (/[A-Z]/.test(p)) score += 1;
    if (/[0-9]/.test(p)) score += 1;
    if (/[^A-Za-z0-9]/.test(p)) score += 1;
    if (score <= 2) return { label: 'Weak', width: '33%', tone: 'bg-danger-500' };
    if (score <= 3) return { label: 'Fair', width: '66%', tone: 'bg-warning-500' };
    return { label: 'Strong', width: '100%', tone: 'bg-success-500' };
  })();

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name || !form.email || !form.password) {
      setError('Your name, email and password are all needed to set things up.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authApi.register({
        name: form.name,
        email: form.email,
        password: form.password,
        department: form.department,
        semester: Number(form.semester),
      });
      navigate('/login');
    } catch (err) {
      setError(err.message || 'We could not create that account just yet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Student sign up"
      title="Create your account"
      subtitle="Two minutes now saves an argument with your guide later."
      links={[
        { lead: 'Already have an account?', label: 'Sign in', to: '/login' },
        { lead: 'Supervising a team?', label: 'Faculty sign in', to: '/faculty/login' },
      ]}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Message type="error">{error}</Message>

        <Field label="Full name" htmlFor="reg-name">
          <Input
            id="reg-name"
            name="name"
            icon={UserRound}
            placeholder="Aarav Sharma"
            autoComplete="name"
            value={form.name}
            onChange={handleChange}
            required
          />
        </Field>

        <Field label="College email" htmlFor="reg-email">
          <Input
            id="reg-email"
            name="email"
            type="email"
            icon={Mail}
            placeholder="you@college.edu"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Department" htmlFor="reg-dept">
            <Select
              id="reg-dept"
              name="department"
              value={form.department}
              onChange={handleChange}
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Semester" htmlFor="reg-sem">
            <Select id="reg-sem" name="semester" value={form.semester} onChange={handleChange}>
              {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={String(n)}>
                  Semester {n}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label="Password"
          htmlFor="reg-password"
          hint="At least 8 characters. Mix in a number and a symbol if you can."
        >
          <Input
            id="reg-password"
            name="password"
            type="password"
            icon={ShieldCheck}
            placeholder="Create a password"
            autoComplete="new-password"
            value={form.password}
            onChange={handleChange}
            required
          />
          {passwordStrength && (
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-subtle-strong">
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ${passwordStrength.tone}`}
                  style={{ width: passwordStrength.width }}
                />
              </div>
              <span className="text-[11px] font-semibold text-ink-muted">
                {passwordStrength.label}
              </span>
            </div>
          )}
        </Field>

        <Button type="submit" size="lg" block loading={loading} icon={AtSign} className="mt-1">
          {loading ? 'Creating your account…' : 'Create account'}
        </Button>

        <p className="text-center text-[12px] leading-relaxed text-ink-muted">
          By continuing you agree to use this workspace for academic work — your projects,
          check-ins and milestones stay private to you and your faculty reviewer.
        </p>
      </form>
    </AuthShell>
  );
}
