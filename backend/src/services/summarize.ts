import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import { generateText } from './ollama.js';

// ---------------------------------------------------------------------------
// Extracts raw text from a document buffer based on MIME type.
// Supports: PDF, DOCX, DOC, plain text.
// ---------------------------------------------------------------------------
export async function extractDocumentText(
  fileBuffer: Buffer,
  mimeType: string,
): Promise<{ rawText: string; textLength: number }> {
  let extractedText = '';

  if (mimeType === 'application/pdf' || fileBuffer.slice(0, 5).toString() === '%PDF-') {
    const data = await pdf(fileBuffer);
    extractedText = data.text;
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    extractedText = result.value;
  } else {
    extractedText = fileBuffer.toString('utf-8');
  }

  if (!extractedText || extractedText.trim().length === 0) {
    throw new Error('No text content could be extracted from the document.');
  }

  return { rawText: extractedText.trim(), textLength: extractedText.trim().length };
}

// ---------------------------------------------------------------------------
// Extracts text AND generates an Ollama summary.
// Returns both the raw extracted text and the AI-generated summary.
// The `summary` field is the AI summary; use `rawText` for full RAG indexing.
// ---------------------------------------------------------------------------
export async function summarizeDocument(
  fileBuffer: Buffer,
  mimeType: string,
  model?: string
): Promise<{ summary: string; rawText: string; textLength: number }> {
  const { rawText, textLength } = await extractDocumentText(fileBuffer, mimeType);

  // Feed up to 8,000 chars to the LLM to avoid overloading local context windows
  const textSample = rawText.length > 8000
    ? rawText.substring(0, 8000) + '\n[Truncated — document continues beyond this point...]'
    : rawText;

  // If no model is passed, still return the raw text as the "summary" so the
  // caller gets something useful without requiring Ollama to be online.
  if (!model) {
    return { summary: rawText, rawText, textLength };
  }

  const prompt = `You are a helpful assistant. Summarize the following document content in a clear, structured format. Provide a high-level overview followed by a bulleted list of the key takeaways, concepts, or action items:

--- DOCUMENT START ---
${textSample}
--- DOCUMENT END ---

Please provide the summary now:`;

  const response = await generateText(prompt, model);
  return {
    summary: response.text || rawText, // fallback to raw text if generation returns empty
    rawText,
    textLength,
  };
}
