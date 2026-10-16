import { useState } from 'react';
import { Check, Copy, Download, FileDown, FileText, Printer } from 'lucide-react';
import { cn } from '../ui/cn';
import { Button } from './Button';
import { MarkdownContent } from '../chat/MarkdownContent';

/* ==========================================================================
   ReportViewer — renders a blueprint as typographic prose, not a <pre> dump.
   ========================================================================== */
export function ReportViewer({
  report,
  className,
  compact = false,
  actions = true,
  downloadFormats = false,
  onDownloadFormat,
}) {
  const [copied, setCopied] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  if (!report) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — ignore */
    }
  };

  const handleDownload = () => {
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'project-blueprint.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {actions && (
        <div className="flex items-center gap-1.5" data-print-hide>
          <Button size="xs" variant="subtle" icon={copied ? Check : Copy} onClick={handleCopy}>
            {copied ? 'Copied' : 'Copy'}
          </Button>
          {downloadFormats ? (
            <div className="relative">
              <Button
                size="xs"
                variant="subtle"
                icon={Download}
                aria-expanded={downloadMenuOpen}
                aria-haspopup="true"
                onClick={() => setDownloadMenuOpen((open) => !open)}
              >
                Download
              </Button>
              {downloadMenuOpen && (
                <div
                  role="group"
                  aria-label="Choose download format"
                  className="absolute top-full left-0 z-20 mt-1 flex min-w-32 flex-col rounded-lg border border-line bg-surface p-1 shadow-2"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setDownloadMenuOpen(false);
                      onDownloadFormat?.('md');
                    }}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12px] font-semibold text-ink-soft hover:bg-subtle"
                  >
                    <FileText size={13} aria-hidden="true" />
                    Markdown (.md)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDownloadMenuOpen(false);
                      onDownloadFormat?.('pdf');
                    }}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12px] font-semibold text-ink-soft hover:bg-subtle"
                  >
                    <FileDown size={13} aria-hidden="true" />
                    PDF (.pdf)
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Button size="xs" variant="subtle" icon={Download} onClick={handleDownload}>
              Download
            </Button>
          )}
          <Button
            size="xs"
            variant="subtle"
            icon={Printer}
            onClick={() => window.print()}
            className="ml-auto"
          >
            Print
          </Button>
        </div>
      )}
      <article className="paper-sheet rounded-xl border border-line px-6 py-6 sm:px-8">
        <MarkdownContent content={report} compact={compact} />
      </article>
    </div>
  );
}
