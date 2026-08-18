"use client";

import { useEffect, useState, useCallback } from "react";
import Modal from "@/components/Modal";
import Pagination from "@/components/Pagination";
import ActionMenu from "@/components/ActionMenu";
import { useAuth } from "@/components/AuthProvider";
import { useDialog } from "@/components/DialogProvider";

interface Organization {
  organization_id: number;
  organization_name: string;
  organization_phone: string;
  organization_address: string;
  status: string;
  created_at: string;
  enabled_features: string[];
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

const emptyForm = { organization_name: "", organization_phone: "", organization_address: "", status: "active" };

export default function OrganizationsPage() {
  const { canEdit: _canEdit } = useAuth();
  const isAdmin = _canEdit("/organizations");
  const { alert, confirm } = useDialog();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Organization | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [orgFeatures, setOrgFeatures] = useState<{ feature_id: number; code: string; name: string; description: string | null; enabled: number }[]>([]);
  const [featuresLoading, setFeaturesLoading] = useState(false);
  const [featuresSaving, setFeaturesSaving] = useState(false);
  const [featureModalOpen, setFeatureModalOpen] = useState(false);
  const [featureOrg, setFeatureOrg] = useState<Organization | null>(null);
  const limit = 20;

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set("search", search);
      if (activeOnly) params.set("status", "active");
      const res = await fetch(`/api/organizations?${params}`);
      if (res.ok) {
        const json = await res.json();
        setOrgs(json.data);
        setTotal(json.total);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, activeOnly]);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const fetchOrgFeatures = async (orgId: number) => {
    setFeaturesLoading(true);
    try {
      const res = await fetch(`/api/organizations/${orgId}/features`);
      if (res.ok) {
        const json = await res.json();
        setOrgFeatures(json.data || []);
      }
    } catch {
      setOrgFeatures([]);
    } finally {
      setFeaturesLoading(false);
    }
  };

  const openFeatures = (org: Organization) => {
    setFeatureOrg(org);
    fetchOrgFeatures(org.organization_id);
    setFeatureModalOpen(true);
  };

  const handleFeaturesSave = async () => {
    if (!featureOrg) return;
    setFeaturesSaving(true);
    try {
      const res = await fetch(`/api/organizations/${featureOrg.organization_id}/features`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ features: orgFeatures.map((f) => ({ feature_id: f.feature_id, enabled: !!f.enabled })) }),
      });
      if (res.ok) {
        await alert("기능 설정이 저장되었습니다.");
      } else {
        await alert("기능 설정 저장에 실패했습니다.");
      }
    } catch {
      await alert("기능 설정 저장 중 오류가 발생했습니다.");
    } finally {
      setFeaturesSaving(false);
    }
  };

  const toggleFeature = (featureId: number) => {
    setOrgFeatures((prev) =>
      prev.map((f) => f.feature_id === featureId ? { ...f, enabled: f.enabled ? 0 : 1 } : f)
    );
  };

  const openEdit = (org: Organization) => {
    setEditing(org);
    setForm({ organization_name: org.organization_name, organization_phone: org.organization_phone || "", organization_address: org.organization_address || "", status: org.status });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = editing ? `/api/organizations/${editing.organization_id}` : "/api/organizations";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setModalOpen(false);
        fetchOrgs();
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

  const handleDelete = async (org: Organization) => {
    const ok = await confirm({ message: `"${org.organization_name}" 기관을 비활성화하시겠습니까?`, confirmLabel: "비활성화", variant: "danger" });
    if (!ok) return;
    try {
      const res = await fetch(`/api/organizations/${org.organization_id}`, { method: "DELETE" });
      if (res.ok) {
        fetchOrgs();
      } else {
        await alert("비활성화에 실패했습니다.");
      }
    } catch {
      await alert("비활성화 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">기관 관리</h1>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-md hover:bg-accent-hover"
          >
            + 기관 추가
          </button>
        )}
      </div>

      {/* Search */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="기관명, 전화번호, 주소로 검색..."
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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-primary text-left text-text-secondary bg-bg-secondary">
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">이름</th>
                <th className="px-4 py-3 font-medium">전화</th>
                <th className="px-4 py-3 font-medium">주소</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="px-4 py-3 font-medium">특수 기능</th>
                <th className="px-4 py-3 font-medium">생성일</th>
                {isAdmin && <th className="px-4 py-3 font-medium">관리</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-text-muted">
                    로딩 중...
                  </td>
                </tr>
              ) : orgs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-text-muted">
                    데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                orgs.map((org) => (
                  <tr key={org.organization_id} className="border-b border-border-primary hover:bg-bg-hover whitespace-nowrap">
                    <td className="px-4 py-2.5 text-text-secondary">{org.organization_id}</td>
                    <td className="px-4 py-2.5 font-medium text-text-primary">{org.organization_name}</td>
                    <td className="px-4 py-2.5 text-text-secondary">{org.organization_phone || "-"}</td>
                    <td className="px-4 py-2.5 text-text-secondary">{org.organization_address || "-"}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          org.status === "active"
                            ? "bg-bg-badge-green text-text-badge-green"
                            : "bg-bg-badge-red text-text-badge-red"
                        }`}
                      >
                        {org.status === "active" ? "활성" : "비활성"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {org.enabled_features?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {org.enabled_features.map((f) => (
                            <span key={f} className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-bg-badge-teal text-text-badge-teal">
                              {f}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-text-muted text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-text-secondary">{formatDate(org.created_at)}</td>
                    {isAdmin && (
                      <td className="px-4 py-2.5">
                        <ActionMenu items={[
                          { label: "수정", onClick: () => openEdit(org) },
                          { label: "특수기능 설정", onClick: () => openFeatures(org) },
                          { label: "비활성화", onClick: () => handleDelete(org), variant: "danger" },
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
        title={editing ? "기관 수정" : "기관 추가"}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">이름</label>
            <input
              type="text"
              value={form.organization_name}
              onChange={(e) => setForm({ ...form, organization_name: e.target.value })}
              className="w-full px-3 py-2 border border-border-input rounded-md text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">전화</label>
            <input
              type="text"
              value={form.organization_phone}
              onChange={(e) => setForm({ ...form, organization_phone: e.target.value })}
              className="w-full px-3 py-2 border border-border-input rounded-md text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">주소</label>
            <input
              type="text"
              value={form.organization_address}
              onChange={(e) => setForm({ ...form, organization_address: e.target.value })}
              className="w-full px-3 py-2 border border-border-input rounded-md text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">상태</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full px-3 py-2 border border-border-input rounded-md text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="active">활성</option>
              <option value="inactive">비활성</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm rounded-md border border-border-primary text-text-secondary hover:bg-bg-hover"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.organization_name}
              className="px-4 py-2 text-sm rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>

        </div>
      </Modal>

      {/* Feature Settings Modal */}
      <Modal
        open={featureModalOpen}
        onClose={() => setFeatureModalOpen(false)}
        title={`특수기능 설정 — ${featureOrg?.organization_name || ""}`}
      >
        <div className="space-y-4">
          {featuresLoading ? (
            <p className="text-sm text-text-muted text-center py-4">로딩 중...</p>
          ) : orgFeatures.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-4">등록된 기능이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {orgFeatures.map((f) => (
                <label key={f.feature_id} className="flex items-center justify-between p-3 rounded-lg border border-border-primary hover:bg-bg-hover cursor-pointer">
                  <div className="flex-1 mr-3">
                    <span className="text-sm font-medium text-text-primary">{f.name}</span>
                    <span className="ml-2 text-[10px] font-mono text-text-muted">{f.code}</span>
                    {f.description && <p className="text-xs text-text-muted mt-0.5">{f.description}</p>}
                  </div>
                  <input
                    type="checkbox"
                    checked={!!f.enabled}
                    onChange={() => toggleFeature(f.feature_id)}
                    className="w-4 h-4 rounded border-border-input accent-accent shrink-0"
                  />
                </label>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setFeatureModalOpen(false)}
              className="px-4 py-2 text-sm border border-border-primary rounded-lg text-text-primary hover:bg-bg-hover"
            >
              취소
            </button>
            <button
              onClick={async () => { await handleFeaturesSave(); setFeatureModalOpen(false); fetchOrgs(); }}
              disabled={featuresSaving}
              className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50"
            >
              {featuresSaving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
