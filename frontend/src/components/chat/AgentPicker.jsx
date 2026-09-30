import { Button, Card, Field, Select } from '../ui';
import { AGENTS } from '../../config';

export function AgentPicker({
  projects,
  selectedProjectId,
  agentType,
  onProjectChange,
  onAgentChange,
  onNewChat,
  busy,
}) {
  return (
    <Card className="mb-5">
      <div className="grid items-end gap-4 md:grid-cols-[1fr_1fr_auto]">
        <Field label="Project">
          <Select value={selectedProjectId} onChange={(event) => onProjectChange(event.target.value)}>
            {projects.length === 0 ? (
              <option value="">No projects yet</option>
            ) : (
              projects.map((project) => (
                <option key={project.id} value={project.id}>{project.title}</option>
              ))
            )}
          </Select>
        </Field>
        <Field label="Agent">
          <Select value={agentType} onChange={(event) => onAgentChange(event.target.value)}>
            {AGENTS.map((agent) => (
              <option key={agent.key} value={agent.key}>{agent.label}</option>
            ))}
          </Select>
        </Field>
        <div>
          <Button onClick={onNewChat} disabled={busy || !selectedProjectId} variant="secondary">
            + New Chat
          </Button>
        </div>
      </div>
    </Card>
  );
}