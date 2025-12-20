import { useEffect, useMemo, useState } from "react";
import { api, Rule, Student } from "../lib/api";
import DatePicker from "../components/DatePicker";
import { todayYmd } from "../lib/date";

export default function AssignPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [studentId, setStudentId] = useState<string>("");
  const [date, setDate] = useState<string>(() => todayYmd());
  const [ruleId, setRuleId] = useState<string>("");
  const [memo, setMemo] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const activeRules = useMemo(() => rules.filter(r => r.is_active), [rules]);

  useEffect(() => {
    (async () => {
      const [s, r] = await Promise.all([api.students.list(), api.rules.list()]);
      setStudents(s);
      setRules(r);
      if (s.length) setStudentId(s[0].id);
      if (r.length) setRuleId((r.find(x => x.is_active) || r[0]).id);
    })().catch((e) => setErr(e.message || "불러오기 실패"));
  }, []);

  async function submit() {
    setErr(null);
    setOkMsg(null);
    if (!studentId || !ruleId) {
      setErr("학생과 위반 항목을 선택하세요.");
      return;
    }
    try {
      await api.penalties.create({ student_id: studentId, rule_id: ruleId, occurred_on: date, memo: memo || null });
      setOkMsg("벌점이 부여되었습니다.");
      setMemo("");
    } catch (e: any) {
      setErr(e.message || "부여 실패");
    }
  }

  return (
    <div className="space-y-4">
      {err && <div className="card p-4 border border-rose-100 bg-rose-50 text-rose-700 text-sm">{err}</div>}
      {okMsg && <div className="card p-4 border border-emerald-100 bg-emerald-50 text-emerald-700 text-sm">{okMsg}</div>}

      <div className="card p-5">
        <div className="text-base font-semibold">벌점 부여</div>
        <div className="text-sm text-slate-500 mt-1">학생, 날짜, 위반 항목을 선택한 뒤 저장합니다.</div>

        <div className="grid grid-cols-12 gap-3 mt-5">
          <div className="col-span-4">
            <div className="text-xs text-slate-500 mb-1">학생</div>
            <select className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.grade || ""})</option>)}
            </select>
          </div>

          <div className="col-span-4">
            <div className="text-xs text-slate-500 mb-1">날짜</div>
            <DatePicker value={date} onChange={setDate} />
          </div>

          <div className="col-span-4">
            <div className="text-xs text-slate-500 mb-1">위반 항목</div>
            <select className="input" value={ruleId} onChange={(e) => setRuleId(e.target.value)}>
              {activeRules.map(r => <option key={r.id} value={r.id}>{r.title} ({r.points}점)</option>)}
            </select>
          </div>

          <div className="col-span-12">
            <div className="text-xs text-slate-500 mb-1">메모(선택)</div>
            <input className="input" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예: 1교시 지각" />
          </div>
        </div>

        <div className="flex justify-end mt-5">
          <button className="btn btn-primary" onClick={submit}>저장</button>
        </div>
      </div>
    </div>
  );
}
