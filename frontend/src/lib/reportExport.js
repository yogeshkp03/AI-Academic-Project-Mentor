import { AGENT_STEP_LABELS } from './agentRuns';

export function getRunReport(run) {
  if (run?.output?.trim()) return run.output.trim();

  return (run?.steps || [])
    .filter((step) => step.output?.trim())
    .map((step) => {
      const label = AGENT_STEP_LABELS.find((item) => item.key === step.step_key)?.label
        || step.step_key;
      return `## ${label}\n\n${step.output.trim()}`;
    })
    .join('\n\n');
}

function safeFilename(value) {
  return value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()
    || 'project-plan';
}

function downloadMarkdown(filename, report) {
  const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${filename}.md`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function pdfLineText(line) {
  return line
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/[→⇒]/g, '->')
    .replace(/[—–]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"');
}

function drawTextLines(pdf, lines, x, y, lineHeight) {
  lines.forEach((line, index) => {
    pdf.text(line, x, y + index * lineHeight);
  });
}

function parseTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => pdfLineText(cell.trim()));
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function drawTable(pdf, rows, layout) {
  const { margin, pageWidth, bottom, getY, setY } = layout;
  const headers = rows[0];
  const body = rows.slice(1);
  const availableWidth = pageWidth - margin * 2;
  const columnWidth = availableWidth / Math.max(1, headers.length);
  const cellPadding = 7;
  const fontSize = 8.5;
  const lineHeight = 11;

  const drawRow = (cells, { header = false, fill = false } = {}) => {
    pdf.setFont('helvetica', header ? 'bold' : 'normal');
    pdf.setFontSize(fontSize);
    const wrapped = headers.map((_, index) =>
      pdf.splitTextToSize(cells[index] || '', columnWidth - cellPadding * 2),
    );
    const rowHeight = Math.max(
      26,
      ...wrapped.map((lines) => lines.length * lineHeight + cellPadding * 2),
    );

    if (getY() + rowHeight > bottom) {
      pdf.addPage();
      setY(margin);
    }
    const rowY = getY();
    if (fill) {
      pdf.setFillColor(244, 247, 249);
      pdf.rect(margin, rowY, availableWidth, rowHeight, 'F');
    }
    pdf.setDrawColor(220, 227, 232);
    pdf.setLineWidth(0.45);
    pdf.line(margin, rowY + rowHeight, pageWidth - margin, rowY + rowHeight);

    wrapped.forEach((cellLines, index) => {
      pdf.setTextColor(header ? 30 : 55, header ? 55 : 67, header ? 78 : 79);
      drawTextLines(
        pdf,
        cellLines,
        margin + index * columnWidth + cellPadding,
        rowY + cellPadding + fontSize,
        lineHeight,
      );
    });
    setY(rowY + rowHeight);
  };

  drawRow(headers, { header: true, fill: true });
  body.forEach((row, index) => drawRow(row, { fill: index % 2 === 1 }));
  setY(getY() + 16);
}

function drawWrappedText(pdf, text, x, y, maxWidth, lineHeight) {
  const lines = pdf.splitTextToSize(text, maxWidth);
  drawTextLines(pdf, lines, x, y, lineHeight);
  return y + lines.length * lineHeight;
}

async function downloadPdf(filename, report, { projectTitle = 'Project Plan', version } = {}) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 54;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const bottom = pageHeight - margin - 28;
  const lineWidth = pageWidth - margin * 2;
  let y = margin;
  const projectName = projectTitle.trim() || 'Project Plan';
  const generatedDate = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  pdf.setProperties({ title: `${projectName} - Plan v${version ?? ''}`.trim() });
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(44, 119, 127);
  pdf.text('AI ACADEMIC PROJECT MENTOR', margin, y + 8);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(21);
  pdf.setTextColor(27, 47, 67);
  y = drawWrappedText(pdf, projectName, margin, y + 34, lineWidth, 26);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(89, 105, 119);
  pdf.text(`Project Plan  ·  Version ${version ?? '-'}  ·  Prepared ${generatedDate}`, margin, y + 4);
  y += 24;
  pdf.setDrawColor(44, 119, 127);
  pdf.setLineWidth(1.2);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 30;

  const startNewPage = () => {
    pdf.addPage();
    y = margin + 8;
  };
  const ensureSpace = (height) => {
    if (y + height > bottom) startNewPage();
  };
  const layout = {
    margin,
    pageWidth,
    bottom,
    getY: () => y,
    setY: (next) => {
      y = next;
    },
  };

  const lines = report.split(/\r?\n/);
  let index = 0;
  while (index < lines.length) {
    const rawLine = lines[index].trim();
    if (!rawLine) {
      y += 5;
      index += 1;
      continue;
    }

    if (rawLine.startsWith('|') && lines[index + 1] && isTableSeparator(lines[index + 1])) {
      const tableRows = [parseTableRow(rawLine)];
      index += 2;
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        tableRows.push(parseTableRow(lines[index]));
        index += 1;
      }
      ensureSpace(40);
      drawTable(pdf, tableRows, layout);
      continue;
    }

    const heading = rawLine.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const text = pdfLineText(heading[2]).trim();
      const fontSize = level === 1 ? 18 : level === 2 ? 14 : 11;
      const spacingBefore = level === 1 ? 20 : level === 2 ? 15 : 10;
      ensureSpace(fontSize + spacingBefore + 18);
      y += spacingBefore;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(fontSize);
      pdf.setTextColor(level === 1 ? 27 : 44, level === 1 ? 47 : 76, level === 1 ? 67 : 91);
      y = drawWrappedText(pdf, text, margin, y + fontSize, lineWidth, fontSize + 5) + 3;
      index += 1;
      continue;
    }

    const bullet = rawLine.match(/^([-*+]|\d+[.)])\s+(.+)$/);
    const text = pdfLineText(bullet ? bullet[2] : rawLine).trim();
    const indent = bullet ? 18 : 0;
    const prefix = bullet
      ? (/^\d/.test(bullet[1]) ? `${bullet[1]} ` : '\u2022 ')
      : '';
    const fontSize = 9.5;
    const lineHeight = 14;
    const x = margin + indent;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(fontSize);
    const prefixWidth = prefix ? pdf.getTextWidth(prefix) + 3 : 0;
    const wrapped = pdf.splitTextToSize(text, lineWidth - indent - prefixWidth);
    ensureSpace(wrapped.length * lineHeight + 4);
    if (prefix) {
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(44, 119, 127);
      pdf.text(prefix, x, y);
      pdf.setFont('helvetica', 'normal');
    }
    pdf.setTextColor(49, 61, 72);
    drawTextLines(pdf, wrapped, x + prefixWidth, y, lineHeight);
    y += wrapped.length * lineHeight + (bullet ? 3 : 5);
    index += 1;
  }

  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(110, 122, 132);
    pdf.text(`${projectName}  ·  Plan v${version ?? '-'}`, margin, pageHeight - 22);
    pdf.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 22, {
      align: 'right',
    });
  }

  pdf.save(`${filename}.pdf`);
}

export async function downloadRunReport(run, format, options = {}) {
  const report = getRunReport(run);
  if (!report) throw new Error('No saved report is available to download yet.');

  const filename = safeFilename(`project-plan-v${run.version}`);
  if (format === 'md') {
    downloadMarkdown(filename, report);
    return;
  }
  if (format === 'pdf') {
    await downloadPdf(filename, report, { ...options, version: run.version });
    return;
  }
  throw new Error(`Unsupported report format: ${format}`);
}
