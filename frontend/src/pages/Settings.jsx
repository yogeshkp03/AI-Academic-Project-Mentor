import { useEffect, useState } from 'react';
import { Mail, ShieldCheck, UserRound } from 'lucide-react';
import {
  Avatar,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  Message,
  PageHeader,
  Skeleton,
} from '../components/ui';
import { authApi } from '../lib/api/auth';
import { session } from '../lib/session';

export default function Settings() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await authApi.me();
        if (!active) return;
        setName(data.name || '');
        setEmail(data.email || '');
      } catch (error) {
        if (active) setMessage({ type: 'error', text: error.message });
      } finally {
        if (active) setLoadingProfile(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleSave = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      const data = await authApi.updateMe({ name: name.trim() });
      session.write('studentName', data.name);
      setMessage({ type: 'success', text: 'Your display name has been updated.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Your account"
        subtitle="The essentials. Everything project-related lives on its own page."
      />

      {message?.text && (
        <Message type={message.type} className="my-4">
          {message.text}
        </Message>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <Card>
          <CardHeader icon={UserRound} title="Display name" subtitle="How the app greets you." />
          <CardBody>
            {loadingProfile ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-11 w-full" />
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <Field label="Name" htmlFor="settings-name">
                  <Input
                    id="settings-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </Field>
                <Field label="Email" htmlFor="settings-email" hint="Email is read-only.">
                  <Input id="settings-email" icon={Mail} value={email} readOnly />
                </Field>
                <div className="flex justify-end border-t border-line pt-4">
                  <Button onClick={handleSave} loading={saving} disabled={!name.trim()}>
                    Save changes
                  </Button>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        <Card variant="inset">
          <CardHeader icon={ShieldCheck} title="How your data behaves" />
          <CardBody>
            <ul className="flex flex-col gap-3 text-[13px] leading-relaxed text-ink-soft">
              <li>
                <span className="font-semibold text-ink">Projects are private.</span> Only you
                and an approved faculty reviewer can read them.
              </li>
              <li>
                <span className="font-semibold text-ink">Analyses are versioned.</span> Running
                an analysis again keeps the old report — nothing is overwritten.
              </li>
              <li>
                <span className="font-semibold text-ink">Signing out is immediate.</span> It
                invalidates the token on this device, not just the browser copy.
              </li>
            </ul>
            <p className="mt-4 flex items-center gap-2 text-[12px] text-ink-muted">
              <Settings size={13} aria-hidden="true" />              Account actions such as password changes are handled by your department.
            </p>
          </CardBody>
        </Card>
      </div>

      <Card variant="inset" className="mt-5">
        <CardBody className="flex items-center gap-4">
          <Avatar name={name || email} size={44} />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-ink">{name || 'Student'}</p>
            <p className="truncate text-[12.5px] text-ink-muted">{email}</p>
          </div>
        </CardBody>
      </Card>
    </>
  );
}
