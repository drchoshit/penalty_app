import { NavLink, Outlet } from "react-router-dom";

const links = [
  { to: "/", label: "학생 DB" },
  { to: "/records", label: "벌점 기록" },
  { to: "/assign", label: "벌점 부여" },
  { to: "/settings", label: "설정" },
  { to: "/sms", label: "문자" },
  { to: "/notes", label: "특이사항" },
];

export default function Layout() {
  return (
    <div className="min-h-screen">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="flex items-baseline gap-3">
            <div className="brandmark">벌점 관리</div>
            <div className="text-xs text-brand-ivory/70">
              Green &amp; Gold Theme
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  isActive ? "navlink navlink-active" : "navlink"
                }
                end={l.to === "/"}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="container-max py-6">
        <Outlet />
      </main>

      <footer className="container-max pb-8 pt-2 text-xs text-slate-500">
        데이터는 로컬 SQLite(또는 Render Persistent Disk)에 저장됩니다. 배포 시 Persistent Disk 설정을 권장합니다.
      </footer>
    </div>
  );
}
