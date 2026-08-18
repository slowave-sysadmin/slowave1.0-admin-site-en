"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function RegisterPage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "done">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [orgName, setOrgName] = useState("");
  const [form, setForm] = useState({
    username: "",
    password: "",
    password_confirm: "",
    full_name: "",
    email: "",
    phone: "",
  });
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState("");

  useEffect(() => {
    fetch(`/api/invitations/${token}`)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setOrgName(data.organization_name);
          setStatus("ready");
        } else {
          const data = await res.json();
          setErrorMsg(data.error || "유효하지 않은 링크입니다.");
          setStatus("error");
        }
      })
      .catch(() => {
        setErrorMsg("서버에 연결할 수 없습니다.");
        setStatus("error");
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError("");

    if (!form.username.trim()) {
      setFieldError("사용자명을 입력해주세요.");
      return;
    }
    if (!form.password) {
      setFieldError("비밀번호를 입력해주세요.");
      return;
    }
    if (form.password.length < 4) {
      setFieldError("비밀번호는 4자 이상이어야 합니다.");
      return;
    }
    if (form.password !== form.password_confirm) {
      setFieldError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/invitations/${token}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username.trim(),
          password: form.password,
          full_name: form.full_name.trim() || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
        }),
      });

      if (res.ok) {
        setStatus("done");
      } else {
        const data = await res.json();
        setFieldError(data.error || "가입에 실패했습니다.");
      }
    } catch {
      setFieldError("서버에 연결할 수 없습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="w-full max-w-md text-center">
        <p className="text-text-secondary">확인 중...</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="w-full max-w-md bg-bg-card rounded-lg border border-border-primary p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-bg-badge-red mx-auto mb-4 flex items-center justify-center">
          <svg className="w-6 h-6 text-text-badge-red" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-text-primary mb-2">링크 오류</h2>
        <p className="text-text-secondary">{errorMsg}</p>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="w-full max-w-md bg-bg-card rounded-lg border border-border-primary p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-bg-badge-green mx-auto mb-4 flex items-center justify-center">
          <svg className="w-6 h-6 text-text-badge-green" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-text-primary mb-2">가입 완료</h2>
        <p className="text-text-secondary">계정이 생성되었습니다. Slowave 앱에서 로그인해주세요.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-bg-card rounded-lg border border-border-primary p-8">
        <div className="text-center mb-6">
          <div className="w-10 h-10 rounded-full bg-accent mx-auto mb-3 flex items-center justify-center">
            <span className="text-sm font-bold text-white">S</span>
          </div>
          <h1 className="text-xl font-semibold text-text-primary">Slowave 계정 등록</h1>
          <p className="text-sm text-text-secondary mt-1">
            소속 기관: <span className="font-medium text-text-primary">{orgName}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              사용자명 <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="로그인에 사용할 아이디"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              비밀번호 <span className="text-danger">*</span>
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              비밀번호 확인 <span className="text-danger">*</span>
            </label>
            <input
              type="password"
              value={form.password_confirm}
              onChange={(e) => setForm({ ...form, password_confirm: e.target.value })}
              className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">이름</label>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">이메일</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">전화번호</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="010-0000-0000"
            />
          </div>

          {fieldError && (
            <p className="text-sm text-danger">{fieldError}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            {saving ? "처리 중..." : "가입하기"}
          </button>
        </form>
      </div>
    </div>
  );
}
