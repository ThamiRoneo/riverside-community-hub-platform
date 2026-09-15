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

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  login: (
    userData: Pick<User, "email" | "fullName" | "role"> & Partial<User>,
  ) => void;
  register: (
    userData: Pick<User, "email" | "fullName" | "role"> & Partial<User>,
  ) => void;
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
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      return;
    }

    localStorage.removeItem(STORAGE_KEY);
  }, [user]);

  const login = useCallback(
    (userData: Pick<User, "email" | "fullName" | "role"> & Partial<User>) => {
      const nextUser: User = {
        id: userData.id ?? "local-user",
        email: userData.email,
        fullName: userData.fullName,
        role: userData.role ?? "member",
        membershipTier: userData.membershipTier ?? "Standard",
        joinedAt: userData.joinedAt ?? new Date().toISOString(),
      };

      setUser(nextUser);
    },
    [],
  );

  const register = useCallback(
    (userData: Pick<User, "email" | "fullName" | "role"> & Partial<User>) => {
      const nextUser: User = {
        id: userData.id ?? `member-${Date.now()}`,
        email: userData.email,
        fullName: userData.fullName,
        role: userData.role ?? "member",
        membershipTier: userData.membershipTier ?? "Standard",
        joinedAt: userData.joinedAt ?? new Date().toISOString(),
      };

      setUser(nextUser);
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
