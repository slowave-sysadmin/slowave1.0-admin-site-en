"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Modal from "@/components/Modal";
import Pagination from "@/components/Pagination";
import { useAuth } from "@/components/AuthProvider";
import { useDialog } from "@/components/DialogProvider";

interface Issue {
  issue_id: number;
  issue_no: number;
  reporter: string | null;
  received_at: string | null;
  problem_type: string | null;
  voc: string | null;
  response_stage: string | null;
  assignee: string | null;
  customer_org: string | null;
  product_type: string | null;
  product_used: string | null;
  firmware_ver: string | null;
  occurred_at: string | null;
  end_user: string | null;
  test_id: string | null;
  recovered_at: string | null;
  problem_check: string | null;
  root_cause: string | null;
  action_date: string | null;
  customer_response: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  attachment_count?: number;
}

const PROBLEM_TYPES = [
  { code: "measurement_failure", label: "측정 실패" },
  { code: "low_data_quality", label: "데이터 품질 저하" },
  { code: "device_detachment", label: "사용 중 이탈" },
  { code: "skin_irritation", label: "부착부위 피부 손상" },
  { code: "patch_quality", label: "패치 품질" },
  { code: "software_issue", label: "소프트웨어 문제" },
  { code: "other", label: "기타" },
];

const RESPONSE_STAGES = [
  { code: "received", label: "접수" },
  { code: "investigating", label: "원인 파악 중" },
  { code: "resolved", label: "완료" },
];

const PRODUCT_TYPES = [
  { code: "demo", label: "데모제품" },
  { code: "sales", label: "판매제품" },
  { code: "prototype", label: "시제품" },
  { code: "research", label: "과제용도" },
  { code: "internal", label: "내부테스트" },
];

const labelOf = (list: { code: string; label: string }[], code: string | null) =>
  code ? list.find((x) => x.code === code)?.label || code : "-";

const STAGE_BADGE: Record<string, string> = {
  received: "bg-bg-badge-gray text-text-badge-gray",
  investigating: "bg-bg-badge-yellow text-text-badge-yellow",
  resolved: "bg-bg-badge-green text-text-badge-green",
};

function toDateInput(d: string | null) {
  if (!d) return "";
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

function fmtDate(d: string | null) {
  if (!d) return "-";
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : String(d);
}

const emptyForm = {
  reporter: "",
  received_at: "",
  problem_type: "",
  voc: "",
  response_stage: "",
  assignee: "",
  customer_org: "",
  product_type: "",
  product_used: "",
  firmware_ver: "",
  occurred_at: "",
  end_user: "",
  test_id: "",
  recovered_at: "",
  problem_check: "",
  root_cause: "",
  action_date: "",
  customer_response: "",
  status: "active",
};

export default function IssuesPage() {
  const { canEdit } = useAuth();
  const canWrite = canEdit("/issues");
  const { alert, confirm } = useDialog();

  const [rows, setRows] = useState<Issue[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [problemType, setProblemType] = useState("");
  const [stage, setStage] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Issue | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const limit = 30;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (problemType) params.set("problem_type", problemType);
      if (stage) params.set("response_stage", stage);
      if (search) params.set("q", search);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      const res = await fetch(`/api/issues?${params}`);
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
  }, [page, problemType, stage, search, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (row: Issue) => {
    setEditing(row);
    setForm({
      reporter: row.reporter || "",
      received_at: toDateInput(row.received_at),
      problem_type: row.problem_type || "",
      voc: row.voc || "",
      response_stage: row.response_stage || "",
      assignee: row.assignee || "",
      customer_org: row.customer_org || "",
      product_type: row.product_type || "",
      product_used: row.product_used || "",
      firmware_ver: row.firmware_ver || "",
      occurred_at: toDateInput(row.occurred_at),
      end_user: row.end_user || "",
      test_id: row.test_id || "",
      recovered_at: toDateInput(row.recovered_at),
      problem_check: row.problem_check || "",
      root_cause: row.root_cause || "",
      action_date: toDateInput(row.action_date),
      customer_response: row.customer_response || "",
      status: row.status || "active",
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = editing ? `/api/issues/${editing.issue_id}` : `/api/issues`;
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setModalOpen(false);
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

  const handleDelete = async () => {
    if (!editing) return;
    const ok = await confirm({ message: `이슈 #${editing.issue_no}를 삭제하시겠습니까?`, variant: "danger", confirmLabel: "삭제" });
    if (!ok) return;
    try {
      const res = await fetch(`/api/issues/${editing.issue_id}`, { method: "DELETE" });
      if (res.ok) {
        setModalOpen(false);
        fetchData();
      } else {
        await alert("삭제 실패");
      }
    } catch {
      await alert("삭제 중 오류 발생");
    }
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">이슈 관리</h1>
        {canWrite && (
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover"
          >
            + 새 이슈
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={problemType}
          onChange={(e) => { setProblemType(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">전체 문제 유형</option>
          {PROBLEM_TYPES.map((t) => (
            <option key={t.code} value={t.code}>{t.label}</option>
          ))}
        </select>
        <select
          value={stage}
          onChange={(e) => { setStage(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">전체 대응 단계</option>
          {RESPONSE_STAGES.map((s) => (
            <option key={s.code} value={s.code}>{s.label}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          placeholder="접수일 시작"
          className="px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <span className="text-text-muted text-sm">~</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          placeholder="접수일 끝"
          className="px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <form onSubmit={submitSearch} className="flex gap-1 ml-auto">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="VOC, 원인, 사용자, 검사ID 검색"
            className="px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent w-64"
          />
          <button
            type="submit"
            className="px-3 py-2 border border-border-primary text-text-secondary text-sm rounded-lg hover:bg-bg-hover"
          >
            검색
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="bg-bg-card rounded-lg border border-border-primary">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-primary text-left text-text-secondary">
                <th className="px-3 py-3 font-medium w-12">No</th>
                <th className="px-3 py-3 font-medium w-24">접수일</th>
                <th className="px-3 py-3 font-medium w-20">작성자</th>
                <th className="px-3 py-3 font-medium w-28">문제 유형</th>
                <th className="px-3 py-3 font-medium w-[28rem]">VOC</th>
                <th className="px-3 py-3 font-medium w-20">대응</th>
                <th className="px-3 py-3 font-medium w-24">담당자</th>
                <th className="px-3 py-3 font-medium w-32">기관</th>
                <th className="px-3 py-3 font-medium w-24">검사ID</th>
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
                    key={row.issue_id}
                    onClick={() => openEdit(row)}
                    className="border-b border-border-secondary hover:bg-bg-hover cursor-pointer"
                  >
                    <td className="px-3 py-2.5 font-mono text-text-muted">{row.issue_no}</td>
                    <td className="px-3 py-2.5 text-text-muted whitespace-nowrap">{fmtDate(row.received_at)}</td>
                    <td className="px-3 py-2.5">{row.reporter || <span className="text-text-muted">-</span>}</td>
                    <td className="px-3 py-2.5">
                      {row.problem_type ? (
                        <span className="text-text-primary">{labelOf(PROBLEM_TYPES, row.problem_type)}</span>
                      ) : (
                        <span className="text-text-muted">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-text-primary line-clamp-2 whitespace-pre-line">{row.voc || "-"}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      {row.response_stage ? (
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${STAGE_BADGE[row.response_stage] || "bg-bg-badge-gray text-text-badge-gray"}`}>
                          {labelOf(RESPONSE_STAGES, row.response_stage)}
                        </span>
                      ) : (
                        <span className="text-text-muted">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">{row.assignee || <span className="text-text-muted">-</span>}</td>
                    <td className="px-3 py-2.5">{row.customer_org || <span className="text-text-muted">-</span>}</td>
                    <td className="px-3 py-2.5 font-mono">
                      {row.test_id ? (
                        <Link
                          href={`/tests?q=${row.test_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-accent hover:underline"
                        >
                          {row.test_id}
                        </Link>
                      ) : (
                        <span className="text-text-muted">-</span>
                      )}
                    </td>
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

      {/* Edit / Create Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `이슈 #${editing.issue_no}` : "새 이슈 등록"}
        fullWidth
      >
        <div className="space-y-4">
          {/* 기본 정보 */}
          <div className="grid grid-cols-4 gap-3">
            <Field label="작성자">
              <input
                type="text"
                value={form.reporter}
                onChange={(e) => setForm({ ...form, reporter: e.target.value })}
                disabled={!canWrite}
                className={inputCls}
              />
            </Field>
            <Field label="접수일">
              <input
                type="date"
                value={form.received_at}
                onChange={(e) => setForm({ ...form, received_at: e.target.value })}
                disabled={!canWrite}
                className={inputCls}
              />
            </Field>
            <Field label="대응 단계">
              <select
                value={form.response_stage}
                onChange={(e) => setForm({ ...form, response_stage: e.target.value })}
                disabled={!canWrite}
                className={inputCls}
              >
                <option value="">미지정</option>
                {RESPONSE_STAGES.map((s) => (
                  <option key={s.code} value={s.code}>{s.label}</option>
                ))}
              </select>
            </Field>
            <Field label="담당자">
              <input
                type="text"
                value={form.assignee}
                onChange={(e) => setForm({ ...form, assignee: e.target.value })}
                disabled={!canWrite}
                className={inputCls}
              />
            </Field>
          </div>

          {/* 문제 분류 */}
          <div className="grid grid-cols-4 gap-3">
            <Field label="문제 유형">
              <select
                value={form.problem_type}
                onChange={(e) => setForm({ ...form, problem_type: e.target.value })}
                disabled={!canWrite}
                className={inputCls}
              >
                <option value="">미지정</option>
                {PROBLEM_TYPES.map((t) => (
                  <option key={t.code} value={t.code}>{t.label}</option>
                ))}
              </select>
            </Field>
            <Field label="제품 유형">
              <select
                value={form.product_type}
                onChange={(e) => setForm({ ...form, product_type: e.target.value })}
                disabled={!canWrite}
                className={inputCls}
              >
                <option value="">미지정</option>
                {PRODUCT_TYPES.map((t) => (
                  <option key={t.code} value={t.code}>{t.label}</option>
                ))}
              </select>
            </Field>
            <Field label="펌웨어/버전">
              <input
                type="text"
                value={form.firmware_ver}
                onChange={(e) => setForm({ ...form, firmware_ver: e.target.value })}
                disabled={!canWrite}
                className={inputCls}
              />
            </Field>
            <Field label="검사 ID">
              <input
                type="text"
                value={form.test_id}
                onChange={(e) => setForm({ ...form, test_id: e.target.value })}
                disabled={!canWrite}
                placeholder="없으면 비워두세요"
                className={`${inputCls} font-mono`}
              />
            </Field>
          </div>

          {/* 발생 정보 */}
          <div className="grid grid-cols-4 gap-3">
            <Field label="발생일">
              <input
                type="date"
                value={form.occurred_at}
                onChange={(e) => setForm({ ...form, occurred_at: e.target.value })}
                disabled={!canWrite}
                className={inputCls}
              />
            </Field>
            <Field label="고객 (기관)">
              <input
                type="text"
                value={form.customer_org}
                onChange={(e) => setForm({ ...form, customer_org: e.target.value })}
                disabled={!canWrite}
                className={inputCls}
              />
            </Field>
            <Field label="사용자">
              <input
                type="text"
                value={form.end_user}
                onChange={(e) => setForm({ ...form, end_user: e.target.value })}
                disabled={!canWrite}
                className={inputCls}
              />
            </Field>
            <Field label="사용 제품">
              <input
                type="text"
                value={form.product_used}
                onChange={(e) => setForm({ ...form, product_used: e.target.value })}
                disabled={!canWrite}
                placeholder="센서 시리얼 등"
                className={inputCls}
              />
            </Field>
          </div>

          <hr className="border-border-primary" />

          {/* VOC */}
          <Field label="VOC (사용자 문의/증상)">
            <textarea
              value={form.voc}
              onChange={(e) => setForm({ ...form, voc: e.target.value })}
              rows={3}
              disabled={!canWrite}
              className={`${inputCls} resize-y`}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="문제 확인 (로그/체크 결과)">
              <textarea
                value={form.problem_check}
                onChange={(e) => setForm({ ...form, problem_check: e.target.value })}
                rows={5}
                disabled={!canWrite}
                className={`${inputCls} resize-y font-mono text-xs`}
              />
            </Field>
            <Field label="원인 파악">
              <textarea
                value={form.root_cause}
                onChange={(e) => setForm({ ...form, root_cause: e.target.value })}
                rows={5}
                disabled={!canWrite}
                className={`${inputCls} resize-y`}
              />
            </Field>
          </div>

          <hr className="border-border-primary" />

          {/* 조치 */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="회수일">
              <input
                type="date"
                value={form.recovered_at}
                onChange={(e) => setForm({ ...form, recovered_at: e.target.value })}
                disabled={!canWrite}
                className={inputCls}
              />
            </Field>
            <Field label="조치일">
              <input
                type="date"
                value={form.action_date}
                onChange={(e) => setForm({ ...form, action_date: e.target.value })}
                disabled={!canWrite}
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="고객 대응">
            <textarea
              value={form.customer_response}
              onChange={(e) => setForm({ ...form, customer_response: e.target.value })}
              rows={3}
              disabled={!canWrite}
              className={`${inputCls} resize-y`}
            />
          </Field>

          {/* 첨부 placeholder */}
          {editing && (
            <div className="p-3 border border-dashed border-border-primary rounded-lg text-xs text-text-muted">
              사진/파일 첨부 기능은 다음 업데이트에서 추가됩니다.
            </div>
          )}

          {/* Actions */}
          {canWrite && (
            <div className="flex justify-between items-center pt-2">
              <div>
                {editing && (
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 text-sm border border-red-500 text-red-500 rounded-lg hover:bg-red-500/10"
                  >
                    삭제
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm border border-border-primary rounded-lg text-text-primary hover:bg-bg-hover"
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50"
                >
                  {saving ? "저장 중..." : editing ? "수정" : "등록"}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-secondary mb-1">{label}</label>
      {children}
    </div>
  );
}
