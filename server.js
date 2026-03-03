require('dotenv').config?.(); // optional if dotenv is installed; safe if not
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const methodOverride = require('method-override');
const path = require('path');
const ejs = require('ejs');
const { openDb } = require('./src/db');
const { requireLogin, requireAdmin } = require('./src/auth');
const bcrypt = require('bcryptjs');
const app = express();
const db = openDb();

app.engine('html', ejs.renderFile);
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use('/public', express.static(path.join(__dirname, 'public')));

app.use(session({
  store: new SQLiteStore({ db: 'sessions.sqlite', dir: './db' }),
  secret: process.env.SESSION_SECRET || 'change_me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 6 } // 6 hours
}));

// Attach user to views
app.use((req, res, next) => {
  res.locals.me = req.session.user || null;
  res.locals.currentPath = req.path;
  next();
});

/* ===================== AUTH ===================== */
app.get('/login', (req, res) => res.render('login', { error: null }));

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT id, username, password_hash, role FROM users WHERE username=?').get(username);
  if (!user) return res.status(401).render('login', { error: 'Invalid username or password' });

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).render('login', { error: 'Invalid username or password' });

  req.session.user = { id: user.id, username: user.username, role: user.role };
  res.redirect('/');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

/* ===================== HOME / SEARCH ===================== */
app.get('/', requireLogin, (req, res) => {
  const provinces = db.prepare('SELECT code, name_en, name_kh FROM provinces ORDER BY code').all();
  res.render('search', { provinces, results: [], total: 0, page: 1, pages: 0, q: {} });
});

// AJAX endpoints for cascading dropdowns
app.get('/api/districts', requireLogin, (req, res) => {
  const { province_code } = req.query;
  const rows = db.prepare('SELECT code, name_en, name_kh FROM districts WHERE province_code=? ORDER BY code').all(province_code);
  res.json(rows);
});

app.get('/api/communes', requireLogin, (req, res) => {
  const { district_code } = req.query;
  const rows = db.prepare('SELECT code, name_en, name_kh FROM communes WHERE district_code=? ORDER BY code').all(district_code);
  res.json(rows);
});

app.get('/api/villages', requireLogin, (req, res) => {
  const { commune_code } = req.query;
  const rows = db.prepare('SELECT code, name_en, name_kh FROM villages WHERE commune_code=? ORDER BY code').all(commune_code);
  res.json(rows);
});

app.get('/people', requireLogin, (req, res) => {
  const perPage = 100;
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const offset = (page - 1) * perPage;

  // Filters
  const q = {
    name: (req.query.name || '').trim(),
    gender: (req.query.gender || '').trim(),
    age: (req.query.age || '').trim(),
    province_code: (req.query.province_code || '').trim(),
    district_code: (req.query.district_code || '').trim(),
    commune_code: (req.query.commune_code || '').trim(),
    village_code: (req.query.village_code || '').trim()
  };

  const where = [];
  const params = {};

  if (q.name) { where.push('p.full_name LIKE @name'); params.name = `%${q.name}%`; }
  if (q.gender) { where.push('p.gender = @gender'); params.gender = q.gender; }
  if (q.age) { where.push('p.age = @age'); params.age = parseInt(q.age, 10); }
  if (q.province_code) { where.push('p.province_code = @province_code'); params.province_code = q.province_code; }
  if (q.district_code) { where.push('p.district_code = @district_code'); params.district_code = q.district_code; }
  if (q.commune_code) { where.push('p.commune_code = @commune_code'); params.commune_code = q.commune_code; }
  if (q.village_code) { where.push('p.village_code = @village_code'); params.village_code = q.village_code; }

  const whereSql = where.length ? ('WHERE ' + where.join(' AND ')) : '';

  const countSql = `
    SELECT COUNT(1) AS total
    FROM people p
    ${whereSql}
  `;
  const total = db.prepare(countSql).get(params).total || 0;
  const pages = Math.ceil(total / perPage);

  const dataSql = `
    SELECT p.*,
      prov.name_en AS province_en, dist.name_en AS district_en,
      com.name_en AS commune_en, vil.name_en AS village_en
    FROM people p
    LEFT JOIN provinces prov ON prov.code = p.province_code
    LEFT JOIN districts dist ON dist.code = p.district_code
    LEFT JOIN communes com ON com.code = p.commune_code
    LEFT JOIN villages vil ON vil.code = p.village_code
    ${whereSql}
    ORDER BY p.id DESC
    LIMIT ${perPage} OFFSET ${offset}
  `;
  const results = db.prepare(dataSql).all(params);

  const provinces = db.prepare('SELECT code, name_en, name_kh FROM provinces ORDER BY code').all();
  res.render('search', { provinces, results, total, page, pages, q });
});

/* ===================== PERSON EDIT + HISTORY ===================== */
app.get('/people/:id/edit', requireLogin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const person = db.prepare('SELECT * FROM people WHERE id=?').get(id);
  if (!person) return res.status(404).send('Not found');

  const provinces = db.prepare('SELECT code, name_en, name_kh FROM provinces ORDER BY code').all();
  const districts = db.prepare('SELECT code, name_en, name_kh FROM districts WHERE province_code=? ORDER BY code').all(person.province_code);
  const communes = db.prepare('SELECT code, name_en, name_kh FROM communes WHERE district_code=? ORDER BY code').all(person.district_code);
  const villages = db.prepare('SELECT code, name_en, name_kh FROM villages WHERE commune_code=? ORDER BY code').all(person.commune_code);

  res.render('person_edit', { person, provinces, districts, communes, villages, error: null });
});

app.put('/people/:id', requireLogin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const before = db.prepare('SELECT * FROM people WHERE id=?').get(id);
  if (!before) return res.status(404).send('Not found');

  const full_name = (req.body.full_name || '').trim();
  const gender = (req.body.gender || '').trim();
  const age = parseInt(req.body.age || '0', 10);
  const province_code = (req.body.province_code || '').trim();
  const district_code = (req.body.district_code || '').trim();
  const commune_code = (req.body.commune_code || '').trim();
  const village_code = (req.body.village_code || '').trim();

  if (!full_name || !['M','F'].includes(gender) || !(age >= 15 && age <= 60)) {
    return res.status(400).send('Validation failed');
  }

  const stmt = db.prepare(`
    UPDATE people
    SET full_name=?, gender=?, age=?, province_code=?, district_code=?, commune_code=?, village_code=?, updated_at=datetime('now')
    WHERE id=?
  `);
  stmt.run(full_name, gender, age, province_code, district_code, commune_code, village_code, id);

  const after = db.prepare('SELECT * FROM people WHERE id=?').get(id);

  db.prepare(`
    INSERT INTO edit_history (entity_type, entity_id, action, changed_by_user_id, before_json, after_json)
    VALUES ('person', ?, 'update', ?, ?, ?)
  `).run(id, req.session.user.id, JSON.stringify(before), JSON.stringify(after));

  res.redirect('/people?name=' + encodeURIComponent(full_name));
});

/* ===================== ADMIN: USERS ===================== */
app.get('/admin/users', requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY id').all();
  res.render('admin_users', { users, error: null });
});

app.post('/admin/users', requireAdmin, (req, res) => {
  const username = (req.body.username || '').trim();
  const password = (req.body.password || '').trim();
  const role = (req.body.role || 'user').trim();

  if (!username || password.length < 6 || !['admin','user'].includes(role)) {
    const users = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY id').all();
    return res.status(400).render('admin_users', { users, error: 'Invalid input (password min 6 chars)' });
  }

  const hash = bcrypt.hashSync(password, 10);
  try {
    const info = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?,?,?)').run(username, hash, role);
    db.prepare(`
      INSERT INTO edit_history (entity_type, entity_id, action, changed_by_user_id, before_json, after_json)
      VALUES ('user', ?, 'create', ?, NULL, ?)
    `).run(info.lastInsertRowid, req.session.user.id, JSON.stringify({ id: info.lastInsertRowid, username, role }));
  } catch (e) {
    const users = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY id').all();
    return res.status(400).render('admin_users', { users, error: 'Username already exists' });
  }

  res.redirect('/admin/users');
});

/* ===================== ADMIN: HISTORY ===================== */
app.get('/admin/history', requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT h.*, u.username AS changed_by
    FROM edit_history h
    LEFT JOIN users u ON u.id = h.changed_by_user_id
    ORDER BY h.id DESC
    LIMIT 500
  `).all();
  res.render('admin_history', { rows });
});

/* ===================== SERVER ===================== */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
