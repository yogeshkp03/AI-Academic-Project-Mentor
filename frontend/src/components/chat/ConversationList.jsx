import { MessagesSquare, Pencil, Trash2 } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Badge } from '../ui';

const SPECIALIST_LABELS = {
  feasibility: 'Feasibility',
  architect: 'Architecture',
  scope: 'Scope',
  timeline: 'Timeline',
  ui_ux: 'UI/UX',
  planning: 'Planning',
  professor: 'Professor QA',
  resource: 'Resources',
  mentor: 'AI Mentor',
};

export function ConversationList({ conversations, selectedId, onSelect, onRename, onDelete }) {
  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <span className="grid size-10 place-items-center rounded-xl border border-line bg-subtle text-ink-faint">
          <MessagesSquare size={17} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <p className="text-[13px] font-semibold text-ink-soft">No conversations yet</p>
        <p className="max-w-44 text-[12px] leading-relaxed text-ink-muted">
          Start a mentor chat, or open a specialist report on the right.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {conversations.map((conversation) => {
        const active = String(conversation.id) === String(selectedId);
        const agent = conversation.agent_type || 'mentor';
        return (
          <li key={conversation.id}>
            <div
              className={cn(
                'group relative flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors',
                active
                  ? 'border-brand-200 bg-brand-50'
                  : 'border-transparent hover:border-line hover:bg-subtle/60',
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(conversation.id)}
                className="min-w-0 flex-1 cursor-pointer border-none bg-transparent p-0 text-left"
                title={conversation.title}
              >
                <span
                  className={cn(
                    'block truncate text-[13.5px] font-semibold',
                    active ? 'text-brand-700' : 'text-ink',
                  )}
                >
                  {conversation.title}
                </span>
                <span className="mt-1 flex items-center gap-1.5">
                  <Badge tone={agent === 'mentor' ? 'brand' : 'ochare'}>
                    {SPECIALIST_LABELS[agent] || agent}
                  </Badge>
                </span>
              </button>

              <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <button
                  type="button"
                  aria-label={`Rename ${conversation.title}`}
                  title="Rename"
                  onClick={() => onRename(conversation)}
                  className="cursor-pointer rounded-md p-1.5 text-ink-faint transition-colors hover:bg-surface hover:text-ink-soft"
                >
                  <Pencil size={13} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${conversation.title}`}
                  title="Delete"
                  onClick={() => onDelete(conversation.id)}
                  className="cursor-pointer rounded-md p-1.5 text-ink-faint transition-colors hover:bg-danger-50 hover:text-danger-600"
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
