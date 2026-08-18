"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "@/components/Modal";

interface Point {
  test_id: string;
  serial_number: string;
  patient_name: string;
  status: string;
  organization_id: number;
  organization_name: string | null;
  created_at: string;
  cradle_on_time: string;
  cradle_on_battery: number;
}

interface Org {
  organization_id: number;
  organization_name: string;
}

interface Plot {
  test_id: string;
  serial_number: string;
  patient_name: string;
  status: string;
  organization_name: string | null;
  elapsed_h: number;
  battery: number;
  created_at: string;
  cradle_on_time: string;
}

function elapsedHours(from: string, to: string): number {
  return (new Date(to).getTime() - new Date(from).getTime()) / 3600000;
}

function formatElapsed(h: number): string {
  if (!Number.isFinite(h) || h < 0) return "-";
  const d = Math.floor(h / 24);
  const hh = Math.floor(h % 24);
  const mm = Math.floor((h * 60) % 60);
  if (d > 0) return `${d}일 ${hh}시간`;
  if (hh > 0) return `${hh}시간 ${mm}분`;
  return `${mm}분`;
}

function formatHourTick(h: number): string {
  const total = Math.round(h);
  const d = Math.floor(total / 24);
  const hh = total % 24;
  if (d === 0) return `${hh}h`;
  if (hh === 0) return `${d}일`;
  return `${d}일 ${hh}h`;
}

function formatDate(d: string): string {
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min}`;
}

const PADDING = { top: 24, right: 24, bottom: 48, left: 56 };

export default function TestAnalysisPage() {
  const [points, setPoints] = useState<Point[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgFilter, setOrgFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState<{ x: number; y: number; p: Plot } | null>(null);
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [selected, setSelected] = useState<Plot | null>(null);
  const [excludeReason, setExcludeReason] = useState("");
  const [excludeSubmitting, setExcludeSubmitting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const height = 480;

  useEffect(() => {
    fetch("/api/organizations?limit=1000&status=active")
      .then((r) => r.json())
      .then((json) => setOrgs(json.data || []))
      .catch(() => {});
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setIsSystemAdmin(data?.role === "system_admin"))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(Math.max(320, e.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (orgFilter) params.set("organization_id", orgFilter);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    fetch(`/api/test-analysis?${params}`)
      .then((r) => r.json())
      .then((json) => setPoints(json.data || []))
      .catch(() => setPoints([]))
      .finally(() => setLoading(false));
  }, [orgFilter, dateFrom, dateTo, reloadKey]);

  const excludeSelected = async () => {
    if (!selected) return;
    setExcludeSubmitting(true);
    try {
      const res = await fetch(`/api/admin/test-analysis/${selected.test_id}/exclusion`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ excluded: true, reason: excludeReason }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error || "분석 제외 실패");
        return;
      }
      setSelected(null);
      setExcludeReason("");
      setReloadKey((k) => k + 1);
    } finally {
      setExcludeSubmitting(false);
    }
  };

  const plots = useMemo<Plot[]>(
    () =>
      points
        .map((p) => ({
          test_id: p.test_id,
          serial_number: p.serial_number,
          patient_name: p.patient_name,
          status: p.status,
          organization_name: p.organization_name,
          elapsed_h: elapsedHours(p.created_at, p.cradle_on_time),
          battery: p.cradle_on_battery,
          created_at: p.created_at,
          cradle_on_time: p.cradle_on_time,
        }))
        .filter((p) => Number.isFinite(p.elapsed_h) && p.elapsed_h >= 0),
    [points]
  );

  const xMax = useMemo(() => {
    if (plots.length === 0) return 24;
    const max = Math.max(...plots.map((p) => p.elapsed_h));
    return Math.ceil(max / 24) * 24 || 24;
  }, [plots]);

  const innerW = width - PADDING.left - PADDING.right;
  const innerH = height - PADDING.top - PADDING.bottom;
  // Log scale on x so that 0~7d gets more horizontal space than 7~14d, etc.
  const xScale = (h: number) => Math.log10(Math.max(0, h) + 1);
  const xScaleMax = xScale(xMax) || 1;
  const xToPx = (x: number) => PADDING.left + (xScale(x) / xScaleMax) * innerW;
  const yToPx = (y: number) => PADDING.top + (1 - y / 100) * innerH;

  const stats = useMemo(() => {
    if (plots.length === 0) return null;
    const batteries = plots.map((p) => p.battery);
    const avg = batteries.reduce((s, v) => s + v, 0) / batteries.length;
    const min = Math.min(...batteries);
    const max = Math.max(...batteries);
    const avgElapsed = plots.reduce((s, p) => s + p.elapsed_h, 0) / plots.length;
    return { count: plots.length, avgBattery: avg, minBattery: min, maxBattery: max, avgElapsed };
  }, [plots]);

  const X_TICK_CANDIDATES = [
    0, 6, 12, 24, 48, 72, 24 * 5, 24 * 7, 24 * 10, 24 * 14, 24 * 21, 24 * 30,
    24 * 45, 24 * 60, 24 * 90, 24 * 120, 24 * 180, 24 * 365,
  ];
  const xTicks = X_TICK_CANDIDATES.filter((t) => t <= xMax);
  if (xTicks[xTicks.length - 1] !== xMax) xTicks.push(xMax);
  const yTicks = [0, 20, 40, 60, 80, 100];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-text-primary">검사 분석 — 경과시간 vs 배터리</h1>

      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={orgFilter}
          onChange={(e) => setOrgFilter(e.target.value)}
          className="px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">전체 기관</option>
          {orgs.map((o) => (
            <option key={o.organization_id} value={o.organization_id}>{o.organization_name}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <span className="text-text-muted text-sm">~</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-bg-card border border-border-primary rounded-lg p-3">
            <div className="text-xs text-text-secondary">분석 가능 검사</div>
            <div className="text-xl font-semibold text-text-primary">{stats.count.toLocaleString()}건</div>
          </div>
          <div className="bg-bg-card border border-border-primary rounded-lg p-3">
            <div className="text-xs text-text-secondary">평균 경과시간</div>
            <div className="text-xl font-semibold text-text-primary">{formatElapsed(stats.avgElapsed)}</div>
          </div>
          <div className="bg-bg-card border border-border-primary rounded-lg p-3">
            <div className="text-xs text-text-secondary">평균 잔여 배터리</div>
            <div className="text-xl font-semibold text-text-primary">{stats.avgBattery.toFixed(1)}%</div>
          </div>
          <div className="bg-bg-card border border-border-primary rounded-lg p-3">
            <div className="text-xs text-text-secondary">배터리 범위</div>
            <div className="text-xl font-semibold text-text-primary">{stats.minBattery}% ~ {stats.maxBattery}%</div>
          </div>
        </div>
      )}

      <div ref={containerRef} className="relative bg-bg-card border border-border-primary rounded-lg p-4">
        {loading ? (
          <div className="flex items-center justify-center" style={{ height }}>
            <p className="text-text-muted">로딩 중...</p>
          </div>
        ) : plots.length === 0 ? (
          <div className="flex items-center justify-center" style={{ height }}>
            <p className="text-text-muted">분석 데이터가 없습니다. (배치 실행 후 다시 확인)</p>
          </div>
        ) : (
          <svg width={width} height={height} className="block">
            {/* Y gridlines + labels */}
            {yTicks.map((t) => (
              <g key={`y-${t}`}>
                <line
                  x1={PADDING.left}
                  x2={width - PADDING.right}
                  y1={yToPx(t)}
                  y2={yToPx(t)}
                  className="stroke-border-secondary"
                  strokeDasharray={t === 0 ? undefined : "3 3"}
                />
                <text
                  x={PADDING.left - 8}
                  y={yToPx(t)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-text-secondary text-xs"
                >
                  {t}%
                </text>
              </g>
            ))}
            {/* X axis labels */}
            {xTicks.map((t) => (
              <g key={`x-${t}`}>
                <line
                  x1={xToPx(t)}
                  x2={xToPx(t)}
                  y1={PADDING.top}
                  y2={height - PADDING.bottom}
                  className="stroke-border-secondary"
                  strokeDasharray={t === 0 ? undefined : "3 3"}
                />
                <text
                  x={xToPx(t)}
                  y={height - PADDING.bottom + 16}
                  textAnchor="middle"
                  className="fill-text-secondary text-xs"
                >
                  {formatHourTick(t)}
                </text>
              </g>
            ))}
            {/* Axis titles */}
            <text
              x={width / 2}
              y={height - 8}
              textAnchor="middle"
              className="fill-text-secondary text-xs"
            >
              경과시간 (일/시간)
            </text>
            <text
              x={14}
              y={height / 2}
              textAnchor="middle"
              transform={`rotate(-90, 14, ${height / 2})`}
              className="fill-text-secondary text-xs"
            >
              CradleOn 배터리 (%)
            </text>
            {/* Points */}
            {plots.map((p) => {
              const cx = xToPx(p.elapsed_h);
              const cy = yToPx(p.battery);
              return (
                <circle
                  key={p.test_id}
                  cx={cx}
                  cy={cy}
                  r={4}
                  className="fill-accent/70 stroke-accent cursor-pointer hover:fill-accent"
                  strokeWidth={1}
                  onMouseEnter={() => setHover({ x: cx, y: cy, p })}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => { setSelected(p); setExcludeReason(""); }}
                />
              );
            })}
          </svg>
        )}

        <Modal
          open={selected !== null}
          onClose={() => { if (!excludeSubmitting) { setSelected(null); setExcludeReason(""); } }}
          title={`검사 상세 — ${selected?.test_id ?? ""}`}
        >
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                <div className="text-text-secondary">기관</div>
                <div className="text-text-primary">{selected.organization_name || "-"}</div>
                <div className="text-text-secondary">환자</div>
                <div className="text-text-primary">{selected.patient_name}</div>
                <div className="text-text-secondary">시리얼</div>
                <div className="text-text-primary font-mono text-xs">{selected.serial_number}</div>
                <div className="text-text-secondary">상태</div>
                <div className="text-text-primary">{selected.status}</div>
                <div className="text-text-secondary">출고</div>
                <div className="text-text-primary">{formatDate(selected.created_at)}</div>
                <div className="text-text-secondary">CradleOn</div>
                <div className="text-text-primary">{formatDate(selected.cradle_on_time)}</div>
                <div className="text-text-secondary">경과시간</div>
                <div className="text-text-primary">{formatElapsed(selected.elapsed_h)}</div>
                <div className="text-text-secondary">배터리</div>
                <div className="text-text-primary">{selected.battery}%</div>
              </div>
              {isSystemAdmin && (
                <div className="border-t border-border-secondary pt-3 space-y-2">
                  <div className="text-xs text-text-secondary">분석에서 제외 (사유 선택 입력)</div>
                  <textarea
                    value={excludeReason}
                    onChange={(e) => setExcludeReason(e.target.value)}
                    placeholder="사유 (선택)"
                    maxLength={200}
                    rows={2}
                    className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => { if (!excludeSubmitting) { setSelected(null); setExcludeReason(""); } }}
                      disabled={excludeSubmitting}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium border border-border-input text-text-primary hover:bg-bg-hover disabled:opacity-50"
                    >
                      취소
                    </button>
                    <button
                      onClick={excludeSelected}
                      disabled={excludeSubmitting}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
                    >
                      {excludeSubmitting ? "처리 중..." : "분석 제외"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>

        {hover && (
          <div
            className="absolute pointer-events-none bg-bg-card border border-border-primary rounded-lg shadow-lg p-2 text-xs text-text-primary"
            style={{
              left: Math.min(hover.x + 12, width - 240),
              top: Math.max(hover.y - 80, 4),
              minWidth: 200,
            }}
          >
            <div className="font-mono font-medium">{hover.p.test_id}</div>
            <div className="text-text-secondary">{hover.p.organization_name || "-"}</div>
            <div>경과 {formatElapsed(hover.p.elapsed_h)} · 배터리 {hover.p.battery}%</div>
            <div className="text-text-muted mt-1">출고 {formatDate(hover.p.created_at)}</div>
            <div className="text-text-muted">CradleOn {formatDate(hover.p.cradle_on_time)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
