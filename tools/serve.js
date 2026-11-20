#!/usr/bin/env node
// Zero-dependency static server for the browser build.
//   node tools/serve.js [--port 5173] [--open]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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

const args = process.argv.slice(2);
const portArg = args.indexOf('--port');
let port = Number(portArg !== -1 ? args[portArg + 1] : process.env.PORT || 5173);
const open = args.includes('--open');

const server = http.createServer((req, res) => {
  let rel;
  try {
    rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch {
    res.writeHead(400).end('bad request');
    return;
  }
  if (rel.split('/').some((seg) => seg.startsWith('.'))) {
    res.writeHead(404).end('not found');
    return;
  }
  let file = path.resolve(ROOT, '.' + rel);
  if (!file.startsWith(ROOT)) {
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
});

function openBrowser(url) {
  const cmd = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
  try {
    const child = spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true });
    child.on('error', () => {});
    child.unref();
  } catch {
    /* no browser launcher: the URL is printed anyway */
  }
}

let attempts = 0;
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE' && attempts++ < 20) {
    port += 1;
    server.listen(port);
  } else {
    console.error(`error: ${e.message}`);
    process.exit(1);
  }
});
server.on('listening', () => {
  const url = `http://localhost:${port}/`;
  console.log(`Đảo Đèn Lồng đang chạy tại ${url}  (Ctrl+C để dừng)`);
  if (open) openBrowser(url);
});
server.listen(port);
