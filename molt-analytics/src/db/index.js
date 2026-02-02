const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../../molt.db');
const db = new Database(dbPath);

function init() {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    db.exec(schema);
    console.log('Database initialized');
}

function query(sql, params = []) {
    return db.prepare(sql).all(params);
}

function get(sql, params = []) {
    return db.prepare(sql).get(params);
}

function run(sql, params = []) {
    return db.prepare(sql).run(params);
}

function insert(table, data) {
    const keys = Object.keys(data);
    const placeholders = keys.map(() => '?').join(', ');
    const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
    return run(sql, Object.values(data));
}

module.exports = {
    init,
    query,
    get,
    run,
    insert
};
