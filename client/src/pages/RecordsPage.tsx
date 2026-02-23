import { useEffect, useMemo, useState } from "react";
import { api, Penalty, PenaltyRangeStudent, Student } from "../lib/api";
import DatePicker from "../components/DatePicker";
import { todayYmd } from "../lib/date";

export default function RecordsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [from, setFrom] = useState<string>(() => todayYmd());
  const [to, setTo] = useState<string>(() => todayYmd());
  const [printFrom, setPrintFrom] = useState<string>(() => todayYmd());
  const [printTo, setPrintTo] = useState<string>(() => todayYmd());
  const [err, setErr] = useState<string | null>(null);
  const [printRows, setPrintRows] = useState<(Student & { points: number })[]>([]);
  const [printReady, setPrintReady] = useState(false);
  const [rangeStudents, setRangeStudents] = useState<PenaltyRangeStudent[]>([]);
  const [rangeMode, setRangeMode] = useState(false);
  const [deletingPenaltyId, setDeletingPenaltyId] = useState<string | null>(null);

  const cumulative = useMemo(() => {
    const sum = penalties.reduce((a, p) => a + (p.points || 0), 0);
    return sum;
  }, [penalties]);

  async function loadStudents() {
    const s = await api.students.list();
    setStudents(s);
    if (s.length && !selected) setSelected(s[0].id);
  }

  async function loadPenalties(studentId: string, fromDate?: string, toDate?: string) {
    const list = await api.penalties.list(studentId, fromDate, toDate);
    setPenalties(list);
  }

  useEffect(() => {
    loadStudents().catch((e) => setErr(e.message || "불러오기 실패"));
  }, []);

  useEffect(() => {
    if (!selected) return;
    const load = rangeMode ? loadPenalties(selected, from, to) : loadPenalties(selected);
    load.catch((e) => setErr(e.message || "불러오기 실패"));
  }, [selected, rangeMode]);

  useEffect(() => {
    const handleAfterPrint = () => setPrintReady(false);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  async function checkRange() {
    setErr(null);
    if (from > to) {
      setErr("기간 설정이 올바르지 않습니다. from <= to");
      return;
    }
    const rows = await api.penalties.studentsByRange(from, to);
    setRangeStudents(rows);
    setRangeMode(true);

    if (rows.length === 0) {
      setPenalties([]);
      return;
    }

    const target = rows.some((r) => r.student_id === selected) ? selected : rows[0].student_id;
    setSelected(target);
    await loadPenalties(target, from, to);
  }

  async function openRangeStudent(studentId: string) {
    setRangeMode(true);
    setSelected(studentId);
    await loadPenalties(studentId, from, to);
  }

  async function removePenalty(penalty: Penalty) {
    if (!confirm("선택한 항목을 삭제할까요?")) return;
    setErr(null);
    setDeletingPenaltyId(penalty.id);
    try {
      await api.penalties.remove(penalty.id);
      if (!selected) {
        setPenalties((prev) => prev.filter((p) => p.id !== penalty.id));
        return;
      }

      if (rangeMode) {
        const rows = await api.penalties.studentsByRange(from, to);
        setRangeStudents(rows);
        const target = rows.some((r) => r.student_id === selected) ? selected : rows[0]?.student_id;
        if (!target) {
          setPenalties([]);
          return;
        }
        if (target !== selected) setSelected(target);
        await loadPenalties(target, from, to);
      } else {
        await loadPenalties(selected);
      }
    } catch (e: any) {
      setErr(e.message || "삭제 실패");
    } finally {
      setDeletingPenaltyId(null);
    }
  }

  function last4Digits(phone?: string | null) {
    const digits = String(phone || "").replace(/\D/g, "");
    if (!digits) return "0000";
    return digits.slice(-4).padStart(4, "0");
  }

  function maskedName(s: Student) {
    const name = String(s.name || "").trim();
    const first = name ? name[0] : "?";
    const last4 = last4Digits(s.student_phone || s.parent_phone);
    return `${first}OO(${last4})`;
  }

  function printTitle() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${mm}/${dd} 메디컬 로드맵 주간 벌점 현황 (${printFrom} ~ ${printTo})`;
  }

  async function downloadAll() {
    setErr(null);
    try {
      const data = await api.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `penalty-export-${todayYmd()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setErr(e.message || "전체 다운로드 실패");
    }
  }

  async function printAll() {
    setErr(null);
    if (printFrom > printTo) {
      setErr("프린트 기간 설정이 올바르지 않습니다. from <= to");
      return;
    }
    try {
      const list = await api.summary.cumulative(printFrom, printTo);
      setPrintRows(list);
      setPrintReady(true);
      setTimeout(() => window.print(), 100);
    } catch (e: any) {
      setErr(e.message || "프린트 준비 실패");
    }
  }

  return (
    <>
      <div className="no-print grid grid-cols-12 gap-4">
        {err && <div className="col-span-12 card p-4 border border-rose-100 bg-rose-50 text-rose-700 text-sm">{err}</div>}

        <div className="col-span-12 card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-base font-semibold">전체 데이터 다운로드</div>
              <div className="text-sm text-slate-500 mt-1">학생 DB, 벌점 기록, 규칙, 기준치를 한 번에 내려받습니다.</div>
            </div>
            <div className="flex items-end gap-2">
              <div className="w-[140px]">
                <div className="text-xs text-slate-500 mb-1">From</div>
                <DatePicker value={printFrom} onChange={setPrintFrom} />
              </div>
              <div className="w-[140px]">
                <div className="text-xs text-slate-500 mb-1">To</div>
                <DatePicker value={printTo} onChange={setPrintTo} />
              </div>
              <button className="btn" onClick={printAll}>A4 프린트</button>
              <button className="btn btn-gold" onClick={downloadAll}>전체 다운로드</button>
            </div>
          </div>
        </div>

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
                onClick={() => {
                  setRangeMode(false);
                  setRangeStudents([]);
                  setSelected(s.id);
                }}
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

        <div className="col-span-8 space-y-4 sticky top-24 self-start">
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
                <button className="btn btn-gold" onClick={checkRange}>벌점 확인</button>
              </div>
            </div>
            {rangeMode && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="text-xs text-slate-500 mb-2">기간 내 기록 학생</div>
                <div className="flex flex-wrap gap-2">
                  {rangeStudents.map((s) => (
                    <button
                      key={s.student_id}
                      className={[
                        "px-3 py-1 rounded-xl border text-sm",
                        selected === s.student_id ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 hover:bg-slate-50"
                      ].join(" ")}
                      onClick={() => openRangeStudent(s.student_id)}
                    >
                      {s.name} ({s.penalty_count}건 / {s.points_sum}점)
                    </button>
                  ))}
                  {rangeStudents.length === 0 && (
                    <div className="text-sm text-slate-500">선택한 기간에 기록된 벌점이 없습니다.</div>
                  )}
                </div>
              </div>
            )}
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
                    <th className="w-[100px]">삭제</th>
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
                        <button
                          className="btn btn-danger"
                          disabled={deletingPenaltyId === p.id}
                          onClick={() => removePenalty(p)}
                        >
                          {deletingPenaltyId === p.id ? "Deleting..." : "Delete"}
                        </button>
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

      <div className="print-only">
        <div className="print-sheet">
          <div className="print-title">{printTitle()}</div>
          <div className="print-period">기간: {printFrom} ~ {printTo}</div>
          {printReady && printRows.length > 0 ? (
            <div className="print-list">
              {printRows.map((s) => (
                <div key={s.id} className="print-row">
                  <span className="print-name">{maskedName(s)}</span>
                  <span className="print-points">{s.points}점</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="print-empty">출력할 데이터가 없습니다.</div>
          )}
        </div>
      </div>
    </>
  );
}
