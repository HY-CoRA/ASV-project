'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const Game = require('./js/engine.js');

const MAX_BODY_BYTES = 64 * 1024;
const ATTEMPT_LIFETIME_MS = 24 * 60 * 60 * 1000;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg'
};
const ENTRY_FIELDS = 'id, name, score, elapsed_ms AS elapsedMs, level, actions, blocks, verdict, ending, created_at AS createdAt';
const ENTRY_ORDER = 'score DESC, elapsed_ms ASC, created_at ASC, id ASC';

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0, rejected = false;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        if (!rejected) reject(new HttpError(413, '요청이 너무 큽니다.'));
        rejected = true;
        return;
      }
      if (!rejected) chunks.push(chunk);
    });
    req.on('error', reject);
    req.on('end', () => {
      if (rejected) return;
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error();
        resolve(body);
      } catch { reject(new HttpError(400, 'JSON 객체를 보내주세요.')); }
    });
  });
}

function validateProgram(program) {
  let count = 0, checkouts = 0;
  function readSequence(sequence, depth) {
    if (!Array.isArray(sequence) || depth > 12 || sequence.length > 500) {
      throw new HttpError(400, '블록의 개수나 깊이가 허용 범위를 넘었습니다.');
    }
    return sequence.map(node => {
      if (!node || typeof node !== 'object' || Array.isArray(node) || ++count > 500) {
        throw new HttpError(400, '올바른 블록 프로그램을 보내주세요.');
      }
      const op = node.op;
      const allowed = ['op', 'id'];
      const out = { op };
      if (node.id !== undefined && (typeof node.id !== 'string' || node.id.length > 200)) {
        throw new HttpError(400, '올바른 블록 ID가 아닙니다.');
      }
      if (['move', 'left', 'right', 'pick', 'checkout'].includes(op)) {
        if (op === 'checkout' && ++checkouts > 1) throw new HttpError(400, '종료하기 블록은 하나만 사용할 수 있습니다.');
      } else if (op === 'repeat') {
        allowed.push('n', 'body');
        if (!Number.isInteger(node.n) || node.n < 1 || node.n > 20) {
          throw new HttpError(400, '반복 횟수는 1부터 20까지입니다.');
        }
        out.n = node.n;
        out.body = readSequence(node.body, depth + 1);
      } else if (op === 'if') {
        allowed.push('cond', 'body');
        if (!['WALL', 'NOWALL'].includes(node.cond)) throw new HttpError(400, '올바른 조건이 아닙니다.');
        out.cond = node.cond;
        out.body = readSequence(node.body, depth + 1);
      } else throw new HttpError(400, '알 수 없는 블록입니다.');
      if (Object.keys(node).some(key => !allowed.includes(key))) throw new HttpError(400, '알 수 없는 블록 속성입니다.');
      return out;
    });
  }
  const ast = readSequence(program, 0);
  return { ast, blocks: count + 1 };
}

function createServer(options = {}) {
  const staticDir = fs.realpathSync(options.staticDir || __dirname);
  const dbPath = options.dbPath || path.join(path.dirname(__dirname), 'work', 'asv-leaderboard.sqlite');
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS attempts (
      id TEXT PRIMARY KEY,
      level INTEGER NOT NULL CHECK (level IN (1, 2)),
      map_json TEXT NOT NULL,
      shopping_json TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      elapsed_base_ms INTEGER NOT NULL DEFAULT 0,
      outcome_json TEXT
    );
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id TEXT NOT NULL UNIQUE REFERENCES attempts(id),
      name TEXT NOT NULL,
      score INTEGER NOT NULL,
      elapsed_ms INTEGER NOT NULL,
      level INTEGER NOT NULL CHECK (level IN (1, 2)),
      actions INTEGER NOT NULL,
      blocks INTEGER NOT NULL,
      verdict TEXT NOT NULL,
      ending TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS entries_ranking ON entries
      (level, score DESC, elapsed_ms ASC, created_at ASC, id ASC);
  `);
  const now = options.now || Date.now;
  const generateLevel = options.generateLevel || Game.generateLevel;
  const getAttempt = db.prepare('SELECT * FROM attempts WHERE id = ?');
  const getEntry = db.prepare(`SELECT ${ENTRY_FIELDS} FROM entries WHERE attempt_id = ?`);
  const topEntries = db.prepare(`SELECT ${ENTRY_FIELDS} FROM entries WHERE level = ? ORDER BY ${ENTRY_ORDER} LIMIT 10`);
  const totalEntries = db.prepare('SELECT COUNT(*) AS total FROM entries WHERE level = ?');
  const rankEntry = db.prepare(`SELECT COUNT(*) + 1 AS rank FROM entries WHERE level = ? AND (
    score > ? OR (score = ? AND elapsed_ms < ?) OR
    (score = ? AND elapsed_ms = ? AND created_at < ?) OR
    (score = ? AND elapsed_ms = ? AND created_at = ? AND id < ?)
  )`);
  const insertAttempt = db.prepare('INSERT INTO attempts (id, level, map_json, shopping_json, started_at, elapsed_base_ms) VALUES (?, ?, ?, ?, ?, ?)');
  const saveOutcome = db.prepare('UPDATE attempts SET outcome_json = ? WHERE id = ? AND outcome_json IS NULL');
  const insertEntry = db.prepare('INSERT OR IGNORE INTO entries (attempt_id, name, score, elapsed_ms, level, actions, blocks, verdict, ending, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

  function attemptById(id) {
    const attempt = getAttempt.get(id);
    if (!attempt) throw new HttpError(404, '이 도전 기록을 찾을 수 없습니다.');
    if (now() - attempt.started_at > ATTEMPT_LIFETIME_MS) throw new HttpError(410, '도전 시간이 만료되었습니다. 새 맵을 시작해주세요.');
    return attempt;
  }
  function requireLevel(level) {
    if (level !== 1 && level !== 2) throw new HttpError(400, '난이도는 1 또는 2여야 합니다.');
    return level;
  }
  function json(res, status, body) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(body));
  }

  async function handleApi(req, res, url) {
    if (url.pathname === '/api/health' && req.method === 'GET') {
      json(res, 200, { ok: true });
      return;
    }
    if (url.pathname === '/api/leaderboard' && req.method === 'GET') {
      const rawLevel = url.searchParams.get('level');
      const level = requireLevel(rawLevel === null ? 1 : rawLevel === '1' ? 1 : rawLevel === '2' ? 2 : null);
      json(res, 200, { entries: topEntries.all(level), total: totalEntries.get(level).total });
      return;
    }
    if (url.pathname === '/api/attempts' && req.method === 'POST') {
      const body = await readJson(req);
      const level = requireLevel(body.level);
      let map, shoppingList, elapsedBaseMs = 0;
      if (body.retryOf !== undefined) {
        if (typeof body.retryOf !== 'string') throw new HttpError(400, '다시 도전할 기록을 확인해주세요.');
        const previous = attemptById(body.retryOf);
        if (previous.level !== level || !previous.outcome_json) throw new HttpError(409, '완료한 같은 난이도의 도전만 이어갈 수 있습니다.');
        map = JSON.parse(previous.map_json);
        shoppingList = JSON.parse(previous.shopping_json);
        elapsedBaseMs = JSON.parse(previous.outcome_json).elapsedMs;
      } else {
        const generated = generateLevel(level);
        map = generated.map;
        shoppingList = generated.shoppingList;
      }
      const id = randomUUID(), startedAt = Math.trunc(now());
      insertAttempt.run(id, level, JSON.stringify(map), JSON.stringify(shoppingList), startedAt, elapsedBaseMs);
      json(res, 201, { id, level, map, shoppingList, startedAt, serverNow: Math.trunc(now()), elapsedBaseMs });
      return;
    }
    const match = /^\/api\/attempts\/([a-zA-Z0-9-]{1,80})\/(finish|entry)$/.exec(url.pathname);
    if (match && req.method === 'POST') {
      const body = await readJson(req);
      const attempt = attemptById(match[1]);
      if (match[2] === 'finish') {
        if (attempt.outcome_json) { json(res, 200, JSON.parse(attempt.outcome_json)); return; }
        const { ast, blocks } = validateProgram(body.program);
        const engine = new Game.Engine({ id: attempt.level, map: JSON.parse(attempt.map_json), shoppingList: JSON.parse(attempt.shopping_json) });
        for (const step of Game.interpret(ast, engine)) { /* Only the shared engine determines the outcome. */ }
        const elapsedMs = attempt.elapsed_base_ms + Math.max(0, Math.trunc(now()) - attempt.started_at);
        const outcome = { id: attempt.id, result: Game.score(engine), checkedOut: engine.checkedOut,
          actions: engine.actions, blocks, elapsedMs, eligible: engine.checkedOut || Boolean(engine.failure) };
        const saved = saveOutcome.run(JSON.stringify(outcome), attempt.id);
        // A second process sharing the database may have finished this attempt first.
        json(res, 200, saved.changes ? outcome : JSON.parse(getAttempt.get(attempt.id).outcome_json));
        return;
      }
      if (!attempt.outcome_json) throw new HttpError(409, '도전을 끝낸 뒤 이름을 등록해주세요.');
      const outcome = JSON.parse(attempt.outcome_json);
      if (!outcome.eligible) throw new HttpError(409, '종료하기 또는 실패 엔딩까지 도전한 기록만 등록할 수 있습니다.');
      if (typeof body.name !== 'string' || /[\p{Cc}\p{Cf}]/u.test(body.name)) throw new HttpError(400, '이름은 제어 문자 없이 입력해주세요.');
      const name = body.name.trim().normalize('NFC');
      if (!name || Array.from(name).length > 12) throw new HttpError(400, '이름은 1~12자로 입력해주세요.');
      insertEntry.run(attempt.id, name, outcome.result.total, outcome.elapsedMs, attempt.level, outcome.actions,
        outcome.blocks, outcome.result.verdict, outcome.result.failure || null, Math.trunc(now()));
      const entry = getEntry.get(attempt.id);
      const rank = rankEntry.get(entry.level, entry.score, entry.score, entry.elapsedMs, entry.score, entry.elapsedMs,
        entry.createdAt, entry.score, entry.elapsedMs, entry.createdAt, entry.id).rank;
      json(res, 200, { entry, rank, entries: topEntries.all(attempt.level) });
      return;
    }
    throw new HttpError(404, 'API 경로를 찾을 수 없습니다.');
  }

  function serveStatic(req, res, url) {
    if (req.method !== 'GET') throw new HttpError(405, 'GET 요청만 지원합니다.');
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); } catch { throw new HttpError(400, '올바른 경로가 아닙니다.'); }
    if (pathname.includes('\\') || pathname.includes('\0')) throw new HttpError(404, '파일을 찾을 수 없습니다.');
    const parts = pathname.split('/').filter(Boolean);
    if (parts.some(part => part.startsWith('.')) || parts.some(part => ['test', 'server', 'db', 'data', 'work', 'node_modules'].includes(part))) {
      throw new HttpError(404, '파일을 찾을 수 없습니다.');
    }
    const relative = parts.length ? parts.join('/') : 'index.html';
    const extension = path.extname(relative).toLowerCase();
    if (!(relative === 'index.html' || relative === 'favicon.ico' || ['css', 'js', 'vendor', 'assets'].includes(parts[0])) || !MIME_TYPES[extension]) {
      throw new HttpError(404, '파일을 찾을 수 없습니다.');
    }
    let absolute;
    try {
      const requested = path.join(staticDir, relative);
      absolute = fs.realpathSync(requested);
      if (absolute !== requested || !absolute.startsWith(staticDir + path.sep) || !fs.statSync(absolute).isFile()) throw new Error();
    } catch { throw new HttpError(404, '파일을 찾을 수 없습니다.'); }
    res.writeHead(200, { 'Content-Type': MIME_TYPES[extension], 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    fs.createReadStream(absolute).on('error', () => res.destroy()).pipe(res);
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://asv.local');
      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) await handleApi(req, res, url);
      else serveStatic(req, res, url);
    } catch (error) {
      if (error instanceof HttpError) json(res, error.status, { error: error.message });
      else {
        if (options.onError) options.onError(error);
        else console.error('ASV server:', error);
        json(res, 500, { error: '서버에서 요청을 처리하지 못했습니다.' });
      }
    }
  });
  server.db = db;
  server.on('close', () => db.close());
  return server;
}

if (require.main === module) {
  const options = {}, values = { '--host': 'host', '--port': 'port', '--static-dir': 'staticDir', '--db': 'dbPath' };
  for (let i = 2; i < process.argv.length; i++) {
    const key = values[process.argv[i]], value = process.argv[++i];
    if (!key || !value) throw new Error('사용법: node server.cjs [--host 0.0.0.0] [--port 5211] [--static-dir 경로] [--db 경로]');
    options[key] = key === 'port' ? Number(value) : value;
  }
  const port = options.port ?? Number(process.env.PORT || 5211);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('올바른 포트를 지정해주세요.');
  const host = options.host || '0.0.0.0';
  const server = createServer(options);
  server.listen(port, host, () => console.log(`ASV game and leaderboard listening on ${host}:${server.address().port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => process.exit(0)));
}

module.exports = { createServer, validateProgram };
