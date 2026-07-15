'use client'

// CANONICAL — Profile context. Deterministic lint #75 found /api/profile fetched
// independently by 3 pages on one session; the dashboard layout now fetches it ONCE
// via ProfileProvider and every page reads it from context. Settings pushes its
// PATCH result back with setProfile so broker-draft tips update instantly.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { ApiError, apiFetch, type ProfileItem } from '@/lib/core/api-client'

interface ProfileContextValue {
  profile: ProfileItem | null
  profileLoading: boolean
  profileError: string | null
  refreshProfile: () => Promise<void>
  setProfile: (profile: ProfileItem) => void
}

const ProfileContext = createContext<ProfileContextValue | null>(null)

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<ProfileItem | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)

  const refreshProfile = useCallback(async () => {
    setProfileLoading(true)
    try {
      const data = await apiFetch<ProfileItem>('/api/profile')
      setProfileState(data)
      setProfileError(null)
    } catch (error) {
      setProfileError(
        error instanceof ApiError
          ? error.message
          : "We couldn't load your profile. Refresh to try again."
      )
    } finally {
      setProfileLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshProfile()
  }, [refreshProfile])

  const setProfile = useCallback((next: ProfileItem) => {
    setProfileState(next)
    setProfileError(null)
  }, [])

  return (
    <ProfileContext.Provider
      value={{ profile, profileLoading, profileError, refreshProfile, setProfile }}
    >
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext)
  if (!context) {
    throw new Error('useProfile must be used inside ProfileProvider (the dashboard layout provides it).')
  }
  return context
}
