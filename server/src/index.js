import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import multer from "multer";
import XLSX from "xlsx";

import { openDb, uid } from "./db.js";
import {
  StudentSchema,
  RuleSchema,
  PenaltyCreateSchema,
  ResetSchema,
  ThresholdSchema,
  NoteSchema,
  SmsSendSchema
} from "./validate.js";

import { makeSmsClient, normalizePhone, sendSms } from "./sms.js";

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;
const DB_PATH = process.env.DB_PATH || "./data/app.db";

const app = express();

app.get("/api/health", (req, res) => ok(res, { status: "ok" }));
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const db = openDb(DB_PATH);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function bad(res, message, detail) {
  return res.status(400).json({ ok: false, message, detail });
}

function ok(res, data) {
  return res.json({ ok: true, data });
}

/* Students */
app.get("/api/students", (req, res) => {
  const rows = db.prepare("SELECT * FROM students ORDER BY name COLLATE NOCASE").all();
  ok(res, rows);
});

app.post("/api/students", (req, res) => {
  const parsed = StudentSchema.safeParse(req.body);
  if (!parsed.success) return bad(res, "학생 데이터가 올바르지 않습니다.", parsed.error.issues);

  const s = parsed.data;
  const stmt = db.prepare(`
    INSERT INTO students (id, name, grade, student_phone, parent_phone, updated_at)
    VALUES (@id,@name,@grade,@student_phone,@parent_phone, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      grade=excluded.grade,
      student_phone=excluded.student_phone,
      parent_phone=excluded.parent_phone,
      updated_at=datetime('now')
  `);
  stmt.run({
    id: s.id,
    name: s.name,
    grade: s.grade ?? null,
    student_phone: s.student_phone ?? null,
    parent_phone: s.parent_phone ?? null
  });
  ok(res, { id: s.id });
});

app.put("/api/students/:id", (req, res) => {
  const parsed = StudentSchema.safeParse({ ...req.body, id: req.params.id });
  if (!parsed.success) return bad(res, "학생 데이터가 올바르지 않습니다.", parsed.error.issues);

  const s = parsed.data;
  db.prepare(`
    UPDATE students
    SET name=@name, grade=@grade, student_phone=@student_phone, parent_phone=@parent_phone, updated_at=datetime('now')
    WHERE id=@id
  `).run({
    id: s.id,
    name: s.name,
    grade: s.grade ?? null,
    student_phone: s.student_phone ?? null,
    parent_phone: s.parent_phone ?? null
  });

  ok(res, { id: s.id });
});

app.delete("/api/students/:id", (req, res) => {
  db.prepare("DELETE FROM students WHERE id=?").run(req.params.id);
  ok(res, true);
});

app.post("/api/students/import-excel", upload.single("file"), (req, res) => {
  if (!req.file) return bad(res, "엑셀 파일이 필요합니다.");

  const wb = XLSX.read(req.file.buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(ws, { defval: "" });

  // 기대 헤더: ID, 이름, 학년, 학생전화, 보호자전화
  const normalized = json.map((r) => ({
    id: String(r["ID"] ?? "").trim(),
    name: String(r["이름"] ?? "").trim(),
    grade: String(r["학년"] ?? "").trim(),
    student_phone: String(r["학생전화"] ?? "").trim(),
    parent_phone: String(r["보호자전화"] ?? "").trim()
  })).filter(r => r.id && r.name);

  const insert = db.prepare(`
    INSERT INTO students (id, name, grade, student_phone, parent_phone, updated_at)
    VALUES (@id,@name,@grade,@student_phone,@parent_phone, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      grade=excluded.grade,
      student_phone=excluded.student_phone,
      parent_phone=excluded.parent_phone,
      updated_at=datetime('now')
  `);

  const tx = db.transaction((rows) => rows.forEach(r => insert.run({
    id: r.id,
    name: r.name,
    grade: r.grade || null,
    student_phone: r.student_phone || null,
    parent_phone: r.parent_phone || null
  })));
  tx(normalized);

  ok(res, { imported: normalized.length });
});

/* Rules */
app.get("/api/rules", (req, res) => {
  const rows = db.prepare("SELECT * FROM rules ORDER BY sort_order ASC, title COLLATE NOCASE ASC").all();
  ok(res, rows);
});

app.post("/api/rules", (req, res) => {
  const body = { ...req.body };
  if (!body.id) body.id = uid("rule");
  body.points = Number(body.points);
  body.is_active = body.is_active == null ? 1 : Number(body.is_active);
  body.sort_order = body.sort_order == null ? 0 : Number(body.sort_order);

  const parsed = RuleSchema.safeParse(body);
  if (!parsed.success) return bad(res, "규칙 데이터가 올바르지 않습니다.", parsed.error.issues);

  const r = parsed.data;
  db.prepare(`
    INSERT INTO rules (id, title, points, is_active, sort_order, updated_at)
    VALUES (@id,@title,@points,@is_active,@sort_order, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title,
      points=excluded.points,
      is_active=excluded.is_active,
      sort_order=excluded.sort_order,
      updated_at=datetime('now')
  `).run(r);

  ok(res, { id: r.id });
});

app.delete("/api/rules/:id", (req, res) => {
  db.prepare("DELETE FROM rules WHERE id=?").run(req.params.id);
  ok(res, true);
});

/* Thresholds */
app.get("/api/thresholds", (req, res) => {
  const rows = db.prepare("SELECT * FROM thresholds ORDER BY sort_order ASC, min_points ASC").all();
  ok(res, rows);
});

app.post("/api/thresholds", (req, res) => {
  const body = { ...req.body };
  if (!body.id) body.id = uid("th");
  body.min_points = Number(body.min_points);
  body.sort_order = body.sort_order == null ? 0 : Number(body.sort_order);

  const parsed = ThresholdSchema.safeParse(body);
  if (!parsed.success) return bad(res, "기준치 데이터가 올바르지 않습니다.", parsed.error.issues);

  const t = parsed.data;
  db.prepare(`
    INSERT INTO thresholds (id, min_points, label, message_template, sort_order, updated_at)
    VALUES (@id,@min_points,@label,@message_template,@sort_order, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      min_points=excluded.min_points,
      label=excluded.label,
      message_template=excluded.message_template,
      sort_order=excluded.sort_order,
      updated_at=datetime('now')
  `).run(t);

  ok(res, { id: t.id });
});

app.delete("/api/thresholds/:id", (req, res) => {
  db.prepare("DELETE FROM thresholds WHERE id=?").run(req.params.id);
  ok(res, true);
});

/* Penalties */
app.get("/api/penalties", (req, res) => {
  const { studentId, from, to } = req.query;
  if (!studentId) return bad(res, "studentId가 필요합니다.");

  const params = { studentId, from: from || "0000-01-01", to: to || "9999-12-31" };
  const rows = db.prepare(`
    SELECT * FROM penalties
    WHERE student_id=@studentId
      AND occurred_on BETWEEN @from AND @to
    ORDER BY occurred_on DESC, created_at DESC
  `).all(params);

  ok(res, rows);
});

app.post("/api/penalties", (req, res) => {
  const parsed = PenaltyCreateSchema.safeParse(req.body);
  if (!parsed.success) return bad(res, "벌점 데이터가 올바르지 않습니다.", parsed.error.issues);

  const p = parsed.data;
  const rule = db.prepare("SELECT * FROM rules WHERE id=?").get(p.rule_id);
  if (!rule) return bad(res, "규칙(rule)을 찾을 수 없습니다.");

  const id = uid("pen");
  db.prepare(`
    INSERT INTO penalties (id, student_id, rule_id, rule_title, points, occurred_on, memo)
    VALUES (@id,@student_id,@rule_id,@rule_title,@points,@occurred_on,@memo)
  `).run({
    id,
    student_id: p.student_id,
    rule_id: rule.id,
    rule_title: rule.title,
    points: rule.points,
    occurred_on: p.occurred_on,
    memo: p.memo ?? null
  });

  ok(res, { id });
});

app.delete("/api/penalties/:id", (req, res) => {
  db.prepare("DELETE FROM penalties WHERE id=?").run(req.params.id);
  ok(res, true);
});

app.post("/api/penalties/reset", (req, res) => {
  const parsed = ResetSchema.safeParse(req.body);
  if (!parsed.success) return bad(res, "리셋 조건이 올바르지 않습니다.", parsed.error.issues);

  const { student_id, from, to } = parsed.data;
  const info = db.prepare(`
    DELETE FROM penalties
    WHERE student_id=? AND occurred_on BETWEEN ? AND ?
  `).run(student_id, from, to);

  ok(res, { deleted: info.changes });
});

/* Notes */
app.get("/api/notes", (req, res) => {
  const { studentId } = req.query;
  if (!studentId) return bad(res, "studentId가 필요합니다.");
  const rows = db.prepare(`
    SELECT * FROM notes
    WHERE student_id=?
    ORDER BY noted_on DESC, created_at DESC
  `).all(studentId);
  ok(res, rows);
});

app.post("/api/notes", (req, res) => {
  const body = { ...req.body };
  if (!body.id) body.id = uid("note");
  const parsed = NoteSchema.safeParse(body);
  if (!parsed.success) return bad(res, "특이사항 데이터가 올바르지 않습니다.", parsed.error.issues);

  const n = parsed.data;
  db.prepare(`
    INSERT INTO notes (id, student_id, noted_on, content, updated_at)
    VALUES (@id,@student_id,@noted_on,@content, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      noted_on=excluded.noted_on,
      content=excluded.content,
      updated_at=datetime('now')
  `).run(n);

  ok(res, { id: n.id });
});

app.delete("/api/notes/:id", (req, res) => {
  db.prepare("DELETE FROM notes WHERE id=?").run(req.params.id);
  ok(res, true);
});

/* Summary */
app.get("/api/summary/cumulative", (req, res) => {
  const rows = db.prepare(`
    SELECT s.*, IFNULL(SUM(p.points),0) AS points
    FROM students s
    LEFT JOIN penalties p ON p.student_id = s.id
    GROUP BY s.id
    ORDER BY s.name COLLATE NOCASE
  `).all();
  ok(res, rows);
});

/* SMS */
app.post("/api/sms/send", async (req, res) => {
  const parsed = SmsSendSchema.safeParse(req.body);
  if (!parsed.success) return bad(res, "문자 발송 데이터가 올바르지 않습니다.", parsed.error.issues);

  const client = makeSmsClient();
  if (!client) return bad(res, "COOLSMS_API_KEY/SECRET 환경변수가 설정되지 않았습니다.");

  const sender = normalizePhone(process.env.COOLSMS_SENDER_PHONE);
  if (!sender) return bad(res, "COOLSMS_SENDER_PHONE 환경변수가 필요합니다.");

  const { student_id, target, message } = parsed.data;
  const s = db.prepare("SELECT * FROM students WHERE id=?").get(student_id);
  if (!s) return bad(res, "학생을 찾을 수 없습니다.");

  const tos = [];
  if (target === "student" || target === "both") {
    const p = normalizePhone(s.student_phone);
    if (p) tos.push(p);
  }
  if (target === "parent" || target === "both") {
    const p = normalizePhone(s.parent_phone);
    if (p) tos.push(p);
  }
  const uniqueTos = [...new Set(tos)];
  if (uniqueTos.length === 0) return bad(res, "수신번호가 없습니다(학생/보호자 전화번호 확인).");

  try {
    const results = [];
    for (const to of uniqueTos) {
      const r = await sendSms({ client, to, from: sender, text: message });
      results.push(r);
    }
    ok(res, { sent: uniqueTos.length, results });
  } catch (e) {
    return res.status(500).json({ ok: false, message: "문자 발송 실패", detail: String(e?.message || e) });
  }
});

/* Serve client build in production */
const distPath = path.resolve("client", "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
}

app.listen(PORT, () => {
  console.log(`server listening on :${PORT}`);
  console.log(`db: ${DB_PATH}`);
});