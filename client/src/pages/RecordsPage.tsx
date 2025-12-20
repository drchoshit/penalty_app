import { useEffect, useMemo, useState } from "react";
import { api, Penalty, Student } from "../lib/api";
import DatePicker from "../components/DatePicker";
import { todayYmd } from "../lib/date";

export default function RecordsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [from, setFrom] = useState<string>(() => todayYmd());
  const [to, setTo] = useState<string>(() => todayYmd());
  const [err, setErr] = useState<string | null>(null);

  const cumulative = useMemo(() => {
    const sum = penalties.reduce((a, p) => a + (p.points || 0), 0);
    return sum;
  }, [penalties]);

  async function loadStudents() {
    const s = await api.students.list();
    setStudents(s);
    if (s.length && !selected) setSelected(s[0].id);
  }

  async function loadPenalties(studentId: string) {
    const list = await api.penalties.list(studentId);
    setPenalties(list);
  }

  useEffect(() => {
    loadStudents().catch((e) => setErr(e.message || "불러오기 실패"));
  }, []);

  useEffect(() => {
    if (!selected) return;
    loadPenalties(selected).catch((e) => setErr(e.message || "불러오기 실패"));
  }, [selected]);

  async function removePenalty(id: string) {
    if (!confirm("이 벌점을 삭제할까요?")) return;
    await api.penalties.remove(id);
    await loadPenalties(selected);
  }

  async function resetRange() {
    if (!selected) return;
    if (from > to) {
      setErr("기간 설정이 올바르지 않습니다. from <= to");
      return;
    }
    if (!confirm(`${from} ~ ${to} 기간 벌점을 전부 삭제(리셋)할까요?`)) return;
    const r = await api.penalties.reset(selected, from, to);
    await loadPenalties(selected);
    alert(`삭제됨: ${r.deleted}건`);
  }

  return (
    <div className="grid grid-cols-12 gap-4">
      {err && <div className="col-span-12 card p-4 border border-rose-100 bg-rose-50 text-rose-700 text-sm">{err}</div>}

      <div className="col-span-4 card p-5">
        <div className="text-base font-semibold">학생</div>
        <div className="text-sm text-slate-500 mt-1">학생을 선택하면 오른쪽에 벌점 내역이 표시됩니다.</div>

        <div className="mt-4 space-y-1">
          {students.map((s) => (
            <button
              key={s.id}
              className={[
                "w-full text-left px-3 py-2 rounded-xl border text-sm",
                selected === s.id ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 hover:bg-slate-50"
              ].join(" ")}
              onClick={() => setSelected(s.id)}
            >
              <div className="flex items-center justify-between">
                <span>{s.name}</span>
                <span className="text-xs opacity-80">{s.grade || ""}</span>
              </div>
            </button>
          ))}
          {students.length === 0 && <div className="text-sm text-slate-500 mt-6">학생이 없습니다.</div>}
        </div>
      </div>

      <div className="col-span-8 space-y-4">
        <div className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-base font-semibold">벌점 내역</div>
              <div className="text-sm text-slate-500 mt-1">총합(현재 화면에 보이는 전체): {cumulative}점</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-[140px]">
                <div className="text-xs text-slate-500 mb-1">From</div>
                <DatePicker value={from} onChange={setFrom} />
              </div>
              <div className="w-[140px]">
                <div className="text-xs text-slate-500 mb-1">To</div>
                <DatePicker value={to} onChange={setTo} />
              </div>
              <button className="btn btn-danger" onClick={resetRange}>기간 리셋</button>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="overflow-auto">
            <table className="table min-w-[780px]">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>항목</th>
                  <th>점수</th>
                  <th>메모</th>
                  <th className="w-[120px]">작업</th>
                </tr>
              </thead>
              <tbody>
                {penalties.map((p) => (
                  <tr key={p.id}>
                    <td className="font-mono text-xs text-slate-600">{p.occurred_on}</td>
                    <td>{p.rule_title}</td>
                    <td>{p.points}</td>
                    <td className="text-slate-600">{p.memo}</td>
                    <td>
                      <button className="btn btn-danger" onClick={() => removePenalty(p.id)}>삭제</button>
                    </td>
                  </tr>
                ))}
                {penalties.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-sm text-slate-500 py-10 text-center">벌점 내역이 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
