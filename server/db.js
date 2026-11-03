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
  {
    // the usage events became a plain counter of page views per day
    version: 2,
    sql: `
      CREATE TABLE visits (
        day date PRIMARY KEY,
        n integer NOT NULL DEFAULT 0
      );
      INSERT INTO visits (day, n) SELECT day, count(*) FROM events WHERE type = 'visit' GROUP BY day;
      DROP TABLE events;
    `,
  },
  {
    // page views per country (ISO 3166 code from the IP address; ZZ = unknown)
    version: 3,
    sql: `
      CREATE TABLE visit_countries (
        day date NOT NULL,
        country char(2) NOT NULL,
        n integer NOT NULL DEFAULT 0,
        PRIMARY KEY (day, country)
      );
    `,
  },
];

/** the day of a page view in German time (one bucket per calendar day, no time of day is stored) */
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

  /** messages after 12 months (the page view counts say nothing about anybody and stay) */
  async cleanup() {
    const m = await this.pool.query(`DELETE FROM messages WHERE created_at < now() - interval '12 months'`);
    if (m.rowCount) console.log(`Datenbank: ${m.rowCount} alte Nachrichten gelöscht.`);
  }

  /** one more page view today, from `country` (ISO code, null when unknown) */
  async addVisit(country) {
    await this.pool.query(
      `WITH total AS (INSERT INTO visits (day, n) VALUES (${TODAY}, 1) ON CONFLICT (day) DO UPDATE SET n = visits.n + 1)
       INSERT INTO visit_countries (day, country, n) VALUES (${TODAY}, $1, 1) ON CONFLICT (day, country) DO UPDATE SET n = visit_countries.n + 1`,
      [/^[A-Z]{2}$/.test(country || '') ? country : 'ZZ'],
    );
  }

  async addMessage(msg) {
    await this.pool.query('INSERT INTO messages (name, email, message, lang) VALUES ($1, $2, $3, $4)', [msg.name, msg.email, msg.message, msg.lang]);
  }

  /** page views of the last `days` days (today included), and in all since the first one */
  async stats(days) {
    const since = `${TODAY} - ($1::int - 1)`;
    const [perDay, perCountry, head] = await Promise.all([
      this.pool.query(`SELECT to_char(day, 'YYYY-MM-DD') AS day, n AS visits FROM visits WHERE day >= ${since} ORDER BY day`, [days]),
      // page views counted before the countries (and with an unknown address) are the rest of the total
      this.pool.query(
        `SELECT country, sum(n)::int AS visits FROM visit_countries WHERE day >= ${since} AND country <> 'ZZ' GROUP BY country ORDER BY visits DESC, country`,
        [days],
      ),
      this.pool.query(
        `SELECT to_char(${since}, 'YYYY-MM-DD') AS "from", to_char(${TODAY}, 'YYYY-MM-DD') AS "to",
                (SELECT coalesce(sum(n), 0)::int FROM visits WHERE day >= ${since}) AS visits,
                (SELECT coalesce(sum(n), 0)::int FROM visits) AS "allTime",
                (SELECT to_char(min(day), 'YYYY-MM-DD') FROM visits) AS "firstDay",
                (SELECT count(*)::int FROM messages WHERE status = 'new') AS unread`,
        [days],
      ),
    ]);
    return { days, ...head.rows[0], perDay: perDay.rows, perCountry: perCountry.rows };
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
