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
  ThresholdSchema,
  NoteSchema,
  SmsSendSchema
} from "./validate.js";

import { makeSmsClient, normalizePhone, sendSms } from "./sms.js";

const app = express();

function ok(res, data) {
  return res.json({ ok: true, data });
}
function bad(res, message, detail) {
  return res.status(400).json({ ok: false, message, detail });
}
function ensureDirForDb(dbPath) {
  try {
    // DB_PATH가 "/var/data/app.db" 처럼 파일 경로라면 디렉토리 생성
    const dir = path.dirname(dbPath);
    if (dir && dir !== "." && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch {
    // 무시 (권한/경로 이슈 등)
  }
}

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;
const DB_PATH = process.env.DB_PATH || "./data/app.db";
ensureDirForDb(DB_PATH);

app.set("trust proxy", true);

// CORS: 단일 서비스(프론트도 같은 도메인)면 사실 없어도 되지만,
// 로컬 개발/분리 배포도 가능하도록 안전하게 열어둠.
app.use(
  cors({
    origin: true,
    credentials: true
  })
);

app.use(express.json({ limit: "5mb" }));

const db = openDb(DB_PATH);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});
const ymd = /^\d{4}-\d{2}-\d{2}$/;
const ym = /^\d{4}-\d{2}$/;

function validateDateRange(res, from, to) {
  if (typeof from !== "string" || typeof to !== "string" || !ymd.test(from) || !ymd.test(to)) {
    bad(res, "기간 형식이 올바르지 않습니다. YYYY-MM-DD");
    return false;
  }
  if (from > to) {
    bad(res, "기간 설정이 올바르지 않습니다. from <= to");
    return false;
  }
  return true;
}

function normalizeStudentIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((id) => String(id || "").trim()).filter(Boolean))];
}

/* Health */
app.get("/api/health", (req, res) => ok(res, { status: "ok" }));
app.get("/healthz", (req, res) => ok(res, { status: "ok" }));

/* Students */
app.get("/api/students", (req, res) => {
  const rows = db.prepare("SELECT * FROM students ORDER BY name COLLATE NOCASE").all();
  ok(res, rows);
});

app.post("/api/students", (req, res) => {
  const parsed = StudentSchema.safeParse(req.body);
  if (!parsed.success) return bad(res, "학생 데이터가 올바르지 않습니다.", parsed.error.issues);

  const s = parsed.data;
  db.prepare(
    `
    INSERT INTO students (id, name, grade, student_phone, parent_phone, updated_at)
    VALUES (@id,@name,@grade,@student_phone,@parent_phone, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      grade=excluded.grade,
      student_phone=excluded.student_phone,
      parent_phone=excluded.parent_phone,
      updated_at=datetime('now')
  `
  ).run({
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
  db.prepare(
    `
    UPDATE students
    SET name=@name, grade=@grade, student_phone=@student_phone, parent_phone=@parent_phone, updated_at=datetime('now')
    WHERE id=@id
  `
  ).run({
    id: s.id,
    name: s.name,
    grade: s.grade ?? null,
    student_phone: s.student_phone ?? null,
    parent_phone: s.parent_phone ?? null
  });

  ok(res, { id: s.id });
});

app.delete("/api/students/:id", (req, res) => {
  const studentId = String(req.params.id || "").trim();
  if (!studentId) return bad(res, "학생 ID가 필요합니다.");
  // 벌점 기록 유무와 무관하게 관리자 삭제를 허용합니다.
  const tx = db.transaction((id) => {
    // foreign key가 비활성화된 환경에서도 관련 데이터를 함께 삭제
    db.prepare("DELETE FROM penalties WHERE student_id=?").run(id);
    db.prepare("DELETE FROM penalty_reset_items WHERE student_id=?").run(id);
    db.prepare("DELETE FROM notes WHERE student_id=?").run(id);
    return db.prepare("DELETE FROM students WHERE id=?").run(id);
  });

  const deleted = tx(studentId);
  if (!Number(deleted?.changes || 0)) {
    return res.status(404).json({ ok: false, message: "학생을 찾을 수 없습니다." });
  }
  ok(res, true);
});

app.post("/api/students/import-excel", upload.single("file"), (req, res) => {
  if (!req.file) return bad(res, "엑셀 파일이 필요합니다.");

  const wb = XLSX.read(req.file.buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(ws, { defval: "" });

  const normalized = json
    .map((r) => ({
      id: String(r["ID"] ?? "").trim(),
      name: String(r["이름"] ?? "").trim(),
      grade: String(r["학년"] ?? "").trim(),
      student_phone: String(r["학생전화"] ?? "").trim(),
      parent_phone: String(r["보호자전화"] ?? "").trim()
    }))
    .filter((r) => r.id && r.name);

  const insert = db.prepare(
    `
    INSERT INTO students (id, name, grade, student_phone, parent_phone, updated_at)
    VALUES (@id,@name,@grade,@student_phone,@parent_phone, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      grade=excluded.grade,
      student_phone=excluded.student_phone,
      parent_phone=excluded.parent_phone,
      updated_at=datetime('now')
  `
  );

  const tx = db.transaction((rows) =>
    rows.forEach((r) =>
      insert.run({
        id: r.id,
        name: r.name,
        grade: r.grade || null,
        student_phone: r.student_phone || null,
        parent_phone: r.parent_phone || null
      })
    )
  );
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
  db.prepare(
    `
    INSERT INTO rules (id, title, points, is_active, sort_order, updated_at)
    VALUES (@id,@title,@points,@is_active,@sort_order, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title,
      points=excluded.points,
      is_active=excluded.is_active,
      sort_order=excluded.sort_order,
      updated_at=datetime('now')
  `
  ).run(r);

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
  db.prepare(
    `
    INSERT INTO thresholds (id, min_points, label, message_template, sort_order, updated_at)
    VALUES (@id,@min_points,@label,@message_template,@sort_order, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      min_points=excluded.min_points,
      label=excluded.label,
      message_template=excluded.message_template,
      sort_order=excluded.sort_order,
      updated_at=datetime('now')
  `
  ).run(t);

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
  const rows = db
    .prepare(
      `
    SELECT * FROM penalties
    WHERE student_id=@studentId
      AND occurred_on BETWEEN @from AND @to
    ORDER BY occurred_on DESC, created_at DESC
  `
    )
    .all(params);

  ok(res, rows);
});

app.get("/api/penalties/range-students", (req, res) => {
  const { from, to } = req.query;
  if (!validateDateRange(res, from, to)) return;

  const rows = db
    .prepare(
      `
      SELECT
        s.id AS student_id,
        s.name AS name,
        s.grade AS grade,
        COUNT(p.id) AS penalty_count,
        IFNULL(SUM(p.points), 0) AS points_sum
      FROM penalties p
      JOIN students s ON s.id = p.student_id
      WHERE p.occurred_on BETWEEN ? AND ?
      GROUP BY s.id, s.name, s.grade
      ORDER BY s.name COLLATE NOCASE ASC
      `
    )
    .all(from, to);

  ok(res, rows);
});

app.get("/api/penalties/reset-candidates", (req, res) => {
  const { from, to } = req.query;
  if (!validateDateRange(res, from, to)) return;

  const rows = db
    .prepare(
      `
      SELECT
        s.id AS student_id,
        s.name AS name,
        s.grade AS grade,
        COUNT(p.id) AS penalty_count,
        IFNULL(SUM(p.points), 0) AS points_sum
      FROM students s
      LEFT JOIN penalties p
        ON p.student_id = s.id
       AND p.occurred_on BETWEEN @from AND @to
       AND p.points != 0
      GROUP BY s.id, s.name, s.grade
      ORDER BY s.name COLLATE NOCASE ASC
      `
    )
    .all({ from, to });

  ok(res, rows);
});

app.post("/api/penalties", (req, res) => {
  const parsed = PenaltyCreateSchema.safeParse(req.body);
  if (!parsed.success) return bad(res, "벌점 데이터가 올바르지 않습니다.", parsed.error.issues);

  const p = parsed.data;
  const rule = db.prepare("SELECT * FROM rules WHERE id=?").get(p.rule_id);
  if (!rule) return bad(res, "규칙(rule)을 찾을 수 없습니다.");

  const id = uid("pen");
  db.prepare(
    `
    INSERT INTO penalties (id, student_id, rule_id, rule_title, points, occurred_on, memo)
    VALUES (@id,@student_id,@rule_id,@rule_title,@points,@occurred_on,@memo)
  `
  ).run({
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
  const penaltyId = String(req.params.id || "").trim();
  if (!penaltyId) return bad(res, "record id is required");

  const deleted = db.prepare("DELETE FROM penalties WHERE id=?").run(penaltyId);
  if (!Number(deleted?.changes || 0)) {
    return res.status(404).json({ ok: false, message: "record not found" });
  }

  ok(res, true);
});

app.post("/api/penalties/reset", (req, res) => {
  const { from, to } = req.body || {};
  if (!validateDateRange(res, from, to)) return;

  const studentIds = normalizeStudentIds(req.body?.student_ids);
  if (!studentIds.length) return bad(res, "리셋할 학생을 선택하세요.");

  const placeholders = studentIds.map(() => "?").join(",");
  const resetId = uid("reset");

  const tx = db.transaction(() => {
    const targets = db
      .prepare(
        `
        SELECT id, student_id, points, occurred_on, rule_title, memo
        FROM penalties
        WHERE student_id IN (${placeholders})
          AND occurred_on BETWEEN ? AND ?
          AND points != 0
        ORDER BY occurred_on ASC, created_at ASC
        `
      )
      .all(...studentIds, from, to);

    const insertItem = db.prepare(
      `
      INSERT INTO penalty_reset_items
        (id, reset_id, penalty_id, student_id, original_points, occurred_on, rule_title, memo)
      VALUES
        (@id, @reset_id, @penalty_id, @student_id, @original_points, @occurred_on, @rule_title, @memo)
      `
    );
    for (const p of targets) {
      insertItem.run({
        id: uid("reset_item"),
        reset_id: resetId,
        penalty_id: p.id,
        student_id: p.student_id,
        original_points: Number(p.points || 0),
        occurred_on: p.occurred_on,
        rule_title: p.rule_title || null,
        memo: p.memo || null
      });
    }

    const pointsSum = targets.reduce((acc, p) => acc + Number(p.points || 0), 0);
    db.prepare(
      `
      INSERT INTO penalty_reset_events
        (id, from_date, to_date, student_count, record_count, points_sum)
      VALUES
        (@id, @from_date, @to_date, @student_count, @record_count, @points_sum)
      `
    ).run({
      id: resetId,
      from_date: from,
      to_date: to,
      student_count: studentIds.length,
      record_count: targets.length,
      points_sum: pointsSum
    });

    if (targets.length) {
      const recordPlaceholders = targets.map(() => "?").join(",");
      db.prepare(`UPDATE penalties SET points=0 WHERE id IN (${recordPlaceholders})`).run(...targets.map((p) => p.id));
    }

    return { reset_id: resetId, student_count: studentIds.length, record_count: targets.length, points_sum: pointsSum };
  });

  ok(res, tx());
});

app.get("/api/penalties/monthly-history", (req, res) => {
  const fromMonth = typeof req.query.fromMonth === "string" ? req.query.fromMonth : "";
  const toMonth = typeof req.query.toMonth === "string" ? req.query.toMonth : "";
  if ((fromMonth && !ym.test(fromMonth)) || (toMonth && !ym.test(toMonth))) {
    return bad(res, "월 형식이 올바르지 않습니다. YYYY-MM");
  }
  if (fromMonth && toMonth && fromMonth > toMonth) {
    return bad(res, "월 설정이 올바르지 않습니다. fromMonth <= toMonth");
  }

  const params = {
    fromMonth: fromMonth || "0000-01",
    toMonth: toMonth || "9999-12"
  };
  const students = db.prepare("SELECT id, name, grade FROM students").all();
  const studentsById = new Map(students.map((s) => [s.id, s]));
  const rowsByKey = new Map();

  function ensureRow(studentId, month) {
    const student = studentsById.get(studentId);
    if (!student || !month) return null;
    const key = `${month}::${studentId}`;
    if (!rowsByKey.has(key)) {
      rowsByKey.set(key, {
        month,
        student_id: student.id,
        name: student.name,
        grade: student.grade,
        penalty_points: 0,
        bonus_points: 0,
        net_points: 0,
        active_points: 0,
        reset_preserved_points: 0,
        record_count: 0,
        reset_record_count: 0
      });
    }
    return rowsByKey.get(key);
  }

  const activeRows = db
    .prepare(
      `
      SELECT
        student_id,
        substr(occurred_on, 1, 7) AS month,
        SUM(CASE WHEN points > 0 THEN points ELSE 0 END) AS penalty_points,
        SUM(CASE WHEN points < 0 THEN ABS(points) ELSE 0 END) AS bonus_points,
        SUM(points) AS active_points,
        COUNT(id) AS record_count
      FROM penalties
      WHERE substr(occurred_on, 1, 7) BETWEEN @fromMonth AND @toMonth
      GROUP BY student_id, substr(occurred_on, 1, 7)
      `
    )
    .all(params);

  for (const r of activeRows) {
    const row = ensureRow(r.student_id, r.month);
    if (!row) continue;
    row.penalty_points += Number(r.penalty_points || 0);
    row.bonus_points += Number(r.bonus_points || 0);
    row.net_points += Number(r.active_points || 0);
    row.active_points += Number(r.active_points || 0);
    row.record_count += Number(r.record_count || 0);
  }

  const resetRows = db
    .prepare(
      `
      SELECT
        student_id,
        substr(occurred_on, 1, 7) AS month,
        SUM(CASE WHEN original_points > 0 THEN original_points ELSE 0 END) AS penalty_points,
        SUM(CASE WHEN original_points < 0 THEN ABS(original_points) ELSE 0 END) AS bonus_points,
        SUM(original_points) AS reset_points,
        COUNT(id) AS reset_record_count
      FROM penalty_reset_items
      WHERE substr(occurred_on, 1, 7) BETWEEN @fromMonth AND @toMonth
      GROUP BY student_id, substr(occurred_on, 1, 7)
      `
    )
    .all(params);

  for (const r of resetRows) {
    const row = ensureRow(r.student_id, r.month);
    if (!row) continue;
    row.penalty_points += Number(r.penalty_points || 0);
    row.bonus_points += Number(r.bonus_points || 0);
    row.net_points += Number(r.reset_points || 0);
    row.reset_preserved_points += Number(r.reset_points || 0);
    row.reset_record_count += Number(r.reset_record_count || 0);
  }

  const rows = [...rowsByKey.values()].sort((a, b) => {
    if (a.month !== b.month) return a.month < b.month ? 1 : -1;
    return String(a.name || "").localeCompare(String(b.name || ""), "ko");
  });

  ok(res, rows);
});

app.get("/api/penalties/reset-events", (req, res) => {
  const rows = db
    .prepare(
      `
      SELECT *
      FROM penalty_reset_events
      ORDER BY created_at DESC, from_date DESC
      LIMIT 100
      `
    )
    .all();
  ok(res, rows);
});

/* Export */
app.get("/api/export/all", (req, res) => {
  const students = db.prepare("SELECT * FROM students ORDER BY name COLLATE NOCASE").all();
  const rules = db.prepare("SELECT * FROM rules ORDER BY sort_order ASC, title COLLATE NOCASE ASC").all();
  const thresholds = db.prepare("SELECT * FROM thresholds ORDER BY sort_order ASC, min_points ASC").all();
  const penalties = db.prepare("SELECT * FROM penalties ORDER BY occurred_on DESC, created_at DESC").all();
  const penalty_reset_events = db.prepare("SELECT * FROM penalty_reset_events ORDER BY created_at DESC").all();
  const penalty_reset_items = db.prepare("SELECT * FROM penalty_reset_items ORDER BY occurred_on DESC, created_at DESC").all();

  const penaltyMap = new Map();
  for (const p of penalties) {
    if (!penaltyMap.has(p.student_id)) penaltyMap.set(p.student_id, []);
    penaltyMap.get(p.student_id).push(p);
  }

  const penalties_by_student = students.map((s) => ({
    student: s,
    penalties: penaltyMap.get(s.id) || []
  }));

  ok(res, {
    exported_at: new Date().toISOString(),
    students,
    rules,
    thresholds,
    penalties,
    penalty_reset_events,
    penalty_reset_items,
    penalties_by_student
  });
});

/* Notes */
app.get("/api/notes", (req, res) => {
  const { studentId } = req.query;
  if (!studentId) return bad(res, "studentId가 필요합니다.");

  const rows = db
    .prepare(
      `
    SELECT * FROM notes
    WHERE student_id=?
    ORDER BY noted_on DESC, created_at DESC
  `
    )
    .all(studentId);

  ok(res, rows);
});

app.post("/api/notes", (req, res) => {
  const body = { ...req.body };
  if (!body.id) body.id = uid("note");

  const parsed = NoteSchema.safeParse(body);
  if (!parsed.success) return bad(res, "특이사항 데이터가 올바르지 않습니다.", parsed.error.issues);

  const n = parsed.data;
  db.prepare(
    `
    INSERT INTO notes (id, student_id, noted_on, content, updated_at)
    VALUES (@id,@student_id,@noted_on,@content, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      noted_on=excluded.noted_on,
      content=excluded.content,
      updated_at=datetime('now')
  `
  ).run(n);

  ok(res, { id: n.id });
});

app.delete("/api/notes/:id", (req, res) => {
  db.prepare("DELETE FROM notes WHERE id=?").run(req.params.id);
  ok(res, true);
});

/* Summary */
app.get("/api/summary/cumulative", (req, res) => {
  const { from, to } = req.query;
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  const hasFrom = typeof from === "string" && from.length > 0;
  const hasTo = typeof to === "string" && to.length > 0;
  if (hasFrom !== hasTo) return bad(res, "기간 조회는 from/to를 함께 입력해야 합니다.");
  if (hasFrom && hasTo) {
    if (!ymd.test(from) || !ymd.test(to)) return bad(res, "기간 형식이 올바르지 않습니다. YYYY-MM-DD");
    if (from > to) return bad(res, "기간 설정이 올바르지 않습니다. from <= to");
  }

  const joinRange = hasFrom && hasTo ? "AND p.occurred_on BETWEEN @from AND @to" : "";
  const rows = db
    .prepare(
      `
    SELECT s.*, IFNULL(SUM(p.points),0) AS points
    FROM students s
    LEFT JOIN penalties p ON p.student_id = s.id ${joinRange}
    GROUP BY s.id
    ORDER BY s.name COLLATE NOCASE
  `
    )
    .all({ from: hasFrom ? from : null, to: hasTo ? to : null });
  ok(res, rows);
});

/* SMS */
app.post("/api/sms/send", async (req, res) => {
  // 1) 요청 검증은 기존 그대로
  const parsed = SmsSendSchema.safeParse(req.body);
  if (!parsed.success) return bad(res, "문자 발송 데이터가 올바르지 않습니다.", parsed.error.issues);

  // 2) makeSmsClient / env / sender 획득 과정에서 예외가 나도 JSON으로 떨어지게 보호
  let client;
  try {
    client = makeSmsClient();
  } catch (e) {
    return res.status(500).json({
      ok: false,
      message: "SMS 클라이언트 초기화 실패(sms.js/패키지/환경변수 확인).",
      detail: String(e?.message || e)
    });
  }
  if (!client) {
    return res.status(500).json({
      ok: false,
      message: "COOLSMS_API_KEY/SECRET 환경변수가 설정되지 않았습니다.",
      detail: ["COOLSMS_API_KEY", "COOLSMS_API_SECRET"]
    });
  }

  // 기존 이름(COOLSMS_SENDER_PHONE)을 유지하되, 호환용으로 COOLSMS_SENDER도 같이 허용
  const sender = normalizePhone(process.env.COOLSMS_SENDER_PHONE || process.env.COOLSMS_SENDER);
  if (!sender) {
    return res.status(500).json({
      ok: false,
      message: "발신번호 환경변수가 필요합니다.",
      detail: ["COOLSMS_SENDER_PHONE (기존)", "COOLSMS_SENDER (호환)"]
    });
  }

  const { student_id, target, message } = parsed.data;

  const s = db.prepare("SELECT * FROM students WHERE id=?").get(student_id);
  if (!s) return res.status(404).json({ ok: false, message: "학생을 찾을 수 없습니다." });

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

  // 3) 전송은 기존 로직(수신자별 sendOne) 유지하되, 타임아웃/에러 디테일을 JSON으로 반환
  try {
    const results = [];
    for (const to of uniqueTos) {
      const r = await Promise.race([
        sendSms({ client, to, from: sender, text: message }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("SMS timeout")), 12000))
      ]);
      results.push(r);
    }
    ok(res, { sent: uniqueTos.length, results });
  } catch (e) {
    // solapi/axios 류 에러는 response/data가 붙어오는 경우가 많아서 같이 내려줌
    const detail = {
      message: String(e?.message || e),
      response: e?.response ?? null,
      data: e?.response?.data ?? e?.data ?? null
    };
    return res.status(500).json({ ok: false, message: "문자 발송 실패", detail });
  }
});

/* Serve React build (single Render service) */
function findClientDist() {
  // 실행 위치가 repo root일 수도 있고(server 폴더)일 수도 있어서 후보를 여러 개 둠
  const candidates = [
    path.resolve(process.cwd(), "client", "dist"),
    path.resolve(process.cwd(), "dist"),
    path.resolve(process.cwd(), "..", "client", "dist"),
    path.resolve(process.cwd(), "..", "dist")
  ];
  return candidates.find((p) => fs.existsSync(path.join(p, "index.html")));
}

const distPath = findClientDist();
if (distPath) {
  app.use(express.static(distPath));
  // SPA 라우팅 대응: /students 같은 경로도 index.html로
  app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
} else {
  // dist가 없을 때 루트에서 헷갈리지 않게 안내
  app.get("/", (req, res) => {
    res.status(200).send(
      "Client dist not found. Build the client (npm --prefix client run build) and redeploy."
    );
  });
}

app.listen(PORT, () => {
  console.log(`server listening on :${PORT}`);
  console.log(`db: ${DB_PATH}`);
  if (distPath) console.log(`serving client from: ${distPath}`);
});
