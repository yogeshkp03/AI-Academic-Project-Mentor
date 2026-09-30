import { useEffect, useState } from 'react';
import { Button, Card, Field, Input, Message, PageHeader } from '../components/ui';
import { authApi } from '../lib/api/auth';
import { session } from '../lib/session';

function Settings() {
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
      setMessage({ type: 'success', text: 'Changes saved.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Settings ⚙️" subtitle="Manage your account and preferences." />

      <Card title="Profile Information" className="max-w-lg">
        {message?.text && <Message type={message.type} className="mb-4">{message.text}</Message>}
        {loadingProfile ? (
          <p className="text-sm text-slate-500">Loading your profile…</p>
        ) : (
          <div className="flex flex-col gap-4">
            <Field label="Name">
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field label="Email" hint="Email is read-only.">
              <Input value={email} readOnly />
            </Field>
            <div>
              <Button onClick={handleSave} loading={saving} disabled={!name.trim()}>
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}

export default Settings;