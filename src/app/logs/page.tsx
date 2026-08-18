"use client";

import { useEffect, useState, useCallback } from "react";
import Pagination from "@/components/Pagination";

interface LogEntry {
  id: number;
  [key: string]: any;
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

function formatDateInput(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const tabs = [
  { key: "system", label: "시스템 로그" },
  { key: "session", label: "세션 로그" },
  { key: "audit", label: "변경 이력" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

const entityTypeOptions = [
  { value: "", label: "전체" },
  { value: "organization", label: "기관" },
  { value: "user", label: "사용자" },
  { value: "device", label: "센서" },
];

const actionLabels: Record<string, string> = {
  create: "생성",
  update: "수정",
  delete: "삭제",
  assign: "배정",
  unassign: "해제",
};

const entityTypeLabels: Record<string, string> = {
  organization: "기관",
  user: "사용자",
  device: "센서",
};

export default function LogsPage() {
  const [tab, setTab] = useState<TabKey>("system");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [entityType, setEntityType] = useState("");
  const [searchTestId, setSearchTestId] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [sessionSearch, setSessionSearch] = useState("");
  const [orgMap, setOrgMap] = useState<Record<number, string>>({});

  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const [from, setFrom] = useState(formatDateInput(weekAgo));
  const [to, setTo] = useState(formatDateInput(today));

  const limit = 30;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLogs([]);

    const params = new URLSearchParams({
      type: tab,
      page: String(page),
      limit: String(limit),
    });
    if (from) params.set("date_from", from);
    if (to) params.set("date_to", to);
    if (tab === "audit" && entityType) params.set("entity_type", entityType);
    if (tab === "audit" && auditSearch) params.set("search", auditSearch);
    if (tab === "session" && sessionSearch) params.set("search", sessionSearch);
    if (tab === "system" && searchTestId) params.set("test_id", searchTestId);

    fetch(`/api/logs?${params}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        setLogs(json.data || []);
        setTotal(json.total || 0);
        if (json.orgMap) setOrgMap(json.orgMap);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error(err);
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [tab, page, from, to, entityType, searchTestId, auditSearch, sessionSearch]);

  const handleTabChange = (newTab: TabKey) => {
    setTab(newTab);
    setPage(1);
    setEntityType("");
    setSearchTestId("");
    setAuditSearch("");
    setSessionSearch("");
  };

  const highlightText = (text: string, query: string) => {
    if (!query || !text) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-yellow-200 text-inherit rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  const enrichOrgValue = (key: string, value: unknown): string => {
    const str = String(value ?? "-");
    if (key === "organization_id" && value != null && value !== "-") {
      const name = orgMap[Number(value)];
      return name ? `${str} (${name})` : str;
    }
    return str;
  };

  const renderChanges = (changes: any) => {
    if (!changes) return <span className="text-text-muted">-</span>;
    if (typeof changes === "string") {
      try {
        changes = JSON.parse(changes);
      } catch {
        return <span className="text-xs text-text-secondary">{highlightText(changes, auditSearch)}</span>;
      }
    }
    if (typeof changes !== "object") return <span className="text-xs text-text-secondary">{highlightText(String(changes), auditSearch)}</span>;

    const entries = Object.entries(changes);
    if (entries.length === 0) return <span className="text-text-muted">-</span>;

    return (
      <div className="space-y-0.5">
        {entries.map(([key, val]: [string, any]) => (
          <div key={key} className="text-xs">
            <span className="font-medium text-text-secondary">{key}: </span>
            {val && typeof val === "object" && ("old" in val || "from" in val) ? (
              <>
                <span className="text-text-badge-red">{highlightText(enrichOrgValue(key, val.old ?? val.from ?? "-"), auditSearch)}</span>
                <span className="text-text-muted mx-1">&rarr;</span>
                <span className="text-text-badge-green font-medium">{highlightText(enrichOrgValue(key, val.new ?? val.to ?? "-"), auditSearch)}</span>
              </>
            ) : (
              <span className="text-text-secondary">{highlightText(JSON.stringify(val), auditSearch)}</span>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderTable = () => {
    if (loading) {
      return (
        <tr>
          <td colSpan={10} className="px-4 py-8 text-center text-text-muted">
            로딩 중...
          </td>
        </tr>
      );
    }
    if (logs.length === 0) {
      return (
        <tr>
          <td colSpan={10} className="px-4 py-8 text-center text-text-muted">
            데이터가 없습니다.
          </td>
        </tr>
      );
    }

    if (tab === "audit") {
      return logs.map((log) => (
        <tr key={log.id} className="border-b border-border-primary hover:bg-bg-hover">
          <td className="px-4 py-2.5 text-text-secondary">{log.id}</td>
          <td className="px-4 py-2.5">
            <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-bg-badge-gray text-text-badge-gray">
              {entityTypeLabels[log.entity_type] || log.entity_type}
            </span>
          </td>
          <td className="px-4 py-2.5 text-text-secondary">
            <div>{highlightText(String(log.entity_id), auditSearch)}</div>
            {log.entity_name && (
              <div className="text-xs text-text-muted">{log.entity_name}</div>
            )}
          </td>
          <td className="px-4 py-2.5">
            <span
              className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                log.action === "create"
                  ? "bg-bg-badge-green text-text-badge-green"
                  : log.action === "delete"
                    ? "bg-bg-badge-red text-text-badge-red"
                    : "bg-bg-badge-blue text-text-badge-blue"
              }`}
            >
              {actionLabels[log.action] || log.action}
            </span>
          </td>
          <td className="px-4 py-2.5 max-w-[400px]">{renderChanges(log.changes)}</td>
          <td className="px-4 py-2.5 text-text-secondary">{log.performed_by_name || log.performed_by || "-"}</td>
          <td className="px-4 py-2.5 text-text-secondary">{formatDate(log.created_at)}</td>
        </tr>
      ));
    }

    if (tab === "session") {
      return logs.map((log) => (
        <tr key={log.id} className="border-b border-border-primary hover:bg-bg-hover">
          <td className="px-4 py-2.5 text-text-secondary">{log.id}</td>
          <td className="px-4 py-2.5">{highlightText(String(log.username || log.user_id || "-"), sessionSearch)}</td>
          <td className="px-4 py-2.5">{highlightText(String(log.reason || "-"), sessionSearch)}</td>
          <td className="px-4 py-2.5 text-text-secondary">{log.ip_address || "-"}</td>
          <td className="px-4 py-2.5 text-text-secondary max-w-[200px] truncate">{log.user_agent || "-"}</td>
          <td className="px-4 py-2.5 text-text-secondary">{formatDate(log.created_at)}</td>
        </tr>
      ));
    }

    // app & system logs
    const levelKey = tab === "system" ? "log_level" : "level";
    return logs.map((log) => {
      const level = (log[levelKey] || "").toLowerCase();
      return (
        <tr key={log.id || log.log_id} className="border-b border-border-primary hover:bg-bg-hover">
          <td className="px-4 py-2.5 text-text-secondary">{log.id || log.log_id}</td>
          {tab === "system" && (
            <td className="px-4 py-2.5 font-mono text-xs text-text-secondary">{log.test_id || "-"}</td>
          )}
          <td className="px-4 py-2.5">
            <span
              className={`inline-block px-2 py-0.5 rounded text-xs font-medium uppercase ${
                level === "error"
                  ? "bg-bg-badge-red text-text-badge-red"
                  : level === "warn" || level === "warning"
                    ? "bg-bg-badge-yellow text-text-badge-yellow"
                    : level === "info"
                      ? "bg-bg-badge-blue text-text-badge-blue"
                      : "bg-bg-badge-gray text-text-badge-gray"
              }`}
            >
              {log[levelKey] || "-"}
            </span>
          </td>
          <td className="px-4 py-2.5 text-text-secondary">{log.source || log.module || "-"}</td>
          <td className="px-4 py-2.5 max-w-[400px] truncate">{log.message || "-"}</td>
          <td className="px-4 py-2.5 text-text-secondary">{formatDate(log.created_at)}</td>
        </tr>
      );
    });
  };

  const renderHeaders = () => {
    if (tab === "audit") {
      return (
        <tr className="border-b border-border-primary text-left text-text-secondary">
          <th className="px-4 py-3 font-medium">ID</th>
          <th className="px-4 py-3 font-medium">대상 유형</th>
          <th className="px-4 py-3 font-medium">대상 ID</th>
          <th className="px-4 py-3 font-medium">작업</th>
          <th className="px-4 py-3 font-medium">변경 내용</th>
          <th className="px-4 py-3 font-medium">수행자</th>
          <th className="px-4 py-3 font-medium">일시</th>
        </tr>
      );
    }
    if (tab === "session") {
      return (
        <tr className="border-b border-border-primary text-left text-text-secondary">
          <th className="px-4 py-3 font-medium">ID</th>
          <th className="px-4 py-3 font-medium">사용자</th>
          <th className="px-4 py-3 font-medium">사유</th>
          <th className="px-4 py-3 font-medium">IP 주소</th>
          <th className="px-4 py-3 font-medium">User Agent</th>
          <th className="px-4 py-3 font-medium">일시</th>
        </tr>
      );
    }
    return (
      <tr className="border-b border-border-primary text-left text-text-secondary">
        <th className="px-4 py-3 font-medium">ID</th>
        {tab === "system" && <th className="px-4 py-3 font-medium">검사ID</th>}
        <th className="px-4 py-3 font-medium">레벨</th>
        <th className="px-4 py-3 font-medium">소스</th>
        <th className="px-4 py-3 font-medium">메시지</th>
        <th className="px-4 py-3 font-medium">일시</th>
      </tr>
    );
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-text-primary">로그 조회</h1>

      {/* Tabs */}
      <div className="bg-bg-card rounded-lg border border-border-primary shadow-sm">
        <div className="flex border-b border-border-primary">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => handleTabChange(t.key)}
              className={`px-5 py-3 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "text-accent border-b-2 border-accent"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="p-4 flex flex-wrap gap-3 border-b border-border-primary">
          <div className="flex items-center gap-2">
            <label className="text-sm text-text-secondary">시작일:</label>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-text-secondary">종료일:</label>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          {tab === "session" && (
            <input
              type="text"
              placeholder="사용자, 사유 검색..."
              value={sessionSearch}
              onChange={(e) => {
                setSessionSearch(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          )}
          {tab === "system" && (
            <input
              type="text"
              placeholder="검사ID로 검색..."
              value={searchTestId}
              onChange={(e) => {
                setSearchTestId(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          )}
          {tab === "audit" && (
            <>
              <div className="flex items-center gap-2">
                <label className="text-sm text-text-secondary">대상 유형:</label>
                <select
                  value={entityType}
                  onChange={(e) => {
                    setEntityType(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {entityTypeOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                placeholder="대상 ID, 변경 내용 검색..."
                value={auditSearch}
                onChange={(e) => {
                  setAuditSearch(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>{renderHeaders()}</thead>
            <tbody>{renderTable()}</tbody>
          </table>
        </div>
        <div className="px-4 pb-3">
          <Pagination page={page} total={total} limit={limit} onChange={setPage} />
        </div>
      </div>
    </div>
  );
}
