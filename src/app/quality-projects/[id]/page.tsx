"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Modal from "@/components/Modal";
import { useAuth } from "@/components/AuthProvider";
import { useDialog } from "@/components/DialogProvider";
import IssueLinkModal from "./IssueLinkModal";

interface Project {
  problem_id: number;
  title: string;
  background: string | null;
  state: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface Step {
  step_id: number;
  parent_step_id: number | null;
  kind: string;
  title: string;
  body: string | null;
  result_status: string | null;
  expected_result: string | null;
  actual_result: string | null;
  position_x: number | null;
  position_y: number | null;
  created_at?: string;
  updated_at?: string;
}

interface LinkedIssue {
  issue_id: number;
  issue_no: number;
  received_at: string | null;
  problem_type: string | null;
  voc: string | null;
  customer_org: string | null;
  test_id: string | null;
}

const KINDS = ["hypothesis", "experiment", "observation", "decision"] as const;
type Kind = typeof KINDS[number];

const KIND_LABELS: Record<string, string> = {
  hypothesis: "가설",
  experiment: "실험",
  observation: "관찰",
  decision: "결정",
};

const KIND_BAR: Record<string, string> = {
  hypothesis: "bg-blue-500",
  experiment: "bg-amber-500",
  observation: "bg-violet-500",
  decision: "bg-emerald-500",
};

const KIND_BADGE: Record<string, string> = {
  hypothesis: "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  experiment: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  observation: "bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300",
  decision: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
};

const RESULTS = ["planned", "running", "success", "fail", "partial", "inconclusive"] as const;
const RESULT_LABELS: Record<string, string> = {
  planned: "계획",
  running: "진행 중",
  success: "성공",
  fail: "실패",
  partial: "부분 성공",
  inconclusive: "미결",
};
const RESULT_BADGE: Record<string, string> = {
  planned: "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200",
  running: "bg-yellow-200 dark:bg-yellow-800/40 text-yellow-800 dark:text-yellow-200",
  success: "bg-green-200 dark:bg-green-800/40 text-green-800 dark:text-green-200",
  fail: "bg-red-200 dark:bg-red-800/40 text-red-800 dark:text-red-200",
  partial: "bg-amber-200 dark:bg-amber-800/40 text-amber-800 dark:text-amber-200",
  inconclusive: "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200",
};

function fmtDateTime(d: string | null | undefined) {
  if (!d) return "-";
  const date = new Date(d);
  if (isNaN(date.getTime())) return String(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${mi}`;
}

// 가설(hypothesis)은 항상 depth 0 (새 사이클의 시작점).
// 그 외 항목은 가장 가까운 가설 조상까지의 거리 = depth.
// 가설 조상이 없으면 부모 체인 길이.
function computeDepth(stepId: number, byId: Map<number, Step>): number {
  const self = byId.get(stepId);
  if (!self) return 0;
  if (self.kind === "hypothesis") return 0;

  let depth = 0;
  let cur: Step | undefined = self;
  const seen = new Set<number>();
  while (cur?.parent_step_id != null) {
    if (seen.has(cur.step_id)) break;
    seen.add(cur.step_id);
    depth++;
    if (depth > 10) break;
    const next = byId.get(cur.parent_step_id);
    if (!next) break;
    if (next.kind === "hypothesis") return depth;
    cur = next;
  }
  return depth;
}

const emptyForm = {
  kind: "hypothesis" as Kind,
  title: "",
  body: "",
  parent_step_id: "" as number | "",
  result_status: "planned",
  expected_result: "",
  actual_result: "",
};

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = Number(params.id);
  const router = useRouter();
  const { canEdit } = useAuth();
  const canWrite = canEdit("/quality-projects");
  const { alert, confirm } = useDialog();

  const [project, setProject] = useState<Project | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [issues, setIssues] = useState<LinkedIssue[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingProject, setEditingProject] = useState(false);
  const [projectForm, setProjectForm] = useState({ title: "", background: "", state: "open" });
  const [issueModalOpen, setIssueModalOpen] = useState(false);

  // Step modal (create + edit)
  const [stepModalOpen, setStepModalOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<Step | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/quality-projects/${projectId}`);
      if (res.ok) {
        const json = await res.json();
        setProject(json.project);
        setSteps(json.steps || []);
        setIssues(json.issues || []);
        setProjectForm({
          title: json.project.title,
          background: json.project.background || "",
          state: json.project.state,
        });
      } else if (res.status === 404) {
        await alert("프로젝트를 찾을 수 없습니다.");
        router.push("/quality-projects");
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, alert, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const sorted = useMemo(() => {
    return [...steps].sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (ta !== tb) return ta - tb;
      return a.step_id - b.step_id;
    });
  }, [steps]);

  const byId = useMemo(() => new Map(steps.map((s) => [s.step_id, s])), [steps]);

  const openCreate = (kind: Kind) => {
    setEditingStep(null);
    setForm({ ...emptyForm, kind, parent_step_id: sorted.length > 0 ? sorted[sorted.length - 1].step_id : "" });
    setStepModalOpen(true);
  };

  const openEdit = (s: Step) => {
    setEditingStep(s);
    setForm({
      kind: s.kind as Kind,
      title: s.title,
      body: s.body || "",
      parent_step_id: s.parent_step_id ?? "",
      result_status: s.result_status || "planned",
      expected_result: s.expected_result || "",
      actual_result: s.actual_result || "",
    });
    setStepModalOpen(true);
  };

  const handleSaveStep = async () => {
    if (!form.title.trim()) { await alert("제목을 입력하세요."); return; }
    setSaving(true);
    try {
      const url = editingStep
        ? `/api/quality-projects/${projectId}/steps/${editingStep.step_id}`
        : `/api/quality-projects/${projectId}/steps`;
      const method = editingStep ? "PUT" : "POST";
      const payload = {
        kind: form.kind,
        title: form.title,
        body: form.body,
        parent_step_id: form.parent_step_id || null,
        result_status: form.result_status,
        expected_result: form.kind === "experiment" ? form.expected_result : null,
        actual_result: form.kind === "experiment" ? form.actual_result : null,
      };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setStepModalOpen(false);
        await fetchData();
      } else {
        const err = await res.json().catch(() => null);
        await alert(err?.error || "저장 실패");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStep = async () => {
    if (!editingStep) return;
    const ok = await confirm({ message: `"${editingStep.title}" 삭제? (자식 항목은 부모 연결만 해제됨)`, variant: "danger", confirmLabel: "삭제" });
    if (!ok) return;
    const res = await fetch(`/api/quality-projects/${projectId}/steps/${editingStep.step_id}`, { method: "DELETE" });
    if (res.ok) {
      setStepModalOpen(false);
      await fetchData();
    }
  };

  const saveProjectMeta = async () => {
    const res = await fetch(`/api/quality-projects/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(projectForm),
    });
    if (res.ok) {
      setEditingProject(false);
      await fetchData();
    } else {
      await alert("저장 실패");
    }
  };

  if (loading || !project) {
    return <div className="p-8 text-text-muted">로딩 중...</div>;
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <Link href="/quality-projects" className="hover:text-text-primary">품질개선프로젝트</Link>
            <span>/</span>
            <span>#{project.problem_id}</span>
          </div>
          {editingProject ? (
            <div className="space-y-2 mt-1">
              <input
                type="text"
                value={projectForm.title}
                onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
                className="w-full text-xl font-bold px-3 py-1.5 border border-border-input rounded-lg bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <textarea
                value={projectForm.background}
                onChange={(e) => setProjectForm({ ...projectForm, background: e.target.value })}
                rows={2}
                placeholder="배경/요약"
                className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent resize-y"
              />
              <div className="flex gap-2 items-center">
                <select
                  value={projectForm.state}
                  onChange={(e) => setProjectForm({ ...projectForm, state: e.target.value })}
                  className="px-3 py-1.5 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary"
                >
                  <option value="open">진행 중</option>
                  <option value="closed">종료</option>
                </select>
                <button onClick={saveProjectMeta} className="px-3 py-1.5 text-sm bg-accent text-white rounded-lg">저장</button>
                <button onClick={() => setEditingProject(false)} className="px-3 py-1.5 text-sm border border-border-primary rounded-lg text-text-primary">취소</button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-text-primary mt-0.5 break-words">{project.title}</h1>
              {project.background && (
                <p className="text-sm text-text-muted mt-1 whitespace-pre-line">{project.background}</p>
              )}
            </>
          )}
        </div>
        {canWrite && !editingProject && (
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setEditingProject(true)} className="px-3 py-2 border border-border-primary text-text-secondary text-sm rounded-lg hover:bg-bg-hover">
              프로젝트 편집
            </button>
            <button onClick={() => setIssueModalOpen(true)} className="px-3 py-2 border border-border-primary text-text-secondary text-sm rounded-lg hover:bg-bg-hover">
              이슈 연결 ({issues.length})
            </button>
          </div>
        )}
      </div>

      {/* Linked issues (compact chips) */}
      {issues.length > 0 && (
        <div className="bg-bg-card rounded-lg border border-border-primary px-3 py-2">
          <div className="flex flex-wrap gap-1.5">
            {issues.map((i) => (
              <Link
                key={i.issue_id}
                href={`/issues?q=${i.issue_no}`}
                className="text-[11px] px-2 py-0.5 rounded bg-bg-tertiary text-text-secondary hover:bg-bg-hover"
                title={i.voc || ""}
              >
                #{i.issue_no} {i.voc?.slice(0, 30) || ""}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Add buttons */}
      {canWrite && (
        <div className="flex flex-wrap gap-2 sticky top-0 bg-bg-base z-10 py-2">
          <button onClick={() => openCreate("hypothesis")} className="px-3 py-1.5 text-sm rounded-lg border border-blue-500 text-blue-600 dark:text-blue-300 hover:bg-blue-500/10">+ 가설</button>
          <button onClick={() => openCreate("experiment")} className="px-3 py-1.5 text-sm rounded-lg border border-amber-500 text-amber-600 dark:text-amber-300 hover:bg-amber-500/10">+ 실험</button>
          <button onClick={() => openCreate("observation")} className="px-3 py-1.5 text-sm rounded-lg border border-violet-500 text-violet-600 dark:text-violet-300 hover:bg-violet-500/10">+ 관찰</button>
          <button onClick={() => openCreate("decision")} className="px-3 py-1.5 text-sm rounded-lg border border-emerald-500 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/10">+ 결정</button>
        </div>
      )}

      {/* Timeline */}
      {sorted.length === 0 ? (
        <div className="py-16 text-center text-text-muted text-sm">
          항목이 없습니다. 위쪽 버튼으로 가설/실험/관찰/결정을 추가하세요.
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((s) => {
            const depth = Math.min(computeDepth(s.step_id, byId), 4);
            const parent = s.parent_step_id ? byId.get(s.parent_step_id) : null;
            return (
              <div
                key={s.step_id}
                style={{ marginLeft: `${depth * 28}px` }}
                onClick={() => canWrite && openEdit(s)}
                className={`relative bg-bg-card rounded-lg border border-border-primary overflow-hidden ${canWrite ? "cursor-pointer hover:border-accent transition-colors" : ""}`}
              >
                <div className={`absolute top-0 left-0 bottom-0 w-1 ${KIND_BAR[s.kind] || "bg-gray-400"}`} />
                <div className="pl-5 pr-4 py-3.5">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <span className="text-xs font-mono text-text-muted shrink-0">#{s.step_id}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${KIND_BADGE[s.kind] || ""}`}>
                        {KIND_LABELS[s.kind] || s.kind}
                      </span>
                      {s.kind === "experiment" && s.result_status && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${RESULT_BADGE[s.result_status] || ""}`}>
                          {RESULT_LABELS[s.result_status] || s.result_status}
                        </span>
                      )}
                      {parent && (
                        <span className="text-[10px] text-text-muted truncate">
                          ↳ #{parent.step_id} {parent.title.slice(0, 28)}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col items-end text-[11px] text-text-muted shrink-0">
                      <span className="whitespace-nowrap">{fmtDateTime(s.created_at)}</span>
                      {s.updated_at && s.created_at && s.updated_at !== s.created_at && (
                        <span className="whitespace-nowrap">수정 {fmtDateTime(s.updated_at)}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-base font-semibold text-text-primary leading-snug">{s.title}</div>
                  {s.body && (
                    <div className="text-sm text-text-secondary mt-2 whitespace-pre-line leading-relaxed">{s.body}</div>
                  )}
                  {s.kind === "experiment" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-border-secondary">
                      <div>
                        <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1">계획 (방법·예상결과)</div>
                        <div className="text-sm whitespace-pre-line text-text-secondary leading-relaxed">
                          {s.expected_result || <span className="text-text-muted italic">(미작성)</span>}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1">결과 (실제·결론)</div>
                        <div className="text-sm whitespace-pre-line text-text-secondary leading-relaxed">
                          {s.actual_result || <span className="text-text-muted italic">(미작성)</span>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Step Modal */}
      <Modal
        open={stepModalOpen}
        onClose={() => setStepModalOpen(false)}
        title={editingStep ? `${KIND_LABELS[form.kind]} 편집` : `새 ${KIND_LABELS[form.kind]}`}
        wide
      >
        <div className="space-y-3">
          <Field label="종류">
            <select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as Kind })}
              disabled={!canWrite}
              className={inputCls}
            >
              {KINDS.map((k) => (<option key={k} value={k}>{KIND_LABELS[k]}</option>))}
            </select>
          </Field>

          <Field label="제목 *">
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              disabled={!canWrite}
              className={inputCls}
            />
          </Field>

          <Field label="부모 연결 (선택)">
            <select
              value={form.parent_step_id}
              onChange={(e) => setForm({ ...form, parent_step_id: e.target.value ? Number(e.target.value) : "" })}
              disabled={!canWrite}
              className={inputCls}
            >
              <option value="">(없음 — 최상위)</option>
              {sorted
                .filter((s) => !editingStep || s.step_id !== editingStep.step_id)
                .map((s) => (
                  <option key={s.step_id} value={s.step_id}>
                    #{s.step_id} [{KIND_LABELS[s.kind]}] {s.title.slice(0, 40)}
                  </option>
                ))}
            </select>
          </Field>

          <Field label="내용">
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={3}
              disabled={!canWrite}
              placeholder={
                form.kind === "hypothesis" ? "왜 그런가? 어떻게 풀린다고 보는가?"
                : form.kind === "experiment" ? "실험 개요. 계획/결과는 아래에 따로 기록"
                : form.kind === "observation" ? "관찰 내용, 데이터, 정황"
                : "결정/판단 내용"
              }
              className={`${inputCls} resize-y`}
            />
          </Field>

          {form.kind === "experiment" && (
            <>
              <Field label="결과 상태">
                <select
                  value={form.result_status}
                  onChange={(e) => setForm({ ...form, result_status: e.target.value })}
                  disabled={!canWrite}
                  className={inputCls}
                >
                  {RESULTS.map((r) => (<option key={r} value={r}>{RESULT_LABELS[r]}</option>))}
                </select>
              </Field>
              <Field label="계획 (실험 방법 · 예상 결과)">
                <textarea
                  value={form.expected_result}
                  onChange={(e) => setForm({ ...form, expected_result: e.target.value })}
                  rows={3}
                  disabled={!canWrite}
                  placeholder="어떻게 측정/검증할 것인지. 가설이 맞다면 어떤 결과가 나와야 하는지"
                  className={`${inputCls} resize-y`}
                />
              </Field>
              <Field label="결과 (실제 측정 · 결론)">
                <textarea
                  value={form.actual_result}
                  onChange={(e) => setForm({ ...form, actual_result: e.target.value })}
                  rows={3}
                  disabled={!canWrite}
                  placeholder="실제로 어떤 결과가 나왔는지. 가설과의 일치/불일치"
                  className={`${inputCls} resize-y`}
                />
              </Field>
            </>
          )}

          {canWrite && (
            <div className="flex justify-between items-center pt-2">
              <div>
                {editingStep && (
                  <button onClick={handleDeleteStep} className="px-3 py-2 text-sm border border-red-500 text-red-500 rounded-lg hover:bg-red-500/10">
                    삭제
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStepModalOpen(false)} className="px-4 py-2 text-sm border border-border-primary rounded-lg text-text-primary hover:bg-bg-hover">
                  취소
                </button>
                <button onClick={handleSaveStep} disabled={saving} className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50">
                  {saving ? "저장 중..." : editingStep ? "수정" : "등록"}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <IssueLinkModal
        open={issueModalOpen}
        onClose={() => setIssueModalOpen(false)}
        projectId={projectId}
        initialIssueIds={issues.map((i) => i.issue_id)}
        onSaved={fetchData}
      />
    </div>
  );
}

const inputCls = "w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-secondary mb-1">{label}</label>
      {children}
    </div>
  );
}
