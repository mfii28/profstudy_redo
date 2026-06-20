import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const googleApiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

const googleAIPlugin = googleAI({ apiKey: googleApiKey });

export const ai = genkit({
  plugins: [googleAIPlugin],
  model: 'googleai/gemini-2.5-flash',
});

/** Course RAG: 768-dim Gemini embeddings (matches `courses/.../ragChunks.embedding`). */
export const courseRagEmbedder = googleAI.embedder('gemini-embedding-2');
