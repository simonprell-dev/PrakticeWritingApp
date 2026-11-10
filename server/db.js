// Postgres: connection pool, versioned migrations, queries and the daily clean-up.
// Only used when DATABASE_URL is set; without it the API answers 503 and the app runs as before.
import { randomUUID } from 'node:crypto';
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
  {
    // operator settings as JSON, e.g. the yearly plan of the worlds ('worlds')
    version: 4,
    sql: `
      CREATE TABLE settings (
        key text PRIMARY KEY,
        value jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `,
  },
  {
    // ideas and feedback: what a message is about and which game; the feedback light after a game
    version: 5,
    sql: `
      ALTER TABLE messages ADD COLUMN kind text, ADD COLUMN game text;
      CREATE TABLE ratings (
        id bigserial PRIMARY KEY,
        created_at timestamptz NOT NULL DEFAULT now(),
        game text NOT NULL,
        rating text NOT NULL CHECK (rating IN ('gruen', 'gelb', 'rot')),
        lang text
      );
      CREATE INDEX ratings_created ON ratings (created_at DESC);
    `,
  },
  {
    // handwriting samples a class gives after a lesson to improve the recognition (server/samples.js)
    version: 6,
    sql: `
      CREATE TABLE samples (
        id bigserial PRIMARY KEY,
        batch uuid NOT NULL,
        seq integer NOT NULL,
        scan integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        label text NOT NULL,
        label_source text NOT NULL CHECK (label_source IN ('wort', 'uebung', 'erkannt')),
        recognized text,
        target text,
        score real,
        tier text,
        mirrored boolean NOT NULL DEFAULT false,
        rejected boolean NOT NULL DEFAULT false,
        dots smallint NOT NULL DEFAULT 0,
        box_x real,
        box_y real,
        box_w real,
        box_h real,
        script text NOT NULL,
        style text,
        mode text,
        lang text,
        png bytea NOT NULL,
        exported_at timestamptz
      );
      CREATE INDEX samples_batch ON samples (batch, seq);
      CREATE INDEX samples_created ON samples (created_at);
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

  /** messages and votes after 12 months (the page view counts say nothing about anybody and stay) */
  async cleanup() {
    const m = await this.pool.query(`DELETE FROM messages WHERE created_at < now() - interval '12 months'`);
    if (m.rowCount) console.log(`Datenbank: ${m.rowCount} alte Nachrichten gelöscht.`);
    const r = await this.pool.query(`DELETE FROM ratings WHERE created_at < now() - interval '12 months'`);
    if (r.rowCount) console.log(`Datenbank: ${r.rowCount} alte Ampel-Stimmen gelöscht.`);
    const s = await this.pool.query(`DELETE FROM samples WHERE created_at < now() - interval '12 months'`);
    if (s.rowCount) console.log(`Datenbank: ${s.rowCount} alte Schriftproben gelöscht.`);
  }

  /** the letters of one lesson (validateSampleBatch), in one transaction; returns the new batch id */
  async addSamples(b) {
    const batch = randomUUID();
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      for (const s of b.samples) {
        await c.query(
          `INSERT INTO samples (batch, seq, scan, label, label_source, recognized, target, score, tier, mirrored, rejected, dots,
                                box_x, box_y, box_w, box_h, script, style, mode, lang, png)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
          [batch, s.seq, s.scan, s.label, s.source, s.recognized, s.target, s.score, s.tier, s.mirrored, s.rejected, s.dots,
            s.box.x, s.box.y, s.box.w, s.box.h, b.script, b.style, b.game, b.lang, s.png],
        );
      }
      await c.query('COMMIT');
    } catch (e) {
      await c.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      c.release();
    }
    return batch;
  }

  async sampleCount() {
    const { rows } = await this.pool.query('SELECT count(*)::int AS n FROM samples');
    return rows[0].n;
  }

  /** what the admin page shows: counts, per label source and script, and the latest lessons */
  async sampleStats() {
    const [head, bySource, byScript, latest] = await Promise.all([
      this.pool.query(
        `SELECT count(*)::int AS total, count(*) FILTER (WHERE exported_at IS NULL)::int AS fresh,
                count(DISTINCT batch)::int AS batches, coalesce(sum(octet_length(png)), 0)::bigint AS bytes FROM samples`,
      ),
      this.pool.query(`SELECT label_source AS source, count(*)::int AS n FROM samples GROUP BY label_source ORDER BY n DESC`),
      this.pool.query(`SELECT script, count(*)::int AS n FROM samples GROUP BY script ORDER BY n DESC`),
      this.pool.query(
        `SELECT batch::text, min(created_at) AS created_at, count(*)::int AS n, min(mode) AS mode, min(script) AS script, min(lang) AS lang,
                bool_and(exported_at IS NOT NULL) AS exported, string_agg(label, '' ORDER BY seq) AS labels,
                (array_agg(id::text ORDER BY seq))[1:60] AS ids, (array_agg(label_source ORDER BY seq))[1:60] AS sources
         FROM samples GROUP BY batch ORDER BY min(created_at) DESC LIMIT 20`,
      ),
    ]);
    return { ...head.rows[0], bytes: Number(head.rows[0].bytes), bySource: bySource.rows, byScript: byScript.rows, latest: latest.rows };
  }

  /** the image of one sample, null when there is none */
  async samplePng(id) {
    const { rows } = await this.pool.query('SELECT png FROM samples WHERE id = $1', [id]);
    return rows[0]?.png ?? null;
  }

  /** a page of samples for the download, in the order they came in: all, or only those not downloaded yet */
  async samplePage(onlyFresh, afterId, limit) {
    const { rows } = await this.pool.query(
      `SELECT id::text, batch::text, seq, scan, created_at, label, label_source, recognized, target, score, tier, mirrored, rejected, dots,
              box_x, box_y, box_w, box_h, script, style, mode, lang, png
       FROM samples WHERE id > $1 ${onlyFresh ? 'AND exported_at IS NULL' : ''} ORDER BY id LIMIT $2`,
      [afterId, limit],
    );
    return rows;
  }

  async markSamplesExported(ids) {
    if (!ids.length) return;
    await this.pool.query('UPDATE samples SET exported_at = now() WHERE id = ANY($1::bigint[]) AND exported_at IS NULL', [ids]);
  }

  /** removes one lesson ({ batch }), the downloaded samples ({ exported }) or all ({ all }); returns how many */
  async deleteSamples(what) {
    const r = what.batch
      ? await this.pool.query('DELETE FROM samples WHERE batch = $1', [what.batch])
      : what.exported
        ? await this.pool.query('DELETE FROM samples WHERE exported_at IS NOT NULL')
        : await this.pool.query('DELETE FROM samples');
    return r.rowCount;
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
    await this.pool.query('INSERT INTO messages (name, email, message, lang, kind, game) VALUES ($1, $2, $3, $4, $5, $6)', [
      msg.name,
      msg.email,
      msg.message,
      msg.lang,
      msg.kind ?? null,
      msg.game ?? null,
    ]);
  }

  async addRating(v) {
    await this.pool.query('INSERT INTO ratings (game, rating, lang) VALUES ($1, $2, $3)', [v.game, v.rating, v.lang]);
  }

  /** the votes of the last `days` days: per game green / yellow / red, in all, and the latest ones */
  async ratings(days) {
    const since = `now() - ($1::int * interval '1 day')`;
    const [perGame, latest, total] = await Promise.all([
      this.pool.query(
        `SELECT game, count(*) FILTER (WHERE rating = 'gruen')::int AS gruen, count(*) FILTER (WHERE rating = 'gelb')::int AS gelb,
                count(*) FILTER (WHERE rating = 'rot')::int AS rot FROM ratings WHERE created_at >= ${since} GROUP BY game ORDER BY count(*) DESC, game`,
        [days],
      ),
      this.pool.query(`SELECT id::text, created_at, game, rating, lang FROM ratings WHERE created_at >= ${since} ORDER BY created_at DESC, id DESC LIMIT 50`, [days]),
      this.pool.query('SELECT count(*)::int AS n FROM ratings'),
    ]);
    return { days, perGame: perGame.rows, latest: latest.rows, allTime: total.rows[0].n };
  }

  /** removes one vote ({ id }), those of a game ({ game }) or all ({ all }); returns how many */
  async deleteRatings(what) {
    const r = what.id
      ? await this.pool.query('DELETE FROM ratings WHERE id = $1', [what.id])
      : what.game
        ? await this.pool.query('DELETE FROM ratings WHERE game = $1', [what.game])
        : await this.pool.query('DELETE FROM ratings');
    return r.rowCount;
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

  /** a page of messages, filtered by status and kind ('ohne' = messages without a kind) when given */
  async messages(page, pageSize, status, kind) {
    const conds = [];
    const args = [];
    if (status) conds.push(`status = $${args.push(status)}`);
    if (kind === 'ohne') conds.push('kind IS NULL');
    else if (kind) conds.push(`kind = $${args.push(kind)}`);
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const n = args.length;
    const [items, total] = await Promise.all([
      this.pool.query(
        `SELECT id::text, created_at, name, email, message, lang, status, kind, game FROM messages ${where} ORDER BY created_at DESC, id DESC LIMIT $${n + 1} OFFSET $${n + 2}`,
        [...args, pageSize, (page - 1) * pageSize],
      ),
      this.pool.query(`SELECT count(*)::int AS n FROM messages ${where}`, args),
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

  /** a stored setting, null when there is none */
  async getSetting(key) {
    const { rows } = await this.pool.query('SELECT value FROM settings WHERE key = $1', [key]);
    return rows[0]?.value ?? null;
  }

  async setSetting(key, value) {
    await this.pool.query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()',
      [key, JSON.stringify(value)],
    );
  }

  close() {
    return this.pool.end();
  }
}
