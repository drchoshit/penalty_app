import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const ADMIN_ID = "medicalsoap";
const ADMIN_PW = "ghfkdskql2827";

export default function AdminLogin() {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // 이미 로그인 상태면 바로 메인으로
  useEffect(() => {
    const isAdmin = localStorage.getItem("medipenalty_admin") === "true";
    if (isAdmin) navigate("/", { replace: true });
  }, [navigate]);

  const handleLogin = () => {
    if (id === ADMIN_ID && pw === ADMIN_PW) {
      localStorage.setItem("medipenalty_admin", "true");
      navigate("/", { replace: true });
    } else {
      setError("아이디 또는 비밀번호가 올바르지 않습니다.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-ivory">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl px-8 py-10">
        {/* 헤더 */}
        <div className="mb-8 text-center">
          <div className="text-2xl font-semibold tracking-tight text-slate-800">
            벌점 관리 시스템
          </div>
          <div className="mt-2 text-sm text-slate-500">
            관리자 전용 로그인
          </div>
        </div>

        {/* 입력 폼 */}
        <div className="space-y-4">
          <div>
            <label className="block mb-1 text-xs font-medium text-slate-600">
              아이디
            </label>
            <input
              value={id}
              onChange={(e) => setId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
              placeholder="관리자 아이디"
            />
          </div>

          <div>
            <label className="block mb-1 text-xs font-medium text-slate-600">
              비밀번호
            </label>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
              placeholder="비밀번호"
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>

          {error && (
            <div className="text-xs text-red-500 mt-1">
              {error}
            </div>
          )}
        </div>

        {/* 버튼 */}
        <button
          onClick={handleLogin}
          className="mt-6 w-full rounded-lg bg-brand-gold py-2.5 text-sm font-medium text-white hover:brightness-95 transition"
        >
          로그인
        </button>

        {/* 푸터 */}
        <div className="mt-6 text-center text-[11px] text-slate-400">
          Medical Penalty Admin System
        </div>
      </div>
    </div>
  );
}
