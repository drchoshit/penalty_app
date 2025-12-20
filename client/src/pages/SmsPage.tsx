import { useEffect, useMemo, useState } from "react";
import { api, Threshold } from "../lib/api";

function applyTemplate(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

export default function SmsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [ths, setThs] = useState<Threshold[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [target, setTarget] = useState<"student" | "parent" | "both">("parent");
  const [message, setMessage] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function refresh() {
    const [s, t] = await Promise.all([api.summary.cumulative(), api.thresholds.list()]);
    setRows(s);
    setThs(t);
    if (s.length && !selected) setSelected(s[0].id);
  }

  useEffect(() => {
    refresh().catch((e) => setErr(e.message || "불러오기 실패"));
  }, []);

  const selectedStudent = useMemo(() => rows.find(r => r.id === selected), [rows, selected]);

  const bestThreshold = useMemo(() => {
    if (!selectedStudent) return null;
    const p = Number(selectedStudent.points || 0);
    const candidates = [...ths].sort((a,b) => b.min_points - a.min_points).filter(t => p >= t.min_points);
    return candidates[0] || null;
  }, [ths, selectedStudent]);

  useEffect(() => {
    if (!selectedStudent) return;
    const p = String(selectedStudent.points ?? 0);
    const th = bestThreshold;
    const tpl = th?.message_template || "[센터] {name} 학생 벌점 누적 {points}점입니다.";
    setMessage(applyTemplate(tpl, {
      name: selectedStudent.name,
      points: p,
      threshold: th ? String(th.min_points) : "",
      label: th ? th.label : ""
    }));
  }, [selectedStudent, bestThreshold]);

  const exceededMap = useMemo(() => {
    const sorted = [...ths].sort((a,b) => a.min_points - b.min_points);
    return new Map(rows.map(r => {
      const p = Number(r.points || 0);
      const hit = sorted.filter(t => p >= t.min_points);
      const top = hit.length ? hit[hit.length - 1] : null;
      return [r.id, top];
    }));
  }, [rows, ths]);

  async function send() {
    setErr(null);
    setInfo(null);
    if (!selected) {
      setErr("학생을 선택하세요.");
      return;
    }
    if (!message.trim()) {
      setErr("문자 내용을 입력하세요.");
      return;
    }
    try {
      await api.sms.send(selected, target, message.trim());
      setInfo("발송 요청이 완료되었습니다.");
    } catch (e: any) {
      setErr(e.message || "발송 실패(서버 환경변수/발신번호 등록 여부 확인)");
    }
  }

  return (
    <div className="grid grid-cols-12 gap-4">
      {err && <div className="col-span-12 card p-4 border border-rose-100 bg-rose-50 text-rose-700 text-sm">{err}</div>}
      {info && <div className="col-span-12 card p-4 border border-emerald-100 bg-emerald-50 text-emerald-700 text-sm">{info}</div>}

      <div className="col-span-8 card p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-semibold">문자 대상</div>
            <div className="text-sm text-slate-500 mt-1">누적 벌점과 기준치 초과 여부를 확인하고 발송합니다.</div>
          </div>
        </div>

        <div className="mt-4 overflow-auto">
          <table className="table min-w-[900px]">
            <thead>
              <tr>
                <th>이름</th>
                <th>학년</th>
                <th>학생전화</th>
                <th>보호자전화</th>
                <th>누적</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const hit = exceededMap.get(r.id) as Threshold | null | undefined;
                const p = Number(r.points || 0);
                const badge =
                  hit ? (hit.label || `>=${hit.min_points}`) : "정상";

                const badgeCls = hit
                  ? (p >= (hit.min_points || 0) ? "badge-danger" : "badge")
                  : "badge";

                return (
                  <tr
                    key={r.id}
                    className={selected === r.id ? "bg-slate-50" : ""}
                    onClick={() => setSelected(r.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>{r.name}</td>
                    <td>{r.grade || ""}</td>
                    <td className="text-slate-600">{r.student_phone || ""}</td>
                    <td className="text-slate-600">{r.parent_phone || ""}</td>
                    <td>{p}</td>
                    <td><span className={`badge ${badgeCls}`}>{badge}</span></td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="text-sm text-slate-500 py-10 text-center">학생이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="col-span-4 space-y-4">
        <div className="card p-5">
          <div className="text-base font-semibold">발송</div>
          <div className="text-sm text-slate-500 mt-1">학생을 선택하면 기본 템플릿이 자동으로 채워집니다.</div>

          <div className="mt-4 space-y-3">
            <div>
              <div className="text-xs text-slate-500 mb-1">선택 학생</div>
              <div className="text-sm">{selectedStudent ? `${selectedStudent.name} (${selectedStudent.grade || ""})` : "-"}</div>
              <div className="text-xs text-slate-500 mt-1">누적: {selectedStudent ? Number(selectedStudent.points || 0) : 0}점</div>
            </div>

            <div>
              <div className="text-xs text-slate-500 mb-1">수신 대상</div>
              <select className="input" value={target} onChange={(e) => setTarget(e.target.value as any)}>
                <option value="parent">보호자</option>
                <option value="student">학생</option>
                <option value="both">둘 다</option>
              </select>
            </div>

            <div>
              <div className="text-xs text-slate-500 mb-1">문자 내용</div>
              <textarea className="input min-h-[180px]" value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>

            <button className="btn btn-primary w-full" onClick={send}>문자 발송</button>

            <div className="text-xs text-slate-500">
              서버에 COOLSMS 환경변수가 설정되어 있어야 발송됩니다.
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="text-base font-semibold">기준치</div>
          <div className="mt-3 space-y-2">
            {ths.map(t => (
              <div key={t.id} className="flex items-center justify-between text-sm border border-slate-100 rounded-xl px-3 py-2">
                <div>{t.label}</div>
                <div className="text-slate-600">{t.min_points}점</div>
              </div>
            ))}
            {ths.length === 0 && <div className="text-sm text-slate-500">기준치가 없습니다.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
