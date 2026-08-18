"use client";

import React, { useEffect, useState, useCallback } from "react";
import Modal from "@/components/Modal";
import { useAuth } from "@/components/AuthProvider";
import { useDialog } from "@/components/DialogProvider";

interface OrgCard {
  organization_id: number;
  organization_name: string;
  status: string;
  category: string;
  sensor_total: number;
  sensor_active: number;
  test_count: number;
  failure_count: number;
  last_test_at: string | null;
  last_login_at: string | null;
  category_description: string | null;
}

function formatRelativeDate(d: string | null) {
  if (!d) return "-";
  const date = new Date(d);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "오늘";
  if (diff === 1) return "어제";
  if (diff < 7) return `${diff}일 전`;
  if (diff < 30) return `${Math.floor(diff / 7)}주 전`;
  if (diff < 365) return `${Math.floor(diff / 30)}개월 전`;
  return `${Math.floor(diff / 365)}년 전`;
}

const CATEGORY_LABELS: Record<string, string> = {
  internal: "본사전용",
  demo: "데모",
  research: "연구",
  sales: "판매",
  none: "미분류",
};

const CATEGORY_COLORS: Record<string, string> = {
  internal: "bg-amber-500",
  demo: "bg-blue-500",
  research: "bg-purple-500",
  sales: "bg-green-500",
  none: "bg-gray-400",
};

const CATEGORY_ORDER = ["sales", "demo", "research", "internal", "none"];

export default function FieldStatusPage() {
  const { canEdit: _canEdit } = useAuth();
  const isAdmin = _canEdit("/field-status");
  const { alert } = useDialog();
  const [data, setData] = useState<OrgCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<OrgCard | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("none");
  const [selectedDescription, setSelectedDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/field-status");
      if (res.ok) {
        const json = await res.json();
        setData(json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCategoryModal = (org: OrgCard) => {
    setSelectedOrg(org);
    setSelectedCategory(org.category);
    setSelectedDescription(org.category_description || "");
    setCategoryModalOpen(true);
  };

  const handleCategorySave = async () => {
    if (!selectedOrg) return;
    setSaving(true);
    try {
      const res = await fetch("/api/organization-categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organization_id: selectedOrg.organization_id, category: selectedCategory, description: selectedDescription }),
      });
      if (res.ok) {
        setCategoryModalOpen(false);
        fetchData();
      } else {
        await alert("저장에 실패했습니다.");
      }
    } catch {
      await alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  // Group by category
  const grouped = CATEGORY_ORDER.reduce<Record<string, OrgCard[]>>((acc, cat) => {
    const items = data.filter((d) => d.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  // Summary
  const totalOrgs = data.length;
  const totalSensors = data.reduce((s, d) => s + Number(d.sensor_total), 0);
  const activeSensors = data.reduce((s, d) => s + Number(d.sensor_active), 0);
  const totalTests = data.reduce((s, d) => s + Number(d.test_count), 0);
  const totalFailures = data.reduce((s, d) => s + Number(d.failure_count), 0);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-text-secondary">로딩 중...</p></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">현장 현황</h1>

      {/* Single Table with Category Groups */}
      <div className="bg-bg-card rounded-lg border border-border-primary">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] table-fixed">
            <thead>
              <tr className="border-b border-border-primary text-left text-text-secondary">
                <th className="px-4 py-2.5 font-medium w-[35%]">기관</th>
                <th className="px-4 py-2.5 font-medium text-right w-[8%]">센서</th>
                <th className="px-4 py-2.5 font-medium text-right w-[8%]">검사</th>
                <th className="px-4 py-2.5 font-medium text-right w-[12%]">실패</th>
                <th className="px-4 py-2.5 font-medium text-right w-[12%]">최근 검사</th>
                <th className="px-4 py-2.5 font-medium text-right w-[12%]">최근 로그인</th>
                {isAdmin && <th className="px-4 py-2.5 font-medium w-[5%]"></th>}
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped).map(([category, orgs]) => (
                <React.Fragment key={category}>
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6} className="px-4 py-2 bg-bg-tertiary">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-2 h-2 rounded-full ${CATEGORY_COLORS[category]}`} />
                        <span className="text-xs font-bold text-text-primary">{CATEGORY_LABELS[category]}</span>
                        <span className="text-xs text-text-muted">{orgs.length}</span>
                      </div>
                    </td>
                  </tr>
                  {orgs.map((org) => {
                    const failureRate = Number(org.test_count) > 0
                      ? Math.round((Number(org.failure_count) / Number(org.test_count)) * 100 * 10) / 10
                      : 0;
                    return (
                      <tr key={org.organization_id} className="border-b border-border-secondary hover:bg-bg-hover group">
                        <td className="px-4 py-2.5">
                          <span className="font-medium text-text-primary">{org.organization_name}</span>
                          {org.category_description && (
                            <span className="ml-2 text-text-muted">{org.category_description}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium">{Number(org.sensor_active)}</td>
                        <td className="px-4 py-2.5 text-right font-medium">{Number(org.test_count).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={`font-medium ${Number(org.failure_count) > 0 ? "text-red-500" : "text-text-primary"}`}>
                            {Number(org.failure_count)}
                          </span>
                          {failureRate > 0 && (
                            <span className={`ml-1 ${failureRate > 10 ? "text-red-500" : failureRate > 5 ? "text-amber-500" : "text-text-muted"}`}>
                              ({failureRate}%)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right text-text-muted">{formatRelativeDate(org.last_test_at)}</td>
                        <td className="px-4 py-2.5 text-right text-text-muted">{formatRelativeDate(org.last_login_at)}</td>
                        {isAdmin && (
                          <td className="px-4 py-2.5">
                            <button
                              onClick={() => openCategoryModal(org)}
                              className="text-text-muted hover:text-text-primary transition-colors opacity-0 group-hover:opacity-100"
                              title="카테고리 변경"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                              </svg>
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {data.length === 0 && (
        <div className="bg-bg-card rounded-xl border border-border-primary p-8 text-center">
          <p className="text-text-muted">활성 기관이 없습니다.</p>
        </div>
      )}

      {/* Category Edit Modal */}
      <Modal open={categoryModalOpen} onClose={() => setCategoryModalOpen(false)} title="카테고리 설정">
        {selectedOrg && (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              <span className="font-medium text-text-primary">{selectedOrg.organization_name}</span>의 카테고리를 선택하세요.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORY_ORDER.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                    selectedCategory === cat
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border-primary text-text-secondary hover:bg-bg-hover"
                  }`}
                >
                  <span className={`w-3 h-3 rounded-full ${CATEGORY_COLORS[cat]}`} />
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">설명</label>
              <input
                type="text"
                value={selectedDescription}
                onChange={(e) => setSelectedDescription(e.target.value)}
                placeholder="기관에 대한 간단한 설명"
                className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setCategoryModalOpen(false)}
                className="px-4 py-2 text-sm border border-border-primary rounded-lg text-text-primary hover:bg-bg-hover"
              >
                취소
              </button>
              <button
                onClick={handleCategorySave}
                disabled={saving}
                className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
