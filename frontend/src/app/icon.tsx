import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f172a',
          borderRadius: 112,
        }}
      >
        <div
          style={{
            fontSize: 280,
            fontWeight: 800,
            color: '#f8fafc',
            fontFamily: 'system-ui, sans-serif',
            lineHeight: 1,
          }}
        >
          P
        </div>
      </div>
    ),
    { ...size }
  );
}
