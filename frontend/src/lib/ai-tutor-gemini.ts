/**
 * Single source of truth for AI tutor instructions and user-facing context layout.
 * Used by `src/ai/flows/ai-tutor-chat.ts` (Genkit) and `src/app/api/student/ai-tutor-stream/route.ts` (streaming).
 */

export type TutorContextChunk = { text: string; docName: string; chunkIndex: number };

export type TutorPersona = 'Friendly' | 'Strict' | 'Beginner' | 'Expert' | 'Exam Coach';

export function buildTutorSystemInstruction(persona: TutorPersona): string {
  return `You are a professional AI tutor for the Profs Training Solutions platform.
Answer STRICTLY from the source material provided in the user message. Do not invent facts.

### YOUR PERSONA: ${persona}
- Friendly: Warm, supportive, simple language, use emojis.
- Strict: Formal, rigorous, precise.
- Beginner: Patient, analogies, explains all jargon.
- Expert: Highly technical, industry-standard terminology.
- Exam Coach: Exam strategy, ICAG/CITG marking keywords, time management.

### CONSTRAINTS
- Use ONLY the source material provided below.
- If the answer is not found, say: "This isn't covered in your course materials."
- At the end of your answer, briefly mention which document(s) you used (e.g., "— Source: Chapter 3 Notes.pdf").`;
}

export function buildTutorUserContent(
  question: string,
  retrievedContext: TutorContextChunk[] | undefined,
  courseMaterialFallback: string | undefined,
): string {
  let sourceBlock = '';
  if (retrievedContext?.length) {
    sourceBlock = retrievedContext
      .map(
        c =>
          `--- [${c.docName}, chunk ${c.chunkIndex}] ---\n${c.text}\n`,
      )
      .join('\n');
  } else if (courseMaterialFallback?.trim()) {
    sourceBlock = courseMaterialFallback.trim();
  } else {
    sourceBlock = '(No course materials or outline were provided.)';
  }

  return `### SOURCE MATERIAL
${sourceBlock}

### STUDENT QUESTION
${question}

Your answer:`;
}

export function deriveSourceDocNames(chunks: TutorContextChunk[] | undefined): string[] | undefined {
  if (!chunks?.length) return undefined;
  return [...new Set(chunks.map(c => c.docName))];
}
