// Postgres: connection pool, versioned migrations, queries and the daily clean-up.
// Only used when DATABASE_URL is set; without it the API answers 503 and the app runs as before.
import pg from 'pg';

/** Every migration runs once, in order, in its own transaction. Never change a released one, add a new one. */
const MIGRATIONS = [
  {
    version: 1,
    sql: `
      CREATE TABLE events (
        id bigserial PRIMARY KEY,
        day date NOT NULL,
        type text NOT NULL,
        mode text,
        script text,
        lang text,
        chars integer,
        duration_s integer
      );
      CREATE INDEX events_day_type ON events (day, type);
      CREATE TABLE messages (
        id bigserial PRIMARY KEY,
        created_at timestamptz NOT NULL DEFAULT now(),
        name text,
        email text,
        message text NOT NULL,
        lang text,
        status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'done'))
      );
      CREATE INDEX messages_created ON messages (created_at DESC);
    `,
  },
];

/** the day of an event in German time (one bucket per calendar day, no time of day is stored) */
const TODAY = `(now() AT TIME ZONE 'Europe/Berlin')::date`;

export class Db {
  /** @param {string} url @param {boolean} [ssl] */
  constructor(url, ssl = false) {
    this.pool = new pg.Pool({
      connectionString: url,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5000,
      // Railway's private network (postgres.railway.internal) and a local container need no TLS;
      // DATABASE_SSL=true for a public proxy address (its certificate is self-signed)
      ssl: ssl ? { rejectUnauthorized: false } : undefined,
    });
    // a dropped idle connection must not end the process
    this.pool.on('error', (e) => console.warn('Postgres:', e.message));
    this.ready = false;
  }

  async migrate() {
    const c = await this.pool.connect();
    try {
      await c.query('SELECT pg_advisory_lock(7351)');
      await c.query('CREATE TABLE IF NOT EXISTS schema_version (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
      const { rows } = await c.query('SELECT coalesce(max(version), 0) AS v FROM schema_version');
      const have = Number(rows[0].v);
      for (const m of MIGRATIONS) {
        if (m.version <= have) continue;
        await c.query('BEGIN');
        try {
          await c.query(m.sql);
          await c.query('INSERT INTO schema_version (version) VALUES ($1)', [m.version]);
          await c.query('COMMIT');
          console.log(`Datenbank: Migration ${m.version} ausgeführt.`);
        } catch (e) {
          await c.query('ROLLBACK');
          throw e;
        }
      }
    } finally {
      await c.query('SELECT pg_advisory_unlock(7351)').catch(() => undefined);
      c.release();
    }
    this.ready = true;
  }

  /** messages after 12 months, raw events after 13 months */
  async cleanup() {
    const m = await this.pool.query(`DELETE FROM messages WHERE created_at < now() - interval '12 months'`);
    const e = await this.pool.query(`DELETE FROM events WHERE day < ${TODAY} - interval '13 months'`);
    if (m.rowCount || e.rowCount) console.log(`Datenbank: ${m.rowCount} alte Nachrichten und ${e.rowCount} alte Ereignisse gelöscht.`);
  }

  async addEvent(ev) {
    await this.pool.query(`INSERT INTO events (day, type, mode, script, lang, chars, duration_s) VALUES (${TODAY}, $1, $2, $3, $4, $5, $6)`, [
      ev.type,
      ev.mode,
      ev.script,
      ev.lang,
      ev.chars,
      ev.durationS,
    ]);
  }

  async addMessage(msg) {
    await this.pool.query('INSERT INTO messages (name, email, message, lang) VALUES ($1, $2, $3, $4)', [msg.name, msg.email, msg.message, msg.lang]);
  }

  /** usage of the last `days` days (today included) */
  async stats(days) {
    const since = `${TODAY} - ($1::int - 1)`;
    const q = (sql) => this.pool.query(sql, [days]).then((r) => r.rows);
    const [perDay, perMode, perScript, perLang, totals] = await Promise.all([
      q(`SELECT to_char(day, 'YYYY-MM-DD') AS day,
                count(*) FILTER (WHERE type = 'visit')::int AS visits,
                count(*) FILTER (WHERE type = 'game_start')::int AS starts,
                count(*) FILTER (WHERE type = 'game_end')::int AS ends,
                count(*) FILTER (WHERE type = 'scan')::int AS scans,
                coalesce(sum(chars) FILTER (WHERE type = 'scan'), 0)::int AS chars
           FROM events WHERE day >= ${since} GROUP BY day ORDER BY day`),
      q(`SELECT mode,
                count(*) FILTER (WHERE type = 'game_start')::int AS starts,
                count(*) FILTER (WHERE type = 'game_end')::int AS ends,
                coalesce(sum(chars) FILTER (WHERE type = 'scan'), 0)::int AS chars,
                coalesce(round(avg(duration_s) FILTER (WHERE type = 'game_end')), 0)::int AS avg_duration_s
           FROM events WHERE day >= ${since} AND mode IS NOT NULL GROUP BY mode ORDER BY starts DESC`),
      q(`SELECT coalesce(script, '?') AS script,
                count(*) FILTER (WHERE type = 'game_start')::int AS starts,
                coalesce(sum(chars) FILTER (WHERE type = 'scan'), 0)::int AS chars
           FROM events WHERE day >= ${since} AND type IN ('game_start', 'scan') GROUP BY 1 ORDER BY starts DESC`),
      q(`SELECT coalesce(lang, '?') AS lang,
                count(*) FILTER (WHERE type = 'visit')::int AS visits,
                count(*) FILTER (WHERE type = 'game_start')::int AS starts
           FROM events WHERE day >= ${since} GROUP BY 1 ORDER BY visits DESC`),
      q(`SELECT count(*) FILTER (WHERE type = 'visit')::int AS visits,
                count(*) FILTER (WHERE type = 'game_start')::int AS starts,
                count(*) FILTER (WHERE type = 'game_end')::int AS ends,
                count(*) FILTER (WHERE type = 'scan')::int AS scans,
                coalesce(sum(chars) FILTER (WHERE type = 'scan'), 0)::int AS chars
           FROM events WHERE day >= ${since}`),
    ]);
    const { rows } = await this.pool.query(
      `SELECT to_char(${TODAY} - ($1::int - 1), 'YYYY-MM-DD') AS "from", to_char(${TODAY}, 'YYYY-MM-DD') AS "to",
              (SELECT count(*)::int FROM messages WHERE status = 'new') AS unread`,
      [days],
    );
    return { days, ...rows[0], totals: totals[0], perDay, perMode, perScript, perLang };
  }

  async messages(page, pageSize, status) {
    const where = status ? 'WHERE status = $3' : '';
    const args = status ? [pageSize, (page - 1) * pageSize, status] : [pageSize, (page - 1) * pageSize];
    const [items, total] = await Promise.all([
      this.pool.query(`SELECT id::text, created_at, name, email, message, lang, status FROM messages ${where} ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2`, args),
      this.pool.query(`SELECT count(*)::int AS n FROM messages ${status ? 'WHERE status = $1' : ''}`, status ? [status] : []),
    ]);
    return { items: items.rows, total: total.rows[0].n, page, pageSize };
  }

  /** returns false when there is no such message */
  async changeMessage(id, action) {
    const r = action.delete
      ? await this.pool.query('DELETE FROM messages WHERE id = $1', [id])
      : await this.pool.query('UPDATE messages SET status = $2 WHERE id = $1', [id, action.status]);
    return r.rowCount > 0;
  }

  close() {
    return this.pool.end();
  }
}
