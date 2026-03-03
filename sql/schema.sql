PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user', -- 'admin' or 'user'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS provinces (
  code TEXT PRIMARY KEY,
  name_kh TEXT,
  name_en TEXT
);

CREATE TABLE IF NOT EXISTS districts (
  code TEXT PRIMARY KEY,
  province_code TEXT NOT NULL,
  name_kh TEXT,
  name_en TEXT,
  FOREIGN KEY (province_code) REFERENCES provinces(code)
);

CREATE TABLE IF NOT EXISTS communes (
  code TEXT PRIMARY KEY,
  province_code TEXT NOT NULL,
  district_code TEXT NOT NULL,
  name_kh TEXT,
  name_en TEXT,
  FOREIGN KEY (province_code) REFERENCES provinces(code),
  FOREIGN KEY (district_code) REFERENCES districts(code)
);

CREATE TABLE IF NOT EXISTS villages (
  code TEXT PRIMARY KEY,
  province_code TEXT NOT NULL,
  district_code TEXT NOT NULL,
  commune_code TEXT NOT NULL,
  name_kh TEXT,
  name_en TEXT,
  FOREIGN KEY (province_code) REFERENCES provinces(code),
  FOREIGN KEY (district_code) REFERENCES districts(code),
  FOREIGN KEY (commune_code) REFERENCES communes(code)
);

CREATE TABLE IF NOT EXISTS people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('M','F')),
  age INTEGER NOT NULL CHECK (age BETWEEN 15 AND 60),
  province_code TEXT NOT NULL,
  district_code TEXT NOT NULL,
  commune_code TEXT NOT NULL,
  village_code TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,

  FOREIGN KEY (province_code) REFERENCES provinces(code),
  FOREIGN KEY (district_code) REFERENCES districts(code),
  FOREIGN KEY (commune_code) REFERENCES communes(code),
  FOREIGN KEY (village_code) REFERENCES villages(code)
);

CREATE TABLE IF NOT EXISTS edit_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL, -- 'person', 'user', etc
  entity_id INTEGER NOT NULL,
  action TEXT NOT NULL,      -- 'update', 'create', 'delete'
  changed_by_user_id INTEGER,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (changed_by_user_id) REFERENCES users(id)
);

-- Indexes for fast search
CREATE INDEX IF NOT EXISTS idx_people_name ON people(full_name);
CREATE INDEX IF NOT EXISTS idx_people_gender ON people(gender);
CREATE INDEX IF NOT EXISTS idx_people_age ON people(age);
CREATE INDEX IF NOT EXISTS idx_people_prov ON people(province_code);
CREATE INDEX IF NOT EXISTS idx_people_dist ON people(district_code);
CREATE INDEX IF NOT EXISTS idx_people_comm ON people(commune_code);
CREATE INDEX IF NOT EXISTS idx_people_vill ON people(village_code);
