import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

// Resolve the database path. Defaults to data/shorts.db in the project root.
// Override with the SHORTS_DB_PATH env var to point at an external database.
const PROJECT_ROOT = path.resolve(process.cwd());

export const DB_PATH =
  process.env["SHORTS_DB_PATH"] ??
  path.join(PROJECT_ROOT, "data", "shorts.db");

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  // Belt and suspenders: the handle is already readonly, but query_only also
  // blocks writes issued by transactions opened elsewhere in the process.
  _db.pragma("query_only = ON");
  return _db;
}

export function hasDatabase(): boolean {
  return fs.existsSync(DB_PATH);
}
