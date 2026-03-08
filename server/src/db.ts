import type Database from 'better-sqlite3';
import { config } from './config.js';
import { migrate } from './migrate.js';
import { openDb } from './sqlite.js';

const db: Database.Database = openDb(config.dbPath);
migrate(db);

export default db;
