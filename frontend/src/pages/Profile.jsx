import { useEffect, useState } from 'react';
import { GraduationCap, Mail, Plus, X } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Message,
  PageHeader,
  Select,
} from '../components/ui';
import { authApi } from '../lib/api/auth';
import { session } from '../lib/session';

const LEVELS = [
  { label: 'Beginner', tone: 'warning' },
  { label: 'Intermediate', tone: 'info' },
  { label: 'Advanced', tone: 'success' },
];

const YEARS = ['', '1', '2', '3', '4', '5', '6'];

function ordinal(year) {
  const suffix = year === '1' ? 'st' : year === '2' ? 'nd' : year === '3' ? 'rd' : 'th';
  return `${year}${suffix} Year`;
}

export default function Profile() {
  const [profile, setProfile] = useState(() =>
    session.readJson('studentProfile', { name: '', email: '', college: '', branch: '', year: '' }),
  );
  const [skills, setSkills] = useState(() => session.skills);
  const [skillName, setSkillName] = useState('');
  const [skillLevel, setSkillLevel] = useState('Beginner');
  const [savingSkills, setSavingSkills] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await authApi.me();
        // Backend stores a single department string. We persist it as
        // "College - Branch", so split it back on reload to avoid drift.
        const [college, branch] = (data.department || '').split(/\s*-\s*/);
        const savedSkills = Array.isArray(data.skills) ? data.skills : [];
        const localSkills = session.skills.filter(
          (skill) =>
            skill?.name?.trim() && LEVELS.some((level) => level.label === skill.level),
        );
        const initialSkills = savedSkills.length > 0 ? savedSkills : localSkills;
        setSkills(initialSkills);
        if (savedSkills.length === 0 && localSkills.length > 0) {
          await authApi.updateMe({ skills: localSkills });
        }
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
        skills,
      });
      session.writeJson('studentProfile', profile);
      session.write('studentName', data.name);
      setMessage({ type: 'success', text: 'Profile saved.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const persistSkills = async (updated) => {
    setSavingSkills(true);
    setMessage(null);
    try {
      const data = await authApi.updateMe({ skills: updated });
      setSkills(data.skills || []);
      session.writeJson('studentSkills', data.skills || []);
      setMessage({ type: 'success', text: 'Skills saved to your account.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
      return false;
    } finally {
      setSavingSkills(false);
    }
    return true;
  };

  const handleAddSkill = async () => {
    if (!skillName.trim()) return;
    if (await persistSkills([...skills, { name: skillName.trim(), level: skillLevel }])) {
      setSkillName('');
      setSkillLevel('Beginner');
    }
  };

  const handleDeleteSkill = async (index) => {
    await persistSkills(skills.filter((_, i) => i !== index));
  };

  return (
    <>
      <PageHeader
        eyebrow="Profile"
        title="You, on the record"
        subtitle="Your details shape the analysis — the architect reads your skills before it recommends a stack."
      />

      {message?.text && (
        <Message type={message.type} className="my-4">
          {message.text}
        </Message>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <Card>
          <CardHeader
            icon={GraduationCap}
            title="Personal information"
            subtitle="Stored once, used everywhere."
          />
          <CardBody>
            <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" htmlFor="profile-name">
                  <Input
                    id="profile-name"
                    name="name"
                    value={profile.name}
                    onChange={handleChange}
                    placeholder="Your full name"
                    required
                  />
                </Field>
                <Field label="Email" htmlFor="profile-email" hint="Email is read-only.">
                  <Input
                    id="profile-email"
                    name="email"
                    type="email"
                    icon={Mail}
                    value={profile.email}
                    readOnly
                  />
                </Field>
                <Field label="College" htmlFor="profile-college">
                  <Input
                    id="profile-college"
                    name="college"
                    value={profile.college}
                    onChange={handleChange}
                    placeholder="Where you study"
                  />
                </Field>
                <Field label="Branch" htmlFor="profile-branch" hint="e.g. CSE, IT, ECE">
                  <Input
                    id="profile-branch"
                    name="branch"
                    value={profile.branch}
                    onChange={handleChange}
                    placeholder="CSE"
                  />
                </Field>
                <Field label="Year" htmlFor="profile-year">
                  <Select
                    id="profile-year"
                    name="year"
                    value={profile.year}
                    onChange={handleChange}
                  >
                    {YEARS.map((year) => (
                      <option key={year} value={year}>
                        {year ? ordinal(year) : 'Select'}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="flex justify-end border-t border-line pt-4">
                <Button type="submit">Save profile</Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <Card variant="ochre">
          <CardHeader
            icon={GraduationCap}
            title="Technical skills"
            subtitle="The skill check pulls its questions from this list."
          />
          <CardBody>
            <form
              className="flex flex-col gap-2.5"
              onSubmit={(event) => {
                event.preventDefault();
                handleAddSkill();
              }}
            >
              <Input
                aria-label="Skill name"
                placeholder="e.g. React, Python, SQL"
                value={skillName}
                onChange={(event) => setSkillName(event.target.value)}
              />
              <div className="flex gap-2">
                <Select
                  aria-label="Skill level"
                  value={skillLevel}
                  onChange={(event) => setSkillLevel(event.target.value)}
                >
                  {LEVELS.map((level) => (
                    <option key={level.label} value={level.label}>
                      {level.label}
                    </option>
                  ))}
                </Select>
                <Button
                  type="submit"
                  icon={Plus}
                  loading={savingSkills}
                  disabled={!skillName.trim()}
                >
                  Add
                </Button>
              </div>
            </form>

            <div className="mt-4">
              {skills.length === 0 ? (
                <EmptyState
                  icon={GraduationCap}
                  title="No skills yet"
                  message="Add the stack you actually know. The mentor uses it to judge whether your plan is realistic for you."
                />
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {skills.map((skill, index) => {
                    const level =
                      LEVELS.find((entry) => entry.label === skill.level) || LEVELS[0];
                    return (
                      <li key={`${skill.name}-${index}`}>
                        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1.5 pr-1.5 pl-3 text-[13px] font-semibold text-ink shadow-1">
                          {skill.name}
                          <Badge tone={level.tone}>{skill.level}</Badge>
                          <button
                            type="button"
                            aria-label={`Remove ${skill.name}`}
                            onClick={() => handleDeleteSkill(index)}
                            disabled={savingSkills}
                            className="grid size-5 cursor-pointer place-items-center rounded-full text-ink-faint transition-colors hover:bg-danger-50 hover:text-danger-600 disabled:opacity-50"
                          >
                            <X size={12} aria-hidden="true" />
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
