// CANONICAL — robots.txt for SubCompliance. The middleware matcher already excludes
// /robots.txt; this route makes the file actually exist (past-failure fix: matcher
// exclusion without the route meant crawlers got a 404).
import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard', '/gcs', '/settings', '/billing', '/api/', '/auth/'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
