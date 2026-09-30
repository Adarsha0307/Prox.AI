import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

export async function extractDocument(buffer: Buffer, mimetype: string): Promise<string> {
  // 5MB limit
  if (buffer.length > 5 * 1024 * 1024) {
    throw new Error('File exceeds 5MB size limit');
  }

  if (mimetype === 'text/plain') {
    return buffer.toString('utf-8').trim();
  }

  if (mimetype === 'application/pdf') {
    try {
      const data = await (pdfParse as any)(buffer);
      if (!data.text || !data.text.trim()) {
        throw new Error('No text could be extracted. The PDF might be image-only (OCR is not supported).');
      }
      return data.text.trim();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      if (msg.includes('No text')) throw new Error(msg);
      throw new Error(`PDF extraction failed: ${msg}`);
    }
  }

  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimetype === 'application/msword'
  ) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      if (!result.value || !result.value.trim()) {
        throw new Error('No text could be extracted from this Word document.');
      }
      return result.value.trim();
    } catch (e) {
      throw new Error(`DOCX extraction failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  throw new Error(`Unsupported file type: ${mimetype}`);
}
