import { useState } from "react";
import { useNavigate } from "react-router-dom";

const ADMIN_ID = "medicalsoap";
const ADMIN_PW = "ghfkdskql2827";

export default function AdminLogin() {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = () => {
    if (id === ADMIN_ID && pw === ADMIN_PW) {
      localStorage.setItem("medipenalty_admin", "true");
      navigate("/");
    } else {
      setError("아이디 또는 비밀번호가 올바르지 않습니다.");
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: "120px auto" }}>
      <h2>관리자 로그인</h2>

      <input
        placeholder="아이디"
        value={id}
        onChange={(e) => setId(e.target.value)}
        style={{ width: "100%", marginBottom: 10 }}
      />

      <input
        type="password"
        placeholder="비밀번호"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        style={{ width: "100%", marginBottom: 10 }}
      />

      <button onClick={handleLogin} style={{ width: "100%" }}>
        로그인
      </button>

      {error && <p style={{ color: "red", marginTop: 10 }}>{error}</p>}
    </div>
  );
}
