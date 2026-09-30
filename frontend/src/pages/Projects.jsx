import { useState } from 'react';
import { useAuth } from '../context/useAuth';
import { useProjects } from '../hooks/useProjects';
import { useAgentRuns, isPollAborted } from '../hooks/useAgentRuns';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Message,
  PageHeader,
  ReportViewer,
  Spinner,
  Textarea,
} from '../components/ui';

function Projects() {
  const { studentId } = useAuth();
  const { projects, loading, createProject, refetch, setError } = useProjects(studentId);
  const { startAnalysis, pollUntilDone } = useAgentRuns(null);

  const [title, setTitle] = useState('');
  const [idea, setIdea] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [analyzingProjectId, setAnalyzingProjectId] = useState(null);
  const [message, setMessage] = useState(null);
  const [selectedReport, setSelectedReport] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!title.trim() || !idea.trim()) {
      setMessage({ type: 'error', text: 'Please enter the project title and idea.' });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await createProject({ title, idea });
      setTitle('');
      setIdea('');
      setMessage({ type: 'success', text: 'Project submitted. Click Analyze to generate the AI report.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnalyze = async (projectId) => {
    setAnalyzingProjectId(projectId);
    setMessage(null);
    try {
      const run = await startAnalysis(projectId);
      setMessage({ type: 'info', text: `Analysis started for project #${projectId}. Generating blueprint...` });
      const completedRun = await pollUntilDone(run.id, { targetProjectId: projectId });
      setMessage({ type: 'success', text: 'Analysis finished. The report has been saved to this project.' });
      if (completedRun?.output) setSelectedReport(completedRun.output);
      await refetch();
    } catch (error) {
      // A cancelled poll is normal, not a failure worth showing the user.
      if (isPollAborted(error)) return;
      setError(error.message);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setAnalyzingProjectId(null);
    }
  };

  return (
    <>
      <PageHeader title="My Projects" subtitle="Create and manage your academic projects." />

      {message?.text && <Message type={message.type} className="mb-4" onDismiss={() => setMessage(null)}>{message.text}</Message>}

      <Card title="Create New Project">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Student ID" hint="Assigned to your account automatically.">
            <Input type="number" min="1" value={studentId} readOnly />
          </Field>
          <Field label="Project Title">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Enter your project title" required />
          </Field>
          <Field label="Project Idea">
            <Textarea value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="Describe your project idea..." rows={5} required />
          </Field>
          <div>
            <Button type="submit" loading={submitting} className="w-fit">
              {submitting ? 'Submitting...' : 'Submit Project'}
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Submitted Projects" className="mt-6">
        {loading ? (
          <div className="flex justify-center py-10 text-brand-600">
            <Spinner />
          </div>
        ) : projects.length === 0 ? (
          <EmptyState icon="📁" title="No projects submitted yet" message="Use the form above to create your first project." />
        ) : (
          <div className="flex flex-col gap-4">
            {projects.map((project) => (
              <div key={project.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 transition hover:border-slate-200 hover:bg-white">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-slate-900">{project.title}</h3>
                    <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{project.idea}</p>
                    <span className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${project.ai_report ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      Status: {project.status || 'submitted'}
                    </span>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" onClick={() => handleAnalyze(project.id)} disabled={analyzingProjectId === project.id} loading={analyzingProjectId === project.id}>
                      {analyzingProjectId === project.id ? 'Analyzing...' : 'AI Analyze'}
                    </Button>
                    {project.ai_report && (
                      <Button size="sm" variant="secondary" onClick={() => setSelectedReport(project.ai_report)}>
                        View AI Report
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {selectedReport && (
        <Card
          title="AI Project Analysis"
          className="mt-6"
          actions={<Button size="sm" variant="secondary" onClick={() => setSelectedReport('')}>Close</Button>}
        >
          <ReportViewer report={selectedReport} />
        </Card>
      )}
    </>
  );
}

export default Projects;