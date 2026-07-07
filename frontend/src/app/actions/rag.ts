'use server';

import { apiFetchServer } from '@/lib/api-client.server';

export interface RetrievedChunk {
  text: string;
  docName: string;
  chunkIndex: number;
  score: number;
}

export type CourseRagStats = { chunkCount: number; sources: string[] };

export async function ingestCourseRagFromText(
  courseId: string,
  idToken: string,
  sourceLabel: string,
  text: string,
) {
  try {
    const res = await apiFetchServer(`/api/v1/rag/course/${courseId}/ingest-text`, {
      method: 'POST',
      body: JSON.stringify({ sourceLabel, text }),
    });
    return res.json();
  } catch (error: any) {
    return { ok: false, error: error.message || 'Failed to ingest text.' };
  }
}

export async function ingestCourseRagFile(
  courseId: string,
  idToken: string,
  sourceLabel: string,
  fileKey: string,
) {
  try {
    const res = await apiFetchServer(`/api/v1/rag/course/${courseId}/ingest-file`, {
      method: 'POST',
      body: JSON.stringify({ sourceLabel, fileKey }),
    });
    return res.json();
  } catch (error: any) {
    return { ok: false, error: error.message || 'Failed to ingest file.' };
  }
}

export async function getCourseMarkdownText(courseId: string, idToken?: string): Promise<string> {
  try {
    const key = `private/courses/${courseId}/rag/materials.md`;
    const res = await apiFetchServer(`/api/v1/storage/download-url?key=${encodeURIComponent(key)}`);
    const data = await res.json();
    if (!data.url) return '';
    
    const fileRes = await fetch(data.url);
    if (!fileRes.ok) return '';
    return await fileRes.text();
  } catch (error) {
    return '';
  }
}

export async function retrieveCourseChunksForStudent(
  userId: string,
  courseId: string,
  query: string,
  topK = 5,
  idToken?: string,
): Promise<RetrievedChunk[]> {
  try {
    const res = await apiFetchServer(`/api/v1/rag/course/${courseId}/retrieve`, {
      method: 'POST',
      body: JSON.stringify({ query, top_k: topK }),
    });
    const data = await res.json();
    if (data.chunks && Array.isArray(data.chunks)) {
      return data.chunks as RetrievedChunk[];
    }
    return [];
  } catch (error) {
    return [];
  }
}

export async function getCourseRagStatsForStudent(
  userId: string,
  courseId: string,
  idToken?: string,
) {
  try {
    const res = await apiFetchServer(`/api/v1/rag/course/${courseId}/stats`);
    return res.json();
  } catch {
    return null;
  }
}

export async function getCourseRagStatsForStaff(
  courseId: string,
  idToken: string,
) {
  try {
    const res = await apiFetchServer(`/api/v1/rag/course/${courseId}/stats`);
    const data = await res.json();
    return { ok: true, stats: data };
  } catch (error: any) {
    return { ok: false, error: error.message || 'Failed to fetch RAG stats.' };
  }
}
