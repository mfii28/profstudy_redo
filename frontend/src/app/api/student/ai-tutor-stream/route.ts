export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/student/ai-tutor-stream`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${body.idToken || ''}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return Response.json(
        { error: data.detail || 'AI Tutor server returned an error.' },
        { status: response.status }
      );
    }

    // Forward source metadata header from backend response
    const sourceDocs = response.headers.get('X-Tutor-Source-Docs') || '[]';

    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Tutor-Source-Docs': sourceDocs,
      },
    });
  } catch (error: any) {
    console.error('[AI Tutor Proxy] Streaming error:', error);
    return Response.json(
      { error: error.message || 'Internal connection error to AI Tutor service.' },
      { status: 500 }
    );
  }
}
