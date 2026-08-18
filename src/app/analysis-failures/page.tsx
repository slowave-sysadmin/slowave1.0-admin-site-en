"use client";

import { useEffect, useState, useCallback } from "react";
import Modal from "@/components/Modal";
import Pagination from "@/components/Pagination";
import { useAuth } from "@/components/AuthProvider";
import { useDialog } from "@/components/DialogProvider";

interface FailureRow {
  test_id: string;
  serial_number: string;
  organization_id: number;
  organization_name: string;
  patient_name: string;
  status: string;
  status_analysis: string;
  created_at: string;
  note_id: number | null;
  failure_reason_id: number | null;
  failure_reason_name: string | null;
  note: string | null;
  action_taken: string | null;
  action_comment: string | null;
  noted_by: string | null;
  note_updated_at: string | null;
}

interface FailureReason {
  id: number;
  code: string;
  name: string;
}

interface ActionType {
  id: number;
  code: string;
  name: string;
}

interface Org {
  organization_id: number;
  organization_name: string;
}

const ANALYSIS_LABELS: Record<string, string> = {
  analyze_failed: "분석 실패",
  report_failed: "레포트 실패",
  report_generated: "레포트 생성",
};

function formatDate(d: string | null) {
  if (!d) return "-";
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min}`;
}

export default function AnalysisFailuresPage() {
  const { canEdit: _canEdit, isSystemAdmin } = useAuth();
  const isAdmin = _canEdit("/analysis-failures");
  const { alert } = useDialog();
  const [rows, setRows] = useState<FailureRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgFilter, setOrgFilter] = useState("");
  const [notedFilter, setNotedFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [reasons, setReasons] = useState<FailureReason[]>([]);

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<FailureRow | null>(null);
  const [formReasonId, setFormReasonId] = useState<number | "">("");
  const [formNote, setFormNote] = useState("");
  const [formAction, setFormAction] = useState("");
  const [formActionComment, setFormActionComment] = useState("");
  const [formNewStatus, setFormNewStatus] = useState("");
  const [saving, setSaving] = useState(false);

  // Actions
  const [actions, setActions] = useState<ActionType[]>([]);

  // Failure reason management modal
  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [allReasons, setAllReasons] = useState<(FailureReason & { description: string | null; is_enabled: number; sort_order: number })[]>([]);
  const [reasonForm, setReasonForm] = useState({ id: 0, code: "", name: "", description: "", is_enabled: 1 });
  const [reasonEditing, setReasonEditing] = useState(false);
  const [reasonSaving, setReasonSaving] = useState(false);
  const [dragReasonIdx, setDragReasonIdx] = useState<number | null>(null);

  // Action type management modal
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [allActions, setAllActions] = useState<(ActionType & { is_enabled: number; sort_order: number })[]>([]);
  const [actionForm, setActionForm] = useState({ id: 0, code: "", name: "", is_enabled: 1 });
  const [actionEditing, setActionEditing] = useState(false);
  const [actionSaving, setActionSaving] = useState(false);
  const [dragActionIdx, setDragActionIdx] = useState<number | null>(null);

  const limit = 30;

  useEffect(() => {
    fetch("/api/organizations?limit=1000&status=active")
      .then((r) => r.json())
      .then((json) => setOrgs(json.data || []))
      .catch(() => {});
    fetch("/api/failure-reasons")
      .then((r) => r.json())
      .then((json) => {
        const enabled = (json.data || []).filter((r: any) => r.is_enabled);
        setReasons(enabled);
        setAllReasons(json.data || []);
      })
      .catch(() => {});
    fetch("/api/action-types")
      .then((r) => r.json())
      .then((json) => {
        setActions((json.data || []).filter((a: any) => a.is_enabled));
        setAllActions(json.data || []);
      })
      .catch(() => {});
  }, []);

  const actionNameMap = new Map(allActions.map((a) => [a.code, a.name]));
  const getActionName = (code: string | null) => code ? (actionNameMap.get(code) || code) : "-";

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (orgFilter) params.set("organization_id", orgFilter);
      if (notedFilter) params.set("noted", notedFilter);
      if (statusFilter) params.set("status_filter", statusFilter);
      const res = await fetch(`/api/analysis-failures?${params}`);
      if (res.ok) {
        const json = await res.json();
        setRows(json.data || []);
        setTotal(json.total || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, orgFilter, notedFilter, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openDetail = (row: FailureRow) => {
    setSelected(row);
    setFormReasonId(row.failure_reason_id || "");
    setFormNote(row.note || "");
    setFormAction(row.action_taken || "");
    setFormActionComment(row.action_comment || "");
    setFormNewStatus(row.status_analysis);
    setDetailOpen(true);
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/analysis-failures/${selected.test_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          failure_reason_id: formReasonId || null,
          note: formNote,
          action_taken: formAction || null,
          action_comment: formActionComment || null,
          serial_number: selected.serial_number,
          organization_id: selected.organization_id,
          status_analysis: selected.status_analysis,
          new_status_analysis: formNewStatus !== selected.status_analysis ? formNewStatus : undefined,
        }),
      });
      if (res.ok) {
        setDetailOpen(false);
        fetchData();
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

  // Reason management
  const fetchReasons = async () => {
    const res = await fetch("/api/failure-reasons");
    if (res.ok) {
      const json = await res.json();
      setAllReasons(json.data || []);
      setReasons((json.data || []).filter((r: any) => r.is_enabled));
    }
  };

  const openReasonCreate = () => {
    setReasonForm({ id: 0, code: "", name: "", description: "", is_enabled: 1 });
    setReasonEditing(false);
  };

  const openReasonEdit = (r: any) => {
    setReasonForm({ id: r.id, code: r.code, name: r.name, description: r.description || "", is_enabled: r.is_enabled });
    setReasonEditing(true);
  };

  const handleReasonDrop = async (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const reordered = [...allReasons];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setAllReasons(reordered);
    // Save all sort orders
    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].sort_order !== i) {
        await fetch("/api/failure-reasons", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: reordered[i].id, name: reordered[i].name, description: reordered[i].description, is_enabled: reordered[i].is_enabled, sort_order: i }),
        });
      }
    }
    await fetchReasons();
  };

  const handleReasonSave = async () => {
    setReasonSaving(true);
    try {
      const method = reasonEditing ? "PUT" : "POST";
      const body = { ...reasonForm, sort_order: reasonEditing ? undefined : allReasons.length };
      const res = await fetch("/api/failure-reasons", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await fetchReasons();
        openReasonCreate();
      } else {
        const err = await res.json().catch(() => null);
        await alert(err?.error || "저장 실패");
      }
    } catch {
      await alert("저장 중 오류가 발생했습니다.");
    } finally {
      setReasonSaving(false);
    }
  };

  // Action type management
  const fetchActions = async () => {
    const res = await fetch("/api/action-types");
    if (res.ok) {
      const json = await res.json();
      setAllActions(json.data || []);
      setActions((json.data || []).filter((a: any) => a.is_enabled));
    }
  };

  const openActionCreate = () => {
    setActionForm({ id: 0, code: "", name: "", is_enabled: 1 });
    setActionEditing(false);
  };

  const openActionEdit = (a: any) => {
    setActionForm({ id: a.id, code: a.code, name: a.name, is_enabled: a.is_enabled });
    setActionEditing(true);
  };

  const handleActionDrop = async (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const reordered = [...allActions];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setAllActions(reordered);
    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].sort_order !== i) {
        await fetch("/api/action-types", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: reordered[i].id, name: reordered[i].name, is_enabled: reordered[i].is_enabled, sort_order: i }),
        });
      }
    }
    await fetchActions();
  };

  const handleActionSave = async () => {
    setActionSaving(true);
    try {
      const method = actionEditing ? "PUT" : "POST";
      const body = { ...actionForm, sort_order: actionEditing ? undefined : allActions.length };
      const res = await fetch("/api/action-types", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await fetchActions();
        openActionCreate();
      } else {
        const err = await res.json().catch(() => null);
        await alert(err?.error || "저장 실패");
      }
    } catch {
      await alert("저장 중 오류가 발생했습니다.");
    } finally {
      setActionSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">분석 실패 관리</h1>
        {isSystemAdmin ? (
          <div className="flex gap-2">
            <button
              onClick={() => setActionModalOpen(true)}
              className="px-4 py-2 border border-border-primary text-text-secondary text-sm font-medium rounded-lg hover:bg-bg-hover"
            >
              조치 유형 관리
            </button>
            <button
              onClick={() => setReasonModalOpen(true)}
              className="px-4 py-2 border border-border-primary text-text-secondary text-sm font-medium rounded-lg hover:bg-bg-hover"
            >
              실패 원인 관리
            </button>
          </div>
        ) : (
          <p className="text-xs text-text-muted">실패 원인/조치 유형의 추가, 수정은 시스템관리자에게 문의하세요.</p>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={orgFilter}
          onChange={(e) => { setOrgFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">전체 기관</option>
          {orgs.map((o) => (
            <option key={o.organization_id} value={o.organization_id}>{o.organization_name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); if (e.target.value === "resolved") setNotedFilter(""); setPage(1); }}
          className="px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">전체 상태</option>
          <option value="failed">미해결</option>
          <option value="resolved">해결됨</option>
        </select>
        <select
          value={notedFilter}
          onChange={(e) => { setNotedFilter(e.target.value); setPage(1); }}
          disabled={statusFilter === "resolved"}
          className="px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
        >
          <option value="">전체</option>
          <option value="0">미검토</option>
          <option value="1">검토됨</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-bg-card rounded-lg border border-border-primary">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-primary text-left text-text-secondary">
                <th className="px-4 py-3 font-medium">검사ID</th>
                <th className="px-4 py-3 font-medium">기관</th>
                <th className="px-4 py-3 font-medium">환자</th>
                <th className="px-4 py-3 font-medium">센서</th>
                <th className="px-4 py-3 font-medium">실패 유형</th>
                <th className="px-4 py-3 font-medium">원인</th>
                <th className="px-4 py-3 font-medium">조치</th>
                <th className="px-4 py-3 font-medium">검토</th>
                <th className="px-4 py-3 font-medium">검사일</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-text-muted">로딩 중...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-text-muted">데이터가 없습니다.</td></tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.test_id}
                    onClick={() => openDetail(row)}
                    className="border-b border-border-secondary hover:bg-bg-hover cursor-pointer"
                  >
                    <td className="px-4 py-2.5 font-mono">{row.test_id}</td>
                    <td className="px-4 py-2.5">{row.organization_name || "-"}</td>
                    <td className="px-4 py-2.5">{row.patient_name || "-"}</td>
                    <td className="px-4 py-2.5 font-mono">{row.serial_number || "-"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        row.status_analysis === "report_generated"
                          ? "bg-bg-badge-green text-text-badge-green"
                          : row.status_analysis === "analyze_failed"
                            ? "bg-bg-badge-red text-text-badge-red"
                            : "bg-bg-badge-yellow text-text-badge-yellow"
                      }`}>
                        {ANALYSIS_LABELS[row.status_analysis] || row.status_analysis}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {row.failure_reason_name ? (
                        <span className="text-text-primary">{row.failure_reason_name}</span>
                      ) : (
                        <span className="text-text-muted">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {row.action_taken ? (
                        <span className="text-text-primary">{getActionName(row.action_taken)}</span>
                      ) : (
                        <span className="text-text-muted">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {row.note_id ? (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-bg-badge-green text-text-badge-green">검토됨</span>
                      ) : (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-bg-badge-gray text-text-badge-gray">미검토</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-text-muted whitespace-nowrap">{formatDate(row.created_at)}</td>
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

      {/* Detail / Comment Modal */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="분석 실패 상세">
        {selected && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-text-muted">검사ID</span>
                <p className="font-mono text-text-primary">{selected.test_id}</p>
              </div>
              <div>
                <span className="text-text-muted">센서</span>
                <p className="font-mono text-text-primary">{selected.serial_number || "-"}</p>
              </div>
              <div>
                <span className="text-text-muted">기관</span>
                <p className="text-text-primary">{selected.organization_name || "-"}</p>
              </div>
              <div>
                <span className="text-text-muted">실패 유형</span>
                <p className={selected.status_analysis === "analyze_failed" ? "text-red-500" : "text-amber-500"}>
                  {ANALYSIS_LABELS[selected.status_analysis] || selected.status_analysis}
                </p>
              </div>
            </div>

            <hr className="border-border-primary" />

            {isAdmin ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    실패 원인 {formNewStatus === "report_generated" && <span className="text-red-500">*</span>}
                  </label>
                  <select
                    value={formReasonId}
                    onChange={(e) => setFormReasonId(e.target.value ? Number(e.target.value) : "")}
                    className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="">선택</option>
                    {reasons.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">실패 원인 코멘트</label>
                  <textarea
                    value={formNote}
                    onChange={(e) => setFormNote(e.target.value)}
                    rows={3}
                    placeholder="실패 원인에 대한 상세 내용을 기록하세요."
                    className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    조치 {formNewStatus === "report_generated" && <span className="text-red-500">*</span>}
                  </label>
                  <select
                    value={formAction}
                    onChange={(e) => setFormAction(e.target.value)}
                    className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="">선택</option>
                    {actions.map((a) => (
                      <option key={a.id} value={a.code}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">조치 코멘트</label>
                  <textarea
                    value={formActionComment}
                    onChange={(e) => setFormActionComment(e.target.value)}
                    rows={2}
                    placeholder="조치에 대한 상세 내용을 기록하세요."
                    className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                  />
                </div>

                <hr className="border-border-primary" />

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">분석 상태 변경</label>
                  <select
                    value={formNewStatus}
                    onChange={(e) => setFormNewStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="analyze_failed">분석 실패</option>
                    <option value="report_failed">레포트 실패</option>
                    <option value="report_generated">레포트 생성 (해결)</option>
                  </select>
                  {formNewStatus === "report_generated" && selected.status_analysis !== "report_generated" && (
                    <p className="text-xs text-amber-600 mt-1">상태를 &quot;레포트 생성&quot;으로 변경하면 실패 원인과 조치가 필수입니다.</p>
                  )}
                </div>

                {selected.noted_by && (
                  <p className="text-xs text-text-muted">마지막 작성: {selected.noted_by} ({formatDate(selected.note_updated_at)})</p>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setDetailOpen(false)} className="px-4 py-2 text-sm border border-border-primary rounded-lg text-text-primary hover:bg-bg-hover">취소</button>
                  <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50">
                    {saving ? "저장 중..." : "저장"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {selected.failure_reason_name && <p className="text-sm"><span className="text-text-muted">원인:</span> {selected.failure_reason_name}</p>}
                {selected.note && <p className="text-sm whitespace-pre-line"><span className="text-text-muted">실패 원인 코멘트:</span> {selected.note}</p>}
                {selected.action_taken && <p className="text-sm"><span className="text-text-muted">조치:</span> {getActionName(selected.action_taken)}</p>}
                {selected.action_comment && <p className="text-sm whitespace-pre-line"><span className="text-text-muted">조치 코멘트:</span> {selected.action_comment}</p>}
                {!selected.note_id && <p className="text-sm text-text-muted">코멘트가 없습니다.</p>}
                <div className="flex justify-end"><button onClick={() => setDetailOpen(false)} className="px-4 py-2 text-sm border border-border-primary rounded-lg text-text-primary hover:bg-bg-hover">닫기</button></div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Failure Reason Management Modal */}
      <Modal open={reasonModalOpen} onClose={() => setReasonModalOpen(false)} title="실패 원인 관리" wide>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* List */}
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-2">등록된 원인</h3>
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {allReasons.map((r, idx) => (
                <div
                  key={r.id}
                  draggable
                  onDragStart={() => setDragReasonIdx(idx)}
                  onDragOver={(e) => { e.preventDefault(); }}
                  onDrop={() => { if (dragReasonIdx !== null) handleReasonDrop(dragReasonIdx, idx); setDragReasonIdx(null); }}
                  onDragEnd={() => setDragReasonIdx(null)}
                  onClick={() => openReasonEdit(r)}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-grab active:cursor-grabbing transition-colors ${
                    dragReasonIdx === idx ? "opacity-50" : ""
                  } ${reasonForm.id === r.id ? "border-accent bg-accent/5" : "border-border-primary hover:bg-bg-hover"}`}
                >
                  <svg className="w-4 h-4 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-text-primary">{r.name}</span>
                    <span className="ml-2 text-[10px] font-mono text-text-muted">{r.code}</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${r.is_enabled ? "bg-bg-badge-green text-text-badge-green" : "bg-bg-badge-red text-text-badge-red"}`}>
                    {r.is_enabled ? "활성" : "비활성"}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {/* Form */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-text-secondary">{reasonEditing ? "수정" : "추가"}</h3>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">코드</label>
              <input
                type="text"
                value={reasonForm.code}
                onChange={(e) => setReasonForm({ ...reasonForm, code: e.target.value })}
                disabled={reasonEditing}
                placeholder="FAILURE_CODE"
                className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">이름</label>
              <input
                type="text"
                value={reasonForm.name}
                onChange={(e) => setReasonForm({ ...reasonForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">설명</label>
              <input
                type="text"
                value={reasonForm.description}
                onChange={(e) => setReasonForm({ ...reasonForm, description: e.target.value })}
                className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">상태</label>
              <select
                value={reasonForm.is_enabled}
                onChange={(e) => setReasonForm({ ...reasonForm, is_enabled: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value={1}>활성</option>
                <option value={0}>비활성</option>
              </select>
            </div>
            <p className="text-[10px] text-text-muted">왼쪽 목록에서 드래그하여 순서를 변경할 수 있습니다.</p>
            <div className="flex gap-2 pt-1">
              {reasonEditing && (
                <button onClick={openReasonCreate} className="px-3 py-2 text-sm border border-border-primary rounded-lg text-text-primary hover:bg-bg-hover">새로 추가</button>
              )}
              <button
                onClick={handleReasonSave}
                disabled={reasonSaving || !reasonForm.code || !reasonForm.name}
                className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50"
              >
                {reasonSaving ? "저장 중..." : reasonEditing ? "수정" : "추가"}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Action Type Management Modal */}
      <Modal open={actionModalOpen} onClose={() => setActionModalOpen(false)} title="조치 유형 관리" wide>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-2">등록된 조치 유형</h3>
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {allActions.map((a, idx) => (
                <div
                  key={a.id}
                  draggable
                  onDragStart={() => setDragActionIdx(idx)}
                  onDragOver={(e) => { e.preventDefault(); }}
                  onDrop={() => { if (dragActionIdx !== null) handleActionDrop(dragActionIdx, idx); setDragActionIdx(null); }}
                  onDragEnd={() => setDragActionIdx(null)}
                  onClick={() => openActionEdit(a)}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-grab active:cursor-grabbing transition-colors ${
                    dragActionIdx === idx ? "opacity-50" : ""
                  } ${actionForm.id === a.id ? "border-accent bg-accent/5" : "border-border-primary hover:bg-bg-hover"}`}
                >
                  <svg className="w-4 h-4 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-text-primary">{a.name}</span>
                    <span className="ml-2 text-[10px] font-mono text-text-muted">{a.code}</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${a.is_enabled ? "bg-bg-badge-green text-text-badge-green" : "bg-bg-badge-red text-text-badge-red"}`}>
                    {a.is_enabled ? "활성" : "비활성"}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-text-secondary">{actionEditing ? "수정" : "추가"}</h3>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">코드</label>
              <input
                type="text"
                value={actionForm.code}
                onChange={(e) => setActionForm({ ...actionForm, code: e.target.value })}
                disabled={actionEditing}
                placeholder="ACTION_CODE"
                className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">이름</label>
              <input
                type="text"
                value={actionForm.name}
                onChange={(e) => setActionForm({ ...actionForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">상태</label>
              <select
                value={actionForm.is_enabled}
                onChange={(e) => setActionForm({ ...actionForm, is_enabled: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value={1}>활성</option>
                <option value={0}>비활성</option>
              </select>
            </div>
            <p className="text-[10px] text-text-muted">왼쪽 목록에서 드래그하여 순서를 변경할 수 있습니다.</p>
            <div className="flex gap-2 pt-1">
              {actionEditing && (
                <button onClick={openActionCreate} className="px-3 py-2 text-sm border border-border-primary rounded-lg text-text-primary hover:bg-bg-hover">새로 추가</button>
              )}
              <button
                onClick={handleActionSave}
                disabled={actionSaving || !actionForm.code || !actionForm.name}
                className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50"
              >
                {actionSaving ? "저장 중..." : actionEditing ? "수정" : "추가"}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
