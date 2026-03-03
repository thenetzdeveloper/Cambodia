const { openDb } = require("../src/db");
const { maleFirst, femaleFirst, last } = require("./name_lists");

const db = openDb();

function arg(name, def) {
  const i = process.argv.indexOf("--" + name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return def;
}

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}
function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function makeName(gender) {
  const first = gender === "M" ? pick(maleFirst) : pick(femaleFirst);
  const l = pick(last);
  return `${first} ${l}`;
}

function main() {
  const count = parseInt(arg("count", "10000000"), 10);
  const batch = parseInt(arg("batch", "50000"), 10);

  const villages = db
    .prepare(
      `
SELECT
  v.code,
  v.province_code,
  v.district_code,
  v.commune_code
FROM villages v
JOIN districts d ON d.code = v.district_code
JOIN communes c ON c.code = v.commune_code
`,
    )
    .all();

  if (!villages.length) {
    console.log(
      "No villages found. Run: npm run importxlsx",
    );
    process.exit(1);
  }

  console.log("Generating people: - generate_people.js:51", {
    count,
    batch,
    villages: villages.length,
  });

  const insert = db.prepare(`
    INSERT INTO people (full_name, gender, age, province_code, district_code, commune_code, village_code)
    VALUES (@full_name, @gender, @age, @province_code, @district_code, @commune_code, @village_code)
  `);

  const tx = db.transaction((rows) => {
    for (const r of rows) insert.run(r);
  });

  let done = 0;
  const started = Date.now();

  while (done < count) {
    const n = Math.min(batch, count - done);
    const rows = new Array(n);

    for (let i = 0; i < n; i++) {
      const gender = Math.random() < 0.5 ? "M" : "F";
      const v = villages[randInt(0, villages.length - 1)];
      rows[i] = {
        full_name: makeName(gender),
        gender,
        age: randInt(15, 60),
        province_code: v.province_code,
        district_code: v.district_code,
        commune_code: v.commune_code,
        village_code: v.code,
      };
    }

    tx(rows);
    done += n;

    const sec = Math.max((Date.now() - started) / 1000, 1);
    const rate = Math.round(done / sec);
    process.stdout.write(
      `\rInserted ${done.toLocaleString()} / ${count.toLocaleString()}  (${rate.toLocaleString()} rows/sec)`,
    );
  }

  console.log("\nDone. - generate_people.js:97");
}

main();
