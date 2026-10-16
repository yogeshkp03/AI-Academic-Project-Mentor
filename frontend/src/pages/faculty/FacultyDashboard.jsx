import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpenCheck,
  CalendarClock,
  FileText,
  GraduationCap,
  Inbox,
  ListChecks,
  RefreshCw,
  Star,
} from 'lucide-react';
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
  SkeletonList,
  StatCard,
  StatusBadge,
  Textarea,
  useToast,
} from '../../components/ui';
import { useFacultyAuth } from '../../context/useFacultyAuth';
import { facultyApi } from '../../lib/api/faculty';
import { ReportViewer } from '../../components/ui';
import { MentorshipCountdown } from '../../components/MentorshipCountdown';

const FILTERS = [
  { key: 'needs', label: 'Needs a review' },
  { key: 'all', label: 'All mentee projects' },
  { key: 'reviewed', label: 'Already reviewed' },
];

export default function FacultyDashboard() {
  const { token, faculty, updateFaculty } = useFacultyAuth();
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [filter, setFilter] = useState('needs');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState({ score: '', feedback: '' });
  const [notice, setNotice] = useState(null);
  const [mentorAppeals, setMentorAppeals] = useState([]);
  const [mentorAvailable, setMentorAvailable] = useState(Boolean(faculty?.is_mentor_available));
  const [mentorExpertise, setMentorExpertise] = useState(faculty?.mentor_expertise || '');
  const [savingMentorProfile, setSavingMentorProfile] = useState(false);
  const [rejectionReasons, setRejectionReasons] = useState({});
  const [decidingAppealId, setDecidingAppealId] = useState(null);

  const loadMentorAppeals = useCallback(async () => {
    try {
      const rows = await facultyApi.mentorAppeals(token);
      setMentorAppeals(rows);
    } catch (error) {
      setNotice({ type: 'error', text: error.message || 'Could not load mentorship requests.' });
    }
  }, [token]);

  useEffect(() => {
    let active = true;
    facultyApi.mentorAppeals(token)
      .then((rows) => {
        if (active) setMentorAppeals(rows);
      })
      .catch((error) => {
        if (active) {
          setNotice({ type: 'error', text: error.message || 'Could not load mentorship requests.' });
        }
      });
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      facultyApi.mentorAppeals(token)
        .then(setMentorAppeals)
        .catch((error) => setNotice({
          type: 'error',
          text: error.message || 'Could not refresh mentorship request statuses.',
        }));
    }, 60000);
    return () => window.clearInterval(timer);
  }, [token]);

  const saveMentorProfile = async () => {
    setSavingMentorProfile(true);
    setNotice(null);
    try {
      const updated = await facultyApi.updateMentorProfile(token, {
        is_mentor_available: mentorAvailable,
        mentor_expertise: mentorExpertise,
      });
      setMentorAvailable(updated.is_mentor_available);
      setMentorExpertise(updated.mentor_expertise);
      updateFaculty(updated);
      toast.success(updated.is_mentor_available
        ? 'You are now visible to students seeking a mentor.'
        : 'Mentorship requests are turned off.');
    } catch (error) {
      setNotice({ type: 'error', text: error.message || 'Could not update mentor availability.' });
    } finally {
      setSavingMentorProfile(false);
    }
  };

  const decideMentorAppeal = async (appeal, decision) => {
    setDecidingAppealId(appeal.id);
    setNotice(null);
    try {
      await facultyApi.decideMentorAppeal(token, appeal.id, {
        decision,
        rejection_reason: decision === 'reject' ? rejectionReasons[appeal.id] || '' : null,
      });
      await loadMentorAppeals();
      toast.success(decision === 'accept'
        ? 'Mentorship request accepted. Other pending requests from this student were closed.'
        : 'Request rejected with your reason.');
    } catch (error) {
      setNotice({ type: 'error', text: error.message || 'Could not resolve the mentorship request.' });
    } finally {
      setDecidingAppealId(null);
    }
  };

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await facultyApi.projects(token);
      setProjects(rows);
      setNotice(null);
    } catch (error) {
      setNotice({ type: 'error', text: error.message || 'Could not load student projects.' });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    let active = true;
    facultyApi
      .projects(token)
      .then((rows) => {
        if (!active) return;
        setProjects(rows);
        setNotice(null);
      })
      .catch((error) => {
        if (!active) return;
        setNotice({ type: 'error', text: error.message || 'Could not load student projects.' });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const startEditing = (project) => {
    setEditingId(project.id);
    setDraft({
      score: project.faculty_evaluation?.score ?? '',
      feedback: project.faculty_evaluation?.feedback ?? '',
    });
    setNotice(null);
  };

  const saveEvaluation = async (projectId) => {
    setSavingId(projectId);
    setNotice(null);
    try {
      const updated = await facultyApi.saveEvaluation(token, projectId, {
        score: Number(draft.score),
        feedback: draft.feedback.trim(),
      });
      setProjects((previous) =>
        previous.map((project) => (project.id === projectId ? updated : project)),
      );
      setEditingId(null);
      toast.success('The student can now see your feedback in their Milestones page.');
    } catch (error) {
      setNotice({ type: 'error', text: error.message || 'Could not save the evaluation.' });
    } finally {
      setSavingId(null);
    }
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects
      .filter((project) => {
        if (q) {
          const haystack = `${project.title} ${project.student_name} ${project.student_email}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        if (filter === 'needs') return !project.faculty_evaluation;
        if (filter === 'reviewed') return Boolean(project.faculty_evaluation);
        return true;
      })
      .sort((a, b) => {
        // Reviewed last, then most recent first
        if (Boolean(a.faculty_evaluation) !== Boolean(b.faculty_evaluation)) {
          return a.faculty_evaluation ? 1 : -1;
        }
        return (b.id || 0) - (a.id || 0);
      });
  }, [projects, filter, query]);

  const queueCount = projects.filter((p) => !p.faculty_evaluation).length;

  return (
    <>
      <PageHeader
        eyebrow="Faculty review"
        title={`Review queue, ${faculty?.name?.split(' ')[0] || 'Professor'}.`}
        subtitle="Review projects from students who accepted your mentorship. Their AI blueprints and milestone progress are included."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              onClick={loadProjects}
              loading={loading}
            >
              Refresh
            </Button>
          </>
        }
      />

      {notice && (
        <Message type="error" className="mb-5">
          {notice.text}
        </Message>
      )}

      <Card className="mb-5">
        <CardHeader
          icon={GraduationCap}
          title="Mentorship availability"
          subtitle="Your account is approved. Students can discover you after you enable availability and save your expertise."
          actions={
            <Badge tone={mentorAvailable ? 'success' : 'neutral'}>
              {mentorAvailable ? 'Visible to students' : 'Not accepting requests'}
            </Badge>
          }
        />
        <CardBody>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Field label="Areas of expertise" htmlFor="mentor-expertise">
                <Input
                  id="mentor-expertise"
                  value={mentorExpertise}
                  maxLength={500}
                  onChange={(event) => setMentorExpertise(event.target.value)}
                  placeholder="e.g. Cybersecurity, machine learning, data science"
                />
              </Field>
              <label className="mt-3 inline-flex items-center gap-2 text-sm text-ink-soft">
                <input
                  type="checkbox"
                  checked={mentorAvailable}
                  onChange={(event) => setMentorAvailable(event.target.checked)}
                  className="accent-brand-600"
                />
                Accept new mentorship requests
              </label>
              <p className="mt-2 text-xs text-ink-muted">
                {mentorAvailable
                  ? 'Your approved profile is listed on Find a mentor. Turn this off any time to stop new requests.'
                  : 'Your profile will not appear in the student directory until you enable this and save.'}
              </p>
            </div>
            <Button size="sm" loading={savingMentorProfile} onClick={saveMentorProfile}>
              Save availability
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card className="mb-7">
        <CardHeader
          icon={Inbox}
          title="Mentorship requests"
          subtitle="Requests include student profile details shared with their consent. Unanswered requests expire 7 days after submission."
          actions={<Badge tone="warning">{mentorAppeals.filter((appeal) => appeal.status === 'pending').length} pending</Badge>}
        />
        <CardBody>
          {mentorAppeals.length === 0 ? (
            <p className="text-sm text-ink-muted">No mentorship requests yet.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {mentorAppeals.map((appeal) => (
                <div key={appeal.id} className="rounded-xl border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-ink">{appeal.student_name}</h3>
                      <p className="text-sm text-ink-muted">
                        {appeal.student_email} · {appeal.student_department} · Semester {appeal.student_semester}
                      </p>
                    </div>
                    <StatusBadge status={appeal.status === 'pending' ? 'pending' : appeal.status === 'accepted' ? 'completed' : appeal.status} map="run">
                      {appeal.status}
                    </StatusBadge>
                  </div>
                  <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <dt className="eyebrow">Area</dt>
                      <dd className="mt-1 text-sm text-ink">{appeal.course_area}</dd>
                    </div>
                    <div>
                      <dt className="eyebrow">Skill assessment</dt>
                      <dd className="mt-1 text-sm text-ink">
                        {appeal.assessment_score == null
                          ? 'No completed assessment'
                          : `${appeal.assessment_score}% (${appeal.assessment_correct_answers}/${appeal.assessment_total_questions})`}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="eyebrow">Skills</dt>
                      <dd className="mt-1 text-sm text-ink">
                        {appeal.student_skills.length
                          ? appeal.student_skills.map((skill) => `${skill.name} (${skill.level})`).join(', ')
                          : 'No skills listed'}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="eyebrow">Project idea</dt>
                      <dd className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{appeal.project_idea}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="eyebrow">Student’s message</dt>
                      <dd className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{appeal.message}</dd>
                    </div>
                  </dl>
                  {appeal.status === 'pending' && (
                    <div className="mt-4 border-t border-line pt-4">
                      <p className="mb-3 text-xs text-ink-muted">
                        <span title={`Respond by ${new Date(appeal.expires_at).toLocaleString()}`}>
                          <MentorshipCountdown deadline={appeal.expires_at} />
                        </span>
                      </p>
                      <Field label="Reason (required when rejecting)" htmlFor={`reject-reason-${appeal.id}`}>
                        <Textarea
                          id={`reject-reason-${appeal.id}`}
                          rows={2}
                          minLength={5}
                          maxLength={2000}
                          value={rejectionReasons[appeal.id] || ''}
                          onChange={(event) => setRejectionReasons((previous) => ({
                            ...previous,
                            [appeal.id]: event.target.value,
                          }))}
                          placeholder="Explain briefly so the student understands your decision."
                        />
                      </Field>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          loading={decidingAppealId === appeal.id}
                          onClick={() => decideMentorAppeal(appeal, 'accept')}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={(rejectionReasons[appeal.id] || '').trim().length < 5 || decidingAppealId === appeal.id}
                          loading={decidingAppealId === appeal.id}
                          onClick={() => decideMentorAppeal(appeal, 'reject')}
                        >
                          Reject with reason
                        </Button>
                      </div>
                      <p className="mt-2 text-xs text-ink-muted">
                        Accepting makes you the student’s sole mentor and closes their other pending requests.
                      </p>
                    </div>
                  )}
                  {appeal.rejection_reason && (
                    <p className="mt-3 rounded-lg bg-danger-50 p-3 text-sm text-danger-700">
                      Your rejection reason: {appeal.rejection_reason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        <StatCard icon={Inbox} label="Awaiting you" value={queueCount} tone="warning" />
        <StatCard
          icon={Star}
          label="Reviewed"
          value={projects.length - queueCount}
          tone="success"
        />
        <StatCard icon={ListChecks} label="Mentee projects" value={projects.length} tone="brand" />
        <StatCard
          icon={BookOpenCheck}
          label="With blueprints"
          value={projects.filter((p) => p.ai_report).length}
          tone="info"
        />
      </div>

      {/* Review controls */}
      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Review filters">
          {FILTERS.map((option) => (
            <button
              key={option.key}
              type="button"
              role="tab"
              aria-selected={filter === option.key}
              onClick={() => setFilter(option.key)}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-[9px] px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                filter === option.key
                  ? 'bg-brand-600 text-white shadow-brand'
                  : 'border border-line bg-surface text-ink-soft hover:border-line-strong'
              }`}
            >
              {option.label}
              {option.key === 'needs' && queueCount > 0 && (
                <span
                  className={`rounded-full px-1.5 text-[11px] font-bold ${filter === 'needs' ? 'bg-white/20' : 'bg-warning-100 text-warning-700'}`}
                >
                  {queueCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="sm:w-72">
          <Input
            icon={FileText}
            placeholder="Search student, email or title"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search submissions"
          />
        </div>
      </div>

      {loading && projects.length === 0 ? (
        <Card className="mt-5">
          <SkeletonList rows={3} />
        </Card>
      ) : visible.length === 0 ? (
        <Card className="mt-5">
          <CardBody>
            <EmptyState
              icon={Inbox}
              eyebrow="Queue"
              title={
                filter === 'needs' ? 'Nothing waiting on you' : 'No mentee projects match that'
              }
              message={
                filter === 'needs'
                  ? 'Projects appear here after a student request is accepted. New project work from your mentees will appear here as they create it.'
                  : 'Try a different filter, or clear the search box.'
              }
            />
          </CardBody>
        </Card>
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          {visible.map((project) => {
            const evaluation = project.faculty_evaluation;
            const isEditing = editingId === project.id;
            const expanded = expandedId === project.id;
            const completed = project.completed_milestone_count || 0;
            const total = project.milestone_count || 0;
            const progress = total ? Math.round((completed / total) * 100) : 0;

            return (
              <Card key={project.id}>
                <CardHeader
                  eyebrow={project.student_department || 'Department not provided'}
                  title={project.title}
                  subtitle={`${project.student_name} · ${project.student_email}`}
                  icon={FileText}
                  actions={
                    <>
                      <StatusBadge
                        status={evaluation ? 'completed' : 'pending'}
                        map="run"
                      >
                        {evaluation ? `Scored ${evaluation.score}/100` : 'Not reviewed'}
                      </StatusBadge>
                      {project.analysis_status && (
                        <Badge tone="brand">{project.analysis_status}</Badge>
                      )}
                    </>
                  }
                />

                <CardBody className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,0.6fr)]">
                  <div className="min-w-0">
                    <p className="eyebrow mb-1.5">Project idea</p>
                    <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap text-ink-soft">
                      {project.idea}
                    </p>

                    <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-line bg-subtle/60 px-3 py-2.5">
                        <dt className="eyebrow">Technology</dt>
                        <dd className="mt-1 text-[13px] font-semibold text-ink">
                          {project.technology_stack || 'Not specified'}
                        </dd>
                      </div>
                      <div className="rounded-xl border border-line bg-subtle/60 px-3 py-2.5">
                        <dt className="eyebrow">Timeline</dt>
                        <dd className="mt-1 text-[13px] font-semibold text-ink">
                          {project.duration || 'Not specified'}
                        </dd>
                      </div>
                      <div className="rounded-xl border border-line bg-subtle/60 px-3 py-2.5">
                        <dt className="eyebrow">Milestones</dt>
                        <dd className="mt-1 text-[13px] font-semibold text-ink tabular">
                          {total ? `${completed} of ${total} done` : 'None generated'}
                        </dd>
                      </div>
                    </dl>

                    {total > 0 && (
                      <div className="mt-3">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-subtle-strong">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700 transition-[width] duration-700"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <p className="mt-1.5 text-[11.5px] text-ink-muted tabular">
                          {progress}% of the plan is complete
                        </p>
                      </div>
                    )}

                    {project.ai_report ? (
                      <div className="mt-4">
                        <Button
                          size="sm"
                          variant="subtle"
                          icon={BookOpenCheck}
                          onClick={() => setExpandedId(expanded ? null : project.id)}
                        >
                          {expanded ? 'Hide AI blueprint' : 'Read the AI blueprint'}
                        </Button>
                        {expanded && (
                          <ReportViewer
                            report={project.ai_report}
                            className="mt-3"
                            actions={false}
                          />
                        )}
                      </div>
                    ) : (
                      <p className="mt-4 text-[12.5px] text-ink-muted">
                        This student has not run an analysis yet, so there is no blueprint to
                        review.
                      </p>
                    )}
                  </div>

                  {/* Evaluation column */}
                  <div className="rounded-xl border border-line bg-inset p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                        <Star size={15} className="text-ochare-500" aria-hidden="true" />
                        Your evaluation
                      </h3>
                      {!isEditing && (
                        <Button size="xs" variant="secondary" onClick={() => startEditing(project)}>
                          {evaluation ? 'Update' : 'Evaluate'}
                        </Button>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="mt-4 flex flex-col gap-4">
                        <Field label="Score out of 100" htmlFor={`score-${project.id}`}>
                          <Input
                            id={`score-${project.id}`}
                            type="number"
                            min="0"
                            max="100"
                            required
                            value={draft.score}
                            onChange={(event) =>
                              setDraft((previous) => ({ ...previous, score: event.target.value }))
                            }
                          />
                        </Field>
                        <Field
                          label="Feedback"
                          htmlFor={`feedback-${project.id}`}
                          hint={`${draft.feedback.trim().length} / 5000 characters`}
                        >
                          <Textarea
                            id={`feedback-${project.id}`}
                            rows={6}
                            minLength={5}
                            maxLength={5000}
                            required
                            value={draft.feedback}
                            onChange={(event) =>
                              setDraft((previous) => ({
                                ...previous,
                                feedback: event.target.value,
                              }))
                            }
                            placeholder="What should this student change before the review meeting?"
                          />
                        </Field>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            loading={savingId === project.id}
                            disabled={!draft.score || !draft.feedback.trim()}
                            onClick={() => saveEvaluation(project.id)}
                          >
                            Save & share
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={savingId === project.id}
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : evaluation ? (
                      <div className="mt-4">
                        <p className="flex items-baseline gap-1.5 font-display text-[34px] leading-none font-semibold text-brand-700 tabular">
                          {evaluation.score}
                          <span className="font-sans text-[15px] font-semibold text-ink-faint">
                            / 100
                          </span>
                        </p>
                        <p className="mt-3 text-[13px] leading-relaxed whitespace-pre-wrap text-ink-soft">
                          {evaluation.feedback}
                        </p>
                        <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-ink-muted">
                          <CalendarClock size={12} aria-hidden="true" />
                          {new Date(evaluation.evaluated_at).toLocaleString()}
                        </p>
                      </div>
                    ) : (
                      <div className="mt-4">
                        <p className="text-[13px] leading-relaxed text-ink-muted">
                          No evaluation submitted yet. Scoring this project makes your feedback
                          visible to the student straight away.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {['Scope too broad', 'Good plan', 'Needs milestones'].map((chip) => (
                            <span
                              key={chip}
                              className="rounded-full border border-line bg-subtle px-2 py-0.5 text-[11px] text-ink-muted"
                            >
                              {chip}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
