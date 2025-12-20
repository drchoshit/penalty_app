import { useEffect, useState } from "react";
import { api, Rule, Threshold } from "../lib/api";
import { Modal } from "../components/Modal";

export default function SettingsPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [ths, setThs] = useState<Threshold[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleEdit, setRuleEdit] = useState<Partial<Rule>>({ title: "", points: 1, is_active: 1, sort_order: 0 });

  const [thOpen, setThOpen] = useState(false);
  const [thEdit, setThEdit] = useState<Partial<Threshold>>({ label: "", min_points: 0, message_template: "", sort_order: 0 });

  async function refresh() {
    const [r, t] = await Promise.all([api.rules.list(), api.thresholds.list()]);
    setRules(r);
    setThs(t);
  }

  useEffect(() => {
    refresh().catch((e) => setErr(e.message || "불러오기 실패"));
  }, []);

  async function saveRule() {
    setErr(null);
    try {
      await api.rules.upsert({
        ...ruleEdit,
        points: Number(ruleEdit.points ?? 0),
        is_active: Number(ruleEdit.is_active ?? 1),
        sort_order: Number(ruleEdit.sort_order ?? 0)
      });
      setRuleOpen(false);
      await refresh();
    } catch (e: any) {
      setErr(e.message || "저장 실패");
    }
  }

  async function delRule(id: string) {
    if (!confirm("규칙을 삭제할까요? (이미 부여된 벌점 내역은 그대로 남습니다)")) return;
    await api.rules.remove(id);
    await refresh();
  }

  async function saveTh() {
    setErr(null);
    try {
      await api.thresholds.upsert({
        ...thEdit,
        min_points: Number(thEdit.min_points ?? 0),
        sort_order: Number(thEdit.sort_order ?? 0)
      });
      setThOpen(false);
      await refresh();
    } catch (e: any) {
      setErr(e.message || "저장 실패");
    }
  }

  async function delTh(id: string) {
    if (!confirm("기준치를 삭제할까요?")) return;
    await api.thresholds.remove(id);
    await refresh();
  }

  return (
    <div className="space-y-4">
      {err && <div className="card p-4 border border-rose-100 bg-rose-50 text-rose-700 text-sm">{err}</div>}

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-semibold">위반 항목(규칙)</div>
              <div className="text-sm text-slate-500 mt-1">벌점 항목과 점수를 관리합니다.</div>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => {
                setRuleEdit({ title: "", points: 1, is_active: 1, sort_order: 0 });
                setRuleOpen(true);
              }}
            >
              추가
            </button>
          </div>

          <div className="mt-4 overflow-auto">
            <table className="table min-w-[560px]">
              <thead>
                <tr>
                  <th>항목</th>
                  <th>점수</th>
                  <th>활성</th>
                  <th>정렬</th>
                  <th className="w-[160px]">작업</th>
                </tr>
              </thead>
              <tbody>
                {rules.map(r => (
                  <tr key={r.id}>
                    <td>{r.title}</td>
                    <td>{r.points}</td>
                    <td>{r.is_active ? "Y" : "N"}</td>
                    <td>{r.sort_order}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn" onClick={() => { setRuleEdit({ ...r }); setRuleOpen(true); }}>수정</button>
                        <button className="btn btn-danger" onClick={() => delRule(r.id)}>삭제</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rules.length === 0 && <tr><td colSpan={5} className="text-sm text-slate-500 py-10 text-center">규칙이 없습니다.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-semibold">기준치/패널티</div>
              <div className="text-sm text-slate-500 mt-1">누적 벌점 기준과 문자 템플릿을 관리합니다.</div>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => {
                setThEdit({ label: "", min_points: 0, message_template: "", sort_order: 0 });
                setThOpen(true);
              }}
            >
              추가
            </button>
          </div>

          <div className="mt-4 overflow-auto">
            <table className="table min-w-[560px]">
              <thead>
                <tr>
                  <th>기준점수</th>
                  <th>라벨</th>
                  <th>정렬</th>
                  <th className="w-[160px]">작업</th>
                </tr>
              </thead>
              <tbody>
                {ths.map(t => (
                  <tr key={t.id}>
                    <td>{t.min_points}</td>
                    <td>{t.label}</td>
                    <td>{t.sort_order}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn" onClick={() => { setThEdit({ ...t }); setThOpen(true); }}>수정</button>
                        <button className="btn btn-danger" onClick={() => delTh(t.id)}>삭제</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {ths.length === 0 && <tr><td colSpan={4} className="text-sm text-slate-500 py-10 text-center">기준치가 없습니다.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal open={ruleOpen} title="규칙 편집" onClose={() => setRuleOpen(false)}>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <div className="text-xs text-slate-500 mb-1">항목명</div>
            <input className="input" value={ruleEdit.title ?? ""} onChange={(e) => setRuleEdit({ ...ruleEdit, title: e.target.value })} />
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">점수</div>
            <input className="input" type="number" value={Number(ruleEdit.points ?? 0)} onChange={(e) => setRuleEdit({ ...ruleEdit, points: Number(e.target.value) })} />
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">정렬</div>
            <input className="input" type="number" value={Number(ruleEdit.sort_order ?? 0)} onChange={(e) => setRuleEdit({ ...ruleEdit, sort_order: Number(e.target.value) })} />
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">활성</div>
            <select className="input" value={Number(ruleEdit.is_active ?? 1)} onChange={(e) => setRuleEdit({ ...ruleEdit, is_active: Number(e.target.value) as any })}>
              <option value={1}>Y</option>
              <option value={0}>N</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button className="btn" onClick={() => setRuleOpen(false)}>취소</button>
          <button className="btn btn-primary" onClick={saveRule}>저장</button>
        </div>
      </Modal>

      <Modal open={thOpen} title="기준치 편집" onClose={() => setThOpen(false)}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-slate-500 mb-1">기준점수(min)</div>
              <input className="input" type="number" value={Number(thEdit.min_points ?? 0)} onChange={(e) => setThEdit({ ...thEdit, min_points: Number(e.target.value) })} />
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">라벨</div>
              <input className="input" value={thEdit.label ?? ""} onChange={(e) => setThEdit({ ...thEdit, label: e.target.value })} />
            </div>
            <div className="col-span-2">
              <div className="text-xs text-slate-500 mb-1">정렬</div>
              <input className="input" type="number" value={Number(thEdit.sort_order ?? 0)} onChange={(e) => setThEdit({ ...thEdit, sort_order: Number(e.target.value) })} />
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 mb-1">문자 템플릿</div>
            <div className="text-xs text-slate-500 mb-2">
              사용 가능 변수: {"{name}"} {"{points}"} {"{threshold}"} {"{label}"}
            </div>
            <textarea className="input min-h-[140px]" value={thEdit.message_template ?? ""} onChange={(e) => setThEdit({ ...thEdit, message_template: e.target.value })} />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button className="btn" onClick={() => setThOpen(false)}>취소</button>
          <button className="btn btn-primary" onClick={saveTh}>저장</button>
        </div>
      </Modal>
    </div>
  );
}
