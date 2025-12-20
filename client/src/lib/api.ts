export type Student = {
  id: string;
  name: string;
  grade?: string | null;
  student_phone?: string | null;
  parent_phone?: string | null;
};

export type Rule = {
  id: string;
  title: string;
  points: number;
  is_active: number;
  sort_order: number;
};

export type Penalty = {
  id: string;
  student_id: string;
  rule_id: string;
  rule_title: string;
  points: number;
  occurred_on: string;
  memo?: string | null;
  created_at: string;
};

export type Threshold = {
  id: string;
  min_points: number;
  label: string;
  message_template: string;
  sort_order: number;
};

export type Note = {
  id: string;
  student_id: string;
  noted_on: string;
  content: string;
};

type ApiResp<T> = { ok: true; data: T } | { ok: false; message: string; detail?: any };

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init
  });

  // Some servers (or proxies) may return empty bodies on errors or 204.
  const raw = await r.text();
  if (!raw) {
    throw new Error(`API 응답이 비어있습니다: ${r.status} ${r.statusText} (${url})`);
  }

  let j: ApiResp<T>;
  try {
    j = JSON.parse(raw) as ApiResp<T>;
  } catch (e) {
    throw new Error(`API JSON 파싱 실패: ${r.status} ${r.statusText} (${url})\n응답: ${raw.slice(0, 200)}`);
  }

if (j === null) {
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  // Some endpoints may return 204; treat as null.
  return null as any as T;
}
if (!j.ok) {

    const detail = j.detail ? `\n상세: ${JSON.stringify(j.detail).slice(0, 400)}` : "";
    throw new Error(`${j.message}${detail}`);
  }
  return j.data;
}

export const api = {
  students: {
    list: () => req<Student[]>("/api/students"),
    upsert: (s: Student) => req<{ id: string }>("/api/students", { method: "POST", body: JSON.stringify(s) }),
    update: (id: string, s: Omit<Student, "id">) => req<{ id: string }>(`/api/students/${id}`, { method: "PUT", body: JSON.stringify(s) }),
    remove: (id: string) => req<boolean>(`/api/students/${id}`, { method: "DELETE" }),
    importExcel: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/students/import-excel", { method: "POST", body: fd });
      const j = await r.json();
      if (!j.ok) throw new Error(j.message || "엑셀 업로드 실패");
      return j.data as { imported: number };
    }
  },
  rules: {
    list: () => req<Rule[]>("/api/rules"),
    upsert: (r0: Partial<Rule>) => req<{ id: string }>("/api/rules", { method: "POST", body: JSON.stringify(r0) }),
    remove: (id: string) => req<boolean>(`/api/rules/${id}`, { method: "DELETE" })
  },
  thresholds: {
    list: () => req<Threshold[]>("/api/thresholds"),
    upsert: (t0: Partial<Threshold>) => req<{ id: string }>("/api/thresholds", { method: "POST", body: JSON.stringify(t0) }),
    remove: (id: string) => req<boolean>(`/api/thresholds/${id}`, { method: "DELETE" })
  },
  penalties: {
    list: (studentId: string, from?: string, to?: string) => {
      const qs = new URLSearchParams({ studentId, ...(from ? { from } : {}), ...(to ? { to } : {}) });
      return req<Penalty[]>(`/api/penalties?${qs.toString()}`);
    },
    create: (p: { student_id: string; rule_id: string; occurred_on: string; memo?: string | null }) =>
      req<{ id: string }>("/api/penalties", { method: "POST", body: JSON.stringify(p) }),
    remove: (id: string) => req<boolean>(`/api/penalties/${id}`, { method: "DELETE" }),
    reset: (student_id: string, from: string, to: string) =>
      req<{ deleted: number }>("/api/penalties/reset", { method: "POST", body: JSON.stringify({ student_id, from, to }) })
  },
  summary: {
    cumulative: () => req<(Student & { points: number })[]>("/api/summary/cumulative")
  },
  notes: {
    list: (studentId: string) => req<Note[]>(`/api/notes?${new URLSearchParams({ studentId }).toString()}`),
    upsert: (n: Partial<Note>) => req<{ id: string }>("/api/notes", { method: "POST", body: JSON.stringify(n) }),
    remove: (id: string) => req<boolean>(`/api/notes/${id}`, { method: "DELETE" })
  },
  sms: {
    send: (student_id: string, target: "student" | "parent" | "both", message: string) =>
      req<any>("/api/sms/send", { method: "POST", body: JSON.stringify({ student_id, target, message }) })
  }
};