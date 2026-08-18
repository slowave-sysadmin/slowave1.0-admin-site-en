"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";

interface StatusCount {
  status: string;
  count: number;
}

interface OrgTestSummary {
  organization_id: number;
  organization_name: string;
  total: number;
  report_success: number;
  report_failed: number;
  not_returned: number;
  other: number;
  prev_total: number;
}

type DrillFilter = "total" | "report_success" | "report_failed" | "not_returned" | "other";

const drillFilterLabels: Record<DrillFilter, string> = {
  total: "전체 검사",
  report_success: "레포트 성공",
  report_failed: "레포트 실패",
  not_returned: "미회수",
  other: "기타",
};

interface DashboardData {
  totalOrganizations: number;
  totalUsers: number;
  devicesByStatus: StatusCount[];
  testsByStatus: StatusCount[];
  recentTests: Record<string, unknown>[];
  testsByDate: { date: string; count: number }[];
  testsByOrg: OrgTestSummary[];
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

function formatShortDate(d: string) {
  const date = new Date(d);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

const statusLabels: Record<string, string> = {
  available: "사용 가능",
  inactive: "비활성",
  retired: "폐기",
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
  none: "없음",
};

const statusColors: Record<string, string> = {
  available: "bg-bg-badge-green text-text-badge-green",
  inactive: "bg-bg-badge-yellow text-text-badge-yellow",
  retired: "bg-bg-badge-red text-text-badge-red",
  rented: "bg-bg-badge-blue text-text-badge-blue",
  completed: "bg-bg-badge-green text-text-badge-green",
  canceled: "bg-bg-badge-gray text-text-badge-gray",
  cancel: "bg-bg-badge-gray text-text-badge-gray",
  deleted: "bg-bg-badge-red text-text-badge-red",
  returned: "bg-bg-badge-purple text-text-badge-purple",
  uploaded: "bg-bg-badge-teal text-text-badge-teal",
  none: "bg-bg-badge-gray text-text-badge-gray",
};

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartDays, setChartDays] = useState(7);
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillOrg, setDrillOrg] = useState<OrgTestSummary | null>(null);
  const [drillFilter, setDrillFilter] = useState<DrillFilter>("total");
  const [drillTests, setDrillTests] = useState<Record<string, unknown>[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard?days=${chartDays}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error("대시보드 데이터 로드 실패:", err);
    } finally {
      setLoading(false);
    }
  }, [chartDays]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openDrill = useCallback(async (org: OrgTestSummary, filter: DrillFilter) => {
    setDrillOrg(org);
    setDrillFilter(filter);
    setDrillOpen(true);
    setDrillLoading(true);
    setDrillTests([]);

    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const dateTo = today.toISOString().slice(0, 10);
    const dateFrom = weekAgo.toISOString().slice(0, 10);

    const params = new URLSearchParams({
      organization_id: String(org.organization_id),
      date_from: dateFrom,
      date_to: dateTo,
      limit: "200",
    });
    if (filter === "report_success") params.set("is_reported", "1");
    if (filter === "report_failed") params.set("report_failed", "1");
    if (filter === "not_returned") params.set("not_returned", "1");
    if (filter === "other") params.set("other", "1");

    try {
      const res = await fetch(`/api/tests?${params}`);
      if (res.ok) {
        const json = await res.json();
        setDrillTests(json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDrillLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-text-secondary">로딩 중...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-text-badge-red">데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  const totalDevices = data.devicesByStatus.find((d) => d.status === "available")?.count || 0;
  const totalTests = data.testsByStatus.reduce((s, t) => s + t.count, 0);

  const summaryCards = [
    { label: "기관", value: data.totalOrganizations, color: "border-accent", href: "/organizations" },
    { label: "사용자", value: data.totalUsers, color: "border-accent", href: "/users" },
    { label: "센서", value: totalDevices, color: "border-accent", href: "/devices" },
    { label: "검사", value: totalTests, color: "border-accent", href: "/tests" },
  ];

  const maxTestCount = Math.max(1, ...data.testsByDate.map((t) => t.count));

  const orgTotals = data.testsByOrg.reduce(
    (acc, o) => ({
      total: acc.total + Number(o.total),
      report_success: acc.report_success + Number(o.report_success),
      report_failed: acc.report_failed + Number(o.report_failed),
      not_returned: acc.not_returned + Number(o.not_returned),
      other: acc.other + Number(o.other),
      prev_total: acc.prev_total + Number(o.prev_total),
    }),
    { total: 0, report_success: 0, report_failed: 0, not_returned: 0, other: 0, prev_total: 0 }
  );

  const renderDiff = (current: number, prev: number) => {
    const diff = current - prev;
    if (diff === 0) return <span className="text-text-muted text-xs ml-1">(-)</span>;
    return (
      <span className={`text-xs ml-1 ${diff > 0 ? "text-text-badge-green" : "text-text-badge-red"}`}>
        ({diff > 0 ? "+" : ""}{diff})
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">대시보드</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            onClick={() => router.push(card.href)}
            className={`bg-bg-card rounded-lg border-l-4 ${card.color} border border-border-primary p-5 shadow-sm cursor-pointer hover:bg-bg-hover transition-colors group`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-secondary">{card.label}</p>
              <svg className="w-4 h-4 text-text-muted group-hover:text-text-primary transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-text-primary mt-1">
              {card.value?.toLocaleString() ?? 0}
            </p>
          </div>
        ))}
      </div>

      {/* Tests by Organization (Last 7 Days) */}
      <div className="bg-bg-card rounded-lg border border-border-primary p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-text-secondary mb-4">최근 7일 기관별 검사 현황</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-primary text-left text-text-secondary">
                <th className="pb-2 pr-4 font-medium">기관</th>
                <th className="pb-2 pr-4 font-medium text-right">총 검사</th>
                <th className="pb-2 pr-4 font-medium text-right">레포트 성공</th>
                <th className="pb-2 pr-4 font-medium text-right">레포트 실패</th>
                <th className="pb-2 pr-4 font-medium text-right">미회수</th>
                <th className="pb-2 font-medium text-right">기타</th>
              </tr>
            </thead>
            <tbody>
              {data.testsByOrg.map((org) => (
                <tr
                  key={org.organization_name}
                  onClick={() => openDrill(org, "total")}
                  className="border-b border-border-secondary cursor-pointer hover:bg-bg-hover"
                >
                  <td className="py-2.5 pr-4 font-medium">{org.organization_name}</td>
                  <td className="py-2.5 pr-4 text-right">
                    {org.total}
                    {renderDiff(Number(org.total), Number(org.prev_total))}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-text-badge-green font-medium">{org.report_success}</td>
                  <td className="py-2.5 pr-4 text-right text-text-badge-red font-medium">{org.report_failed}</td>
                  <td className="py-2.5 pr-4 text-right text-text-badge-blue font-medium">{org.not_returned}</td>
                  <td className="py-2.5 text-right text-text-muted">{org.other}</td>
                </tr>
              ))}
              {data.testsByOrg.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-text-muted">최근 7일간 검사가 없습니다.</td>
                </tr>
              )}
            </tbody>
            {data.testsByOrg.length > 0 && (
              <tfoot>
                <tr className="border-t border-border-primary font-semibold">
                  <td className="py-2.5 pr-4">합계</td>
                  <td className="py-2.5 pr-4 text-right">
                    {orgTotals.total}
                    {renderDiff(orgTotals.total, orgTotals.prev_total)}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-text-badge-green">{orgTotals.report_success}</td>
                  <td className="py-2.5 pr-4 text-right text-text-badge-red">{orgTotals.report_failed}</td>
                  <td className="py-2.5 pr-4 text-right text-text-badge-blue">{orgTotals.not_returned}</td>
                  <td className="py-2.5 text-right text-text-muted">{orgTotals.other}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Bar Chart - Tests by Date */}
      <div className="bg-bg-card rounded-lg border border-border-primary p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-secondary">검사 현황</h3>
          <div className="flex gap-1 bg-bg-tertiary rounded-lg p-0.5">
            {[7, 30].map((d) => (
              <button
                key={d}
                onClick={() => setChartDays(d)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  chartDays === d
                    ? "bg-bg-card text-text-primary shadow-sm"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                최근 {d}일
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-end gap-3 h-48">
          {data.testsByDate.map((item) => (
            <div key={item.date} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs text-text-secondary font-medium">{item.count}</span>
              <div
                className="w-full bg-accent rounded-t transition-all"
                style={{
                  height: `${Math.max(4, (item.count / maxTestCount) * 160)}px`,
                }}
              />
              <span className="text-xs text-text-muted mt-1">
                {formatShortDate(item.date)}
              </span>
            </div>
          ))}
          {data.testsByDate.length === 0 && (
            <p className="text-sm text-text-muted w-full text-center">데이터가 없습니다.</p>
          )}
        </div>
      </div>

      {/* Recent Tests Table */}
      <div className="bg-bg-card rounded-lg border border-border-primary p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-text-secondary mb-4">최근 검사</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-primary text-left text-text-secondary">
                <th className="pb-2 pr-4 font-medium">검사ID</th>
                <th className="pb-2 pr-4 font-medium">기관</th>
                <th className="pb-2 pr-4 font-medium">환자</th>
                <th className="pb-2 pr-4 font-medium">센서</th>
                <th className="pb-2 pr-4 font-medium">상태</th>
                <th className="pb-2 font-medium">생성일</th>
              </tr>
            </thead>
            <tbody>
              {data.recentTests.map((test) => (
                <tr key={test.id as number} className="border-b border-border-secondary">
                  <td className="py-2.5 pr-4 text-text-secondary font-mono text-xs">
                    {(test.test_id as string) || "-"}
                  </td>
                  <td className="py-2.5 pr-4">
                    {(test.organization_name as string) || "-"}
                  </td>
                  <td className="py-2.5 pr-4">{(test.patient_name as string) || "-"}</td>
                  <td className="py-2.5 pr-4 font-mono text-xs">
                    {(test.serial_number as string) || "-"}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColors[test.status as string] || "bg-bg-badge-gray text-text-badge-gray"}`}
                    >
                      {statusLabels[test.status as string] || (test.status as string)}
                    </span>
                  </td>
                  <td className="py-2.5 text-text-muted">
                    {formatDate(test.created_at as string)}
                  </td>
                </tr>
              ))}
              {data.recentTests.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-text-muted">
                    최근 검사가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Drill-down Modal */}
      <Modal
        open={drillOpen}
        onClose={() => setDrillOpen(false)}
        title={`${drillOrg?.organization_name} — ${drillFilterLabels[drillFilter]}`}
        wide
      >
        <div className="flex gap-2 mb-4">
          {(["total", "report_success", "report_failed", "not_returned", "other"] as DrillFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => drillOrg && openDrill(drillOrg, f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                drillFilter === f
                  ? "bg-accent text-white"
                  : "border border-border-primary text-text-secondary hover:bg-bg-hover"
              }`}
            >
              {drillFilterLabels[f]}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          {drillLoading ? (
            <p className="text-center text-text-muted py-8">로딩 중...</p>
          ) : drillTests.length === 0 ? (
            <p className="text-center text-text-muted py-8">해당하는 검사가 없습니다.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-primary text-left text-text-secondary">
                  <th className="pb-2 pr-4 font-medium">검사ID</th>
                  <th className="pb-2 pr-4 font-medium">환자</th>
                  <th className="pb-2 pr-4 font-medium">센서</th>
                  <th className="pb-2 pr-4 font-medium">상태</th>
                  <th className="pb-2 pr-4 font-medium">레포트</th>
                  <th className="pb-2 font-medium">생성일</th>
                </tr>
              </thead>
              <tbody>
                {drillTests.map((t) => (
                  <tr key={t.id as number} className="border-b border-border-secondary">
                    <td className="py-2 pr-4 font-mono text-xs text-text-secondary">{(t.test_id as string) || "-"}</td>
                    <td className="py-2 pr-4">{(t.patient_name as string) || "-"}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{(t.serial_number as string) || "-"}</td>
                    <td className="py-2 pr-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColors[t.status as string] || "bg-bg-badge-gray text-text-badge-gray"}`}>
                        {statusLabels[t.status as string] || (t.status as string)}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      {(t.is_reported as number) ? (
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
                    <td className="py-2 text-text-muted">{formatDate(t.created_at as string)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-xs text-text-muted mt-2 text-right">{drillTests.length}건</p>
        </div>
      </Modal>
    </div>
  );
}
