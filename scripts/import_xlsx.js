const path = require("path");
const ExcelJS = require("exceljs");
const { openDb } = require("../src/db");

const db = openDb();

db.exec("PRAGMA foreign_keys=OFF");

function sheetProvinceCode(sheetName) {
  const m = /^(\d{2})\./.exec(sheetName.trim());
  return m ? m[1] : null;
}

function normalizeType(t) {
  t = (t || "").toString().trim();

  if (t.includes("ស្រុក") || t.includes("ខណ្ឌ") || t.includes("ក្រុង"))
    return "district";

  if (t.includes("ឃុំ") || t.includes("សង្កាត់"))
    return "commune";

  if (t.includes("ភូមិ"))
    return "village";

  return null;
}

async function main() {

  const file = path.join(__dirname,"..","data","camboia.xlsx");

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);

  const insertProv = db.prepare(`
    INSERT OR IGNORE INTO provinces(code,name_en,name_kh)
    VALUES (?,?,?)
  `);

  const insertDist = db.prepare(`
    INSERT OR IGNORE INTO districts
    (code,province_code,name_en,name_kh)
    VALUES (?,?,?,?)
  `);

  const insertCom = db.prepare(`
    INSERT OR IGNORE INTO communes
    (code,province_code,district_code,name_en,name_kh)
    VALUES (?,?,?,?,?)
  `);

  const insertVil = db.prepare(`
    INSERT OR IGNORE INTO villages
    (code,province_code,district_code,commune_code,name_en,name_kh)
    VALUES (?,?,?,?,?,?)
  `);

  const tx = db.transaction(() => {

    for (const ws of workbook.worksheets) {

      const provCode = sheetProvinceCode(ws.name);
      if (!provCode) continue;

      const provName = ws.name.replace(/^\d{2}\.\s*/,"");
      insertProv.run(provCode, provName, null);

      let currentDistrict = null;
      let currentCommune = null;

      ws.eachRow((row,rowNum) => {

        const type = normalizeType(row.getCell(1).value);
        if (!type) return;

        const code = (row.getCell(2).value || "").toString().trim();
        if (!code) return;

        const nameKh = (row.getCell(3).value || "").toString().trim() || null;
        const nameEn = (row.getCell(4).value || "").toString().trim() || null;

        if (type === "district") {

          currentDistrict = code;
          currentCommune = null;

          insertDist.run(code,provCode,nameEn,nameKh);
        }

        else if (type === "commune") {

          currentCommune = code;

          insertCom.run(
            code,
            provCode,
            currentDistrict,
            nameEn,
            nameKh
          );
        }

        else if (type === "village") {

          insertVil.run(
            code,
            provCode,
            currentDistrict,
            currentCommune,
            nameEn,
            nameKh
          );
        }
      });
    }
  });

  tx();

  db.exec("PRAGMA foreign_keys=ON");

  console.log("Import DONE - import_xlsx.js:123");
}

main();
