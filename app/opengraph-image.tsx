// CANONICAL: Shared OpenGraph/Twitter preview image for the marketing site (QA-009 fix).
// Next.js file-convention metadata: app/opengraph-image.tsx cascades to every route segment
// below app/, so app/page.tsx (/) and app/pricing/page.tsx (/pricing) both emit og:image tags
// pointing at this generated 1200x630 card — no per-page metadata changes required.
import { ImageResponse } from 'next/og'

export const alt =
  'SubCompliance — Never get pulled off a job for a lapsed COI. Certificate-of-insurance and compliance tracking built for solo trade contractors.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const CHIPS = ['Free for 3 GCs', '30/14/7/1-day reminders', 'Broker requests drafted']

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          backgroundColor: '#030712',
          backgroundImage: 'linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 48%, #030712 100%)',
          color: '#ffffff',
        }}
      >
        {/* Brand row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 60,
              height: 60,
              borderRadius: 14,
              backgroundColor: '#fbbf24',
              color: '#1e3a8a',
              fontSize: 28,
              fontWeight: 800,
            }}
          >
            SC
          </div>
          <div style={{ display: 'flex', fontSize: 40, fontWeight: 700 }}>SubCompliance</div>
        </div>

        {/* Headline + subhead */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 68,
              fontWeight: 800,
              lineHeight: 1.12,
              letterSpacing: '-0.03em',
            }}
          >
            Never get pulled off a job for a lapsed COI.
          </div>
          <div style={{ display: 'flex', maxWidth: 980, fontSize: 30, lineHeight: 1.4, color: '#bfdbfe' }}>
            Tracks the insurance and compliance requirements every GC puts on you, warns you weeks
            before anything expires, and drafts the broker request that keeps you on the job.
          </div>
        </div>

        {/* Proof chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {CHIPS.map((chip) => (
            <div
              key={chip}
              style={{
                display: 'flex',
                padding: '10px 22px',
                borderRadius: 9999,
                border: '1px solid rgba(255, 255, 255, 0.3)',
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
                fontSize: 22,
                fontWeight: 600,
                color: '#e0e7ff',
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  )
}
