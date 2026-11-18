// ============================================================================
// docExport — One-click PPTX / DOCX / PDF export from Markdown responses (10C)
// ============================================================================

export type ExportFormat = 'pptx' | 'docx' | 'pdf';

export interface ExportSection {
  title: string;
  bullets: string[];
}

interface PptxApi {
  write: (options: { outputType: 'blob' }) => Promise<Blob>;
  writeFile: (options: { fileName: string }) => Promise<void>;
  defineLayout: (layout: { name: string; width: number; height: number }) => void;
  layout: string;
  addSlide: () => PptxSlide;
}

interface PptxSlide {
  addText: (text: string, options: Record<string, unknown>) => void;
}

interface DocxParagraphLike {
  new (options: { text: string; heading?: import('docx').HeadingLevel; bullet?: { level: number } }): unknown;
}

export function splitMarkdownSections(markdown: string): ExportSection[] {
  const lines = markdown.split('\n');
  const sections: ExportSection[] = [];
  let current: ExportSection | null = null;

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      if (current) sections.push(current);
      current = { title: headingMatch[2].trim(), bullets: [] };
    } else if (current) {
      const cleaned = line.replace(/^[-*•]\s*/, '').replace(/\*\*/g, '').trim();
      if (cleaned.length > 0) current.bullets.push(cleaned);
    } else if (line.trim().length > 0 && sections.length === 0) {
      current = { title: line.trim().slice(0, 80), bullets: [] };
    }
  }
  if (current) sections.push(current);
  return sections.length > 0 ? sections : [{ title: 'Document', bullets: markdown.split('\n').map((l) => l.replace(/[#*]/g, '').trim()).filter(Boolean) }];
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// PPTX
// ---------------------------------------------------------------------------

export async function exportPptx(title: string, markdown: string): Promise<void> {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS() as unknown as PptxApi;
  pptx.defineLayout({ name: 'OMNIFREE', width: 13.33, height: 7.5 });
  pptx.layout = 'OMNIFREE';

  const sections = splitMarkdownSections(markdown);
  const titleSlide = pptx.addSlide();
  titleSlide.addText(title, { x: 0.8, y: 3, w: 11.7, h: 1.2, fontSize: 36, bold: true, color: '1A1A2E' });

  for (const section of sections) {
    const slide = pptx.addSlide();
    slide.addText(section.title, { x: 0.8, y: 0.5, w: 11.7, h: 0.9, fontSize: 28, bold: true, color: '1A1A2E' });
    const body = section.bullets.slice(0, 6).map((b) => `• ${b.slice(0, 110)}`).join('\n');
    slide.addText(body || ' ', { x: 0.8, y: 1.6, w: 11.7, h: 5, fontSize: 16, color: '333344' });
  }

  const blob = await pptx.write({ outputType: 'blob' });
  triggerDownload(blob, 'presentation.pptx');
}

// ---------------------------------------------------------------------------
// DOCX
// ---------------------------------------------------------------------------

export async function exportDocx(title: string, markdown: string): Promise<void> {
  const { Document, Packer, Paragraph, HeadingLevel } = await import('docx');
  const sections = splitMarkdownSections(markdown);

  const children: Array<InstanceType<typeof Paragraph>> = [
    new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
  ];
  for (const section of sections) {
    children.push(new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_1 }));
    for (const bullet of section.bullets) {
      children.push(new Paragraph({ text: bullet, bullet: { level: 0 } }));
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 22 } },
      },
    },
    sections: [{ properties: {}, children }],
  });
  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, 'document.docx');
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

export async function exportPdf(title: string, markdown: string): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 56;
  const maxWidth = pageWidth - margin * 2;

  let y = margin;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  const titleLines = pdf.splitTextToSize(title, maxWidth) as string[];
  for (const line of titleLines) {
    pdf.text(line, margin, y);
    y += 28;
  }
  y += 10;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);

  const plain = markdown.replace(/[#*_`>]/g, '').replace(/\n{3,}/g, '\n\n');
  const paragraphs = plain.split('\n');

  for (const paragraph of paragraphs) {
    if (paragraph.trim().length === 0) {
      y += 10;
      continue;
    }
    const lines = pdf.splitTextToSize(paragraph.trim(), maxWidth) as string[];
    for (const line of lines) {
      if (y > pageHeight - margin) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(line, margin, y);
      y += 16;
    }
    y += 6;
  }

  pdf.save('document.pdf');
}

export async function exportDocument(format: ExportFormat, title: string, markdown: string): Promise<void> {
  switch (format) {
    case 'pptx': return exportPptx(title, markdown);
    case 'docx': return exportDocx(title, markdown);
    case 'pdf': return exportPdf(title, markdown);
  }
}
