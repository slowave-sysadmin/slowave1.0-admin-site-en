"use client";

import React, { useEffect, useState, useCallback, ReactNode } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import Pagination from "@/components/Pagination";
import ActionMenu from "@/components/ActionMenu";
import { useAuth } from "@/components/AuthProvider";
import { useDialog } from "@/components/DialogProvider";

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

interface Device {
  device_id: number;
  organization_id: number;
  organization_name?: string;
  product_serial_number: string;
  mac_address: string;
  usb_serial_number: string;
  status: string;
  memo: string;
  created_at: string;
  failure_count: number;
}

interface AuditLog {
  id: number;
  action: string;
  performed_by: string;
  performed_by_name?: string;
  changes: any;
  created_at: string;
}

interface Org {
  organization_id: number;
  organization_name: string;
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

const statusLabels: Record<string, string> = {
  available: "사용 가능",
  inactive: "비활성",
  retired: "폐기",
};

const statusColors: Record<string, string> = {
  available: "bg-bg-badge-green text-text-badge-green",
  inactive: "bg-bg-badge-yellow text-text-badge-yellow",
  retired: "bg-bg-badge-red text-text-badge-red",
};

const emptyForm = {
  organization_id: "0",
  product_serial_number: "",
  mac_address: "",
  usb_serial_number: "",
  status: "available",
  memo: "",
};

export default function DevicesPage() {
  const router = useRouter();
  const { canEdit: _canEdit } = useAuth();
  const isAdmin = _canEdit("/devices");
  const { alert, confirm } = useDialog();
  const [devices, setDevices] = useState<Device[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [orgFilter, setOrgFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("available");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Audit panel state
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditDevice, setAuditDevice] = useState<Device | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // History panel state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyDevice, setHistoryDevice] = useState<Device | null>(null);
  const [historyData, setHistoryData] = useState<any>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTab, setHistoryTab] = useState<"tests" | "transfers" | "incidents">("tests");
  const [incidentForm, setIncidentForm] = useState({ type: "", description: "" });
  const [incidentSaving, setIncidentSaving] = useState(false);

  // Retire confirmation
  const [retireOpen, setRetireOpen] = useState(false);
  const [retireDevice, setRetireDevice] = useState<Device | null>(null);
  const [retireInput, setRetireInput] = useState("");

  const limit = 20;

  useEffect(() => {
    fetch("/api/organizations?limit=1000&status=active")
      .then((r) => r.json())
      .then((json) => setOrgs((json.data || []).filter((o: Org) => o.organization_id !== 0)))
      .catch(() => {});
  }, []);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set("search", search);
      if (orgFilter) params.set("organization_id", orgFilter);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/devices?${params}`);
      if (res.ok) {
        const json = await res.json();
        setDevices(json.data);
        setTotal(json.total);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, orgFilter, statusFilter]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (device: Device) => {
    setEditing(device);
    setForm({
      organization_id: String(device.organization_id ?? 0),
      product_serial_number: device.product_serial_number || "",
      mac_address: device.mac_address || "",
      usb_serial_number: device.usb_serial_number || "",
      status: device.status || "available",
      memo: device.memo || "",
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const productSerial = form.product_serial_number.trim();
    const mac = form.mac_address.trim();
    const usbSerial = form.usb_serial_number.trim();
    if (!productSerial) { await alert("제품 시리얼을 입력하세요."); return; }
    if (!mac) { await alert("MAC 주소를 입력하세요."); return; }
    if (!usbSerial) { await alert("USB 시리얼을 입력하세요."); return; }
    setSaving(true);
    try {
      const url = editing ? `/api/devices/${editing.device_id}` : "/api/devices";
      const method = editing ? "PUT" : "POST";
      const body = {
        ...form,
        organization_id: Number(form.organization_id) || 0,
        product_serial_number: productSerial,
        mac_address: mac,
        usb_serial_number: usbSerial,
      };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setModalOpen(false);
        fetchDevices();
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

  const openRetire = (device: Device) => {
    setRetireDevice(device);
    setRetireInput("");
    setRetireOpen(true);
  };

  const handleRetire = async () => {
    if (!retireDevice || retireInput !== "폐기") return;
    try {
      const res = await fetch(`/api/devices/${retireDevice.device_id}`, { method: "DELETE" });
      if (res.ok) {
        setRetireOpen(false);
        fetchDevices();
      } else {
        await alert("폐기 처리에 실패했습니다.");
      }
    } catch {
      await alert("폐기 처리 중 오류가 발생했습니다.");
    }
  };

  const openAudit = async (device: Device) => {
    setAuditDevice(device);
    setAuditOpen(true);
    setAuditLoading(true);
    try {
      const res = await fetch(`/api/devices/${device.device_id}/audit`);
      if (res.ok) {
        const json = await res.json();
        setAuditLogs(json.data || []);
      }
    } catch {
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  };

  const openHistory = async (device: Device) => {
    setHistoryDevice(device);
    setHistoryTab("tests");
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryData(null);
    setIncidentForm({ type: "", description: "" });
    try {
      const res = await fetch(`/api/devices/${device.device_id}/history`);
      if (res.ok) setHistoryData(await res.json());
    } catch {
      setHistoryData(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleIncidentSubmit = async () => {
    if (!historyDevice || !incidentForm.type) return;
    setIncidentSaving(true);
    try {
      const res = await fetch("/api/sensor-incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serial_number: historyDevice.product_serial_number,
          incident_type: incidentForm.type,
          description: incidentForm.description,
        }),
      });
      if (res.ok) {
        setIncidentForm({ type: "", description: "" });
        // Refresh
        const res2 = await fetch(`/api/devices/${historyDevice.device_id}/history`);
        if (res2.ok) setHistoryData(await res2.json());
      }
    } catch {
      await alert("등록 중 오류가 발생했습니다.");
    } finally {
      setIncidentSaving(false);
    }
  };

  const orgMap = new Map(orgs.map((o) => [o.organization_id, o.organization_name]));

  const renderChanges = (changes: any) => {
    if (!changes || typeof changes !== "object") return <span className="text-text-muted text-xs">-</span>;
    const entries = Object.entries(changes);
    if (entries.length === 0) return <span className="text-text-muted text-xs">-</span>;

    return (
      <div className="space-y-1.5">
        {entries.map(([key, val]: [string, any]) => {
          const isOrgChange = key === "organization_id";
          const enrichVal = (v: unknown) => {
            const s = String(v ?? "-");
            if (key === "organization_id" && v != null && v !== "-") {
              const name = orgMap.get(Number(v));
              return name ? `${s} (${name})` : s;
            }
            return s;
          };
          return (
            <div
              key={key}
              className={`text-xs rounded-md px-2.5 py-1.5 ${isOrgChange ? "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800" : "bg-bg-tertiary"}`}
            >
              <span className="font-medium text-text-secondary">{key}</span>
              {val && typeof val === "object" && ("old" in val || "from" in val) ? (
                <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span className="text-red-500">{enrichVal(val.old ?? val.from)}</span>
                  <svg className="w-3 h-3 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                  <span className="text-green-600 dark:text-green-400 font-medium">{enrichVal(val.new ?? val.to)}</span>
                </div>
              ) : (
                <span className="text-text-secondary ml-1">{JSON.stringify(val)}</span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const actionLabels: Record<string, string> = {
    create: "생성",
    update: "수정",
    delete: "삭제",
    assign: "배정",
    unassign: "해제",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">센서 관리</h1>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover"
          >
            + 센서 추가
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={orgFilter}
          onChange={(e) => {
            setOrgFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input focus:outline-none focus:ring-2 focus:ring-accent"
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
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">전체 상태</option>
          <option value="available">사용 가능</option>
          <option value="inactive">비활성</option>
          <option value="retired">폐기</option>
        </select>
        <input
          type="text"
          placeholder="시리얼, MAC 주소로 검색..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="flex-1 min-w-[200px] px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      {/* Table */}
      <div className="bg-bg-card rounded-lg border border-border-primary">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-primary text-left text-text-secondary">
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">기관</th>
                <th className="px-4 py-3 font-medium">제품시리얼</th>
                <th className="px-4 py-3 font-medium">MAC</th>
                <th className="px-4 py-3 font-medium">USB시리얼</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="px-4 py-3 font-medium">실패</th>
                <th className="px-4 py-3 font-medium">메모</th>
                <th className="px-4 py-3 font-medium">생성일</th>
                {isAdmin && <th className="px-4 py-3 font-medium">관리</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-text-muted">
                    로딩 중...
                  </td>
                </tr>
              ) : devices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-text-muted">
                    데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                devices.map((d) => (
                  <tr key={d.device_id} className="border-b border-border-secondary hover:bg-bg-hover whitespace-nowrap">
                    <td className="px-4 py-2.5 text-text-secondary">{d.device_id}</td>
                    <td className="px-4 py-2.5">{highlight(d.organization_name || orgMap.get(d.organization_id)?.toString() || String(d.organization_id || "-"), search)}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">
                      <span className="inline-flex items-center gap-1">
                        {highlight(d.product_serial_number, search)}
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            const ok = await confirm({ message: `"${d.product_serial_number}" 센서의 검사 목록을 조회하시겠습니까?`, confirmLabel: "조회" });
                            if (ok) router.push(`/tests?search=${encodeURIComponent(d.product_serial_number)}`);
                          }}
                          title="검사 조회"
                          className="text-text-muted hover:text-accent transition-colors shrink-0"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                          </svg>
                        </button>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">{highlight(d.mac_address, search)}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{highlight(d.usb_serial_number, search)}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColors[d.status] || "bg-bg-badge-gray text-text-badge-gray"}`}
                      >
                        {statusLabels[d.status] || d.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {d.failure_count > 0 ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); openHistory(d); }}
                          className="inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-bg-badge-red text-text-badge-red hover:opacity-80"
                        >
                          {d.failure_count}
                        </button>
                      ) : (
                        <span className="text-text-muted text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-text-secondary max-w-[200px] truncate">{highlight(d.memo, search)}</td>
                    <td className="px-4 py-2.5 text-text-secondary">{formatDate(d.created_at)}</td>
                    {isAdmin && (
                      <td className="px-4 py-2.5">
                        <ActionMenu items={[
                          { label: "수정", onClick: () => openEdit(d) },
                          { label: "센서 이력", onClick: () => openHistory(d) },
                          { label: "변경 이력", onClick: () => openAudit(d) },
                          { label: "폐기", onClick: () => openRetire(d), variant: "danger" },
                        ]} />
                      </td>
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

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "센서 수정" : "센서 추가"}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">기관</label>
            <select
              value={form.organization_id}
              onChange={(e) => setForm({ ...form, organization_id: e.target.value })}
              className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="0">미배정</option>
              {orgs.map((o) => (
                <option key={o.organization_id} value={o.organization_id}>
                  {o.organization_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">제품 시리얼</label>
            <input
              type="text"
              value={form.product_serial_number}
              onChange={(e) => setForm({ ...form, product_serial_number: e.target.value })}
              className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">MAC 주소</label>
              <input
                type="text"
                value={form.mac_address}
                onChange={(e) => setForm({ ...form, mac_address: e.target.value })}
                className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">USB 시리얼</label>
              <input
                type="text"
                value={form.usb_serial_number}
                onChange={(e) => setForm({ ...form, usb_serial_number: e.target.value })}
                className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">상태</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="available">사용 가능</option>
              <option value="inactive">비활성</option>
              <option value="retired">폐기</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">메모</label>
            <textarea
              value={form.memo}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm border border-border-primary rounded-lg hover:bg-bg-hover"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Audit Slide-out Panel */}
      {auditOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setAuditOpen(false)}
          />
          <div className="relative w-full max-w-xl bg-bg-card shadow-2xl flex flex-col h-full">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border-primary">
              <div>
                <h2 className="text-base font-semibold text-text-primary">변경 이력</h2>
                {auditDevice && (
                  <p className="text-xs text-text-muted mt-1">
                    {auditDevice.product_serial_number}
                    <span className="ml-1.5 text-text-muted">ID: {auditDevice.device_id}</span>
                  </p>
                )}
              </div>
              <button
                onClick={() => setAuditOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {auditLoading ? (
                <p className="text-text-muted text-center py-8">로딩 중...</p>
              ) : auditLogs.length === 0 ? (
                <p className="text-text-muted text-center py-8">변경 이력이 없습니다.</p>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-[7px] top-3 bottom-3 w-px bg-border-primary" />
                  <div className="space-y-6">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="relative pl-7">
                        {/* Timeline dot */}
                        <div className={`absolute left-0 top-1 w-[15px] h-[15px] rounded-full border-2 border-bg-card ${
                          log.action === "create"
                            ? "bg-green-500"
                            : log.action === "delete"
                              ? "bg-red-500"
                              : "bg-blue-500"
                        }`} />
                        <div className="bg-bg-primary border border-border-primary rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
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
                              <span className="text-xs text-text-muted">
                                {log.performed_by_name || log.performed_by || "-"}
                              </span>
                            </div>
                            <span className="text-xs text-text-muted">
                              {formatDate(log.created_at)}
                            </span>
                          </div>
                          {renderChanges(log.changes)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Retire Confirmation Modal */}
      <Modal open={retireOpen} onClose={() => setRetireOpen(false)} title="센서 폐기">
        {retireDevice && (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              <span className="font-medium text-text-primary">{retireDevice.product_serial_number}</span> 센서를 폐기 처리합니다.
            </p>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                확인을 위해 <span className="text-red-500 font-bold">폐기</span>를 입력하세요.
              </label>
              <input
                type="text"
                value={retireInput}
                onChange={(e) => setRetireInput(e.target.value)}
                placeholder="폐기"
                className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRetireOpen(false)}
                className="px-4 py-2 text-sm border border-border-primary rounded-lg text-text-primary hover:bg-bg-hover"
              >
                취소
              </button>
              <button
                onClick={handleRetire}
                disabled={retireInput !== "폐기"}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                폐기 처리
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Sensor History Panel */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setHistoryOpen(false)} />
          <div className="relative w-full max-w-4xl bg-bg-card shadow-2xl flex flex-col h-full">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border-primary">
              <div>
                <h2 className="text-base font-semibold text-text-primary">센서 이력</h2>
                {historyDevice && (
                  <p className="text-xs text-text-muted mt-1">{historyDevice.product_serial_number} (ID: {historyDevice.device_id})</p>
                )}
              </div>
              <button onClick={() => setHistoryOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {historyLoading ? (
              <div className="flex-1 flex items-center justify-center"><p className="text-text-muted">로딩 중...</p></div>
            ) : !historyData ? (
              <div className="flex-1 flex items-center justify-center"><p className="text-text-muted">데이터를 불러올 수 없습니다.</p></div>
            ) : (
              <>
                {/* Summary */}
                <div className="px-6 py-4 border-b border-border-primary">
                  <div className="grid grid-cols-4 gap-3">
                    <div className="text-center">
                      <p className="text-xs text-text-muted">총 검사</p>
                      <p className="text-lg font-bold text-text-primary">{historyData.summary.totalTests}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-text-muted">실패</p>
                      <p className="text-lg font-bold text-red-500">{historyData.summary.failedTests}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-text-muted">실패율</p>
                      <p className="text-lg font-bold text-text-primary">{historyData.summary.failureRate}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-text-muted">이슈 메모</p>
                      <p className="text-lg font-bold text-text-primary">{historyData.summary.incidentCount}</p>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-border-primary">
                  {([
                    { key: "tests", label: "검사 이력" },
                    { key: "transfers", label: "기관 이동" },
                    { key: "incidents", label: "이슈 메모" },
                  ] as const).map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setHistoryTab(t.key)}
                      className={`px-5 py-3 text-sm font-medium transition-colors ${
                        historyTab === t.key ? "text-accent border-b-2 border-accent" : "text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5">
                  {/* Tests tab */}
                  {historyTab === "tests" && (
                    <div className="space-y-2">
                      {historyData.tests.length === 0 ? (
                        <p className="text-text-muted text-center py-8">검사 이력이 없습니다.</p>
                      ) : (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-border-primary text-left text-text-secondary">
                              <th className="pb-2 pr-3 font-medium">검사ID</th>
                              <th className="pb-2 pr-3 font-medium">기관</th>
                              <th className="pb-2 pr-3 font-medium">환자</th>
                              <th className="pb-2 pr-3 font-medium">분석</th>
                              <th className="pb-2 font-medium">검사일</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historyData.tests.map((t: any) => {
                              const isFailed = t.status_analysis === "analyze_failed" || t.status_analysis === "report_failed";
                              const hasNote = t.failure_reason_name || t.note || t.action_taken;
                              return (
                                <React.Fragment key={t.test_id}>
                                  <tr className={isFailed ? "bg-red-50 dark:bg-red-950/20" : ""}>
                                    <td className="py-2 pr-3 font-mono">{t.test_id}</td>
                                    <td className="py-2 pr-3">{t.organization_name || "-"}</td>
                                    <td className="py-2 pr-3">{t.patient_name || "-"}</td>
                                    <td className="py-2 pr-3">
                                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                        t.status_analysis === "report_generated"
                                          ? "bg-bg-badge-green text-text-badge-green"
                                          : t.status_analysis === "analyze_failed"
                                            ? "bg-bg-badge-red text-text-badge-red"
                                            : t.status_analysis === "report_failed"
                                              ? "bg-bg-badge-yellow text-text-badge-yellow"
                                              : "bg-bg-badge-gray text-text-badge-gray"
                                      }`}>
                                        {t.status_analysis || "-"}
                                      </span>
                                    </td>
                                    <td className="py-2 text-text-muted whitespace-nowrap">{formatDate(t.created_at)}</td>
                                  </tr>
                                  {hasNote && (
                                    <tr>
                                      <td colSpan={5} className="px-3 py-2 bg-bg-tertiary border-b border-border-secondary">
                                        <div className="space-y-0.5">
                                          {t.failure_reason_name && (
                                            <p><span className="text-text-muted">원인:</span> <span className="text-text-primary">{t.failure_reason_name}</span></p>
                                          )}
                                          {t.note && (
                                            <p><span className="text-text-muted">코멘트:</span> <span className="text-text-secondary">{t.note}</span></p>
                                          )}
                                          {t.action_taken && (
                                            <p><span className="text-text-muted">조치:</span> <span className="text-text-primary">{t.action_taken}</span></p>
                                          )}
                                          {t.action_comment && (
                                            <p><span className="text-text-muted">조치 코멘트:</span> <span className="text-text-secondary">{t.action_comment}</span></p>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                  {!hasNote && (
                                    <tr><td colSpan={5} className="border-b border-border-secondary" /></tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {/* Transfers tab */}
                  {historyTab === "transfers" && (
                    <div className="space-y-3">
                      {historyData.orgTransfers.length === 0 ? (
                        <p className="text-text-muted text-center py-8">기관 이동 이력이 없습니다.</p>
                      ) : (
                        historyData.orgTransfers.map((t: any) => {
                          let changes = t.changes;
                          if (typeof changes === "string") try { changes = JSON.parse(changes); } catch { changes = {}; }
                          const orgChange = changes?.organization_id;
                          const nameMap = historyData.orgNameMap || {};
                          const getOrgName = (id: unknown) => nameMap[Number(id)] || `ID:${id}`;
                          return (
                            <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border border-border-primary">
                              <div className="text-sm">
                                {orgChange ? (
                                  <span className="flex items-center gap-2">
                                    <span className="text-red-500">{getOrgName(orgChange.old)}</span>
                                    <svg className="w-4 h-4 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                                    </svg>
                                    <span className="text-green-600 dark:text-green-400 font-medium">{getOrgName(orgChange.new)}</span>
                                  </span>
                                ) : (
                                  <span className="text-text-muted">변경 정보 없음</span>
                                )}
                              </div>
                              <div className="text-xs text-text-muted whitespace-nowrap">
                                {t.performed_by} &middot; {formatDate(t.created_at)}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* Incidents tab */}
                  {historyTab === "incidents" && (
                    <div className="space-y-4">
                      {isAdmin && (
                        <div className="p-4 rounded-lg border border-border-primary bg-bg-primary space-y-3">
                          <p className="text-sm font-medium text-text-secondary">이슈 등록</p>
                          <input
                            type="text"
                            value={incidentForm.type}
                            onChange={(e) => setIncidentForm({ ...incidentForm, type: e.target.value })}
                            placeholder="이슈 유형 (예: 하드웨어 결함, 캘리브레이션)"
                            className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                          />
                          <textarea
                            value={incidentForm.description}
                            onChange={(e) => setIncidentForm({ ...incidentForm, description: e.target.value })}
                            placeholder="상세 내용"
                            rows={2}
                            className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                          />
                          <div className="flex justify-end">
                            <button
                              onClick={handleIncidentSubmit}
                              disabled={incidentSaving || !incidentForm.type}
                              className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50"
                            >
                              {incidentSaving ? "등록 중..." : "등록"}
                            </button>
                          </div>
                        </div>
                      )}
                      {historyData.incidents.length === 0 ? (
                        <p className="text-text-muted text-center py-8">등록된 이슈가 없습니다.</p>
                      ) : (
                        <div className="space-y-2">
                          {historyData.incidents.map((inc: any) => (
                            <div key={inc.id} className="p-3 rounded-lg border border-border-primary">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-text-primary">{inc.incident_type}</span>
                                <span className="text-xs text-text-muted">{inc.noted_by} &middot; {formatDate(inc.created_at)}</span>
                              </div>
                              {inc.description && <p className="text-xs text-text-secondary">{inc.description}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
