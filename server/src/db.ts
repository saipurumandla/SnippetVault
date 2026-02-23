import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from './config.js';
import { migrate } from './migrate.js';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

const db: Database.Database = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
migrate(db);

export default db;
