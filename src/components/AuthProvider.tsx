"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface AuthUser {
  adminId: number;
  username: string;
  name: string;
  role: "system_admin" | "admin";
  pagePermissions: Record<string, string> | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  isSystemAdmin: boolean;
  canAccess: (page: string) => boolean;
  canEdit: (page: string) => boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isSystemAdmin: false,
  canAccess: () => true,
  canEdit: () => true,
});

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const pathname = usePathname();
  const isPublic =
    pathname.startsWith("/register") ||
    pathname.startsWith("/reset-password") ||
    pathname === "/login";

  useEffect(() => {
    if (isPublic) return;
    fetch("/api/auth/me")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => setUser(d))
      .catch(() => setUser(null));
  }, [isPublic]);

  const isSystemAdmin = user?.role === "system_admin";

  const canAccess = useCallback((page: string) => {
    if (!user) return true;
    if (user.role === "system_admin") return true;
    if (!user.pagePermissions) return true; // no restrictions = full access
    const perm = user.pagePermissions[page];
    if (!perm) return true; // page not in permissions = allowed
    return perm !== "none";
  }, [user]);

  const canEdit = useCallback((page: string) => {
    if (!user) return false;
    if (user.role === "system_admin") return true;
    if (!user.pagePermissions) return true;
    const perm = user.pagePermissions[page];
    if (!perm) return true;
    return perm === "edit";
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, isSystemAdmin, canAccess, canEdit }}>
      {children}
    </AuthContext.Provider>
  );
}
