"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import Sidebar from "./Sidebar";
import Modal from "./Modal";

const roleLabels: Record<string, string> = {
  system_admin: "시스템관리자",
  admin: "관리자",
  member: "멤버",
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [logoutOpen, setLogoutOpen] = useState(false);

  useEffect(() => {
    setLogoutOpen(false);
  }, [pathname]);

  const isPublic =
    pathname.startsWith("/register") ||
    pathname.startsWith("/reset-password") ||
    pathname === "/login";

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  if (isPublic) {
    return (
      <div className="min-h-full flex items-center justify-center px-4 py-12">
        {children}
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-12 flex items-center justify-end px-6 border-b border-border-primary bg-bg-card shrink-0">
          {user && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-text-secondary">
                {user.name || user.username}
                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-bg-tertiary text-text-tertiary text-[10px] font-medium">
                  {roleLabels[user.role] || user.role}
                </span>
              </span>
              <button
                onClick={() => setLogoutOpen(true)}
                className="text-xs text-text-muted hover:text-text-primary transition-colors"
              >
                로그아웃
              </button>
            </div>
          )}
        </header>
        <main className="flex-1 overflow-auto px-6 py-6">
          {children}
        </main>
      </div>
      <Modal open={logoutOpen} onClose={() => setLogoutOpen(false)} title="로그아웃">
        <p className="text-sm text-text-secondary mb-6">로그아웃 하시겠습니까?</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setLogoutOpen(false)}
            className="px-4 py-2 text-sm border border-border-primary rounded-lg text-text-primary hover:bg-bg-hover"
          >
            취소
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover"
          >
            로그아웃
          </button>
        </div>
      </Modal>
    </div>
  );
}
