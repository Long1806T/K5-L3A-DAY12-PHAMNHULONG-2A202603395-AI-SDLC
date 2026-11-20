#!/usr/bin/env node
// Release helper for v1.0.0 (Ticket-04 §5, DoD). Run it on YOUR machine (the one
// with a real GPU), from a clean clone of main:
//   node tools/release.js            test → bench + soak here → commit → tags → zip → GitHub Release
//   node tools/release.js --skip-bench    keep the committed bench.json / soak.json
//   node tools/release.js --dry-run       only print what would happen
// Needs git; `gh` (GitHub CLI, logged in) for the Release itself, otherwise the
// script prints the steps for the GitHub website. It never moves an existing tag
// and never rewrites history.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const VERSION = 'v1.0.0';
const ZIP = path.join('dist', `dao-den-long-${VERSION}.zip`);
const VIDEO = path.join('docs', 'demo', 'demo.mp4');
const NOTES = path.join('docs', `release-notes-${VERSION}.md`);
// commits that finished phases 1–3 (phase-4 = HEAD after the bench commit below)
const PHASE_COMMITS = { 'phase-1': '3823fc1', 'phase-2': '0395107', 'phase-3': '64f5d6a' };

const say = (m) => console.log(`\n▶ ${m}`);
function run(cmd, cmdArgs, { allowFail = false, quiet = false, mutate = false } = {}) {
  const shown = `${cmd} ${cmdArgs.join(' ')}`;
  if (DRY && mutate) {
    console.log(`  (dry-run) ${shown}`);
    return { status: 0, stdout: '', stderr: '' };
  }
  if (!quiet) console.log(`  $ ${shown}`);
  const r = spawnSync(cmd, cmdArgs, { cwd: ROOT, encoding: 'utf8', stdio: quiet ? 'pipe' : ['inherit', 'pipe', 'pipe'] });
  if (!quiet && r.stdout) process.stdout.write(r.stdout.split('\n').map((l) => (l ? `    ${l}` : l)).join('\n'));
  if (r.status !== 0 && !allowFail) {
    console.error(`\n✗ Lỗi khi chạy: ${shown}\n${r.stderr || r.error?.message || ''}`);
    process.exit(1);
  }
  return r;
}
const git = (a, o) => run('git', a, o);
const out = (r) => (r.stdout || '').trim();

say('Kiểm tra repo');
if (out(git(['rev-parse', '--is-inside-work-tree'], { quiet: true })) !== 'true') process.exit(1);
const branch = out(git(['rev-parse', '--abbrev-ref', 'HEAD'], { quiet: true }));
if (branch !== 'main') {
  console.error(`✗ Đang ở nhánh "${branch}". Chạy: git checkout main`);
  process.exit(1);
}
if (out(git(['status', '--porcelain'], { quiet: true }))) {
  console.error('✗ Còn thay đổi chưa commit. Commit hoặc stash trước khi phát hành.');
  process.exit(1);
}
git(['pull', '--ff-only'], { mutate: true });
for (const [tag, sha] of Object.entries(PHASE_COMMITS)) {
  if (git(['cat-file', '-e', `${sha}^{commit}`], { quiet: true, allowFail: true }).status !== 0) {
    console.error(`✗ Không thấy commit ${sha} (${tag}). Hãy chạy từ bản clone của repo gốc.`);
    process.exit(1);
  }
}

say('Chạy toàn bộ test');
{
  const t = run(process.execPath, ['scripts/run-tests.js'], { quiet: true, allowFail: true });
  console.log((t.stdout || '').split('\n').filter((l) => /^# (tests|pass|fail) |^not ok/.test(l)).map((l) => `    ${l}`).join('\n'));
  if (t.status !== 0) {
    console.error('✗ Test đỏ: sửa trước khi phát hành (chạy npm test để xem chi tiết).');
    process.exit(1);
  }
}

if (!args.includes('--skip-bench')) {
  say('Đo bench và soak trên máy này (bench mở một cửa sổ Chrome/Edge 1280×720 khoảng 40 giây, đừng thu nhỏ nó)');
  const bench = run(process.execPath, ['tools/bench.js', '--seed', '42', '--duration', '30', '--out', 'bench.json'], { allowFail: true, mutate: true });
  if (bench.status !== 0) console.log('  ! Bench không chạy được ở đây: giữ bench.json cũ. Có thể thêm --browser "<đường dẫn chrome.exe>".');
  run(process.execPath, ['tools/soak.js', '--seed', '7', '--nights', '10', '--out', 'soak.json'], { mutate: true });
  if (out(git(['status', '--porcelain', 'bench.json', 'soak.json'], { quiet: true }))) {
    git(['add', 'bench.json', 'soak.json'], { mutate: true });
    git(['commit', '-m', `perf: bench.json và soak.json đo trên máy phát hành (${os.type()} ${os.release()})`], { mutate: true });
    git(['push', 'origin', 'main'], { mutate: true });
  }
}

say('Gắn tag các phase (không di chuyển tag đã có)');
const head = out(git(['rev-parse', 'HEAD'], { quiet: true }));
const want = { ...PHASE_COMMITS, 'phase-4': head };
for (const [tag, sha] of Object.entries(want)) {
  const have = git(['rev-parse', '-q', '--verify', `refs/tags/${tag}^{commit}`], { quiet: true, allowFail: true });
  if (have.status === 0) {
    const at = out(have);
    console.log(`  ${tag} đã có (${at.slice(0, 7)})${at.startsWith(sha) || sha.startsWith(at.slice(0, 7)) ? '' : `: KHÁC commit dự kiến ${sha.slice(0, 7)}, giữ nguyên`}`);
  } else {
    git(['tag', '-a', tag, sha, '-m', `${tag}: hoàn thành ${tag.replace('phase-', 'Phase ')}`], { mutate: true });
  }
}
git(['push', 'origin', ...Object.keys(want)], { mutate: true, allowFail: true });

say(`Đóng gói ${ZIP} (thư mục web tĩnh, chạy bằng Node)`);
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
git(['archive', '--format=zip', `--prefix=dao-den-long-${VERSION}/`, '-o', ZIP, 'phase-4'], { mutate: true });

say(`Tạo GitHub Release ${VERSION}`);
const files = [ZIP, VIDEO].filter((f) => DRY || fs.existsSync(path.join(ROOT, f)));
const gh = spawnSync('gh', ['auth', 'status'], { cwd: ROOT, encoding: 'utf8' });
if (gh.status === 0) {
  const exists = spawnSync('gh', ['release', 'view', VERSION], { cwd: ROOT, encoding: 'utf8' }).status === 0;
  if (exists) run('gh', ['release', 'upload', VERSION, ...files, '--clobber'], { mutate: true });
  else run('gh', ['release', 'create', VERSION, ...files, '--title', `Đảo Đèn Lồng ${VERSION}`, '--notes-file', NOTES, '--target', head], { mutate: true });
  run('gh', ['release', 'view', VERSION, '--json', 'url', '--jq', '.url'], { allowFail: true });
} else {
  console.log(`  Chưa có GitHub CLI (gh) đã đăng nhập. Làm trên web:
    1. Mở https://github.com/Long1806T/K5-L3A-DAY12-PHAMNHULONG-2A202603395-AI-SDLC/releases/new
    2. Choose a tag: gõ ${VERSION} → "Create new tag", Target: main
    3. Title: Đảo Đèn Lồng ${VERSION}; nội dung: dán file ${NOTES}
    4. Kéo thả 2 file: ${files.join(' và ')}
    5. Publish release`);
}
console.log('\n✓ Xong. Mở trang repo bằng cửa sổ ẩn danh để chắc tag, Release và video xem được khi chưa đăng nhập.');
