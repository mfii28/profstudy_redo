/**
 * Client-side text extraction for tutor RAG uploads (PDF / DOCX / TXT).
 * Used only from browser components — do not import from server-only modules.
 */

export async function extractPlainTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.txt')) {
    return (await file.text()).trim();
  }

  if (name.endsWith('.docx')) {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return (result.value || '').trim();
  }

  if (name.endsWith('.pdf')) {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();

    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    let full = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const line = textContent.items
        .map(item => ('str' in item ? String((item as { str: string }).str) : ''))
        .filter(Boolean)
        .join(' ');
      full += `${line}\n\n`;
    }
    return full.trim();
  }

  throw new Error('Unsupported format. Use PDF, DOCX, or TXT.');
}
