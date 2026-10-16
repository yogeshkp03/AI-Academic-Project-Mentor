import { useState } from 'react';
import { Building2, Clock3, Mail, ShieldCheck, UserRound } from 'lucide-react';import { AuthShell } from '../../components/layout/AuthShell';
import { Button, Field, Input, Message } from '../../components/ui';
import { facultyApi } from '../../lib/api/faculty';

const INITIAL = { name: '', email: '', department: '', password: '' };

export default function FacultyRegister() {
  const [form, setForm] = useState(INITIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await facultyApi.register(form);
      setSubmitted(true);
    } catch (requestError) {
      setError(requestError.message || 'Could not submit the faculty account request.');
    } finally {
      setLoading(false);
    }
  };

  const update = (field) => (event) => {
    setForm((previous) => ({ ...previous, [field]: event.target.value }));
  };

  return (
    <AuthShell
      eyebrow="Faculty access"
      title={submitted ? 'Request received' : 'Request faculty access'}
      subtitle={
        submitted
          ? 'An administrator must approve your account before student work becomes visible.'
          : 'New faculty accounts are reviewed before they can read student submissions. It takes a moment and keeps that data accountable.'
      }
      links={[
        { lead: 'Already approved?', label: 'Faculty sign in', to: '/faculty/login' },
        { lead: 'Are you a student?', label: 'Student sign in', to: '/login' },
      ]}
    >
      {submitted ? (
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-warning-50 text-warning-600">
            <Clock3 size={22} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Waiting for approval</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
              Once an administrator approves your account, sign in with this email and
              password to start reviewing projects.
            </p>
          </div>
          <Button variant="secondary" onClick={() => setSubmitted(false)}>
            Submit another request
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Message type="error">{error}</Message>

          <Field label="Full name" htmlFor="fac-reg-name">
            <Input
              id="fac-reg-name"
              icon={UserRound}
              autoComplete="name"
              required
              minLength={2}
              maxLength={100}
              placeholder="Dr. Meera Iyer"
              value={form.name}
              onChange={update('name')}
            />
          </Field>

          <Field label="Work email" htmlFor="fac-reg-email">
            <Input
              id="fac-reg-email"
              type="email"
              icon={Mail}
              autoComplete="email"
              required
              placeholder="you@college.edu"
              value={form.email}
              onChange={update('email')}
            />
          </Field>

          <Field label="Department" htmlFor="fac-reg-dept" hint="Where you supervise projects.">
            <Input
              id="fac-reg-dept"
              icon={Building2}
              required
              minLength={2}
              maxLength={100}
              placeholder="Computer Science"
              value={form.department}
              onChange={update('department')}
            />
          </Field>

          <Field label="Password" htmlFor="fac-reg-password" hint="At least 12 characters.">
            <Input
              id="fac-reg-password"
              type="password"
              icon={ShieldCheck}
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
              value={form.password}
              onChange={update('password')}
            />
          </Field>

          <Button type="submit" size="lg" block loading={loading}>
            {loading ? 'Sending your request…' : 'Submit access request'}
          </Button>

          <p className="text-center text-[12px] leading-relaxed text-ink-muted">
            Faculty see project submissions, AI blueprints and milestone progress — nothing
            else. Access is granted per account, never shared.
          </p>
        </form>
      )}
    </AuthShell>
  );
}
