"use client";

import { Suspense, useEffect, useState, useCallback, ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import Pagination from "@/components/Pagination";
import Modal from "@/components/Modal";

interface Test {
  id: number;
  organization_id: number;
  organization_name?: string;
  test_id: string;
  serial_number: string;
  patient_name: string;
  patient_birth_date: string;
  patient_phone: string;
  patient_gender: string;
  rental_date: string;
  return_due_date: string;
  return_date: string | null;
  test_date: string | null;
  manager_name: string | null;
  status: string;
  status_analysis: string;
  is_live: number;
  is_valid: number;
  is_reported: number;
  is_new: number;
  ReportLink: string;
  created_at: string;
  updated_at: string;
  has_log: number | null;
  cradle_on_time: string | null;
  cradle_on_battery: number | null;
  impedance_time: string | null;
  impedance_ch1: string | null;
  impedance_ch2: string | null;
  analyzed_at: string | null;
  excluded: number | null;
  exclude_reason: string | null;
}

interface Org {
  organization_id: number;
  organization_name: string;
}

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

function formatDateShort(d: string | null) {
  if (!d) return "-";
  const date = new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatElapsed(from: string | null, to: string | null): string {
  if (!from || !to) return "-";
  const diffMs = new Date(to).getTime() - new Date(from).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return "-";
  const totalMin = Math.floor(diffMs / 60000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}일`);
  if (h > 0) parts.push(`${h}시간`);
  if (d === 0) parts.push(`${m}분`);
  return parts.join(" ");
}

function highlight(text: string | null | undefined, keyword: string): ReactNode {
  if (!text) return "-";
  if (!keyword) return text;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    part.toLowerCase() === keyword.toLowerCase() ? (
      <mark key={i} className="bg-yellow-300 dark:bg-yellow-600 text-text-primary rounded-sm px-0.5">{part}</mark>
    ) : (
      part
    )
  );
}

const statusLabels: Record<string, string> = {
  rented: "대여중",
  completed: "완료",
  canceled: "취소",
  cancel: "취소",
  deleted: "삭제",
  returned: "반납",
  uploaded: "업로드됨",
  download_failed: "다운로드 실패",
  delete_failed: "삭제 실패",
  upload_failed: "업로드 실패",
  init_failed: "초기화 실패",
};

const statusColors: Record<string, string> = {
  rented: "bg-bg-badge-blue text-text-badge-blue",
  completed: "bg-bg-badge-green text-text-badge-green",
  canceled: "bg-bg-badge-gray text-text-badge-gray",
  cancel: "bg-bg-badge-gray text-text-badge-gray",
  deleted: "bg-bg-badge-red text-text-badge-red",
  returned: "bg-bg-badge-purple text-text-badge-purple",
  uploaded: "bg-bg-badge-teal text-text-badge-teal",
  download_failed: "bg-bg-badge-red text-text-badge-red",
  delete_failed: "bg-bg-badge-red text-text-badge-red",
  upload_failed: "bg-bg-badge-red text-text-badge-red",
  init_failed: "bg-bg-badge-red text-text-badge-red",
};

const analysisLabels: Record<string, string> = {
  none: "없음",
  pending: "대기",
  completed: "완료",
  failed: "실패",
};

const analysisColors: Record<string, string> = {
  none: "bg-bg-badge-gray text-text-badge-gray",
  pending: "bg-bg-badge-yellow text-text-badge-yellow",
  completed: "bg-bg-badge-green text-text-badge-green",
  failed: "bg-bg-badge-red text-text-badge-red",
};

export default function TestsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><p className="text-text-secondary">로딩 중...</p></div>}>
      <TestsContent />
    </Suspense>
  );
}

function TestsContent() {
  const searchParams = useSearchParams();
  const [tests, setTests] = useState<Test[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [orgFilter, setOrgFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [analysisFilter, setAnalysisFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [logTestId, setLogTestId] = useState("");
  const [logData, setLogData] = useState<unknown>(null);
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState("");
  const [analysisOnly, setAnalysisOnly] = useState(false);
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchMessage, setBatchMessage] = useState("");
  const [excludeTarget, setExcludeTarget] = useState<Test | null>(null);
  const [excludeReason, setExcludeReason] = useState("");
  const [excludeSubmitting, setExcludeSubmitting] = useState(false);
  const limit = 20;

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setIsSystemAdmin(data?.role === "system_admin"))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/organizations?limit=1000&status=active")
      .then((r) => r.json())
      .then((json) => setOrgs(json.data || []))
      .catch(() => {});
  }, []);

  const fetchTests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set("search", search);
      if (orgFilter) params.set("organization_id", orgFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (analysisFilter) params.set("status_analysis", analysisFilter);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      const res = await fetch(`/api/tests?${params}`);
      if (res.ok) {
        const json = await res.json();
        setTests(json.data);
        setTotal(json.total);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, orgFilter, statusFilter, analysisFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchTests();
  }, [fetchTests]);

  const runBatch = async () => {
    if (batchRunning) return;
    setBatchRunning(true);
    setBatchMessage("배치 실행 중...");
    try {
      const res = await fetch("/api/admin/test-analysis/batch", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setBatchMessage(json.error || "배치 실행 실패");
      } else {
        setBatchMessage(`처리 ${json.processed}건 (로그 있음 ${json.withLog} / 없음 ${json.withoutLog}), 남은 검사 ${json.remaining}건`);
        fetchTests();
      }
    } catch {
      setBatchMessage("배치 실행 중 오류 발생");
    } finally {
      setBatchRunning(false);
    }
  };

  const submitExclusion = async (testId: string, excluded: boolean, reason: string) => {
    setExcludeSubmitting(true);
    try {
      const res = await fetch(`/api/admin/test-analysis/${testId}/exclusion`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ excluded, reason }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error || "분석 제외 변경 실패");
        return;
      }
      setExcludeTarget(null);
      setExcludeReason("");
      fetchTests();
    } finally {
      setExcludeSubmitting(false);
    }
  };

  const openLog = async (testId: string) => {
    setLogTestId(testId);
    setLogData(null);
    setLogError("");
    setLogLoading(true);
    setLogModalOpen(true);
    try {
      const res = await fetch(`/api/device-logs/${testId}`);
      if (res.ok) {
        setLogData(await res.json());
      } else {
        setLogError("로그 파일을 찾을 수 없습니다.");
      }
    } catch {
      setLogError("로그를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLogLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-text-primary">검사 조회</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={orgFilter}
          onChange={(e) => { setOrgFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">전체 기관</option>
          {orgs.map((o) => (
            <option key={o.organization_id} value={o.organization_id}>
              {o.organization_name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">전체 상태</option>
          <option value="rented">대여중</option>
          <option value="completed">완료</option>
          <option value="canceled">취소</option>
          <option value="returned">반납</option>
          <option value="uploaded">업로드됨</option>
          <option value="deleted">삭제</option>
        </select>
        <select
          value={analysisFilter}
          onChange={(e) => { setAnalysisFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">전체 분석</option>
          <option value="none">없음</option>
          <option value="pending">대기</option>
          <option value="completed">완료</option>
          <option value="failed">실패</option>
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <span className="text-text-muted text-sm">~</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <input
          type="text"
          placeholder="환자명, 검사ID, 시리얼로 검색..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 min-w-[200px] px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <label className="flex items-center gap-2 text-sm text-text-secondary whitespace-nowrap cursor-pointer select-none">
          <input
            type="checkbox"
            checked={analysisOnly}
            onChange={(e) => setAnalysisOnly(e.target.checked)}
            className="accent-accent"
          />
          분석자료만 보기
        </label>
        {isSystemAdmin && (
          <button
            onClick={runBatch}
            disabled={batchRunning}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {batchRunning ? "실행 중..." : "배치 실행"}
          </button>
        )}
      </div>
      {batchMessage && (
        <div className="text-xs text-text-secondary">{batchMessage}</div>
      )}

      {/* Table */}
      <div className="bg-bg-card rounded-lg border border-border-primary">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-primary text-left text-text-secondary whitespace-nowrap">
                <th className="px-4 py-3 font-medium">검사ID</th>
                {!analysisOnly && <th className="px-4 py-3 font-medium">기관</th>}
                {!analysisOnly && <th className="px-4 py-3 font-medium">환자명</th>}
                {!analysisOnly && <th className="px-4 py-3 font-medium">성별</th>}
                {!analysisOnly && <th className="px-4 py-3 font-medium">생년월일</th>}
                <th className="px-4 py-3 font-medium">기기</th>
                <th className="px-4 py-3 font-medium">대여일</th>
                {!analysisOnly && <th className="px-4 py-3 font-medium">반납예정</th>}
                <th className="px-4 py-3 font-medium">반납일</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="px-4 py-3 font-medium">분석</th>
                <th className="px-4 py-3 font-medium">결과지</th>
                <th className="px-4 py-3 font-medium">로그</th>
                <th className="px-4 py-3 font-medium">생성일</th>
                {analysisOnly && (
                  <>
                    <th className="px-4 py-3 font-medium">CradleOn 일시</th>
                    <th className="px-4 py-3 font-medium">경과시간</th>
                    <th className="px-4 py-3 font-medium">CradleOn 배터리</th>
                    <th className="px-4 py-3 font-medium">임피던스 일시</th>
                    <th className="px-4 py-3 font-medium">임피던스 Ch1</th>
                    <th className="px-4 py-3 font-medium">임피던스 Ch2</th>
                    <th className="px-4 py-3 font-medium">분석 제외</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={analysisOnly ? 16 : 14} className="px-4 py-8 text-center text-text-muted">
                    로딩 중...
                  </td>
                </tr>
              ) : tests.length === 0 ? (
                <tr>
                  <td colSpan={analysisOnly ? 16 : 14} className="px-4 py-8 text-center text-text-muted">
                    데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                tests.map((t) => (
                  <tr key={t.id} className="border-b border-border-secondary hover:bg-bg-hover whitespace-nowrap">
                    <td className="px-4 py-2.5 font-mono text-xs">{highlight(t.test_id, search)}</td>
                    {!analysisOnly && <td className="px-4 py-2.5">{t.organization_name || t.organization_id}</td>}
                    {!analysisOnly && <td className="px-4 py-2.5 font-medium">{highlight(t.patient_name, search)}</td>}
                    {!analysisOnly && <td className="px-4 py-2.5 text-text-secondary">{t.patient_gender}</td>}
                    {!analysisOnly && <td className="px-4 py-2.5 text-text-secondary">{formatDateShort(t.patient_birth_date)}</td>}
                    <td className="px-4 py-2.5 font-mono text-xs">{highlight(t.serial_number, search)}</td>
                    <td className="px-4 py-2.5 text-text-secondary">{formatDateShort(t.rental_date)}</td>
                    {!analysisOnly && <td className="px-4 py-2.5 text-text-secondary">{formatDateShort(t.return_due_date)}</td>}
                    <td className="px-4 py-2.5 text-text-secondary">{formatDate(t.return_date)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColors[t.status] || "bg-bg-badge-gray text-text-badge-gray"}`}>
                        {statusLabels[t.status] || t.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${analysisColors[t.status_analysis] || "bg-bg-badge-gray text-text-badge-gray"}`}>
                        {analysisLabels[t.status_analysis] || t.status_analysis}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {t.is_reported ? (
                        <button
                          onClick={() => window.open(`/api/reports/${t.test_id}`, "_blank")}
                          className="text-accent hover:text-accent-hover text-xs font-medium"
                        >
                          보기
                        </button>
                      ) : (
                        <span className="text-text-muted text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {t.has_log === 0 ? (
                        <span className="text-text-muted text-xs">없음</span>
                      ) : (
                        <button
                          onClick={() => openLog(t.test_id)}
                          className="text-accent hover:text-accent-hover text-xs font-medium"
                        >
                          보기
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-text-secondary">{formatDate(t.created_at)}</td>
                    {analysisOnly && (
                      <>
                        <td className="px-4 py-2.5 text-text-secondary">{formatDate(t.cradle_on_time)}</td>
                        <td className="px-4 py-2.5 text-text-secondary">{formatElapsed(t.created_at, t.cradle_on_time)}</td>
                        <td className="px-4 py-2.5 text-text-secondary">{t.cradle_on_battery != null ? `${t.cradle_on_battery}%` : "-"}</td>
                        <td className="px-4 py-2.5 text-text-secondary">{formatDate(t.impedance_time)}</td>
                        <td className="px-4 py-2.5 text-text-secondary font-mono text-xs">{t.impedance_ch1 ?? "-"}</td>
                        <td className="px-4 py-2.5 text-text-secondary font-mono text-xs">{t.impedance_ch2 ?? "-"}</td>
                        <td className="px-4 py-2.5">
                          {t.excluded === 1 ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-bg-badge-gray text-text-badge-gray" title={t.exclude_reason || ""}>
                                제외됨
                              </span>
                              {isSystemAdmin && (
                                <button
                                  onClick={() => submitExclusion(t.test_id, false, "")}
                                  disabled={excludeSubmitting}
                                  className="text-accent hover:text-accent-hover text-xs font-medium disabled:opacity-50"
                                >
                                  복원
                                </button>
                              )}
                            </div>
                          ) : isSystemAdmin && t.has_log === 1 ? (
                            <button
                              onClick={() => { setExcludeTarget(t); setExcludeReason(""); }}
                              className="text-text-secondary hover:text-text-primary text-xs font-medium"
                            >
                              제외
                            </button>
                          ) : (
                            <span className="text-text-muted text-xs">-</span>
                          )}
                        </td>
                      </>
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

      {/* Exclude Modal */}
      <Modal
        open={excludeTarget !== null}
        onClose={() => { if (!excludeSubmitting) setExcludeTarget(null); }}
        title={`분석 제외 — ${excludeTarget?.test_id ?? ""}`}
      >
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">
            이 검사를 분석(산점도 및 통계)에서 제외합니다. 사유는 선택 입력입니다.
          </p>
          <textarea
            value={excludeReason}
            onChange={(e) => setExcludeReason(e.target.value)}
            placeholder="사유 (선택)"
            maxLength={200}
            rows={3}
            className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { if (!excludeSubmitting) setExcludeTarget(null); }}
              disabled={excludeSubmitting}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-border-input text-text-primary hover:bg-bg-hover disabled:opacity-50"
            >
              취소
            </button>
            <button
              onClick={() => excludeTarget && submitExclusion(excludeTarget.test_id, true, excludeReason)}
              disabled={excludeSubmitting}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {excludeSubmitting ? "처리 중..." : "제외"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Device Log Modal */}
      <Modal open={logModalOpen} onClose={() => setLogModalOpen(false)} title={`검사 로그 — ${logTestId}`} wide>
        {logLoading ? (
          <p className="text-text-muted text-center py-8">로딩 중...</p>
        ) : logError ? (
          <p className="text-text-muted text-center py-8">{logError}</p>
        ) : logData ? (
          <pre className="bg-bg-tertiary rounded-lg p-4 text-xs text-text-primary overflow-auto max-h-[70vh] font-mono whitespace-pre-wrap break-all">
            {JSON.stringify(logData, null, 2)}
          </pre>
        ) : null}
      </Modal>
    </div>
  );
}
