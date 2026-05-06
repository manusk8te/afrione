'use client'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface AuthState {
  user: any
  userRole: string
  userName: string
  hasArtisanProfile: boolean
  loading: boolean
}

interface AuthContextType extends AuthState {
  signOut: () => Promise<void>
  reload: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userRole: 'client',
  userName: '',
  hasArtisanProfile: false,
  loading: true,
  signOut: async () => {},
  reload: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    userRole: 'client',
    userName: '',
    hasArtisanProfile: false,
    loading: true,
  })

  const loadUser = useCallback(async (session: any) => {
    if (!session?.user) {
      setState({ user: null, userRole: 'client', userName: '', hasArtisanProfile: false, loading: false })
      return
    }

    const userId = session.user.id

    const [{ data: profile }, { data: artisan }] = await Promise.all([
      supabase.from('users').select('role, name').eq('id', userId).single(),
      supabase.from('artisan_pros').select('id').eq('user_id', userId).maybeSingle(),
    ])

    setState({
      user: session.user,
      userRole: profile?.role || 'client',
      userName: profile?.name || session.user.email?.split('@')[0] || 'Mon compte',
      hasArtisanProfile: !!artisan,
      loading: false,
    })
  }, [])

  useEffect(() => {
    // Initial session load
    supabase.auth.getSession().then(({ data: { session } }) => loadUser(session))

    // Single global listener for the entire app lifetime
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setState({ user: null, userRole: 'client', userName: '', hasArtisanProfile: false, loading: false })
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        loadUser(session)
      }
    })

    return () => subscription.unsubscribe()
  }, [loadUser])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    // Full page reload — guaranteed clean state, no stale React state
    window.location.href = '/'
  }, [])

  const reload = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    loadUser(session)
  }, [loadUser])

  return (
    <AuthContext.Provider value={{ ...state, signOut, reload }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
