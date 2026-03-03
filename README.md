# Cambodia People Homework (Frontend + Backend + XLSX)

Tech:
- Backend: Node.js + Express
- DB: SQLite (no PostgreSQL needed)
- Frontend: EJS templates + Bootstrap (server-rendered)
- XLSX import: ExcelJS
- 10M people generator: Better-SQLite3 (fast inserts in batches)

## 1) Install
1. Install Node.js LTS (18+).
2. Open terminal in this folder and run:

```bash
npm install
```

## 2) Initialize DB + Import Cambodia locations from XLSX
```bash
npm run init-db
npm run import-xlsx
```

This reads `data/camboia.xlsx` and populates:
- provinces, districts, communes, villages

## 3) Generate people (10,000,000)
⚠️ This can take a long time and needs disk space. Use a smaller number first to test.

Test:
```bash
node scripts/generate_people.js --count 200000 --batch 20000
```

Full 10M:
```bash
node scripts/generate_people.js --count 10000000 --batch 50000
```

## 4) Run website
```bash
npm run dev
```

Open: http://localhost:3000

### Default admin
After `init-db`, a default admin is created:
- username: `admin`
- password: `admin123`

Change it after login.

## Features required by homework
1. Auto insert people (M/F, age 15-60) across 25 provinces, using real location codes from XLSX.
2. Search by name, gender, age, province/district/commune/village, and show total count + pagination (100/page).
3. User management (admin can create users, set role).
4. Edit history (every person edit writes a history row with before/after JSON).

## Notes for performance
- SQLite is fast for reads; for 10M rows you **must** use indexes (already created).
- Generating 10M rows will take time; run it once, then only search/edit from the web.
