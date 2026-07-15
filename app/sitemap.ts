// CANONICAL — sitemap.xml for SubCompliance marketing routes. The middleware matcher
// already excludes /sitemap.xml; this route makes the file actually exist
// (past-failure fix). Only public marketing pages are listed — the app itself
// is behind auth and disallowed in robots.ts.
import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return [
    { url: `${BASE_URL}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE_URL}/pricing`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/signup`, lastModified, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/login`, lastModified, changeFrequency: 'monthly', priority: 0.5 },
  ]
}
