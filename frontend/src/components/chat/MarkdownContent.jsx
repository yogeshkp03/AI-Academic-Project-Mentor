import { useMemo } from 'react';
import { cn } from '../ui/cn';

/* ==========================================================================
   MarkdownContent — safe, hand-built renderer for AI reports and chat.
   No dangerouslySetInnerHTML: content is parsed into React elements.
   ========================================================================== */

function parseInline(text, keyPrefix) {
  // Split on bold, italic, inline code and links, keeping the delimiters
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
  return parts.filter(Boolean).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (/^\*\*[^*]+\*\*$/.test(part) || /^__[^_]+__$/.test(part)) {
      return (
        <strong key={key}>{part.slice(2, -2)}</strong>
      );
    }
    if (/^`[^`]+`$/.test(part)) {
      return <code key={key}>{part.slice(1, -1)}</code>;
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const [, label, href] = link;
      const isSafe = /^https?:\/\//i.test(href) || href.startsWith('/') || href.startsWith('#');
      return isSafe ? (
        <a key={key} href={href} target="_blank" rel="noopener noreferrer">
          {label}
        </a>
      ) : (
        <span key={key}>{label}</span>
      );
    }
    // *italic* (single asterisk, not inside bold)
    const italics = part.split(/(\*[^*\n]+\*)/g);
    return italics.filter(Boolean).map((seg, j) => {
      if (/^\*[^*\n]+\*$/.test(seg)) {
        return <em key={`${key}-${j}`}>{seg.slice(1, -1)}</em>;
      }
      return <span key={`${key}-${j}`}>{seg}</span>;
    });
  });
}

/** Extract fenced code blocks and their captions from the source. */
function splitBlocks(source) {
  const lines = String(source || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const fence = lines[i].match(/^```(\w*)\s*$/);
    if (fence) {
      const lang = fence[1] || '';
      const body = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push({ type: 'code', lang, text: body.join('\n') });
      continue;
    }
    blocks.push({ type: 'text', line: lines[i] });
    i += 1;
  }
  return blocks;
}

export function MarkdownContent({ content, compact = false, className }) {
  const blocks = useMemo(() => splitBlocks(content), [content]);

  // Group text lines into paragraphs / lists, then render
  const elements = [];
  let textBuffer = [];
  let listType = null;
  let listBuffer = [];
  let key = 0;

  const flushText = () => {
    if (!textBuffer.length) return;
    const para = textBuffer.join('\n').trim();
    textBuffer = [];
    if (!para) return;
    elements.push(<p key={`p-${key++}`}>{parseInline(para, `p${key}`)}</p>);
  };

  const flushList = () => {
    if (!listBuffer.length) return;
    const items = listBuffer;
    const type = listType;
    listBuffer = [];
    listType = null;
    const items$ = items.map((item, idx) => (
      <li key={`li-${idx}`}>{parseInline(item, `li${idx}`)}</li>
    ));
    elements.push(
      type === 'ol' ? (
        <ol key={`l-${key++}`}>{items$}</ol>
      ) : (
        <ul key={`l-${key++}`}>{items$}</ul>
      ),
    );
  };

  const flushAll = () => {
    flushList();
    flushText();
  };

  for (const block of blocks) {
    if (block.type === 'code') {
      flushAll();
      elements.push(
        <div key={`c-${key++}`} className="group/code relative">
          <pre>
            <code>{block.text}</code>
          </pre>
        </div>,
      );
      continue;
    }

    const line = block.line;
    const trimmed = line.trim();

    if (!trimmed) {
      flushAll();
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushAll();
      const level = heading[1].length;
      const Tag = `h${Math.min(level, 4)}`;
      elements.push(
        <Tag key={`h-${key++}`}>{parseInline(heading[2], `h${key}`)}</Tag>,
      );
      continue;
    }

    if (/^(---|\*\*\*|___)\s*$/.test(trimmed)) {
      flushAll();
      elements.push(<hr key={`hr-${key++}`} />);
      continue;
    }

    const ul = trimmed.match(/^[-*•]\s+(.*)$/);
    const ol = trimmed.match(/^\d+[.)]\s+(.*)$/);
    const quote = trimmed.match(/^>\s+(.*)$/);

    if (ul) {
      flushText();
      if (listType && listType !== 'ul') flushList();
      listType = 'ul';
      listBuffer.push(ul[1]);
      continue;
    }
    if (ol) {
      flushText();
      if (listType && listType !== 'ol') flushList();
      listType = 'ol';
      listBuffer.push(ol[1]);
      continue;
    }
    if (quote) {
      flushAll();
      elements.push(
        <blockquote key={`q-${key++}`}>{parseInline(quote[1], `q${key}`)}</blockquote>,
      );
      continue;
    }

    flushList();
    textBuffer.push(trimmed);
  }
  flushAll();

  return <div className={cn('prose', compact && 'prose-compact', className)}>{elements}</div>;
}
