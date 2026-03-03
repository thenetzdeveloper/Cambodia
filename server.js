require('dotenv').config?.();

const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const methodOverride = require('method-override');
const path = require('path');
const ejs = require('ejs');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const { openDb } = require('./src/db');
const { requireLogin, requireAdmin } = require('./src/auth');

const app = express();

/* ===================== FIX DB DIRECTORY (RAILWAY SAFE) ===================== */
const dbDir = path.join(__dirname, 'db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir);
}

/* ===================== OPEN DATABASE ===================== */
const db = openDb();

/* ===================== ENSURE USERS TABLE EXISTS ===================== */
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password_hash TEXT,
  role TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

/* ===================== VIEW ENGINE ===================== */
app.engine('html', ejs.renderFile);
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use('/public', express.static(path.join(__dirname, 'public')));

/* ===================== SESSION FIX ===================== */
app.use(session({
  store: new SQLiteStore({
    db: 'sessions.sqlite',
    dir: dbDir
  }),
  secret: process.env.SESSION_SECRET || 'change_me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 6 }
}));

/* ===================== GLOBAL USER ===================== */
app.use((req, res, next) => {
  res.locals.me = req.session.user || null;
  res.locals.currentPath = req.path;
  next();
});

/* ===================== AUTH ===================== */
app.get('/login', (req, res) => res.render('login', { error: null }));

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  const user = db.prepare(
    'SELECT id, username, password_hash, role FROM users WHERE username=?'
  ).get(username);

  if (!user)
    return res.status(401).render('login', { error: 'Invalid username or password' });

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok)
    return res.status(401).render('login', { error: 'Invalid username or password' });

  req.session.user = {
    id: user.id,
    username: user.username,
    role: user.role
  };

  res.redirect('/');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

/* ===================== HOME ===================== */
app.get('/', requireLogin, (req, res) => {
  const provinces = db.prepare(
    'SELECT code, name_en, name_kh FROM provinces ORDER BY code'
  ).all();

  res.render('search', {
    provinces,
    results: [],
    total: 0,
    page: 1,
    pages: 0,
    q: {}
  });
});

/* ===================== SERVER ===================== */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
