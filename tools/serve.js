#!/usr/bin/env node
// Zero-dependency server for the browser build, plus the local leaderboard API.
//   node tools/serve.js [--port 5173] [--host 127.0.0.1] [--open]
//   node tools/serve.js [...] --export-leaderboard out.json   → writes {"entries": [...]} and exits
// Leaderboard file: data/leaderboard.json (or $DDL_DATA_DIR/leaderboard.json).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { insertEntry, normalizeBoard } from '../src/web/leaderboard.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const boardFile = () => path.join(process.env.DDL_DATA_DIR ? path.resolve(process.env.DDL_DATA_DIR) : path.join(ROOT, 'data'), 'leaderboard.json');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.wav': 'audio/wav',
};

/** Top-10 list from disk, cleaned and sorted ([] when there is no file yet). */
export function readBoard(file = boardFile()) {
  try {
    return normalizeBoard(JSON.parse(fs.readFileSync(file, 'utf8')).entries);
  } catch {
    return [];
  }
}

export function writeBoard(entries, file = boardFile()) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify({ entries }, null, 2)}\n`);
  fs.renameSync(tmp, file); // atomic replace: a crash never leaves half a file
}

const sendJson = (res, code, obj) => res.writeHead(code, { 'content-type': TYPES['.json'], 'cache-control': 'no-store' }).end(JSON.stringify(obj));

export function readBody(req, limit = 16384) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('body too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function leaderboardApi(req, res, file) {
  if (req.method === 'GET') return sendJson(res, 200, { entries: readBoard(file), storage: 'disk' });
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'GET or POST' });
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch (e) {
    return sendJson(res, 400, { error: `bad JSON: ${e.message}` });
  }
  try {
    const { entries, rank, entry } = insertEntry(readBoard(file), body);
    writeBoard(entries, file);
    return sendJson(res, 200, { entries, rank, entry, storage: 'disk' });
  } catch (e) {
    return sendJson(res, 400, { error: e.message });
  }
}

function serveStatic(root, req, res, url) {
  let rel;
  try {
    rel = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400).end('bad request');
    return;
  }
  if (rel.split('/').some((seg) => seg.startsWith('.'))) {
    res.writeHead(404).end('not found');
    return;
  }
  let file = path.resolve(root, `.${rel}`);
  if (!file.startsWith(root)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  });
}

/** Static files + /api/leaderboard. `extra(req, res, url)` may handle a request first (returns true). */
export function createAppServer({ root = ROOT, file = boardFile(), extra = null } = {}) {
  return http.createServer(async (req, res) => {
    let url;
    try {
      url = new URL(req.url, 'http://x');
    } catch {
      res.writeHead(400).end('bad request');
      return;
    }
    try {
      if (extra && (await extra(req, res, url))) return;
      if (url.pathname === '/api/leaderboard') return await leaderboardApi(req, res, file);
      serveStatic(root, req, res, url);
    } catch (e) {
      if (!res.headersSent) sendJson(res, 500, { error: e.message });
    }
  });
}

/** `--export-leaderboard out.json`: {"entries": [...]} in board order. */
export function exportLeaderboard(out, file = boardFile()) {
  const entries = readBoard(file);
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify({ entries }, null, 2)}\n`);
  return entries.length;
}

export function openBrowser(url) {
  const cmd = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
  try {
    const child = spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true });
    child.on('error', () => {});
    child.unref();
  } catch {
    /* no browser launcher: the URL is printed anyway */
  }
}

function main(args) {
  const val = (k) => {
    const i = args.indexOf(k);
    if (i !== -1) return args[i + 1];
    const eq = args.find((a) => a.startsWith(`${k}=`));
    return eq ? eq.slice(k.length + 1) : undefined;
  };
  const out = val('--export-leaderboard');
  if (args.includes('--export-leaderboard') || out) {
    if (!out || out.startsWith('--')) {
      console.error('usage: node tools/serve.js --export-leaderboard <out.json>');
      return 1;
    }
    const n = exportLeaderboard(out);
    const rel = path.relative(process.cwd(), boardFile());
    console.log(`Đã xuất ${n} mục bảng xếp hạng (${rel.startsWith('..') ? boardFile() : rel}) → ${out}`);
    return 0;
  }
  let port = Number(val('--port') ?? process.env.PORT ?? 5173);
  const host = val('--host') ?? '127.0.0.1';
  const server = createAppServer();
  let attempts = 0;
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE' && attempts++ < 20) {
      port += 1;
      server.listen(port, host);
    } else {
      console.error(`error: ${e.message}`);
      process.exit(1);
    }
  });
  server.on('listening', () => {
    const url = `http://localhost:${port}/`;
    console.log(`Đảo Đèn Lồng đang chạy tại ${url}  (Ctrl+C để dừng)`);
    if (args.includes('--open')) openBrowser(url);
  });
  server.listen(port, host);
  return null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const code = main(process.argv.slice(2));
  if (code !== null) process.exitCode = code;
}
