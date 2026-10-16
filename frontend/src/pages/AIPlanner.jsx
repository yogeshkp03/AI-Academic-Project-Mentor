import { useMemo, useState } from 'react';
import { Compass, Play, Sparkles, Wand2 } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { useProjects } from '../hooks/useProjects';
import { useAgentRuns, useAllRuns } from '../hooks/useAgentRuns';
import { formatDuration, toStepRail } from '../lib/agentRuns';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  Message,
  PageHeader,
  ReportViewer,
  Section,
  Select,
  StepRail,
  StatusBadge,
  Textarea,
  useToast,
} from '../components/ui';
import { downloadRunReport } from '../lib/reportExport';

const DURATIONS = ['1 Month', '2 Months', '3 Months', '6 Months'];

const TEAM_PREVIEW = [
  { role: 'Feasibility', note: 'Can this be built in your timeframe?' },
  { role: 'Architect', note: 'Stack, database, and system shape' },
  { role: 'Scope', note: 'What is in the MVP and what is not' },
  { role: 'Timeline', note: 'Week-by-week milestones' },
  { role: 'UI/UX', note: 'The screens you actually need' },
  { role: 'Planning', note: 'Execution order and sequences' },
  { role: 'Professor QA', note: 'How it will be graded' },
  { role: 'Resources', note: 'Where to learn each piece' },
];

export default function AIPlanner() {
  const { studentId } = useAuth();
  const toast = useToast();
  const { projects, createProject, error: projectsError } = useProjects(studentId);
  const { startAnalysis } = useAgentRuns(null);
  const { runs, error: runsError, failedProjectIds, refetch: refetchRuns, setRuns } =
    useAllRuns(studentId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [techStack, setTechStack] = useState('');
  const [duration, setDuration] = useState(DURATIONS[1]);
  const [loading, setLoading] = useState(false);
  const [trackedProjectId, setTrackedProjectId] = useState(null);
  const [message, setMessage] = useState(null);

  const run = useMemo(() => {
    const candidates = trackedProjectId
      ? runs.filter((item) => item.project_id === trackedProjectId)
      : runs;
    return [...candidates].sort((a, b) =>
      (b.created_at || '').localeCompare(a.created_at || ''),
    )[0] || null;
  }, [runs, trackedProjectId]);

  const trackedProject = trackedProjectId
    ? projects.find((item) => item.id === trackedProjectId)
    : null;

  const completedReport = run?.status === 'completed' ? run.output || '' : '';

  const handleDownloadFormat = async (format) => {
    if (!run) return;
    try {
      await downloadRunReport(run, format, { projectTitle: trackedProject?.title });
      toast.success(`Blueprint downloaded as ${format.toUpperCase()}.`);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleGenerate = async (event) => {
    event.preventDefault();
    if (!title.trim() || !description.trim()) {
      setMessage({ type: 'error', text: 'A title and a description are both needed.' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const project = await createProject({
        title,
        idea: description,
        technology_stack: techStack,
        duration,
      });
      setTrackedProjectId(project.id);
      const startedRun = await startAnalysis(project.id);
      setRuns((previous) => [startedRun, ...previous.filter((item) => item.id !== startedRun.id)]);
      toast.info(
        'You can close this page — the worker keeps going and your blueprint will be waiting.',
        'Analysis queued',
      );
      await refetchRuns();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const charCount = description.trim().length;
  const ideaQuality =
    charCount === 0
      ? null
      : charCount < 80
        ? { tone: 'warning', text: 'A little more detail helps the architect' }
        : charCount < 400
          ? { tone: 'success', text: 'Good level of detail for a first pass' }
          : { tone: 'success', text: 'Rich brief — the team will have plenty to work with' };

  return (
    <>
      <PageHeader
        eyebrow="New analysis"
        title="Start a project"
        subtitle="Write the brief. The specialist team takes it from there, in the order shown."
        actions={
          run && <StatusBadge status={run.status}>{run.agent_type || 'analysis'}</StatusBadge>
        }
      />

      {message?.text && (
        <Message type={message.type} className="my-4">
          {message.text}
        </Message>
      )}
      {(projectsError || runsError || failedProjectIds.length > 0) && (
        <Message type="warning" className="my-4">
          {projectsError?.message ||
            runsError?.message ||
            `Analysis history could not load for ${failedProjectIds.length} project${failedProjectIds.length > 1 ? 's' : ''}.`}
        </Message>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        {/* Brief */}
        <Card>
          <CardHeader
            icon={Compass}
            title="The brief"
            subtitle="Write this the way you would explain it to your guide."
          />
          <CardBody>
            <form onSubmit={handleGenerate} className="flex flex-col gap-4">
              <Field
                label="Project title"
                htmlFor="planner-title"
                hint="Specific beats clever. 'Lab attendance via QR' says more than 'Smart attendance'."
              >
                <Input
                  id="planner-title"
                  placeholder="Lab attendance tracking via QR codes"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                />
              </Field>

              <Field
                label="What are you building?"
                htmlFor="planner-description"
                hint={
                  ideaQuality ? (
                    <span
                      className={
                        ideaQuality.tone === 'warning' ? 'text-warning-600' : 'text-success-600'
                      }
                    >
                      {ideaQuality.text}
                    </span>
                  ) : (
                    'At least a paragraph: the problem, who uses it, and what makes it feasible.'
                  )
                }
              >
                <Textarea
                  id="planner-description"
                  rows={7}
                  placeholder="Lab assistants currently take attendance on paper, which is slow and error-prone. A web app where each student scans a QR code against a lab session would cut it to seconds and give us attendance data we can export…"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  required
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Available technologies"
                  htmlFor="planner-tech"
                  hint="Optional, but it sharpens the architecture."
                >
                  <Input
                    id="planner-tech"
                    placeholder="React, Python, SQLite"
                    value={techStack}
                    onChange={(event) => setTechStack(event.target.value)}
                  />
                </Field>
                <Field label="Time available" htmlFor="planner-duration">
                  <Select
                    id="planner-duration"
                    value={duration}
                    onChange={(event) => setDuration(event.target.value)}
                  >
                    {DURATIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
                <p className="hidden text-[12px] text-ink-muted sm:block">
                  Takes about two minutes · results stay on your account
                </p>
                <Button type="submit" size="lg" icon={Wand2} loading={loading}>
                  {loading ? 'Queueing the team…' : 'Generate blueprint'}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>

        {/* Team preview */}
        <div className="flex flex-col gap-5">
          <Card variant="ochre">
            <CardHeader
              icon={Sparkles}
              title="Who reads it"
              subtitle="Eight specialists, in this order."
            />
            <CardBody>
              <ol className="flex flex-col gap-2.5">
                {TEAM_PREVIEW.map((member, index) => (
                  <li key={member.role} className="flex items-start gap-2.5">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full border border-ochare-200 bg-surface text-[11px] font-bold text-ochare-600 tabular">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-ink">{member.role}</p>
                      <p className="text-[12px] leading-relaxed text-ink-muted">{member.note}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Live run */}
      {run && (
        <Section className="mt-7" title="Analysis in progress" >
          <Card>
            <CardHeader
              icon={Play}
              title={`Version ${run.version} · ${run.agent_type === 'complete_analysis' ? 'Full blueprint' : run.agent_type}`}
              subtitle={
                run.status === 'queued'
                  ? 'Queued. The worker picks it up as soon as it is free.'
                  : run.status === 'running'
                    ? 'The team is working through the stages. Each completed stage is saved as it lands.'
                    : run.error_message || `Run ${run.status}.`
              }
              actions={
                <Badge tone={run.status === 'failed' ? 'danger' : 'brand'}>
                  {formatDuration(run.duration_ms) || run.status}
                </Badge>
              }
            />
            <CardBody>
              <StepRail steps={toStepRail(run)} className="mb-4" />
              {run.status === 'completed' ? (
                <ReportViewer
                  report={run.output}
                  compact
                  downloadFormats
                  onDownloadFormat={handleDownloadFormat}
                />
              ) : (
                <p className="text-[12.5px] leading-relaxed text-ink-muted">
                  Your page will update itself. Leaving is fine — progress is stored on the
                  backend and resumes where it left off.
                </p>
              )}
            </CardBody>
          </Card>
        </Section>
      )}

      {completedReport && !run && trackedProject && (
        <Section className="mt-7" title="Saved blueprint">
          <Card>
            <CardBody>
              <ReportViewer report={completedReport} compact />
            </CardBody>
          </Card>
        </Section>
      )}
    </>
  );
}
