import { useEffect, useMemo, useState } from "react";
import { api, Student } from "../lib/api";
import { Modal } from "../components/Modal";

function emptyStudent(): Student {
  return { id: "", name: "", grade: "", student_phone: "", parent_phone: "" };
}

export default function StudentsPage() {
  const [rows, setRows] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Student>(emptyStudent());

  async function refresh() {
    setLoading(true);
    setErr(null);
    try {
      const s = await api.students.list();
      setRows(s);
    } catch (e: any) {
      setErr(e.message || "불러오기 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const byId = useMemo(() => new Map(rows.map(r => [r.id, r])), [rows]);

  async function save() {
    if (!editing.id.trim() || !editing.name.trim()) {
      setErr("ID와 이름은 필수입니다.");
      return;
    }
    try {
      await api.students.upsert({
        ...editing,
        id: editing.id.trim(),
        name: editing.name.trim()
      });
      setEditOpen(false);
      await refresh();
    } catch (e: any) {
      setErr(e.message || "저장 실패");
    }
  }

  async function remove(id: string) {
    if (!confirm("정말 삭제할까요? (해당 학생 벌점/특이사항도 함께 삭제됩니다)")) return;
    try {
      await api.students.remove(id);
      await refresh();
    } catch (e: any) {
      setErr(e.message || "삭제 실패");
    }
  }

  async function onExcel(file: File) {
    setErr(null);
    try {
      await api.students.importExcel(file);
      await refresh();
    } catch (e: any) {
      setErr(e.message || "엑셀 업로드 실패");
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold">학생 DB</div>
            <div className="text-sm text-slate-500 mt-1">엑셀 업로드, 추가/수정, 삭제를 지원합니다.</div>
          </div>
          <div className="flex items-center gap-2">
            <label className="btn">
              엑셀 불러오기
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onExcel(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <button
              className="btn btn-primary"
              onClick={() => {
                setErr(null);
                setEditing(emptyStudent());
                setEditOpen(true);
              }}
            >
              신규 학생
            </button>
          </div>
        </div>
      </div>

      {err && <div className="card p-4 border border-rose-100 bg-rose-50 text-rose-700 text-sm">{err}</div>}

      <div className="card p-5">
        {loading ? (
          <div className="text-sm text-slate-500">불러오는 중...</div>
        ) : (
          <div className="overflow-auto">
            <table className="table min-w-[800px]">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>이름</th>
                  <th>학년</th>
                  <th>학생전화</th>
                  <th>보호자전화</th>
                  <th className="w-[160px]">작업</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono text-xs text-slate-600">{r.id}</td>
                    <td>{r.name}</td>
                    <td>{r.grade}</td>
                    <td className="text-slate-600">{r.student_phone}</td>
                    <td className="text-slate-600">{r.parent_phone}</td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          className="btn"
                          onClick={() => {
                            setErr(null);
                            setEditing({ ...r });
                            setEditOpen(true);
                          }}
                        >
                          수정
                        </button>
                        <button className="btn btn-danger" onClick={() => remove(r.id)}>
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-sm text-slate-500 py-10 text-center">
                      학생이 없습니다. 엑셀 불러오기 또는 신규 학생 추가를 진행하세요.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={editOpen} title={byId.has(editing.id) ? "학생 수정" : "학생 추가"} onClose={() => setEditOpen(false)}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-slate-500 mb-1">ID</div>
            <input className="input" value={editing.id} onChange={(e) => setEditing({ ...editing, id: e.target.value })} />
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">이름</div>
            <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">학년</div>
            <input className="input" value={editing.grade ?? ""} onChange={(e) => setEditing({ ...editing, grade: e.target.value })} />
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">학생전화</div>
            <input className="input" value={editing.student_phone ?? ""} onChange={(e) => setEditing({ ...editing, student_phone: e.target.value })} />
          </div>
          <div className="col-span-2">
            <div className="text-xs text-slate-500 mb-1">보호자전화</div>
            <input className="input" value={editing.parent_phone ?? ""} onChange={(e) => setEditing({ ...editing, parent_phone: e.target.value })} />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button className="btn" onClick={() => setEditOpen(false)}>취소</button>
          <button className="btn btn-primary" onClick={save}>저장</button>
        </div>
      </Modal>
    </div>
  );
}
