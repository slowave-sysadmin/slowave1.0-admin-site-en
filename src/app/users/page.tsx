"use client";

import { useEffect, useState, useCallback } from "react";
import Modal from "@/components/Modal";
import Pagination from "@/components/Pagination";
import ActionMenu from "@/components/ActionMenu";
import { useAuth } from "@/components/AuthProvider";
import { useDialog } from "@/components/DialogProvider";

interface User {
  user_id: number;
  organization_id: number;
  organization_name?: string;
  username: string;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  memo: string;
  last_login_at: string;
  created_at: string;
}

interface Org {
  organization_id: number;
  organization_name: string;
}

function formatDate(d: string) {
  if (!d) return "-";
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min}`;
}

const emptyForm = {
  organization_id: "",
  username: "",
  password: "",
  full_name: "",
  email: "",
  phone: "",
  role: "user",
  status: "active",
  memo: "",
};

export default function UsersPage() {
  const { canEdit: _canEdit } = useAuth();
  const isAdmin = _canEdit("/users");
  const { alert, confirm } = useDialog();
  const [users, setUsers] = useState<User[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [orgFilter, setOrgFilter] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteOrgId, setInviteOrgId] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [orgSearch, setOrgSearch] = useState("");
  const [inviteOrgSearch, setInviteOrgSearch] = useState("");
  const [inviteHistoryOpen, setInviteHistoryOpen] = useState(false);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [pwResetModalOpen, setPwResetModalOpen] = useState(false);
  const [pwResetLink, setPwResetLink] = useState("");
  const [pwResetUser, setPwResetUser] = useState<User | null>(null);
  const [pwResetCopied, setPwResetCopied] = useState(false);
  const limit = 20;

  useEffect(() => {
    fetch("/api/organizations?limit=1000&status=active")
      .then((r) => r.json())
      .then((json) => setOrgs(json.data || []))
      .catch(() => {});
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set("search", search);
      if (orgFilter) params.set("organization_id", orgFilter);
      if (activeOnly) params.set("status", "active");
      const res = await fetch(`/api/users?${params}`);
      if (res.ok) {
        const json = await res.json();
        setUsers(json.data);
        setTotal(json.total);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, orgFilter, activeOnly]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOrgSearch("");
    setModalOpen(true);
  };

  const openEdit = (user: User) => {
    setEditing(user);
    setForm({
      organization_id: String(user.organization_id),
      username: user.username,
      password: "",
      full_name: user.full_name || "",
      email: user.email || "",
      phone: user.phone || "",
      role: user.role || "user",
      status: user.status || "active",
      memo: user.memo || "",
    });
    setOrgSearch("");
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = editing ? `/api/users/${editing.user_id}` : "/api/users";
      const method = editing ? "PUT" : "POST";
      const body: any = { ...form, organization_id: Number(form.organization_id) };
      if (editing) delete body.password;
      if (!editing && !form.password) {
        await alert("비밀번호를 입력해주세요.");
        setSaving(false);
        return;
      }
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setModalOpen(false);
        fetchUsers();
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

  const handleDelete = async (user: User) => {
    const ok = await confirm({ message: `"${user.full_name || user.username}" 사용자를 삭제 처리하시겠습니까?`, confirmLabel: "삭제", variant: "danger" });
    if (!ok) return;
    try {
      const res = await fetch(`/api/users/${user.user_id}`, { method: "DELETE" });
      if (res.ok) fetchUsers();
      else await alert("삭제 처리에 실패했습니다.");
    } catch {
      await alert("삭제 처리 중 오류가 발생했습니다.");
    }
  };

  const roleLabels: Record<string, string> = { admin: "관리자", user: "사용자", viewer: "조회자" };
  const orgMap = new Map(orgs.map((o) => [o.organization_id, o.organization_name]));

  const handleInvite = async () => {
    if (!inviteOrgId) return;
    setInviteLoading(true);
    setInviteLink("");
    setCopied(false);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organization_id: Number(inviteOrgId) }),
      });
      if (res.ok) {
        const data = await res.json();
        setInviteLink(`${window.location.origin}/register/${data.token}`);
      } else {
        await alert("링크 발행에 실패했습니다.");
      }
    } catch {
      await alert("링크 발행 중 오류가 발생했습니다.");
    } finally {
      setInviteLoading(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fetchInvitations = async () => {
    setInvitationsLoading(true);
    try {
      const res = await fetch("/api/invitations?limit=50");
      if (res.ok) {
        const json = await res.json();
        setInvitations(json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setInvitationsLoading(false);
    }
  };

  const handlePwReset = async (user: User) => {
    const ok = await confirm({ message: `"${user.full_name || user.username}" 님의 비밀번호 변경 링크를 발행하시겠습니까?`, confirmLabel: "발행" });
    if (!ok) return;
    setPwResetUser(user);
    setPwResetLink("");
    setPwResetCopied(false);
    setPwResetModalOpen(true);
    try {
      const res = await fetch("/api/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.user_id }),
      });
      if (res.ok) {
        const data = await res.json();
        setPwResetLink(`${window.location.origin}/reset-password/${data.token}`);
      } else {
        await alert("링크 발행에 실패했습니다.");
        setPwResetModalOpen(false);
      }
    } catch {
      await alert("링크 발행 중 오류가 발생했습니다.");
      setPwResetModalOpen(false);
    }
  };

  const getInviteStatus = (inv: any): { label: string; classes: string } => {
    if (inv.used_at) return { label: "사용됨", classes: "bg-bg-badge-green text-text-badge-green" };
    if (new Date(inv.expires_at) < new Date()) return { label: "만료", classes: "bg-bg-badge-red text-text-badge-red" };
    return { label: "대기중", classes: "bg-bg-badge-blue text-text-badge-blue" };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">사용자 관리</h1>
        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={() => { fetchInvitations(); setInviteHistoryOpen(true); }}
              className="px-4 py-2 border border-border-primary text-text-secondary text-sm font-medium rounded-lg hover:bg-bg-hover"
            >
              초대 이력
            </button>
            <button
              onClick={() => { setInviteModalOpen(true); setInviteOrgId(""); setInviteLink(""); setCopied(false); setInviteOrgSearch(""); }}
              className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover"
            >
              초대 링크 발행
            </button>
            <button
              onClick={openCreate}
              className="px-4 py-2 border border-border-primary text-text-secondary text-sm font-medium rounded-lg hover:bg-bg-hover"
            >
              직접 추가
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={orgFilter}
          onChange={(e) => {
            setOrgFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">전체 기관</option>
          {orgs.map((o) => (
            <option key={o.organization_id} value={o.organization_id}>
              {o.organization_name}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="사용자명, 이름, 이메일로 검색..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="flex-1 min-w-[200px] px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer select-none whitespace-nowrap">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => {
              setActiveOnly(e.target.checked);
              setPage(1);
            }}
            className="w-4 h-4 rounded border-border-input accent-accent"
          />
          활성상태만 보기
        </label>
      </div>

      {/* Table */}
      <div className="bg-bg-card rounded-lg border border-border-primary">
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="border-b border-border-primary text-left text-text-secondary whitespace-nowrap">
                <th className="px-4 py-3 font-medium w-10">ID</th>
                <th className="px-4 py-3 font-medium w-[18%]">기관</th>
                <th className="px-4 py-3 font-medium w-[11%]">사용자명</th>
                <th className="px-4 py-3 font-medium w-[11%]">이름</th>
                <th className="px-4 py-3 font-medium w-[11%]">이메일</th>
                <th className="px-4 py-3 font-medium w-[11%]">전화</th>
                <th className="px-4 py-3 font-medium w-12">역할</th>
                <th className="px-4 py-3 font-medium w-12">상태</th>
                <th className="px-4 py-3 font-medium w-28">마지막 로그인</th>
                {isAdmin && <th className="px-4 py-3 font-medium w-10">관리</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-text-muted">
                    로딩 중...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-text-muted">
                    데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.user_id} className="border-b border-border-secondary hover:bg-bg-hover whitespace-nowrap">
                    <td className="px-4 py-2.5 text-text-secondary">{u.user_id}</td>
                    <td className="px-4 py-2.5">{u.organization_name || orgMap.get(u.organization_id) || u.organization_id}</td>
                    <td className="px-4 py-2.5 font-medium">{u.username}</td>
                    <td className="px-4 py-2.5">{u.full_name || "-"}</td>
                    <td className="px-4 py-2.5 text-text-secondary">{u.email || "-"}</td>
                    <td className="px-4 py-2.5 text-text-secondary">{u.phone || "-"}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-bg-badge-blue text-text-badge-blue">
                        {roleLabels[u.role] || u.role}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          u.status === "active"
                            ? "bg-bg-badge-green text-text-badge-green"
                            : "bg-bg-badge-red text-text-badge-red"
                        }`}
                      >
                        {u.status === "active" ? "활성" : "비활성"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-text-secondary">{formatDate(u.last_login_at)}</td>
                    {isAdmin && (
                      <td className="px-4 py-2.5">
                        <ActionMenu items={[
                          { label: "수정", onClick: () => openEdit(u) },
                          { label: "비밀번호 변경 링크", onClick: () => handlePwReset(u) },
                          { label: "삭제 처리", onClick: () => handleDelete(u), variant: "danger" },
                        ]} />
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 pb-3">
          <Pagination page={page} total={total} limit={limit} onChange={setPage} />
        </div>
      </div>

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "사용자 수정" : "사용자 추가"}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">기관</label>
            <input
              type="text"
              placeholder="기관명 검색..."
              value={orgSearch}
              onChange={(e) => setOrgSearch(e.target.value)}
              className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <div className="mt-1 max-h-36 overflow-y-auto border border-border-input rounded-lg bg-bg-input">
              {orgs
                .filter((o) => !orgSearch || o.organization_name.toLowerCase().includes(orgSearch.toLowerCase()))
                .map((o) => (
                  <button
                    key={o.organization_id}
                    type="button"
                    onClick={() => setForm({ ...form, organization_id: String(o.organization_id) })}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-bg-hover transition-colors ${
                      form.organization_id === String(o.organization_id)
                        ? "bg-accent/10 text-accent font-medium"
                        : "text-text-primary"
                    }`}
                  >
                    {o.organization_name}
                  </button>
                ))}
              {orgs.filter((o) => !orgSearch || o.organization_name.toLowerCase().includes(orgSearch.toLowerCase())).length === 0 && (
                <p className="px-3 py-2 text-sm text-text-muted">검색 결과가 없습니다.</p>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">사용자명</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          {!editing && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">비밀번호</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">이름</label>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">이메일</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">전화</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">역할</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="admin">관리자</option>
                <option value="user">사용자</option>
                <option value="viewer">조회자</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">상태</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="active">활성</option>
              <option value="inactive">비활성</option>
              <option value="deleted">삭제</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">메모</label>
            <textarea
              value={form.memo}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm border border-border-primary rounded-lg text-text-primary hover:bg-bg-hover"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.username || !form.organization_id}
              className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Password Reset Link Modal */}
      <Modal
        open={pwResetModalOpen}
        onClose={() => setPwResetModalOpen(false)}
        title="비밀번호 변경 링크"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            <span className="font-medium text-text-primary">{pwResetUser?.full_name || pwResetUser?.username}</span> 님의 비밀번호 변경 링크입니다.
          </p>
          {pwResetLink ? (
            <>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={pwResetLink}
                  className="flex-1 px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-tertiary text-text-primary font-mono"
                />
                <button
                  onClick={() => { navigator.clipboard.writeText(pwResetLink); setPwResetCopied(true); setTimeout(() => setPwResetCopied(false), 2000); }}
                  className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover shrink-0"
                >
                  {pwResetCopied ? "복사됨" : "복사"}
                </button>
              </div>
              <p className="text-xs text-text-muted">24시간 동안 유효하며 1회만 사용할 수 있습니다.</p>
            </>
          ) : (
            <p className="text-center text-text-muted py-4">링크 생성 중...</p>
          )}
          <div className="flex justify-end pt-2">
            <button
              onClick={() => setPwResetModalOpen(false)}
              className="px-4 py-2 text-sm border border-border-primary rounded-lg text-text-primary hover:bg-bg-hover"
            >
              닫기
            </button>
          </div>
        </div>
      </Modal>

      {/* Invite History Modal */}
      <Modal
        open={inviteHistoryOpen}
        onClose={() => setInviteHistoryOpen(false)}
        title="초대 이력"
        wide
      >
        <div className="overflow-x-auto">
          {invitationsLoading ? (
            <p className="text-center text-text-muted py-8">로딩 중...</p>
          ) : invitations.length === 0 ? (
            <p className="text-center text-text-muted py-8">발행된 초대가 없습니다.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-primary text-left text-text-secondary">
                  <th className="px-3 py-2 font-medium">기관</th>
                  <th className="px-3 py-2 font-medium">상태</th>
                  <th className="px-3 py-2 font-medium">발행일</th>
                  <th className="px-3 py-2 font-medium">만료일</th>
                  <th className="px-3 py-2 font-medium">사용일</th>
                  <th className="px-3 py-2 font-medium">링크</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv) => {
                  const status = getInviteStatus(inv);
                  const link = `${window.location.origin}/register/${inv.token}`;
                  return (
                    <tr key={inv.id} className="border-b border-border-secondary hover:bg-bg-hover whitespace-nowrap">
                      <td className="px-3 py-2">{inv.organization_name || inv.organization_id}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${status.classes}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-text-secondary">{formatDate(inv.created_at)}</td>
                      <td className="px-3 py-2 text-text-secondary">{formatDate(inv.expires_at)}</td>
                      <td className="px-3 py-2 text-text-secondary">{inv.used_at ? formatDate(inv.used_at) : "-"}</td>
                      <td className="px-3 py-2">
                        {!inv.used_at && new Date(inv.expires_at) > new Date() ? (
                          <button
                            onClick={() => { navigator.clipboard.writeText(link); }}
                            className="text-accent hover:text-accent-hover text-xs font-medium"
                          >
                            복사
                          </button>
                        ) : (
                          <span className="text-text-muted text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Modal>

      {/* Invite Modal */}
      <Modal
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        title="초대 링크 발행"
      >
        <div className="space-y-4">
          {!inviteLink ? (
            <>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">기관 선택</label>
                <input
                  type="text"
                  placeholder="기관명 검색..."
                  value={inviteOrgSearch}
                  onChange={(e) => setInviteOrgSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <div className="mt-1 max-h-36 overflow-y-auto border border-border-input rounded-lg bg-bg-input">
                  {orgs
                    .filter((o) => !inviteOrgSearch || o.organization_name.toLowerCase().includes(inviteOrgSearch.toLowerCase()))
                    .map((o) => (
                      <button
                        key={o.organization_id}
                        type="button"
                        onClick={() => setInviteOrgId(String(o.organization_id))}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-bg-hover transition-colors ${
                          inviteOrgId === String(o.organization_id)
                            ? "bg-accent/10 text-accent font-medium"
                            : "text-text-primary"
                        }`}
                      >
                        {o.organization_name}
                      </button>
                    ))}
                  {orgs.filter((o) => !inviteOrgSearch || o.organization_name.toLowerCase().includes(inviteOrgSearch.toLowerCase())).length === 0 && (
                    <p className="px-3 py-2 text-sm text-text-muted">검색 결과가 없습니다.</p>
                  )}
                </div>
              </div>
              <p className="text-xs text-text-muted">링크는 72시간 동안 유효하며 1회만 사용할 수 있습니다.</p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setInviteModalOpen(false)}
                  className="px-4 py-2 text-sm border border-border-primary rounded-lg text-text-primary hover:bg-bg-hover"
                >
                  취소
                </button>
                <button
                  onClick={handleInvite}
                  disabled={inviteLoading || !inviteOrgId}
                  className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50"
                >
                  {inviteLoading ? "발행 중..." : "링크 발행"}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-text-secondary">아래 링크를 사용자에게 전달해주세요.</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteLink}
                  className="flex-1 px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-tertiary text-text-primary font-mono"
                />
                <button
                  onClick={copyLink}
                  className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover shrink-0"
                >
                  {copied ? "복사됨" : "복사"}
                </button>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setInviteModalOpen(false)}
                  className="px-4 py-2 text-sm border border-border-primary rounded-lg text-text-primary hover:bg-bg-hover"
                >
                  닫기
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
