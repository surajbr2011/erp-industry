/**
 * SQLite database adapter with a pg-compatible query API.
 * Translates PostgreSQL syntax to SQLite where needed.
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'trinix_erp.db');

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL for better performance and concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Converts PostgreSQL placeholders ($1, $2...) to SQLite (?, ?...)
 * and handles basic PG-to-SQLite type/function differences.
 */
function convertQuery(text) {
  if (!text) return text;
  let sql = text;

  // Replace SERIAL PRIMARY KEY
  sql = sql.replace(/SERIAL PRIMARY KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT');

  // Replace ILIKE with LIKE (SQLite LIKE is case-insensitive for ASCII by default)
  sql = sql.replace(/\bILIKE\b/gi, 'LIKE');

  // Remove NULLS LAST / NULLS FIRST (not supported in SQLite < 3.30)
  sql = sql.replace(/\s+NULLS\s+(LAST|FIRST)/gi, '');

  // Replace PostgreSQL-specific types
  sql = sql.replace(/\bBOOLEAN\b/gi, 'INTEGER');
  sql = sql.replace(/\bJSONB?\b/gi, 'TEXT');
  sql = sql.replace(/\bTIMESTAMP(\s+WITH\s+TIME\s+ZONE)?\b/gi, 'TEXT');
  sql = sql.replace(/\bDATE\b/g, 'TEXT');
  sql = sql.replace(/\bDECIMAL\(\d+,\d+\)/gi, 'REAL');
  sql = sql.replace(/\bVARCHAR\(\d+\)/gi, 'TEXT');
  sql = sql.replace(/\bVARCHAR\b/gi, 'TEXT');

  // Replace NOW() with datetime('now')
  sql = sql.replace(/\bNOW\(\)/gi, "datetime('now')");

  // Replace CURRENT_DATE
  sql = sql.replace(/\bCURRENT_DATE\b/gi, "date('now')");

  // Replace CURRENT_TIMESTAMP
  sql = sql.replace(/\bCURRENT_TIMESTAMP\b/gi, "datetime('now')");

  // Default boolean conversions
  sql = sql.replace(/DEFAULT\s+true\b/gi, 'DEFAULT 1');
  sql = sql.replace(/DEFAULT\s+false\b/gi, 'DEFAULT 0');

  return sql;
}

/**
 * Executes a query and returns a pg-compatible result object.
 * Supports INSERT ... RETURNING id via lastInsertRowid.
 */
function query(text, params = []) {
  return new Promise((resolve, reject) => {
    try {
      let sql = convertQuery(text);
      const upperSQL = sql.trim().toUpperCase();

      // Flatten params (handle nested arrays from pg)
      let flatParams = (params || []).map(p => {
        if (p === true) return 1;
        if (p === false) return 0;
        if (p !== null && typeof p === 'object' && !Array.isArray(p)) return JSON.stringify(p);
        return p;
      });

      // Handle $N placeholders to support repeated parameters
      const mappedParams = [];
      sql = sql.replace(/\$(\d+)/g, (_, match) => {
        const idx = parseInt(match, 10) - 1;
        mappedParams.push(flatParams[idx]);
        return '?';
      });
      flatParams = mappedParams;

      if (upperSQL.startsWith('SELECT') || upperSQL.startsWith('WITH')) {
        const stmt = db.prepare(sql);
        const rawRows = stmt.all(...flatParams);
        // Normalize COUNT(*) column name to 'count' for pg compatibility
        const rows = rawRows.map(row => {
          const normalized = { ...row };
          if ('COUNT(*)' in normalized) {
            normalized.count = String(normalized['COUNT(*)']);
            delete normalized['COUNT(*)'];
          }
          return normalized;
        });
        resolve({ rows, rowCount: rows.length });

      } else if (upperSQL.includes('RETURNING')) {
        // Handle INSERT/UPDATE ... RETURNING by splitting
        const returningMatch = sql.match(/(.+?)\s+RETURNING\s+(.+)$/si);
        if (returningMatch) {
          const baseSql = returningMatch[1].trim();
          const returningCols = returningMatch[2].trim().split(',').map(c => c.trim());
          const stmt = db.prepare(baseSql);
          const info = stmt.run(...flatParams);

          // Fetch the inserted/updated row
          let row = {};
          if (returningCols.includes('*') || returningCols.includes('id')) {
            const lastId = info.lastInsertRowid;
            // Try to get the full row
            const tableMatch = baseSql.match(/(?:INSERT INTO|UPDATE)\s+(\w+)/i);
            if (tableMatch) {
              try {
                const fetchStmt = db.prepare(`SELECT * FROM ${tableMatch[1]} WHERE rowid = ?`);
                row = fetchStmt.get(lastId) || { id: lastId };
              } catch {
                row = { id: lastId };
              }
            }
          }
          resolve({ rows: [row], rowCount: info.changes });
        }

      } else if (upperSQL.startsWith('INSERT') || upperSQL.startsWith('UPDATE') ||
        upperSQL.startsWith('DELETE') || upperSQL.startsWith('CREATE') ||
        upperSQL.startsWith('DROP') || upperSQL.startsWith('ALTER') ||
        upperSQL.startsWith('BEGIN') || upperSQL.startsWith('COMMIT') ||
        upperSQL.startsWith('ROLLBACK')) {

        // For transaction control in SQLite
        if (upperSQL === 'BEGIN') {
          db.prepare('BEGIN').run();
          resolve({ rows: [], rowCount: 0 });
          return;
        }
        if (upperSQL === 'COMMIT') {
          db.prepare('COMMIT').run();
          resolve({ rows: [], rowCount: 0 });
          return;
        }
        if (upperSQL === 'ROLLBACK') {
          db.prepare('ROLLBACK').run();
          resolve({ rows: [], rowCount: 0 });
          return;
        }

        const stmt = db.prepare(sql);
        const info = stmt.run(...flatParams);
        resolve({ rows: [], rowCount: info.changes, insertId: info.lastInsertRowid });
      } else {
        const stmt = db.prepare(sql);
        const rows = stmt.all(...flatParams);
        resolve({ rows, rowCount: rows.length });
      }
    } catch (err) {
      console.error('DB Error:', err.message, '\nSQL:', text);
      reject(err);
    }
  });
}

// Fake pool object for compatibility with code that uses pool.connect()
const pool = {
  connect: () => Promise.resolve({
    query: query,
    release: () => { },
  }),
  query,
  on: () => { },
  end: () => { },
};

module.exports = { query, pool, db };
