import { cn } from '../../lib/cn';

export function ChatThread({ messages, selectedReport, onCloseReport }) {
  if (selectedReport) {
    return (
      <div className="overflow-hidden">
        <div className="max-h-[55vh] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-5">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">
            {selectedReport}
          </pre>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onCloseReport}
            className="cursor-pointer rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-200"
          >
            Back to chat
          </button>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center">
        <p className="max-w-xs text-sm text-slate-400">
          Choose an existing chat or create a new one to start a conversation.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {messages.map((item) => (
        <div
          key={item.id}
          className={cn(
            'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm',
            item.role === 'user'
              ? 'self-end rounded-br-md bg-brand-600 text-white'
              : 'self-start rounded-bl-md border border-slate-100 bg-brand-50 text-slate-700',
          )}
        >
          <span className={cn('mb-1 block text-[10px] font-bold uppercase tracking-wide', item.role === 'user' ? 'text-white/70' : 'text-brand-500')}>
            {item.role === 'user' ? 'You' : 'AI'}
          </span>
          {item.message}
        </div>
      ))}
    </div>
  );
}