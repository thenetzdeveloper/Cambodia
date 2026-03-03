const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { openDb, DB_PATH } = require('../src/db');

const db = openDb();
const schemaPath = path.join(__dirname, '..', 'sql', 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf-8');

db.exec(schema);

// Create default admin if not exists
const admin = db.prepare('SELECT id FROM users WHERE username=?').get('admin');
if (!admin) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?,?,?)').run('admin', hash, 'admin');
  console.log('Created default admin: admin / admin123');
} else {
  console.log('Admin already exists.');
}

console.log('DB ready at:', DB_PATH);
