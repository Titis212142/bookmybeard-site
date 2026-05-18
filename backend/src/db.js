const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const dbPath = process.env.DB_PATH || "./data/bookings.db";
const absoluteDbPath = path.resolve(process.cwd(), dbPath);
const dbDir = path.dirname(absoluteDbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const db = new Database(absoluteDbPath);

db.pragma("journal_mode = WAL");

function migrateBookingsTableIfNeeded() {
  const tableExists = db
    .prepare(
      `
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name = 'bookings'
    `
    )
    .get();

  if (!tableExists) {
    return;
  }

  const columns = db.prepare("PRAGMA table_info(bookings)").all();
  const hasUpdatedAt = columns.some((c) => c.name === "updated_at");
  if (hasUpdatedAt) {
    return;
  }

  db.exec(`
    CREATE TABLE bookings_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      service TEXT NOT NULL,
      booking_date TEXT NOT NULL,
      booking_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      admin_note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      cancelled_at TEXT
    );
  `);

  db.exec(`
    INSERT INTO bookings_new (
      id,
      full_name,
      email,
      service,
      booking_date,
      booking_time,
      status,
      created_at,
      updated_at
    )
    SELECT
      id,
      full_name,
      email,
      service,
      booking_date,
      booking_time,
      CASE
        WHEN status IS NULL OR status = '' THEN 'pending'
        ELSE status
      END,
      COALESCE(created_at, datetime('now')),
      COALESCE(created_at, datetime('now'))
    FROM bookings;
  `);

  db.exec("DROP TABLE bookings;");
  db.exec("ALTER TABLE bookings_new RENAME TO bookings;");
}

function ensureBookingsFirstVisitDiscountColumn() {
  const columns = db.prepare("PRAGMA table_info(bookings)").all();
  const hasColumn = columns.some((c) => c.name === "first_visit_discount");
  if (hasColumn) {
    return;
  }

  db.exec(`
    ALTER TABLE bookings
    ADD COLUMN first_visit_discount INTEGER NOT NULL DEFAULT 0;
  `);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    service TEXT NOT NULL,
    booking_date TEXT NOT NULL,
    booking_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    admin_note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    cancelled_at TEXT
  );
`);

migrateBookingsTableIfNeeded();
ensureBookingsFirstVisitDiscountColumn();

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_bookings_date_time
  ON bookings (booking_date, booking_time);
`);

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS uq_bookings_active_slot
  ON bookings (booking_date, booking_time)
  WHERE status IN ('pending', 'confirmed');
`);

db.exec(`
  CREATE TRIGGER IF NOT EXISTS trg_bookings_updated_at
  AFTER UPDATE ON bookings
  FOR EACH ROW
  BEGIN
    UPDATE bookings SET updated_at = datetime('now') WHERE id = OLD.id;
  END;
`);

module.exports = db;
