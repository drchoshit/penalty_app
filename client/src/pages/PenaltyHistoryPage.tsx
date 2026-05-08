import { useEffect, useMemo, useState } from "react";
import { api, PenaltyMonthlyHistory, PenaltyResetEvent } from "../lib/api";
import { todayYmd } from "../lib/date";

function signed(value: number) {
  const n = Number(value || 0);
  return n > 0 ? `+${n}` : String(n);
}

function monthLabel(value: string) {
  const [y, m] = value.split("-");
  return `${y}.${m}`;
}

export default function PenaltyHistoryPage() {
  const currentMonth = todayYmd().slice(0, 7);
  const yearStart = `${currentMonth.slice(0, 4)}-01`;
  const [fromMonth, setFromMonth] = useState(yearStart);
  const [toMonth, setToMonth] = useState(currentMonth);
  const [rows, setRows] = useState<PenaltyMonthlyHistory[]>([]);
  const [events, setEvents] = useState<PenaltyResetEvent[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    setErr(null);
    if (fromMonth > toMonth) {
      setErr("월 설정이 올바르지 않습니다. from <= to");
      return;
    }
    const [history, resetEvents] = await Promise.all([
      api.penalties.monthlyHistory(fromMonth, toMonth),
      api.penalties.resetEvents()
    ]);
    setRows(history);
    setEvents(resetEvents);
  }

  useEffect(() => {
    refresh().catch((e) => setErr(e.message || "불러오기 실패"));
  }, []);

  const total = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          penalty: acc.penalty + Number(row.penalty_points || 0),
          bonus: acc.bonus + Number(row.bonus_points || 0),
          net: acc.net + Number(row.net_points || 0),
          active: acc.active + Number(row.active_points || 0),
          preserved: acc.preserved + Number(row.reset_preserved_points || 0)
        }),
        { penalty: 0, bonus: 0, net: 0, active: 0, preserved: 0 }
      ),
    [rows]
  );

  return (
    <div className="space-y-4">
      {err && <div className="card p-4 border border-rose-100 bg-rose-50 text-rose-700 text-sm">{err}</div>}

      <div className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold">벌점 누적기록</div>
            <div className="text-sm text-slate-500 mt-1">월별 학생별 상점/벌점과 리셋 전 보존 점수를 확인합니다.</div>
          </div>
          <div className="flex items-end gap-2">
            <div className="w-[150px]">
              <div className="text-xs text-slate-500 mb-1">From</div>
              <input className="input" type="month" value={fromMonth} onChange={(e) => setFromMonth(e.target.value)} />
            </div>
            <div className="w-[150px]">
              <div className="text-xs text-slate-500 mb-1">To</div>
              <input className="input" type="month" value={toMonth} onChange={(e) => setToMonth(e.target.value)} />
            </div>
            <button className="btn btn-gold" onClick={refresh}>조회</button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-5 gap-2">
          <div className="rounded-xl border border-slate-100 px-3 py-2">
            <div className="text-xs text-slate-500">벌점</div>
            <div className="text-lg font-semibold text-rose-700">{total.penalty}점</div>
          </div>
          <div className="rounded-xl border border-slate-100 px-3 py-2">
            <div className="text-xs text-slate-500">상점</div>
            <div className="text-lg font-semibold text-emerald-700">{total.bonus}점</div>
          </div>
          <div className="rounded-xl border border-slate-100 px-3 py-2">
            <div className="text-xs text-slate-500">원래 합계</div>
            <div className="text-lg font-semibold">{signed(total.net)}점</div>
          </div>
          <div className="rounded-xl border border-slate-100 px-3 py-2">
            <div className="text-xs text-slate-500">현재 반영</div>
            <div className="text-lg font-semibold">{signed(total.active)}점</div>
          </div>
          <div className="rounded-xl border border-slate-100 px-3 py-2">
            <div className="text-xs text-slate-500">리셋 보존</div>
            <div className="text-lg font-semibold text-brand-green">{signed(total.preserved)}점</div>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="overflow-auto">
          <table className="table min-w-[980px]">
            <thead>
              <tr>
                <th>월</th>
                <th>학생</th>
                <th>학년</th>
                <th>벌점</th>
                <th>상점</th>
                <th>원래 합계</th>
                <th>현재 반영</th>
                <th>리셋 보존</th>
                <th>기록</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.month}-${row.student_id}`}>
                  <td className="font-mono text-xs text-slate-600">{monthLabel(row.month)}</td>
                  <td>{row.name}</td>
                  <td>{row.grade || ""}</td>
                  <td className="text-rose-700">{row.penalty_points}점</td>
                  <td className="text-emerald-700">{row.bonus_points}점</td>
                  <td>{signed(row.net_points)}점</td>
                  <td>{signed(row.active_points)}점</td>
                  <td className="text-brand-green">{signed(row.reset_preserved_points)}점</td>
                  <td className="text-xs text-slate-600">
                    {row.record_count}건
                    {row.reset_record_count ? ` / 리셋 ${row.reset_record_count}건` : ""}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-sm text-slate-500 py-10 text-center">누적기록이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-5">
        <div className="text-base font-semibold">최근 리셋 내역</div>
        <div className="mt-3 overflow-auto">
          <table className="table min-w-[720px]">
            <thead>
              <tr>
                <th>실행일</th>
                <th>기간</th>
                <th>학생</th>
                <th>기록</th>
                <th>보존 점수</th>
              </tr>
            </thead>
            <tbody>
              {events.slice(0, 20).map((event) => (
                <tr key={event.id}>
                  <td className="font-mono text-xs text-slate-600">{String(event.created_at || "").slice(0, 16)}</td>
                  <td>{event.from_date} ~ {event.to_date}</td>
                  <td>{event.student_count}명</td>
                  <td>{event.record_count}건</td>
                  <td>{signed(event.points_sum)}점</td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-sm text-slate-500 py-8 text-center">리셋 내역이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
