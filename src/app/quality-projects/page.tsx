"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { useAuth } from "@/components/AuthProvider";
import { useDialog } from "@/components/DialogProvider";

interface Project {
  problem_id: number;
  title: string;
  background: string | null;
  state: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  issue_count: number;
  step_count: number;
}

const STATE_LABELS: Record<string, string> = {
  open: "진행 중",
  closed: "종료",
};
const STATE_BADGE: Record<string, string> = {
  open: "bg-bg-badge-blue text-text-badge-blue",
  closed: "bg-bg-badge-gray text-text-badge-gray",
};

function fmtDate(d: string | null) {
  if (!d) return "-";
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : String(d);
}

export default function QualityProjectsPage() {
  const router = useRouter();
  const { canEdit } = useAuth();
  const canWrite = canEdit("/quality-projects");
  const { alert } = useDialog();

  const [rows, setRows] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: "", background: "" });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (stateFilter) params.set("state", stateFilter);
      const res = await fetch(`/api/quality-projects?${params}`);
      if (res.ok) {
        const json = await res.json();
        setRows(json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [stateFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    if (!form.title.trim()) {
      await alert("제목을 입력하세요.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/quality-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const { problem_id } = await res.json();
        setCreateOpen(false);
        setForm({ title: "", background: "" });
        router.push(`/quality-projects/${problem_id}`);
      } else {
        const err = await res.json().catch(() => null);
        await alert(err?.error || "생성 실패");
      }
    } catch {
      await alert("생성 중 오류 발생");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">품질개선프로젝트</h1>
        {canWrite && (
          <button
            onClick={() => setCreateOpen(true)}
            className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover"
          >
            + 새 프로젝트
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">전체 상태</option>
          <option value="open">진행 중</option>
          <option value="closed">종료</option>
        </select>
      </div>

      {loading ? (
        <div className="py-16 text-center text-text-muted">로딩 중...</div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-text-muted">프로젝트가 없습니다.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {rows.map((row) => (
            <button
              key={row.problem_id}
              onClick={() => router.push(`/quality-projects/${row.problem_id}`)}
              className="group text-left bg-bg-card rounded-xl border border-border-primary p-5 hover:border-accent hover:shadow-md transition-all flex flex-col gap-3 min-h-[180px]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-accent/10 text-accent text-xs font-bold font-mono">
                    {row.problem_id}
                  </span>
                  <h3 className="text-base font-semibold text-text-primary group-hover:text-accent line-clamp-2 leading-snug">
                    {row.title}
                  </h3>
                </div>
                <span className={`shrink-0 inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${STATE_BADGE[row.state] || ""}`}>
                  {STATE_LABELS[row.state] || row.state}
                </span>
              </div>

              {row.background && (
                <p className="text-xs text-text-muted line-clamp-3 leading-relaxed flex-1">{row.background}</p>
              )}

              <div className="flex items-center gap-3 text-xs text-text-secondary mt-auto pt-2 border-t border-border-secondary">
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                  </svg>
                  이슈 <span className="font-medium text-text-primary">{row.issue_count}</span>
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM7.5 6.75h12.75M7.5 12h12.75m-12.75 5.25h12.75" />
                  </svg>
                  노드 <span className="font-medium text-text-primary">{row.step_count}</span>
                </span>
                <span className="ml-auto text-text-muted whitespace-nowrap">{fmtDate(row.created_at)}</span>
              </div>

              {row.created_by && (
                <div className="text-[11px] text-text-muted -mt-2">작성자: {row.created_by}</div>
              )}
            </button>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="새 품질개선프로젝트">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">제목 *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">배경/요약</label>
            <textarea
              value={form.background}
              onChange={(e) => setForm({ ...form, background: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent resize-y"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setCreateOpen(false)}
              className="px-4 py-2 text-sm border border-border-primary rounded-lg text-text-primary hover:bg-bg-hover"
            >
              취소
            </button>
            <button
              onClick={handleCreate}
              disabled={saving}
              className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50"
            >
              {saving ? "생성 중..." : "생성"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
