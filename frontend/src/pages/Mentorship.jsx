import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, GraduationCap, Search, Send, Users } from 'lucide-react';
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
  Textarea,
} from '../components/ui';
import { MentorshipCountdown } from '../components/MentorshipCountdown';
import { mentorshipApi } from '../lib/api/mentorship';
import { authApi } from '../lib/api/auth';

const GOOGLE_FORM_URL = import.meta.env.VITE_FACULTY_APPEAL_FORM_URL?.trim();
const FORM_ENTRY_STUDENT_EMAIL = import.meta.env.VITE_FORM_ENTRY_STUDENT_EMAIL?.trim();
const FORM_ENTRY_FACULTY_ID = import.meta.env.VITE_FORM_ENTRY_FACULTY_ID?.trim();

const STATUS_TONES = {
  pending: 'warning',
  accepted: 'success',
  rejected: 'danger',
  expired: 'neutral',
  closed: 'neutral',
};

function formatDate(value) {
  return new Date(value).toLocaleString();
}

export default function Mentorship() {
  const [faculty, setFaculty] = useState([]);
  const [appeals, setAppeals] = useState([]);
  const [selectedFaculty, setSelectedFaculty] = useState('');
  const [courseArea, setCourseArea] = useState('');
  const [customCourseArea, setCustomCourseArea] = useState('');
  const [projectIdea, setProjectIdea] = useState('');
  const [message, setMessage] = useState('');
  const [shareProfile, setShareProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState(null);
  const [studentEmail, setStudentEmail] = useState('');
  const [facultyQuery, setFacultyQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [available, ownAppeals] = await Promise.all([
        mentorshipApi.availableFaculty(),
        mentorshipApi.myAppeals(),
      ]);
      setFaculty(available);
      setAppeals(ownAppeals);
      setNotice(null);
    } catch (error) {
      setNotice({ type: 'error', text: error.message || 'Could not load mentorship information.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      mentorshipApi.availableFaculty(),
      mentorshipApi.myAppeals(),
    ])
      .then(([available, ownAppeals]) => {
        if (!active) return;
        setFaculty(available);
        setAppeals(ownAppeals);
        setNotice(null);
      })
      .catch((error) => {
        if (active) {
          setNotice({ type: 'error', text: error.message || 'Could not load mentorship information.' });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    authApi.me()
      .then((profile) => setStudentEmail(profile.email))
      .catch((error) => setNotice({
        type: 'error',
        text: error.message || 'Could not load your account email for the appeal form.',
      }));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      mentorshipApi.myAppeals()
        .then(setAppeals)
        .catch((error) => setNotice({
          type: 'error',
          text: error.message || 'Could not refresh request statuses.',
        }));
    }, 60000);
    return () => window.clearInterval(timer);
  }, []);

  const activeMentor = appeals.find((appeal) => appeal.status === 'accepted');
  const pendingCount = appeals.filter((appeal) => appeal.status === 'pending').length;
  const departments = useMemo(
    () => [...new Set(faculty.map((person) => person.department))].sort((a, b) => a.localeCompare(b)),
    [faculty],
  );
  const visibleFaculty = useMemo(() => {
    const query = facultyQuery.trim().toLocaleLowerCase();
    return faculty.filter((person) => {
      const matchesQuery = !query
        || `${person.name} ${person.department} ${person.mentor_expertise}`.toLocaleLowerCase().includes(query);
      return matchesQuery && (!departmentFilter || person.department === departmentFilter);
    });
  }, [faculty, facultyQuery, departmentFilter]);

  const submitAppeal = async (event) => {
    event.preventDefault();
    if (!selectedFaculty) return;
    setSending(true);
    setNotice(null);
    try {
      await mentorshipApi.createAppeal({
        faculty_id: Number(selectedFaculty),
        course_area: (courseArea === 'Other' ? customCourseArea : courseArea).trim(),
        project_idea: projectIdea.trim(),
        message: message.trim(),
        share_profile: shareProfile,
      });
      setCourseArea('');
      setCustomCourseArea('');
      setProjectIdea('');
      setMessage('');
      setShareProfile(false);
      setSelectedFaculty('');
      await refresh();
      setNotice({ type: 'success', text: 'Your mentorship request was sent. The faculty member has 7 days to respond.' });
    } catch (error) {
      setNotice({ type: 'error', text: error.message || 'Could not send your request.' });
    } finally {
      setSending(false);
    }
  };

  const openGoogleForm = () => {
    try {
      const formUrl = new URL(GOOGLE_FORM_URL);
      formUrl.searchParams.set('usp', 'pp_url');
      if (FORM_ENTRY_STUDENT_EMAIL) {
        formUrl.searchParams.set(`entry.${FORM_ENTRY_STUDENT_EMAIL}`, studentEmail);
      }
      if (FORM_ENTRY_FACULTY_ID) {
        formUrl.searchParams.set(`entry.${FORM_ENTRY_FACULTY_ID}`, selectedFaculty);
      }
      window.open(formUrl.toString(), '_blank', 'noopener,noreferrer');
    } catch {
      setNotice({ type: 'error', text: 'The Google Form URL is not valid. Check the frontend configuration.' });
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Mentorship"
        title="Find a faculty mentor."
        subtitle="Send an appeal to available faculty and track their response here."
      />

      {notice && <Message type={notice.type} className="my-4">{notice.text}</Message>}

      {activeMentor && (
        <Card className="mb-5 border-success-200">
          <CardBody className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 text-success-600" size={21} aria-hidden="true" />
            <div>
              <p className="font-semibold text-ink">Your mentor is {activeMentor.faculty.name}</p>
              <p className="mt-1 text-sm text-ink-soft">
                {activeMentor.faculty.department} · accepted {formatDate(activeMentor.responded_at)}
              </p>
            </div>
          </CardBody>
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold text-ink">Available faculty</h2>
              <p className="mt-1 text-sm text-ink-muted">You can have up to 3 requests awaiting a response.</p>
            </div>
            <Badge tone="brand">{faculty.length} available</Badge>
          </div>
          <p className="mb-4 text-sm text-ink-muted">
            Choose a faculty member, explain your project, and send an appeal. They can review your consented profile details and have 7 days to respond.
          </p>

          {loading ? (
            <Card><CardBody>Loading faculty…</CardBody></Card>
          ) : faculty.length === 0 ? (
            <Card><CardBody>
              <EmptyState
                icon={Users}
                eyebrow="Mentorship"
                title="No faculty are accepting requests right now"
                message="Check back later. Faculty appear here after enabling mentorship availability."
              />
            </CardBody></Card>
          ) : (
            <>
              <div className="mb-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
                <Field label="Search faculty" htmlFor="mentor-search">
                  <Input
                    id="mentor-search"
                    icon={Search}
                    value={facultyQuery}
                    onChange={(event) => setFacultyQuery(event.target.value)}
                    placeholder="Name, department, or expertise"
                  />
                </Field>
                <Field label="Department" htmlFor="mentor-department">
                  <Select
                    id="mentor-department"
                    value={departmentFilter}
                    onChange={(event) => setDepartmentFilter(event.target.value)}
                  >
                    <option value="">All departments</option>
                    {departments.map((department) => (
                      <option key={department} value={department}>{department}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              {visibleFaculty.length === 0 ? (
                <Card><CardBody>
                  <EmptyState
                    icon={Search}
                    eyebrow="Faculty search"
                    title="No faculty match these filters"
                    message="Try a different name, expertise area, or department."
                  />
                </CardBody></Card>
              ) : (
                <div className="flex flex-col gap-3">
                  {visibleFaculty.map((person) => (
                <Card key={person.id}>
                  <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-ink">{person.name}</p>
                      <p className="mt-0.5 text-sm text-ink-soft">{person.department}</p>
                      <p className="mt-1 text-sm text-ink-muted">{person.mentor_expertise || 'Expertise not specified'}</p>
                    </div>
                    <Button
                      size="sm"
                      variant={String(person.id) === selectedFaculty ? 'primary' : 'secondary'}
                      disabled={Boolean(activeMentor) || pendingCount >= 3}
                      onClick={() => setSelectedFaculty(String(person.id))}
                    >
                      {String(person.id) === selectedFaculty ? 'Selected' : 'Request mentor'}
                    </Button>
                  </CardBody>
                </Card>
                  ))}
                </div>
              )}
            </>
          )}

          {selectedFaculty && !activeMentor && (
            <Card className="mt-4">
              <CardHeader
                icon={Send}
                title="Your mentorship appeal"
                subtitle={`Requesting ${faculty.find((person) => String(person.id) === selectedFaculty)?.name || 'faculty'}`}
              />
              <CardBody>
                {GOOGLE_FORM_URL ? (
                  <div className="flex flex-col gap-4">
                    <p className="text-sm leading-relaxed text-ink-soft">
                      Continue to the college Google Form to submit your course area, project idea, and appeal message. Your signed-in college email and selected faculty are prefilled when the form entry IDs are configured.
                    </p>
                    <label className="flex items-start gap-2.5 text-sm leading-relaxed text-ink-soft">
                      <input
                        type="checkbox"
                        checked={shareProfile}
                        onChange={(event) => setShareProfile(event.target.checked)}
                        className="mt-1 accent-brand-600"
                      />
                      <span>
                        I agree to share my name, college email, department, semester, skills, and latest completed skill-assessment score with this faculty member for this appeal. My resume is not uploaded or shared.
                      </span>
                    </label>
                    <p className="text-xs text-ink-muted">
                      The Google Form must also include a required consent question. Your request appears in the dashboards after the form response reaches the backend integration.
                    </p>
                    <Button
                      type="button"
                      icon={Send}
                      disabled={!shareProfile || !studentEmail}
                      onClick={openGoogleForm}
                    >
                      Continue to Google Form
                    </Button>
                  </div>
                ) : (
                  <form className="flex flex-col gap-4" onSubmit={submitAppeal}>
                  <Field label="Course or area" htmlFor="mentor-course">
                    <Select id="mentor-course" value={courseArea} onChange={(event) => setCourseArea(event.target.value)} required>
                      <option value="">Choose an area</option>
                      <option>Cybersecurity</option>
                      <option>Artificial Intelligence / Machine Learning</option>
                      <option>Data Science</option>
                      <option>Web Development</option>
                      <option>Mobile Development</option>
                      <option>Other</option>
                    </Select>
                  </Field>
                  {courseArea === 'Other' && (
                    <Field label="Specify your course or area" htmlFor="mentor-course-other">
                      <Input
                        id="mentor-course-other"
                        value={customCourseArea}
                        maxLength={100}
                        minLength={2}
                        onChange={(event) => setCustomCourseArea(event.target.value)}
                        required
                      />
                    </Field>
                  )}
                  <Field label="Project idea" htmlFor="mentor-idea">
                    <Textarea id="mentor-idea" rows={4} minLength={10} maxLength={5000} value={projectIdea} onChange={(event) => setProjectIdea(event.target.value)} placeholder="Describe the project you want to work on…" required />
                  </Field>
                  <Field label="Why are you requesting this faculty member?" htmlFor="mentor-message">
                    <Textarea id="mentor-message" rows={3} minLength={10} maxLength={3000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Share your goals and what guidance you are looking for…" required />
                  </Field>
                  <label className="flex items-start gap-2.5 text-sm leading-relaxed text-ink-soft">
                    <input
                      type="checkbox"
                      checked={shareProfile}
                      onChange={(event) => setShareProfile(event.target.checked)}
                      required
                      className="mt-1 accent-brand-600"
                    />
                    <span>
                      I agree to share my name, college email, department, semester, skills, and latest completed skill-assessment score with this faculty member for this appeal. My resume is not uploaded or shared.
                    </span>
                  </label>
                  <Button type="submit" icon={Send} loading={sending} disabled={!shareProfile}>
                    Send appeal
                  </Button>
                  </form>
                )}
              </CardBody>
            </Card>
          )}
        </section>

        <section>
          <div className="mb-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-xl font-semibold text-ink">Your requests</h2>
              <Button size="xs" variant="secondary" loading={loading} onClick={refresh}>Refresh</Button>
            </div>
            <p className="mt-1 text-sm text-ink-muted">Pending requests expire 7 days after submission.</p>
          </div>
          {appeals.length === 0 ? (
            <Card><CardBody>
              <EmptyState
                icon={GraduationCap}
                eyebrow="Appeals"
                title="No mentorship requests yet"
                message="Choose an available faculty member to send your first request."
              />
            </CardBody></Card>
          ) : (
            <div className="flex flex-col gap-3">
              {appeals.map((appeal) => (
                <Card key={appeal.id}>
                  <CardBody>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">{appeal.faculty.name}</p>
                        <p className="text-sm text-ink-muted">{appeal.course_area}</p>
                      </div>
                      <Badge tone={STATUS_TONES[appeal.status] || 'neutral'}>{appeal.status}</Badge>
                    </div>
                      {appeal.status === 'pending' && (
                        <p className="mt-3 text-xs text-ink-muted" title={`Respond by ${formatDate(appeal.expires_at)}`}>
                          <MentorshipCountdown deadline={appeal.expires_at} />
                      </p>
                    )}
                    {appeal.rejection_reason && (
                      <div className="mt-3 rounded-lg bg-danger-50 p-3 text-sm text-danger-700">
                        <strong>Faculty response:</strong> {appeal.rejection_reason}
                      </div>
                    )}
                    {appeal.status === 'closed' && (
                      <p className="mt-3 text-sm text-ink-muted">Another faculty member accepted your request; this one was closed.</p>
                    )}
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
