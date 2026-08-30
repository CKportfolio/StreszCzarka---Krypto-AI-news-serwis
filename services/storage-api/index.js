const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const cron = require('node-cron');
const { createApiKeyGuard, normalizeTableName, safeField } = require('./lib/security');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = Number(process.env.PORT || 8900);
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '';

for (const name of ['DB_USER', 'DB_PASSWORD', 'DB_NAME', 'DB_HOST', 'INTERNAL_API_KEY']) {
  if (!process.env[name]) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
}

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT || 5432)
});

const requireApiKey = createApiKeyGuard(INTERNAL_API_KEY);

app.use('/api', requireApiKey);

async function connectWithRetry(retries = 15, delay = 1500) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/tables', async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE'
      ORDER BY table_name
    `);
    res.json(result.rows.map(row => row.table_name.toLowerCase()));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/:table', async (req, res) => {
  try {
    const table = normalizeTableName(req.params.table);
    const result = await pool.query(`SELECT * FROM "${table}" ORDER BY id`);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/:table', async (req, res) => {
  try {
    const table = normalizeTableName(req.params.table);
    const keys = Object.keys(req.body || {}).map(safeField);

    if (!keys.length) {
      const result = await pool.query(`INSERT INTO "${table}" DEFAULT VALUES RETURNING *`);
      return res.json({ status: 'added', row: result.rows[0] });
    }

    const values = keys.map(key => req.body[key]);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
    const columns = keys.map(key => `"${key}"`).join(',');
    const result = await pool.query(
      `INSERT INTO "${table}" (${columns}) VALUES (${placeholders}) RETURNING *`,
      values
    );
    res.json({ status: 'added', row: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/:table/update', async (req, res) => {
  try {
    const table = normalizeTableName(req.params.table);
    const { id, field, value } = req.body || {};
    if (!id || !field) return res.status(400).json({ error: 'Missing id or field' });
    const column = safeField(field);
    const result = await pool.query(
      `UPDATE "${table}" SET "${column}"=$1 WHERE id=$2 RETURNING *`,
      [value, id]
    );
    res.json(result.rowCount ? { status: 'updated', row: result.rows[0] } : { status: 'not_found' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/:table/clear', async (req, res) => {
  try {
    const table = normalizeTableName(req.params.table);
    await pool.query(`DELETE FROM "${table}"`);
    res.json({ status: 'cleared', table });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tables/create', async (req, res) => {
  try {
    const { name, columns } = req.body || {};
    if (!name || !Array.isArray(columns) || !columns.length) {
      return res.status(400).json({ error: 'Missing table definition' });
    }
    const table = normalizeTableName(name);
    const typeMap = { text: 'TEXT', int: 'INTEGER', date: 'DATE', bool: 'BOOLEAN' };
    const defs = columns.map(column => `"${safeField(column.name)}" ${typeMap[column.type] || 'TEXT'}`);
    await pool.query(`CREATE TABLE IF NOT EXISTS "${table}" (id SERIAL PRIMARY KEY, ${defs.join(',')})`);
    res.json({ status: 'created', table });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tables/:table', async (req, res) => {
  try {
    const table = normalizeTableName(req.params.table);
    await pool.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    res.json({ status: 'dropped', table });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/:table/:id', async (req, res) => {
  try {
    const table = normalizeTableName(req.params.table);
    const result = await pool.query(`DELETE FROM "${table}" WHERE id=$1 RETURNING *`, [req.params.id]);
    res.json(result.rowCount ? { status: 'deleted', row: result.rows[0] } : { status: 'not_found' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

cron.schedule('0 0 * * *', async () => {
  try {
    await pool.query(`DELETE FROM "Archiwum" WHERE data_powstania < NOW() - INTERVAL '4 days'`);
  } catch (error) {
    console.error('Archive cleanup failed:', error.message);
  }
});

connectWithRetry()
  .then(() => app.listen(PORT, '0.0.0.0', () => console.log(`Storage API listening on ${PORT}`)))
  .catch(error => {
    console.error('Database unavailable:', error.message);
    process.exit(1);
  });
