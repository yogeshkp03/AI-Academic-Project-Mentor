import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthShell } from '../components/layout/AuthShell';
import { AuthCard } from '../components/auth/AuthCard';
import { Button, Field, Input, Message } from '../components/ui';
import { authApi } from '../lib/api/auth';

function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    department: 'Computer Science',
    semester: '5',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (event) => {
    setForm((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name || !form.email || !form.password) {
      setError('Please fill in all fields.');
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
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <AuthCard
        icon="🎓"
        title="Create Account"
        subtitle="Start managing your academic projects."
        footer={
          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-bold text-brand-600 hover:text-brand-700">
              Login
            </Link>
          </p>
        }
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-1">
          <Message type="error" className="mb-3">{error}</Message>
          <Field label="Full Name">
            <Input name="name" placeholder="Enter your full name" value={form.name} onChange={handleChange} />
          </Field>
          <Field label="Email Address">
            <Input name="email" type="email" placeholder="you@example.com" value={form.email} onChange={handleChange} />
          </Field>
          <Field label="Department">
            <Input name="department" placeholder="Computer Science" value={form.department} onChange={handleChange} />
          </Field>
          <Field label="Semester">
            <Input name="semester" type="number" min="1" max="12" value={form.semester} onChange={handleChange} />
          </Field>
          <Field label="Password">
            <Input name="password" type="password" placeholder="Create a password" value={form.password} onChange={handleChange} />
          </Field>
          <Button type="submit" size="lg" loading={loading} className="mt-4">
            {loading ? 'Creating account...' : 'Create Account →'}
          </Button>
        </form>
      </AuthCard>
    </AuthShell>
  );
}

export default Register;