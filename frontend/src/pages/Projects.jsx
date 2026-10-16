import { useState } from 'react';
import {
  BrainCircuit,
  FileText,
  FolderPlus,
  Layers,
  Play,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { useProjects } from '../hooks/useProjects';
import { useAgentRuns, useAllRuns } from '../hooks/useAgentRuns';
import { latestRunFor, toStepRail } from '../lib/agentRuns';
import {
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Message,
  Modal,
  PageHeader,
  ReportViewer,
  Section,
  Skeleton,
  StatusBadge,
  StepRail,
  Textarea,
  useToast,
} from '../components/ui';

/**
 * Shared step labels for the eight analysis stages.
 * Single source of truth for pages that render agent progress.
 */

export default function Projects() {
  const { studentId } = useAuth();
  const toast = useToast();
  const {
    projects,
    loading,
    error: projectsError,
    createProject,
    deleteProject,
    refetch: refetchProjects,
  } = useProjects(studentId);
  const { startAnalysis } = useAgentRuns(null);
  const { runs, error: runsError, refetch: refetchRuns, setRuns } = useAllRuns(studentId);

  const [title, setTitle] = useState('');
  const [idea, setIdea] = useState('');
  const [showComposer, setShowComposer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [analyzingProjectId, setAnalyzingProjectId] = useState(null);
  const [message, setMessage] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingProjectId, setDeletingProjectId] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!title.trim() || !idea.trim()) {
      setMessage({ type: 'error', text: 'A title and a one-paragraph idea are both needed.' });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await createProject({ title, idea });
      setTitle('');
      setIdea('');
      setShowComposer(false);
      setMessage({
        type: 'success',
        text: 'Project submitted. Run an analysis to get its blueprint.',
      });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnalyze = async (project) => {
    setAnalyzingProjectId(project.id);
    setMessage(null);
    try {
      const run = await startAnalysis(project.id);
      setRuns((previous) => [run, ...previous.filter((item) => item.id !== run.id)]);
      setSelectedReport(null);
      toast.info('The specialist team picked it up. This page updates itself.', 'Analysis queued');
      await refetchRuns();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setAnalyzingProjectId(null);
    }
  };

  const handleDeleteProject = async () => {
    if (!deleteTarget) return;
    setDeletingProjectId(deleteTarget.id);
    setDeleteError('');
    try {
      await deleteProject(deleteTarget.id);
      setRuns((previous) => previous.filter((run) => run.project_id !== deleteTarget.id));
      setSelectedReport(null);
      setMessage({
        type: 'success',
        text: `"${deleteTarget.title}" and everything attached to it has been removed.`,
      });
      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(error.message);
    } finally {
      setDeletingProjectId(null);
    }
  };

  const isBlocked = (project) =>
    runs.some(
      (run) =>
        run.project_id === project.id && (run.status === 'queued' || run.status === 'running'),
    );

  return (
    <>
      <PageHeader
        eyebrow="Projects"
        title="Your projects"
        subtitle="One idea at a time. Each project gets its own specialist team, milestones and mentor conversations."
        actions={
          <Button icon={FolderPlus} onClick={() => setShowComposer(true)}>
            New project
          </Button>
        }
      >
        {/* Inline composer, revealed on demand */}
        {showComposer && (
          <Card variant="inset" className="animate-pop mt-2">
            <CardHeader
              icon={FolderPlus}
              title="Describe the project"
              subtitle="The specialists read exactly this, so write it as you would explain it to your guide."
              actions={
                <Button
                  size="xs"
                  variant="subtle"
                  onClick={() => setShowComposer(false)}
                  aria-label="Close the composer"
                >
                  Cancel
                </Button>
              }
            />
            <CardBody>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Field
                  label="Project title"
                  htmlFor="project-title"
                  hint="Short and specific — 'Attendance app for labs', not 'My final year project'."
                >
                  <Input
                    id="project-title"
                    placeholder="Attendance tracking app for labs"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    required
                  />
                </Field>
                <Field
                  label="Project idea"
                  htmlFor="project-idea"
                  hint="One solid paragraph. What it does, who uses it, what makes it feasible in your timeframe."
                >
                  <Textarea
                    id="project-idea"
                    rows={6}
                    placeholder="A web app where lab assistants mark attendance with a QR code..."
                    value={idea}
                    onChange={(event) => setIdea(event.target.value)}
                    required
                  />
                </Field>
                <div className="flex items-center justify-between gap-3">
                  <p className="hidden text-[12px] text-ink-muted sm:block">
                    Student #{studentId} · recorded on your account
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setShowComposer(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" loading={submitting}>
                      {submitting ? 'Saving…' : 'Create project'}
                    </Button>
                  </div>
                </div>
              </form>
            </CardBody>
          </Card>
        )}
      </PageHeader>

      {message?.text && (
        <Message type={message.type} className="my-4">
          {message.text}
        </Message>
      )}
      {(projectsError || runsError) && (
        <Message type="warning" className="my-4">
          {projectsError?.message ||
            runsError?.message ||
            'Some analysis history could not be loaded. Everything else is still accurate.'}
          <button
            type="button"
            onClick={() => Promise.allSettled([refetchProjects(), refetchRuns()])}
            className="ml-1 cursor-pointer bg-transparent p-0 font-bold underline"
          >
            Try again
          </button>
        </Message>
      )}

      {loading && projects.length === 0 ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="mt-2.5 h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-4/5" />
              <Skeleton className="mt-4 h-1.5 w-full" />
            </Card>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <Section className="mt-8">
          <EmptyState
            icon={FileText}
            eyebrow="Nothing here yet"
            title="Your first project is one paragraph away"
            message="Write the idea, then run an analysis. You will get a feasibility report, an architecture, and milestones you can check off — usually in about two minutes."
            action={
              <Button icon={FolderPlus} onClick={() => setShowComposer(true)}>
                Describe my project
              </Button>
            }
          />
        </Section>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {projects.map((project) => {
            const latestRun = latestRunFor(runs, project.id);
            const active = latestRun?.status === 'queued' || latestRun?.status === 'running';
            const report = latestRun?.output || project.ai_report;
            const analyzed = Boolean(report) || latestRun?.status === 'completed';

            return (
              <Card
                key={project.id}
                hover
                className="flex flex-col transition-[box-shadow,transform,border-color] duration-300 hover:-translate-y-0.5"
              >
                <CardHeader
                  eyebrow={`Project #${project.id}`}
                  title={project.title}
                  subtitle={
                    <span className="line-clamp-2">{project.idea}</span>
                  }
                  icon={Layers}
                  actions={
                    <StatusBadge status={latestRun?.status || (analyzed ? 'completed' : 'queued')}>
                      {analyzed && !latestRun ? 'Blueprinted' : undefined}
                    </StatusBadge>
                  }
                />

                <CardBody className="flex-1">
                  {latestRun?.steps?.length > 0 ? (
                    <StepRail steps={toStepRail(latestRun)} />
                  ) : (
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-subtle-strong">
                      <div
                        className={`h-full rounded-full ${analyzed ? 'w-full bg-success-500' : 'w-0'}`}
                      />
                    </div>
                  )}

                  <dl className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] text-ink-muted">
                    <div className="flex items-center gap-1.5">
                      <dt className="sr-only">Version</dt>
                      <dd className="tabular">
                        v{latestRun?.version ?? 1}
                      </dd>
                    </div>
                    {project.duration && (
                      <div className="flex items-center gap-1.5">
                        <dt className="sr-only">Duration</dt>
                        <dd>{project.duration}</dd>
                      </div>
                    )}
                    {project.technology_stack && (
                      <div className="flex items-center gap-1.5">
                        <dt className="sr-only">Stack</dt>
                        <dd className="max-w-48 truncate">{project.technology_stack}</dd>
                      </div>
                    )}
                    {latestRun?.duration_ms ? (
                      <div className="flex items-center gap-1.5">
                        <dt className="sr-only">Duration</dt>
                        <dd className="tabular">
                          {(latestRun.duration_ms / 1000 / 60).toFixed(1)} min
                        </dd>
                      </div>
                    ) : null}
                  </dl>

                  {latestRun?.error_message && (
                    <p className="mt-3 rounded-lg bg-danger-50 px-3 py-2 text-[12px] leading-relaxed text-danger-700">
                      {latestRun.error_message}
                    </p>
                  )}
                </CardBody>

                <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3.5">
                  <Button
                    size="sm"
                    icon={Play}
                    loading={analyzingProjectId === project.id}
                    disabled={active}
                    onClick={() => handleAnalyze(project)}
                    title={
                      active
                        ? 'An analysis is already working on this project'
                        : 'Run the specialist team on this project'
                    }
                  >
                    {active
                      ? 'Working…'
                      : latestRun?.status === 'failed'
                        ? 'Retry analysis'
                        : analyzed
                          ? 'Analyse again'
                          : 'Run analysis'}
                  </Button>

                  {report && (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={FileText}
                      onClick={() => setSelectedReport({ project, report })}
                    >
                      Read blueprint
                    </Button>
                  )}

                  {analyzed && (
                    <ButtonLink size="sm" variant="subtle" to="/ai-mentor">
                      Ask a specialist
                    </ButtonLink>
                  )}

                  <Button
                    size="sm"
                    variant="ghostDanger"
                    className="ml-auto"
                    icon={Trash2}
                    disabled={isBlocked(project) || deletingProjectId === project.id}
                    onClick={() => {
                      setDeleteError('');
                      setDeleteTarget(project);
                    }}
                    aria-label={`Delete ${project.title}`}
                    title={
                      isBlocked(project)
                        ? 'Wait for the running analysis to finish first'
                        : 'Delete this project and everything attached to it'
                    }
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Blueprint reader */}
      <Modal
        open={Boolean(selectedReport)}
        onClose={() => setSelectedReport(null)}
        title={`${selectedReport?.project?.title} — blueprint`}
        description="The combined verdict from all eight specialists."
        icon={BrainCircuit}
        width="xl"
        footer={
          <Button variant="secondary" onClick={() => setSelectedReport(null)}>
            Close
          </Button>
        }
      >
        <div className="nice-scroll max-h-[65vh] overflow-y-auto py-2">
          <ReportViewer report={selectedReport?.report} actions={false} compact />
        </div>
      </Modal>

      {/* Delete gate */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteProject}
        title="Delete this project for good?"
        description={
          <>
            <strong className="text-ink">{deleteTarget?.title}</strong> and everything attached
            to it — analyses, specialist outputs, milestones, conversations and check-ins — will
            be permanently removed. This cannot be undone.
          </>
        }
        confirmLabel="Delete permanently"
        icon={Trash2}
        loading={Boolean(deletingProjectId)}
      >
        {deleteError && (
          <p className="mb-3 rounded-lg bg-danger-50 px-3 py-2 text-[13px] font-medium text-danger-700">
            {deleteError}
          </p>
        )}
        {deleteTarget && isBlocked(deleteTarget) && (
          <p className="mb-3 rounded-lg bg-warning-50 px-3 py-2 text-[13px] font-medium text-warning-700">
            An analysis is running on this project right now. Wait for it to finish — deleting
            mid-run would leave it half-written.
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}
