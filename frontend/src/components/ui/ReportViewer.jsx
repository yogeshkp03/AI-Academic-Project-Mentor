import { cn } from '../../lib/cn';

export function ReportViewer({ report, className, onClose }) {
  if (!report) return null;
  return (
    <div className={cn('overflow-hidden', className)}>
      <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-5">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">
          {report}
        </pre>
      </div>
      {onClose && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-200"
          >
            Back to chat
          </button>
        </div>
      )}
    </div>
  );
}