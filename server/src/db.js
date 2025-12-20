import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

export function openDb(dbPath) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      grade TEXT,
      student_phone TEXT,
      parent_phone TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rules (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      points INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS penalties (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      rule_id TEXT NOT NULL,
      rule_title TEXT NOT NULL,
      points INTEGER NOT NULL,
      occurred_on TEXT NOT NULL,  -- YYYY-MM-DD
      memo TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS thresholds (
      id TEXT PRIMARY KEY,
      min_points INTEGER NOT NULL,
      label TEXT NOT NULL,
      message_template TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      noted_on TEXT NOT NULL, -- YYYY-MM-DD
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
    );
  `);

  // 기본 규칙/기준치 seed (비어있을 때만)
  const ruleCount = db.prepare("SELECT COUNT(*) AS c FROM rules").get().c;
  if (ruleCount === 0) {
    const insert = db.prepare("INSERT INTO rules (id, title, points, sort_order) VALUES (@id,@title,@points,@sort)");
    const defaults = [
      { id: "rule_late", title: "지각", points: 1, sort: 1 },
      { id: "rule_phone", title: "휴대폰 사용", points: 2, sort: 2 },
      { id: "rule_sleep", title: "수면", points: 2, sort: 3 }
    ];
    const tx = db.transaction((rows) => rows.forEach(r => insert.run(r)));
    tx(defaults);
  }

  const thCount = db.prepare("SELECT COUNT(*) AS c FROM thresholds").get().c;
  if (thCount === 0) {
    const insert = db.prepare("INSERT INTO thresholds (id, min_points, label, message_template, sort_order) VALUES (@id,@min,@label,@tpl,@sort)");
    const defaults = [
      {
        id: "th_5",
        min: 5,
        label: "주의",
        tpl: "[메디컬로드맵] {name} 학생 벌점 누적 {points}점입니다. 학습태도 점검 부탁드립니다.",
        sort: 1
      },
      {
        id: "th_10",
        min: 10,
        label: "경고",
        tpl: "[메디컬로드맵] {name} 학생 벌점 누적 {points}점으로 기준치를 초과했습니다. 센터로 연락 부탁드립니다.",
        sort: 2
      }
    ];
    const tx = db.transaction((rows) => rows.forEach(r => insert.run(r)));
    tx(defaults);
  }

  return db;
}

export function nowIso() {
  return new Date().toISOString();
}

export function uid(prefix="id") {
  return `${prefix}_${Math.random().toString(36).slice(2,10)}${Date.now().toString(36)}`;
}
