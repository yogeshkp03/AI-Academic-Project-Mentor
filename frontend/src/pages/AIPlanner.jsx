import { useState } from 'react';
import { useAuth } from '../context/useAuth';
import { useProjects } from '../hooks/useProjects';
import { useAgentRuns, isPollAborted } from '../hooks/useAgentRuns';
import {
  Button,
  Card,
  Field,
  Input,
  Message,
  PageHeader,
  ProgressBar,
  ReportViewer,
  Select,
  Spinner,
  Textarea,
} from '../components/ui';
import { statusLabel } from '../lib/format';
import { isActiveStatus } from '../lib/format';

const DURATIONS = ['1 Month', '2 Months', '3 Months', '6 Months'];

function AIPlanner() {
  const { studentId } = useAuth();
  const { createProject } = useProjects(studentId);
  const { startAnalysis, pollUntilDone } = useAgentRuns(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [techStack, setTechStack] = useState('');
  const [duration, setDuration] = useState(DURATIONS[1]);
  const [loading, setLoading] = useState(false);
  const [run, setRun] = useState(null);
  const [completedReport, setCompletedReport] = useState('');
  const [message, setMessage] = useState(null);

  const handleGenerate = async (event) => {
    event.preventDefault();
    if (!title.trim() || !description.trim()) {
      setMessage({ type: 'error', text: 'Please enter at least a project title and description.' });
      return;
    }
    setLoading(true);
    setRun(null);
    setCompletedReport('');
    setMessage(null);
    try {
      const project = await createProject({ title, idea: description, technology_stack: techStack, duration });
      const startedRun = await startAnalysis(project.id);
      setRun(startedRun);
      const finishedRun = await pollUntilDone(startedRun.id, { targetProjectId: project.id });
      setRun(finishedRun);
      if (finishedRun.output) setCompletedReport(finishedRun.output);
      setMessage({ type: 'success', text: 'Analysis finished and was saved to this project.' });
    } catch (error) {
      // A cancelled poll is normal, not a failure worth showing the user.
      if (isPollAborted(error)) return;
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader title="AI Project Planner 🤖" subtitle="Generate an intelligent academic project plan based on your tech stack and duration." />

      {message?.text && <Message type={message.type} className="mb-4" onDismiss={() => setMessage(null)}>{message.text}</Message>}

      <Card title="Describe your project">
        <form onSubmit={handleGenerate} className="flex flex-col gap-4">
          <Field label="Project Title">
            <Input placeholder="Enter project title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </Field>
          <Field label="Project Description">
            <Textarea rows={5} placeholder="Describe your project..." value={description} onChange={(event) => setDescription(event.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Available Technologies">
              <Input placeholder="e.g. React, Python, TensorFlow, MongoDB" value={techStack} onChange={(event) => setTechStack(event.target.value)} />
            </Field>
            <Field label="Project Duration">
              <Select value={duration} onChange={(event) => setDuration(event.target.value)}>
                {DURATIONS.map((option) => <option key={option}>{option}</option>)}
              </Select>
            </Field>
          </div>
          <div>
            <Button type="submit" size="lg" loading={loading}>
              {loading ? 'Analyzing...' : '✨ Generate AI Plan'}
            </Button>
          </div>
        </form>
      </Card>

      {run && (
        <Card title="Analysis Status" className="mt-6">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-slate-600">
              {statusLabel(run.status)}
            </span>
            {isActiveStatus(run.status) ? (
              <div className="flex flex-1 items-center gap-3">
                <ProgressBar value={35} className="flex-1" />
                <span className="text-brand-600"><Spinner className="size-4" /></span>
              </div>
            ) : (
              <ProgressBar value={run.status === 'completed' ? 100 : 40} className="flex-1" />
            )}
          </div>
          <p className="mt-3 text-sm text-slate-500">
            {isActiveStatus(run.status) ? 'Working with the agent team to build your blueprint...' : `Analysis ${run.status}.`}
          </p>
        </Card>
      )}

      {completedReport && (
        <Card title="Saved AI Analysis" className="mt-6">
          <ReportViewer report={completedReport} />
        </Card>
      )}
    </>
  );
}

export default AIPlanner;