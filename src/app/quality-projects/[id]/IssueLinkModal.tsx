"use client";

import { useEffect, useState, useCallback } from "react";
import Modal from "@/components/Modal";
import { useDialog } from "@/components/DialogProvider";

interface IssueLite {
  issue_id: number;
  issue_no: number;
  received_at: string | null;
  problem_type: string | null;
  voc: string | null;
  assignee: string | null;
  customer_org: string | null;
  test_id: string | null;
}

const PROBLEM_LABELS: Record<string, string> = {
  measurement_failure: "측정 실패",
  low_data_quality: "데이터 품질 저하",
  device_detachment: "사용 중 이탈",
  skin_irritation: "부착부위 손상",
  patch_quality: "패치 품질",
  software_issue: "소프트웨어 문제",
  other: "기타",
};

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: number;
  initialIssueIds: number[];
  onSaved: () => void;
}

export default function IssueLinkModal({ open, onClose, projectId, initialIssueIds, onSaved }: Props) {
  const { alert } = useDialog();
  const [all, setAll] = useState<IssueLite[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: "1", limit: "500" });
      if (search) params.set("q", search);
      const res = await fetch(`/api/issues?${params}`);
      if (res.ok) {
        const json = await res.json();
        setAll(json.data || []);
      }
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    if (open) {
      setSelected(new Set(initialIssueIds));
      fetchIssues();
    }
  }, [open, initialIssueIds, fetchIssues]);

  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/quality-projects/${projectId}/issues`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issue_ids: Array.from(selected) }),
      });
      if (res.ok) {
        onSaved();
        onClose();
      } else {
        const err = await res.json().catch(() => null);
        await alert(err?.error || "저장 실패");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="이슈 연결" fullWidth>
      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="VOC, 원인, 사용자, 검사ID 검색"
            className="flex-1 px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            onClick={fetchIssues}
            className="px-3 py-2 border border-border-primary text-text-secondary text-sm rounded-lg hover:bg-bg-hover"
          >
            검색
          </button>
          <div className="px-3 py-2 text-sm text-text-secondary">
            선택: <span className="text-accent font-medium">{selected.size}</span>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto border border-border-primary rounded-lg">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-bg-card">
              <tr className="border-b border-border-primary text-left text-text-secondary">
                <th className="px-3 py-2 w-10"></th>
                <th className="px-3 py-2 w-12">No</th>
                <th className="px-3 py-2 w-24">접수일</th>
                <th className="px-3 py-2 w-28">유형</th>
                <th className="px-3 py-2">VOC</th>
                <th className="px-3 py-2 w-28">기관</th>
                <th className="px-3 py-2 w-24">검사ID</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-text-muted">로딩 중...</td></tr>
              ) : all.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-text-muted">데이터 없음</td></tr>
              ) : (
                all.map((i) => (
                  <tr
                    key={i.issue_id}
                    onClick={() => toggle(i.issue_id)}
                    className={`border-b border-border-secondary cursor-pointer ${
                      selected.has(i.issue_id) ? "bg-accent/10" : "hover:bg-bg-hover"
                    }`}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(i.issue_id)}
                        onChange={() => toggle(i.issue_id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-text-muted">{i.issue_no}</td>
                    <td className="px-3 py-2 text-text-muted">{i.received_at?.slice(0, 10) || "-"}</td>
                    <td className="px-3 py-2">{i.problem_type ? PROBLEM_LABELS[i.problem_type] || i.problem_type : "-"}</td>
                    <td className="px-3 py-2"><div className="line-clamp-1 max-w-md">{i.voc || "-"}</div></td>
                    <td className="px-3 py-2">{i.customer_org || "-"}</td>
                    <td className="px-3 py-2 font-mono">{i.test_id || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-border-primary rounded-lg text-text-primary hover:bg-bg-hover">
            취소
          </button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50">
            {saving ? "저장 중..." : `저장 (${selected.size}건)`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
