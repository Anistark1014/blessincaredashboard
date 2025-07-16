import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';

export type UserRole = 'reseller' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    name: string,
    role: UserRole
  ) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Centralized session/user logic
  const handleSession = (session: Session | null) => {
    setSession(session);
    if (session?.user) {
      const email = session.user.email || '';
      const mock = getMockUserData(email);

      if (mock) {
        setUser(mock);
      } else {
        const userData: User = {
          id: session.user.id,
          email,
          name:
            session.user.user_metadata?.name ||
            email.split('@')[0] ||
            'User',
          role: session.user.user_metadata?.role || 'reseller',
        };
        setUser(userData);
      }
    } else {
      setUser(null);
    }
  };

  // Listen for auth state change
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      handleSession(data.session);
      setLoading(false);
    };

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        handleSession(session);
        setLoading(false);
      }
    );

    init();

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const getMockUserData = (email: string): User | null => {
    const mockUsers: Record<string, User> = {
      'reseller@test.com': {
        id: '1',
        email,
        name: 'Sarah Johnson',
        role: 'reseller',
      },
      'admin@test.com': {
        id: '2',
        email,
        name: 'Dr. Emily Chen',
        role: 'admin',
      },
    };
    return mockUsers[email] || null;
  };

  const login = async (email: string, password: string) => {
    const demoPassword = 'demo123456';

    if (
      (email === 'reseller@test.com' || email === 'admin@test.com') &&
      password === 'password'
    ) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: demoPassword,
      });

      if (error && error.message.includes('Invalid login credentials')) {
        const mock = getMockUserData(email);
        if (mock) {
          const { error: signUpError } = await supabase.auth.signUp({
            email,
            password: demoPassword,
            options: {
              data: {
                name: mock.name,
                role: mock.role,
              },
            },
          });
          if (signUpError) throw signUpError;
          return;
        }
      }

      if (error) throw error;
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    }
  };

  const register = async (
    email: string,
    password: string,
    name: string,
    role: UserRole
  ) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { name, role },
      },
    });
    console.log('Register error:', error);
    if (error) throw error;
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const value = useMemo(
    () => ({
      user,
      session,
      login,
      register,
      logout,
      isAuthenticated: !!session,
      loading,
    }),
    [user, session, loading]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
};
