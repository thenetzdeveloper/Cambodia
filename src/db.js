const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

/*
  Railway-safe database path
  - Always stores database inside project /db folder
  - Still allows override using DB_PATH environment variable
*/

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '..', 'db', 'app.sqlite');

function openDb() {
  // Ensure directory exists
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(DB_PATH);

  // Safe performance settings
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('temp_store = MEMORY');

  return db;
}

module.exports = { openDb, DB_PATH };
