import { BrainCircuit } from 'lucide-react';
import { Button, Card, Field, Select } from '../ui';

export function AgentPicker({
  projects,
  selectedProjectId,
  onProjectChange,
  onNewChat,
  busy,
}) {
  return (
    <Card variant="inset">
      <div className="grid items-end gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Field
          label="Which project are we discussing?"
          htmlFor="workspace-project"
          className="min-w-0"
        >
          <Select
            id="workspace-project"
            value={selectedProjectId}
            onChange={(event) => onProjectChange(event.target.value)}
          >
            {projects.length === 0 ? (
              <option value="">No projects yet</option>
            ) : (
              projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))
            )}
          </Select>
        </Field>
        <Button
          icon={BrainCircuit}
          onClick={onNewChat}
          disabled={busy || !selectedProjectId}
          loading={busy}
        >
          New AI Mentor chat
        </Button>
      </div>
    </Card>
  );
}
