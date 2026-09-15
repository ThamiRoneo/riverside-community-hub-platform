import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Role, User } from "../types";
import { apiGet } from "../lib/api";
import { supabase } from "../lib/supabase";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    fullName: string,
    email: string,
    password: string,
  ) => Promise<void>;
  logout: () => void;
}

const STORAGE_KEY = "riverside-auth-user";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem(STORAGE_KEY);
    return savedUser ? (JSON.parse(savedUser) as User) : null;
  });

  useEffect(() => {
    let mounted = true;

    async function restoreSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted || !session) return;

      const response = await apiGet<{
        user: { id: string; email?: string; role: Role };
      }>("/auth/me");
      setUser({
        id: response.user.id,
        email: response.user.email ?? session.user.email ?? "",
        fullName: session.user.user_metadata.full_name ?? "Riverside member",
        role: response.user.role,
        membershipTier: "Standard",
        joinedAt: session.user.created_at,
      });
    }

    void restoreSession();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) setUser(null);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      return;
    }

    localStorage.removeItem(STORAGE_KEY);
  }, [user]);

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("No Supabase session was created");

    const response = await apiGet<{
      user: { id: string; email?: string; role: Role };
    }>("/auth/me");
    setUser({
      id: response.user.id,
      email: response.user.email ?? email,
      fullName: session.user.user_metadata.full_name ?? "Riverside member",
      role: response.user.role,
      membershipTier: "Standard",
      joinedAt: session.user.created_at,
    });
  }, []);

  const register = useCallback(
    async (fullName: string, email: string, password: string) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) throw error;

      if (data.session && data.user) {
        setUser({
          id: data.user.id,
          email,
          fullName,
          role: "member",
          membershipTier: "Standard",
          joinedAt: data.user.created_at,
        });
      }
    },
    [],
  );

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      login,
      register,
      logout,
    }),
    [login, logout, register, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}

export function resolveRoleLabel(role: Role): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "staff":
      return "Staff";
    case "member":
      return "Member";
    default:
      return "Visitor";
  }
}
