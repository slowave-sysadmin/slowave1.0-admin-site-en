"use client";

import { useEffect, useState, useCallback } from "react";
import Modal from "@/components/Modal";
import { useAuth } from "@/components/AuthProvider";
import { useDialog } from "@/components/DialogProvider";

interface SupportRequest {
  id: number;
  admin_username: string;
  category: string;
  title: string;
  description: string;
  status: string;
  reply: string | null;
  replied_by: string | null;
  replied_at: string | null;
  created_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  bug: "오류",
  feature: "기능 요청",
  question: "문의",
};

const CATEGORY_COLORS: Record<string, string> = {
  bug: "bg-bg-badge-red text-text-badge-red",
  feature: "bg-bg-badge-blue text-text-badge-blue",
  question: "bg-bg-badge-gray text-text-badge-gray",
};

const STATUS_LABELS: Record<string, string> = {
  open: "접수",
  in_progress: "처리 중",
  resolved: "완료",
};

const STATUS_COLORS: Record<string, string> = {
  open: "text-text-secondary",
  in_progress: "text-amber-600 dark:text-amber-400",
  resolved: "text-green-600 dark:text-green-400",
};

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

export default function SupportPage() {
  const { canEdit: _canEdit } = useAuth();
  const isAdmin = _canEdit("/support");
  const { alert } = useDialog();
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<SupportRequest | null>(null);

  // Form
  const [category, setCategory] = useState("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reply
  const [reply, setReply] = useState("");
  const [replyStatus, setReplyStatus] = useState("");
  const [replying, setReplying] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/support-requests");
      if (res.ok) {
        const json = await res.json();
        setRequests(json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      await alert("제목을 입력해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/support-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, title, description }),
      });
      if (res.ok) {
        setFormOpen(false);
        setTitle("");
        setDescription("");
        setCategory("bug");
        fetchRequests();
      } else {
        const err = await res.json().catch(() => null);
        await alert(err?.error || "등록에 실패했습니다.");
      }
    } catch {
      await alert("등록 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = (req: SupportRequest) => {
    setSelected(req);
    setReply(req.reply || "");
    setReplyStatus(req.status);
    setDetailOpen(true);
  };

  const handleReply = async () => {
    if (!selected) return;
    setReplying(true);
    try {
      const res = await fetch(`/api/support-requests/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply, status: replyStatus }),
      });
      if (res.ok) {
        setDetailOpen(false);
        fetchRequests();
      } else {
        await alert("저장에 실패했습니다.");
      }
    } catch {
      await alert("저장 중 오류가 발생했습니다.");
    } finally {
      setReplying(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">지원 요청</h1>
          <p className="text-sm text-text-muted mt-0.5">오류 신고, 기능 요청, 문의를 등록할 수 있습니다.</p>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover"
        >
          새 요청 등록
        </button>
      </div>

      {/* List */}
      <div className="bg-bg-card rounded-lg border border-border-primary">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-primary text-left text-text-secondary">
                <th className="px-4 py-3 font-medium w-20">유형</th>
                <th className="px-4 py-3 font-medium">제목</th>
                <th className="px-4 py-3 font-medium w-24">등록자</th>
                <th className="px-4 py-3 font-medium w-20">상태</th>
                <th className="px-4 py-3 font-medium w-36">등록일</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-text-muted">로딩 중...</td></tr>
              ) : requests.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-text-muted">등록된 요청이 없습니다.</td></tr>
              ) : (
                requests.map((req) => (
                  <tr
                    key={req.id}
                    onClick={() => openDetail(req)}
                    className="border-b border-border-secondary hover:bg-bg-hover cursor-pointer"
                  >
                    <td className="px-4 py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[req.category] || "bg-bg-badge-gray text-text-badge-gray"}`}>
                        {CATEGORY_LABELS[req.category] || req.category}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-text-primary">{req.title}</p>
                      {req.description && (
                        <p className="text-xs text-text-muted mt-0.5 truncate max-w-md">{req.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-text-secondary">{req.admin_username}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-medium ${STATUS_COLORS[req.status] || "text-text-secondary"}`}>
                        {STATUS_LABELS[req.status] || req.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-text-muted text-xs whitespace-nowrap">{formatDate(req.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Form Modal */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="지원 요청 등록">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">유형</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="bug">오류</option>
              <option value="feature">기능 요청</option>
              <option value="question">문의</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              제목 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="간단히 설명해주세요"
              className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">상세 내용</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="어떤 상황에서 발생했는지, 어떤 동작을 기대하는지 등을 적어주세요."
              rows={5}
              className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setFormOpen(false)}
              className="px-4 py-2 text-sm border border-border-primary rounded-lg text-text-primary hover:bg-bg-hover"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50"
            >
              {submitting ? "등록 중..." : "등록"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Detail / Reply Modal */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="지원 요청 상세">
        {selected && (
          <div className="space-y-5">
            {/* Request info */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[selected.category] || ""}`}>
                  {CATEGORY_LABELS[selected.category] || selected.category}
                </span>
                <span className={`text-xs font-medium ${STATUS_COLORS[selected.status] || ""}`}>
                  {STATUS_LABELS[selected.status] || selected.status}
                </span>
              </div>
              <h3 className="text-base font-semibold text-text-primary">{selected.title}</h3>
              {selected.description && (
                <p className="text-sm text-text-secondary whitespace-pre-line leading-relaxed">{selected.description}</p>
              )}
              <div className="flex gap-4 text-xs text-text-muted">
                <span>등록자: {selected.admin_username}</span>
                <span>{formatDate(selected.created_at)}</span>
              </div>
            </div>

            <hr className="border-border-primary" />

            {/* Existing reply */}
            {selected.reply && (
              <div className="bg-bg-tertiary rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-text-secondary">답변</span>
                  <span className="text-xs text-text-muted">{selected.replied_by} &middot; {formatDate(selected.replied_at || "")}</span>
                </div>
                <p className="text-sm text-text-primary whitespace-pre-line">{selected.reply}</p>
              </div>
            )}

            {/* Reply form (admin only) */}
            {isAdmin && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">상태 변경</label>
                  <select
                    value={replyStatus}
                    onChange={(e) => setReplyStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="open">접수</option>
                    <option value="in_progress">처리 중</option>
                    <option value="resolved">완료</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">답변</label>
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={4}
                    placeholder="답변을 입력하세요"
                    className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setDetailOpen(false)}
                    className="px-4 py-2 text-sm border border-border-primary rounded-lg text-text-primary hover:bg-bg-hover"
                  >
                    닫기
                  </button>
                  <button
                    onClick={handleReply}
                    disabled={replying}
                    className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50"
                  >
                    {replying ? "저장 중..." : "저장"}
                  </button>
                </div>
              </div>
            )}

            {!isAdmin && (
              <div className="flex justify-end">
                <button
                  onClick={() => setDetailOpen(false)}
                  className="px-4 py-2 text-sm border border-border-primary rounded-lg text-text-primary hover:bg-bg-hover"
                >
                  닫기
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
