'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabaseAuth, detectUserRole, AuthUser, UserRole } from '@/lib/auth';

type AuthContextType = {
  user: AuthUser | null;
  supabaseUser: User | null;
  loading: boolean;
  refreshRole: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  supabaseUser: null,
  loading: true,
  refreshRole: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const buildAuthUser = useCallback(async (sbUser: User | null) => {
    if (!sbUser || !sbUser.email) {
      // TEST MODE: bypass auth, default to HR role
      setUser({
        id: 'test-hr-user',
        email: 'hr@platinumlist.net',
        role: 'HR',
        managedEmployeeIds: [],
        employeeRecordId: null,
      });
      setSupabaseUser(null);
      setLoading(false);
      return;
    }

    setSupabaseUser(sbUser);

    const { role, managedEmployeeIds, employeeRecordId } = await detectUserRole(sbUser.email);

    setUser({
      id: sbUser.id,
      email: sbUser.email,
      role,
      managedEmployeeIds,
      employeeRecordId,
    });
    setLoading(false);
  }, []);

  const refreshRole = useCallback(async () => {
    if (supabaseUser?.email) {
      const { role, managedEmployeeIds, employeeRecordId } = await detectUserRole(supabaseUser.email);
      setUser((prev) =>
        prev
          ? { ...prev, role, managedEmployeeIds, employeeRecordId }
          : null
      );
    }
  }, [supabaseUser]);

  useEffect(() => {
    // Get initial session
    supabaseAuth.auth.getSession().then(({ data: { session } }) => {
      buildAuthUser(session?.user ?? null);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabaseAuth.auth.onAuthStateChange((_event, session) => {
      buildAuthUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [buildAuthUser]);

  return (
    <AuthContext.Provider value={{ user, supabaseUser, loading, refreshRole }}>
      {children}
    </AuthContext.Provider>
  );
}
