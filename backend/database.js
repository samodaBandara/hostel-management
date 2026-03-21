const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const DB_PATH = path.join(__dirname, 'hostel.db');
let db;

async function getDb() {
  if (db) return db;
  const SQL = await initSqlJs();
  db = fs.existsSync(DB_PATH)
    ? new SQL.Database(fs.readFileSync(DB_PATH))
    : new SQL.Database();
  db.run(`
    CREATE TABLE IF NOT EXISTS students (
      student_id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
      phone TEXT, gender TEXT, address TEXT,
      created_at DATETIME DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS rooms (
      room_id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_number TEXT UNIQUE NOT NULL, room_type TEXT NOT NULL,
      capacity INTEGER NOT NULL, status TEXT DEFAULT 'available'
    );
    CREATE TABLE IF NOT EXISTS allocations (
      allocation_id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL, room_id INTEGER NOT NULL,
      allocation_date DATE NOT NULL
    );
    CREATE TABLE IF NOT EXISTS payments (
      payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL, amount REAL NOT NULL,
      payment_date DATE NOT NULL, status TEXT DEFAULT 'paid'
    );
    CREATE TABLE IF NOT EXISTS complaints (
      complaint_id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL, description TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT (datetime('now'))
    );
  `);
  save();
  return db;
}

function save() {
  if (db) fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

function query(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function run(sql, params = []) {
  db.run(sql, params);
  save();
  const r = db.exec('SELECT last_insert_rowid() as id');
  return r[0]?.values[0]?.[0];
}

module.exports = { getDb, query, run };