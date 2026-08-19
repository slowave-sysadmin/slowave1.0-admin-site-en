"use client";

import { useEffect, useState, useCallback } from "react";
import Modal from "@/components/Modal";
import { useDialog } from "@/components/DialogProvider";

interface Admin {
  id: number;
  username: string;
  name: string;
  role: string;
  page_permissions: Record<string, string> | string | null;
  status: string;
  created_at: string;
}

interface Me {
  role: string;
}

const roleLabels: Record<string, string> = {
  system_admin: "시스템관리자",
  admin: "관리자",
};

const pageOptions = [
  { value: "/field-status", label: "현장 현황" },
  { value: "/organizations", label: "기관 관리" },
  { value: "/users", label: "사용자 관리" },
  { value: "/devices", label: "센서 관리" },
  { value: "/tests", label: "검사 조회" },
  { value: "/features", label: "기능 관리" },
  { value: "/logs", label: "로그 조회", viewOnly: true },
  { value: "/manual", label: "매뉴얼", viewOnly: true },
];

const matrixPages = [
  { value: "/", label: "대시보드", fixed: "view" },
  ...pageOptions,
];

const permLabels: Record<string, string> = {
  edit: "편집",
  view: "조회",
  none: "차단",
};

const permColors: Record<string, string> = {
  edit: "bg-bg-badge-green text-text-badge-green",
  view: "bg-bg-badge-blue text-text-badge-blue",
  none: "bg-bg-badge-red text-text-badge-red",
};

const emptyForm = {
  username: "",
  password: "",
  name: "",
  role: "admin",
  status: "active",
  page_permissions: {} as Record<string, string>,
};

function formatDate(d: string) {
  if (!d) return "-";
  const date = new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parsePerms(raw: Record<string, string> | string | null): Record<string, string> {
  if (!raw) return {};
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch { return {}; } }
  return raw;
}

export default function AdminsPage() {
  const { alert } = useDialog();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Me | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Admin | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [matrixOpen, setMatrixOpen] = useState(false);

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admins");
      if (res.ok) {
        const json = await res.json();
        setAdmins(json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdmins();
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setMe(d))
      .catch(() => {});
  }, [fetchAdmins]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (admin: Admin) => {
    setEditing(admin);
    setForm({
      username: admin.username,
      password: "",
      name: admin.name,
      role: admin.role,
      status: admin.status,
      page_permissions: parsePerms(admin.page_permissions),
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = editing ? `/api/admins/${editing.id}` : "/api/admins";
      const method = editing ? "PUT" : "POST";
      const perms = Object.keys(form.page_permissions).length > 0 ? form.page_permissions : null;
      const body: Record<string, unknown> = {
        name: form.name,
        role: form.role,
        status: form.status,
        page_permissions: perms,
      };
      if (!editing) {
        body.username = form.username;
        body.password = form.password;
      }
      if (editing && form.password) {
        body.password = form.password;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setModalOpen(false);
        fetchAdmins();
      } else {
        const err = await res.json().catch(() => null);
        await alert(err?.error || "저장에 실패했습니다.");
      }
    } catch {
      await alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const setPagePerm = (page: string, level: string) => {
    setForm((f) => {
      const perms = { ...f.page_permissions, [page]: level };
      return { ...f, page_permissions: perms };
    });
  };

  const getPagePerm = (page: string) => {
    const stored = form.page_permissions[page];
    if (stored) return stored;
    const opt = pageOptions.find((p) => p.value === page);
    return (opt as any)?.viewOnly ? "view" : "edit";
  };

  const canEditRole = me?.role === "system_admin";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">관리자 계정</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setMatrixOpen(true)}
            className="px-4 py-2 border border-border-primary text-text-secondary text-sm font-medium rounded-lg hover:bg-bg-hover"
          >
            권한 매트릭스
          </button>
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover"
          >
            관리자 추가
          </button>
        </div>
      </div>

      <div className="bg-bg-card rounded-lg border border-border-primary">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-primary text-left text-text-secondary">
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">아이디</th>
                <th className="px-4 py-3 font-medium">이름</th>
                <th className="px-4 py-3 font-medium">역할</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="px-4 py-3 font-medium">생성일</th>
                <th className="px-4 py-3 font-medium">관리</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted">로딩 중...</td></tr>
              ) : admins.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted">관리자가 없습니다.</td></tr>
              ) : (
                admins.map((a) => (
                  <tr key={a.id} className="border-b border-border-secondary hover:bg-bg-hover">
                    <td className="px-4 py-2.5 text-text-secondary">{a.id}</td>
                    <td className="px-4 py-2.5 font-medium">{a.username}</td>
                    <td className="px-4 py-2.5">{a.name || "-"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        a.role === "system_admin" ? "bg-bg-badge-red text-text-badge-red" : "bg-bg-badge-blue text-text-badge-blue"
                      }`}>
                        {roleLabels[a.role] || a.role}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        a.status === "active" ? "bg-bg-badge-green text-text-badge-green" : "bg-bg-badge-red text-text-badge-red"
                      }`}>
                        {a.status === "active" ? "활성" : "비활성"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-text-secondary">{formatDate(a.created_at)}</td>
                    <td className="px-4 py-2.5">
                      {(me?.role === "system_admin" || a.role !== "system_admin") ? (
                        <button onClick={() => openEdit(a)} className="text-xs text-accent hover:text-accent-hover font-medium">수정</button>
                      ) : (
                        <span className="text-xs text-text-muted">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "관리자 수정" : "관리자 추가"}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">아이디</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              disabled={!!editing}
              className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              비밀번호{editing && " (변경 시에만 입력)"}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">이름</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">역할</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              disabled={!canEditRole && (form.role === "system_admin" || editing?.role === "system_admin")}
              className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
            >
              {canEditRole && <option value="system_admin">시스템관리자</option>}
              <option value="admin">관리자</option>
            </select>
          </div>
          {editing && (
            <div>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium text-text-secondary">계정 활성화</span>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, status: form.status === "active" ? "inactive" : "active" })}
                  className={`relative w-10 h-5 rounded-full transition-colors ${form.status === "active" ? "bg-accent" : "bg-gray-300 dark:bg-gray-600"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.status === "active" ? "translate-x-5" : ""}`} />
                </button>
              </label>
              {form.status === "inactive" && (
                <p className="text-xs text-red-500 mt-1">비활성화된 계정은 로그인할 수 없습니다.</p>
              )}
            </div>
          )}
          {form.role === "admin" && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">페이지별 권한</label>
              <p className="text-xs text-text-muted mb-2">미설정 시 모든 페이지 편집 가능</p>
              <div className="space-y-1.5">
                {pageOptions.map((p) => {
                  const perm = getPagePerm(p.value);
                  return (
                    <div key={p.value} className="flex items-center justify-between p-2 rounded-lg border border-border-primary">
                      <span className="text-sm text-text-primary">{p.label}</span>
                      <div className="flex gap-1">
                        {((p as any).viewOnly ? ["view", "none"] as const : ["edit", "view", "none"] as const).map((level) => (
                          <button
                            key={level}
                            onClick={() => setPagePerm(p.value, level)}
                            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                              perm === level ? permColors[level] : "bg-bg-tertiary text-text-muted hover:text-text-secondary"
                            }`}
                          >
                            {permLabels[level]}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm border border-border-primary rounded-lg text-text-primary hover:bg-bg-hover">취소</button>
            <button onClick={handleSave} disabled={saving || !form.username || (!editing && !form.password)} className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50">
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Permission Matrix Modal */}
      <Modal open={matrixOpen} onClose={() => setMatrixOpen(false)} title="권한 매트릭스" fullWidth>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-primary text-left">
                <th className="px-3 py-2 font-medium text-text-secondary sticky left-0 bg-bg-card">계정</th>
                {matrixPages.map((p) => (
                  <th key={p.value} className="px-2 py-2 font-medium text-text-secondary text-center whitespace-nowrap">{p.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {admins.filter((a) => a.status === "active" && a.role !== "system_admin").map((a) => {
                const perms = parsePerms(a.page_permissions);
                return (
                  <tr key={a.id} className="border-b border-border-secondary hover:bg-bg-hover">
                    <td className="px-3 py-2 sticky left-0 bg-bg-card">
                      <span className="font-medium text-text-primary">{a.name || a.username}</span>
                    </td>
                    {matrixPages.map((p: any) => {
                      if (a.role === "system_admin") {
                        return <td key={p.value} className="px-2 py-2 text-center"><span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-bg-badge-green text-text-badge-green">{p.fixed ? "조회" : "편집"}</span></td>;
                      }
                      if (p.fixed) {
                        return <td key={p.value} className="px-2 py-2 text-center"><span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-bg-badge-blue text-text-badge-blue">조회</span></td>;
                      }
                      const perm = perms[p.value] || ((p as any).viewOnly ? "view" : "edit");
                      return (
                        <td key={p.value} className="px-2 py-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${permColors[perm]}`}>
                            {permLabels[perm]}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  );
}
