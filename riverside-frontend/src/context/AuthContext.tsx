import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Role, User, MemberProfileRecord } from "../types";
import { apiGet, apiPost } from "../lib/api";
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
  logout: () => Promise<void>;
}

interface AuthResponse {
  session: { access_token: string; refresh_token: string } | null;
  user: {
    id: string;
    email?: string;
    role: Role;
    full_name?: string;
    created_at?: string;
    membership_expires_at?: string | null;
  };
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

  // Refreshes the display name from the profile of whoever is signed in.
  //
  // Two things here keep this from looping. The effect is keyed on the id, not
  // the user object, and the set below keeps the same reference when the name has
  // not actually changed. Without the second guard this fired once a second
  // forever: a new `user` object recreated the callback, which re-ran the effect,
  // which set a new object again. The previous `/members/me` call hid it, because
  // it always failed for a member and so never reached the set.
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function loadProfile() {
      try {
        // Own profile comes from /profile/me. There is no /members/me: that path
        // falls through to the staff-and-admin-only GET /members/:id, so every
        // member got a 403.
        const profile = await apiGet<MemberProfileRecord>("/profile/me");
        if (cancelled) return;
        setUser(prev =>
          prev && prev.fullName === profile.full_name
            ? prev
            : prev && { ...prev, fullName: profile.full_name },
        );
      } catch (err) {
        // Logged rather than swallowed: a stale name here is the only symptom of
        // a broken profile fetch, which is how this went unnoticed.
        console.error("Failed to fetch profile", err);
      }
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [userId]);
  
  const login = useCallback(async (email: string, password: string) => {
    const response = await apiPost<AuthResponse>("/auth/login", {
      email,
      password,
    });
    if (!response.session) throw new Error("No active session was created");
    const { error } = await supabase.auth.setSession(response.session);
    if (error) throw error;

    setUser({
      id: response.user.id,
      email: response.user.email ?? email,
      fullName: response.user.full_name ?? "Riverside member",
      role: response.user.role,
      membershipTier: "Standard",
      joinedAt: response.user.created_at,
    });
  }, []);

  const register = useCallback(
    async (fullName: string, email: string, password: string) => {
      const response = await apiPost<AuthResponse>("/auth/signup", {
        email,
        password,
        full_name: fullName,
      });

      if (response.session) {
        const { error } = await supabase.auth.setSession(response.session);
        if (error) throw error;
        setUser({
          id: response.user.id,
          email,
          fullName,
          role: "member",
          membershipTier: "Standard",
          joinedAt: response.user.created_at,
        });
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
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
