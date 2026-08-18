"use client";

import { useEffect, useState } from "react";

interface Feature {
  id: number;
  code: string;
  name: string;
}

interface Organization {
  organization_id: number;
  organization_name: string;
  status: string;
}

interface Assignment {
  organization_id: number;
  feature_id: number;
}

export default function FeatureStatusPage() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [assignedSet, setAssignedSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [onlyAssigned, setOnlyAssigned] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/features/status");
        if (res.ok) {
          const json = await res.json();
          setFeatures(json.features || []);
          setOrganizations(json.organizations || []);
          setAssignedSet(
            new Set((json.assignments || []).map((a: Assignment) => `${a.organization_id}:${a.feature_id}`))
          );
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const isAssigned = (orgId: number, featureId: number) => assignedSet.has(`${orgId}:${featureId}`);

  const countByFeature = (featureId: number) =>
    organizations.filter((o) => isAssigned(o.organization_id, featureId)).length;

  const filteredOrgs = organizations.filter((o) => {
    if (search && !o.organization_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (onlyAssigned && !features.some((f) => isAssigned(o.organization_id, f.id))) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">기능설정현황</h1>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="기관명 검색"
          className="w-64 px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <label className="flex items-center gap-1.5 text-sm text-text-secondary cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyAssigned}
            onChange={(e) => setOnlyAssigned(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          기능 부여 기관만
        </label>
        <span className="text-xs text-text-muted ml-auto">
          기관 {filteredOrgs.length}개 · 기능 {features.length}개
        </span>
      </div>

      <div className="bg-bg-card rounded-lg border border-border-primary">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-primary text-text-secondary">
                <th className="px-4 py-3 font-medium text-left sticky left-0 bg-bg-card min-w-[180px]">기관명</th>
                {features.map((f) => (
                  <th key={f.id} className="px-3 py-3 font-medium text-center min-w-[100px]">
                    <div>{f.name}</div>
                    <div className="text-[10px] font-normal text-text-muted font-mono mt-0.5">{f.code}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={features.length + 1} className="px-4 py-8 text-center text-text-muted">
                    로딩 중...
                  </td>
                </tr>
              ) : filteredOrgs.length === 0 ? (
                <tr>
                  <td colSpan={features.length + 1} className="px-4 py-8 text-center text-text-muted">
                    표시할 기관이 없습니다.
                  </td>
                </tr>
              ) : (
                <>
                  {filteredOrgs.map((o) => (
                    <tr key={o.organization_id} className="border-b border-border-secondary hover:bg-bg-hover">
                      <td className="px-4 py-2.5 font-medium sticky left-0 bg-bg-card">
                        <span className="flex items-center gap-1.5">
                          {o.organization_name}
                          {o.status !== "active" && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-badge-red text-text-badge-red font-medium">
                              비활성
                            </span>
                          )}
                        </span>
                      </td>
                      {features.map((f) => (
                        <td key={f.id} className="px-3 py-2.5 text-center">
                          {isAssigned(o.organization_id, f.id) ? (
                            <svg
                              className="w-4 h-4 inline-block text-accent"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={2}
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          ) : (
                            <span className="text-text-muted">-</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="border-t border-border-primary text-text-secondary">
                    <td className="px-4 py-2.5 text-xs font-medium sticky left-0 bg-bg-card">부여 기관 수</td>
                    {features.map((f) => (
                      <td key={f.id} className="px-3 py-2.5 text-center text-xs font-medium">
                        {countByFeature(f.id)}
                      </td>
                    ))}
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
