import { useState } from 'react';
import { Button, Input } from '../ui';

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
      <div className="flex gap-2.5">
        <Input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Ask the selected agent..."
          aria-label="Message"
          disabled={blocked}
          maxLength={MAX_MESSAGE_CHARS}
          className="flex-1"
        />
        <Button onClick={submit} disabled={blocked || tooLong} loading={busy}>
          {busy ? 'Sending...' : 'Send'}
        </Button>
      </div>
      {tooLong && (
        <p role="alert" className="text-xs text-red-600">
          Message is {text.length - MAX_MESSAGE_CHARS} characters over the limit.
        </p>
      )}
    </div>
  );
}