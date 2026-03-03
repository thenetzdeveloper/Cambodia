const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || './db/app.sqlite';
const resolved = path.resolve(DB_PATH);

function openDb() {
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const db = new Database(resolved);
  // Performance pragmas (safe defaults)
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('temp_store = MEMORY');
  return db;
}

module.exports = { openDb, DB_PATH: resolved };
