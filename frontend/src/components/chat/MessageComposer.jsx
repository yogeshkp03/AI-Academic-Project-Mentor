import { useState } from 'react';
import { CornerDownLeft, Send } from 'lucide-react';
import { Button } from '../ui';

// Must match the backend's ConversationMessageCreate limit, which is also the
// agents service's question limit. Without this an over-long paste is accepted
// here, persisted, and then rejected downstream.
const MAX_MESSAGE_CHARS = 2000;

export function MessageComposer({ onSend, disabled, busy }) {
  const [text, setText] = useState('');

  const blocked = disabled || busy;
  const tooLong = text.length > MAX_MESSAGE_CHARS;

  const submit = async () => {
    if (!text.trim() || blocked || tooLong) return;
    const value = text.trim();
    setText('');
    try {
      await onSend(value);
    } catch {
      setText(value);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end gap-2.5">
        <div className="relative flex-1">
          <textarea
            rows={1}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              event.target.style.height = 'auto';
              event.target.style.height = `${Math.min(event.target.scrollHeight, 140)}px`;
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="Ask the mentor why the timeline is shaped this way…"
            aria-label="Message"
            disabled={blocked}
            maxLength={MAX_MESSAGE_CHARS}
            className="nice-scroll w-full resize-none rounded-xl border border-line-strong bg-inset px-3.5 py-2.5 text-[14px] leading-relaxed text-ink placeholder:text-ink-faint transition-[border-color,box-shadow,background-color] focus:border-brand-500 focus:bg-surface focus:outline-none focus:ring-3 focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:bg-subtle"
          />
          <span className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 items-center gap-1 text-[11px] text-ink-faint sm:flex">
            <CornerDownLeft size={11} aria-hidden="true" />
            to send
          </span>
        </div>
        <Button
          icon={Send}
          onClick={submit}
          disabled={blocked || tooLong || !text.trim()}
          loading={busy}
          className="h-11"
          aria-label="Send message"
        >
          <span className="hidden sm:inline">Send</span>
        </Button>
      </div>
      <div className="flex items-center justify-between gap-3 text-[11.5px] text-ink-muted">
        <span>Shift + Enter for a new line</span>
        <span className={tooLong ? 'font-semibold text-danger-600' : 'tabular'}>
          {text.length}/{MAX_MESSAGE_CHARS}
        </span>
      </div>
      {tooLong && (
        <p role="alert" className="text-[11.5px] font-semibold text-danger-600">
          That is {text.length - MAX_MESSAGE_CHARS} characters over the limit the mentor accepts.
        </p>
      )}
    </div>
  );
}
