import { cn } from '../../lib/cn';

export function ConversationList({ conversations, selectedId, onSelect, onRename, onDelete }) {
  if (conversations.length === 0) {
    return <p className="py-4 text-center text-sm text-slate-400">No chats for this project yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {conversations.map((conversation) => {
        const active = String(conversation.id) === String(selectedId);
        return (
          <li
            key={conversation.id}
            className={cn(
              'group flex items-center gap-1 rounded-xl border px-3 py-2.5 transition',
              active
                ? 'border-brand-200 bg-brand-50'
                : 'border-transparent hover:border-slate-200 hover:bg-slate-50',
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(conversation.id)}
              className={cn(
                'min-w-0 flex-1 cursor-pointer truncate text-left text-sm font-medium',
                active ? 'text-brand-700' : 'text-slate-700',
              )}
              title={conversation.title}
            >
              {conversation.title}
            </button>
            <button
              type="button"
              aria-label="Rename"
              title="Rename"
              onClick={() => onRename(conversation)}
              className="shrink-0 cursor-pointer rounded-md px-1.5 py-0.5 text-xs text-slate-400 opacity-0 transition hover:bg-white hover:text-slate-600 group-hover:opacity-100"
            >
              ✎
            </button>
            <button
              type="button"
              aria-label="Delete"
              title="Delete"
              onClick={() => onDelete(conversation.id)}
              className="shrink-0 cursor-pointer rounded-md px-1.5 py-0.5 text-xs text-slate-400 opacity-0 transition hover:bg-white hover:text-red-500 group-hover:opacity-100"
            >
              ✕
            </button>
          </li>
        );
      })}
    </ul>
  );
}