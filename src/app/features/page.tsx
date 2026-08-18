"use client";

import { useEffect, useState, useCallback } from "react";
import Modal from "@/components/Modal";
import { useAuth } from "@/components/AuthProvider";
import { useDialog } from "@/components/DialogProvider";

interface Feature {
  id: number;
  code: string;
  name: string;
  description: string | null;
  is_enabled: number;
  created_at: string;
}

const emptyForm = { code: "", name: "", description: "", is_enabled: 1 };

export default function FeaturesPage() {
  const { user } = useAuth();
  const { alert } = useDialog();
  const isSystemAdmin = user?.role === "system_admin";
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Feature | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchFeatures = useCallback(async () => {
    try {
      const res = await fetch("/api/features");
      if (res.ok) {
        const json = await res.json();
        setFeatures(json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (f: Feature) => {
    setEditing(f);
    setForm({ code: f.code, name: f.name, description: f.description || "", is_enabled: f.is_enabled });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const method = editing ? "PUT" : "POST";
      const body = editing ? { ...form, id: editing.id } : form;
      const res = await fetch("/api/features", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setModalOpen(false);
        fetchFeatures();
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">기능 관리</h1>
        {isSystemAdmin && (
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover"
          >
            기능 추가
          </button>
        )}
      </div>

      <div className="bg-bg-card rounded-lg border border-border-primary">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-primary text-left text-text-secondary">
                <th className="px-4 py-3 font-medium w-10">ID</th>
                <th className="px-4 py-3 font-medium w-40">코드</th>
                <th className="px-4 py-3 font-medium w-40">이름</th>
                <th className="px-4 py-3 font-medium">설명</th>
                <th className="px-4 py-3 font-medium w-20">상태</th>
                {isSystemAdmin && <th className="px-4 py-3 font-medium w-16">관리</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-text-muted">로딩 중...</td></tr>
              ) : features.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-text-muted">등록된 기능이 없습니다.</td></tr>
              ) : (
                features.map((f) => (
                  <tr key={f.id} className="border-b border-border-secondary hover:bg-bg-hover">
                    <td className="px-4 py-2.5 text-text-secondary">{f.id}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{f.code}</td>
                    <td className="px-4 py-2.5 font-medium">{f.name}</td>
                    <td className="px-4 py-2.5 text-text-secondary text-xs">{f.description || "-"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        f.is_enabled ? "bg-bg-badge-green text-text-badge-green" : "bg-bg-badge-red text-text-badge-red"
                      }`}>
                        {f.is_enabled ? "활성" : "비활성"}
                      </span>
                    </td>
                    {isSystemAdmin && (
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => openEdit(f)}
                          className="text-xs text-accent hover:text-accent-hover font-medium"
                        >
                          수정
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "기능 수정" : "기능 추가"}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">코드</label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="FEATURE_CODE"
              disabled={!!editing}
              className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 font-mono"
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
            <label className="block text-sm font-medium text-text-secondary mb-1">설명</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">상태</label>
            <select
              value={form.is_enabled}
              onChange={(e) => setForm({ ...form, is_enabled: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value={1}>활성</option>
              <option value={0}>비활성</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm border border-border-primary rounded-lg text-text-primary hover:bg-bg-hover">취소</button>
            <button onClick={handleSave} disabled={saving || !form.code || !form.name} className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50">
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
