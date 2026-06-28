'use server';

/**
 * @fileOverview Next.js Proxy Server Actions for Course-scoped RAG.
 * Redirects RAG ingestion, stats, and text retrieval to the FastAPI Python backend.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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
    const apiUrl = `${API_URL}/rag/course/${courseId}/ingest-text`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken || ''}`,
      },
      body: JSON.stringify({ sourceLabel, text }),
    });
    
    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data.detail || 'Failed to ingest text.' };
    }
    
    return data;
  } catch (error: any) {
    console.error('[RAG Proxy] Ingest text failed:', error);
    return { ok: false, error: error.message || 'Failed to connect to RAG service.' };
  }
}

export async function ingestCourseRagFile(
  courseId: string,
  idToken: string,
  sourceLabel: string,
  fileKey: string,
) {
  try {
    const apiUrl = `${API_URL}/rag/course/${courseId}/ingest-file`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken || ''}`,
      },
      body: JSON.stringify({ sourceLabel, fileKey }),
    });
    
    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data.detail || 'Failed to ingest file.' };
    }
    
    return data;
  } catch (error: any) {
    console.error('[RAG Proxy] Ingest file failed:', error);
    return { ok: false, error: error.message || 'Failed to connect to RAG service.' };
  }
}

export async function getCourseMarkdownText(courseId: string, idToken?: string): Promise<string> {
  try {
    const key = `private/courses/${courseId}/rag/materials.md`;
    const apiUrl = `${API_URL}/storage/download-url?key=${encodeURIComponent(key)}`;
    
    const response = await fetch(apiUrl, {
      headers: {
        ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {}),
      },
    });
    const data = await response.json();
    if (!response.ok || !data.url) return '';
    
    const fileRes = await fetch(data.url);
    if (!fileRes.ok) return '';
    return await fileRes.text();
  } catch (error) {
    console.error('[RAG Proxy] Failed to get course markdown text:', error);
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
    const apiUrl = `${API_URL}/rag/course/${courseId}/retrieve`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({ query, top_k: topK }),
    });
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    if (data.chunks && Array.isArray(data.chunks)) {
      return data.chunks as RetrievedChunk[];
    }
    return [];
  } catch (error) {
    console.error('[RAG Proxy] Failed to retrieve chunks:', error);
    return [];
  }
}

export async function getCourseRagStatsForStudent(
  userId: string,
  courseId: string,
  idToken?: string,
) {
  try {
    const apiUrl = `${API_URL}/rag/course/${courseId}/stats`;
    const response = await fetch(apiUrl, {
      headers: {
        ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {}),
      },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function getCourseRagStatsForStaff(
  courseId: string,
  idToken: string,
) {
  try {
    const apiUrl = `${API_URL}/rag/course/${courseId}/stats`;
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${idToken || ''}`,
      }
    });
    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data.detail || 'Failed to fetch RAG stats.' };
    }
    return { ok: true, stats: data };
  } catch (error: any) {
    return { ok: false, error: error.message || 'Failed to connect to RAG service.' };
  }
}
