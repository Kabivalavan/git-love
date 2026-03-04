import { useState, useEffect, createContext, useContext, ReactNode, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole, Profile } from '@/types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  isLoading: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, mobileNumber: string, fullName: string, realEmail?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fetchedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Get initial session first
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    // Then listen for changes (won't double-fetch due to ref guard)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Only fetch if user changed
          if (fetchedUserIdRef.current !== session.user.id) {
            setTimeout(() => fetchUserData(session.user.id), 0);
          }
        } else {
          fetchedUserIdRef.current = null;
          setProfile(null);
          setRole(null);
          setIsLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserData = async (userId: string) => {
    // Prevent duplicate fetches for the same user
    if (fetchedUserIdRef.current === userId) return;
    fetchedUserIdRef.current = userId;

    try {
      // Fetch profile and role in parallel - single call each
      const [profileRes, roleRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
      ]);

      setProfile(profileRes.data as Profile | null);
      setRole((roleRes.data?.role as AppRole) ?? 'customer');
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, mobileNumber: string, fullName: string, realEmail?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: redirectUrl, data: { full_name: fullName, mobile_number: mobileNumber } },
    });
    if (error) return { error };
    if (data.user) {
      await Promise.all([
        supabase.from('profiles').insert({ user_id: data.user.id, full_name: fullName, mobile_number: mobileNumber, email: realEmail || email }),
        supabase.from('user_roles').insert({ user_id: data.user.id, role: 'customer' }),
      ]);
    }
    return { error: null };
  };

  const signOut = async () => {
    fetchedUserIdRef.current = null;
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
  };

  const isAdmin = role === 'admin';
  const isStaff = role === 'admin' || role === 'staff';

  return (
    <AuthContext.Provider value={{ user, session, profile, role, isLoading, isAdmin, isStaff, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
