"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "done">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState("");

  useEffect(() => {
    fetch(`/api/password-reset/${token}`)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setUsername(data.username);
          setFullName(data.full_name || "");
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

    if (!password) {
      setFieldError("새 비밀번호를 입력해주세요.");
      return;
    }
    if (password.length < 4) {
      setFieldError("비밀번호는 4자 이상이어야 합니다.");
      return;
    }
    if (password !== passwordConfirm) {
      setFieldError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/password-reset/${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        setStatus("done");
      } else {
        const data = await res.json();
        setFieldError(data.error || "변경에 실패했습니다.");
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
        <h2 className="text-lg font-semibold text-text-primary mb-2">변경 완료</h2>
        <p className="text-text-secondary">비밀번호가 변경되었습니다. Slowave 앱에서 새 비밀번호로 로그인해주세요.</p>
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
          <h1 className="text-xl font-semibold text-text-primary">비밀번호 변경</h1>
          <p className="text-sm text-text-secondary mt-1">
            {fullName ? `${fullName} (${username})` : username}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              새 비밀번호 <span className="text-danger">*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              비밀번호 확인 <span className="text-danger">*</span>
            </label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
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
            {saving ? "처리 중..." : "비밀번호 변경"}
          </button>
        </form>
      </div>
    </div>
  );
}
