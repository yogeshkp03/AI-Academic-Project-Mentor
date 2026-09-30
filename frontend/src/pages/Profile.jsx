import { useEffect, useState } from 'react';
import { Button, Card, Field, Input, Message, PageHeader, Select } from '../components/ui';
import { authApi } from '../lib/api/auth';
import { session } from '../lib/session';

const LEVELS = [
  ['Beginner', 'bg-amber-100 text-amber-700'],
  ['Intermediate', 'bg-sky-100 text-sky-700'],
  ['Advanced', 'bg-emerald-100 text-emerald-700'],
];

const YEARS = ['', '1', '2', '3', '4', '5', '6'];

function Profile() {
  const [profile, setProfile] = useState(() =>
    session.readJson(
      'studentProfile',
      { name: '', email: '', college: '', branch: '', year: '' },
    ),
  );
  const [skills, setSkills] = useState(() => session.skills);
  const [skillName, setSkillName] = useState('');
  const [skillLevel, setSkillLevel] = useState('Beginner');
  const [message, setMessage] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await authApi.me();
        // Backend stores a single department string. We persist it as
        // "College - Branch", so split it back on reload to avoid drift.
        const [college, branch] = (data.department || '').split(/\s*-\s*/);
        setProfile((previous) => ({
          ...previous,
          name: data.name || previous.name,
          email: data.email || previous.email,
          college: college || previous.college,
          branch: branch || previous.branch,
          year: data.semester ? String(data.semester) : previous.year,
        }));
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      }
    })();
  }, []);

  const handleChange = (event) => {
    setProfile((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    try {
      const data = await authApi.updateMe({
        name: profile.name.trim(),
        department: [profile.college, profile.branch].filter(Boolean).join(' - '),
        semester: Number(profile.year) || null,
      });
      session.writeJson('studentProfile', profile);
      session.write('studentName', data.name);
      setMessage({ type: 'success', text: 'Profile saved!' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const persistSkills = (updated) => {
    setSkills(updated);
    session.writeJson('studentSkills', updated);
  };

  const handleAddSkill = () => {
    if (!skillName.trim()) return;
    persistSkills([...skills, { name: skillName.trim(), level: skillLevel }]);
    setSkillName('');
    setSkillLevel('Beginner');
  };

  const handleDeleteSkill = (index) => {
    persistSkills(skills.filter((_, i) => i !== index));
  };

  const levelStyles = Object.fromEntries(LEVELS);

  return (
    <>
      <PageHeader title="Student Profile" subtitle="Manage your personal information and technical skills." />

      {message?.text && <Message type={message.type} className="mb-4" onDismiss={() => setMessage(null)}>{message.text}</Message>}

      <Card title="Personal Information" className="max-w-2xl">
        <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full Name">
              <Input name="name" value={profile.name} onChange={handleChange} placeholder="Enter your full name" required />
            </Field>
            <Field label="Email" hint="Email is read-only.">
              <Input name="email" type="email" value={profile.email} readOnly />
            </Field>
            <Field label="College">
              <Input name="college" value={profile.college} onChange={handleChange} placeholder="Enter your college name" />
            </Field>
            <Field label="Branch">
              <Input name="branch" value={profile.branch} onChange={handleChange} placeholder="e.g. CSE" />
            </Field>
            <Field label="Year">
              <Select name="year" value={profile.year} onChange={handleChange}>
                {YEARS.map((year) => <option key={year} value={year}>{year ? `${year}${year === '1' ? 'st' : year === '2' ? 'nd' : year === '3' ? 'rd' : 'th'} Year` : 'Select'}</option>)}
              </Select>
            </Field>
          </div>
          <div>
            <Button type="submit">Save Profile</Button>
          </div>
        </form>
      </Card>

      <Card title="Technical Skills" className="mt-6">
        <div className="mb-5 flex flex-wrap gap-2">
          <Input
            className="min-w-40 flex-1"
            placeholder="e.g. React, Python, SQL"
            value={skillName}
            onChange={(event) => setSkillName(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); handleAddSkill(); } }}
          />
          <Select value={skillLevel} onChange={(event) => setSkillLevel(event.target.value)}>
            {LEVELS.map(([level]) => <option key={level}>{level}</option>)}
          </Select>
          <Button onClick={handleAddSkill}>+ Add Skill</Button>
        </div>

        {skills.length === 0 ? (
          <p className="text-sm text-slate-500">No skills added yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {skills.map((skill, index) => (
              <span
                key={index}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${levelStyles[skill.level] || levelStyles.Beginner}`}
              >
                {skill.name} · {skill.level}
                <button
                  type="button"
                  aria-label={`Remove ${skill.name}`}
                  onClick={() => handleDeleteSkill(index)}
                  className="cursor-pointer border-0 bg-transparent font-bold text-current opacity-60 transition hover:opacity-100"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

export default Profile;