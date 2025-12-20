import { useEffect, useState } from "react";
import { api, Note, Student } from "../lib/api";
import DatePicker from "../components/DatePicker";
import { todayYmd } from "../lib/date";

export default function NotesPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState<string>("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [date, setDate] = useState<string>(() => todayYmd());
  const [content, setContent] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  async function refreshStudents() {
    const s = await api.students.list();
    setStudents(s);
    if (s.length && !studentId) setStudentId(s[0].id);
  }

  async function refreshNotes(sid: string) {
    const n = await api.notes.list(sid);
    setNotes(n);
  }

  useEffect(() => {
    refreshStudents().catch((e) => setErr(e.message || "불러오기 실패"));
  }, []);

  useEffect(() => {
    if (!studentId) return;
    refreshNotes(studentId).catch((e) => setErr(e.message || "불러오기 실패"));
  }, [studentId]);

  async function add() {
    setErr(null);
    if (!studentId) {
      setErr("학생 선택이 필요합니다.");
      return;
    }
    if (!content.trim()) {
      setErr("내용을 입력하세요.");
      return;
    }
    try {
      await api.notes.upsert({ student_id: studentId, noted_on: date, content: content.trim() });
      setContent("");
      await refreshNotes(studentId);
    } catch (e: any) {
      setErr(e.message || "저장 실패");
    }
  }

  async function remove(id: string) {
    if (!confirm("삭제할까요?")) return;
    await api.notes.remove(id);
    await refreshNotes(studentId);
  }

  return (
    <div className="grid grid-cols-12 gap-4">
      {err && <div className="col-span-12 card p-4 border border-rose-100 bg-rose-50 text-rose-700 text-sm">{err}</div>}

      <div className="col-span-4 card p-5">
        <div className="text-base font-semibold">학생</div>
        <div className="text-sm text-slate-500 mt-1">학생별 특이사항을 관리합니다.</div>

        <div className="mt-4">
          <select className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.grade || ""})</option>)}
          </select>
        </div>

        <div className="mt-5 space-y-3">
          <div>
            <div className="text-xs text-slate-500 mb-1">날짜</div>
            <DatePicker value={date} onChange={setDate} />
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">내용</div>
            <textarea className="input min-h-[140px]" value={content} onChange={(e) => setContent(e.target.value)} placeholder="자유롭게 기록" />
          </div>
          <button className="btn btn-primary w-full" onClick={add}>추가</button>
        </div>
      </div>

      <div className="col-span-8 card p-5">
        <div className="text-base font-semibold">기록</div>
        <div className="text-sm text-slate-500 mt-1">최신 순으로 표시됩니다.</div>

        <div className="mt-4 space-y-2">
          {notes.map(n => (
            <div key={n.id} className="rounded-2xl border border-slate-100 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono text-slate-600">{n.noted_on}</div>
                <button className="btn btn-danger" onClick={() => remove(n.id)}>삭제</button>
              </div>
              <div className="mt-2 text-sm whitespace-pre-wrap">{n.content}</div>
            </div>
          ))}
          {notes.length === 0 && <div className="text-sm text-slate-500 py-10 text-center">특이사항이 없습니다.</div>}
        </div>
      </div>
    </div>
  );
}
